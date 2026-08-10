/**
 * Mikdaten — Projekt- und Objektsteuerung für die Immobilienverwaltung.
 * Cloudflare Worker: statisches SPA-Shell + JSON-API auf D1.
 */

const APP_HTML = __APP_HTML__;

const SESSION_COOKIE = 'mk_session';
const SESSION_DAYS = 30;

/* ------------------------------------------------------------------ utils */

const nowIso = () => new Date().toISOString();

function uid(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  let s = '';
  for (const b of bytes) s += b.toString(36).padStart(2, '0');
  return `${prefix}_${s.slice(0, 14)}`;
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

const fail = (status, message, extra = {}) => json({ error: message, ...extra }, { status });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function b64(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hashPassword(password, saltBytes, iterations = 100000) {
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(bits)}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = unb64(parts[2]);
  const expected = await hashPassword(password, salt, iterations);
  // konstante Laufzeit über die Länge des Hashes
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(stored);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function sessionCookie(token, maxAge) {
  const bits = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  return bits.join('; ');
}

/* ------------------------------------------------------------------- data */

const pick = (src, fields) => {
  const out = {};
  for (const f of fields) if (Object.prototype.hasOwnProperty.call(src, f)) out[f] = src[f] === '' ? null : src[f];
  return out;
};

async function insertRow(db, table, data) {
  const keys = Object.keys(data);
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
  await db.prepare(sql).bind(...keys.map((k) => data[k])).run();
}

async function updateRow(db, table, id, data) {
  const keys = Object.keys(data);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
  await db.prepare(sql).bind(...keys.map((k) => data[k]), id).run();
}

async function logActivity(db, user, action, entity, entityId, summary, projectId = null) {
  await insertRow(db, 'activity', {
    id: uid('act'),
    user_id: user ? user.id : null,
    action,
    entity,
    entity_id: entityId,
    project_id: projectId,
    summary,
    created_at: nowIso(),
  });
}

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  role: u.role,
  job_title: u.job_title,
  phone: u.phone,
  initials: u.initials,
  color: u.color,
  avatar: u.avatar,
});

async function loadState(db) {
  const q = (sql) => db.prepare(sql).all();
  const [users, projects, members, columns, tasks, comments, checklist, properties, contacts, events, documents, photos, activity] =
    await Promise.all([
      q('SELECT * FROM users ORDER BY name'),
      q('SELECT * FROM projects ORDER BY archived, position, created_at'),
      q('SELECT * FROM project_members'),
      q('SELECT * FROM columns ORDER BY position'),
      q('SELECT * FROM tasks ORDER BY position'),
      q('SELECT * FROM comments ORDER BY created_at'),
      q('SELECT * FROM checklist_items ORDER BY position'),
      q('SELECT * FROM properties ORDER BY created_at DESC'),
      q('SELECT * FROM contacts ORDER BY name'),
      q('SELECT * FROM events ORDER BY date, time'),
      q('SELECT * FROM documents ORDER BY created_at DESC'),
      q('SELECT * FROM photos ORDER BY position, created_at'),
      q('SELECT * FROM activity ORDER BY created_at DESC LIMIT 120'),
    ]);

  return {
    users: users.results.map(publicUser),
    projects: projects.results,
    members: members.results,
    columns: columns.results,
    tasks: tasks.results.map((t) => ({ ...t, labels: safeLabels(t.labels) })),
    comments: comments.results,
    checklist: checklist.results,
    properties: properties.results,
    contacts: contacts.results,
    events: events.results,
    documents: documents.results,
    photos: photos.results,
    activity: activity.results,
  };
}

function safeLabels(raw) {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/* ----------------------------------------------------------------- router */

async function authenticate(request, db) {
  const token = parseCookies(request.headers.get('cookie'))[SESSION_COOKIE];
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .bind(token, nowIso())
    .first();
  return row || null;
}

const DEFAULT_COLUMNS = [
  { title: 'Backlog', is_done: 0 },
  { title: 'Zu erledigen', is_done: 0 },
  { title: 'In Arbeit', is_done: 0 },
  { title: 'Prüfung', is_done: 0 },
  { title: 'Erledigt', is_done: 1 },
];

const PROJECT_FIELDS = [
  'name', 'description', 'type', 'status', 'color', 'property_id',
  'lead_id', 'budget', 'volume', 'start_date', 'due_date', 'position', 'archived',
];
const TASK_FIELDS = [
  'title', 'description', 'priority', 'assignee_id', 'property_id', 'contact_id',
  'start_date', 'due_date', 'estimate', 'amount', 'column_id', 'position', 'project_id',
];
const PROPERTY_FIELDS = [
  'code', 'title', 'street', 'zip', 'city', 'country', 'type', 'deal', 'status',
  'units', 'rooms', 'area_sqm', 'plot_sqm', 'year_built', 'energy_class',
  'purchase_price', 'asking_price', 'rent_cold', 'service_charge', 'owner_contact',
  'image_url', 'notes',
];
const CONTACT_FIELDS = ['name', 'role', 'company', 'email', 'phone', 'street', 'zip', 'city', 'property_id', 'notes'];
const EVENT_FIELDS = ['title', 'type', 'date', 'time', 'duration', 'location', 'project_id', 'property_id', 'contact_id', 'owner_id', 'notes'];

const DOC_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/svg+xml': 'svg',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
};
const MAX_DOC_BYTES = 25 * 1024 * 1024;
const INLINE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain'];

const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
};
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/* ------------------------------------------------------------------ Icons */
__ICONS__

/* Base64 einmal beim Kaltstart auspacken, danach aus dem Speicher ausliefern. */
const ICON_CACHE = {};
function iconBytes(b64) {
  if (ICON_CACHE[b64]) return ICON_CACHE[b64];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  ICON_CACHE[b64] = bytes;
  return bytes;
}

const iconResponse = (b64, type) => new Response(iconBytes(b64), {
  headers: {
    'content-type': type,
    'cache-control': 'public, max-age=86400',
    'access-control-allow-origin': '*',
  },
});

/* ------------------------------------------------------------- MCP-Server */
__MCP_MODULE__

async function handleApi(request, env, url) {
  const db = env.DB;
  const path = url.pathname.replace(/^\/api/, '');
  const method = request.method.toUpperCase();
  const isBinary = path === '/photos/upload' || path === '/documents/upload';
  const body = method === 'GET' || method === 'DELETE' || isBinary
    ? {}
    : await request.json().catch(() => ({}));

  /* --- öffentlich --- */
  if (path === '/auth/login' && method === 'POST') {
    const login = String(body.login || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!login || !password) return fail(400, 'Bitte Benutzername und Passwort angeben.');
    const user = await db
      .prepare('SELECT * FROM users WHERE lower(username) = ? OR lower(email) = ?')
      .bind(login, login)
      .first();
    const ok = user ? await verifyPassword(password, user.password) : false;
    if (!ok) return fail(401, 'Zugangsdaten stimmen nicht.');

    const token = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[^a-zA-Z0-9]/g, '');
    const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
    await insertRow(db, 'sessions', {
      token,
      user_id: user.id,
      created_at: nowIso(),
      expires_at: expires,
      user_agent: (request.headers.get('user-agent') || '').slice(0, 200),
    });
    await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowIso()).run();
    return json(
      { user: publicUser(user) },
      { headers: { 'set-cookie': sessionCookie(token, SESSION_DAYS * 86400) } },
    );
  }

  /* --- ab hier: Login nötig --- */
  const me = await authenticate(request, db);

  if (path === '/auth/logout' && method === 'POST') {
    const token = parseCookies(request.headers.get('cookie'))[SESSION_COOKIE];
    if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return json({ ok: true }, { headers: { 'set-cookie': sessionCookie('', 0) } });
  }

  if (!me) return fail(401, 'Nicht angemeldet.');

  // CSRF: Mutationen nur mit explizitem Header (kein Formular-Cross-Site-Post)
  if (method !== 'GET' && request.headers.get('x-mikdaten') !== '1') {
    return fail(403, 'Ungültige Anfrage.');
  }

  if (path === '/state' && method === 'GET') {
    const state = await loadState(db);
    return json({ me: publicUser(me), ...state });
  }

  if (path === '/account' && method === 'PATCH') {
    const data = pick(body, ['name', 'job_title', 'phone', 'color', 'avatar', 'email']);
    if (data.name) data.initials = initialsOf(data.name);
    if (Object.prototype.hasOwnProperty.call(data, 'email')) {
      const email = String(data.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(400, 'Bitte eine gültige E-Mail-Adresse angeben.');
      const taken = await db.prepare('SELECT id FROM users WHERE lower(email) = ? AND id <> ?').bind(email, me.id).first();
      if (taken) return fail(409, 'Diese E-Mail-Adresse wird bereits verwendet.');
      data.email = email;
    }
    if (data.avatar !== undefined && data.avatar !== null && !/^pixel:[a-z]{2,20}$/.test(String(data.avatar))) {
      return fail(400, 'Unbekanntes Profilbild.');
    }
    await updateRow(db, 'users', me.id, data);
    const fresh = await db.prepare('SELECT * FROM users WHERE id = ?').bind(me.id).first();
    return json({ user: publicUser(fresh) });
  }

  if (path === '/account/password' && method === 'POST') {
    const current = String(body.current || '');
    const next = String(body.next || '');
    if (next.length < 10) return fail(400, 'Das neue Passwort braucht mindestens 10 Zeichen.');
    if (!(await verifyPassword(current, me.password))) return fail(400, 'Aktuelles Passwort ist falsch.');
    await updateRow(db, 'users', me.id, { password: await hashPassword(next) });
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(me.id).run();
    return json({ ok: true }, { headers: { 'set-cookie': sessionCookie('', 0) } });
  }

  /* --- MCP-Zugänge --- */
  if (path === '/mcp/tokens' && method === 'GET') {
    const rows = await db.prepare(
      'SELECT id, client_name, created_at, last_used_at FROM oauth_tokens WHERE user_id = ? ORDER BY created_at DESC',
    ).bind(me.id).all();
    return json({ tokens: rows.results || [] });
  }

  if (path.startsWith('/mcp/tokens/') && method === 'DELETE') {
    const id = path.slice('/mcp/tokens/'.length);
    await db.prepare('DELETE FROM oauth_tokens WHERE id = ? AND user_id = ?').bind(id, me.id).run();
    return json({ ok: true });
  }

  /* --- Projekte --- */
  if (path === '/projects' && method === 'POST') {
    const id = uid('prj');
    const ts = nowIso();
    const maxPos = await db.prepare('SELECT COALESCE(MAX(position), 0) AS p FROM projects').first();
    const data = {
      id,
      ...pick(body, PROJECT_FIELDS),
      name: String(body.name || 'Neues Projekt').slice(0, 160),
      position: (maxPos?.p ?? 0) + 1,
      created_at: ts,
      updated_at: ts,
    };
    if (!data.color) data.color = '#FF4E5B';
    if (!data.type) data.type = 'verwaltung';
    if (!data.status) data.status = 'aktiv';
    await insertRow(db, 'projects', data);

    const cols = Array.isArray(body.columns) && body.columns.length
      ? body.columns.map((t, i) => ({ title: String(t).slice(0, 60), is_done: i === body.columns.length - 1 ? 1 : 0 }))
      : DEFAULT_COLUMNS;
    for (let i = 0; i < cols.length; i++) {
      await insertRow(db, 'columns', {
        id: uid('col'), project_id: id, title: cols[i].title, position: i,
        is_done: cols[i].is_done, created_at: ts,
      });
    }
    const members = new Set([me.id, ...(Array.isArray(body.member_ids) ? body.member_ids : [])]);
    if (data.lead_id) members.add(data.lead_id);
    for (const m of members) {
      await db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)').bind(id, m).run();
    }
    await logActivity(db, me, 'create', 'project', id, `Projekt „${data.name}" angelegt`, id);
    return json({ ok: true, id });
  }

  let m;
  if ((m = path.match(/^\/projects\/([\w-]+)$/))) {
    const id = m[1];
    if (method === 'PATCH') {
      const data = pick(body, PROJECT_FIELDS);
      data.updated_at = nowIso();
      await updateRow(db, 'projects', id, data);
      if (Array.isArray(body.member_ids)) {
        await db.prepare('DELETE FROM project_members WHERE project_id = ?').bind(id).run();
        for (const u of body.member_ids) {
          await db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)').bind(id, u).run();
        }
      }
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const row = await db.prepare('SELECT name FROM projects WHERE id = ?').bind(id).first();
      await db.prepare('DELETE FROM projects WHERE id = ?').bind(id).run();
      await logActivity(db, me, 'delete', 'project', id, `Projekt „${row?.name || id}" gelöscht`);
      return json({ ok: true });
    }
  }

  /* --- Spalten --- */
  if (path === '/columns' && method === 'POST') {
    const id = uid('col');
    const max = await db.prepare('SELECT COALESCE(MAX(position), -1) AS p FROM columns WHERE project_id = ?')
      .bind(body.project_id).first();
    await insertRow(db, 'columns', {
      id,
      project_id: body.project_id,
      title: String(body.title || 'Neue Spalte').slice(0, 60),
      position: (max?.p ?? -1) + 1,
      wip_limit: body.wip_limit ?? null,
      is_done: body.is_done ? 1 : 0,
      created_at: nowIso(),
    });
    return json({ ok: true, id });
  }

  if ((m = path.match(/^\/columns\/([\w-]+)$/))) {
    const id = m[1];
    if (method === 'PATCH') {
      await updateRow(db, 'columns', id, pick(body, ['title', 'wip_limit', 'position', 'is_done']));
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const count = await db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE column_id = ?').bind(id).first();
      if ((count?.c ?? 0) > 0) return fail(400, 'Spalte enthält noch Aufgaben.');
      await db.prepare('DELETE FROM columns WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }

  if (path === '/columns/reorder' && method === 'POST') {
    const order = Array.isArray(body.order) ? body.order : [];
    for (let i = 0; i < order.length; i++) {
      await db.prepare('UPDATE columns SET position = ? WHERE id = ?').bind(i, order[i]).run();
    }
    return json({ ok: true });
  }

  /* --- Aufgaben --- */
  if (path === '/tasks' && method === 'POST') {
    const id = uid('tsk');
    const ts = nowIso();
    const max = await db.prepare('SELECT COALESCE(MAX(position), 0) AS p FROM tasks WHERE column_id = ?')
      .bind(body.column_id).first();
    const data = {
      id,
      ...pick(body, TASK_FIELDS),
      title: String(body.title || 'Neue Aufgabe').slice(0, 240),
      labels: JSON.stringify(Array.isArray(body.labels) ? body.labels.slice(0, 12) : []),
      position: body.position ?? (max?.p ?? 0) + 1024,
      created_by: me.id,
      created_at: ts,
      updated_at: ts,
    };
    if (!data.priority) data.priority = 'normal';
    const col = await db.prepare('SELECT is_done FROM columns WHERE id = ?').bind(data.column_id).first();
    if (col?.is_done) data.done_at = ts;
    await insertRow(db, 'tasks', data);
    await logActivity(db, me, 'create', 'task', id, `Aufgabe „${data.title}" erstellt`, data.project_id);
    return json({ ok: true, id });
  }

  if (path === '/tasks/move' && method === 'POST') {
    const { id, column_id, order, position } = body;
    if (!id || !column_id) return fail(400, 'Ungültiger Zug.');
    const col = await db.prepare('SELECT is_done, project_id, title FROM columns WHERE id = ?').bind(column_id).first();
    if (!col) return fail(404, 'Spalte nicht gefunden.');
    const task = await db.prepare('SELECT title, done_at, project_id, column_id FROM tasks WHERE id = ?').bind(id).first();
    if (!task) return fail(404, 'Aufgabe nicht gefunden.');

    const done_at = col.is_done ? (task.done_at || nowIso()) : null;
    if (typeof position === 'number' && Number.isFinite(position)) {
      await db.prepare('UPDATE tasks SET column_id = ?, project_id = ?, done_at = ?, position = ?, updated_at = ? WHERE id = ?')
        .bind(column_id, col.project_id, done_at, position, nowIso(), id).run();
    } else {
      await db.prepare('UPDATE tasks SET column_id = ?, project_id = ?, done_at = ?, updated_at = ? WHERE id = ?')
        .bind(column_id, col.project_id, done_at, nowIso(), id).run();
    }

    // Nur wenn ausdrücklich eine Reihenfolge mitkommt, wird die Spalte neu nummeriert
    const ids = Array.isArray(order) ? order : [];
    for (let i = 0; i < ids.length; i++) {
      await db.prepare('UPDATE tasks SET position = ? WHERE id = ?').bind((i + 1) * 1024, ids[i]).run();
    }
    if (task.column_id !== column_id) {
      await logActivity(db, me, 'move', 'task', id, `„${task.title}" → ${col.title}`, col.project_id);
    }
    return json({ ok: true });
  }

  if ((m = path.match(/^\/tasks\/([\w-]+)$/))) {
    const id = m[1];
    if (method === 'PATCH') {
      const data = pick(body, TASK_FIELDS);
      if (Array.isArray(body.labels)) data.labels = JSON.stringify(body.labels.slice(0, 12));
      data.updated_at = nowIso();
      await updateRow(db, 'tasks', id, data);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const row = await db.prepare('SELECT title, project_id FROM tasks WHERE id = ?').bind(id).first();
      await db.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
      await logActivity(db, me, 'delete', 'task', id, `Aufgabe „${row?.title || id}" gelöscht`, row?.project_id);
      return json({ ok: true });
    }
  }

  /* --- Kommentare & Checkliste --- */
  if (path === '/comments' && method === 'POST') {
    const id = uid('cmt');
    const text = String(body.body || '').trim();
    if (!text) return fail(400, 'Kommentar ist leer.');
    await insertRow(db, 'comments', {
      id, task_id: body.task_id, user_id: me.id, body: text.slice(0, 4000), created_at: nowIso(),
    });
    return json({ ok: true, id });
  }
  if ((m = path.match(/^\/comments\/([\w-]+)$/)) && method === 'DELETE') {
    await db.prepare('DELETE FROM comments WHERE id = ? AND user_id = ?').bind(m[1], me.id).run();
    return json({ ok: true });
  }

  if (path === '/checklist' && method === 'POST') {
    const id = uid('chk');
    const max = await db.prepare('SELECT COALESCE(MAX(position), -1) AS p FROM checklist_items WHERE task_id = ?')
      .bind(body.task_id).first();
    await insertRow(db, 'checklist_items', {
      id, task_id: body.task_id, text: String(body.text || '').slice(0, 300), done: 0, position: (max?.p ?? -1) + 1,
    });
    return json({ ok: true, id });
  }
  if ((m = path.match(/^\/checklist\/([\w-]+)$/))) {
    if (method === 'PATCH') {
      await updateRow(db, 'checklist_items', m[1], pick(body, ['text', 'done', 'position']));
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM checklist_items WHERE id = ?').bind(m[1]).run();
      return json({ ok: true });
    }
  }

  /* --- Objekte --- */
  if (path === '/properties' && method === 'POST') {
    const id = uid('obj');
    const ts = nowIso();
    const count = await db.prepare('SELECT COUNT(*) AS c FROM properties').first();
    const data = {
      id,
      ...pick(body, PROPERTY_FIELDS),
      code: body.code || `OBJ-${String((count?.c ?? 0) + 1).padStart(3, '0')}`,
      title: String(body.title || 'Neues Objekt').slice(0, 160),
      created_at: ts,
      updated_at: ts,
    };
    if (!data.type) data.type = 'wohnung';
    if (!data.deal) data.deal = 'bestand';
    if (!data.status) data.status = 'aktiv';
    await insertRow(db, 'properties', data);
    await logActivity(db, me, 'create', 'property', id, `Objekt „${data.title}" angelegt`);
    return json({ ok: true, id });
  }
  if ((m = path.match(/^\/properties\/([\w-]+)$/))) {
    if (method === 'PATCH') {
      const data = pick(body, PROPERTY_FIELDS);
      data.updated_at = nowIso();
      await updateRow(db, 'properties', m[1], data);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const shots = await db.prepare('SELECT key FROM photos WHERE property_id = ?').bind(m[1]).all();
      if (env.MEDIA) for (const s of shots.results) await env.MEDIA.delete(s.key);
      await db.prepare('DELETE FROM properties WHERE id = ?').bind(m[1]).run();
      return json({ ok: true });
    }
  }

  /* --- Fotos (R2) --- */
  if (path === '/photos/upload' && method === 'POST') {
    if (!env.MEDIA) return fail(500, 'Bildspeicher ist nicht verbunden.');
    const propertyId = url.searchParams.get('property_id');
    const property = propertyId
      ? await db.prepare('SELECT id, image_url FROM properties WHERE id = ?').bind(propertyId).first()
      : null;
    if (!property) return fail(400, 'Unbekanntes Objekt.');

    const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = IMAGE_TYPES[type];
    if (!ext) return fail(415, 'Nur JPEG, PNG, WebP, GIF, AVIF oder HEIC sind erlaubt.');

    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength) return fail(400, 'Die Datei ist leer.');
    if (bytes.byteLength > MAX_IMAGE_BYTES) return fail(413, 'Das Bild ist größer als 12 MB.');

    let filename = 'Foto';
    try { filename = decodeURIComponent(request.headers.get('x-filename') || '').slice(0, 180) || 'Foto'; } catch { /* Standard */ }

    const id = uid('pho');
    const key = `objekte/${propertyId}/${id}.${ext}`;
    await env.MEDIA.put(key, bytes, {
      httpMetadata: { contentType: type, cacheControl: 'private, max-age=31536000, immutable' },
      customMetadata: { propertyId, uploadedBy: me.id },
    });

    const max = await db.prepare('SELECT COALESCE(MAX(position), -1) AS p, COUNT(*) AS c FROM photos WHERE property_id = ?')
      .bind(propertyId).first();
    const first = (max?.c ?? 0) === 0;
    await insertRow(db, 'photos', {
      id, property_id: propertyId, key, filename, content_type: type,
      size: bytes.byteLength, caption: null, is_cover: first ? 1 : 0,
      position: (max?.p ?? -1) + 1, user_id: me.id, created_at: nowIso(),
    });
    if (first || !property.image_url) {
      await updateRow(db, 'properties', propertyId, { image_url: `/media/${key}`, updated_at: nowIso() });
    }
    await logActivity(db, me, 'upload', 'photo', id, `Foto zu Objekt hochgeladen: ${filename}`);
    return json({ ok: true, id, url: `/media/${key}` });
  }

  if ((m = path.match(/^\/photos\/([\w-]+)$/))) {
    const photo = await db.prepare('SELECT * FROM photos WHERE id = ?').bind(m[1]).first();
    if (!photo) return fail(404, 'Foto nicht gefunden.');

    if (method === 'PATCH') {
      if (body.is_cover) {
        await db.prepare('UPDATE photos SET is_cover = 0 WHERE property_id = ?').bind(photo.property_id).run();
        await db.prepare('UPDATE photos SET is_cover = 1 WHERE id = ?').bind(photo.id).run();
        await updateRow(db, 'properties', photo.property_id, { image_url: `/media/${photo.key}`, updated_at: nowIso() });
      }
      if (Object.prototype.hasOwnProperty.call(body, 'caption')) {
        await updateRow(db, 'photos', photo.id, { caption: body.caption || null });
      }
      return json({ ok: true });
    }

    if (method === 'DELETE') {
      if (env.MEDIA) await env.MEDIA.delete(photo.key);
      await db.prepare('DELETE FROM photos WHERE id = ?').bind(photo.id).run();
      if (photo.is_cover) {
        const next = await db.prepare('SELECT * FROM photos WHERE property_id = ? ORDER BY position LIMIT 1')
          .bind(photo.property_id).first();
        if (next) {
          await db.prepare('UPDATE photos SET is_cover = 1 WHERE id = ?').bind(next.id).run();
          await updateRow(db, 'properties', photo.property_id, { image_url: `/media/${next.key}` });
        } else {
          await updateRow(db, 'properties', photo.property_id, { image_url: null });
        }
      }
      return json({ ok: true });
    }
  }

  /* --- Kontakte --- */
  if (path === '/contacts' && method === 'POST') {
    const id = uid('con');
    const ts = nowIso();
    await insertRow(db, 'contacts', {
      id, ...pick(body, CONTACT_FIELDS),
      name: String(body.name || 'Neuer Kontakt').slice(0, 160),
      role: body.role || 'sonstige',
      created_at: ts, updated_at: ts,
    });
    return json({ ok: true, id });
  }
  if ((m = path.match(/^\/contacts\/([\w-]+)$/))) {
    if (method === 'PATCH') {
      const data = pick(body, CONTACT_FIELDS);
      data.updated_at = nowIso();
      await updateRow(db, 'contacts', m[1], data);
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM contacts WHERE id = ?').bind(m[1]).run();
      return json({ ok: true });
    }
  }

  /* --- Termine --- */
  if (path === '/events' && method === 'POST') {
    const id = uid('evt');
    await insertRow(db, 'events', {
      id, ...pick(body, EVENT_FIELDS),
      title: String(body.title || 'Neuer Termin').slice(0, 160),
      type: body.type || 'termin',
      date: body.date || nowIso().slice(0, 10),
      owner_id: body.owner_id || me.id,
      created_at: nowIso(),
    });
    return json({ ok: true, id });
  }
  if ((m = path.match(/^\/events\/([\w-]+)$/))) {
    if (method === 'PATCH') {
      await updateRow(db, 'events', m[1], pick(body, EVENT_FIELDS));
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      await db.prepare('DELETE FROM events WHERE id = ?').bind(m[1]).run();
      return json({ ok: true });
    }
  }

  /* --- Dokumente --- */
  if (path === '/documents/upload' && method === 'POST') {
    if (!env.MEDIA) return fail(500, 'Dateispeicher ist nicht verbunden.');
    const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const ext = DOC_TYPES[type];
    if (!ext) return fail(415, 'Dieser Dateityp ist nicht zugelassen.');

    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength) return fail(400, 'Die Datei ist leer.');
    if (bytes.byteLength > MAX_DOC_BYTES) return fail(413, 'Die Datei ist größer als 25 MB.');

    let filename = 'Datei';
    try { filename = decodeURIComponent(request.headers.get('x-filename') || '').slice(0, 200) || 'Datei'; } catch { /* Standard */ }

    const projectId = url.searchParams.get('project_id') || null;
    const propertyId = url.searchParams.get('property_id') || null;
    const taskId = url.searchParams.get('task_id') || null;
    if (!projectId && !propertyId && !taskId) return fail(400, 'Die Datei braucht einen Bezug.');

    const id = uid('doc');
    const key = `dokumente/${propertyId || projectId || taskId}/${id}.${ext}`;
    await env.MEDIA.put(key, bytes, {
      httpMetadata: { contentType: type, cacheControl: 'private, max-age=31536000, immutable' },
      customMetadata: { uploadedBy: me.id },
    });
    await insertRow(db, 'documents', {
      id,
      title: filename.replace(/\.[a-z0-9]{1,6}$/i, '').slice(0, 200) || filename,
      url: null,
      storage_key: key,
      filename,
      content_type: type,
      size: bytes.byteLength,
      kind: url.searchParams.get('kind') || 'sonstige',
      project_id: projectId,
      property_id: propertyId,
      task_id: taskId,
      user_id: me.id,
      created_at: nowIso(),
    });
    await logActivity(db, me, 'upload', 'document', id, `Datei hochgeladen: ${filename}`, projectId);
    return json({ ok: true, id, url: `/media/${key}` });
  }

  if (path === '/documents' && method === 'POST') {
    const id = uid('doc');
    await insertRow(db, 'documents', {
      id,
      title: String(body.title || 'Dokument').slice(0, 200),
      url: String(body.url || '').slice(0, 1000),
      kind: body.kind || 'sonstige',
      project_id: body.project_id || null,
      property_id: body.property_id || null,
      task_id: body.task_id || null,
      user_id: me.id,
      created_at: nowIso(),
    });
    return json({ ok: true, id });
  }
  if ((m = path.match(/^\/documents\/([\w-]+)$/)) && method === 'DELETE') {
    const doc = await db.prepare('SELECT storage_key FROM documents WHERE id = ?').bind(m[1]).first();
    if (doc?.storage_key && env.MEDIA) await env.MEDIA.delete(doc.storage_key);
    await db.prepare('DELETE FROM documents WHERE id = ?').bind(m[1]).run();
    return json({ ok: true });
  }

  return fail(404, 'Unbekannter Endpunkt.');
}

function initialsOf(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

/* ----------------------------------------------------------------- export */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        if (!env.DB) return fail(500, 'Datenbank nicht verbunden.');
        return await handleApi(request, env, url);
      } catch (err) {
        if (err instanceof HttpError) return fail(err.status, err.message);
        console.error('API-Fehler', err && err.stack);
        return fail(500, 'Serverfehler: ' + (err?.message || 'unbekannt'));
      }
    }

    if (url.pathname === '/healthz') return json({ ok: true, ts: nowIso() });

    /* --- Bildmarke. Ohne Anmeldung, sonst bleibt jede Icon-Anzeige leer. --- */
    if (url.pathname === '/favicon.ico') return iconResponse(ICON_ICO, 'image/x-icon');
    if (url.pathname === '/icon.png') return iconResponse(ICON_PNG_512, 'image/png');
    if (url.pathname === '/apple-touch-icon.png' || url.pathname === '/apple-touch-icon-precomposed.png') {
      return iconResponse(ICON_PNG_180, 'image/png');
    }
    if (url.pathname === '/favicon.svg' || url.pathname === '/icon.svg') {
      return new Response(LOGO_SVG, {
        headers: {
          'content-type': 'image/svg+xml; charset=utf-8',
          'cache-control': 'public, max-age=86400',
          'access-control-allow-origin': '*',
        },
      });
    }

    /* --- MCP-Server (läuft in diesem Worker) --- */
    const origin = url.origin;

    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      if (!env.DB) return new Response('Datenbank nicht verbunden', { status: 500 });
      try {
        return await handleMcp(request, env, url, origin);
      } catch (err) {
        console.error('MCP-Fehler', err && err.stack);
        return rpcError(null, -32603, 'Serverfehler.');
      }
    }

    if (url.pathname === '/tools.json' || url.pathname === '/mcp/tools.json') return toolsCatalog();

    if (url.pathname === '/.well-known/oauth-authorization-server'
      || url.pathname === '/.well-known/openid-configuration') {
      return mcpJson(oauthMetadata(origin), { headers: { 'cache-control': 'public, max-age=300' } });
    }

    if (url.pathname === '/.well-known/oauth-protected-resource'
      || url.pathname === '/.well-known/oauth-protected-resource/mcp') {
      return mcpJson({
        resource: origin + '/mcp',
        authorization_servers: [origin],
        scopes_supported: ['mikdaten'],
        bearer_methods_supported: ['header'],
      }, { headers: { 'cache-control': 'public, max-age=300' } });
    }

    if (url.pathname.startsWith('/oauth/')) {
      if (!env.DB) return new Response('Datenbank nicht verbunden', { status: 500 });
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      try {
        const res = await handleOAuth(request, env, url, origin);
        if (res) return res;
      } catch (err) {
        console.error('OAuth-Fehler', err && err.stack);
        return mcpJson({ error: 'server_error' }, { status: 500 });
      }
      return new Response('Nicht gefunden', { status: 404 });
    }

    // Bilder aus R2 — nur für angemeldete Personen
    if (url.pathname.startsWith('/media/')) {
      if (!env.MEDIA || !env.DB) return new Response('Bildspeicher nicht verbunden', { status: 500 });
      const me = await authenticate(request, env.DB).catch(() => null);
      if (!me) return new Response('Nicht angemeldet', { status: 401 });

      const key = decodeURIComponent(url.pathname.slice('/media/'.length));
      if (!key || key.includes('..')) return new Response('Ungültiger Pfad', { status: 400 });

      const object = await env.MEDIA.get(key);
      if (!object) return new Response('Nicht gefunden', { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('cache-control', 'private, max-age=31536000, immutable');
      headers.set('x-content-type-options', 'nosniff');
      const type = headers.get('content-type') || '';
      const download = url.searchParams.get('dl') === '1' || !INLINE_TYPES.includes(type.split(';')[0].trim());
      const name = (url.searchParams.get('name') || key.split('/').pop()).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
      headers.set('content-disposition', `${download ? 'attachment' : 'inline'}; filename="${name}"`);
      if (request.headers.get('if-none-match') === object.httpEtag) {
        return new Response(null, { status: 304, headers });
      }
      return new Response(object.body, { headers });
    }

    return new Response(APP_HTML, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'same-origin',
      },
    });
  },
};
