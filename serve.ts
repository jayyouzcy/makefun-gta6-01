// serve.ts — tiny static server for local playtesting only (not part of the
// entry's game). Serves game/ on http://localhost:8080: `node serve.ts`.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const port = Number(process.argv[2]) || 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
};
createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = resolve(join(root, normalize(p)));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end('forbidden'); return; }
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end('not found'); }
}).listen(port, '127.0.0.1', () => console.log(`game/ is on http://localhost:${port}`));
