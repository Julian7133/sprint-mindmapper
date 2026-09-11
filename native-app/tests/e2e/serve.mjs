import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tiny static file server for the staged native frontend (native-app/dist).
 * Used only by the Playwright e2e harness — it serves the real bundles
 * (workspace-native / native-bridge / app.js) so the tests exercise the exact
 * code that ships in the Tauri app, with the Tauri IPC layer shimmed in-page
 * (see tauri-mock.js). No Tauri runtime, no Linux, no WebDriver required.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../dist');
const PORT = Number(process.env.PORT || 8744);
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const abs = path.resolve(DIST, rel);
  if (!abs.startsWith(DIST)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  fs.readFile(abs, (err, buf) => {
    if (err) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(abs)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`native e2e static server on http://${HOST}:${PORT} (dist=${DIST})`);
});
