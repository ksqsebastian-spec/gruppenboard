/**
 * Erzeugt src/icons.js — die Bildmarke als PNG und ICO, base64-kodiert.
 *
 * Warum vorab und nicht zur Laufzeit: der Worker hat kein zlib, und ein SVG allein
 * reicht nicht. Wer ein Icon abholt (Connector-Listen, Lesezeichen, Startbildschirm),
 * fragt meist nach favicon.ico oder einem PNG und kann mit SVG nichts anfangen.
 *
 * Kein Bild-Tooling im Spiel: PNG wird von Hand kodiert (zlib aus node:zlib), das ICO
 * trägt das PNG unverändert im Rumpf — so machen es Browser seit Vista.
 *
 *   node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Dasselbe Raster wie in src/pixel-avatars.js. Hier fest verdrahtet, weil das
   Icon feste Farben braucht — currentColor und var(--accent) gibt es in einem
   PNG nicht. */
const PIXEL_LOGO = [
  '..11....11..',
  '.1111..1111.',
  '111111111111',
  '111111111111',
  '222222222222',
  '223322223322',
  '223322223322',
  '222222222222',
  '222223322222',
  '222223322222',
];

const BG = [0x0a, 0x0a, 0x0a];
const FILL = {
  1: [0xff, 0xff, 0xff],
  2: [0xff, 0x4a, 0x1c],
  3: [0xff, 0xff, 0xff],
};

const GRID_W = 12;
const GRID_H = 10;
const COVER = 0.6;   // Anteil der Fläche, den die Marke einnimmt
const RADIUS = 0.219; // Eckenradius, wie auf der Übersichtsseite

/* Liegt (x, y) innerhalb des abgerundeten Quadrats? */
function inside(x, y, size, r) {
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function renderRgba(size) {
  const r = size * RADIUS;
  const box = size * COVER;
  const scale = Math.min(box / GRID_W, box / GRID_H);
  const offX = (size - GRID_W * scale) / 2;
  const offY = (size - GRID_H * scale) / 2;

  const px = Buffer.alloc(size * size * 4);
  const SS = 3; // Kantenglättung nur an der Rundung — innen ist alles rechteckig

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (inside(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS, size, r)) cover++;
        }
      }
      const alpha = Math.round((cover / (SS * SS)) * 255);

      let rgb = BG;
      const gx = Math.floor((x - offX) / scale);
      const gy = Math.floor((y - offY) / scale);
      if (gx >= 0 && gx < GRID_W && gy >= 0 && gy < GRID_H) {
        const ch = PIXEL_LOGO[gy][gx];
        if (FILL[ch]) rgb = FILL[ch];
      }

      const i = (y * size + x) * 4;
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = alpha;
    }
  }
  return px;
}

/* --------------------------------------------------------------- PNG-Kodierung */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const px = renderRgba(size);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // 8 Bit je Kanal
  ihdr[9] = 6;  // RGBA
  // 10..12: Kompression, Filter, Interlace — alle 0

  // Jede Zeile bekommt ihr Filter-Byte 0 vorangestellt.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ICO mit PNG im Rumpf. Breite/Höhe 0 steht laut Format für 256. */
function ico(pngBuf) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserviert
  header.writeUInt16LE(1, 2); // Typ: Icon
  header.writeUInt16LE(1, 4); // ein Bild
  const entry = Buffer.alloc(16);
  entry[0] = 0; // 256 Pixel breit
  entry[1] = 0; // 256 Pixel hoch
  entry[2] = 0; // volle Farbtiefe, keine Palette
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);  // Ebenen
  entry.writeUInt16LE(32, 6); // Bit je Pixel
  entry.writeUInt32BE(0, 8);
  entry.writeUInt32LE(pngBuf.length, 8);
  entry.writeUInt32LE(22, 12); // Offset hinter Header und Eintrag
  return Buffer.concat([header, entry, pngBuf]);
}

const png512 = png(512);
const png180 = png(180);
const icoBuf = ico(png(256));

/* Dieselbe Kachel als SVG — für alles, was scharf skalieren soll. */
function svg() {
  const size = 512;
  const box = size * COVER;
  const scale = Math.min(box / GRID_W, box / GRID_H);
  const offX = (size - GRID_W * scale) / 2;
  const offY = (size - GRID_H * scale) / 2;
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

  const groups = {};
  PIXEL_LOGO.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (!FILL[ch]) { x++; continue; }
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      const key = hex(FILL[ch]);
      (groups[key] = groups[key] || []).push(
        `<rect x="${(offX + x * scale).toFixed(2)}" y="${(offY + y * scale).toFixed(2)}"`
        + ` width="${(w * scale).toFixed(2)}" height="${scale.toFixed(2)}"/>`);
      x += w;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`
    + `<rect width="${size}" height="${size}" rx="${Math.round(size * RADIUS)}" fill="${hex(BG)}"/>`
    + Object.entries(groups).map(([f, r]) => `<g fill="${f}">${r.join('')}</g>`).join('')
    + '</svg>';
}

const out = `/* Erzeugt von scripts/gen-icons.mjs — nicht von Hand ändern.
   Die Bildmarke als PNG und ICO, damit auch Stellen ein Icon bekommen, die
   kein SVG lesen: Connector-Listen, Lesezeichen, Startbildschirme. */

const ICON_PNG_512 = '${png512.toString('base64')}';

const ICON_PNG_180 = '${png180.toString('base64')}';

const ICON_ICO = '${icoBuf.toString('base64')}';

const LOGO_SVG = ${JSON.stringify(svg())};
`;

writeFileSync(resolve(root, 'src/icons.js'), out);

const kb = (b) => (b.length / 1024).toFixed(1) + ' kB';
console.log(`src/icons.js  PNG 512 ${kb(png512)}, PNG 180 ${kb(png180)}, ICO ${kb(icoBuf)}`);
