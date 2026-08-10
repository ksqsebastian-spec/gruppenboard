/* ==========================================================================
   Mikdaten — Frontend
   Vanilla JS, keine Abhängigkeiten. Ein Zustand, deklaratives Rendering.
   ========================================================================== */
(() => {
'use strict';

/* ------------------------------------------------------------- Grundlagen */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const EUR2 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const NUM = new Intl.NumberFormat('de-DE');

const money = (v) => (v === null || v === undefined || v === '' ? '—' : EUR.format(Number(v)));
const num = (v, unit = '') => (v === null || v === undefined || v === '' ? '—' : NUM.format(Number(v)) + unit);

const todayISO = () => new Date().toISOString().slice(0, 10);

function fmtDate(iso, opts) {
  if (!iso) return '';
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('de-DE', opts || { day: '2-digit', month: 'short' });
}
function fmtDateLong(iso) {
  return fmtDate(iso, { day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  if (d < 7) return `vor ${d} T.`;
  return fmtDate(iso, { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function daysUntil(iso) {
  if (!iso) return null;
  const a = new Date(todayISO() + 'T00:00:00').getTime();
  const b = new Date(iso.slice(0, 10) + 'T00:00:00').getTime();
  return Math.round((b - a) / 864e5);
}

/* ------------------------------------------------------------------ Icons */

const I = {
  grid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  board: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/></svg>',
  list: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
  calendar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  timeline: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h9M8 12h11M4 18h7"/></svg>',
  home: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/></svg>',
  users: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.4"/><path d="M2.5 20c.6-3.6 3.3-5.6 6.5-5.6s5.9 2 6.5 5.6"/><path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.6M18 14.8c2.2.6 3.7 2.5 4 5.2"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9 17.5 20 6.5"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  dots: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
  x: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  clock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/></svg>',
  chat: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 15.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5z"/></svg>',
  checkSquare: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8 12 3 3 5-6"/></svg>',
  building: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V6.5A1.5 1.5 0 0 1 5.5 5H12v16"/><path d="M12 10h6.5A1.5 1.5 0 0 1 20 11.5V21"/><path d="M2.5 21h19M7 9h2M7 13h2M7 17h2M15 14h2M15 18h2"/></svg>',
  contact: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="10" cy="10.5" r="2.4"/><path d="M6.3 16.6c.5-1.7 2-2.6 3.7-2.6s3.2.9 3.7 2.6M16 9h3M16 13h3"/></svg>',
  activity: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2.5-7 5 14L17.5 12H21"/></svg>',
  settings: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
  inbox: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12h-5l-1.5 3h-5L8 12H3"/><path d="M5.5 5h13l2.5 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/></svg>',
  doc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14.5 6.5 17.5 9.5"/></svg>',
  moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z"/></svg>',
  sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>',
  logout: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17l5-5-5-5M20 12H9M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/></svg>',
  menu: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  drag: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  euro: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 5.5A6.5 6.5 0 0 0 7.5 12 6.5 6.5 0 0 0 17 18.5M4 10.5h8M4 14h8"/></svg>',
  ruler: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="8" width="19" height="8" rx="2"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/></svg>',
  bed: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-8M3 13h18v5M21 18v-3.5A2.5 2.5 0 0 0 18.5 12H12V8.5"/><circle cx="7" cy="9.5" r="1.8"/></svg>',
  chevron: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5 8 12l7 7"/></svg>',
  arrowLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 4 12l7 7M4 12h16"/></svg>',
  arrowRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 5 7 7-7 7M20 12H4"/></svg>',
  camera: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.9a1 1 0 0 0 .83-.45l.9-1.35A1 1 0 0 1 9.96 3.8h4.08a1 1 0 0 1 .83.4l.9 1.35a1 1 0 0 0 .83.45h1.9A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="12.8" r="3.6"/></svg>',
  star: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3.8 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 17.2l-5.25 2.75 1-5.85L3.5 9.95l5.9-.85z"/></svg>',
  pin: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
};

const LOGO = (size = 34) => `<svg class="logo-mark" style="width:${size}px;height:${size}px" viewBox="0 0 48 48" aria-hidden="true">
<defs><linearGradient id="mkg${size}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A3D"/><stop offset="1" stop-color="#FF3D6E"/></linearGradient></defs>
<rect width="48" height="48" rx="13" fill="url(#mkg${size})"/>
<path d="M10 35V25.2l7.2-7.2 6.8 6.8 6.8-6.8 7.2 7.2V35" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M24 35v-6" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>`;

/* ------------------------------------------------------------- Stammdaten */

const LABELS = [
  ['Ankauf', '#FF4E5B'], ['Verkauf', '#12855F'], ['Vermietung', '#2F6DF6'],
  ['Sanierung', '#B26A00'], ['Finanzierung', '#7A4DDB'], ['Recht', '#4B5563'],
  ['Behörde', '#0E8A8A'], ['Marketing', '#E2569C'], ['Besichtigung', '#FF8A3D'],
  ['Notar', '#5B6472'], ['Buchhaltung', '#3E8E3E'], ['Technik', '#7C6A55'],
];
const LABEL_COLOR = Object.fromEntries(LABELS);

const PRIOS = [
  ['hoch', 'Hoch', 'red'], ['mittel', 'Mittel', 'amber'],
  ['normal', 'Normal', 'blue'], ['niedrig', 'Niedrig', ''],
];
const PRIO_NAME = Object.fromEntries(PRIOS.map((p) => [p[0], p[1]]));
const PRIO_RANK = { hoch: 0, mittel: 1, normal: 2, niedrig: 3 };

const PROJECT_TYPES = [
  ['ankauf', 'Ankauf'], ['verkauf', 'Verkauf'], ['vermietung', 'Vermietung'],
  ['sanierung', 'Sanierung'], ['verwaltung', 'Verwaltung'], ['sonstiges', 'Sonstiges'],
];
const PROJECT_TYPE_NAME = Object.fromEntries(PROJECT_TYPES);
const PROJECT_STATUS = [['aktiv', 'Aktiv'], ['pausiert', 'Pausiert'], ['abgeschlossen', 'Abgeschlossen']];

const PROPERTY_TYPES = [
  ['wohnung', 'Eigentumswohnung'], ['haus', 'Einfamilienhaus'], ['mehrfamilienhaus', 'Mehrfamilienhaus'],
  ['gewerbe', 'Gewerbe'], ['grundstueck', 'Grundstück'], ['garage', 'Stellplatz / Garage'],
];
const PROPERTY_TYPE_NAME = Object.fromEntries(PROPERTY_TYPES);
const DEALS = [
  ['ankauf', 'Im Ankauf', 'amber'], ['bestand', 'Bestand', 'blue'],
  ['vermarktung', 'In Vermarktung', 'brand'], ['verkauft', 'Verkauft', 'green'],
  ['vermietet', 'Vermietet', 'violet'],
];
const DEAL_MAP = Object.fromEntries(DEALS.map((d) => [d[0], d]));

const CONTACT_ROLES = [
  ['eigentuemer', 'Eigentümer'], ['kaeufer', 'Käufer'], ['mieter', 'Mieter'],
  ['interessent', 'Interessent'], ['makler', 'Makler'], ['handwerker', 'Handwerker'],
  ['notar', 'Notar'], ['bank', 'Bank / Finanzierung'], ['verwalter', 'Hausverwaltung'],
  ['behoerde', 'Behörde'], ['sonstige', 'Sonstige'],
];
const CONTACT_ROLE_NAME = Object.fromEntries(CONTACT_ROLES);

const EVENT_TYPES = [
  ['besichtigung', 'Besichtigung'], ['notar', 'Notartermin'], ['uebergabe', 'Übergabe'],
  ['abnahme', 'Abnahme'], ['etv', 'Eigentümerversammlung'], ['frist', 'Frist'], ['termin', 'Termin'],
];
const EVENT_TYPE_NAME = Object.fromEntries(EVENT_TYPES);

const COLORS = ['#FF4E5B', '#FF8A3D', '#F5B301', '#12855F', '#0E8A8A', '#2F6DF6', '#7A4DDB', '#E2569C', '#5B6472', '#7C6A55'];

/* ------------------------------------------------------------------ State */

const S = {
  me: null,
  users: [], projects: [], members: [], columns: [], tasks: [], comments: [],
  checklist: [], properties: [], contacts: [], events: [], documents: [], photos: [], activity: [],
  route: { name: 'dashboard', id: null },
  boardView: 'board',
  filters: { q: '', assignee: null, priority: null, label: null, mine: false, overdue: false, deal: null },
  calMonth: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
  drawerTask: null,
  menuOpen: null,
  lightbox: null,
  groupBy: '',
  composer: null,
  collapsed: new Set(),
  collapsedFor: null,
  showAllDone: new Set(),
};

const byId = (arr, id) => arr.find((x) => x.id === id) || null;
const userById = (id) => byId(S.users, id);
const projectById = (id) => byId(S.projects, id);
const propertyById = (id) => byId(S.properties, id);
const contactById = (id) => byId(S.contacts, id);

const projectColumns = (pid) => S.columns.filter((c) => c.project_id === pid).sort((a, b) => a.position - b.position);
const projectTasks = (pid) => S.tasks.filter((t) => t.project_id === pid);
const projectMembers = (pid) => S.members.filter((m) => m.project_id === pid).map((m) => userById(m.user_id)).filter(Boolean);
const isDoneTask = (t) => {
  const c = byId(S.columns, t.column_id);
  return !!(c && c.is_done);
};

/* -------------------------------------------------------------------- API */

async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: Object.assign({ 'x-mikdaten': '1' }, body ? { 'content-type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* leer */ }
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}

async function refresh() {
  const data = await api('/state');
  Object.assign(S, data);
  return data;
}

/* ------------------------------------------------------------ Bild-Upload */

const propertyPhotos = (pid) => S.photos.filter((p) => p.property_id === pid);

const MAX_UPLOAD = 12 * 1024 * 1024;
const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic'];

async function uploadPhotos(propertyId, files) {
  const list = Array.from(files || []);
  if (!list.length) return;

  const bad = list.filter((f) => !ALLOWED_IMAGES.includes(f.type));
  if (bad.length) toast(`${bad.length} Datei(en) übersprungen — nur Bilder erlaubt.`, 'err');
  const big = list.filter((f) => f.size > MAX_UPLOAD);
  if (big.length) toast(`${big.length} Datei(en) übersprungen — größer als 12 MB.`, 'err');

  const queue = list.filter((f) => ALLOWED_IMAGES.includes(f.type) && f.size <= MAX_UPLOAD);
  if (!queue.length) return;

  setUploadState(true, `0/${queue.length} hochgeladen …`);
  let done = 0;
  for (const file of queue) {
    try {
      const res = await fetch(`/api/photos/upload?property_id=${encodeURIComponent(propertyId)}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'x-mikdaten': '1',
          'content-type': file.type,
          'x-filename': encodeURIComponent(file.name),
        },
        body: file,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Fehler ${res.status}`);
      }
      done++;
      setUploadState(true, `${done}/${queue.length} hochgeladen …`);
    } catch (e) {
      toast(`${file.name}: ${e.message}`, 'err');
    }
  }
  setUploadState(false);
  await refresh();
  render();
  if (done) toast(done === 1 ? 'Foto hinzugefügt.' : `${done} Fotos hinzugefügt.`);
}

function setUploadState(active, text) {
  const zone = $('#photo-drop');
  if (!zone) return;
  zone.classList.toggle('busy', !!active);
  const label = $('#photo-drop-label');
  if (label) label.textContent = active ? text : 'Fotos hinzufügen';
}

function pickPhotos(propertyId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ALLOWED_IMAGES.join(',');
  input.multiple = true;
  input.addEventListener('change', () => uploadPhotos(propertyId, input.files));
  input.click();
}

/* ----------------------------------------------------------------- Toasts */

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.innerHTML = (kind === 'err' ? I.x : I.check) + '<span>' + esc(msg) + '</span>';
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 260);
  }, 2600);
}

async function guard(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) toast(okMsg);
    return r;
  } catch (e) {
    toast(e.message || 'Etwas ist schiefgelaufen.', 'err');
    throw e;
  }
}

/* ------------------------------------------------------------ Bausteine */

function avatar(user, cls = '') {
  if (!user) return `<div class="avatar ${cls}" style="background:#b9bec6" title="Nicht zugewiesen">–</div>`;
  return `<div class="avatar ${cls}" style="background:${esc(user.color)}" title="${esc(user.name)}">${esc(user.initials)}</div>`;
}

function progressOf(pid) {
  const ts = projectTasks(pid);
  if (!ts.length) return { done: 0, total: 0, pct: 0 };
  const done = ts.filter(isDoneTask).length;
  return { done, total: ts.length, pct: Math.round((done / ts.length) * 100) };
}

function dueBadge(iso, done) {
  if (!iso) return '';
  const d = daysUntil(iso);
  let cls = 'm';
  let text = fmtDate(iso);
  if (!done) {
    if (d < 0) { cls = 'm overdue'; text = `${fmtDate(iso)} · ${Math.abs(d)} T. überfällig`; }
    else if (d === 0) { cls = 'm due-soon'; text = 'Heute'; }
    else if (d === 1) { cls = 'm due-soon'; text = 'Morgen'; }
    else if (d <= 3) { cls = 'm due-soon'; }
  }
  return `<span class="${cls}">${I.clock}${esc(text)}</span>`;
}

/* -------------------------------------------------------------- Sidebar */

function renderSidebar() {
  const r = S.route;
  const open = S.projects.filter((p) => !p.archived && p.status !== 'abgeschlossen');
  const myOpen = S.tasks.filter((t) => t.assignee_id === S.me.id && !isDoneTask(t)).length;
  const overdue = S.tasks.filter((t) => !isDoneTask(t) && t.due_date && daysUntil(t.due_date) < 0).length;

  const nav = (name, id, icon, label, count) => `
    <button class="nav-item ${r.name === name && (!id || r.id === id) ? 'active' : ''}" data-act="go" data-route="${esc(id ? name + '/' + id : name)}">
      ${icon}<span class="trunc">${esc(label)}</span>${count ? `<span class="count">${count}</span>` : ''}
    </button>`;

  $('#sidebar').innerHTML = `
    <div class="sidebar-head">
      <div class="logo">
        ${LOGO(34)}
        <div class="logo-word">Mikdaten<small>Immobilien</small></div>
      </div>
    </div>
    <div class="sidebar-scroll">
      ${nav('dashboard', null, I.grid, 'Übersicht')}
      ${nav('meine', null, I.inbox, 'Meine Aufgaben', myOpen)}
      ${nav('kalender', null, I.calendar, 'Kalender')}
      ${overdue ? `<button class="nav-item" data-act="filter-overdue">${I.clock}<span>Überfällig</span><span class="count" style="background:var(--red-soft);color:var(--red)">${overdue}</span></button>` : ''}

      <div class="nav-label">Projekte
        <button data-act="project-new" title="Neues Projekt">${I.plus}</button>
      </div>
      ${open.length ? open.map((p) => `
        <button class="nav-item ${r.name === 'board' && r.id === p.id ? 'active' : ''}" data-act="go" data-route="board/${esc(p.id)}">
          <span class="nav-dot" style="background:${esc(p.color)}"></span>
          <span class="trunc">${esc(p.name)}</span>
          <span class="count">${projectTasks(p.id).filter((t) => !isDoneTask(t)).length}</span>
        </button>`).join('') : '<div class="tiny faint" style="padding:6px 10px">Noch keine Projekte</div>'}
      ${nav('projekte', null, I.board, 'Alle Projekte')}

      <div class="nav-label">Verwaltung</div>
      ${nav('objekte', null, I.building, 'Objekte', S.properties.length)}
      ${nav('kontakte', null, I.contact, 'Kontakte', S.contacts.length)}
      ${nav('team', null, I.users, 'Team')}
      ${nav('aktivitaet', null, I.activity, 'Aktivität')}
    </div>
    <div class="sidebar-foot">
      <div class="row" style="padding:6px 6px">
        ${avatar(S.me, 'lg')}
        <div style="min-width:0;flex:1">
          <div class="trunc" style="font-weight:600;font-size:13px">${esc(S.me.name)}</div>
          <div class="trunc tiny faint">${esc(S.me.job_title || S.me.email)}</div>
        </div>
        <div class="dropdown">
          <button class="btn btn-ghost btn-icon btn-sm" data-act="menu" data-menu="user">${I.dots}</button>
          ${S.menuOpen === 'user' ? `<div class="menu" style="bottom:calc(100% + 6px);top:auto">
            <button data-act="go" data-route="einstellungen">${I.settings} Einstellungen</button>
            <button data-act="theme">${document.documentElement.dataset.theme === 'dark' ? I.sun + ' Helles Design' : I.moon + ' Dunkles Design'}</button>
            <div class="sepm"></div>
            <button class="danger" data-act="logout">${I.logout} Abmelden</button>
          </div>` : ''}
        </div>
      </div>
    </div>`;
}

/* --------------------------------------------------------------- Topbar */

function renderTopbar() {
  const r = S.route;
  let title = 'Übersicht';
  let right = '';

  if (r.name === 'board') {
    const p = projectById(r.id);
    title = p ? p.name : 'Projekt';
    const prog = p ? progressOf(p.id) : { done: 0, total: 0, pct: 0 };
    right = `
      <div class="row tb-progress" style="gap:9px;margin-right:2px">
        <span class="tiny faint">${prog.done}/${prog.total} erledigt</span>
        <div class="bar" style="width:84px"><i style="width:${prog.pct}%"></i></div>
      </div>
      <button class="btn btn-brand btn-sm" data-act="task-new">${I.plus} Aufgabe</button>
      <div class="dropdown">
        <button class="btn btn-soft btn-sm btn-icon" data-act="menu" data-menu="project">${I.dots}</button>
        ${p && S.menuOpen === 'project' ? `<div class="menu">
          <button data-act="project-edit" data-id="${esc(p.id)}">${I.edit} Projekt bearbeiten</button>
          <button data-act="column-new" data-id="${esc(p.id)}">${I.plus} Spalte hinzufügen</button>
          <button data-act="project-archive" data-id="${esc(p.id)}">${I.check} ${p.archived ? 'Wiederherstellen' : 'Archivieren'}</button>
          <div class="sepm"></div>
          <button class="danger" data-act="project-delete" data-id="${esc(p.id)}">${I.trash} Projekt löschen</button>
        </div>` : ''}
      </div>`;
  } else {
    const t = {
      dashboard: 'Übersicht', meine: 'Meine Aufgaben', projekte: 'Alle Projekte',
      objekte: 'Objekte', objekt: 'Objekt', kontakte: 'Kontakte', kalender: 'Kalender',
      team: 'Team', aktivitaet: 'Aktivität', einstellungen: 'Einstellungen',
    };
    title = t[r.name] || 'Mikdaten';
    if (r.name === 'projekte') right = `<button class="btn btn-brand btn-sm" data-act="project-new">${I.plus} Projekt</button>`;
    if (r.name === 'objekte') right = `<button class="btn btn-brand btn-sm" data-act="property-new">${I.plus} Objekt</button>`;
    if (r.name === 'kontakte') right = `<button class="btn btn-brand btn-sm" data-act="contact-new">${I.plus} Kontakt</button>`;
    if (r.name === 'kalender') right = `<button class="btn btn-brand btn-sm" data-act="event-new">${I.plus} Termin</button>`;
  }

  $('#topbar').innerHTML = `
    <button class="btn btn-ghost btn-icon" data-act="nav-toggle" style="display:none" id="nav-toggle">${I.menu}</button>
    <h1>${esc(title).replace(/&amp;/g, '&')}</h1>
    <div class="spacer"></div>
    <button class="search-trigger" data-act="palette">
      ${I.search}<span>Suchen …</span><kbd>⌘K</kbd>
    </button>
    <button class="btn btn-ghost btn-icon" data-act="theme" title="Design wechseln">
      ${document.documentElement.dataset.theme === 'dark' ? I.sun : I.moon}
    </button>
    ${right}`;

  if (window.matchMedia('(max-width: 860px)').matches) $('#nav-toggle').style.display = '';
}

/* ======================================================== Ansicht: Board */

function filteredTasks(pid) {
  const f = S.filters;
  const q = f.q.trim().toLowerCase();
  return projectTasks(pid).filter((t) => {
    if (q) {
      const prop = propertyById(t.property_id);
      const hay = `${t.title} ${t.description || ''} ${(t.labels || []).join(' ')} ${prop ? prop.title : ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.assignee && t.assignee_id !== f.assignee) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.label && !(t.labels || []).includes(f.label)) return false;
    if (f.mine && t.assignee_id !== S.me.id) return false;
    if (f.overdue && !(t.due_date && daysUntil(t.due_date) < 0 && !isDoneTask(t))) return false;
    return true;
  });
}

const filtersActive = () => {
  const f = S.filters;
  return !!(f.assignee || f.priority || f.label || f.q.trim() || f.mine || f.overdue);
};

function taskCard(t) {
  const u = userById(t.assignee_id);
  const done = isDoneTask(t);
  const cl = S.checklist.filter((c) => c.task_id === t.id);
  const clDone = cl.filter((c) => c.done).length;
  const nComments = S.comments.filter((c) => c.task_id === t.id).length;
  const nDocs = S.documents.filter((d) => d.task_id === t.id).length;
  const prop = propertyById(t.property_id);
  const labels = t.labels || [];

  return `<article class="tcard ${done ? 'done' : ''}" data-task="${esc(t.id)}" data-act="task-open" tabindex="0">
    <span class="tcard-handle" title="Zum Verschieben ziehen">${I.drag}</span>
    ${labels.length ? `<div class="tcard-labels">${labels.map((l) => `<span class="tlabel" style="background:${hexA(LABEL_COLOR[l] || '#9aa0ab', 0.14)};color:${esc(LABEL_COLOR[l] || '#9aa0ab')}">${esc(l)}</span>`).join('')}</div>` : ''}
    <div class="tcard-title">${esc(t.title)}</div>
    ${prop ? `<div class="tcard-obj">${I.pin}<span class="trunc">${esc(prop.title)}</span></div>` : ''}
    <div class="tcard-meta">
      <span class="prio ${esc(t.priority)}" title="Priorität ${esc(PRIO_NAME[t.priority] || '')}"></span>
      ${dueBadge(t.due_date, done)}
      ${cl.length ? `<span class="m ${clDone === cl.length ? 'ok' : ''}">${I.checkSquare}${clDone}/${cl.length}</span>` : ''}
      ${nComments ? `<span class="m">${I.chat}${nComments}</span>` : ''}
      ${nDocs ? `<span class="m">${I.doc}${nDocs}</span>` : ''}
      ${t.amount ? `<span class="m">${I.euro}${esc(EUR.format(t.amount))}</span>` : ''}
      <span class="push">${avatar(u, 'sm')}</span>
    </div>
  </article>`;
}

/* --------------------------------------------------------- Board-Werkzeug */

const GROUPINGS = [
  ['', 'Keine Gruppierung'],
  ['assignee_id', 'Nach Zuständigkeit'],
  ['priority', 'Nach Priorität'],
  ['property_id', 'Nach Objekt'],
];

const DONE_VISIBLE = 15;

function collapsedKey(pid) { return `mk-collapsed-${pid}`; }

function loadCollapsed(pid) {
  try { return new Set(JSON.parse(localStorage.getItem(collapsedKey(pid)) || '[]')); }
  catch { return new Set(); }
}
function saveCollapsed(pid) {
  try { localStorage.setItem(collapsedKey(pid), JSON.stringify(Array.from(S.collapsed))); }
  catch { /* egal */ }
}

/* Baut die Schwimmbahnen: ohne Gruppierung genau eine ohne Titel. */
function buildLanes(tasks) {
  const g = S.groupBy;
  if (!g) return [{ key: '', label: '', tasks }];

  const lanes = [];
  const push = (key, label, meta) => lanes.push({ key, label, meta, tasks: [] });

  if (g === 'assignee_id') {
    S.users.forEach((u) => push(u.id, u.name, u));
    push('', 'Nicht zugewiesen', null);
  } else if (g === 'priority') {
    PRIOS.forEach(([k, l]) => push(k, l, null));
  } else {
    const used = new Set(tasks.map((t) => t.property_id).filter(Boolean));
    S.properties.filter((p) => used.has(p.id)).forEach((p) => push(p.id, p.title, null));
    push('', 'Ohne Objekt', null);
  }

  const index = new Map(lanes.map((l) => [l.key, l]));
  tasks.forEach((t) => {
    const lane = index.get(t[g] || '') || index.get('');
    if (lane) lane.tasks.push(t);
  });
  return lanes.filter((l) => l.tasks.length);
}

function columnHead(c, tasksOfColumn, collapsed) {
  const over = c.wip_limit && tasksOfColumn.length > c.wip_limit;
  const sum = tasksOfColumn.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  if (collapsed) {
    return `<div class="col-head is-collapsed" data-column="${esc(c.id)}">
      <button class="col-expand" data-act="column-collapse" data-id="${esc(c.id)}" title="${esc(c.title)} ausklappen">
        <span class="col-vert">${esc(c.title)}</span><span class="n">${tasksOfColumn.length}</span>
      </button>
    </div>`;
  }
  return `<div class="col-head" data-column="${esc(c.id)}">
    <button class="col-collapse" data-act="column-collapse" data-id="${esc(c.id)}" title="Einklappen">${I.chevron}</button>
    <h3 class="trunc">${esc(c.title)}</h3>
    <span class="n ${over ? 'over' : ''}" title="${c.wip_limit ? `WIP-Limit ${c.wip_limit}` : 'Anzahl Aufgaben'}">${tasksOfColumn.length}${c.wip_limit ? ' / ' + c.wip_limit : ''}</span>
    ${sum ? `<span class="col-sum" title="Summe der Beträge">${esc(EUR.format(sum))}</span>` : ''}
    <div class="col-tools">
      <button data-act="composer-open" data-column="${esc(c.id)}" title="Aufgabe hinzufügen">${I.plus}</button>
      <div class="dropdown">
        <button data-act="menu" data-menu="col:${esc(c.id)}" title="Spalte">${I.dots}</button>
        ${S.menuOpen === 'col:' + c.id ? `<div class="menu">
          <button data-act="column-edit" data-id="${esc(c.id)}">${I.edit} Spalte bearbeiten</button>
          <button data-act="column-move" data-id="${esc(c.id)}" data-dir="-1">${I.arrowLeft} Nach links</button>
          <button data-act="column-move" data-id="${esc(c.id)}" data-dir="1">${I.arrowRight} Nach rechts</button>
          <button data-act="column-collapse" data-id="${esc(c.id)}">${I.chevron} Einklappen</button>
          <div class="sepm"></div>
          <button class="danger" data-act="column-delete" data-id="${esc(c.id)}">${I.trash} Spalte löschen</button>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}

function columnCards(c, laneKey, list) {
  const isDoneCol = !!c.is_done;
  let shown = list;
  let hidden = 0;
  if (isDoneCol && !S.showAllDone.has(c.id) && list.length > DONE_VISIBLE) {
    shown = list.slice(0, DONE_VISIBLE);
    hidden = list.length - DONE_VISIBLE;
  }
  const composerHere = S.composer && S.composer.column === c.id && S.composer.lane === laneKey;

  return `<div class="col-drop" data-column="${esc(c.id)}">
    <div class="col-cards" data-column-body="${esc(c.id)}" data-lane="${esc(laneKey)}">
      ${shown.map(taskCard).join('')}
      ${!shown.length && !composerHere ? '<div class="col-empty">Hierher ziehen</div>' : ''}
      ${hidden ? `<button class="col-more" data-act="show-all-done" data-id="${esc(c.id)}">${hidden} ältere anzeigen</button>` : ''}
    </div>
    <div class="col-foot">
      ${composerHere ? composerMarkup(c) : `<button class="add-card" data-act="composer-open" data-column="${esc(c.id)}" data-lane="${esc(laneKey)}">${I.plus} Aufgabe</button>`}
    </div>
  </div>`;
}

function composerMarkup(c) {
  const d = S.composer;
  return `<div class="composer">
    <textarea id="composer-input" rows="2" placeholder="Titel der Aufgabe — Eingabe zum Anlegen">${esc(d.text || '')}</textarea>
    <div class="composer-row">
      <select class="select" id="composer-assignee" title="Zuständig">
        <option value="">Niemand</option>
        ${S.users.map((u) => `<option value="${esc(u.id)}" ${d.assignee === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
      </select>
      <select class="select" id="composer-prio" title="Priorität">
        ${PRIOS.map(([k, l]) => `<option value="${k}" ${(d.priority || 'normal') === k ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <input class="input" type="date" id="composer-due" value="${esc(d.due || '')}" title="Fällig">
    </div>
    <div class="composer-actions">
      <button class="btn btn-brand btn-sm" data-act="composer-save" data-column="${esc(c.id)}">Anlegen</button>
      <button class="btn btn-ghost btn-sm" data-act="composer-close">Abbrechen</button>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ Ansicht */

function viewBoard(root) {
  const p = projectById(S.route.id);
  if (!p) { root.innerHTML = emptyState('Projekt nicht gefunden', 'Wähle links ein Projekt aus.'); return; }

  if (S.collapsedFor !== p.id) {
    S.collapsed = loadCollapsed(p.id);
    S.collapsedFor = p.id;
  }

  const f = S.filters;
  const members = projectMembers(p.id);
  const active = filtersActive();

  const toolbar = `
    <div class="toolbar">
      <div class="seg">
        ${[['board', 'Board', I.board], ['liste', 'Liste', I.list], ['timeline', 'Timeline', I.timeline], ['kalender', 'Kalender', I.calendar]]
          .map(([k, l, ic]) => `<button class="${S.boardView === k ? 'on' : ''}" data-act="board-view" data-view="${k}">${ic}<span>${l}</span></button>`).join('')}
      </div>
      <div class="tb-sep"></div>
      <div class="tb-search">
        <span>${I.search}</span>
        <input class="input" id="board-search" placeholder="Aufgaben filtern" value="${esc(f.q)}" autocomplete="off">
      </div>
      <button class="chip ${f.mine ? 'on' : ''}" data-act="f-mine">Nur meine</button>
      <button class="chip ${f.overdue ? 'on' : ''}" data-act="f-overdue">Überfällig</button>
      <select class="select tb-select" data-change="f-prio" title="Priorität">
        <option value="">Priorität</option>
        ${PRIOS.map(([k, l]) => `<option value="${k}" ${f.priority === k ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <select class="select tb-select" data-change="f-label" title="Label">
        <option value="">Label</option>
        ${LABELS.map(([k]) => `<option value="${esc(k)}" ${f.label === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}
      </select>
      ${S.boardView === 'board' ? `<select class="select tb-select" data-change="group-by" title="Gruppierung">
        ${GROUPINGS.map(([k, l]) => `<option value="${k}" ${S.groupBy === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}
      </select>` : ''}
      <div class="row" style="gap:0">
        ${members.map((u) => `<button class="f-av" data-act="f-assignee" data-id="${esc(u.id)}" title="${esc(u.name)}" style="opacity:${f.assignee && f.assignee !== u.id ? '.32' : '1'}">${avatar(u)}</button>`).join('')}
      </div>
      ${active ? `<button class="btn btn-ghost btn-sm" data-act="f-reset">${I.x} Filter zurücksetzen</button>` : ''}
    </div>`;

  root.innerHTML = toolbar + '<div id="board-root" class="board-root"></div>';

  const si = $('#board-search');
  if (si) {
    si.addEventListener('input', debounce(() => {
      S.filters.q = si.value;
      renderBoardBody();
      updateFilterReset();
    }, 160));
  }
  renderBoardBody();
}

function updateFilterReset() {
  const bar = $('.toolbar');
  if (!bar) return;
  const existing = bar.querySelector('[data-act="f-reset"]');
  if (filtersActive() && !existing) {
    const b = document.createElement('button');
    b.className = 'btn btn-ghost btn-sm';
    b.dataset.act = 'f-reset';
    b.innerHTML = `${I.x} Filter zurücksetzen`;
    bar.appendChild(b);
  } else if (!filtersActive() && existing) {
    existing.remove();
  }
}

function renderBoardBody() {
  const host = $('#board-root');
  const p = projectById(S.route.id);
  if (!host || !p) return;

  const prev = host.querySelector('#board-wrap, .content');
  const pos = prev ? { t: prev.scrollTop, l: prev.scrollLeft } : null;
  const tasks = filteredTasks(p.id);

  if (S.boardView === 'board') {
    const cols = projectColumns(p.id);
    if (!cols.length) {
      host.innerHTML = emptyState('Dieses Projekt hat noch keine Spalten',
        'Lege eine erste Spalte an, zum Beispiel „Zu erledigen".', 'Spalte anlegen', 'column-new');
      const btn = host.querySelector('[data-act="column-new"]');
      if (btn) btn.dataset.id = p.id;
      return;
    }
    const lanes = buildLanes(tasks);
    const byColumn = (list) => (c) => list.filter((t) => t.column_id === c.id).sort((a, b) => a.position - b.position);
    const allByColumn = byColumn(tasks);

    host.innerHTML = `<div class="board-wrap ${S.groupBy ? 'grouped' : ''}" id="board-wrap">
      <div class="board-head">
        ${cols.map((c) => columnHead(c, allByColumn(c), S.collapsed.has(c.id))).join('')}
        <button class="col-new" data-act="column-new" data-id="${esc(p.id)}" title="Spalte hinzufügen">${I.plus}</button>
      </div>
      <div class="board-lanes">
        ${lanes.length ? lanes.map((lane) => {
          const laneCols = byColumn(lane.tasks);
          return `<section class="lane">
            ${S.groupBy ? `<div class="lane-head">
              ${lane.meta ? avatar(lane.meta, 'sm') : `<span class="lane-dot"></span>`}
              <b>${esc(lane.label)}</b><span class="lane-count">${lane.tasks.length}</span>
            </div>` : ''}
            <div class="lane-cols">
              ${cols.map((c) => (S.collapsed.has(c.id)
                ? `<button class="col-drop is-collapsed" data-act="column-collapse" data-id="${esc(c.id)}" title="${esc(c.title)} ausklappen"></button>`
                : columnCards(c, lane.key, laneCols(c)))).join('')}
              <div class="col-spacer"></div>
            </div>
          </section>`;
        }).join('') : `<div class="lane"><div class="board-none">
            Keine Aufgabe passt zu den Filtern.
            <button class="link" data-act="f-reset">Filter zurücksetzen</button>
          </div></div>`}
      </div>
    </div>`;

    enableDrag();
    focusComposer();
  } else if (S.boardView === 'liste') {
    host.innerHTML = `<div class="content"><div class="page">${taskTable(tasks)}</div></div>`;
  } else if (S.boardView === 'timeline') {
    host.innerHTML = `<div class="content"><div class="page">${timeline(tasks)}</div></div>`;
  } else {
    host.innerHTML = `<div class="content"><div class="page">${calendarMonth(p.id)}</div></div>`;
  }

  const next = host.querySelector('#board-wrap, .content');
  if (pos && next) { next.scrollTop = pos.t; next.scrollLeft = pos.l; }
}

/* -------------------------------------------------------- Schnellerfassung */

function focusComposer() {
  const ta = $('#composer-input');
  if (!ta) return;
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveComposer(); }
    if (e.key === 'Escape') { e.preventDefault(); S.composer = null; renderBoardBody(); }
  });
  const keep = () => {
    S.composer.text = ta.value;
    S.composer.assignee = $('#composer-assignee').value;
    S.composer.priority = $('#composer-prio').value;
    S.composer.due = $('#composer-due').value;
  };
  ta.addEventListener('input', keep);
  ['#composer-assignee', '#composer-prio', '#composer-due'].forEach((sel) => {
    const el = $(sel);
    if (el) el.addEventListener('change', keep);
  });
  const wrap = $('#board-wrap');
  const drop = ta.closest('.col-drop');
  if (wrap && drop) {
    const r = drop.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    if (r.right > w.right) wrap.scrollLeft += r.right - w.right + 16;
    else if (r.left < w.left) wrap.scrollLeft -= w.left - r.left + 16;
  }
}

async function saveComposer() {
  const d = S.composer;
  if (!d) return;
  const title = ($('#composer-input')?.value || '').trim();
  if (!title) { S.composer = null; renderBoardBody(); return; }

  const p = projectById(S.route.id);
  const payload = {
    title,
    project_id: p.id,
    column_id: d.column,
    assignee_id: $('#composer-assignee').value || null,
    priority: $('#composer-prio').value || 'normal',
    due_date: $('#composer-due').value || null,
  };
  if (S.groupBy && d.lane) payload[S.groupBy] = d.lane;

  // Eingabefeld sofort leeren, damit man ohne Pause weitertippen kann
  S.composer = { ...d, text: '' };
  const ta = $('#composer-input');
  if (ta) { ta.value = ''; ta.disabled = true; }

  try {
    await api('/tasks', 'POST', payload);
    await refresh();
    renderBoardBody();
    renderSidebar();
  } catch (e) {
    toast(e.message, 'err');
    if (ta) { ta.disabled = false; ta.value = title; }
  }
}

function taskTable(tasks) {
  if (!tasks.length) return emptyState('Keine Aufgaben', 'Passe die Filter an oder lege eine neue Aufgabe an.');
  const sorted = tasks.slice().sort((a, b) => {
    const da = a.due_date || '9999', db = b.due_date || '9999';
    if (da !== db) return da < db ? -1 : 1;
    return (PRIO_RANK[a.priority] ?? 9) - (PRIO_RANK[b.priority] ?? 9);
  });
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th style="width:34px"></th><th>Aufgabe</th><th>Spalte</th><th>Zuständig</th><th>Fällig</th><th>Priorität</th><th>Labels</th><th class="tiny">Betrag</th></tr></thead>
    <tbody>${sorted.map((t) => {
      const c = byId(S.columns, t.column_id);
      const u = userById(t.assignee_id);
      const done = isDoneTask(t);
      const d = t.due_date ? daysUntil(t.due_date) : null;
      return `<tr class="clickable" data-act="task-open" data-task="${esc(t.id)}">
        <td><span class="prio ${esc(t.priority)}" style="display:block"></span></td>
        <td><div class="bold" style="${done ? 'color:var(--muted)' : ''}">${esc(t.title)}</div>
            ${t.property_id ? `<div class="tiny faint">${esc(propertyById(t.property_id)?.title || '')}</div>` : ''}</td>
        <td><span class="badge">${esc(c ? c.title : '—')}</span></td>
        <td>${u ? `<div class="row" style="gap:6px">${avatar(u, 'sm')}<span class="small trunc">${esc(u.name)}</span></div>` : '<span class="faint">—</span>'}</td>
        <td class="small ${!done && d !== null && d < 0 ? 'bold' : ''}" style="${!done && d !== null && d < 0 ? 'color:var(--red)' : ''}">${t.due_date ? esc(fmtDate(t.due_date, { day: '2-digit', month: '2-digit', year: '2-digit' })) : '—'}</td>
        <td class="small">${esc(PRIO_NAME[t.priority] || '')}</td>
        <td>${(t.labels || []).slice(0, 3).map((l) => `<span class="badge" style="background:${hexA(LABEL_COLOR[l] || '#999', 0.13)};color:${esc(LABEL_COLOR[l] || '#999')}">${esc(l)}</span>`).join(' ')}</td>
        <td class="small">${t.amount ? esc(EUR.format(t.amount)) : '—'}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ------------------------------------------------------------- Timeline */

function timeline(tasks) {
  const withDates = tasks.filter((t) => t.due_date || t.start_date);
  if (!withDates.length) return emptyState('Keine Termine hinterlegt', 'Trage bei Aufgaben Start- oder Fälligkeitsdaten ein.');

  const dates = [];
  withDates.forEach((t) => {
    if (t.start_date) dates.push(new Date(t.start_date + 'T12:00:00'));
    if (t.due_date) dates.push(new Date(t.due_date + 'T12:00:00'));
  });
  let min = new Date(Math.min(...dates));
  let max = new Date(Math.max(...dates));
  min = new Date(min.getFullYear(), min.getMonth(), 1);
  max = new Date(max.getFullYear(), max.getMonth() + 1, 0);
  const span = Math.max(1, (max - min) / 864e5);

  const ticks = [];
  const cur = new Date(min);
  while (cur <= max) {
    ticks.push({ left: ((cur - min) / 864e5 / span) * 100, label: cur.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }) });
    cur.setMonth(cur.getMonth() + 1);
  }

  const rows = withDates.slice().sort((a, b) => (a.start_date || a.due_date) < (b.start_date || b.due_date) ? -1 : 1);

  return `<div class="tl">
    <div class="tl-head"><div class="tl-name">Aufgabe</div><div class="tl-ticks">
      ${ticks.map((t) => `<div class="tl-tick" style="left:${t.left}%">${esc(t.label)}</div>`).join('')}
    </div></div>
    ${rows.map((t) => {
      const s = new Date((t.start_date || t.due_date) + 'T12:00:00');
      const e = new Date((t.due_date || t.start_date) + 'T12:00:00');
      const left = ((s - min) / 864e5 / span) * 100;
      const width = Math.max(2.2, ((e - s) / 864e5 / span) * 100);
      const u = userById(t.assignee_id);
      return `<div class="tl-row">
        <div class="tl-name" title="${esc(t.title)}">${esc(t.title)}</div>
        <div class="tl-track">
          <div class="tl-bar ${isDoneTask(t) ? 'done' : ''}" style="left:${left}%;width:${width}%" data-act="task-open" data-task="${esc(t.id)}">
            ${u ? esc(u.initials) + ' · ' : ''}${esc(fmtDate(t.due_date || t.start_date))}
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ------------------------------------------------------------- Kalender */

function calendarItems(projectId) {
  const items = [];
  S.events.forEach((e) => {
    if (projectId && e.project_id !== projectId) return;
    items.push({ date: e.date.slice(0, 10), title: e.title, kind: 'event', id: e.id, type: e.type, time: e.time });
  });
  S.tasks.forEach((t) => {
    if (!t.due_date) return;
    if (projectId && t.project_id !== projectId) return;
    items.push({ date: t.due_date.slice(0, 10), title: t.title, kind: 'task', id: t.id, done: isDoneTask(t) });
  });
  return items;
}

function calendarMonth(projectId) {
  const base = S.calMonth;
  const year = base.getFullYear(), month = base.getMonth();
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Montag = 0
  const start = new Date(year, month, 1 - startDow);
  const items = calendarItems(projectId);
  const today = todayISO();

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = items.filter((x) => x.date === iso);
    cells.push(`<div class="cal-cell ${d.getMonth() !== month ? 'out' : ''} ${iso === today ? 'today' : ''}" data-act="cal-day" data-date="${iso}">
      <div class="d">${d.getDate()}</div>
      ${day.slice(0, 4).map((x) => `<div class="cal-ev ${x.kind === 'task' ? 'task' : ''} ${x.kind === 'task' && !x.done && iso < today ? 'overdue' : ''}"
        data-act="${x.kind === 'task' ? 'task-open' : 'event-edit'}" data-task="${esc(x.id)}" data-id="${esc(x.id)}" title="${esc(x.title)}">
        ${x.time ? esc(x.time) + ' ' : ''}${esc(x.title)}</div>`).join('')}
      ${day.length > 4 ? `<div class="tiny faint" style="padding-left:4px">+${day.length - 4} weitere</div>` : ''}
    </div>`);
  }

  return `<div class="row" style="margin-bottom:14px">
      <button class="btn btn-soft btn-sm btn-icon" data-act="cal-prev">‹</button>
      <button class="btn btn-soft btn-sm btn-icon" data-act="cal-next">›</button>
      <div class="bold" style="font-size:16px;letter-spacing:-.02em">${base.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</div>
      <button class="btn btn-ghost btn-sm" data-act="cal-today">Heute</button>
      <div class="push tiny faint row" style="gap:12px">
        <span class="row" style="gap:5px"><i style="width:9px;height:9px;border-radius:2px;background:var(--brand)"></i>Termine</span>
        <span class="row" style="gap:5px"><i style="width:9px;height:9px;border-radius:2px;background:var(--blue)"></i>Fällige Aufgaben</span>
      </div>
    </div>
    <div class="cal"><div class="cal-grid">
      ${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells.join('')}
    </div></div>`;
}

/* ====================================================== Ansicht: Übersicht */

function viewDashboard(root) {
  if (!S.projects.length && !S.properties.length && !S.contacts.length) {
    return viewWelcome(root);
  }
  const openTasks = S.tasks.filter((t) => !isDoneTask(t));
  const overdue = openTasks.filter((t) => t.due_date && daysUntil(t.due_date) < 0);
  const dueWeek = openTasks.filter((t) => t.due_date && daysUntil(t.due_date) >= 0 && daysUntil(t.due_date) <= 7);
  const activeProjects = S.projects.filter((p) => !p.archived && p.status === 'aktiv');
  const portfolio = S.properties.reduce((s, p) => s + (Number(p.asking_price) || Number(p.purchase_price) || 0), 0);
  const rentSum = S.properties.reduce((s, p) => s + (Number(p.rent_cold) || 0), 0);

  // Verteilung Objekte nach Status
  const dealCounts = DEALS.map(([k, l, c]) => ({ k, l, c, n: S.properties.filter((p) => p.deal === k).length })).filter((d) => d.n);
  const totalObj = dealCounts.reduce((s, d) => s + d.n, 0);

  // Auslastung je Person
  const workload = S.users.map((u) => ({
    u,
    open: openTasks.filter((t) => t.assignee_id === u.id).length,
    late: overdue.filter((t) => t.assignee_id === u.id).length,
  }));
  const maxLoad = Math.max(1, ...workload.map((w) => w.open));

  // 14-Tage-Verlauf erledigter Aufgaben
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    days.push({ d, n: S.tasks.filter((t) => t.done_at && t.done_at.slice(0, 10) === d).length });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.n));

  const upcoming = calendarItems(null)
    .filter((x) => x.date >= todayISO())
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 6);

  root.innerHTML = `<div class="content"><div class="page">
    <div class="page-head">
      <h2>Moin ${esc(S.me.name.split(' ')[0])}</h2>
      <p>${overdue.length ? `<b style="color:var(--red)">${overdue.length} überfällige Aufgabe${overdue.length === 1 ? '' : 'n'}</b> · ` : ''}${dueWeek.length} fällig in den nächsten 7 Tagen</p>
    </div>

    <div class="stat-grid" style="margin-bottom:20px">
      <div class="stat"><div class="k">${I.board} Aktive Projekte</div><div class="v">${activeProjects.length}</div><div class="d">${S.projects.length} insgesamt</div></div>
      <div class="stat"><div class="k">${I.check} Offene Aufgaben</div><div class="v">${openTasks.length}</div><div class="d">${S.tasks.length - openTasks.length} erledigt</div></div>
      <div class="stat"><div class="k">${I.clock} Überfällig</div><div class="v" style="${overdue.length ? 'color:var(--red)' : ''}">${overdue.length}</div><div class="d">${dueWeek.length} diese Woche fällig</div></div>
      <div class="stat"><div class="k">${I.building} Portfoliowert</div><div class="v">${esc(money(portfolio))}</div><div class="d">${S.properties.length} Objekte · ${esc(money(rentSum))} Kaltmiete/Mon.</div></div>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:16px;align-items:start">
      <div class="card card-pad">
        <div class="row" style="margin-bottom:14px"><b>Projektfortschritt</b>
          <a class="push link small" data-act="go" data-route="projekte" href="#/projekte">Alle ansehen</a></div>
        ${activeProjects.length ? activeProjects.slice(0, 6).map((p) => {
          const pr = progressOf(p.id);
          const lead = userById(p.lead_id);
          return `<div class="row" style="padding:9px 0;cursor:pointer" data-act="go" data-route="board/${esc(p.id)}">
            <span class="nav-dot" style="background:${esc(p.color)}"></span>
            <div style="flex:1;min-width:0">
              <div class="row" style="gap:8px"><span class="trunc bold small">${esc(p.name)}</span>
                <span class="badge">${esc(PROJECT_TYPE_NAME[p.type] || p.type)}</span>
                ${p.due_date && daysUntil(p.due_date) < 0 ? '<span class="badge red">überfällig</span>' : ''}</div>
              <div class="bar" style="margin-top:6px"><i style="width:${pr.pct}%"></i></div>
            </div>
            <div style="width:52px;text-align:right" class="tiny faint">${pr.done}/${pr.total}</div>
            ${avatar(lead, 'sm')}
          </div>`;
        }).join('') : '<div class="faint small">Noch keine aktiven Projekte.</div>'}
      </div>

      <div class="card card-pad">
        <b>Portfolio nach Status</b>
        ${totalObj ? `<div class="row" style="gap:20px;margin-top:16px">
          ${donut(dealCounts.map((d) => ({ n: d.n, color: dealColor(d.k) })), totalObj)}
          <div class="donut-legend">
            ${dealCounts.map((d) => `<div><i style="background:${dealColor(d.k)}"></i><span>${esc(d.l)}</span><b class="push" style="margin-left:auto">${d.n}</b></div>`).join('')}
          </div>
        </div>` : `<div class="faint small" style="margin-top:14px">Noch keine Objekte erfasst.
          <button class="link" data-act="property-new" style="margin-left:4px">Erstes Objekt anlegen</button></div>`}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:16px;align-items:start">
      <div class="card card-pad">
        <b>Auslastung Team</b>
        <div style="margin-top:14px">
          ${workload.map((w) => `<div class="row" style="padding:7px 0">
            ${avatar(w.u, 'sm')}
            <div style="flex:1;min-width:0">
              <div class="row"><span class="small trunc">${esc(w.u.name)}</span>
                <span class="push tiny faint">${w.open} offen${w.late ? ` · <span style="color:var(--red)">${w.late} spät</span>` : ''}</span></div>
              <div class="bar" style="margin-top:5px;height:5px"><i style="width:${(w.open / maxLoad) * 100}%;background:${esc(w.u.color)}"></i></div>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <div class="card card-pad">
        <b>Erledigt · 14 Tage</b>
        <div class="spark" style="margin-top:16px">
          ${days.map((d) => `<i class="${d.n === maxDay && d.n > 0 ? 'hi' : ''}" style="height:${Math.max(4, (d.n / maxDay) * 100)}%" title="${esc(fmtDate(d.d))}: ${d.n}"></i>`).join('')}
        </div>
        <div class="row tiny faint" style="margin-top:8px"><span>${esc(fmtDate(days[0].d))}</span><span class="push">${esc(fmtDate(days[days.length - 1].d))}</span></div>
        <div class="small" style="margin-top:10px">Summe: <b>${days.reduce((s, d) => s + d.n, 0)}</b> Aufgaben</div>
      </div>

      <div class="card card-pad">
        <div class="row" style="margin-bottom:12px"><b>Nächste Termine</b>
          <a class="push link small" data-act="go" data-route="kalender" href="#/kalender">Kalender</a></div>
        ${upcoming.length ? upcoming.map((x) => `<div class="row" style="padding:7px 0;cursor:pointer" data-act="${x.kind === 'task' ? 'task-open' : 'event-edit'}" data-task="${esc(x.id)}" data-id="${esc(x.id)}">
          <div style="width:42px;text-align:center;flex:none">
            <div class="tiny faint" style="text-transform:uppercase">${esc(fmtDate(x.date, { month: 'short' }))}</div>
            <div class="bold" style="font-size:15px;line-height:1">${new Date(x.date + 'T12:00').getDate()}</div>
          </div>
          <div style="min-width:0;flex:1">
            <div class="small trunc">${esc(x.title)}</div>
            <div class="tiny faint">${x.kind === 'task' ? 'Aufgabe fällig' : esc(EVENT_TYPE_NAME[x.type] || 'Termin')}${x.time ? ' · ' + esc(x.time) : ''}</div>
          </div>
        </div>`).join('') : '<div class="faint small">Keine anstehenden Termine.</div>'}
      </div>
    </div>

    <div class="card card-pad" style="margin-top:16px">
      <div class="row" style="margin-bottom:8px"><b>Letzte Aktivität</b>
        <a class="push link small" data-act="go" data-route="aktivitaet" href="#/aktivitaet">Alles</a></div>
      ${activityList(S.activity.slice(0, 8))}
    </div>
  </div></div>`;
}

function viewWelcome(root) {
  const step = (icon, title, text, act) => `
    <button class="start-tile" data-act="${act}">
      <span class="start-icon">${icon}</span>
      <b>${esc(title)}</b>
      <span class="small muted">${esc(text)}</span>
      <span class="start-go">${I.plus} Anlegen</span>
    </button>`;

  root.innerHTML = `<div class="content"><div class="page" style="max-width:1000px">
    <div class="start-hero">
      ${LOGO(52)}
      <h2>Willkommen bei Mikdaten, ${esc(S.me.name.split(' ')[0])}.</h2>
      <p>Die Arbeitsumgebung ist leer und wartet auf eure echten Daten.
         Am schnellsten geht es so: erst die Objekte erfassen, dann Projekte darauf aufsetzen.</p>
    </div>

    <div class="start-grid">
      ${step(I.building, 'Objekt erfassen', 'Adresse, Fläche, Preise und Fotos — die Grundlage für alles Weitere.', 'property-new')}
      ${step(I.board, 'Projekt anlegen', 'Ankauf, Vermarktung, Sanierung oder Verwaltung — mit Board und Standardspalten.', 'project-new')}
      ${step(I.contact, 'Kontakt hinterlegen', 'Eigentümer, Käufer, Mieter, Notar, Handwerker und Banken.', 'contact-new')}
    </div>

    <div class="card card-pad" style="margin-top:22px">
      <b>Gut zu wissen</b>
      <div class="start-hints">
        <div><span class="kbd">⌘K</span> öffnet die Suche und alle Befehle.</div>
        <div><span class="kbd">n</span> legt jederzeit eine neue Aufgabe an.</div>
        <div>Aufgaben lassen sich per Drag &amp; Drop zwischen den Spalten ziehen.</div>
        <div>Objektfotos: einfach auf die Galerie ziehen — bis 12 MB pro Bild.</div>
        <div>Jede Person ändert ihr Passwort unter <b>Einstellungen</b>.</div>
        <div>Spalten, Namen und WIP-Limits sind pro Projekt frei konfigurierbar.</div>
      </div>
    </div>
  </div></div>`;
}

function dealColor(k) {
  return { ankauf: '#E08D00', bestand: '#2F6DF6', vermarktung: '#FF4E5B', verkauft: '#12855F', vermietet: '#7A4DDB' }[k] || '#9aa0ab';
}

function donut(parts, total) {
  const denom = total || 1;
  const R = 46, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = parts.map((p) => {
    const len = (p.n / denom) * C;
    const el = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${p.color}" stroke-width="15"
      stroke-dasharray="${len - 2.5} ${C - len + 2.5}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)" stroke-linecap="round"/>`;
    offset += len;
    return el;
  }).join('');
  return `<svg width="120" height="120" viewBox="0 0 120 120" style="flex:none">
    <circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--bg-2)" stroke-width="15"/>
    ${arcs}
    <text x="60" y="58" text-anchor="middle" font-size="24" font-weight="700" fill="currentColor" letter-spacing="-1">${total}</text>
    <text x="60" y="74" text-anchor="middle" font-size="10.5" fill="var(--faint)" font-weight="600">OBJEKTE</text>
  </svg>`;
}

function activityList(items) {
  if (!items.length) return '<div class="faint small">Noch keine Aktivität.</div>';
  return items.map((a) => {
    const u = userById(a.user_id);
    return `<div class="row" style="padding:8px 0;align-items:flex-start">
      ${avatar(u, 'sm')}
      <div style="flex:1;min-width:0">
        <div class="small">${esc(a.summary)}</div>
        <div class="tiny faint">${esc(u ? u.name : 'System')} · ${esc(fmtRelative(a.created_at))}</div>
      </div>
    </div>`;
  }).join('');
}

/* ================================================ Ansicht: Meine Aufgaben */

function viewMine(root) {
  const mine = S.tasks.filter((t) => t.assignee_id === S.me.id);
  const open = mine.filter((t) => !isDoneTask(t));
  const groups = [
    ['Überfällig', open.filter((t) => t.due_date && daysUntil(t.due_date) < 0), 'red'],
    ['Heute', open.filter((t) => t.due_date && daysUntil(t.due_date) === 0), 'amber'],
    ['Diese Woche', open.filter((t) => t.due_date && daysUntil(t.due_date) > 0 && daysUntil(t.due_date) <= 7), 'blue'],
    ['Später', open.filter((t) => t.due_date && daysUntil(t.due_date) > 7), ''],
    ['Ohne Datum', open.filter((t) => !t.due_date), ''],
  ];
  const doneRecent = mine.filter(isDoneTask).sort((a, b) => (b.done_at || '') > (a.done_at || '') ? 1 : -1).slice(0, 8);

  root.innerHTML = `<div class="content"><div class="page">
    <div class="page-head"><h2>Meine Aufgaben</h2><p>${open.length} offen · ${mine.length - open.length} erledigt</p></div>
    ${groups.filter((g) => g[1].length).map(([name, list, color]) => `
      <div class="section-title">${esc(name)} <span class="badge ${color}" style="margin-left:6px">${list.length}</span></div>
      <div class="card">
        ${list.sort((a, b) => (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1).map((t) => {
          const p = projectById(t.project_id);
          return `<div class="list-item" data-act="task-open" data-task="${esc(t.id)}">
            <span class="prio ${esc(t.priority)}"></span>
            <div style="flex:1;min-width:0">
              <div class="trunc" style="font-weight:550">${esc(t.title)}</div>
              <div class="tiny faint row" style="gap:6px">
                ${p ? `<span class="nav-dot" style="width:7px;height:7px;background:${esc(p.color)}"></span>${esc(p.name)}` : ''}
                ${t.property_id ? ' · ' + esc(propertyById(t.property_id)?.title || '') : ''}
              </div>
            </div>
            <div class="tcard-meta" style="margin:0">${dueBadge(t.due_date, false)}</div>
          </div>`;
        }).join('')}
      </div>`).join('') || emptyState('Nichts offen', 'Dir sind aktuell keine offenen Aufgaben zugewiesen.')}

    ${doneRecent.length ? `<div class="section-title">Zuletzt erledigt</div><div class="card">
      ${doneRecent.map((t) => `<div class="list-item" data-act="task-open" data-task="${esc(t.id)}">
        <span style="color:var(--green)">${I.check}</span>
        <div class="trunc" style="flex:1;color:var(--muted)">${esc(t.title)}</div>
        <div class="tiny faint">${esc(fmtRelative(t.done_at))}</div>
      </div>`).join('')}</div>` : ''}
  </div></div>`;
}

/* ===================================================== Ansicht: Projekte */

function viewProjects(root) {
  const list = S.projects;
  root.innerHTML = `<div class="content"><div class="page">
    <div class="page-head"><h2>Projekte</h2><p>${list.filter((p) => !p.archived).length} aktiv · ${list.filter((p) => p.archived).length} archiviert</p></div>
    ${list.length ? `<div class="obj-grid">${list.map((p) => {
      const pr = progressOf(p.id);
      const lead = userById(p.lead_id);
      const prop = propertyById(p.property_id);
      const mem = projectMembers(p.id);
      return `<div class="obj-card" data-act="go" data-route="board/${esc(p.id)}" style="${p.archived ? 'opacity:.6' : ''}">
        <div style="height:6px;background:linear-gradient(90deg,${esc(p.color)},${hexA(p.color, 0.4)})"></div>
        <div class="obj-body">
          <div class="row" style="margin-bottom:8px">
            <span class="badge" style="background:${hexA(p.color, 0.14)};color:${esc(p.color)}">${esc(PROJECT_TYPE_NAME[p.type] || p.type)}</span>
            ${p.status !== 'aktiv' ? `<span class="badge ${p.status === 'abgeschlossen' ? 'green' : 'amber'}">${esc(p.status)}</span>` : ''}
            <span class="push">${avatar(lead, 'sm')}</span>
          </div>
          <h4>${esc(p.name)}</h4>
          <div class="addr">${esc(p.description || (prop ? prop.title : '—'))}</div>
          <div class="row" style="margin-top:12px;gap:8px">
            <div class="bar" style="flex:1"><i style="width:${pr.pct}%"></i></div>
            <span class="tiny faint">${pr.pct}%</span>
          </div>
          <div class="row" style="margin-top:12px">
            <div class="avatar-stack">${mem.slice(0, 4).map((u) => avatar(u, 'sm')).join('')}</div>
            <div class="push tiny faint">${p.due_date ? 'bis ' + esc(fmtDate(p.due_date, { day: '2-digit', month: '2-digit', year: '2-digit' })) : ''}</div>
          </div>
          ${p.volume ? `<div class="obj-price">${esc(money(p.volume))}</div>` : ''}
        </div>
      </div>`;
    }).join('')}</div>` : emptyState('Noch keine Projekte', 'Lege dein erstes Projekt an — z. B. „Ankauf MFH Eppendorf".', 'Projekt anlegen', 'project-new')}
  </div></div>`;
}

/* ====================================================== Ansicht: Objekte */

function viewProperties(root) {
  root.innerHTML = `<div class="content"><div class="page">
    <div class="page-head"><h2>Objekte</h2><p>${S.properties.length} Objekte im Portfolio${S.filters.deal ? ` · Filter: ${esc((DEAL_MAP[S.filters.deal] || [])[1] || '')}` : ''}</p></div>
    <div class="row wrap" style="margin-bottom:18px;gap:8px">
      <div style="position:relative;max-width:280px;flex:1">
        <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--faint)">${I.search}</span>
        <input class="input" id="prop-search" placeholder="Objekt, Adresse, Nummer …" value="${esc(S.filters.q)}" style="padding-left:33px">
      </div>
      ${DEALS.map(([k, l]) => `<button class="chip ${S.filters.deal === k ? 'on' : ''}" data-act="prop-filter" data-deal="${k}">${esc(l)} <b>${S.properties.filter((p) => p.deal === k).length}</b></button>`).join('')}
    </div>
    <div id="prop-list"></div>
  </div></div>`;
  renderPropertyGrid();

  const s = $('#prop-search');
  if (s) s.addEventListener('input', debounce(() => { S.filters.q = s.value; renderPropertyGrid(); }, 160));
}

function filteredProperties() {
  const q = (S.filters.q || '').toLowerCase();
  return S.properties.filter((p) =>
    (!q || `${p.title} ${p.street || ''} ${p.city || ''} ${p.code}`.toLowerCase().includes(q))
    && (!S.filters.deal || p.deal === S.filters.deal));
}

function renderPropertyGrid() {
  const host = $('#prop-list');
  if (!host) return;
  const list = filteredProperties();
  host.innerHTML = list.length
    ? `<div class="obj-grid">${list.map(propertyCard).join('')}</div>`
    : emptyState('Keine Objekte gefunden', 'Lege ein Objekt an oder ändere die Suche.', 'Objekt anlegen', 'property-new');
}

function propertyCard(p) {
  const d = DEAL_MAP[p.deal] || ['', p.deal, ''];
  const price = p.deal === 'ankauf' ? p.purchase_price : (p.asking_price || p.purchase_price);
  const bg = p.image_url
    ? `background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.28)),url('${esc(p.image_url)}')`
    : '';
  return `<div class="obj-card" data-act="property-open" data-id="${esc(p.id)}">
    <div class="obj-photo" style="${bg}">
      <span class="badge ${d[2]} tag" style="background:${hexA(dealColor(p.deal), 0.9)};color:#fff">${esc(d[1])}</span>
      ${!p.image_url ? `<div style="position:absolute;inset:0;display:grid;place-items:center;color:var(--faint);opacity:.5">${I.building.replace('width="16" height="16"', 'width="42" height="42"')}</div>` : ''}
    </div>
    <div class="obj-body">
      <div class="row" style="gap:6px;margin-bottom:3px">
        <span class="mono faint tiny">${esc(p.code)}</span>
        <span class="badge">${esc(PROPERTY_TYPE_NAME[p.type] || p.type)}</span>
      </div>
      <h4 class="trunc">${esc(p.title)}</h4>
      <div class="addr trunc">${esc([p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—')}</div>
      <div class="obj-facts">
        ${p.area_sqm ? `<span>${I.ruler}${num(p.area_sqm)} m²</span>` : ''}
        ${p.rooms ? `<span>${I.bed}${num(p.rooms)} Zi.</span>` : ''}
        ${p.units > 1 ? `<span>${I.building}${p.units} Einh.</span>` : ''}
        ${p.year_built ? `<span class="faint">Bj. ${p.year_built}</span>` : ''}
      </div>
      <div class="obj-price">${esc(money(price))}${p.rent_cold ? `<span class="tiny faint" style="font-weight:500"> · ${esc(money(p.rent_cold))}/Mon.</span>` : ''}</div>
    </div>
  </div>`;
}

function viewProperty(root) {
  const p = propertyById(S.route.id);
  if (!p) { root.innerHTML = emptyState('Objekt nicht gefunden', ''); return; }
  const relTasks = S.tasks.filter((t) => t.property_id === p.id);
  const relContacts = S.contacts.filter((c) => c.property_id === p.id);
  const relProjects = S.projects.filter((x) => x.property_id === p.id);
  const relDocs = S.documents.filter((d) => d.property_id === p.id);
  const relEvents = S.events.filter((e) => e.property_id === p.id);
  const shots = propertyPhotos(p.id);
  const yieldPct = p.rent_cold && (p.purchase_price || p.asking_price)
    ? ((p.rent_cold * 12) / (p.purchase_price || p.asking_price) * 100) : null;

  const fact = (k, v) => `<div><div class="tiny faint">${esc(k)}</div><div class="bold" style="font-size:14.5px">${v}</div></div>`;

  root.innerHTML = `<div class="content"><div class="page">
    <button class="btn btn-ghost btn-sm" data-act="go" data-route="objekte" style="margin-bottom:12px">‹ Alle Objekte</button>
    <div class="card" style="overflow:hidden;margin-bottom:18px">
      <div class="obj-photo" style="height:190px;border-radius:0;${p.image_url ? `background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.3)),url('${esc(p.image_url)}')` : ''}">
        ${!p.image_url ? `<div style="position:absolute;inset:0;display:grid;place-items:center;color:var(--faint);opacity:.4">${I.building.replace('width="16" height="16"', 'width="58" height="58"')}</div>` : ''}
      </div>
      <div class="card-pad">
        <div class="row wrap" style="gap:10px">
          <div style="flex:1;min-width:200px">
            <div class="row" style="gap:7px;margin-bottom:4px">
              <span class="mono faint tiny">${esc(p.code)}</span>
              <span class="badge" style="background:${hexA(dealColor(p.deal), 0.14)};color:${dealColor(p.deal)}">${esc((DEAL_MAP[p.deal] || [])[1] || p.deal)}</span>
              <span class="badge">${esc(PROPERTY_TYPE_NAME[p.type] || p.type)}</span>
            </div>
            <h2 style="margin:0;font-size:23px;letter-spacing:-.03em;font-weight:660">${esc(p.title)}</h2>
            <div class="muted row" style="gap:5px;margin-top:3px">${I.pin}${esc([p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—')}</div>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn btn-brand btn-sm" data-act="photo-pick" data-id="${esc(p.id)}">${I.camera} Fotos</button>
            <button class="btn btn-soft btn-sm" data-act="property-edit" data-id="${esc(p.id)}">${I.edit} Bearbeiten</button>
            <button class="btn btn-soft btn-sm" data-act="doc-new" data-property="${esc(p.id)}">${I.doc} Dokument</button>
          </div>
        </div>
        <div class="sep"></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px">
          ${fact('Wohnfläche', p.area_sqm ? num(p.area_sqm) + ' m²' : '—')}
          ${fact('Zimmer', num(p.rooms))}
          ${fact('Einheiten', num(p.units))}
          ${fact('Grundstück', p.plot_sqm ? num(p.plot_sqm) + ' m²' : '—')}
          ${fact('Baujahr', p.year_built || '—')}
          ${fact('Energie', p.energy_class || '—')}
          ${fact('Kaufpreis', money(p.purchase_price))}
          ${fact('Angebotspreis', money(p.asking_price))}
          ${fact('Kaltmiete', p.rent_cold ? money(p.rent_cold) + '/Mon.' : '—')}
          ${fact('Bruttorendite', yieldPct ? yieldPct.toFixed(2).replace('.', ',') + ' %' : '—')}
        </div>
        ${p.notes ? `<div class="sep"></div><div class="small" style="white-space:pre-wrap">${esc(p.notes)}</div>` : ''}
      </div>
    </div>

    <div class="section-title">Fotos (${shots.length})</div>
    <div class="photo-grid" id="photo-drop" data-property="${esc(p.id)}">
      ${shots.map((s) => `<figure class="photo" data-act="photo-open" data-id="${esc(s.id)}">
        <img src="/media/${esc(s.key)}" alt="${esc(s.filename || 'Foto')}" loading="lazy">
        ${s.is_cover ? '<span class="photo-cover">Titelbild</span>' : ''}
        <div class="photo-tools">
          ${s.is_cover ? '' : `<button title="Als Titelbild" data-act="photo-cover" data-id="${esc(s.id)}">${I.star}</button>`}
          <button title="Löschen" data-act="photo-delete" data-id="${esc(s.id)}">${I.trash}</button>
        </div>
      </figure>`).join('')}
      <button class="photo-add" data-act="photo-pick" data-id="${esc(p.id)}">
        ${I.camera}<span id="photo-drop-label">Fotos hinzufügen</span>
        <em class="tiny faint">oder hierher ziehen · JPG, PNG, WebP · max. 12 MB</em>
      </button>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:16px;align-items:start;margin-top:22px">
      <div>
        <div class="section-title">Aufgaben (${relTasks.length})</div>
        <div class="card">${relTasks.length ? relTasks.map((t) => `
          <div class="list-item" data-act="task-open" data-task="${esc(t.id)}">
            <span class="prio ${esc(t.priority)}"></span>
            <div class="trunc" style="flex:1;${isDoneTask(t) ? 'color:var(--muted);' : ''}">${esc(t.title)}</div>
            ${avatar(userById(t.assignee_id), 'sm')}
            <div class="tiny faint" style="width:64px;text-align:right">${t.due_date ? esc(fmtDate(t.due_date)) : ''}</div>
          </div>`).join('') : '<div class="card-pad faint small">Keine Aufgaben verknüpft.</div>'}</div>

        <div class="section-title">Projekte (${relProjects.length})</div>
        <div class="card">${relProjects.length ? relProjects.map((x) => `
          <div class="list-item" data-act="go" data-route="board/${esc(x.id)}">
            <span class="nav-dot" style="background:${esc(x.color)}"></span>
            <div class="trunc" style="flex:1">${esc(x.name)}</div>
            <div class="bar" style="width:70px"><i style="width:${progressOf(x.id).pct}%"></i></div>
          </div>`).join('') : '<div class="card-pad faint small">Keine Projekte verknüpft.</div>'}</div>
      </div>
      <div>
        <div class="section-title">Kontakte (${relContacts.length})</div>
        <div class="card">${relContacts.length ? relContacts.map((c) => `
          <div class="list-item" data-act="contact-edit" data-id="${esc(c.id)}">
            <div class="avatar sm" style="background:#8a8f98">${esc(c.name.slice(0, 2).toUpperCase())}</div>
            <div style="flex:1;min-width:0"><div class="trunc small bold">${esc(c.name)}</div>
              <div class="tiny faint">${esc(CONTACT_ROLE_NAME[c.role] || c.role)}</div></div>
          </div>`).join('') : '<div class="card-pad faint small">Keine Kontakte verknüpft.</div>'}</div>

        <div class="section-title">Termine (${relEvents.length})</div>
        <div class="card">${relEvents.length ? relEvents.map((e) => `
          <div class="list-item" data-act="event-edit" data-id="${esc(e.id)}">
            <div style="flex:1;min-width:0"><div class="trunc small bold">${esc(e.title)}</div>
              <div class="tiny faint">${esc(fmtDateLong(e.date))}${e.time ? ' · ' + esc(e.time) : ''}</div></div>
          </div>`).join('') : '<div class="card-pad faint small">Keine Termine.</div>'}</div>

        <div class="section-title">Dokumente (${relDocs.length})</div>
        <div class="card">${relDocs.length ? relDocs.map((d) => `
          <div class="list-item"><span class="faint">${I.doc}</span>
            <a class="trunc small" style="flex:1" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a>
            <button class="btn btn-ghost btn-sm btn-icon" data-act="doc-delete" data-id="${esc(d.id)}">${I.trash}</button>
          </div>`).join('') : '<div class="card-pad faint small">Keine Dokumente hinterlegt.</div>'}</div>
      </div>
    </div>
  </div></div>`;

  wirePhotoDrop(p.id);
}

/* Dateien direkt auf die Galerie ziehen */
function wirePhotoDrop(propertyId) {
  const zone = $('#photo-drop');
  if (!zone) return;
  let depth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  zone.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    zone.classList.add('drop-over');
  });
  zone.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  zone.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) zone.classList.remove('drop-over');
  });
  zone.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    zone.classList.remove('drop-over');
    uploadPhotos(propertyId, e.dataTransfer.files);
  });
}

/* Vollbildanzeige */
function photoLightbox(id) {
  const photo = byId(S.photos, id);
  if (!photo) return '';
  const siblings = propertyPhotos(photo.property_id);
  const idx = siblings.findIndex((s) => s.id === id);
  const property = propertyById(photo.property_id);
  return `<div class="scrim" data-act="close-layer"></div>
  <div class="lightbox">
    <div class="lightbox-bar">
      <div style="min-width:0">
        <div class="bold trunc">${esc(photo.filename || 'Foto')}</div>
        <div class="tiny" style="opacity:.72">${esc(property ? property.title : '')} · ${idx + 1} von ${siblings.length}${photo.size ? ' · ' + NUM.format(Math.round(photo.size / 1024)) + ' kB' : ''}</div>
      </div>
      <div class="row" style="gap:6px;margin-left:auto">
        ${photo.is_cover ? '<span class="badge green dot">Titelbild</span>'
          : `<button class="btn btn-ghost btn-sm" data-act="photo-cover" data-id="${esc(photo.id)}">${I.star} Als Titelbild</button>`}
        <button class="btn btn-ghost btn-sm btn-icon" data-act="photo-delete" data-id="${esc(photo.id)}">${I.trash}</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-act="close-layer">${I.x}</button>
      </div>
    </div>
    <div class="lightbox-stage">
      ${siblings.length > 1 ? `<button class="lightbox-nav" data-act="photo-open" data-id="${esc(siblings[(idx - 1 + siblings.length) % siblings.length].id)}">‹</button>` : '<span></span>'}
      <img src="/media/${esc(photo.key)}" alt="${esc(photo.filename || 'Foto')}">
      ${siblings.length > 1 ? `<button class="lightbox-nav" data-act="photo-open" data-id="${esc(siblings[(idx + 1) % siblings.length].id)}">›</button>` : '<span></span>'}
    </div>
  </div>`;
}

/* ===================================================== Ansicht: Kontakte */

function viewContacts(root) {
  root.innerHTML = `<div class="content"><div class="page">
    <div class="page-head"><h2>Kontakte</h2><p>${S.contacts.length} Kontakte</p></div>
    <div style="position:relative;max-width:300px;margin-bottom:18px">
      <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--faint)">${I.search}</span>
      <input class="input" id="con-search" placeholder="Name, Firma, E-Mail …" value="${esc(S.filters.q)}" style="padding-left:33px">
    </div>
    <div id="contact-list"></div>
  </div></div>`;
  renderContactList();

  const s = $('#con-search');
  if (s) s.addEventListener('input', debounce(() => { S.filters.q = s.value; renderContactList(); }, 160));
}

function renderContactList() {
  const host = $('#contact-list');
  if (!host) return;
  const q = (S.filters.q || '').toLowerCase();
  const list = S.contacts.filter((c) => !q || `${c.name} ${c.company || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase().includes(q));
  const groups = CONTACT_ROLES.map(([k, l]) => [l, list.filter((c) => c.role === k)]).filter((g) => g[1].length);

  host.innerHTML = groups.length ? groups.map(([label, items]) => `
    <div class="section-title">${esc(label)} <span class="badge" style="margin-left:6px">${items.length}</span></div>
    <div class="card">${items.map((c) => `
      <div class="list-item" data-act="contact-edit" data-id="${esc(c.id)}">
        <div class="avatar" style="background:#8a8f98">${esc(c.name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase())}</div>
        <div style="flex:1;min-width:0">
          <div class="trunc bold small">${esc(c.name)}</div>
          <div class="trunc tiny faint">${esc([c.company, c.property_id ? propertyById(c.property_id)?.title : ''].filter(Boolean).join(' · ') || '—')}</div>
        </div>
        <div class="small muted trunc" style="width:180px">${c.email ? `<a class="link" href="mailto:${esc(c.email)}" onclick="event.stopPropagation()">${esc(c.email)}</a>` : ''}</div>
        <div class="small muted" style="width:140px">${c.phone ? `<a class="link" href="tel:${esc(c.phone.replace(/\s/g, ''))}" onclick="event.stopPropagation()">${esc(c.phone)}</a>` : ''}</div>
      </div>`).join('')}</div>`).join('')
    : emptyState('Keine Kontakte', 'Lege Eigentümer, Käufer, Handwerker und Notare an.', 'Kontakt anlegen', 'contact-new');
}

/* ===================================================== Ansicht: Kalender */

function viewCalendar(root) {
  root.innerHTML = `<div class="content"><div class="page">
    <div class="page-head"><h2>Kalender</h2><p>Termine und fällige Aufgaben aus allen Projekten</p></div>
    ${calendarMonth(null)}
  </div></div>`;
}

/* ========================================================= Ansicht: Team */

function viewTeam(root) {
  root.innerHTML = `<div class="content"><div class="page">
    <div class="page-head"><h2>Team</h2><p>${S.users.length} Personen</p></div>
    <div class="obj-grid">${S.users.map((u) => {
      const open = S.tasks.filter((t) => t.assignee_id === u.id && !isDoneTask(t));
      const done = S.tasks.filter((t) => t.assignee_id === u.id && isDoneTask(t));
      const late = open.filter((t) => t.due_date && daysUntil(t.due_date) < 0);
      const leads = S.projects.filter((p) => p.lead_id === u.id && !p.archived);
      return `<div class="card card-pad">
        <div class="row" style="gap:12px">
          ${avatar(u, 'xl')}
          <div style="min-width:0">
            <div class="bold" style="font-size:16px;letter-spacing:-.02em">${esc(u.name)}</div>
            <div class="small muted">${esc(u.job_title || 'Team')}</div>
            <div class="tiny faint trunc">${esc(u.email)}</div>
          </div>
        </div>
        <div class="sep"></div>
        <div class="row" style="gap:18px">
          <div><div class="tiny faint">Offen</div><div class="bold" style="font-size:19px">${open.length}</div></div>
          <div><div class="tiny faint">Überfällig</div><div class="bold" style="font-size:19px;${late.length ? 'color:var(--red)' : ''}">${late.length}</div></div>
          <div><div class="tiny faint">Erledigt</div><div class="bold" style="font-size:19px">${done.length}</div></div>
        </div>
        ${leads.length ? `<div class="sep"></div><div class="tiny faint" style="margin-bottom:6px">Projektleitung</div>
          <div class="row wrap" style="gap:5px">${leads.map((p) => `<span class="badge" style="background:${hexA(p.color, 0.13)};color:${esc(p.color)}">${esc(p.name)}</span>`).join('')}</div>` : ''}
        ${u.phone ? `<div class="sep"></div><a class="link small" href="tel:${esc(u.phone.replace(/\s/g, ''))}">${esc(u.phone)}</a>` : ''}
      </div>`;
    }).join('')}</div>
  </div></div>`;
}

/* ==================================================== Ansicht: Aktivität */

function viewActivity(root) {
  root.innerHTML = `<div class="content"><div class="page" style="max-width:760px">
    <div class="page-head"><h2>Aktivität</h2><p>Was zuletzt im Team passiert ist</p></div>
    <div class="card card-pad">${activityList(S.activity)}</div>
  </div></div>`;
}

/* ================================================= Ansicht: Einstellungen */

function viewSettings(root) {
  const u = S.me;
  root.innerHTML = `<div class="content"><div class="page" style="max-width:660px">
    <div class="page-head"><h2>Einstellungen</h2><p>Dein Profil und die Darstellung</p></div>

    <div class="card card-pad" style="margin-bottom:16px">
      <div class="row" style="gap:14px;margin-bottom:18px">
        ${avatar(u, 'xl')}
        <div><div class="bold" style="font-size:17px">${esc(u.name)}</div><div class="muted small">${esc(u.email)}</div></div>
      </div>
      <form id="profile-form">
        <div class="grid-2">
          <div class="field"><label>Name</label><input class="input" name="name" value="${esc(u.name)}" required></div>
          <div class="field"><label>Position</label><input class="input" name="job_title" value="${esc(u.job_title || '')}" placeholder="z. B. Geschäftsführung"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>Telefon</label><input class="input" name="phone" value="${esc(u.phone || '')}" placeholder="+49 …"></div>
          <div class="field"><label>Profilfarbe</label>
            <div class="swatches" style="padding-top:5px">
              ${COLORS.map((c) => `<button type="button" class="swatch ${u.color.toLowerCase() === c.toLowerCase() ? 'on' : ''}" style="background:${c}" data-act="pick-color" data-color="${c}"></button>`).join('')}
            </div>
            <input type="hidden" name="color" id="color-input" value="${esc(u.color)}">
          </div>
        </div>
        <button class="btn btn-primary" type="submit">Profil speichern</button>
      </form>
    </div>

    <div class="card card-pad" style="margin-bottom:16px">
      <b>Passwort ändern</b>
      <p class="small muted" style="margin:4px 0 14px">Nach dem Ändern wirst du neu angemeldet.</p>
      <form id="password-form">
        <div class="field"><label>Aktuelles Passwort</label><input class="input" type="password" name="current" autocomplete="current-password" required></div>
        <div class="grid-2">
          <div class="field"><label>Neues Passwort</label><input class="input" type="password" name="next" autocomplete="new-password" minlength="10" required></div>
          <div class="field"><label>Wiederholen</label><input class="input" type="password" name="repeat" autocomplete="new-password" minlength="10" required></div>
        </div>
        <button class="btn btn-soft" type="submit">Passwort ändern</button>
      </form>
    </div>

    <div class="card card-pad">
      <b>Darstellung</b>
      <div class="row" style="margin-top:12px;gap:8px">
        <button class="chip ${document.documentElement.dataset.theme !== 'dark' ? 'on' : ''}" data-act="theme-set" data-theme="light">${I.sun} Hell</button>
        <button class="chip ${document.documentElement.dataset.theme === 'dark' ? 'on' : ''}" data-act="theme-set" data-theme="dark">${I.moon} Dunkel</button>
      </div>
      <div class="sep"></div>
      <div class="tiny faint">Mikdaten · interne Projektsteuerung · läuft auf Cloudflare Workers + D1</div>
    </div>
  </div></div>`;

  $('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    await guard(async () => {
      const r = await api('/account', 'PATCH', fd);
      S.me = r.user;
      await refresh();
      render();
    }, 'Profil gespeichert.');
  });

  $('#password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if (fd.next !== fd.repeat) return toast('Die Passwörter stimmen nicht überein.', 'err');
    await guard(async () => {
      await api('/account/password', 'POST', { current: fd.current, next: fd.next });
      toast('Passwort geändert. Bitte neu anmelden.');
      setTimeout(() => location.reload(), 900);
    });
  });
}

/* ------------------------------------------------------------ Leerzustand */

function emptyState(title, text, btnLabel, btnAct) {
  return `<div class="empty">
    <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8.5 13h7M8.5 16.5h4"/></svg>
    <h3>${esc(title)}</h3><p>${esc(text)}</p>
    ${btnLabel ? `<button class="btn btn-brand" data-act="${esc(btnAct)}">${I.plus} ${esc(btnLabel)}</button>` : ''}
  </div>`;
}

/* ================================================== Aufgaben-Detailansicht */

function openTask(id) {
  S.drawerTask = id;
  renderLayer();
}

function taskDrawer(t) {
  const project = projectById(t.project_id);
  const cols = projectColumns(t.project_id);
  const cl = S.checklist.filter((c) => c.task_id === t.id).sort((a, b) => a.position - b.position);
  const clDone = cl.filter((c) => c.done).length;
  const comments = S.comments.filter((c) => c.task_id === t.id);
  const docs = S.documents.filter((d) => d.task_id === t.id);
  const creator = userById(t.created_by);

  const opt = (list, val) => list.map(([k, l]) => `<option value="${esc(k)}" ${val === k ? 'selected' : ''}>${esc(l)}</option>`).join('');

  return `<div class="scrim" data-act="close-layer"></div>
  <aside class="drawer" role="dialog" aria-label="Aufgabe">
    <div class="drawer-head">
      <span class="nav-dot" style="background:${esc(project ? project.color : '#999')}"></span>
      <div class="small muted trunc" style="flex:1">${esc(project ? project.name : '')}</div>
      <div class="dropdown">
        <button class="btn btn-ghost btn-icon btn-sm" data-act="menu" data-menu="task">${I.dots}</button>
        ${S.menuOpen === 'task' ? `<div class="menu">
          <button data-act="task-duplicate" data-task="${esc(t.id)}">${I.doc} Duplizieren</button>
          <button data-act="doc-new" data-task="${esc(t.id)}">${I.doc} Dokument verknüpfen</button>
          <div class="sepm"></div>
          <button class="danger" data-act="task-delete" data-task="${esc(t.id)}">${I.trash} Aufgabe löschen</button>
        </div>` : ''}
      </div>
      <button class="btn btn-ghost btn-icon btn-sm" data-act="close-layer">${I.x}</button>
    </div>

    <div class="drawer-body">
      <textarea class="textarea" id="t-title" rows="1" style="font-size:19px;font-weight:640;letter-spacing:-.025em;border-color:transparent;padding:6px 8px;min-height:0;background:transparent">${esc(t.title)}</textarea>

      <div class="grid-2" style="margin-top:12px">
        <div class="field"><label>Status / Spalte</label>
          <select class="select" data-task-field="column_id">${cols.map((c) => `<option value="${esc(c.id)}" ${t.column_id === c.id ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select></div>
        <div class="field"><label>Zuständig</label>
          <select class="select" data-task-field="assignee_id">
            <option value="">Niemand</option>
            ${S.users.map((u) => `<option value="${esc(u.id)}" ${t.assignee_id === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
          </select></div>
      </div>
      <div class="grid-3">
        <div class="field"><label>Priorität</label><select class="select" data-task-field="priority">${opt(PRIOS.map((p) => [p[0], p[1]]), t.priority)}</select></div>
        <div class="field"><label>Start</label><input class="input" type="date" data-task-field="start_date" value="${esc(t.start_date || '')}"></div>
        <div class="field"><label>Fällig</label><input class="input" type="date" data-task-field="due_date" value="${esc(t.due_date || '')}"></div>
      </div>
      <div class="grid-3">
        <div class="field"><label>Aufwand (Std.)</label><input class="input" type="number" step="0.5" min="0" data-task-field="estimate" value="${esc(t.estimate ?? '')}"></div>
        <div class="field"><label>Betrag (€)</label><input class="input" type="number" step="100" data-task-field="amount" value="${esc(t.amount ?? '')}"></div>
        <div class="field"><label>Objekt</label>
          <select class="select" data-task-field="property_id">
            <option value="">—</option>
            ${S.properties.map((p) => `<option value="${esc(p.id)}" ${t.property_id === p.id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}
          </select></div>
      </div>
      <div class="field"><label>Kontakt</label>
        <select class="select" data-task-field="contact_id">
          <option value="">—</option>
          ${S.contacts.map((c) => `<option value="${esc(c.id)}" ${t.contact_id === c.id ? 'selected' : ''}>${esc(c.name)}${c.company ? ' · ' + esc(c.company) : ''}</option>`).join('')}
        </select></div>

      <div class="section-title">Labels</div>
      <div class="row wrap" style="gap:6px">
        ${LABELS.map(([name, color]) => {
          const on = (t.labels || []).includes(name);
          return `<button class="chip" data-act="task-label" data-task="${esc(t.id)}" data-label="${esc(name)}"
            style="${on ? `background:${color};border-color:${color};color:#fff` : ''}">${esc(name)}</button>`;
        }).join('')}
      </div>

      <div class="section-title">Beschreibung</div>
      <textarea class="textarea" id="t-desc" placeholder="Details, Absprachen, Links …">${esc(t.description || '')}</textarea>

      <div class="section-title">Checkliste ${cl.length ? `<span class="badge ${clDone === cl.length ? 'green' : ''}" style="margin-left:6px">${clDone}/${cl.length}</span>` : ''}</div>
      ${cl.length ? `<div class="bar green" style="margin-bottom:10px"><i style="width:${(clDone / cl.length) * 100}%"></i></div>` : ''}
      ${cl.map((c) => `<div class="check ${c.done ? 'done' : ''}">
        <input type="checkbox" ${c.done ? 'checked' : ''} data-act="check-toggle" data-id="${esc(c.id)}">
        <span>${esc(c.text)}</span>
        <button class="btn btn-ghost btn-sm btn-icon" data-act="check-delete" data-id="${esc(c.id)}">${I.trash}</button>
      </div>`).join('')}
      <form id="check-form" class="row" style="margin-top:8px;gap:6px">
        <input class="input" name="text" placeholder="Punkt hinzufügen …" style="height:34px">
        <button class="btn btn-soft btn-sm" type="submit">${I.plus}</button>
      </form>

      ${docs.length ? `<div class="section-title">Dokumente</div>
        ${docs.map((d) => `<div class="row" style="padding:6px 0"><span class="faint">${I.doc}</span>
          <a class="link small trunc" style="flex:1" href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.title)}</a>
          <button class="btn btn-ghost btn-sm btn-icon" data-act="doc-delete" data-id="${esc(d.id)}">${I.trash}</button></div>`).join('')}` : ''}

      <div class="section-title">Kommentare (${comments.length})</div>
      <form id="comment-form" class="row" style="gap:8px;align-items:flex-start">
        ${avatar(S.me, 'sm')}
        <textarea class="textarea" name="body" rows="2" placeholder="Kommentar schreiben … (Strg + Eingabe zum Senden)" style="min-height:60px"></textarea>
      </form>
      <div class="row" style="justify-content:flex-end;margin-top:6px">
        <button class="btn btn-primary btn-sm" data-act="comment-submit">Kommentieren</button>
      </div>
      ${comments.map((c) => {
        const u = userById(c.user_id);
        return `<div class="comment">${avatar(u, 'sm')}
          <div class="comment-body">
            <div class="h"><b>${esc(u ? u.name : '?')}</b><span class="tiny faint">${esc(fmtRelative(c.created_at))}</span>
              ${c.user_id === S.me.id ? `<button class="btn btn-ghost btn-sm btn-icon push" data-act="comment-delete" data-id="${esc(c.id)}" style="margin-left:auto">${I.trash}</button>` : ''}</div>
            <p>${esc(c.body)}</p>
          </div></div>`;
      }).join('')}

      <div class="sep"></div>
      <div class="tiny faint">Erstellt von ${esc(creator ? creator.name : 'unbekannt')} · ${esc(fmtDateLong(t.created_at))}${t.done_at ? ` · erledigt ${esc(fmtDateLong(t.done_at))}` : ''}</div>
    </div>

    <div class="drawer-foot">
      ${isDoneTask(t) ? '<span class="badge green dot">Erledigt</span>' : `<button class="btn btn-primary" data-act="task-complete" data-task="${esc(t.id)}">${I.check} Als erledigt markieren</button>`}
      <button class="btn btn-ghost" data-act="close-layer">Schließen</button>
      <span class="push save-state" id="save-state">Änderungen werden automatisch gespeichert</span>
    </div>
  </aside>`;
}

/* ------------------------------------------------------- Generische Modale */

let modalConfig = null;

function openModal(cfg) {
  modalConfig = cfg;
  renderLayer();
}

function modalHtml(cfg) {
  const f = (fld) => {
    const v = fld.value ?? '';
    const common = `name="${esc(fld.name)}" ${fld.required ? 'required' : ''} ${fld.placeholder ? `placeholder="${esc(fld.placeholder)}"` : ''}`;
    let input;
    if (fld.type === 'textarea') input = `<textarea class="textarea" ${common} rows="${fld.rows || 3}">${esc(v)}</textarea>`;
    else if (fld.type === 'select') {
      input = `<select class="select" ${common}>${(fld.options || []).map(([k, l]) => `<option value="${esc(k)}" ${String(v) === String(k) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    } else if (fld.type === 'color') {
      input = `<div class="swatches">${COLORS.map((c) => `<button type="button" class="swatch ${String(v).toLowerCase() === c.toLowerCase() ? 'on' : ''}" style="background:${c}" data-act="modal-color" data-color="${c}"></button>`).join('')}</div>
        <input type="hidden" name="${esc(fld.name)}" value="${esc(v)}" id="modal-color">`;
    } else if (fld.type === 'members') {
      input = `<div class="row wrap" style="gap:6px">${S.users.map((u) => {
        const on = (fld.value || []).includes(u.id);
        return `<button type="button" class="chip ${on ? 'on' : ''}" data-act="modal-member" data-id="${esc(u.id)}">${avatar(u, 'sm')} ${esc(u.name.split(' ')[0])}</button>`;
      }).join('')}</div><input type="hidden" name="${esc(fld.name)}" value="${esc((fld.value || []).join(','))}" id="modal-members">`;
    } else {
      input = `<input class="input" type="${fld.type || 'text'}" ${common} value="${esc(v)}" ${fld.step ? `step="${fld.step}"` : ''}>`;
    }
    return `<div class="field" style="${fld.span ? 'grid-column:1/-1' : ''}"><label>${esc(fld.label)}</label>${input}</div>`;
  };

  return `<div class="scrim" data-act="close-layer"></div>
  <div class="modal-wrap"><div class="modal" role="dialog">
    <div class="modal-head"><h3>${esc(cfg.title)}</h3>
      <button class="btn btn-ghost btn-icon btn-sm push" data-act="close-layer" style="margin-left:auto">${I.x}</button></div>
    <form id="modal-form"><div class="modal-body">
      ${cfg.intro ? `<p class="small muted" style="margin:0 0 14px">${esc(cfg.intro)}</p>` : ''}
      <div class="grid-2">${cfg.fields.map(f).join('')}</div>
    </div>
    <div class="modal-foot">
      ${cfg.onDelete ? `<button type="button" class="btn btn-danger" data-act="modal-delete" style="margin-right:auto">${I.trash} Löschen</button>` : ''}
      <button type="button" class="btn btn-ghost" data-act="close-layer">Abbrechen</button>
      <button type="submit" class="btn btn-brand">${esc(cfg.submitLabel || 'Speichern')}</button>
    </div></form>
  </div></div>`;
}

/* ------------------------------------------------------- Befehlspalette */

let paletteOpen = false;
let paletteIndex = 0;
let paletteQuery = '';

function paletteEntries() {
  const out = [];
  out.push({ icon: I.plus, t: 'Neue Aufgabe', k: 'Aktion', run: () => actNewTask() });
  out.push({ icon: I.plus, t: 'Neues Projekt', k: 'Aktion', run: () => actProjectModal() });
  out.push({ icon: I.plus, t: 'Neues Objekt', k: 'Aktion', run: () => actPropertyModal() });
  out.push({ icon: I.plus, t: 'Neuer Kontakt', k: 'Aktion', run: () => actContactModal() });
  out.push({ icon: I.plus, t: 'Neuer Termin', k: 'Aktion', run: () => actEventModal() });
  out.push({ icon: I.grid, t: 'Übersicht', k: 'Navigation', run: () => go('dashboard') });
  out.push({ icon: I.inbox, t: 'Meine Aufgaben', k: 'Navigation', run: () => go('meine') });
  out.push({ icon: I.calendar, t: 'Kalender', k: 'Navigation', run: () => go('kalender') });
  out.push({ icon: I.building, t: 'Objekte', k: 'Navigation', run: () => go('objekte') });
  out.push({ icon: I.contact, t: 'Kontakte', k: 'Navigation', run: () => go('kontakte') });
  out.push({ icon: I.users, t: 'Team', k: 'Navigation', run: () => go('team') });
  out.push({ icon: I.settings, t: 'Einstellungen', k: 'Navigation', run: () => go('einstellungen') });
  S.projects.forEach((p) => out.push({ icon: `<span class="nav-dot" style="background:${esc(p.color)}"></span>`, t: p.name, k: 'Projekt', run: () => go('board/' + p.id) }));
  S.tasks.forEach((t) => out.push({ icon: `<span class="prio ${esc(t.priority)}"></span>`, t: t.title, k: 'Aufgabe', run: () => openTask(t.id) }));
  S.properties.forEach((p) => out.push({ icon: I.building, t: p.title, k: 'Objekt', run: () => go('objekt/' + p.id) }));
  S.contacts.forEach((c) => out.push({ icon: I.contact, t: c.name, k: 'Kontakt', run: () => actContactModal(c.id) }));
  return out;
}

function paletteHtml() {
  const q = paletteQuery.trim().toLowerCase();
  const all = paletteEntries();
  const list = (q ? all.filter((e) => e.t.toLowerCase().includes(q) || e.k.toLowerCase().includes(q)) : all).slice(0, 40);
  paletteIndex = Math.min(paletteIndex, Math.max(0, list.length - 1));
  window.__palette = list;
  return `<div class="scrim" data-act="close-palette"></div>
  <div class="palette-wrap"><div class="palette">
    <input id="palette-input" placeholder="Suchen oder Befehl ausführen …" value="${esc(paletteQuery)}" autocomplete="off">
    <div class="palette-list">
      ${list.length ? list.map((e, i) => `<button class="palette-item ${i === paletteIndex ? 'on' : ''}" data-act="palette-run" data-i="${i}">
        <span style="width:16px;display:grid;place-items:center;color:var(--faint)">${e.icon}</span>
        <span class="t">${esc(e.t)}</span><span class="k">${esc(e.k)}</span></button>`).join('')
        : '<div class="palette-empty">Nichts gefunden.</div>'}
    </div>
  </div></div>`;
}

/* -------------------------------------------------------------- Rendering */

function renderLayer() {
  const layer = $('#layer');
  let html = '';
  if (paletteOpen) html = paletteHtml();
  else if (S.lightbox) {
    html = photoLightbox(S.lightbox);
    if (!html) S.lightbox = null;
  } else if (modalConfig) html = modalHtml(modalConfig);
  else if (S.drawerTask) {
    const t = byId(S.tasks, S.drawerTask);
    if (t) html = taskDrawer(t); else S.drawerTask = null;
  }
  layer.innerHTML = html;

  if (paletteOpen) {
    const inp = $('#palette-input');
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
    inp.addEventListener('input', () => { paletteQuery = inp.value; paletteIndex = 0; renderLayer(); });
  }

  const form = $('#modal-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const cfg = modalConfig;
      await guard(async () => {
        await cfg.onSubmit(data);
        modalConfig = null;
        await refresh();
        render();
      }, cfg.successMessage);
    });
    const first = form.querySelector('input:not([type=hidden]), textarea');
    if (first) setTimeout(() => first.focus(), 40);
  }

  const cf = $('#check-form');
  if (cf) {
    cf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = cf.text.value.trim();
      if (!text) return;
      cf.text.value = '';
      await guard(async () => {
        await api('/checklist', 'POST', { task_id: S.drawerTask, text });
        await refresh(); renderLayer(); renderView(true);
      });
    });
  }

  const cm = $('#comment-form');
  if (cm) {
    cm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitComment(); }
    });
  }

  const ta = $('#t-title');
  if (ta) autoGrow(ta);
  wireTaskAutosave();
}

/* Jede Änderung im Aufgaben-Detail geht sofort raus — kein Speichern-Knopf,
   also auch kein stiller Datenverlust beim Schließen. */
function wireTaskAutosave() {
  const drawer = $('.drawer');
  if (!drawer || !S.drawerTask) return;
  const id = S.drawerTask;

  $$('[data-task-field]', drawer).forEach((el) => {
    el.addEventListener('change', () => saveTaskField(id, el.dataset.taskField, el));
  });

  const title = $('#t-title');
  const desc = $('#t-desc');
  const commit = (el, field) => {
    let last = el.value;
    el.addEventListener('blur', () => {
      const v = field === 'title' ? el.value.trim() : el.value;
      if (v === last) return;
      last = v;
      saveTaskField(id, field, { value: v || (field === 'title' ? 'Ohne Titel' : '') });
    });
    el.addEventListener('keydown', (e) => {
      if (field === 'title' && e.key === 'Enter') { e.preventDefault(); el.blur(); }
    });
  };
  if (title) commit(title, 'title');
  if (desc) commit(desc, 'description');
}

function setSaveState(text, kind) {
  const el = $('#save-state');
  if (!el) return;
  el.textContent = text;
  el.className = 'push save-state' + (kind ? ' ' + kind : '');
}

async function saveTaskField(id, field, el) {
  let value = el.value;
  if (value === '') value = null;
  if (value !== null && ['estimate', 'amount'].includes(field)) value = Number(value);

  setSaveState('Speichert …');
  try {
    if (field === 'column_id') await api('/tasks/move', 'POST', { id, column_id: value });
    else await api('/tasks/' + id, 'PATCH', { [field]: value });
    await refresh();
    setSaveState('Gespeichert', 'ok');
    renderSidebar();
    if (S.route.name === 'board' && $('#board-root')) renderBoardBody();
    else renderView(true);
    if (field === 'column_id') renderLayer();
  } catch (e) {
    setSaveState('Nicht gespeichert: ' + e.message, 'err');
  }
}

function autoGrow(el) {
  const fit = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  el.addEventListener('input', fit);
  fit();
}

function renderView(keepScroll) {
  const root = $('#view-root');
  const scroller = root.querySelector('.content, .board-wrap');
  const pos = keepScroll && scroller ? { t: scroller.scrollTop, l: scroller.scrollLeft } : null;

  const views = {
    dashboard: viewDashboard, board: viewBoard, meine: viewMine, projekte: viewProjects,
    objekte: viewProperties, objekt: viewProperty, kontakte: viewContacts,
    kalender: viewCalendar, team: viewTeam, aktivitaet: viewActivity, einstellungen: viewSettings,
  };
  (views[S.route.name] || viewDashboard)(root);

  if (pos) {
    const ns = root.querySelector('.content, .board-wrap');
    if (ns) { ns.scrollTop = pos.t; ns.scrollLeft = pos.l; }
  }
}

function render() {
  renderSidebar();
  renderTopbar();
  renderView();
  renderLayer();
}

/* ---------------------------------------------------------------- Routing */

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, id] = h.split('/');
  return { name: name || 'dashboard', id: id || null };
}
function go(route) {
  location.hash = '#/' + route;
}
window.addEventListener('hashchange', () => {
  S.route = parseHash();
  S.filters.q = '';
  S.filters.deal = null;
  document.body.classList.remove('nav-open');
  render();
});

/* --------------------------------------------------------- Drag and Drop */

let dragState = null;
let suppressClick = false;

function enableDrag() {
  const wrap = $('#board-wrap');
  if (!wrap) return;
  wrap.addEventListener('pointerdown', onPointerDown);
}

function onPointerDown(e) {
  if (e.button !== 0) return;
  const card = e.target.closest('.tcard');
  if (!card) return;
  if (e.target.closest('button, a, input, select, textarea')) return;
  if (e.pointerType === 'touch' && !e.target.closest('.tcard-handle')) return;

  const startX = e.clientX, startY = e.clientY;
  const rect = card.getBoundingClientRect();
  let started = false;

  const move = (ev) => {
    if (!started) {
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 6) return;
      started = true;
      beginDrag(card, rect, startX, startY);
    }
    ev.preventDefault();
    moveDrag(ev);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    if (started) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 60);
      endDrag();
    }
  };
  const cancel = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    if (started) endDrag(true);
  };

  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
}

function beginDrag(card, rect, x, y) {
  const ghost = card.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.width = rect.width + 'px';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  document.body.appendChild(ghost);

  const ph = document.createElement('div');
  ph.className = 'placeholder';
  ph.style.height = rect.height + 'px';
  card.parentNode.insertBefore(ph, card);
  card.classList.add('dragging');
  card.style.display = 'none';

  const body = card.closest('.col-cards');
  dragState = {
    card, ghost, ph,
    dx: x - rect.left, dy: y - rect.top,
    fromColumn: body ? body.dataset.columnBody : null,
    fromLane: body ? (body.dataset.lane || '') : '',
    taskId: card.dataset.task,
  };
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'grabbing';
}

function moveDrag(e) {
  const d = dragState;
  if (!d) return;
  d.ghost.style.left = (e.clientX - d.dx) + 'px';
  d.ghost.style.top = (e.clientY - d.dy) + 'px';

  const wrap = $('#board-wrap');
  if (wrap) {
    const r = wrap.getBoundingClientRect();
    if (e.clientX > r.right - 80) wrap.scrollLeft += 16;
    else if (e.clientX < r.left + 80) wrap.scrollLeft -= 16;
    if (wrap.classList.contains('grouped')) {
      if (e.clientY > r.bottom - 70) wrap.scrollTop += 14;
      else if (e.clientY < r.top + 70) wrap.scrollTop -= 14;
    }
  }

  d.ghost.style.visibility = 'hidden';
  const under = document.elementFromPoint(e.clientX, e.clientY);
  d.ghost.style.visibility = '';
  if (!under) return;

  const drop = under.closest('.col-drop');
  $$('.col-drop').forEach((c) => c.classList.toggle('drop-active', c === drop));
  if (!drop) return;
  const body = drop.querySelector('.col-cards');
  if (!body) return;

  // Innerhalb der Spalte die Einfügestelle anhand der Kartenmitten bestimmen
  const cards = Array.from(body.querySelectorAll('.tcard:not(.dragging)'));
  let target = null;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) { target = c; break; }
  }
  const more = body.querySelector('.col-more');
  if (target) body.insertBefore(d.ph, target);
  else if (more) body.insertBefore(d.ph, more);
  else body.appendChild(d.ph);

  const hint = body.querySelector('.col-empty');
  if (hint) hint.remove();
}

/* Position zwischen zwei Nachbarn — bewusst kein Neuschreiben der ganzen
   Spalte, sonst würde ein aktiver Filter die verborgenen Karten umsortieren. */
function neighbourPosition(prevId, nextId) {
  const prev = prevId ? byId(S.tasks, prevId) : null;
  const next = nextId ? byId(S.tasks, nextId) : null;
  if (!prev && !next) return { position: 1024 };
  if (!prev) return { position: next.position - 1024 };
  if (!next) return { position: prev.position + 1024 };
  const gap = next.position - prev.position;
  if (gap < 1) return { renumber: true };
  return { position: prev.position + gap / 2 };
}

async function endDrag(cancelled) {
  const d = dragState;
  if (!d) return;
  dragState = null;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
  $$('.col-drop').forEach((c) => c.classList.remove('drop-active'));
  d.ghost.remove();

  const body = d.ph.parentNode;
  const toColumn = body.dataset.columnBody;
  const toLane = body.dataset.lane || '';

  const siblingId = (dir) => {
    let el = dir < 0 ? d.ph.previousElementSibling : d.ph.nextElementSibling;
    while (el && (!el.classList.contains('tcard') || el.classList.contains('dragging'))) {
      el = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
    }
    return el ? el.dataset.task : null;
  };
  const prevId = siblingId(-1);
  const nextId = siblingId(1);

  body.insertBefore(d.card, d.ph);
  d.ph.remove();
  d.card.style.display = '';
  d.card.classList.remove('dragging');
  if (cancelled) return;

  const task = byId(S.tasks, d.taskId);
  if (!task) return;
  const laneChanged = !!S.groupBy && toLane !== String(task[S.groupBy] || '');
  if (toColumn === d.fromColumn && prevId === null && nextId === null && !laneChanged) return;

  const spot = neighbourPosition(prevId, nextId);
  const payload = { id: d.taskId, column_id: toColumn };
  if (spot.renumber) {
    const inColumn = S.tasks
      .filter((t) => t.column_id === toColumn && t.id !== d.taskId)
      .sort((a, b) => a.position - b.position)
      .map((t) => t.id);
    const at = prevId ? inColumn.indexOf(prevId) + 1 : 0;
    inColumn.splice(at, 0, d.taskId);
    payload.order = inColumn;
  } else {
    payload.position = spot.position;
  }

  // Lokal sofort anwenden, damit nichts springt
  task.column_id = toColumn;
  if (payload.position !== undefined) task.position = payload.position;
  const col = byId(S.columns, toColumn);
  task.done_at = col && col.is_done ? (task.done_at || new Date().toISOString()) : null;
  if (laneChanged) task[S.groupBy] = toLane || null;
  renderSidebar();

  try {
    await api('/tasks/move', 'POST', payload);
    if (laneChanged) await api('/tasks/' + d.taskId, 'PATCH', { [S.groupBy]: toLane || null });
    await refresh();
    renderSidebar();
    if (laneChanged) renderBoardBody();
  } catch (e) {
    toast(e.message, 'err');
    await refresh();
    render();
  }
}

/* ------------------------------------------------------------- Aktionen */

function actNewTask(columnId) {
  const pid = S.route.name === 'board' ? S.route.id : (S.projects.find((p) => !p.archived) || {}).id;
  if (!pid) return toast('Lege zuerst ein Projekt an.', 'err');
  const cols = projectColumns(pid);
  const col = columnId || (cols[1] || cols[0] || {}).id;
  if (!col) return toast('Dieses Projekt hat noch keine Spalten.', 'err');

  openModal({
    title: 'Neue Aufgabe',
    submitLabel: 'Aufgabe anlegen',
    successMessage: 'Aufgabe angelegt.',
    fields: [
      { name: 'title', label: 'Titel', required: true, span: true, placeholder: 'z. B. Exposé finalisieren' },
      { name: 'project_id', label: 'Projekt', type: 'select', value: pid, options: S.projects.filter((p) => !p.archived).map((p) => [p.id, p.name]) },
      { name: 'column_id', label: 'Spalte', type: 'select', value: col, options: cols.map((c) => [c.id, c.title]) },
      { name: 'assignee_id', label: 'Zuständig', type: 'select', value: S.me.id, options: [['', 'Niemand'], ...S.users.map((u) => [u.id, u.name])] },
      { name: 'priority', label: 'Priorität', type: 'select', value: 'normal', options: PRIOS.map((p) => [p[0], p[1]]) },
      { name: 'due_date', label: 'Fällig am', type: 'date' },
      { name: 'property_id', label: 'Objekt', type: 'select', value: '', options: [['', '—'], ...S.properties.map((p) => [p.id, p.title])] },
      { name: 'description', label: 'Beschreibung', type: 'textarea', span: true },
    ],
    onSubmit: async (d) => {
      // Spalte muss zum gewählten Projekt gehören
      const targetCols = projectColumns(d.project_id);
      if (!targetCols.some((c) => c.id === d.column_id)) d.column_id = (targetCols[1] || targetCols[0]).id;
      await api('/tasks', 'POST', d);
    },
  });
}

function actProjectModal(id) {
  const p = id ? projectById(id) : null;
  openModal({
    title: p ? 'Projekt bearbeiten' : 'Neues Projekt',
    submitLabel: p ? 'Speichern' : 'Projekt anlegen',
    successMessage: p ? 'Projekt gespeichert.' : 'Projekt angelegt.',
    fields: [
      { name: 'name', label: 'Projektname', required: true, span: true, value: p?.name, placeholder: 'z. B. Ankauf MFH Eppendorf' },
      { name: 'description', label: 'Kurzbeschreibung', type: 'textarea', span: true, rows: 2, value: p?.description },
      { name: 'type', label: 'Art', type: 'select', value: p?.type || 'ankauf', options: PROJECT_TYPES },
      { name: 'status', label: 'Status', type: 'select', value: p?.status || 'aktiv', options: PROJECT_STATUS },
      { name: 'property_id', label: 'Objekt', type: 'select', value: p?.property_id || '', options: [['', '—'], ...S.properties.map((x) => [x.id, x.title])] },
      { name: 'lead_id', label: 'Projektleitung', type: 'select', value: p?.lead_id || S.me.id, options: [['', '—'], ...S.users.map((u) => [u.id, u.name])] },
      { name: 'start_date', label: 'Start', type: 'date', value: p?.start_date },
      { name: 'due_date', label: 'Zieltermin', type: 'date', value: p?.due_date },
      { name: 'volume', label: 'Volumen (€)', type: 'number', step: '1000', value: p?.volume },
      { name: 'budget', label: 'Budget (€)', type: 'number', step: '1000', value: p?.budget },
      { name: 'color', label: 'Farbe', type: 'color', value: p?.color || COLORS[0] },
      { name: 'member_ids', label: 'Team', type: 'members', span: true, value: p ? projectMembers(p.id).map((u) => u.id) : [S.me.id] },
    ],
    onDelete: p ? async () => {
      if (!confirm(`Projekt „${p.name}" mit allen Aufgaben löschen?`)) return false;
      await api('/projects/' + p.id, 'DELETE');
      if (S.route.id === p.id) go('projekte');
      return true;
    } : null,
    onSubmit: async (d) => {
      d.member_ids = (d.member_ids || '').split(',').filter(Boolean);
      if (p) await api('/projects/' + p.id, 'PATCH', d);
      else {
        const r = await api('/projects', 'POST', d);
        setTimeout(() => go('board/' + r.id), 60);
      }
    },
  });
}

function actPropertyModal(id) {
  const p = id ? propertyById(id) : null;
  openModal({
    title: p ? 'Objekt bearbeiten' : 'Neues Objekt',
    submitLabel: p ? 'Speichern' : 'Objekt anlegen',
    successMessage: p ? 'Objekt gespeichert.' : 'Objekt angelegt.',
    fields: [
      { name: 'title', label: 'Bezeichnung', required: true, span: true, value: p?.title, placeholder: 'z. B. MFH Hegestraße 12' },
      { name: 'code', label: 'Objektnummer', value: p?.code, placeholder: 'automatisch' },
      { name: 'type', label: 'Objektart', type: 'select', value: p?.type || 'wohnung', options: PROPERTY_TYPES },
      { name: 'street', label: 'Straße & Nr.', value: p?.street },
      { name: 'deal', label: 'Status', type: 'select', value: p?.deal || 'bestand', options: DEALS.map((d) => [d[0], d[1]]) },
      { name: 'zip', label: 'PLZ', value: p?.zip },
      { name: 'city', label: 'Ort', value: p?.city },
      { name: 'area_sqm', label: 'Wohnfläche (m²)', type: 'number', step: '0.1', value: p?.area_sqm },
      { name: 'rooms', label: 'Zimmer', type: 'number', step: '0.5', value: p?.rooms },
      { name: 'units', label: 'Einheiten', type: 'number', value: p?.units ?? 1 },
      { name: 'plot_sqm', label: 'Grundstück (m²)', type: 'number', step: '1', value: p?.plot_sqm },
      { name: 'year_built', label: 'Baujahr', type: 'number', value: p?.year_built },
      { name: 'energy_class', label: 'Energieklasse', value: p?.energy_class, placeholder: 'A+ … H' },
      { name: 'purchase_price', label: 'Kaufpreis (€)', type: 'number', step: '1000', value: p?.purchase_price },
      { name: 'asking_price', label: 'Angebotspreis (€)', type: 'number', step: '1000', value: p?.asking_price },
      { name: 'rent_cold', label: 'Kaltmiete (€/Mon.)', type: 'number', step: '10', value: p?.rent_cold },
      { name: 'service_charge', label: 'Hausgeld (€/Mon.)', type: 'number', step: '10', value: p?.service_charge },
      { name: 'image_url', label: 'Titelbild-URL (extern, optional — sonst Fotos hochladen)', span: true, value: p?.image_url, placeholder: 'https://…' },
      { name: 'notes', label: 'Notizen', type: 'textarea', span: true, value: p?.notes },
    ],
    onDelete: p ? async () => {
      if (!confirm(`Objekt „${p.title}" löschen?`)) return false;
      await api('/properties/' + p.id, 'DELETE');
      if (S.route.name === 'objekt') go('objekte');
      return true;
    } : null,
    onSubmit: async (d) => {
      if (p) await api('/properties/' + p.id, 'PATCH', d);
      else await api('/properties', 'POST', d);
    },
  });
}

function actContactModal(id) {
  const c = id ? contactById(id) : null;
  openModal({
    title: c ? 'Kontakt bearbeiten' : 'Neuer Kontakt',
    submitLabel: c ? 'Speichern' : 'Kontakt anlegen',
    successMessage: c ? 'Kontakt gespeichert.' : 'Kontakt angelegt.',
    fields: [
      { name: 'name', label: 'Name', required: true, value: c?.name },
      { name: 'role', label: 'Rolle', type: 'select', value: c?.role || 'eigentuemer', options: CONTACT_ROLES },
      { name: 'company', label: 'Firma', value: c?.company },
      { name: 'property_id', label: 'Objekt', type: 'select', value: c?.property_id || '', options: [['', '—'], ...S.properties.map((p) => [p.id, p.title])] },
      { name: 'email', label: 'E-Mail', type: 'email', value: c?.email },
      { name: 'phone', label: 'Telefon', value: c?.phone },
      { name: 'street', label: 'Straße', value: c?.street },
      { name: 'zip', label: 'PLZ', value: c?.zip },
      { name: 'city', label: 'Ort', value: c?.city },
      { name: 'notes', label: 'Notizen', type: 'textarea', span: true, value: c?.notes },
    ],
    onDelete: c ? async () => {
      if (!confirm(`Kontakt „${c.name}" löschen?`)) return false;
      await api('/contacts/' + c.id, 'DELETE');
      return true;
    } : null,
    onSubmit: async (d) => {
      if (c) await api('/contacts/' + c.id, 'PATCH', d);
      else await api('/contacts', 'POST', d);
    },
  });
}

function actEventModal(id, presetDate) {
  const e = id ? byId(S.events, id) : null;
  openModal({
    title: e ? 'Termin bearbeiten' : 'Neuer Termin',
    submitLabel: e ? 'Speichern' : 'Termin anlegen',
    successMessage: e ? 'Termin gespeichert.' : 'Termin angelegt.',
    fields: [
      { name: 'title', label: 'Titel', required: true, span: true, value: e?.title, placeholder: 'z. B. Notartermin Hegestraße' },
      { name: 'type', label: 'Art', type: 'select', value: e?.type || 'termin', options: EVENT_TYPES },
      { name: 'date', label: 'Datum', type: 'date', required: true, value: e?.date || presetDate || todayISO() },
      { name: 'time', label: 'Uhrzeit', type: 'time', value: e?.time },
      { name: 'duration', label: 'Dauer (Min.)', type: 'number', value: e?.duration ?? 60 },
      { name: 'location', label: 'Ort', span: true, value: e?.location },
      { name: 'project_id', label: 'Projekt', type: 'select', value: e?.project_id || '', options: [['', '—'], ...S.projects.map((p) => [p.id, p.name])] },
      { name: 'property_id', label: 'Objekt', type: 'select', value: e?.property_id || '', options: [['', '—'], ...S.properties.map((p) => [p.id, p.title])] },
      { name: 'contact_id', label: 'Kontakt', type: 'select', value: e?.contact_id || '', options: [['', '—'], ...S.contacts.map((c) => [c.id, c.name])] },
      { name: 'owner_id', label: 'Verantwortlich', type: 'select', value: e?.owner_id || S.me.id, options: S.users.map((u) => [u.id, u.name]) },
      { name: 'notes', label: 'Notizen', type: 'textarea', span: true, value: e?.notes },
    ],
    onDelete: e ? async () => {
      if (!confirm('Termin löschen?')) return false;
      await api('/events/' + e.id, 'DELETE');
      return true;
    } : null,
    onSubmit: async (d) => {
      if (e) await api('/events/' + e.id, 'PATCH', d);
      else await api('/events', 'POST', d);
    },
  });
}

function actColumnModal(id, projectId) {
  const c = id ? byId(S.columns, id) : null;
  openModal({
    title: c ? 'Spalte bearbeiten' : 'Neue Spalte',
    submitLabel: c ? 'Speichern' : 'Hinzufügen',
    fields: [
      { name: 'title', label: 'Titel', required: true, span: true, value: c?.title, placeholder: 'z. B. Bei Notar' },
      { name: 'wip_limit', label: 'WIP-Limit (optional)', type: 'number', value: c?.wip_limit },
      { name: 'is_done', label: 'Gilt als erledigt', type: 'select', value: String(c?.is_done ?? 0), options: [['0', 'Nein'], ['1', 'Ja']] },
    ],
    onDelete: c ? async () => {
      if (!confirm('Spalte löschen? Sie muss leer sein.')) return false;
      await api('/columns/' + c.id, 'DELETE');
      return true;
    } : null,
    onSubmit: async (d) => {
      d.is_done = Number(d.is_done);
      d.wip_limit = d.wip_limit === '' ? null : Number(d.wip_limit);
      if (c) await api('/columns/' + c.id, 'PATCH', d);
      else await api('/columns', 'POST', { ...d, project_id: projectId });
    },
  });
}

function actDocModal(link) {
  openModal({
    title: 'Dokument verknüpfen',
    intro: 'Verlinke ein Dokument aus Drive, SharePoint oder DMS.',
    submitLabel: 'Verknüpfen',
    successMessage: 'Dokument verknüpft.',
    fields: [
      { name: 'title', label: 'Bezeichnung', required: true, span: true, placeholder: 'z. B. Grundbuchauszug' },
      { name: 'url', label: 'Link', required: true, span: true, type: 'url', placeholder: 'https://…' },
      { name: 'kind', label: 'Art', type: 'select', value: 'sonstige', options: [['exposé', 'Exposé'], ['grundbuch', 'Grundbuch'], ['vertrag', 'Vertrag'], ['plan', 'Plan'], ['foto', 'Foto'], ['rechnung', 'Rechnung'], ['sonstige', 'Sonstige']] },
    ],
    onSubmit: async (d) => { await api('/documents', 'POST', { ...d, ...link }); },
  });
}

async function submitComment() {
  const form = $('#comment-form');
  if (!form) return;
  const body = form.body.value.trim();
  if (!body) return;
  form.body.value = '';
  await guard(async () => {
    await api('/comments', 'POST', { task_id: S.drawerTask, body });
    await refresh(); renderLayer(); renderView(true);
  });
}

/* --------------------------------------------------- Ereignisverarbeitung */

const ACTIONS = {
  go: (el) => go(el.dataset.route),
  'nav-toggle': () => document.body.classList.toggle('nav-open'),
  theme: () => toggleTheme(),
  'theme-set': (el) => setTheme(el.dataset.theme),
  logout: async () => { await api('/auth/logout', 'POST'); location.reload(); },
  menu: (el) => { const m = el.dataset.menu; S.menuOpen = S.menuOpen === m ? null : m; render(); },
  palette: () => { paletteOpen = true; paletteQuery = ''; paletteIndex = 0; renderLayer(); },
  'close-palette': () => { paletteOpen = false; renderLayer(); },
  'palette-run': (el) => {
    const item = window.__palette[Number(el.dataset.i)];
    paletteOpen = false; renderLayer();
    if (item) item.run();
  },
  'close-layer': () => { modalConfig = null; S.drawerTask = null; S.menuOpen = null; S.lightbox = null; renderLayer(); },

  'board-view': (el) => { S.boardView = el.dataset.view; S.composer = null; renderView(); },

  'composer-open': (el) => {
    S.composer = { column: el.dataset.column, lane: el.dataset.lane || '', text: '', priority: 'normal', assignee: S.me.id, due: '' };
    S.menuOpen = null;
    renderBoardBody();
  },
  'composer-close': () => { S.composer = null; renderBoardBody(); },
  'composer-save': () => saveComposer(),
  'show-all-done': (el) => { S.showAllDone.add(el.dataset.id); renderBoardBody(); },
  'column-collapse': (el) => {
    const id = el.dataset.id;
    if (S.collapsed.has(id)) S.collapsed.delete(id); else S.collapsed.add(id);
    saveCollapsed(S.route.id);
    S.menuOpen = null;
    renderBoardBody();
  },
  'column-move': async (el) => {
    const cols = projectColumns(S.route.id).map((c) => c.id);
    const i = cols.indexOf(el.dataset.id);
    const j = i + Number(el.dataset.dir);
    S.menuOpen = null;
    if (j < 0 || j >= cols.length) { renderBoardBody(); return; }
    cols.splice(j, 0, cols.splice(i, 1)[0]);
    cols.forEach((id, pos) => { const c = byId(S.columns, id); if (c) c.position = pos; });
    renderBoardBody();
    await guard(async () => { await api('/columns/reorder', 'POST', { order: cols }); await refresh(); });
  },
  'column-delete': async (el) => {
    const c = byId(S.columns, el.dataset.id);
    if (!c) return;
    const n = S.tasks.filter((t) => t.column_id === c.id).length;
    if (n) return toast(`„${c.title}" enthält noch ${n} Aufgabe(n).`, 'err');
    if (!confirm(`Spalte „${c.title}" löschen?`)) return;
    S.menuOpen = null;
    await guard(async () => { await api('/columns/' + c.id, 'DELETE'); await refresh(); render(); }, 'Spalte gelöscht.');
  },

  'f-mine': () => { S.filters.mine = !S.filters.mine; renderView(true); },
  'f-overdue': () => { S.filters.overdue = !S.filters.overdue; renderView(true); },
  'f-assignee': (el) => { S.filters.assignee = S.filters.assignee === el.dataset.id ? null : el.dataset.id; renderView(true); },
  'group-by': () => {},
  'f-reset': () => { S.filters = { q: '', assignee: null, priority: null, label: null, mine: false, overdue: false, deal: null }; renderView(); },
  'filter-overdue': () => {
    S.filters.overdue = true;
    const p = S.projects.find((x) => projectTasks(x.id).some((t) => t.due_date && daysUntil(t.due_date) < 0 && !isDoneTask(t)));
    if (p) go('board/' + p.id); else go('meine');
  },
  'prop-filter': (el) => {
    S.filters.deal = S.filters.deal === el.dataset.deal ? null : el.dataset.deal;
    renderView(true);
  },
  'noop': () => {},

  'task-open': (el) => openTask(el.dataset.task),
  'task-new': (el) => actNewTask(el.dataset.column),
  'task-delete': async (el) => {
    if (!confirm('Aufgabe wirklich löschen?')) return;
    await guard(async () => {
      await api('/tasks/' + el.dataset.task, 'DELETE');
      S.drawerTask = null; S.menuOpen = null;
      await refresh(); render();
    }, 'Aufgabe gelöscht.');
  },
  'task-duplicate': async (el) => {
    const t = byId(S.tasks, el.dataset.task);
    if (!t) return;
    await guard(async () => {
      await api('/tasks', 'POST', {
        ...t, id: undefined, title: t.title + ' (Kopie)', labels: t.labels,
      });
      S.menuOpen = null;
      await refresh(); render();
    }, 'Aufgabe dupliziert.');
  },
  'task-complete': async (el) => {
    const t = byId(S.tasks, el.dataset.task);
    const done = projectColumns(t.project_id).find((c) => c.is_done);
    if (!done) return toast('Keine „Erledigt"-Spalte vorhanden.', 'err');
    await guard(async () => {
      await api('/tasks/move', 'POST', { id: t.id, column_id: done.id, order: [] });
      await refresh(); render();
    }, 'Als erledigt markiert.');
  },
  'task-label': async (el) => {
    const t = byId(S.tasks, el.dataset.task);
    const name = el.dataset.label;
    const labels = (t.labels || []).includes(name) ? t.labels.filter((l) => l !== name) : [...(t.labels || []), name];
    t.labels = labels;
    renderLayer();
    await guard(async () => { await api('/tasks/' + t.id, 'PATCH', { labels }); await refresh(); renderView(true); });
  },

  'check-toggle': async (el) => {
    await guard(async () => {
      await api('/checklist/' + el.dataset.id, 'PATCH', { done: el.checked ? 1 : 0 });
      await refresh(); renderLayer(); renderView(true);
    });
  },
  'check-delete': async (el) => {
    await guard(async () => {
      await api('/checklist/' + el.dataset.id, 'DELETE');
      await refresh(); renderLayer(); renderView(true);
    });
  },
  'comment-submit': () => submitComment(),
  'comment-delete': async (el) => {
    await guard(async () => {
      await api('/comments/' + el.dataset.id, 'DELETE');
      await refresh(); renderLayer();
    });
  },

  'project-new': () => actProjectModal(),
  'project-edit': (el) => { S.menuOpen = null; actProjectModal(el.dataset.id); },
  'project-delete': async (el) => {
    const p = projectById(el.dataset.id);
    if (!p || !confirm(`Projekt „${p.name}" mit allen Aufgaben löschen?`)) return;
    await guard(async () => {
      await api('/projects/' + p.id, 'DELETE');
      S.menuOpen = null;
      await refresh(); go('projekte'); render();
    }, 'Projekt gelöscht.');
  },
  'project-archive': async (el) => {
    const p = projectById(el.dataset.id);
    await guard(async () => {
      await api('/projects/' + p.id, 'PATCH', { archived: p.archived ? 0 : 1 });
      S.menuOpen = null;
      await refresh(); render();
    }, p.archived ? 'Wiederhergestellt.' : 'Archiviert.');
  },

  'column-new': (el) => { S.menuOpen = null; actColumnModal(null, el.dataset.id); },
  'column-edit': (el) => actColumnModal(el.dataset.id),

  'photo-pick': (el) => pickPhotos(el.dataset.id),
  'photo-open': (el) => { S.lightbox = el.dataset.id; renderLayer(); },
  'photo-cover': async (el) => {
    await guard(async () => {
      await api('/photos/' + el.dataset.id, 'PATCH', { is_cover: 1 });
      await refresh(); renderView(true); renderLayer();
    }, 'Titelbild gesetzt.');
  },
  'photo-delete': async (el) => {
    if (!confirm('Foto wirklich löschen?')) return;
    await guard(async () => {
      await api('/photos/' + el.dataset.id, 'DELETE');
      S.lightbox = null;
      await refresh(); render();
    }, 'Foto gelöscht.');
  },

  'property-new': () => actPropertyModal(),
  'property-open': (el) => go('objekt/' + el.dataset.id),
  'property-edit': (el) => actPropertyModal(el.dataset.id),

  'contact-new': () => actContactModal(),
  'contact-edit': (el) => actContactModal(el.dataset.id),

  'event-new': () => actEventModal(),
  'event-edit': (el) => actEventModal(el.dataset.id),

  'doc-new': (el) => {
    S.menuOpen = null;
    actDocModal({ property_id: el.dataset.property || null, task_id: el.dataset.task || null, project_id: el.dataset.project || null });
  },
  'doc-delete': async (el) => {
    await guard(async () => { await api('/documents/' + el.dataset.id, 'DELETE'); await refresh(); render(); }, 'Gelöscht.');
  },

  'cal-prev': () => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() - 1, 1); renderView(); },
  'cal-next': () => { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + 1, 1); renderView(); },
  'cal-today': () => { const d = new Date(); S.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); renderView(); },
  'cal-day': (el, ev) => { if (ev.target === el || ev.target.classList.contains('d')) actEventModal(null, el.dataset.date); },

  'pick-color': (el) => {
    $('#color-input').value = el.dataset.color;
    $$('.swatch', el.parentNode).forEach((s) => s.classList.remove('on'));
    el.classList.add('on');
  },
  'modal-color': (el) => {
    $('#modal-color').value = el.dataset.color;
    $$('.swatch', el.parentNode).forEach((s) => s.classList.remove('on'));
    el.classList.add('on');
  },
  'modal-member': (el) => {
    const input = $('#modal-members');
    const set = new Set(input.value.split(',').filter(Boolean));
    if (set.has(el.dataset.id)) { set.delete(el.dataset.id); el.classList.remove('on'); }
    else { set.add(el.dataset.id); el.classList.add('on'); }
    input.value = Array.from(set).join(',');
  },
  'modal-delete': async () => {
    const cfg = modalConfig;
    if (!cfg?.onDelete) return;
    await guard(async () => {
      const ok = await cfg.onDelete();
      if (ok === false) return;
      modalConfig = null;
      await refresh(); render();
    });
  },
};

document.addEventListener('click', (ev) => {
  if (suppressClick) { ev.preventDefault(); ev.stopPropagation(); return; }
  const el = ev.target.closest('[data-act]');
  if (!el) {
    if (S.menuOpen && !ev.target.closest('.menu')) { S.menuOpen = null; render(); }
    return;
  }
  const act = el.dataset.act;
  if (act === 'check-toggle') return; // über change
  const fn = ACTIONS[act];
  if (!fn) return;
  ev.preventDefault();
  ev.stopPropagation();
  if (S.menuOpen && !['menu'].includes(act) && !el.closest('.menu')) S.menuOpen = null;
  fn(el, ev);
});

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-act], [data-change]');
  if (!el) return;
  if (el.dataset.act === 'check-toggle') return ACTIONS['check-toggle'](el, ev);
  const c = el.dataset.change;
  if (c === 'f-prio') { S.filters.priority = el.value || null; renderView(true); }
  if (c === 'f-label') { S.filters.label = el.value || null; renderView(true); }
  if (c === 'group-by') { S.groupBy = el.value; S.composer = null; renderBoardBody(); }
});

document.addEventListener('keydown', (ev) => {
  if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
    ev.preventDefault();
    paletteOpen = !paletteOpen; paletteQuery = ''; paletteIndex = 0; renderLayer();
    return;
  }
  if (paletteOpen) {
    const list = window.__palette || [];
    if (ev.key === 'ArrowDown') { ev.preventDefault(); paletteIndex = Math.min(paletteIndex + 1, list.length - 1); renderLayer(); }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); paletteIndex = Math.max(paletteIndex - 1, 0); renderLayer(); }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const item = list[paletteIndex];
      paletteOpen = false; renderLayer();
      if (item) item.run();
    }
    if (ev.key === 'Escape') { paletteOpen = false; renderLayer(); }
    return;
  }
  if (S.lightbox && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
    const cur = byId(S.photos, S.lightbox);
    const sib = cur ? propertyPhotos(cur.property_id) : [];
    if (sib.length > 1) {
      const i = sib.findIndex((x) => x.id === S.lightbox);
      const next = ev.key === 'ArrowRight' ? (i + 1) % sib.length : (i - 1 + sib.length) % sib.length;
      S.lightbox = sib[next].id;
      renderLayer();
    }
    ev.preventDefault();
    return;
  }
  if (ev.key === 'Escape') {
    // Erst den Fokus abgeben, damit Titel und Beschreibung noch gespeichert werden
    const active = document.activeElement;
    if (active && active.closest('.drawer') && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) {
      active.blur();
      ev.preventDefault();
      return;
    }
    if (modalConfig || S.drawerTask || S.menuOpen || S.lightbox) { modalConfig = null; S.drawerTask = null; S.menuOpen = null; S.lightbox = null; renderLayer(); render(); }
    return;
  }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName);
  if (typing) {
    if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey) && S.drawerTask) ev.target.blur();
    return;
  }
  if (ev.key === 'n') { ev.preventDefault(); actNewTask(); }
  if (ev.key === 'g') { window.__g = true; setTimeout(() => { window.__g = false; }, 700); }
  if (window.__g) {
    if (ev.key === 'd') go('dashboard');
    if (ev.key === 'm') go('meine');
    if (ev.key === 'o') go('objekte');
    if (ev.key === 'k') go('kalender');
  }
});

/* -------------------------------------------------------------- Sonstiges */

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('mk-theme', theme); } catch { /* egal */ }
  render();
}
function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

/* -------------------------------------------------------------- Anmeldung */

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  const errBox = $('#login-error');
  btn.disabled = true;
  btn.textContent = 'Wird geprüft …';
  errBox.classList.add('hidden');
  try {
    await api('/auth/login', 'POST', { login: $('#login').value, password: $('#password').value });
    await boot();
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Anmelden';
  }
});

async function boot() {
  try {
    await refresh();
  } catch {
    $('#auth').style.display = '';
    $('#app').classList.remove('ready');
    setTimeout(() => $('#login').focus(), 60);
    return;
  }
  $('#auth').style.display = 'none';
  $('#app').classList.add('ready');
  S.route = parseHash();
  if (!location.hash) location.hash = '#/dashboard';
  render();
}

try {
  const saved = localStorage.getItem('mk-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';
} catch { /* egal */ }

boot();

})();
