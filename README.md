# Mikdaten

Interne Projekt- und Objektsteuerung für die Immobilienverwaltung — Kanban-Board,
Objektstammdaten, Kontakte, Termine und Auswertungen an einem Ort.

Läuft als **ein einziger Cloudflare Worker** mit **D1** als Datenbank und
**R2** für Objektfotos.
Kein Build-Tooling, keine Laufzeit-Abhängigkeiten, kein externes CDN: HTML, CSS
und JavaScript werden beim Build in den Worker eingebettet und in einer Antwort
ausgeliefert.

**Live:** https://mikdaten.ksqsebastian.workers.dev

---

## Funktionsumfang

**Kanban-Board** — das Herzstück
- Spalten in voller Höhe mit eigenem Scrollbereich; Kopfzeile bleibt beim
  Scrollen stehen
- Schnellerfassung direkt in der Spalte: Titel tippen, Eingabetaste, nächste
  Karte — ohne Dialog. Zuständigkeit, Priorität und Fälligkeit gleich mit
- Drag & Drop mit Pointer-Events (Maus, Trackpad, Touch über den Ziehgriff).
  Verschieben setzt nur die Position der gezogenen Karte, nie die der anderen —
  dadurch bleibt die Sortierung auch bei aktivem Filter korrekt
- Spalten umsortieren, einklappen (bleibt pro Projekt gespeichert), umbenennen,
  WIP-Limit setzen, als „Erledigt"-Spalte markieren, löschen
- Swimlanes: Gruppierung nach Zuständigkeit, Priorität oder Objekt. Eine Karte
  in eine andere Bahn zu ziehen ändert die Zuordnung mit
- Spaltenkopf zeigt Anzahl, WIP-Auslastung (rot bei Überschreitung) und die
  Summe der hinterlegten Beträge
- Die „Erledigt"-Spalte zeigt die letzten 15 Karten, ältere auf Klick
- Karten mit Labels als Text, Priorität, Fälligkeit (mit Überfälligkeitszähler),
  Objektbezug, Betrag, Checklisten-, Kommentar- und Dokumentzähler
- Filter: Volltext (Titel, Beschreibung, Labels, Objekt), Zuständigkeit,
  Priorität, Label, „nur meine", „überfällig"

**Vier Ansichten je Projekt** — Board, Liste, Timeline (Gantt-artig), Kalender

**Aufgaben-Detail** — Beschreibung, Checkliste mit Fortschritt, Kommentare,
Zuständigkeit, Start- und Fälligkeitsdatum, Aufwand, Betrag, Objekt- und
Kontaktbezug, Dokumentlinks. Jede Änderung wird sofort gespeichert; es gibt
keinen Speichern-Knopf und damit auch keinen stillen Datenverlust beim
Schließen

**Objekte** — Stammdaten (Fläche, Zimmer, Einheiten, Grundstück, Baujahr,
Energieklasse), Preise, Kaltmiete, automatisch berechnete Bruttorendite,
Statuspipeline (Ankauf → Bestand → Vermarktung → Verkauft/Vermietet),
verknüpfte Aufgaben, Projekte, Kontakte, Termine und Dokumente

**Fotogalerie mit R2** — Bilder per Dateidialog oder Drag & Drop hochladen
(JPEG, PNG, WebP, GIF, AVIF, HEIC; bis 12 MB), Titelbild festlegen,
Vollbildansicht mit Pfeiltastennavigation. Bilder liegen im R2-Bucket
`mikdaten-media` und werden nur an angemeldete Personen ausgeliefert; beim
Löschen eines Objekts werden sie mit entfernt

**Dateiablage** — Dokumente lassen sich als Datei hochladen (PDF, Bilder,
Word, Excel, PowerPoint, OpenDocument, Text, CSV, ZIP; bis 25 MB) oder
weiterhin als Link hinterlegen. Ablage an Objekt, Projekt oder Aufgabe, per
Knopf oder Drag & Drop. PDF und Bilder öffnen im Browser, alles andere lädt
herunter

**Kontakte** — nach Rolle gruppiert: Eigentümer, Käufer, Mieter, Interessent,
Makler, Handwerker, Notar, Bank, Hausverwaltung, Behörde

**Kalender** — Monatsansicht über alle Termine und fälligen Aufgaben;
Termintypen: Besichtigung, Notartermin, Übergabe, Abnahme,
Eigentümerversammlung, Frist

**Übersicht** — Kennzahlen (aktive Projekte, offene und überfällige Aufgaben,
Portfoliowert, Kaltmiete), Projektfortschritt, Portfolio-Verteilung als Donut,
Teamauslastung, 14-Tage-Verlauf, nächste Termine, Aktivitätsprotokoll

**Profil** — Name, E-Mail, Position, Telefon und Farbe sind änderbar. Als
Profilbild stehen die Initialen oder zwölf handgesetzte Pixel-Tiere zur
Auswahl (Fuchs, Eule, Katze, Hund, Hase, Igel, Möwe, Wal, Bär, Waschbär,
Biber, Schaf). Die Bilder sind 12×12-Raster in `src/pixel-avatars.js` und
werden zur Laufzeit als SVG erzeugt — keine Bilddateien, kein Netzwerkabruf.

**Weiteres** — Team-Übersicht mit Auslastung, Aktivitätsverlauf, Befehlspalette
(⌘K / Strg+K), helles und dunkles Design, Tastaturkürzel (`n` neue Aufgabe,
`g`+`d`/`m`/`o`/`k` zum Springen), vollständig responsiv bis 390 px.
Die Oberfläche kommt ohne Emojis aus — Zustände werden über Farbe, Form und
Text ausgedrückt.

## Gestaltung

Weiß, Graustufen, Haarlinien. Keine Leitfarbe auf großen Flächen, keine
Farbverläufe, keine Schlagschatten. Farbe trägt ausschließlich Bedeutung:
Fristen, Objektstatus, Labels und Personen — jeweils als kleiner Punkt oder
kurzer Text, nie als Fläche. Primäre Schaltflächen sind schwarz, alles andere
ist weiß mit Rahmen. Radien zwischen 4 und 8 Pixeln, Zahlen laufen
tabellarisch.

Die Marke ist ein bloßes Zeichen ohne Kachel: zwei Dachkanten, die zusammen
ein M und eine Häuserzeile ergeben, darunter eine Grundlinie. Es nimmt die
Textfarbe an und funktioniert dadurch in beiden Designs. Die Anmeldeseite ist
ein schlichtes zentriertes Formular auf Weiß.

## Datenbestand

Die Datenbank startet **leer** — nur die drei Konten sind angelegt. Beim ersten
Login führt eine Startseite durch die ersten Schritte.

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
- Bilder in R2 sind nicht öffentlich: `/media/*` verlangt eine gültige Sitzung
  und prüft den Pfad gegen Traversal; Uploads werden auf Bildtypen und 12 MB
  begrenzt
- Die Seite ist per `robots`-Meta von der Indexierung ausgenommen

## Aufbau

```
src/worker.js        Worker: JSON-API auf D1, Auth, Sitzungen, Auslieferung
src/index.html       Shell inkl. Anmeldeseite und Logo
src/styles.css       Design-System (Tokens, Komponenten, helles/dunkles Design)
src/app.js           Single-Page-Anwendung (Vanilla JS, keine Abhängigkeiten)
src/pixel-avatars.js Zwölf Pixel-Tiere als 12x12-Raster
schema.sql           Datenbankschema
seed.sql             Erzeugt aus scripts/gen-seed.mjs (Konten + Beispieldaten)
scripts/build.mjs    Bettet HTML/CSS/JS in dist/worker.js ein
scripts/gen-seed.mjs Erzeugt seed.sql inkl. Passwort-Hashes
scripts/local-test.mjs   109 Integrationstests gegen node:sqlite und R2-Attrappe
scripts/local-server.mjs Lokaler Server auf Port 8788
```

## Entwicklung

```bash
npm run test    # Build + 109 Integrationstests (node:sqlite als D1-Ersatz)
npm run dev     # http://127.0.0.1:8788, Daten im Arbeitsspeicher
npm run build   # dist/worker.js erzeugen
```

## Deployment

Vorhanden sind bereits der Worker `mikdaten`, die D1-Datenbank `mikdaten`
(`995b2b67-7dda-4a12-89be-bd34950ee794`) und der R2-Bucket `mikdaten-media`
im Cloudflare-Konto.

```bash
npm run build
npx wrangler deploy
```

Datenbank neu aufsetzen (**löscht alle Daten**):

```bash
# nur die drei Konten, keine Beispieldaten (so läuft die Produktivumgebung)
node scripts/gen-seed.mjs "<Startpasswort>" --users-only > seed.sql
npm run db:schema
npm run db:seed

# alternativ mit Beispieldaten zum Ausprobieren
node scripts/gen-seed.mjs "<Startpasswort>" > seed.sql
```

## API

Alle Endpunkte unter `/api`, JSON, Sitzung per Cookie.
Schreibende Anfragen brauchen `X-Mikdaten: 1`.

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/auth/login` · `/auth/logout` | An- und Abmelden |
| GET | `/state` | Gesamter Datenbestand in einer Antwort |
| PATCH | `/account` · POST `/account/password` | Profil inkl. E-Mail und Profilbild, Passwort |
| POST/PATCH/DELETE | `/projects[/:id]` | Projekte (Anlegen erzeugt Standardspalten) |
| POST/PATCH/DELETE | `/columns[/:id]`, POST `/columns/reorder` | Spalten |
| POST/PATCH/DELETE | `/tasks[/:id]`, POST `/tasks/move` | Aufgaben; `move` nimmt `position` (einzelne Karte) oder `order` (Spalte neu nummerieren) |
| POST/DELETE | `/comments[/:id]` | Kommentare |
| POST/PATCH/DELETE | `/checklist[/:id]` | Checklistenpunkte |
| POST/PATCH/DELETE | `/properties[/:id]` | Objekte |
| POST/PATCH/DELETE | `/contacts[/:id]` | Kontakte |
| POST/PATCH/DELETE | `/events[/:id]` | Termine |
| POST/DELETE | `/documents[/:id]` | Dokumentlinks |
| POST | `/documents/upload?property_id=…` | Dateiupload nach R2 (Rohdaten im Body) |
| POST | `/photos/upload?property_id=…` | Bild-Upload nach R2 (Rohdaten im Body) |
| PATCH/DELETE | `/photos/:id` | Titelbild setzen, Bildunterschrift, Löschen |
| GET | `/media/<key>` (ohne `/api`) | Bild- und Dateiauslieferung, nur mit Sitzung; `?dl=1` erzwingt den Download |
| GET | `/healthz` | Statusprüfung (ohne Anmeldung) |
