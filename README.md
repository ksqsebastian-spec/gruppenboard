# Mikdaten

Interne Projekt- und Objektsteuerung für die Immobilienverwaltung — Kanban-Board,
Objektstammdaten, Kontakte, Termine und Auswertungen an einem Ort.

Läuft als **ein einziger Cloudflare Worker** mit **D1** als Datenbank.
Kein Build-Tooling, keine Laufzeit-Abhängigkeiten, kein externes CDN: HTML, CSS
und JavaScript werden beim Build in den Worker eingebettet und in einer Antwort
ausgeliefert.

**Live:** https://mikdaten.ksqsebastian.workers.dev

---

## Funktionsumfang

**Kanban-Board**
- Spalten pro Projekt frei konfigurierbar, inkl. WIP-Limit und „gilt als erledigt"
- Drag & Drop mit Pointer-Events (Maus, Trackpad, Touch über den Ziehgriff)
- Karten mit Priorität, Fälligkeit, Labels, Objektbezug, Betrag, Checklisten-
  und Kommentarzähler
- Filter: Volltext, Zuständigkeit, Priorität, Label, „nur meine", „überfällig"

**Vier Ansichten je Projekt** — Board, Liste, Timeline (Gantt-artig), Kalender

**Aufgaben-Detail** — Beschreibung, Checkliste mit Fortschritt, Kommentare,
Zuständigkeit, Start- und Fälligkeitsdatum, Aufwand, Betrag, Objekt- und
Kontaktbezug, Dokumentlinks

**Objekte** — Stammdaten (Fläche, Zimmer, Einheiten, Grundstück, Baujahr,
Energieklasse), Preise, Kaltmiete, automatisch berechnete Bruttorendite,
Statuspipeline (Ankauf → Bestand → Vermarktung → Verkauft/Vermietet),
verknüpfte Aufgaben, Projekte, Kontakte, Termine und Dokumente

**Kontakte** — nach Rolle gruppiert: Eigentümer, Käufer, Mieter, Interessent,
Makler, Handwerker, Notar, Bank, Hausverwaltung, Behörde

**Kalender** — Monatsansicht über alle Termine und fälligen Aufgaben;
Termintypen: Besichtigung, Notartermin, Übergabe, Abnahme,
Eigentümerversammlung, Frist

**Übersicht** — Kennzahlen (aktive Projekte, offene und überfällige Aufgaben,
Portfoliowert, Kaltmiete), Projektfortschritt, Portfolio-Verteilung als Donut,
Teamauslastung, 14-Tage-Verlauf, nächste Termine, Aktivitätsprotokoll

**Weiteres** — Team-Übersicht mit Auslastung, Aktivitätsverlauf, Befehlspalette
(⌘K / Strg+K), helles und dunkles Design, Tastaturkürzel (`n` neue Aufgabe,
`g`+`d`/`m`/`o`/`k` zum Springen), vollständig responsiv bis 390 px.

## Zugang

Drei Konten. Anmeldung mit Benutzername **oder** E-Mail, Groß-/Kleinschreibung
egal.

| Name | Benutzername | E-Mail |
|---|---|---|
| Christian Jonas | `christian.jonas` | christian.jonas@mikdaten.de |
| Joachim Kluge | `joachim.kluge` | joachim.kluge@mikdaten.de |
| Mikdat Emir | `mikdat.emir` | mikdat.emir@mikdaten.de |

Das Startpasswort ist für alle drei gleich und wird separat übergeben. Jede
Person kann es unter *Einstellungen → Passwort ändern* selbst ersetzen; danach
werden alle bestehenden Sitzungen dieser Person beendet.

## Sicherheit

- Passwörter als PBKDF2-SHA256 mit 100.000 Iterationen und Zufalls-Salt
  (Cloudflare-WebCrypto deckelt bei 100.000 — höhere Werte werden abgelehnt)
- Sitzungen als zufälliges 256-Bit-Token in D1, Cookie `HttpOnly`, `Secure`,
  `SameSite=Lax`, 30 Tage Laufzeit; abgelaufene Sitzungen werden bei jedem
  Login aufgeräumt
- Schreibende Anfragen verlangen den Header `X-Mikdaten: 1` (CSRF-Schutz)
- Passwort-Hashes verlassen den Server nie — `/api/state` liefert nur
  öffentliche Benutzerfelder
- Alle SQL-Zugriffe über gebundene Parameter; Schreibfelder sind je Tabelle
  auf eine Positivliste beschränkt
- Die Seite ist per `robots`-Meta von der Indexierung ausgenommen

## Aufbau

```
src/worker.js        Worker: JSON-API auf D1, Auth, Sitzungen, Auslieferung
src/index.html       Shell inkl. Anmeldeseite und Logo
src/styles.css       Design-System (Tokens, Komponenten, helles/dunkles Design)
src/app.js           Single-Page-Anwendung (Vanilla JS, keine Abhängigkeiten)
schema.sql           Datenbankschema
seed.sql             Erzeugt aus scripts/gen-seed.mjs (Konten + Beispieldaten)
scripts/build.mjs    Bettet HTML/CSS/JS in dist/worker.js ein
scripts/gen-seed.mjs Erzeugt seed.sql inkl. Passwort-Hashes
scripts/local-test.mjs   50 Integrationstests gegen node:sqlite
scripts/local-server.mjs Lokaler Server auf Port 8788
```

## Entwicklung

```bash
npm run test    # Build + 50 Integrationstests (node:sqlite als D1-Ersatz)
npm run dev     # http://127.0.0.1:8788, Daten im Arbeitsspeicher
npm run build   # dist/worker.js erzeugen
```

## Deployment

Vorhanden sind bereits der Worker `mikdaten` und die D1-Datenbank `mikdaten`
(`995b2b67-7dda-4a12-89be-bd34950ee794`) im Cloudflare-Konto.

```bash
npm run build
npx wrangler deploy
```

Datenbank neu aufsetzen (**löscht alle Daten**):

```bash
node scripts/gen-seed.mjs "<Startpasswort>" > seed.sql
npm run db:schema
npm run db:seed
```

## API

Alle Endpunkte unter `/api`, JSON, Sitzung per Cookie.
Schreibende Anfragen brauchen `X-Mikdaten: 1`.

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/auth/login` · `/auth/logout` | An- und Abmelden |
| GET | `/state` | Gesamter Datenbestand in einer Antwort |
| PATCH | `/account` · POST `/account/password` | Profil, Passwort |
| POST/PATCH/DELETE | `/projects[/:id]` | Projekte (Anlegen erzeugt Standardspalten) |
| POST/PATCH/DELETE | `/columns[/:id]`, POST `/columns/reorder` | Spalten |
| POST/PATCH/DELETE | `/tasks[/:id]`, POST `/tasks/move` | Aufgaben, Verschieben inkl. Reihenfolge |
| POST/DELETE | `/comments[/:id]` | Kommentare |
| POST/PATCH/DELETE | `/checklist[/:id]` | Checklistenpunkte |
| POST/PATCH/DELETE | `/properties[/:id]` | Objekte |
| POST/PATCH/DELETE | `/contacts[/:id]` | Kontakte |
| POST/PATCH/DELETE | `/events[/:id]` | Termine |
| POST/DELETE | `/documents[/:id]` | Dokumentlinks |
| GET | `/healthz` | Statusprüfung (ohne Anmeldung) |
