/**
 * Baut aus src/ einen einzelnen Worker-Bundle nach dist/worker.js.
 * HTML, CSS und JS werden inline eingebettet — kein Asset-Hosting nötig.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

const css = read('src/styles.css');
const js = read('src/pixel-avatars.js') + '\n' + read('src/app.js');

const html = read('src/index.html')
  .replace('__APP_CSS__', () => css)
  .replace('__APP_JS__', () => js);

const mcp = read('src/mcp.js');
const icons = read('src/icons.js');

const worker = read('src/worker.js')
  .replace('__ICONS__', () => icons)
  .replace('__MCP_MODULE__', () => mcp)
  .replace('__APP_HTML__', () => JSON.stringify(html));

mkdirSync(resolve(root, 'dist'), { recursive: true });
writeFileSync(resolve(root, 'dist/worker.js'), worker);

const kb = (s) => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(1) + ' kB';
console.log(`dist/worker.js  ${kb(worker)}   (CSS ${kb(css)}, JS ${kb(js)}, HTML ${kb(html)}, MCP ${kb(mcp)})`);
