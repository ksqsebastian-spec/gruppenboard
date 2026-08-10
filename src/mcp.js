/* ==========================================================================
   MCP-Server für Mikdaten.

   Streamable HTTP unter /mcp, Anmeldung über OAuth 2.1 mit PKCE gegen
   dieselben Zugangsdaten wie die Oberfläche. Der Tool-Katalog liegt
   zusätzlich unter /tools.json, damit ihn der Hub ohne Anmeldung lesen kann.
   ========================================================================== */

const MCP_NAME = 'mikdaten';
const MCP_VERSION = '1.0.0';
const MCP_PROTOCOL = '2025-06-18';
const CODE_TTL_MS = 10 * 60 * 1000;

/* ------------------------------------------------------------------ Hilfen */

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64url(buf) {
  return b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(bytes = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, authorization, mcp-protocol-version, mcp-session-id',
  'access-control-expose-headers': 'mcp-session-id, www-authenticate',
  'access-control-max-age': '86400',
};

const mcpJson = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors, ...(init.headers || {}) },
});

const rpcResult = (id, result) => mcpJson({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message, status = 200) =>
  mcpJson({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { status });

/* ============================================================ Tool-Katalog */

const S_STR = { type: 'string' };
const S_NUM = { type: 'number' };
const S_INT = { type: 'integer' };
const S_BOOL = { type: 'boolean' };

const schema = (props, required = []) => ({ type: 'object', properties: props, required });

const MCP_TOOLS = [
  /* ---------------------------------------------------------- lesend --- */
  {
    name: 'uebersicht',
    title: 'Übersicht',
    description: 'Kennzahlen über den gesamten Bestand: aktive Projekte, offene und überfällige Aufgaben, Fälligkeiten der nächsten sieben Tage, Anzahl Objekte, Portfoliowert und monatliche Kaltmiete. Guter erster Aufruf, wenn die Frage allgemein ist.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({}),
  },
  {
    name: 'projekte_auflisten',
    title: 'Projekte auflisten',
    description: 'Alle Projekte mit Art, Status, Projektleitung, verknüpftem Objekt, Terminen, Volumen und Fortschritt (erledigte von gesamten Aufgaben). Standardmäßig ohne archivierte.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({
      status: { type: 'string', enum: ['aktiv', 'pausiert', 'abgeschlossen'], description: 'Nur Projekte in diesem Status.' },
      art: { type: 'string', enum: ['ankauf', 'verkauf', 'vermietung', 'sanierung', 'verwaltung', 'sonstiges'] },
      archivierte_einschliessen: { ...S_BOOL, description: 'Standard: false.' },
    }),
  },
  {
    name: 'projekt_details',
    title: 'Projekt im Detail',
    description: 'Ein Projekt mit seinen Spalten, der Aufgabenzahl je Spalte, dem Team und den verknüpften Terminen und Dokumenten. Liefert die Spalten-IDs, die zum Verschieben und Anlegen von Aufgaben gebraucht werden.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({ projekt_id: S_STR }, ['projekt_id']),
  },
  {
    name: 'aufgaben_suchen',
    title: 'Aufgaben suchen',
    description: 'Aufgaben über alle Projekte hinweg filtern: Volltext, Projekt, Zuständigkeit, Priorität, Label, Objekt, Spalte, Fälligkeit und Erledigungsstand. Ohne Filter kommen die offenen Aufgaben nach Fälligkeit sortiert.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({
      text: { ...S_STR, description: 'Sucht in Titel und Beschreibung.' },
      projekt_id: S_STR,
      zustaendig: { ...S_STR, description: 'Benutzer-ID, Benutzername oder Name.' },
      prioritaet: { type: 'string', enum: ['hoch', 'mittel', 'normal', 'niedrig'] },
      label: S_STR,
      objekt_id: S_STR,
      spalte_id: S_STR,
      status: { type: 'string', enum: ['offen', 'erledigt', 'alle'], description: 'Standard: offen.' },
      nur_ueberfaellig: S_BOOL,
      faellig_bis: { ...S_STR, description: 'ISO-Datum, z. B. 2026-09-30.' },
      limit: { ...S_INT, description: 'Standard 50, höchstens 200.' },
    }),
  },
  {
    name: 'aufgabe_details',
    title: 'Aufgabe im Detail',
    description: 'Eine Aufgabe mit Beschreibung, Checkliste, Kommentaren, verknüpften Dateien, Objekt- und Kontaktbezug.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({ aufgabe_id: S_STR }, ['aufgabe_id']),
  },
  {
    name: 'objekte_auflisten',
    title: 'Objekte auflisten',
    description: 'Objekte im Portfolio mit Adresse, Art, Status, Fläche, Zimmern, Einheiten, Preisen, Kaltmiete und berechneter Bruttorendite.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({
      status: { type: 'string', enum: ['ankauf', 'bestand', 'vermarktung', 'verkauft', 'vermietet'] },
      art: { type: 'string', enum: ['wohnung', 'haus', 'mehrfamilienhaus', 'gewerbe', 'grundstueck', 'garage'] },
      ort: { ...S_STR, description: 'Teilstring, wird gegen Ort und Straße geprüft.' },
      text: S_STR,
    }),
  },
  {
    name: 'objekt_details',
    title: 'Objekt im Detail',
    description: 'Ein Objekt mit allen Stammdaten, Kennzahlen, verknüpften Aufgaben, Projekten, Kontakten, Terminen, Dokumenten und Fotos.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({ objekt_id: { ...S_STR, description: 'ID oder Objektnummer wie OBJ-003.' } }, ['objekt_id']),
  },
  {
    name: 'kontakte_auflisten',
    title: 'Kontakte auflisten',
    description: 'Kontakte nach Rolle, Objekt oder Suchtext: Eigentümer, Käufer, Mieter, Interessenten, Makler, Handwerker, Notare, Banken, Hausverwaltungen, Behörden.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({
      rolle: { type: 'string', enum: ['eigentuemer', 'kaeufer', 'mieter', 'interessent', 'makler', 'handwerker', 'notar', 'bank', 'verwalter', 'behoerde', 'sonstige'] },
      objekt_id: S_STR,
      text: S_STR,
    }),
  },
  {
    name: 'termine_auflisten',
    title: 'Termine auflisten',
    description: 'Termine und Fristen in einem Zeitraum, wahlweise für ein Projekt oder ein Objekt. Enthält auf Wunsch auch die fälligen Aufgaben als Termine.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({
      von: { ...S_STR, description: 'ISO-Datum. Standard: heute.' },
      bis: { ...S_STR, description: 'ISO-Datum. Standard: in 30 Tagen.' },
      projekt_id: S_STR,
      objekt_id: S_STR,
      mit_aufgaben: { ...S_BOOL, description: 'Fällige Aufgaben mit aufnehmen. Standard: true.' },
    }),
  },
  {
    name: 'dokumente_auflisten',
    title: 'Dokumente auflisten',
    description: 'Hinterlegte Dateien und Links, gefiltert nach Objekt, Projekt oder Aufgabe. Dateien liegen im geschützten Speicher; der Pfad gilt nur für angemeldete Personen.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({ objekt_id: S_STR, projekt_id: S_STR, aufgabe_id: S_STR }),
  },
  {
    name: 'team_auslastung',
    title: 'Auslastung im Team',
    description: 'Je Person die offenen, überfälligen und erledigten Aufgaben sowie die Projekte unter ihrer Leitung.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({}),
  },
  {
    name: 'aktivitaet',
    title: 'Letzte Aktivität',
    description: 'Chronik der letzten Änderungen: angelegte Projekte und Aufgaben, Zugwechsel auf dem Board, hochgeladene Dateien.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({ limit: { ...S_INT, description: 'Standard 30, höchstens 120.' } }),
  },
  {
    name: 'suche',
    title: 'Alles durchsuchen',
    description: 'Volltextsuche über Aufgaben, Projekte, Objekte und Kontakte in einem Aufruf. Gut, wenn unklar ist, wo etwas liegt.',
    annotations: { readOnlyHint: true },
    inputSchema: schema({ text: S_STR, limit: S_INT }, ['text']),
  },

  /* -------------------------------------------------------- schreibend --- */
  {
    name: 'projekt_anlegen',
    title: 'Projekt anlegen',
    description: 'Legt ein Projekt an und erzeugt die Standardspalten Backlog, Zu erledigen, In Arbeit, Prüfung und Erledigt. Alle Teammitglieder werden zugeordnet.',
    inputSchema: schema({
      name: S_STR,
      beschreibung: S_STR,
      art: { type: 'string', enum: ['ankauf', 'verkauf', 'vermietung', 'sanierung', 'verwaltung', 'sonstiges'] },
      objekt_id: S_STR,
      leitung: { ...S_STR, description: 'Benutzer-ID, Benutzername oder Name.' },
      start: S_STR,
      zieltermin: S_STR,
      volumen: S_NUM,
      budget: S_NUM,
    }, ['name']),
  },
  {
    name: 'aufgabe_anlegen',
    title: 'Aufgabe anlegen',
    description: 'Legt eine Aufgabe in einem Projekt an. Ohne Spaltenangabe landet sie in der zweiten Spalte (üblicherweise „Zu erledigen").',
    inputSchema: schema({
      projekt_id: S_STR,
      titel: S_STR,
      beschreibung: S_STR,
      spalte_id: S_STR,
      zustaendig: S_STR,
      prioritaet: { type: 'string', enum: ['hoch', 'mittel', 'normal', 'niedrig'] },
      faellig: { ...S_STR, description: 'ISO-Datum.' },
      start: S_STR,
      labels: { type: 'array', items: S_STR },
      objekt_id: S_STR,
      kontakt_id: S_STR,
      betrag: S_NUM,
      aufwand_stunden: S_NUM,
    }, ['projekt_id', 'titel']),
  },
  {
    name: 'aufgabe_aktualisieren',
    title: 'Aufgabe ändern',
    description: 'Ändert einzelne Felder einer Aufgabe. Nur mitgegebene Felder werden angefasst; ein leerer Wert löscht das Feld.',
    inputSchema: schema({
      aufgabe_id: S_STR,
      titel: S_STR,
      beschreibung: S_STR,
      zustaendig: S_STR,
      prioritaet: { type: 'string', enum: ['hoch', 'mittel', 'normal', 'niedrig'] },
      faellig: S_STR,
      start: S_STR,
      labels: { type: 'array', items: S_STR },
      objekt_id: S_STR,
      kontakt_id: S_STR,
      betrag: S_NUM,
      aufwand_stunden: S_NUM,
    }, ['aufgabe_id']),
  },
  {
    name: 'aufgabe_verschieben',
    title: 'Aufgabe verschieben',
    description: 'Schiebt eine Aufgabe in eine andere Spalte. Landet sie in der Erledigt-Spalte, wird der Erledigungszeitpunkt gesetzt.',
    inputSchema: schema({
      aufgabe_id: S_STR,
      spalte_id: { ...S_STR, description: 'Ziel-Spalte. Alternativ spalte_name verwenden.' },
      spalte_name: { ...S_STR, description: 'Name der Zielspalte im selben Projekt, z. B. „In Arbeit".' },
    }, ['aufgabe_id']),
  },
  {
    name: 'aufgabe_erledigen',
    title: 'Aufgabe erledigen',
    description: 'Verschiebt eine Aufgabe in die als erledigt markierte Spalte ihres Projekts.',
    inputSchema: schema({ aufgabe_id: S_STR }, ['aufgabe_id']),
  },
  {
    name: 'aufgabe_kommentieren',
    title: 'Kommentar schreiben',
    description: 'Hängt einen Kommentar an eine Aufgabe. Der Kommentar erscheint unter dem angemeldeten Konto.',
    inputSchema: schema({ aufgabe_id: S_STR, text: S_STR }, ['aufgabe_id', 'text']),
  },
  {
    name: 'checkliste_ergaenzen',
    title: 'Checkliste ergänzen',
    description: 'Fügt einer Aufgabe einen oder mehrere Checklistenpunkte hinzu.',
    inputSchema: schema({
      aufgabe_id: S_STR,
      punkte: { type: 'array', items: S_STR },
    }, ['aufgabe_id', 'punkte']),
  },
  {
    name: 'checkliste_abhaken',
    title: 'Checklistenpunkt abhaken',
    description: 'Setzt einen Checklistenpunkt auf erledigt oder wieder zurück.',
    inputSchema: schema({
      punkt_id: S_STR,
      erledigt: { ...S_BOOL, description: 'Standard: true.' },
    }, ['punkt_id']),
  },
  {
    name: 'spalte_anlegen',
    title: 'Spalte anlegen',
    description: 'Fügt einem Projekt eine weitere Board-Spalte hinzu, wahlweise mit WIP-Limit.',
    inputSchema: schema({
      projekt_id: S_STR,
      titel: S_STR,
      wip_limit: S_INT,
      gilt_als_erledigt: S_BOOL,
    }, ['projekt_id', 'titel']),
  },
  {
    name: 'objekt_anlegen',
    title: 'Objekt anlegen',
    description: 'Legt ein Objekt mit Stammdaten an. Die Objektnummer wird fortlaufend vergeben, wenn keine mitgegeben wird.',
    inputSchema: schema({
      bezeichnung: S_STR,
      art: { type: 'string', enum: ['wohnung', 'haus', 'mehrfamilienhaus', 'gewerbe', 'grundstueck', 'garage'] },
      status: { type: 'string', enum: ['ankauf', 'bestand', 'vermarktung', 'verkauft', 'vermietet'] },
      strasse: S_STR, plz: S_STR, ort: S_STR,
      wohnflaeche: S_NUM, zimmer: S_NUM, einheiten: S_INT, grundstueck: S_NUM,
      baujahr: S_INT, energieklasse: S_STR,
      kaufpreis: S_NUM, angebotspreis: S_NUM, kaltmiete: S_NUM, hausgeld: S_NUM,
      notizen: S_STR,
    }, ['bezeichnung']),
  },
  {
    name: 'objekt_aktualisieren',
    title: 'Objekt ändern',
    description: 'Ändert einzelne Stammdaten eines Objekts. Nur mitgegebene Felder werden angefasst.',
    inputSchema: schema({
      objekt_id: S_STR,
      bezeichnung: S_STR,
      status: { type: 'string', enum: ['ankauf', 'bestand', 'vermarktung', 'verkauft', 'vermietet'] },
      strasse: S_STR, plz: S_STR, ort: S_STR,
      wohnflaeche: S_NUM, zimmer: S_NUM, einheiten: S_INT, grundstueck: S_NUM,
      baujahr: S_INT, energieklasse: S_STR,
      kaufpreis: S_NUM, angebotspreis: S_NUM, kaltmiete: S_NUM, hausgeld: S_NUM,
      notizen: S_STR,
    }, ['objekt_id']),
  },
  {
    name: 'kontakt_anlegen',
    title: 'Kontakt anlegen',
    description: 'Legt einen Kontakt an und verknüpft ihn auf Wunsch mit einem Objekt.',
    inputSchema: schema({
      name: S_STR,
      rolle: { type: 'string', enum: ['eigentuemer', 'kaeufer', 'mieter', 'interessent', 'makler', 'handwerker', 'notar', 'bank', 'verwalter', 'behoerde', 'sonstige'] },
      firma: S_STR, email: S_STR, telefon: S_STR,
      objekt_id: S_STR, notizen: S_STR,
    }, ['name']),
  },
  {
    name: 'termin_anlegen',
    title: 'Termin anlegen',
    description: 'Trägt einen Termin oder eine Frist ein: Besichtigung, Notartermin, Übergabe, Abnahme, Eigentümerversammlung oder Frist.',
    inputSchema: schema({
      titel: S_STR,
      datum: { ...S_STR, description: 'ISO-Datum.' },
      art: { type: 'string', enum: ['besichtigung', 'notar', 'uebergabe', 'abnahme', 'etv', 'frist', 'termin'] },
      uhrzeit: { ...S_STR, description: 'HH:MM.' },
      ort: S_STR,
      projekt_id: S_STR, objekt_id: S_STR, kontakt_id: S_STR,
      verantwortlich: S_STR, notizen: S_STR,
    }, ['titel', 'datum']),
  },
  {
    name: 'dokument_verknuepfen',
    title: 'Dokument verlinken',
    description: 'Hinterlegt einen Link auf ein Dokument an Objekt, Projekt oder Aufgabe. Für echte Dateien nutzt die Oberfläche den Upload.',
    inputSchema: schema({
      titel: S_STR,
      url: S_STR,
      art: { type: 'string', enum: ['exposé', 'grundbuch', 'vertrag', 'plan', 'foto', 'rechnung', 'sonstige'] },
      objekt_id: S_STR, projekt_id: S_STR, aufgabe_id: S_STR,
    }, ['titel', 'url']),
  },
];

const MCP_TOOLS_BY_NAME = new Map(MCP_TOOLS.map((t) => [t.name, t]));

const MCP_RESOURCES = [
  { uri: 'mikdaten://uebersicht', name: 'Übersicht', description: 'Kennzahlen über Projekte, Aufgaben und Portfolio.', mimeType: 'application/json' },
  { uri: 'mikdaten://projekte', name: 'Projekte', description: 'Alle Projekte mit Fortschritt.', mimeType: 'application/json' },
  { uri: 'mikdaten://objekte', name: 'Objekte', description: 'Alle Objekte mit Stammdaten und Kennzahlen.', mimeType: 'application/json' },
];

const MCP_PROMPTS = [
  {
    name: 'wochenueberblick',
    title: 'Wochenüberblick',
    description: 'Was steht diese Woche an, was ist überfällig, wo hakt es?',
    arguments: [{ name: 'person', description: 'Optional: nur für diese Person.', required: false }],
  },
  {
    name: 'objekt_dossier',
    title: 'Objektdossier',
    description: 'Alles zu einem Objekt zusammenfassen: Stammdaten, Stand, offene Punkte, Beteiligte, Termine.',
    arguments: [{ name: 'objekt', description: 'Bezeichnung oder Objektnummer.', required: true }],
  },
  {
    name: 'fristen_pruefen',
    title: 'Fristen prüfen',
    description: 'Alle Fristen und Termine der nächsten Wochen durchgehen und Risiken benennen.',
    arguments: [{ name: 'tage', description: 'Zeitraum in Tagen, Standard 30.', required: false }],
  },
];

/* ========================================================== OAuth 2.1 */

function oauthMetadata(origin) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['mikdaten'],
    service_documentation: `${origin}/`,
  };
}

const AUTH_PAGE_CSS = `
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:32px;
  background:#fff;color:#0a0a0a;font:400 15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.card{width:100%;max-width:360px}
.mark{display:flex;gap:10px;align-items:center;margin-bottom:28px}
.mark svg{width:30px;height:25px;display:block}
.mark b{font-size:15px;font-weight:600;letter-spacing:.01em;text-transform:uppercase}
.mark small{display:block;font-size:9.5px;font-weight:500;color:#9b9b9f;letter-spacing:.06em}
h1{font-size:22px;letter-spacing:-.03em;font-weight:640;margin:0 0 6px}
p.sub{color:#6a6a70;margin:0 0 24px;font-size:14px}
label{display:block;font-size:12px;font-weight:600;margin:0 0 6px}
input{width:100%;padding:11px 13px;border:1px solid #e8e8e5;border-radius:9px;font:inherit;margin-bottom:14px}
input:focus{outline:none;border-color:#ff4a1c;box-shadow:0 0 0 3px rgba(255,74,28,.26)}
button{width:100%;padding:13px;border:0;border-radius:9px;background:#ff4a1c;color:#fff;
  font:600 15px/1 inherit;cursor:pointer}
button:hover{background:#e03d12}
.err{background:#fdeceb;color:#b23a2c;border-radius:8px;padding:9px 12px;font-size:13px;margin-bottom:14px;font-weight:600}
.app{background:#f4f4f2;border-radius:9px;padding:12px 14px;font-size:13px;color:#35353a;margin-bottom:20px}
.app b{color:#0a0a0a}
.foot{margin-top:22px;font-size:11.5px;color:#9b9b9f}`;

const AUTH_MARK = '<svg viewBox="0 0 12 10" shape-rendering="crispEdges">'
  + '<g fill="#0a0a0a"><rect x="2" y="0" width="2" height="1"/><rect x="8" y="0" width="2" height="1"/>'
  + '<rect x="1" y="1" width="4" height="1"/><rect x="7" y="1" width="4" height="1"/>'
  + '<rect x="0" y="2" width="12" height="2"/></g>'
  + '<g fill="#ff4a1c"><rect x="0" y="4" width="12" height="6"/></g>'
  + '<g fill="#fff"><rect x="2" y="5" width="2" height="2"/><rect x="8" y="5" width="2" height="2"/>'
  + '<rect x="5" y="8" width="2" height="2"/></g></svg>';

function authorizePage(params, clientName, error) {
  const hidden = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`).join('');
  return new Response(`<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Mikdaten verbinden</title>
<meta name="robots" content="noindex"><style>${AUTH_PAGE_CSS}</style></head><body>
<form class="card" method="post">
  <div class="mark">${AUTH_MARK}<div><b>Mikdaten</b><small>Immobilienverwaltung</small></div></div>
  <h1>Zugriff erlauben</h1>
  <p class="sub">Melde dich mit deinem Mikdaten-Zugang an.</p>
  <div class="app"><b>${escapeHtml(clientName || 'Eine Anwendung')}</b> möchte in deinem Namen auf
    Projekte, Aufgaben, Objekte, Kontakte und Termine zugreifen.</div>
  ${error ? `<div class="err">${escapeHtml(error)}</div>` : ''}
  <label for="u">Benutzername oder E-Mail</label>
  <input id="u" name="login" autocomplete="username" autofocus required>
  <label for="p">Passwort</label>
  <input id="p" name="password" type="password" autocomplete="current-password" required>
  ${hidden}
  <button type="submit">Verbinden</button>
  <div class="foot">Der Zugriff lässt sich jederzeit in den Einstellungen widerrufen.</div>
</form></body></html>`, {
    status: error ? 401 : 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function handleOAuth(request, env, url, origin) {
  const db = env.DB;
  const path = url.pathname;

  if (path === '/oauth/register' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u) => typeof u === 'string') : [];
    if (!uris.length) return mcpJson({ error: 'invalid_redirect_uri' }, { status: 400 });
    const clientId = 'mkc_' + randomToken(12);
    await insertRow(db, 'oauth_clients', {
      client_id: clientId,
      client_name: String(body.client_name || 'MCP-Client').slice(0, 120),
      redirect_uris: JSON.stringify(uris.slice(0, 8)),
      created_at: nowIso(),
    });
    return mcpJson({
      client_id: clientId,
      client_name: body.client_name || 'MCP-Client',
      redirect_uris: uris,
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_id_issued_at: Math.floor(Date.now() / 1000),
    }, { status: 201 });
  }

  if (path === '/oauth/authorize') {
    const q = request.method === 'POST'
      ? Object.fromEntries(new URLSearchParams(await request.text()))
      : Object.fromEntries(url.searchParams);

    const clientId = q.client_id || '';
    const redirectUri = q.redirect_uri || '';
    const client = clientId
      ? await db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').bind(clientId).first()
      : null;
    if (!client) return new Response('Unbekannte Anwendung.', { status: 400 });

    let allowed = [];
    try { allowed = JSON.parse(client.redirect_uris); } catch { allowed = []; }
    if (!allowed.includes(redirectUri)) return new Response('Ungültige Weiterleitung.', { status: 400 });
    if (q.response_type !== 'code') return new Response('Nur response_type=code wird unterstützt.', { status: 400 });
    if (q.code_challenge_method !== 'S256' || !q.code_challenge) {
      return new Response('PKCE mit S256 ist erforderlich.', { status: 400 });
    }

    const keep = {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      code_challenge: q.code_challenge,
      code_challenge_method: 'S256',
      state: q.state || '',
      scope: q.scope || 'mikdaten',
    };

    if (request.method === 'GET') return authorizePage(keep, client.client_name, null);

    const login = String(q.login || '').trim().toLowerCase();
    const user = login
      ? await db.prepare('SELECT * FROM users WHERE lower(username) = ? OR lower(email) = ?').bind(login, login).first()
      : null;
    const ok = user ? await verifyPassword(String(q.password || ''), user.password) : false;
    if (!ok) return authorizePage(keep, client.client_name, 'Zugangsdaten stimmen nicht.');

    const code = randomToken(24);
    await insertRow(db, 'oauth_codes', {
      code,
      client_id: clientId,
      user_id: user.id,
      redirect_uri: redirectUri,
      code_challenge: q.code_challenge,
      scope: keep.scope,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
    await db.prepare('DELETE FROM oauth_codes WHERE expires_at < ?').bind(nowIso()).run();

    const target = new URL(redirectUri);
    target.searchParams.set('code', code);
    if (keep.state) target.searchParams.set('state', keep.state);
    return new Response(null, { status: 302, headers: { location: target.toString(), 'cache-control': 'no-store' } });
  }

  if (path === '/oauth/token' && request.method === 'POST') {
    const form = Object.fromEntries(new URLSearchParams(await request.text()));
    if (form.grant_type !== 'authorization_code') {
      return mcpJson({ error: 'unsupported_grant_type' }, { status: 400 });
    }
    const row = await db.prepare('SELECT * FROM oauth_codes WHERE code = ?').bind(form.code || '').first();
    if (!row) return mcpJson({ error: 'invalid_grant' }, { status: 400 });
    await db.prepare('DELETE FROM oauth_codes WHERE code = ?').bind(form.code).run();
    if (row.expires_at < nowIso()) return mcpJson({ error: 'invalid_grant', error_description: 'abgelaufen' }, { status: 400 });
    if (row.client_id !== form.client_id) return mcpJson({ error: 'invalid_client' }, { status: 400 });
    if (row.redirect_uri !== form.redirect_uri) return mcpJson({ error: 'invalid_grant' }, { status: 400 });

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(form.code_verifier || '')));
    if (b64url(digest) !== row.code_challenge) {
      return mcpJson({ error: 'invalid_grant', error_description: 'code_verifier passt nicht' }, { status: 400 });
    }

    const client = await db.prepare('SELECT client_name FROM oauth_clients WHERE client_id = ?').bind(row.client_id).first();
    const token = 'mkd_' + randomToken(32);
    await insertRow(db, 'oauth_tokens', {
      id: uid('tok'),
      token_hash: await sha256Hex(token),
      client_id: row.client_id,
      client_name: client?.client_name || null,
      user_id: row.user_id,
      created_at: nowIso(),
      last_used_at: null,
    });
    return mcpJson({ access_token: token, token_type: 'Bearer', scope: row.scope || 'mikdaten' });
  }

  return null;
}

/* ================================================== Zugriff auf /mcp prüfen */

async function mcpUser(request, db) {
  const header = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const hash = await sha256Hex(match[1].trim());
  const row = await db.prepare(
    `SELECT u.*, t.id AS token_id FROM oauth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?`,
  ).bind(hash).first();
  if (!row) return null;
  await db.prepare('UPDATE oauth_tokens SET last_used_at = ? WHERE id = ?').bind(nowIso(), row.token_id).run();
  return row;
}

function unauthorized(origin) {
  return mcpJson({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Nicht angemeldet.' } }, {
    status: 401,
    headers: { 'www-authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"` },
  });
}

/* ============================================================ Werkzeuge */

const asNumber = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const isoDay = (v) => (v ? String(v).slice(0, 10) : null);
const plusDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

async function findUser(db, hint) {
  if (!hint) return null;
  const needle = String(hint).trim().toLowerCase();
  return db.prepare(
    `SELECT * FROM users WHERE id = ? OR lower(username) = ? OR lower(email) = ? OR lower(name) = ?
     OR lower(name) LIKE ? LIMIT 1`,
  ).bind(hint, needle, needle, needle, needle + '%').first();
}

async function findProperty(db, hint) {
  if (!hint) return null;
  return db.prepare('SELECT * FROM properties WHERE id = ? OR upper(code) = upper(?) OR lower(title) LIKE ? LIMIT 1')
    .bind(hint, hint, String(hint).toLowerCase() + '%').first();
}

function taskShape(t, extra = {}) {
  return {
    id: t.id,
    titel: t.title,
    beschreibung: t.description,
    projekt_id: t.project_id,
    spalte_id: t.column_id,
    prioritaet: t.priority,
    zustaendig_id: t.assignee_id,
    objekt_id: t.property_id,
    kontakt_id: t.contact_id,
    labels: safeLabels(t.labels),
    start: t.start_date,
    faellig: t.due_date,
    aufwand_stunden: t.estimate,
    betrag: t.amount,
    erledigt_am: t.done_at,
    ...extra,
  };
}

function propertyShape(p) {
  const basis = p.purchase_price || p.asking_price;
  return {
    id: p.id,
    nummer: p.code,
    bezeichnung: p.title,
    adresse: [p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null,
    art: p.type,
    status: p.deal,
    wohnflaeche_qm: p.area_sqm,
    zimmer: p.rooms,
    einheiten: p.units,
    grundstueck_qm: p.plot_sqm,
    baujahr: p.year_built,
    energieklasse: p.energy_class,
    kaufpreis: p.purchase_price,
    angebotspreis: p.asking_price,
    kaltmiete_monat: p.rent_cold,
    hausgeld_monat: p.service_charge,
    bruttorendite_prozent: p.rent_cold && basis ? Number(((p.rent_cold * 12) / basis * 100).toFixed(2)) : null,
    notizen: p.notes,
  };
}

async function runTool(name, args, db, env, me) {
  const a = args || {};
  const all = (sql, ...bind) => db.prepare(sql).bind(...bind).all().then((r) => r.results);
  const one = (sql, ...bind) => db.prepare(sql).bind(...bind).first();
  const today = nowIso().slice(0, 10);

  switch (name) {
    case 'uebersicht': {
      const k = await one(`SELECT
        (SELECT COUNT(*) FROM projects WHERE archived = 0 AND status = 'aktiv') AS aktive_projekte,
        (SELECT COUNT(*) FROM projects) AS projekte_gesamt,
        (SELECT COUNT(*) FROM tasks t JOIN columns c ON c.id = t.column_id WHERE c.is_done = 0) AS offene_aufgaben,
        (SELECT COUNT(*) FROM tasks t JOIN columns c ON c.id = t.column_id WHERE c.is_done = 1) AS erledigte_aufgaben,
        (SELECT COUNT(*) FROM tasks t JOIN columns c ON c.id = t.column_id WHERE c.is_done = 0 AND t.due_date IS NOT NULL AND t.due_date < ?) AS ueberfaellig,
        (SELECT COUNT(*) FROM tasks t JOIN columns c ON c.id = t.column_id WHERE c.is_done = 0 AND t.due_date BETWEEN ? AND ?) AS faellig_7_tage,
        (SELECT COUNT(*) FROM properties) AS objekte,
        (SELECT COUNT(*) FROM contacts) AS kontakte,
        (SELECT COUNT(*) FROM events WHERE date >= ?) AS kommende_termine,
        (SELECT COALESCE(SUM(COALESCE(asking_price, purchase_price, 0)), 0) FROM properties) AS portfoliowert_eur,
        (SELECT COALESCE(SUM(COALESCE(rent_cold, 0)), 0) FROM properties) AS kaltmiete_monat_eur`,
      today, today, plusDays(7), today);
      return { angemeldet_als: me.name, stand: today, ...k };
    }

    case 'projekte_auflisten': {
      const rows = await all('SELECT * FROM projects ORDER BY archived, position, created_at');
      const counts = await all(`SELECT t.project_id, c.is_done, COUNT(*) AS n
        FROM tasks t JOIN columns c ON c.id = t.column_id GROUP BY t.project_id, c.is_done`);
      const users = await all('SELECT id, name FROM users');
      const props = await all('SELECT id, code, title FROM properties');
      const out = rows
        .filter((p) => (a.archivierte_einschliessen ? true : !p.archived))
        .filter((p) => (a.status ? p.status === a.status : true))
        .filter((p) => (a.art ? p.type === a.art : true))
        .map((p) => {
          const done = counts.find((c) => c.project_id === p.id && c.is_done === 1)?.n || 0;
          const open = counts.find((c) => c.project_id === p.id && c.is_done === 0)?.n || 0;
          const prop = props.find((x) => x.id === p.property_id);
          return {
            id: p.id, name: p.name, beschreibung: p.description, art: p.type, status: p.status,
            leitung: users.find((u) => u.id === p.lead_id)?.name || null,
            objekt: prop ? `${prop.code} · ${prop.title}` : null,
            objekt_id: p.property_id,
            start: p.start_date, zieltermin: p.due_date,
            volumen_eur: p.volume, budget_eur: p.budget,
            aufgaben_offen: open, aufgaben_erledigt: done,
            fortschritt_prozent: open + done ? Math.round((done / (open + done)) * 100) : 0,
            archiviert: !!p.archived,
          };
        });
      return { anzahl: out.length, projekte: out };
    }

    case 'projekt_details': {
      const p = await one('SELECT * FROM projects WHERE id = ?', a.projekt_id);
      if (!p) throw new Error('Projekt nicht gefunden.');
      const cols = await all('SELECT * FROM columns WHERE project_id = ? ORDER BY position', p.id);
      const tasks = await all('SELECT column_id, COUNT(*) AS n FROM tasks WHERE project_id = ? GROUP BY column_id', p.id);
      const members = await all(
        'SELECT u.name, u.username FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = ?', p.id);
      const events = await all('SELECT id, title, type, date, time FROM events WHERE project_id = ? ORDER BY date', p.id);
      const docs = await all('SELECT id, title, url, storage_key, filename FROM documents WHERE project_id = ?', p.id);
      return {
        id: p.id, name: p.name, beschreibung: p.description, art: p.type, status: p.status,
        start: p.start_date, zieltermin: p.due_date, volumen_eur: p.volume, budget_eur: p.budget,
        spalten: cols.map((c) => ({
          id: c.id, titel: c.title, position: c.position, wip_limit: c.wip_limit,
          gilt_als_erledigt: !!c.is_done, aufgaben: tasks.find((t) => t.column_id === c.id)?.n || 0,
        })),
        team: members.map((m) => m.name),
        termine: events,
        dokumente: docs.map((d) => ({ id: d.id, titel: d.title, datei: d.filename, link: d.url })),
      };
    }

    case 'aufgaben_suchen': {
      const limit = Math.min(Math.max(Number(a.limit) || 50, 1), 200);
      const person = a.zustaendig ? await findUser(db, a.zustaendig) : null;
      if (a.zustaendig && !person) throw new Error(`Keine Person gefunden für „${a.zustaendig}".`);
      const rows = await all(`SELECT t.*, c.is_done, c.title AS spalte, p.name AS projekt
        FROM tasks t JOIN columns c ON c.id = t.column_id JOIN projects p ON p.id = t.project_id`);
      const users = await all('SELECT id, name FROM users');
      const status = a.status || 'offen';
      const text = (a.text || '').toLowerCase();

      let list = rows.filter((t) => {
        if (status === 'offen' && t.is_done) return false;
        if (status === 'erledigt' && !t.is_done) return false;
        if (a.projekt_id && t.project_id !== a.projekt_id) return false;
        if (person && t.assignee_id !== person.id) return false;
        if (a.prioritaet && t.priority !== a.prioritaet) return false;
        if (a.objekt_id && t.property_id !== a.objekt_id) return false;
        if (a.spalte_id && t.column_id !== a.spalte_id) return false;
        if (a.label && !safeLabels(t.labels).includes(a.label)) return false;
        if (a.nur_ueberfaellig && !(t.due_date && t.due_date < today && !t.is_done)) return false;
        if (a.faellig_bis && !(t.due_date && t.due_date <= isoDay(a.faellig_bis))) return false;
        if (text && !`${t.title} ${t.description || ''}`.toLowerCase().includes(text)) return false;
        return true;
      });
      list.sort((x, y) => (x.due_date || '9999') < (y.due_date || '9999') ? -1 : 1);
      const total = list.length;
      list = list.slice(0, limit);

      return {
        anzahl: total,
        angezeigt: list.length,
        aufgaben: list.map((t) => taskShape(t, {
          projekt: t.projekt,
          spalte: t.spalte,
          erledigt: !!t.is_done,
          zustaendig: users.find((u) => u.id === t.assignee_id)?.name || null,
          tage_bis_faellig: t.due_date ? Math.round((new Date(t.due_date + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5) : null,
        })),
      };
    }

    case 'aufgabe_details': {
      const t = await one(`SELECT t.*, c.title AS spalte, c.is_done, p.name AS projekt
        FROM tasks t JOIN columns c ON c.id = t.column_id JOIN projects p ON p.id = t.project_id WHERE t.id = ?`, a.aufgabe_id);
      if (!t) throw new Error('Aufgabe nicht gefunden.');
      const checks = await all('SELECT id, text, done FROM checklist_items WHERE task_id = ? ORDER BY position', t.id);
      const comments = await all(
        'SELECT c.body, c.created_at, u.name FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.task_id = ? ORDER BY c.created_at', t.id);
      const docs = await all('SELECT id, title, url, storage_key, filename, size FROM documents WHERE task_id = ?', t.id);
      const assignee = t.assignee_id ? await one('SELECT name FROM users WHERE id = ?', t.assignee_id) : null;
      const prop = t.property_id ? await one('SELECT code, title FROM properties WHERE id = ?', t.property_id) : null;
      const contact = t.contact_id ? await one('SELECT name, role FROM contacts WHERE id = ?', t.contact_id) : null;
      return taskShape(t, {
        projekt: t.projekt, spalte: t.spalte, erledigt: !!t.is_done,
        zustaendig: assignee?.name || null,
        objekt: prop ? `${prop.code} · ${prop.title}` : null,
        kontakt: contact ? `${contact.name} (${contact.role})` : null,
        checkliste: checks.map((c) => ({ id: c.id, text: c.text, erledigt: !!c.done })),
        kommentare: comments.map((c) => ({ von: c.name, am: c.created_at, text: c.body })),
        dateien: docs.map((d) => ({ id: d.id, titel: d.title, datei: d.filename, groesse_bytes: d.size, link: d.url, pfad: d.storage_key ? `/media/${d.storage_key}` : null })),
      });
    }

    case 'objekte_auflisten': {
      const rows = await all('SELECT * FROM properties ORDER BY code');
      const text = (a.text || '').toLowerCase();
      const ort = (a.ort || '').toLowerCase();
      const list = rows.filter((p) => {
        if (a.status && p.deal !== a.status) return false;
        if (a.art && p.type !== a.art) return false;
        if (ort && !`${p.city || ''} ${p.street || ''}`.toLowerCase().includes(ort)) return false;
        if (text && !`${p.title} ${p.code} ${p.street || ''} ${p.city || ''} ${p.notes || ''}`.toLowerCase().includes(text)) return false;
        return true;
      });
      return { anzahl: list.length, objekte: list.map(propertyShape) };
    }

    case 'objekt_details': {
      const p = await findProperty(db, a.objekt_id);
      if (!p) throw new Error('Objekt nicht gefunden.');
      const tasks = await all(`SELECT t.*, c.is_done, c.title AS spalte, pr.name AS projekt
        FROM tasks t JOIN columns c ON c.id = t.column_id JOIN projects pr ON pr.id = t.project_id
        WHERE t.property_id = ?`, p.id);
      const contacts = await all('SELECT id, name, role, company, email, phone FROM contacts WHERE property_id = ?', p.id);
      const projects = await all('SELECT id, name, type, status FROM projects WHERE property_id = ?', p.id);
      const events = await all('SELECT id, title, type, date, time, location FROM events WHERE property_id = ? ORDER BY date', p.id);
      const docs = await all('SELECT id, title, url, storage_key, filename, size FROM documents WHERE property_id = ?', p.id);
      const photos = await all('SELECT id, filename, key, is_cover FROM photos WHERE property_id = ? ORDER BY position', p.id);
      return {
        ...propertyShape(p),
        projekte: projects.map((x) => ({ id: x.id, name: x.name, art: x.type, status: x.status })),
        aufgaben: tasks.map((t) => ({ id: t.id, titel: t.title, spalte: t.spalte, erledigt: !!t.is_done, faellig: t.due_date, projekt: t.projekt })),
        kontakte: contacts.map((c) => ({ id: c.id, name: c.name, rolle: c.role, firma: c.company, email: c.email, telefon: c.phone })),
        termine: events,
        dokumente: docs.map((d) => ({ id: d.id, titel: d.title, datei: d.filename, groesse_bytes: d.size, link: d.url, pfad: d.storage_key ? `/media/${d.storage_key}` : null })),
        fotos: photos.map((f) => ({ id: f.id, datei: f.filename, titelbild: !!f.is_cover, pfad: `/media/${f.key}` })),
      };
    }

    case 'kontakte_auflisten': {
      const rows = await all('SELECT * FROM contacts ORDER BY name');
      const text = (a.text || '').toLowerCase();
      const list = rows.filter((c) => {
        if (a.rolle && c.role !== a.rolle) return false;
        if (a.objekt_id && c.property_id !== a.objekt_id) return false;
        if (text && !`${c.name} ${c.company || ''} ${c.email || ''} ${c.phone || ''} ${c.notes || ''}`.toLowerCase().includes(text)) return false;
        return true;
      });
      return {
        anzahl: list.length,
        kontakte: list.map((c) => ({
          id: c.id, name: c.name, rolle: c.role, firma: c.company,
          email: c.email, telefon: c.phone, objekt_id: c.property_id, notizen: c.notes,
        })),
      };
    }

    case 'termine_auflisten': {
      const von = isoDay(a.von) || today;
      const bis = isoDay(a.bis) || plusDays(30);
      const events = await all('SELECT * FROM events WHERE date BETWEEN ? AND ? ORDER BY date, time', von, bis);
      const list = events
        .filter((e) => (a.projekt_id ? e.project_id === a.projekt_id : true))
        .filter((e) => (a.objekt_id ? e.property_id === a.objekt_id : true))
        .map((e) => ({ art: 'termin', id: e.id, titel: e.title, typ: e.type, datum: e.date, uhrzeit: e.time, ort: e.location, projekt_id: e.project_id, objekt_id: e.property_id }));

      if (a.mit_aufgaben !== false) {
        const tasks = await all(`SELECT t.*, c.is_done, p.name AS projekt FROM tasks t
          JOIN columns c ON c.id = t.column_id JOIN projects p ON p.id = t.project_id
          WHERE t.due_date BETWEEN ? AND ? AND c.is_done = 0`, von, bis);
        tasks
          .filter((t) => (a.projekt_id ? t.project_id === a.projekt_id : true))
          .filter((t) => (a.objekt_id ? t.property_id === a.objekt_id : true))
          .forEach((t) => list.push({ art: 'aufgabe', id: t.id, titel: t.title, datum: t.due_date, projekt: t.projekt, projekt_id: t.project_id, objekt_id: t.property_id }));
      }
      list.sort((x, y) => (x.datum < y.datum ? -1 : x.datum > y.datum ? 1 : 0));
      return { zeitraum: { von, bis }, anzahl: list.length, eintraege: list };
    }

    case 'dokumente_auflisten': {
      const rows = await all('SELECT * FROM documents ORDER BY created_at DESC');
      const list = rows.filter((d) => {
        if (a.objekt_id && d.property_id !== a.objekt_id) return false;
        if (a.projekt_id && d.project_id !== a.projekt_id) return false;
        if (a.aufgabe_id && d.task_id !== a.aufgabe_id) return false;
        return true;
      });
      return {
        anzahl: list.length,
        dokumente: list.map((d) => ({
          id: d.id, titel: d.title, art: d.kind, datei: d.filename, groesse_bytes: d.size,
          link: d.url, pfad: d.storage_key ? `/media/${d.storage_key}` : null,
          objekt_id: d.property_id, projekt_id: d.project_id, aufgabe_id: d.task_id, angelegt: d.created_at,
        })),
      };
    }

    case 'team_auslastung': {
      const users = await all('SELECT id, name, username, job_title FROM users ORDER BY name');
      const tasks = await all('SELECT t.assignee_id, t.due_date, c.is_done FROM tasks t JOIN columns c ON c.id = t.column_id');
      const leads = await all("SELECT lead_id, name FROM projects WHERE archived = 0 AND status = 'aktiv'");
      return {
        team: users.map((u) => {
          const mine = tasks.filter((t) => t.assignee_id === u.id);
          const open = mine.filter((t) => !t.is_done);
          return {
            name: u.name, benutzername: u.username, position: u.job_title,
            offen: open.length,
            ueberfaellig: open.filter((t) => t.due_date && t.due_date < today).length,
            erledigt: mine.filter((t) => t.is_done).length,
            projektleitung: leads.filter((p) => p.lead_id === u.id).map((p) => p.name),
          };
        }),
        nicht_zugewiesen: tasks.filter((t) => !t.assignee_id && !t.is_done).length,
      };
    }

    case 'aktivitaet': {
      const limit = Math.min(Math.max(Number(a.limit) || 30, 1), 120);
      const rows = await all(
        `SELECT a.*, u.name FROM activity a LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.created_at DESC LIMIT ?`, limit);
      return { anzahl: rows.length, eintraege: rows.map((r) => ({ am: r.created_at, von: r.name, was: r.summary, bereich: r.entity })) };
    }

    case 'suche': {
      const q = String(a.text || '').toLowerCase();
      const limit = Math.min(Math.max(Number(a.limit) || 10, 1), 50);
      const [tasks, projects, props, contacts] = await Promise.all([
        all('SELECT t.id, t.title, t.due_date, p.name AS projekt FROM tasks t JOIN projects p ON p.id = t.project_id'),
        all('SELECT id, name, description FROM projects'),
        all('SELECT id, code, title, street, city FROM properties'),
        all('SELECT id, name, role, company FROM contacts'),
      ]);
      const hit = (s) => String(s || '').toLowerCase().includes(q);
      return {
        suchbegriff: a.text,
        aufgaben: tasks.filter((t) => hit(t.title)).slice(0, limit).map((t) => ({ id: t.id, titel: t.title, projekt: t.projekt, faellig: t.due_date })),
        projekte: projects.filter((p) => hit(p.name) || hit(p.description)).slice(0, limit).map((p) => ({ id: p.id, name: p.name })),
        objekte: props.filter((p) => hit(p.title) || hit(p.code) || hit(p.street) || hit(p.city)).slice(0, limit).map((p) => ({ id: p.id, nummer: p.code, bezeichnung: p.title })),
        kontakte: contacts.filter((c) => hit(c.name) || hit(c.company)).slice(0, limit).map((c) => ({ id: c.id, name: c.name, rolle: c.role, firma: c.company })),
      };
    }

    /* ------------------------------------------------------ schreibend --- */

    case 'projekt_anlegen': {
      const id = uid('prj');
      const ts = nowIso();
      const lead = a.leitung ? await findUser(db, a.leitung) : me;
      const max = await one('SELECT COALESCE(MAX(position), 0) AS p FROM projects');
      await insertRow(db, 'projects', {
        id, name: String(a.name).slice(0, 160), description: a.beschreibung || null,
        type: a.art || 'verwaltung', status: 'aktiv', color: '#0B63F6',
        property_id: a.objekt_id || null, lead_id: lead?.id || null,
        budget: asNumber(a.budget), volume: asNumber(a.volumen),
        start_date: isoDay(a.start), due_date: isoDay(a.zieltermin),
        position: (max?.p ?? 0) + 1, archived: 0, created_at: ts, updated_at: ts,
      });
      const titles = ['Backlog', 'Zu erledigen', 'In Arbeit', 'Prüfung', 'Erledigt'];
      const columns = [];
      for (let i = 0; i < titles.length; i++) {
        const cid = uid('col');
        await insertRow(db, 'columns', {
          id: cid, project_id: id, title: titles[i], position: i,
          wip_limit: null, is_done: i === titles.length - 1 ? 1 : 0, created_at: ts,
        });
        columns.push({ id: cid, titel: titles[i] });
      }
      const users = await all('SELECT id FROM users');
      for (const u of users) {
        await db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)').bind(id, u.id).run();
      }
      await logActivity(db, me, 'create', 'project', id, `Projekt „${a.name}" über MCP angelegt`, id);
      return { angelegt: true, projekt_id: id, spalten: columns };
    }

    case 'aufgabe_anlegen': {
      const cols = await all('SELECT * FROM columns WHERE project_id = ? ORDER BY position', a.projekt_id);
      if (!cols.length) throw new Error('Projekt nicht gefunden oder ohne Spalten.');
      const col = a.spalte_id ? cols.find((c) => c.id === a.spalte_id) : (cols[1] || cols[0]);
      if (!col) throw new Error('Spalte gehört nicht zu diesem Projekt.');
      const person = a.zustaendig ? await findUser(db, a.zustaendig) : null;
      if (a.zustaendig && !person) throw new Error(`Keine Person gefunden für „${a.zustaendig}".`);
      const max = await one('SELECT COALESCE(MAX(position), 0) AS p FROM tasks WHERE column_id = ?', col.id);
      const id = uid('tsk');
      const ts = nowIso();
      await insertRow(db, 'tasks', {
        id, project_id: a.projekt_id, column_id: col.id,
        title: String(a.titel).slice(0, 240), description: a.beschreibung || null,
        position: (max?.p ?? 0) + 1024, priority: a.prioritaet || 'normal',
        assignee_id: person?.id || null, property_id: a.objekt_id || null, contact_id: a.kontakt_id || null,
        labels: JSON.stringify(Array.isArray(a.labels) ? a.labels.slice(0, 12) : []),
        start_date: isoDay(a.start), due_date: isoDay(a.faellig),
        estimate: asNumber(a.aufwand_stunden), amount: asNumber(a.betrag),
        done_at: col.is_done ? ts : null, created_by: me.id, created_at: ts, updated_at: ts,
      });
      await logActivity(db, me, 'create', 'task', id, `Aufgabe „${a.titel}" über MCP erstellt`, a.projekt_id);
      return { angelegt: true, aufgabe_id: id, spalte: col.title };
    }

    case 'aufgabe_aktualisieren': {
      const t = await one('SELECT * FROM tasks WHERE id = ?', a.aufgabe_id);
      if (!t) throw new Error('Aufgabe nicht gefunden.');
      const data = { updated_at: nowIso() };
      const setIf = (key, field, transform) => {
        if (Object.prototype.hasOwnProperty.call(a, key)) {
          const v = a[key];
          data[field] = v === '' || v === null ? null : (transform ? transform(v) : v);
        }
      };
      setIf('titel', 'title', (v) => String(v).slice(0, 240));
      setIf('beschreibung', 'description');
      setIf('prioritaet', 'priority');
      setIf('faellig', 'due_date', isoDay);
      setIf('start', 'start_date', isoDay);
      setIf('objekt_id', 'property_id');
      setIf('kontakt_id', 'contact_id');
      setIf('betrag', 'amount', Number);
      setIf('aufwand_stunden', 'estimate', Number);
      if (Array.isArray(a.labels)) data.labels = JSON.stringify(a.labels.slice(0, 12));
      if (Object.prototype.hasOwnProperty.call(a, 'zustaendig')) {
        if (!a.zustaendig) data.assignee_id = null;
        else {
          const person = await findUser(db, a.zustaendig);
          if (!person) throw new Error(`Keine Person gefunden für „${a.zustaendig}".`);
          data.assignee_id = person.id;
        }
      }
      await updateRow(db, 'tasks', t.id, data);
      return { aktualisiert: true, aufgabe_id: t.id, geaenderte_felder: Object.keys(data).filter((k) => k !== 'updated_at') };
    }

    case 'aufgabe_verschieben':
    case 'aufgabe_erledigen': {
      const t = await one('SELECT * FROM tasks WHERE id = ?', a.aufgabe_id);
      if (!t) throw new Error('Aufgabe nicht gefunden.');
      const cols = await all('SELECT * FROM columns WHERE project_id = ? ORDER BY position', t.project_id);
      let col;
      if (name === 'aufgabe_erledigen') col = cols.find((c) => c.is_done);
      else if (a.spalte_id) col = cols.find((c) => c.id === a.spalte_id);
      else if (a.spalte_name) col = cols.find((c) => c.title.toLowerCase() === String(a.spalte_name).toLowerCase());
      if (!col) throw new Error(name === 'aufgabe_erledigen'
        ? 'Das Projekt hat keine Spalte, die als erledigt gilt.'
        : 'Zielspalte nicht gefunden. Spalten über projekt_details abfragen.');

      const max = await one('SELECT COALESCE(MAX(position), 0) AS p FROM tasks WHERE column_id = ?', col.id);
      await db.prepare('UPDATE tasks SET column_id = ?, position = ?, done_at = ?, updated_at = ? WHERE id = ?')
        .bind(col.id, (max?.p ?? 0) + 1024, col.is_done ? (t.done_at || nowIso()) : null, nowIso(), t.id).run();
      await logActivity(db, me, 'move', 'task', t.id, `„${t.title}" → ${col.title}`, t.project_id);
      return { verschoben: true, aufgabe_id: t.id, spalte: col.title, gilt_als_erledigt: !!col.is_done };
    }

    case 'aufgabe_kommentieren': {
      const t = await one('SELECT id FROM tasks WHERE id = ?', a.aufgabe_id);
      if (!t) throw new Error('Aufgabe nicht gefunden.');
      const id = uid('cmt');
      await insertRow(db, 'comments', {
        id, task_id: t.id, user_id: me.id, body: String(a.text).slice(0, 4000), created_at: nowIso(),
      });
      return { angelegt: true, kommentar_id: id };
    }

    case 'checkliste_ergaenzen': {
      const t = await one('SELECT id FROM tasks WHERE id = ?', a.aufgabe_id);
      if (!t) throw new Error('Aufgabe nicht gefunden.');
      const punkte = Array.isArray(a.punkte) ? a.punkte : [a.punkte];
      const max = await one('SELECT COALESCE(MAX(position), -1) AS p FROM checklist_items WHERE task_id = ?', t.id);
      let pos = (max?.p ?? -1) + 1;
      const out = [];
      for (const text of punkte.filter(Boolean).slice(0, 30)) {
        const id = uid('chk');
        await insertRow(db, 'checklist_items', { id, task_id: t.id, text: String(text).slice(0, 300), done: 0, position: pos++ });
        out.push({ id, text });
      }
      return { angelegt: out.length, punkte: out };
    }

    case 'checkliste_abhaken': {
      const item = await one('SELECT * FROM checklist_items WHERE id = ?', a.punkt_id);
      if (!item) throw new Error('Checklistenpunkt nicht gefunden.');
      const done = a.erledigt === false ? 0 : 1;
      await db.prepare('UPDATE checklist_items SET done = ? WHERE id = ?').bind(done, item.id).run();
      return { punkt_id: item.id, erledigt: !!done };
    }

    case 'spalte_anlegen': {
      const p = await one('SELECT id FROM projects WHERE id = ?', a.projekt_id);
      if (!p) throw new Error('Projekt nicht gefunden.');
      const max = await one('SELECT COALESCE(MAX(position), -1) AS p FROM columns WHERE project_id = ?', p.id);
      const id = uid('col');
      await insertRow(db, 'columns', {
        id, project_id: p.id, title: String(a.titel).slice(0, 60),
        position: (max?.p ?? -1) + 1, wip_limit: asNumber(a.wip_limit),
        is_done: a.gilt_als_erledigt ? 1 : 0, created_at: nowIso(),
      });
      return { angelegt: true, spalte_id: id };
    }

    case 'objekt_anlegen': {
      const id = uid('obj');
      const ts = nowIso();
      const count = await one('SELECT COUNT(*) AS c FROM properties');
      await insertRow(db, 'properties', {
        id, code: `OBJ-${String((count?.c ?? 0) + 1).padStart(3, '0')}`,
        title: String(a.bezeichnung).slice(0, 160),
        street: a.strasse || null, zip: a.plz || null, city: a.ort || null, country: 'DE',
        type: a.art || 'wohnung', deal: a.status || 'bestand', status: 'aktiv',
        units: asNumber(a.einheiten) ?? 1, rooms: asNumber(a.zimmer), area_sqm: asNumber(a.wohnflaeche),
        plot_sqm: asNumber(a.grundstueck), year_built: asNumber(a.baujahr), energy_class: a.energieklasse || null,
        purchase_price: asNumber(a.kaufpreis), asking_price: asNumber(a.angebotspreis),
        rent_cold: asNumber(a.kaltmiete), service_charge: asNumber(a.hausgeld),
        owner_contact: null, image_url: null, notes: a.notizen || null,
        created_at: ts, updated_at: ts,
      });
      await logActivity(db, me, 'create', 'property', id, `Objekt „${a.bezeichnung}" über MCP angelegt`);
      const fresh = await one('SELECT * FROM properties WHERE id = ?', id);
      return { angelegt: true, objekt: propertyShape(fresh) };
    }

    case 'objekt_aktualisieren': {
      const p = await findProperty(db, a.objekt_id);
      if (!p) throw new Error('Objekt nicht gefunden.');
      const map = {
        bezeichnung: 'title', status: 'deal', strasse: 'street', plz: 'zip', ort: 'city',
        wohnflaeche: 'area_sqm', zimmer: 'rooms', einheiten: 'units', grundstueck: 'plot_sqm',
        baujahr: 'year_built', energieklasse: 'energy_class', kaufpreis: 'purchase_price',
        angebotspreis: 'asking_price', kaltmiete: 'rent_cold', hausgeld: 'service_charge', notizen: 'notes',
      };
      const numeric = new Set(['area_sqm', 'rooms', 'units', 'plot_sqm', 'year_built', 'purchase_price', 'asking_price', 'rent_cold', 'service_charge']);
      const data = { updated_at: nowIso() };
      for (const [key, field] of Object.entries(map)) {
        if (!Object.prototype.hasOwnProperty.call(a, key)) continue;
        const v = a[key];
        data[field] = v === '' || v === null ? null : (numeric.has(field) ? Number(v) : v);
      }
      await updateRow(db, 'properties', p.id, data);
      const fresh = await one('SELECT * FROM properties WHERE id = ?', p.id);
      return { aktualisiert: true, objekt: propertyShape(fresh) };
    }

    case 'kontakt_anlegen': {
      const id = uid('con');
      const ts = nowIso();
      await insertRow(db, 'contacts', {
        id, name: String(a.name).slice(0, 160), role: a.rolle || 'sonstige',
        company: a.firma || null, email: a.email || null, phone: a.telefon || null,
        street: null, zip: null, city: null, property_id: a.objekt_id || null,
        notes: a.notizen || null, created_at: ts, updated_at: ts,
      });
      return { angelegt: true, kontakt_id: id };
    }

    case 'termin_anlegen': {
      const owner = a.verantwortlich ? await findUser(db, a.verantwortlich) : me;
      const id = uid('evt');
      await insertRow(db, 'events', {
        id, title: String(a.titel).slice(0, 160), type: a.art || 'termin',
        date: isoDay(a.datum), time: a.uhrzeit || null, duration: 60, location: a.ort || null,
        project_id: a.projekt_id || null, property_id: a.objekt_id || null, contact_id: a.kontakt_id || null,
        owner_id: owner?.id || me.id, notes: a.notizen || null, created_at: nowIso(),
      });
      return { angelegt: true, termin_id: id };
    }

    case 'dokument_verknuepfen': {
      if (!a.objekt_id && !a.projekt_id && !a.aufgabe_id) throw new Error('Das Dokument braucht einen Bezug: Objekt, Projekt oder Aufgabe.');
      const id = uid('doc');
      await insertRow(db, 'documents', {
        id, title: String(a.titel).slice(0, 200), url: String(a.url).slice(0, 1000),
        storage_key: null, filename: null, content_type: null, size: null,
        kind: a.art || 'sonstige',
        project_id: a.projekt_id || null, property_id: a.objekt_id || null, task_id: a.aufgabe_id || null,
        user_id: me.id, created_at: nowIso(),
      });
      return { angelegt: true, dokument_id: id };
    }

    default:
      throw new Error(`Unbekanntes Tool: ${name}`);
  }
}

/* ============================================================ /mcp-Router */

async function handleMcp(request, env, url, origin) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method === 'GET') {
    return mcpJson({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Nur POST wird unterstützt.' } }, { status: 405 });
  }
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return rpcError(null, -32700, 'Kein gültiges JSON.', 400);

  const messages = Array.isArray(body) ? body : [body];
  const first = messages[0] || {};
  const { id, method, params } = first;

  // Handshake und Benachrichtigungen brauchen keine Anmeldung
  if (method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: MCP_PROTOCOL,
      capabilities: { tools: { listChanged: false }, resources: { listChanged: false }, prompts: { listChanged: false } },
      serverInfo: {
        name: MCP_NAME,
        title: 'Mikdaten',
        version: MCP_VERSION,
        websiteUrl: origin,
        // Neuere Clients lesen das Icon hier ab, ältere holen sich das Favicon.
        // Beides zeigt auf dieselbe Bildmarke, deshalb schadet die Doppelung nicht.
        icons: [
          { src: `${origin}/icon.png`, mimeType: 'image/png', sizes: ['512x512'] },
          { src: `${origin}/icon.svg`, mimeType: 'image/svg+xml', sizes: ['any'] },
        ],
      },
      instructions: 'Projekt- und Objektsteuerung einer Immobilienverwaltung. '
        + 'Bei allgemeinen Fragen zuerst „uebersicht" aufrufen. Spalten-IDs zum Verschieben von Aufgaben '
        + 'liefert „projekt_details". Personen dürfen als Name, Benutzername oder ID angegeben werden. '
        + 'Datumsangaben immer im Format JJJJ-MM-TT.',
    });
  }
  if (!method || method.startsWith('notifications/')) return new Response(null, { status: 202, headers: cors });
  if (method === 'ping') return rpcResult(id, {});

  const me = await mcpUser(request, env.DB);
  if (!me) return unauthorized(origin);

  try {
    switch (method) {
      case 'tools/list':
        return rpcResult(id, { tools: MCP_TOOLS });

      case 'tools/call': {
        const toolName = params?.name;
        if (!MCP_TOOLS_BY_NAME.has(toolName)) return rpcError(id, -32602, `Unbekanntes Tool: ${toolName}`);
        try {
          const data = await runTool(toolName, params?.arguments || {}, env.DB, env, me);
          return rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
        } catch (err) {
          return rpcResult(id, { isError: true, content: [{ type: 'text', text: err.message || 'Fehlgeschlagen.' }] });
        }
      }

      case 'resources/list':
        return rpcResult(id, { resources: MCP_RESOURCES });

      case 'resources/templates/list':
        return rpcResult(id, { resourceTemplates: [] });

      case 'resources/read': {
        const uri = params?.uri || '';
        const map = { 'mikdaten://uebersicht': 'uebersicht', 'mikdaten://projekte': 'projekte_auflisten', 'mikdaten://objekte': 'objekte_auflisten' };
        const tool = map[uri];
        if (!tool) return rpcError(id, -32602, `Unbekannte Ressource: ${uri}`);
        const data = await runTool(tool, {}, env.DB, env, me);
        return rpcResult(id, { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] });
      }

      case 'prompts/list':
        return rpcResult(id, { prompts: MCP_PROMPTS });

      case 'prompts/get': {
        const p = MCP_PROMPTS.find((x) => x.name === params?.name);
        if (!p) return rpcError(id, -32602, `Unbekannter Prompt: ${params?.name}`);
        const arg = params?.arguments || {};
        const texte = {
          wochenueberblick: `Verschaffe mir einen Überblick über diese Woche${arg.person ? ` für ${arg.person}` : ''}. `
            + 'Rufe uebersicht, aufgaben_suchen (nur_ueberfaellig) und termine_auflisten auf. '
            + 'Nenne zuerst, was überfällig ist, dann was diese Woche ansteht, dann wo es hakt.',
          objekt_dossier: `Stelle mir alles zum Objekt „${arg.objekt || ''}" zusammen. `
            + 'Nutze objekt_details und ergänze offene Aufgaben, Beteiligte, anstehende Termine und hinterlegte Dokumente. '
            + 'Schließe mit den nächsten sinnvollen Schritten.',
          fristen_pruefen: `Prüfe alle Termine und Fristen der nächsten ${arg.tage || 30} Tage. `
            + 'Nutze termine_auflisten und aufgaben_suchen. Markiere, wo der Vorlauf knapp wird, '
            + 'und nenne für jede Frist die verantwortliche Person.',
        };
        return rpcResult(id, {
          description: p.description,
          messages: [{ role: 'user', content: { type: 'text', text: texte[p.name] } }],
        });
      }

      default:
        return rpcError(id, -32601, `Unbekannte Methode: ${method}`);
    }
  } catch (err) {
    return rpcError(id, -32603, err.message || 'Serverfehler.');
  }
}

/* Katalog für den Hub — ohne Anmeldung, damit die Übersicht ihn lesen kann. */
function toolsCatalog() {
  return mcpJson({
    server: { name: MCP_NAME, title: 'Mikdaten', version: MCP_VERSION, protocol: MCP_PROTOCOL },
    tools: MCP_TOOLS,
  }, { headers: { 'cache-control': 'public, max-age=300' } });
}
