/**
 * Integrationstest ohne Cloudflare: node:sqlite als D1-Ersatz.
 *   node --experimental-sqlite scripts/local-test.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(':memory:');

/* Kommentarzeilen zuerst entfernen — sonst verschluckt der Split die
   erste Anweisung, wenn ihr ein Kommentar vorausgeht. */
const statements = (sql) => sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean);

const runScript = (file) => {
  for (const s of statements(readFileSync(resolve(root, file), 'utf8'))) db.exec(s + ';');
};
runScript('schema.sql');
runScript('seed.sql');

/* D1-kompatible Hülle */
const D1 = {
  prepare(sql) {
    const stmt = { sql, args: [] };
    const compile = () => db.prepare(sql);
    return {
      bind(...args) { stmt.args = args.map((a) => (a === undefined ? null : (typeof a === 'boolean' ? Number(a) : a))); return this; },
      async run() { return { success: true, meta: compile().run(...stmt.args) }; },
      async first() { const r = compile().get(...stmt.args); return r ?? null; },
      async all() { return { results: compile().all(...stmt.args) }; },
    };
  },
};

/* R2-kompatible Hülle (im Arbeitsspeicher) */
const store = new Map();
const MEDIA = {
  async put(key, value, opts = {}) {
    const buf = Buffer.from(value instanceof ArrayBuffer ? new Uint8Array(value) : value);
    store.set(key, { body: buf, meta: opts.httpMetadata || {}, custom: opts.customMetadata || {} });
    return { key };
  },
  async get(key) {
    const rec = store.get(key);
    if (!rec) return null;
    return {
      body: rec.body,
      httpEtag: '"' + key.length + '-' + rec.body.length + '"',
      size: rec.body.length,
      writeHttpMetadata(headers) {
        if (rec.meta.contentType) headers.set('content-type', rec.meta.contentType);
      },
      async arrayBuffer() { return rec.body; },
    };
  },
  async delete(key) { store.delete(key); },
  _size: () => store.size,
};

const { default: worker } = await import(resolve(root, 'dist/worker.js'));
const env = { DB: D1, MEDIA };

let cookie = '';
async function call(path, method = 'GET', body) {
  const res = await worker.fetch(new Request('https://x.dev' + path, {
    method,
    headers: {
      'x-mikdaten': '1',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }), env);
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* HTML */ }
  return { status: res.status, json, text };
}

let failures = 0;
const check = (name, cond, extra) => {
  if (cond) console.log(`  ✓ ${name}`);
  else { failures++; console.log(`  ✗ ${name}`, extra ?? ''); }
};

console.log('\nMikdaten · Integrationstest\n');

// Seite ausliefern
let r = await call('/');
check('HTML-Shell wird ausgeliefert', r.status === 200 && r.text.includes('<title>Mikdaten'));
check('CSS eingebettet', r.text.includes('--brand-1'));
check('JS eingebettet', r.text.includes('Mikdaten — Frontend'));

// Ohne Login gesperrt
r = await call('/api/state');
check('State ohne Login → 401', r.status === 401, r.status);

// Falsches Passwort
r = await call('/api/auth/login', 'POST', { login: 'christian.jonas', password: 'falsch' });
check('Falsches Passwort → 401', r.status === 401, r.status);

// Login per Benutzername
r = await call('/api/auth/login', 'POST', { login: 'Christian.Jonas', password: 'Mikdaten#Immo2026' });
check('Login (Benutzername, Groß/Klein egal)', r.status === 200 && r.json.user.name === 'Christian Jonas', r.json);

// Login per E-Mail
cookie = '';
r = await call('/api/auth/login', 'POST', { login: 'mikdat.emir@mikdaten.de', password: 'Mikdaten#Immo2026' });
check('Login per E-Mail', r.status === 200 && r.json.user.initials === 'ME', r.json);

// State
r = await call('/api/state');
const st = r.json;
check('State geladen', r.status === 200);
check('3 Benutzer', st.users.length === 3, st.users.length);
check('5 Projekte', st.projects.length === 5, st.projects.length);
check('6 Objekte', st.properties.length === 6, st.properties.length);
check('10 Kontakte', st.contacts.length === 10, st.contacts.length);
check('25 Spalten', st.columns.length === 25, st.columns.length);
check('37 Aufgaben', st.tasks.length === 37, st.tasks.length);
check('Labels als Array geparst', Array.isArray(st.tasks[0].labels), st.tasks[0].labels);
check('Passwort-Hash nicht im State', !JSON.stringify(st.users).includes('pbkdf2'));
check('Termine vorhanden', st.events.length === 9, st.events.length);
check('Dokumente vorhanden', st.documents.length === 5, st.documents.length);

// CSRF-Schutz
const noHeader = await worker.fetch(new Request('https://x.dev/api/tasks', {
  method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{}',
}), env);
check('Mutation ohne CSRF-Header → 403', noHeader.status === 403, noHeader.status);

// Aufgabe anlegen
const col = st.columns.find((c) => c.project_id === 'prj_hege' && c.position === 1);
r = await call('/api/tasks', 'POST', {
  title: 'Testaufgabe', project_id: 'prj_hege', column_id: col.id,
  priority: 'hoch', assignee_id: 'usr_mikdat', labels: ['Ankauf', 'Recht'], due_date: '2026-12-01',
});
const newTaskId = r.json.id;
check('Aufgabe angelegt', r.status === 200 && !!newTaskId, r.json);

r = await call('/api/state');
const created = r.json.tasks.find((t) => t.id === newTaskId);
check('Aufgabe im State mit Labels', created && created.labels.length === 2, created?.labels);

// Verschieben in "Erledigt"
const doneCol = st.columns.find((c) => c.project_id === 'prj_hege' && c.is_done);
r = await call('/api/tasks/move', 'POST', { id: newTaskId, column_id: doneCol.id, order: [newTaskId] });
check('Verschieben erfolgreich', r.status === 200, r.json);
r = await call('/api/state');
const moved = r.json.tasks.find((t) => t.id === newTaskId);
check('done_at wird gesetzt', !!moved.done_at, moved.done_at);
check('Aktivität protokolliert', r.json.activity.some((a) => a.entity_id === newTaskId), false);

// Zurückschieben leert done_at
r = await call('/api/tasks/move', 'POST', { id: newTaskId, column_id: col.id, order: [newTaskId] });
r = await call('/api/state');
check('done_at wird zurückgesetzt', !r.json.tasks.find((t) => t.id === newTaskId).done_at);

// Bearbeiten
r = await call('/api/tasks/' + newTaskId, 'PATCH', { title: 'Testaufgabe (geändert)', amount: 1234, labels: ['Notar'] });
r = await call('/api/state');
const patched = r.json.tasks.find((t) => t.id === newTaskId);
check('Aufgabe bearbeitet', patched.title === 'Testaufgabe (geändert)' && patched.amount === 1234 && patched.labels[0] === 'Notar', patched);

// Kommentar + Checkliste
r = await call('/api/comments', 'POST', { task_id: newTaskId, body: 'Ein Kommentar' });
check('Kommentar angelegt', r.status === 200);
r = await call('/api/checklist', 'POST', { task_id: newTaskId, text: 'Punkt 1' });
const chkId = r.json.id;
check('Checklistenpunkt angelegt', r.status === 200 && !!chkId);
r = await call('/api/checklist/' + chkId, 'PATCH', { done: 1 });
r = await call('/api/state');
check('Checklistenpunkt abgehakt', r.json.checklist.find((c) => c.id === chkId).done === 1);

// Projekt anlegen inkl. Standardspalten
r = await call('/api/projects', 'POST', { name: 'Testprojekt', type: 'verkauf', lead_id: 'usr_joachim', member_ids: ['usr_christian'] });
const pid = r.json.id;
r = await call('/api/state');
check('Projekt mit 5 Standardspalten', r.json.columns.filter((c) => c.project_id === pid).length === 5);
check('Projektmitglieder gesetzt', r.json.members.filter((m) => m.project_id === pid).length === 3,
  r.json.members.filter((m) => m.project_id === pid).length);

// Spalten
r = await call('/api/columns', 'POST', { project_id: pid, title: 'Bei Notar' });
const colId = r.json.id;
check('Spalte angelegt', r.status === 200);
r = await call('/api/columns/' + colId, 'PATCH', { wip_limit: 3, title: 'Beim Notar' });
r = await call('/api/state');
check('Spalte bearbeitet', r.json.columns.find((c) => c.id === colId).title === 'Beim Notar');
r = await call('/api/columns/' + colId, 'DELETE');
check('Leere Spalte löschbar', r.status === 200);
const busy = st.columns.find((c) => c.project_id === 'prj_hege' && c.position === 2);
r = await call('/api/columns/' + busy.id, 'DELETE');
check('Volle Spalte nicht löschbar', r.status === 400, r.status);

// Objekt
r = await call('/api/properties', 'POST', { title: 'Testobjekt', type: 'wohnung', deal: 'ankauf', purchase_price: 250000 });
const oid = r.json.id;
check('Objekt angelegt mit automatischer Nummer', r.status === 200);
r = await call('/api/state');
check('Objektnummer vergeben', /^OBJ-\d{3}$/.test(r.json.properties.find((p) => p.id === oid).code));
r = await call('/api/properties/' + oid, 'PATCH', { asking_price: 299000, city: 'Hamburg' });
r = await call('/api/state');
check('Objekt bearbeitet', r.json.properties.find((p) => p.id === oid).asking_price === 299000);

/* --- Fotos (R2) --- */
// 1x1-PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function upload(propertyId, type, bytes, filename) {
  const res = await worker.fetch(new Request(`https://x.dev/api/photos/upload?property_id=${propertyId}`, {
    method: 'POST',
    headers: { 'x-mikdaten': '1', 'content-type': type, 'x-filename': encodeURIComponent(filename), cookie },
    body: bytes,
  }), env);
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

let up = await upload(oid, 'image/png', PNG, 'Ansicht Straße.png');
const photoId = up.json.id;
check('Foto hochgeladen', up.status === 200 && !!photoId, up.json);
check('Bild liegt in R2', MEDIA._size() === 1, MEDIA._size());

r = await call('/api/state');
let ph = r.json.photos.find((x) => x.id === photoId);
check('Foto im State', !!ph && ph.property_id === oid, ph);
check('Erstes Foto wird Titelbild', ph.is_cover === 1);
check('Dateiname erhalten (Umlaute)', ph.filename === 'Ansicht Straße.png', ph.filename);
check('Objekt bekommt Titelbild-URL', r.json.properties.find((p) => p.id === oid).image_url === '/media/' + ph.key);

// Auslieferung
const img = await worker.fetch(new Request('https://x.dev/media/' + ph.key, { headers: { cookie } }), env);
check('Bild wird ausgeliefert', img.status === 200 && img.headers.get('content-type') === 'image/png', img.status);
check('Bild ist privat gecacht', (img.headers.get('cache-control') || '').includes('private'));
const anon = await worker.fetch(new Request('https://x.dev/media/' + ph.key), env);
check('Bild ohne Anmeldung gesperrt', anon.status === 401, anon.status);
const etagged = await worker.fetch(new Request('https://x.dev/media/' + ph.key, {
  headers: { cookie, 'if-none-match': img.headers.get('etag') },
}), env);
check('ETag liefert 304', etagged.status === 304, etagged.status);
const traversal = await worker.fetch(new Request('https://x.dev/media/%2E%2E%2F%2E%2E%2Fgeheim', { headers: { cookie } }), env);
check('Kodiertes Pfad-Traversal blockiert', traversal.status === 400, traversal.status);
const missing = await worker.fetch(new Request('https://x.dev/media/objekte/gibtsnicht.png', { headers: { cookie } }), env);
check('Unbekanntes Bild → 404', missing.status === 404, missing.status);

// Validierung
up = await upload(oid, 'application/pdf', PNG, 'x.pdf');
check('Nicht-Bild abgelehnt', up.status === 415, up.status);
up = await upload(oid, 'image/png', Buffer.alloc(13 * 1024 * 1024), 'gross.png');
check('Zu großes Bild abgelehnt', up.status === 413, up.status);
up = await upload('obj_gibtsnicht', 'image/png', PNG, 'x.png');
check('Upload auf unbekanntes Objekt abgelehnt', up.status === 400, up.status);

// Zweites Foto + Titelbildwechsel
const up2 = await upload(oid, 'image/webp', PNG, 'Balkon.webp');
const photo2 = up2.json.id;
r = await call('/api/state');
check('Zweites Foto ist nicht Titelbild', r.json.photos.find((x) => x.id === photo2).is_cover === 0);
r = await call('/api/photos/' + photo2, 'PATCH', { is_cover: 1 });
r = await call('/api/state');
check('Titelbild gewechselt', r.json.photos.find((x) => x.id === photo2).is_cover === 1
  && r.json.photos.find((x) => x.id === photoId).is_cover === 0);
check('Objekt-URL folgt dem Titelbild',
  r.json.properties.find((p) => p.id === oid).image_url === '/media/' + r.json.photos.find((x) => x.id === photo2).key);

// Titelbild löschen → nächstes rückt nach
r = await call('/api/photos/' + photo2, 'DELETE');
r = await call('/api/state');
check('Foto gelöscht', !r.json.photos.find((x) => x.id === photo2));
check('Aus R2 entfernt', MEDIA._size() === 1, MEDIA._size());
check('Verbleibendes Foto wird Titelbild', r.json.photos.find((x) => x.id === photoId).is_cover === 1);

// Objekt löschen räumt R2 auf
await upload(oid, 'image/jpeg', PNG, 'Kueche.jpg');
check('Zwei Bilder in R2', MEDIA._size() === 2, MEDIA._size());
r = await call('/api/properties/' + oid, 'DELETE');
r = await call('/api/state');
check('Objekt gelöscht', !r.json.properties.find((p) => p.id === oid));
check('R2 nach Objektlöschung leer', MEDIA._size() === 0, MEDIA._size());
check('Foto-Datensätze kaskadiert gelöscht', r.json.photos.filter((x) => x.property_id === oid).length === 0);

// Objekt für den Rest der Tests neu anlegen
r = await call('/api/properties', 'POST', { title: 'Testobjekt 2', type: 'wohnung', deal: 'ankauf' });
const oid2 = r.json.id;

// Kontakt / Termin / Dokument
r = await call('/api/contacts', 'POST', { name: 'Testkontakt', role: 'makler', email: 'a@b.de' });
check('Kontakt angelegt', r.status === 200);
r = await call('/api/events', 'POST', { title: 'Testtermin', date: '2026-12-24', type: 'notar' });
const eid = r.json.id;
check('Termin angelegt', r.status === 200);
r = await call('/api/events/' + eid, 'PATCH', { time: '10:00' });
r = await call('/api/state');
check('Termin bearbeitet', r.json.events.find((e) => e.id === eid).time === '10:00');
r = await call('/api/documents', 'POST', { title: 'Testdoc', url: 'https://example.com/x.pdf', property_id: oid2 });
check('Dokument verknüpft', r.status === 200);

// Projekt löschen entfernt Aufgaben (Kaskade)
r = await call('/api/projects/' + pid, 'DELETE');
r = await call('/api/state');
check('Projekt gelöscht', !r.json.projects.find((p) => p.id === pid));
check('Spalten kaskadiert gelöscht', r.json.columns.filter((c) => c.project_id === pid).length === 0);

// Profil & Passwort
r = await call('/api/account', 'PATCH', { name: 'Mikdat Emir', job_title: 'Bestandsleitung' });
check('Profil aktualisiert', r.status === 200 && r.json.user.job_title === 'Bestandsleitung', r.json);
r = await call('/api/account/password', 'POST', { current: 'falsch', next: 'NeuesPasswort123' });
check('Passwortwechsel mit falschem Alt-Passwort → 400', r.status === 400);
r = await call('/api/account/password', 'POST', { current: 'Mikdaten#Immo2026', next: 'kurz' });
check('Zu kurzes Passwort → 400', r.status === 400);
r = await call('/api/account/password', 'POST', { current: 'Mikdaten#Immo2026', next: 'NeuesPasswort123' });
check('Passwort geändert', r.status === 200);
r = await call('/api/state');
check('Alte Sitzung nach Passwortwechsel ungültig', r.status === 401, r.status);
cookie = '';
r = await call('/api/auth/login', 'POST', { login: 'mikdat.emir', password: 'NeuesPasswort123' });
check('Login mit neuem Passwort', r.status === 200);

// Abmelden
r = await call('/api/auth/logout', 'POST');
cookie = '';
r = await call('/api/state');
check('Nach Abmeldung gesperrt', r.status === 401);

/* --- Verschieben per Position (statt Neunummerierung der ganzen Spalte) --- */
cookie = '';
await call('/api/auth/login', 'POST', { login: 'christian.jonas', password: 'Mikdaten#Immo2026' });
r = await call('/api/state');
const hegeCols = r.json.columns.filter((c) => c.project_id === 'prj_hege').sort((a, b) => a.position - b.position);
const src = hegeCols[1], dst = hegeCols[2];
const before = r.json.tasks.filter((t) => t.column_id === dst.id).sort((a, b) => a.position - b.position);
const mover = r.json.tasks.find((t) => t.column_id === src.id);
const otherPositions = r.json.tasks
  .filter((t) => t.column_id === dst.id)
  .map((t) => [t.id, t.position]);

const between = before.length >= 2 ? (before[0].position + before[1].position) / 2 : 512;
r = await call('/api/tasks/move', 'POST', { id: mover.id, column_id: dst.id, position: between });
check('Zug mit Position akzeptiert', r.status === 200, r.json);
r = await call('/api/state');
const movedTask = r.json.tasks.find((t) => t.id === mover.id);
check('Position exakt übernommen', movedTask.position === between, movedTask.position);
check('Spalte gewechselt', movedTask.column_id === dst.id);
const unchanged = otherPositions.every(([id, pos]) => {
  const t = r.json.tasks.find((x) => x.id === id);
  return t && t.position === pos;
});
check('Übrige Karten behalten ihre Position', unchanged);

// Reihenfolge-Variante nummeriert weiterhin neu
const order = r.json.tasks.filter((t) => t.column_id === dst.id).sort((a, b) => a.position - b.position).map((t) => t.id);
r = await call('/api/tasks/move', 'POST', { id: order[0], column_id: dst.id, order });
r = await call('/api/state');
const renumbered = r.json.tasks.filter((t) => t.column_id === dst.id).sort((a, b) => a.position - b.position);
check('Neunummerierung auf Vielfache von 1024', renumbered.every((t, i) => t.position === (i + 1) * 1024),
  renumbered.map((t) => t.position));

// Spaltenreihenfolge
const newOrder = [hegeCols[1].id, hegeCols[0].id, ...hegeCols.slice(2).map((c) => c.id)];
r = await call('/api/columns/reorder', 'POST', { order: newOrder });
r = await call('/api/state');
const after = r.json.columns.filter((c) => c.project_id === 'prj_hege').sort((a, b) => a.position - b.position);
check('Spalten umsortiert', after[0].id === hegeCols[1].id && after[1].id === hegeCols[0].id,
  after.slice(0, 2).map((c) => c.title));

// Einzelfeld-Aktualisierung (Autospeicherung im Detail)
r = await call('/api/tasks/' + mover.id, 'PATCH', { assignee_id: 'usr_joachim' });
r = await call('/api/state');
check('Einzelfeld gespeichert', r.json.tasks.find((t) => t.id === mover.id).assignee_id === 'usr_joachim');
r = await call('/api/tasks/' + mover.id, 'PATCH', { due_date: null });
r = await call('/api/state');
check('Feld auf leer setzbar', r.json.tasks.find((t) => t.id === mover.id).due_date === null);

// Projekte tragen kein Symbolfeld mehr
r = await call('/api/state');
check('Kein Emoji-Feld an Projekten', r.json.projects.every((p) => !('emoji' in p)), Object.keys(r.json.projects[0] || {}));

/* --- Profilbild, E-Mail, Dateiupload --- */
cookie = '';
await call('/api/auth/login', 'POST', { login: 'christian.jonas', password: 'Mikdaten#Immo2026' });

r = await call('/api/account', 'PATCH', { avatar: 'pixel:fuchs' });
check('Profilbild gesetzt', r.status === 200 && r.json.user.avatar === 'pixel:fuchs', r.json);
r = await call('/api/account', 'PATCH', { avatar: 'pixel:<script>' });
check('Ungültiges Profilbild abgewiesen', r.status === 400, r.status);
r = await call('/api/account', 'PATCH', { avatar: null });
check('Profilbild zurücksetzbar', r.status === 200 && !r.json.user.avatar);

r = await call('/api/account', 'PATCH', { email: 'c.jonas@mikdaten.de' });
check('E-Mail geändert', r.status === 200 && r.json.user.email === 'c.jonas@mikdaten.de', r.json);
r = await call('/api/account', 'PATCH', { email: 'kein-email' });
check('Ungültige E-Mail abgewiesen', r.status === 400, r.status);
r = await call('/api/account', 'PATCH', { email: 'joachim.kluge@mikdaten.de' });
check('Doppelte E-Mail abgewiesen', r.status === 409, r.status);
r = await call('/api/auth/login', 'POST', { login: 'c.jonas@mikdaten.de', password: 'Mikdaten#Immo2026' });
check('Login mit neuer E-Mail', r.status === 200, r.status);
await call('/api/account', 'PATCH', { email: 'christian.jonas@mikdaten.de' });

async function uploadDoc(query, type, bytes, filename) {
  const res = await worker.fetch(new Request(`https://x.dev/api/documents/upload?${query}`, {
    method: 'POST',
    headers: { 'x-mikdaten': '1', 'content-type': type, 'x-filename': encodeURIComponent(filename), cookie },
    body: bytes,
  }), env);
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
const PDF = Buffer.from('%PDF-1.4 Testinhalt');
const beforeR2 = MEDIA._size();
let docUp = await uploadDoc('property_id=obj_hege', 'application/pdf', PDF, 'Grundbuch Hegestraße.pdf');
const docId = docUp.json.id;
check("PDF hochgeladen", docUp.status === 200 && !!docId, docUp.json);
check('Datei in R2', MEDIA._size() === beforeR2 + 1);
r = await call('/api/state');
const doc = r.json.documents.find((d) => d.id === docId);
check('Dokument verweist auf die Datei', !!doc.storage_key && doc.url === null, doc);
check('Titel ohne Dateiendung', doc.title === 'Grundbuch Hegestraße', doc.title);
check('Größe erfasst', doc.size === PDF.length, doc.size);

const dl = await worker.fetch(new Request('https://x.dev/media/' + doc.storage_key, { headers: { cookie } }), env);
check('PDF wird ausgeliefert', dl.status === 200 && dl.headers.get('content-type') === 'application/pdf');
check('PDF wird im Browser angezeigt', (dl.headers.get('content-disposition') || '').startsWith('inline'), dl.headers.get('content-disposition'));
const dlForce = await worker.fetch(new Request('https://x.dev/media/' + doc.storage_key + '?dl=1&name=x.pdf', { headers: { cookie } }), env);
check('Erzwungener Download', (dlForce.headers.get('content-disposition') || '').startsWith('attachment'), dlForce.headers.get('content-disposition'));

docUp = await uploadDoc('property_id=obj_hege', 'application/x-msdownload', PDF, 'schad.exe');
check('Unerlaubter Dateityp abgewiesen', docUp.status === 415, docUp.status);
docUp = await uploadDoc('property_id=obj_hege', 'application/pdf', Buffer.alloc(26 * 1024 * 1024), 'gross.pdf');
check('Datei über 25 MB abgewiesen', docUp.status === 413, docUp.status);
docUp = await uploadDoc('', 'application/pdf', PDF, 'ohne.pdf');
check('Upload ohne Bezug abgewiesen', docUp.status === 400, docUp.status);

const zipUp = await uploadDoc('task_id=tsk_001', 'application/zip', PDF, 'anlagen.zip');
r = await call('/api/state');
check('Datei an Aufgabe', r.json.documents.some((d) => d.id === zipUp.json.id && d.task_id === 'tsk_001'));
const zipDl = await worker.fetch(new Request('https://x.dev/media/' + r.json.documents.find((d) => d.id === zipUp.json.id).storage_key, { headers: { cookie } }), env);
check('Archiv wird zum Download angeboten', (zipDl.headers.get('content-disposition') || '').startsWith('attachment'));

const r2Before = MEDIA._size();
r = await call('/api/documents/' + docId, 'DELETE');
check('Dokument gelöscht', r.status === 200);
check('Datei aus R2 entfernt', MEDIA._size() === r2Before - 1, MEDIA._size());
r = await call('/api/state');
check('Verknüpfte Links funktionieren weiter', r.json.documents.some((d) => d.url && !d.storage_key));

// Health
r = await call('/healthz');
check('Healthcheck', r.status === 200 && r.json.ok === true);

console.log(`\n${failures === 0 ? '✅ Alle Prüfungen bestanden.' : `❌ ${failures} Prüfung(en) fehlgeschlagen.`}\n`);
process.exit(failures === 0 ? 0 : 1);
