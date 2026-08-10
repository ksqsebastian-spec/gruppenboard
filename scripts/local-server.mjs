/**
 * Startet dist/worker.js lokal auf http://127.0.0.1:8788 mit node:sqlite als D1.
 *   node --experimental-sqlite scripts/local-server.mjs
 * Nur für Entwicklung und Tests — die Daten liegen im Arbeitsspeicher.
 */
import { createServer } from 'node:http';
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

for (const file of ['schema.sql', 'seed.sql']) {
  for (const s of statements(readFileSync(resolve(root, file), 'utf8'))) db.exec(s + ';');
}

const D1 = {
  prepare(sql) {
    const st = { args: [] };
    return {
      bind(...a) { st.args = a.map((x) => (x === undefined ? null : (typeof x === 'boolean' ? Number(x) : x))); return this; },
      async run() { return { success: true, meta: db.prepare(sql).run(...st.args) }; },
      async first() { return db.prepare(sql).get(...st.args) ?? null; },
      async all() { return { results: db.prepare(sql).all(...st.args) }; },
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

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request('http://127.0.0.1:8788' + req.url, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  });
  const out = await worker.fetch(request, { DB: D1, MEDIA });
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(8788, '127.0.0.1', () => console.log('Mikdaten lokal auf http://127.0.0.1:8788'));
