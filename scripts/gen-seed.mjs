/**
 * Erzeugt seed.sql: Benutzer (mit PBKDF2-Hash), Objekte, Kontakte,
 * Projekte, Spalten, Aufgaben, Termine und Beispielhistorie.
 *
 *   node scripts/gen-seed.mjs "<Startpasswort>" > seed.sql
 *   node scripts/gen-seed.mjs "<Startpasswort>" --users-only > seed.sql
 *
 * Mit --users-only werden nur die drei Konten erzeugt — keine Beispieldaten.
 */
import { webcrypto as crypto } from 'node:crypto';

const args = process.argv.slice(2);
const USERS_ONLY = args.includes('--users-only');
const PASSWORD = args.find((a) => !a.startsWith('--')) || 'Mikdaten#Immo2026';

/* --------------------------------------------------------------- Helfer */

const q = (v) => {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

const today = new Date();
const iso = (offsetDays = 0) => {
  const d = new Date(today.getTime() + offsetDays * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const stamp = (offsetDays = 0, hour = 9) => {
  const d = new Date(today.getTime() + offsetDays * 864e5);
  d.setHours(hour, (Math.abs(offsetDays) * 7) % 60, 0, 0);
  return d.toISOString();
};

function b64(buf) {
  return Buffer.from(new Uint8Array(buf)).toString('base64');
}

async function hash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return `pbkdf2$100000$${b64(salt)}$${b64(bits)}`;
}

const rows = [];
const insert = (table, obj) => {
  const keys = Object.keys(obj);
  rows.push(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map((k) => q(obj[k])).join(', ')});`);
};

/* ------------------------------------------------------------- Personen */

const USERS = [
  { id: 'usr_christian', name: 'Christian Jonas', username: 'christian.jonas', email: 'christian.jonas@mikdaten.de', job_title: 'Geschäftsführung / Ankauf', initials: 'CJ', color: '#14504F', phone: '+49 40 300 1201' },
  { id: 'usr_joachim', name: 'Joachim Kluge', username: 'joachim.kluge', email: 'joachim.kluge@mikdaten.de', job_title: 'Kaufmännische Leitung / Vertrieb', initials: 'JK', color: '#2A5C8A', phone: '+49 40 300 1202' },
  { id: 'usr_mikdat', name: 'Mikdat Emir', username: 'mikdat.emir', email: 'mikdat.emir@mikdaten.de', job_title: 'Objekt- & Bestandsmanagement', initials: 'ME', color: '#2F6B45', phone: '+49 40 300 1203' },
];

/* -------------------------------------------------------------- Objekte */

const PROPS = [
  { id: 'obj_hege', code: 'OBJ-001', title: 'MFH Hegestraße 12', street: 'Hegestraße 12', zip: '20251', city: 'Hamburg-Eppendorf', type: 'mehrfamilienhaus', deal: 'ankauf', units: 8, rooms: null, area_sqm: 612, plot_sqm: 486, year_built: 1928, energy_class: 'E', purchase_price: 3450000, asking_price: null, rent_cold: 14200, service_charge: null, notes: 'Denkmalgeschützte Fassade. Ankaufsprüfung läuft, LOI vom Verkäufer liegt vor. Zwei Wohnungen im DG unsaniert.' },
  { id: 'obj_poel', code: 'OBJ-002', title: 'ETW Poelchaukamp 5, 3. OG rechts', street: 'Poelchaukamp 5', zip: '22301', city: 'Hamburg-Winterhude', type: 'wohnung', deal: 'vermarktung', units: 1, rooms: 3.5, area_sqm: 96.5, plot_sqm: null, year_built: 1961, energy_class: 'D', purchase_price: 612000, asking_price: 795000, rent_cold: null, service_charge: 385, notes: 'Bezugsfrei ab 01.11. Balkon nach Süden, Stellplatz separat verhandelbar.' },
  { id: 'obj_bahr', code: 'OBJ-003', title: 'Altbau Bahrenfelder Straße 88', street: 'Bahrenfelder Straße 88', zip: '22765', city: 'Hamburg-Ottensen', type: 'mehrfamilienhaus', deal: 'bestand', units: 6, rooms: null, area_sqm: 470, plot_sqm: 312, year_built: 1904, energy_class: 'F', purchase_price: 2150000, asking_price: null, rent_cold: 9800, service_charge: null, notes: 'Strangsanierung 2026 geplant. Zwei Einheiten werden zum Jahresende frei.' },
  { id: 'obj_soor', code: 'OBJ-004', title: 'Reihenmittelhaus Am Sooren 21', street: 'Am Sooren 21', zip: '22143', city: 'Hamburg-Rahlstedt', type: 'haus', deal: 'verkauft', units: 1, rooms: 5, area_sqm: 138, plot_sqm: 320, year_built: 1994, energy_class: 'C', purchase_price: 512000, asking_price: 649000, rent_cold: null, service_charge: null, notes: 'Kaufvertrag beurkundet. Übergabe nach Kaufpreiszahlung.' },
  { id: 'obj_stei', code: 'OBJ-005', title: 'Gewerbeeinheit Steindamm 44', street: 'Steindamm 44', zip: '20099', city: 'Hamburg-St. Georg', type: 'gewerbe', deal: 'vermietet', units: 2, rooms: null, area_sqm: 210, plot_sqm: null, year_built: 1972, energy_class: 'E', purchase_price: 890000, asking_price: null, rent_cold: 3150, service_charge: null, notes: 'Mietvertrag läuft bis 2029, Indexmiete. Nachverhandlung Nebenkosten offen.' },
  { id: 'obj_kirch', code: 'OBJ-006', title: 'Baugrundstück Kirchwerder Landweg', street: 'Kirchwerder Landweg 210', zip: '21037', city: 'Hamburg-Kirchwerder', type: 'grundstueck', deal: 'ankauf', units: 0, rooms: null, area_sqm: null, plot_sqm: 1450, year_built: null, energy_class: null, purchase_price: 420000, asking_price: null, rent_cold: null, service_charge: null, notes: 'Bauvoranfrage für zwei Doppelhaushälften eingereicht. Erschließung teilweise vorhanden.' },
];

/* ------------------------------------------------------------- Kontakte */

const CONTACTS = [
  { id: 'con_1', name: 'Dr. Ulrike Brenner', role: 'eigentuemer', company: 'Brenner Grundbesitz GbR', email: 'u.brenner@brenner-gbr.de', phone: '+49 40 411 2288', property_id: 'obj_hege', notes: 'Verkäuferin MFH Hegestraße. Erreichbar vormittags.' },
  { id: 'con_2', name: 'Notariat Dr. Wieland & Partner', role: 'notar', company: 'Wieland & Partner', email: 'termine@notariat-wieland.de', phone: '+49 40 355 0110', property_id: null, notes: 'Standardnotariat für alle Beurkundungen.' },
  { id: 'con_3', name: 'Sven Osterkamp', role: 'kaeufer', company: null, email: 's.osterkamp@web.de', phone: '+49 171 4402211', property_id: 'obj_soor', notes: 'Finanzierungsbestätigung liegt vor.' },
  { id: 'con_4', name: 'Hamburger Sparkasse — Immobilienfinanzierung', role: 'bank', company: 'Haspa', email: 'gewerbe.immo@haspa.de', phone: '+49 40 3579 0', property_id: null, notes: 'Ansprechpartner: Herr Timmermann.' },
  { id: 'con_5', name: 'Familie Achterberg', role: 'mieter', company: null, email: 'achterberg.hh@gmail.com', phone: '+49 40 899 7712', property_id: 'obj_bahr', notes: 'Wohnung 2. OG links. Mietminderung wegen Heizung angekündigt.' },
  { id: 'con_6', name: 'Petersen Haustechnik GmbH', role: 'handwerker', company: 'Petersen Haustechnik', email: 'auftrag@petersen-haustechnik.de', phone: '+49 40 651 4400', property_id: 'obj_bahr', notes: 'Heizung & Sanitär. Angebot Strangsanierung angefragt.' },
  { id: 'con_7', name: 'Marlene Sturm', role: 'interessent', company: null, email: 'marlene.sturm@posteo.de', phone: '+49 160 3391284', property_id: 'obj_poel', notes: 'Zweite Besichtigung gewünscht, Eigenkapital 40 %.' },
  { id: 'con_8', name: 'Bezirksamt Hamburg-Mitte — Bauprüfabteilung', role: 'behoerde', company: 'Bezirksamt Mitte', email: 'bauprüfung@hamburg-mitte.de', phone: '+49 40 42854 0', property_id: 'obj_kirch', notes: 'Bauvoranfrage Az. 2026/BV-1187.' },
  { id: 'con_9', name: 'Kontor Hausverwaltung Nord', role: 'verwalter', company: 'Kontor HV Nord GmbH', email: 'objekt@kontor-hv.de', phone: '+49 40 228 9010', property_id: 'obj_poel', notes: 'WEG-Verwaltung Poelchaukamp.' },
  { id: 'con_10', name: 'Thies Baugutachten', role: 'sonstige', company: 'Ing.-Büro Thies', email: 'kontakt@thies-gutachten.de', phone: '+49 40 780 5521', property_id: 'obj_hege', notes: 'Technische Due Diligence Hegestraße.' },
];

/* ------------------------------------------------------------- Projekte */

const COLNAMES = ['Backlog', 'Zu erledigen', 'In Arbeit', 'Prüfung', 'Erledigt'];

const PROJECTS = [
  { id: 'prj_hege', name: 'Ankauf MFH Hegestraße', description: 'Due Diligence, Finanzierung und Beurkundung für das Mehrfamilienhaus in Eppendorf.', type: 'ankauf', color: '#14504F', property_id: 'obj_hege', lead_id: 'usr_christian', volume: 3450000, budget: 3620000, start: -34, due: 46 },
  { id: 'prj_poel', name: 'Vermarktung ETW Poelchaukamp', description: 'Exposé, Besichtigungen und Verkauf der 3,5-Zimmer-Wohnung in Winterhude.', type: 'verkauf', color: '#2F6B45', property_id: 'obj_poel', lead_id: 'usr_joachim', volume: 795000, budget: 12000, start: -21, due: 62 },
  { id: 'prj_bahr', name: 'Sanierung Bahrenfelder Straße', description: 'Strangsanierung, Heizungstausch und Aufwertung der Treppenhäuser.', type: 'sanierung', color: '#8A6212', property_id: 'obj_bahr', lead_id: 'usr_mikdat', volume: 480000, budget: 520000, start: -12, due: 180 },
  { id: 'prj_best', name: 'Bestandsverwaltung 2026', description: 'Laufende Aufgaben aus Bestand: Nebenkosten, Mieterwechsel, Wartungen, ETVs.', type: 'verwaltung', color: '#2A5C8A', property_id: null, lead_id: 'usr_mikdat', volume: null, budget: null, start: -180, due: 143 },
  { id: 'prj_kirch', name: 'Ankaufsprüfung Kirchwerder', description: 'Bauvoranfrage, Bodengutachten und Kalkulation für das Baugrundstück.', type: 'ankauf', color: '#5B4B8A', property_id: 'obj_kirch', lead_id: 'usr_christian', volume: 420000, budget: 440000, start: -8, due: 90 },
];

/* ------------------------------------------------------------- Aufgaben */
// col: 0..4 (Backlog … Erledigt), due: Tage relativ zu heute

const TASKS = [
  // Ankauf Hegestraße
  ['prj_hege', 4, 'Letter of Intent an Verkäuferin senden', 'LOI mit Preisvorbehalt und Prüffrist von 6 Wochen.', 'usr_christian', -28, 'hoch', ['Ankauf', 'Recht'], 'obj_hege', 'con_1', null],
  ['prj_hege', 4, 'Grundbuchauszug und Flurkarte anfordern', null, 'usr_mikdat', -24, 'normal', ['Ankauf', 'Behörde'], 'obj_hege', null, null],
  ['prj_hege', 3, 'Technische Due Diligence auswerten', 'Gutachten Thies liegt vor: Dach und Elektrik mit Handlungsbedarf, geschätzt 210.000 €.', 'usr_mikdat', 3, 'hoch', ['Ankauf', 'Technik'], 'obj_hege', 'con_10', 210000],
  ['prj_hege', 2, 'Finanzierungsanfrage Haspa nachfassen', 'Term Sheet steht aus. Zielkondition 3,6 % / 10 Jahre / 70 % LTV.', 'usr_christian', 1, 'hoch', ['Finanzierung'], 'obj_hege', 'con_4', 2415000],
  ['prj_hege', 2, 'Mieterliste und Mietverträge prüfen', 'Zwei Verträge ohne Indexklausel — Auswirkung auf Kalkulation prüfen.', 'usr_joachim', -2, 'mittel', ['Ankauf', 'Recht'], 'obj_hege', null, null],
  ['prj_hege', 1, 'Kaufvertragsentwurf mit Notar abstimmen', 'Fälligkeitsvoraussetzungen und Rücktrittsrecht bei Bauvoranfrage.', 'usr_christian', 12, 'hoch', ['Notar', 'Recht'], 'obj_hege', 'con_2', null],
  ['prj_hege', 1, 'Instandhaltungsrückstellung kalkulieren', null, 'usr_joachim', 16, 'normal', ['Buchhaltung'], 'obj_hege', null, null],
  ['prj_hege', 0, 'Versicherungsangebote für Objektübernahme einholen', null, 'usr_mikdat', 30, 'niedrig', ['Ankauf'], 'obj_hege', null, null],
  ['prj_hege', 0, 'Übergabeprotokoll vorbereiten', null, null, null, 'niedrig', ['Ankauf'], 'obj_hege', null, null],

  // Vermarktung Poelchaukamp
  ['prj_poel', 4, 'Fotoshooting und Grundrisse beauftragen', null, 'usr_joachim', -16, 'normal', ['Marketing'], 'obj_poel', null, 890],
  ['prj_poel', 4, 'Energieausweis anfordern', 'Bedarfsausweis liegt vor, Klasse D.', 'usr_mikdat', -14, 'normal', ['Behörde'], 'obj_poel', 'con_9', null],
  ['prj_poel', 3, 'Exposé Endabnahme', 'Preis, Hausgeld und Stellplatzoption prüfen — dann Freigabe für Portale.', 'usr_joachim', 0, 'hoch', ['Marketing', 'Verkauf'], 'obj_poel', null, null],
  ['prj_poel', 2, 'Inserate auf ImmoScout und Immowelt schalten', null, 'usr_joachim', 2, 'hoch', ['Marketing'], 'obj_poel', null, 640],
  ['prj_poel', 2, 'Zweitbesichtigung mit Frau Sturm koordinieren', 'Interessentin mit 40 % Eigenkapital, sehr konkret.', 'usr_joachim', 4, 'mittel', ['Besichtigung', 'Verkauf'], 'obj_poel', 'con_7', null],
  ['prj_poel', 1, 'WEG-Protokolle der letzten 3 Jahre anfordern', null, 'usr_mikdat', 7, 'normal', ['Verkauf'], 'obj_poel', 'con_9', null],
  ['prj_poel', 1, 'Kaufpreisverhandlung vorbereiten', 'Untergrenze 762.000 € abstimmen.', 'usr_christian', 21, 'mittel', ['Verkauf'], 'obj_poel', null, 795000],
  ['prj_poel', 0, 'Notartermin für Beurkundung reservieren', null, 'usr_joachim', 45, 'normal', ['Notar'], 'obj_poel', 'con_2', null],

  // Sanierung Bahrenfelder
  ['prj_bahr', 4, 'Bestandsaufnahme Heizungsanlage', 'Kessel Baujahr 1998, Austausch zwingend vor der Heizperiode.', 'usr_mikdat', -10, 'hoch', ['Sanierung', 'Technik'], 'obj_bahr', 'con_6', null],
  ['prj_bahr', 3, 'Angebote Strangsanierung vergleichen', 'Drei Angebote: 412k / 468k / 501k. Petersen technisch am stärksten.', 'usr_mikdat', 2, 'hoch', ['Sanierung'], 'obj_bahr', 'con_6', 468000],
  ['prj_bahr', 2, 'Mieterinformation zur Bauphase aufsetzen', 'Ankündigungsfrist §555c BGB beachten — 3 Monate vor Beginn.', 'usr_joachim', -1, 'hoch', ['Sanierung', 'Recht'], 'obj_bahr', 'con_5', null],
  ['prj_bahr', 2, 'KfW-Förderung Einzelmaßnahme prüfen', null, 'usr_christian', 9, 'mittel', ['Finanzierung', 'Sanierung'], 'obj_bahr', null, null],
  ['prj_bahr', 1, 'Bauzeitenplan mit Petersen abstimmen', null, 'usr_mikdat', 14, 'normal', ['Sanierung'], 'obj_bahr', 'con_6', null],
  ['prj_bahr', 1, 'Mietminderung Achterberg rechtlich bewerten', 'Heizungsausfall im Februar, 8 Tage. Anwalt eingeschaltet?', 'usr_joachim', 5, 'mittel', ['Recht'], 'obj_bahr', 'con_5', null],
  ['prj_bahr', 0, 'Treppenhaus: Maler- und Bodenarbeiten ausschreiben', null, null, 60, 'niedrig', ['Sanierung'], 'obj_bahr', null, null],
  ['prj_bahr', 0, 'Modernisierungsumlage kalkulieren', '8 % der Kosten, Kappungsgrenze prüfen.', 'usr_joachim', 120, 'normal', ['Buchhaltung', 'Recht'], 'obj_bahr', null, null],

  // Bestandsverwaltung
  ['prj_best', 4, 'Nebenkostenabrechnung 2025 versenden', 'Alle Objekte fristgerecht raus.', 'usr_mikdat', -20, 'hoch', ['Buchhaltung'], null, null, null],
  ['prj_best', 3, 'Heizungswartung Steindamm beauftragen', null, 'usr_mikdat', 1, 'normal', ['Technik'], 'obj_stei', null, 480],
  ['prj_best', 2, 'Indexmieterhöhung Steindamm 44 prüfen', 'VPI-Steigerung seit letzter Anpassung: 6,1 %.', 'usr_joachim', -3, 'hoch', ['Vermietung', 'Recht'], 'obj_stei', null, 3150],
  ['prj_best', 2, 'Eigentümerversammlung Poelchaukamp vorbereiten', null, 'usr_mikdat', 11, 'mittel', ['Vermietung'], 'obj_poel', 'con_9', null],
  ['prj_best', 1, 'Rauchwarnmelder-Prüfung dokumentieren', 'Jahresnachweis für alle Bestandsobjekte.', 'usr_mikdat', 25, 'normal', ['Technik', 'Recht'], null, null, null],
  ['prj_best', 1, 'Übergabe Reihenhaus Am Sooren vorbereiten', 'Zählerstände, Schlüssel (4 Stück), Protokoll.', 'usr_joachim', 8, 'hoch', ['Verkauf'], 'obj_soor', 'con_3', null],
  ['prj_best', 0, 'Versicherungsvergleich Gebäudepolicen', null, 'usr_christian', 40, 'niedrig', ['Buchhaltung'], null, null, null],

  // Kirchwerder
  ['prj_kirch', 4, 'Bauvoranfrage einreichen', 'Az. 2026/BV-1187, Eingang bestätigt.', 'usr_christian', -6, 'hoch', ['Behörde'], 'obj_kirch', 'con_8', null],
  ['prj_kirch', 2, 'Bodengutachten beauftragen', 'Kampfmittelverdachtsfläche — Sondierung erforderlich.', 'usr_mikdat', 6, 'hoch', ['Technik', 'Ankauf'], 'obj_kirch', null, 4800],
  ['prj_kirch', 1, 'Erschließungskosten mit Bezirk klären', null, 'usr_christian', 20, 'mittel', ['Behörde'], 'obj_kirch', 'con_8', null],
  ['prj_kirch', 1, 'Projektkalkulation zwei DHH erstellen', 'Zielrendite mind. 14 % auf Gesamtkosten.', 'usr_joachim', 27, 'normal', ['Finanzierung'], 'obj_kirch', null, 420000],
  ['prj_kirch', 0, 'Architekturbüro für Vorentwurf auswählen', null, null, null, 'niedrig', ['Sanierung'], 'obj_kirch', null, null],
];

/* -------------------------------------------------------------- Termine */

const EVENTS = [
  ['Zweitbesichtigung Poelchaukamp', 'besichtigung', 4, '17:30', 'Poelchaukamp 5, 22301 Hamburg', 'prj_poel', 'obj_poel', 'con_7', 'usr_joachim'],
  ['Ortstermin Bodengutachten Kirchwerder', 'termin', 6, '09:00', 'Kirchwerder Landweg 210', 'prj_kirch', 'obj_kirch', null, 'usr_mikdat'],
  ['Bankgespräch Haspa — Term Sheet', 'termin', 2, '11:00', 'Haspa Gewerbecenter, Adolphsplatz', 'prj_hege', 'obj_hege', 'con_4', 'usr_christian'],
  ['Übergabe Reihenhaus Am Sooren', 'uebergabe', 8, '14:00', 'Am Sooren 21, 22143 Hamburg', 'prj_best', 'obj_soor', 'con_3', 'usr_joachim'],
  ['Beurkundung MFH Hegestraße', 'notar', 24, '10:30', 'Notariat Wieland, Alsterufer 12', 'prj_hege', 'obj_hege', 'con_2', 'usr_christian'],
  ['Eigentümerversammlung Poelchaukamp', 'etv', 11, '18:00', 'Bürgerhaus Winterhude', 'prj_best', 'obj_poel', 'con_9', 'usr_mikdat'],
  ['Frist: Prüfzeitraum LOI Hegestraße endet', 'frist', 14, null, null, 'prj_hege', 'obj_hege', 'con_1', 'usr_christian'],
  ['Baubesprechung Bahrenfelder Straße', 'termin', 9, '08:30', 'Bahrenfelder Straße 88', 'prj_bahr', 'obj_bahr', 'con_6', 'usr_mikdat'],
  ['Abnahme Heizungswartung Steindamm', 'abnahme', 3, '13:00', 'Steindamm 44', 'prj_best', 'obj_stei', null, 'usr_mikdat'],
];

/* ------------------------------------------------------------- Aufbau */

const main = async () => {
  const pw = await hash(PASSWORD);

  rows.push('-- Automatisch erzeugt von scripts/gen-seed.mjs — nicht von Hand bearbeiten.');
  rows.push('PRAGMA defer_foreign_keys = true;');

  USERS.forEach((u) => insert('users', {
    id: u.id, name: u.name, username: u.username, email: u.email, password: pw,
    role: 'admin', job_title: u.job_title, phone: u.phone, initials: u.initials,
    color: u.color, created_at: stamp(-365),
  }));

  if (USERS_ONLY) {
    process.stdout.write(rows.join('\n') + '\n');
    return;
  }

  PROPS.forEach((p) => insert('properties', {
    id: p.id, code: p.code, title: p.title, street: p.street, zip: p.zip, city: p.city,
    country: 'DE', type: p.type, deal: p.deal, status: 'aktiv', units: p.units,
    rooms: p.rooms, area_sqm: p.area_sqm, plot_sqm: p.plot_sqm, year_built: p.year_built,
    energy_class: p.energy_class, purchase_price: p.purchase_price, asking_price: p.asking_price,
    rent_cold: p.rent_cold, service_charge: p.service_charge, owner_contact: null,
    image_url: null, notes: p.notes, created_at: stamp(-200), updated_at: stamp(-5),
  }));

  CONTACTS.forEach((c) => insert('contacts', {
    id: c.id, name: c.name, role: c.role, company: c.company, email: c.email, phone: c.phone,
    street: null, zip: null, city: null, property_id: c.property_id, notes: c.notes,
    created_at: stamp(-150), updated_at: stamp(-20),
  }));

  PROJECTS.forEach((p, i) => {
    insert('projects', {
      id: p.id, name: p.name, description: p.description, type: p.type, status: 'aktiv',
      color: p.color, property_id: p.property_id, lead_id: p.lead_id,
      budget: p.budget, volume: p.volume, start_date: iso(p.start), due_date: iso(p.due),
      position: i, archived: 0, created_at: stamp(p.start), updated_at: stamp(-2),
    });
    COLNAMES.forEach((title, ci) => insert('columns', {
      id: `col_${p.id.slice(4)}_${ci}`, project_id: p.id, title, position: ci,
      wip_limit: ci === 2 ? 5 : null, is_done: ci === COLNAMES.length - 1 ? 1 : 0,
      created_at: stamp(p.start),
    }));
    USERS.forEach((u) => rows.push(
      `INSERT INTO project_members (project_id, user_id) VALUES (${q(p.id)}, ${q(u.id)});`,
    ));
  });

  const counters = {};
  TASKS.forEach((t, idx) => {
    const [pid, col, title, desc, assignee, due, prio, labels, propId, conId, amount] = t;
    counters[pid] = (counters[pid] || 0) + 1;
    const isDone = col === 4;
    const createdOffset = Math.min(-1, (due ?? 10) - 21);
    insert('tasks', {
      id: `tsk_${String(idx + 1).padStart(3, '0')}`,
      project_id: pid,
      column_id: `col_${pid.slice(4)}_${col}`,
      title, description: desc,
      position: counters[pid] * 1024,
      priority: prio,
      assignee_id: assignee,
      property_id: propId,
      contact_id: conId,
      labels: JSON.stringify(labels),
      start_date: due !== null && due > 5 ? iso(due - 5) : null,
      due_date: due === null ? null : iso(due),
      estimate: [1, 2, 3, 4, 6, 8][idx % 6],
      amount,
      done_at: isDone ? stamp(due ?? -3, 16) : null,
      created_by: assignee || 'usr_christian',
      created_at: stamp(createdOffset),
      updated_at: stamp(-1),
    });
  });

  // Checklisten
  const CHECKS = {
    tsk_003: ['Dachstuhl begutachtet', 'Elektrik geprüft', 'Feuchtemessung Keller', 'Kostenschätzung eingeholt'],
    tsk_012: ['Texte final', 'Grundriss eingebunden', 'Energieausweis-Daten geprüft', 'Preisfreigabe GF'],
    tsk_020: ['Ankündigungsschreiben verfasst', 'Rechtliche Prüfung', 'Versand per Einschreiben'],
    tsk_031: ['Zählerstände notiert', 'Schlüssel gezählt', 'Protokoll vorbereitet'],
  };
  let ci = 0;
  Object.entries(CHECKS).forEach(([taskId, items]) => {
    items.forEach((text, i) => {
      ci++;
      insert('checklist_items', {
        id: `chk_${String(ci).padStart(3, '0')}`, task_id: taskId, text,
        done: i < Math.ceil(items.length / 2) ? 1 : 0, position: i,
      });
    });
  });

  // Kommentare
  const COMMENTS = [
    ['tsk_003', 'usr_christian', 'Die 210.000 € müssen in die Kaufpreisverhandlung. Ich schlage vor, wir gehen mit 3,29 Mio. rein.', -2],
    ['tsk_003', 'usr_mikdat', 'Gutachten ist im Dokumentenordner abgelegt. Dach ist der größte Posten (ca. 140k).', -2],
    ['tsk_004', 'usr_christian', 'Haspa hat Rückmeldung für Freitag zugesagt.', -1],
    ['tsk_012', 'usr_joachim', 'Preis steht bei 795.000 €. Stellplatz separat für 29.000 €.', -3],
    ['tsk_020', 'usr_joachim', 'Frist nach §555c: mindestens 3 Monate vor Baubeginn. Wir sind knapp — bitte diese Woche raus.', -1],
    ['tsk_029', 'usr_mikdat', 'ETV-Einladung ist über Kontor raus, Tagesordnung liegt bei.', -4],
  ];
  COMMENTS.forEach(([taskId, userId, body, off], i) => insert('comments', {
    id: `cmt_${String(i + 1).padStart(3, '0')}`, task_id: taskId, user_id: userId, body,
    created_at: stamp(off, 10 + i),
  }));

  EVENTS.forEach(([title, type, off, time, location, pid, propId, conId, owner], i) => insert('events', {
    id: `evt_${String(i + 1).padStart(3, '0')}`, title, type, date: iso(off), time,
    duration: 60, location, project_id: pid, property_id: propId, contact_id: conId,
    owner_id: owner, notes: null, created_at: stamp(-7),
  }));

  const DOCS = [
    ['Technische Due Diligence Hegestraße', 'https://example.com/dokumente/dd-hegestrasse.pdf', 'sonstige', 'prj_hege', 'obj_hege', 'tsk_003'],
    ['Grundbuchauszug MFH Hegestraße', 'https://example.com/dokumente/grundbuch-hege.pdf', 'grundbuch', 'prj_hege', 'obj_hege', null],
    ['Exposé Poelchaukamp (Entwurf)', 'https://example.com/dokumente/expose-poelchaukamp.pdf', 'exposé', 'prj_poel', 'obj_poel', 'tsk_012'],
    ['Angebot Petersen Strangsanierung', 'https://example.com/dokumente/angebot-petersen.pdf', 'vertrag', 'prj_bahr', 'obj_bahr', 'tsk_019'],
    ['Bauvoranfrage Kirchwerder', 'https://example.com/dokumente/bv-kirchwerder.pdf', 'plan', 'prj_kirch', 'obj_kirch', null],
  ];
  DOCS.forEach(([title, url, kind, pid, propId, taskId], i) => insert('documents', {
    id: `doc_${String(i + 1).padStart(3, '0')}`, title, url, kind,
    project_id: pid, property_id: propId, task_id: taskId,
    user_id: USERS[i % 3].id, created_at: stamp(-10 + i),
  }));

  const ACTS = [
    ['usr_christian', 'create', 'project', 'prj_hege', 'Projekt „Ankauf MFH Hegestraße" angelegt', -34],
    ['usr_joachim', 'create', 'project', 'prj_poel', 'Projekt „Vermarktung ETW Poelchaukamp" angelegt', -21],
    ['usr_mikdat', 'move', 'task', 'tsk_018', '„Bestandsaufnahme Heizungsanlage" → Erledigt', -10],
    ['usr_christian', 'move', 'task', 'tsk_033', '„Bauvoranfrage einreichen" → Erledigt', -6],
    ['usr_joachim', 'create', 'task', 'tsk_013', 'Aufgabe „Inserate auf ImmoScout und Immowelt schalten" erstellt', -5],
    ['usr_mikdat', 'create', 'property', 'obj_kirch', 'Objekt „Baugrundstück Kirchwerder Landweg" angelegt', -8],
    ['usr_joachim', 'move', 'task', 'tsk_026', '„Nebenkostenabrechnung 2025 versenden" → Erledigt', -20],
    ['usr_christian', 'update', 'task', 'tsk_004', '„Finanzierungsanfrage Haspa nachfassen" aktualisiert', -1],
  ];
  ACTS.forEach(([u, action, entity, eid, summary, off], i) => insert('activity', {
    id: `act_${String(i + 1).padStart(3, '0')}`, user_id: u, action, entity, entity_id: eid,
    project_id: null, summary, created_at: stamp(off, 9 + i),
  }));

  process.stdout.write(rows.join('\n') + '\n');
};

main();
