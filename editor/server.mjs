import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8731);
const HOST = '127.0.0.1';
const MARKDOWN_PATH = resolveMarkdownPath();
const CACHE_PATH =
  process.env.CACHE_PATH || `${MARKDOWN_PATH}.editor-draft`;
const REPO_ROOT = path.resolve(__dirname, '..');
const RENDER_SCRIPT = path.join(REPO_ROOT, 'render-markmap.sh');
const EDITOR_ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};

let renderState = { status: 'idle', message: '' };

function resolveMarkdownPath() {
  if (process.argv[2]) return path.resolve(process.argv[2]);
  if (process.env.MARKDOWN_PATH) return path.resolve(process.env.MARKDOWN_PATH);
  return path.resolve(__dirname, '..', 'sprint-tasks.md');
}

function isLoopback(remoteAddress) {
  return (
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1'
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readTextFile(filePath, fallback) {
  try {
    return await fsp.readFile(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeTextAtomic(filePath, body) {
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tmp, body, 'utf8');
  await fsp.rename(tmp, filePath);
}

function runRenderMarkmap() {
  if (process.env.SKIP_RENDER === '1') {
    renderState = { status: 'done', message: 'Render skipped (test mode)' };
    return;
  }
  if (renderState.status === 'running') return;
  renderState = { status: 'running', message: 'Rendering markmap…' };

  const child = spawn('bash', [RENDER_SCRIPT, MARKDOWN_PATH], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('close', (code) => {
    if (code === 0) {
      renderState = { status: 'done', message: 'Markmap HTML updated' };
    } else {
      renderState = {
        status: 'error',
        message: stderr.trim() || `render-markmap.sh exited with code ${code}`,
      };
    }
  });
}

function serveStatic(urlPath, res) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const safe = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(EDITOR_ROOT, safe);

  if (!filePath.startsWith(EDITOR_ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/info' && req.method === 'GET') {
    const draftExists = fs.existsSync(CACHE_PATH);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        markdownPath: MARKDOWN_PATH,
        markdownName: path.basename(MARKDOWN_PATH),
        cachePath: CACHE_PATH,
        draftExists,
      })
    );
    return;
  }

  if (url.pathname === '/api/markdown' && req.method === 'GET') {
    const text = await readTextFile(MARKDOWN_PATH, '# Sprint Tasks\n');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(text);
    return;
  }

  if (url.pathname === '/api/draft' && req.method === 'GET') {
    const text = await readTextFile(CACHE_PATH, '');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(text);
    return;
  }

  if (url.pathname === '/api/draft' && req.method === 'PUT') {
    const body = await readBody(req);
    await writeTextAtomic(CACHE_PATH, body);
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/api/markdown' && req.method === 'PUT') {
    const body = await readBody(req);
    await writeTextAtomic(MARKDOWN_PATH, body);
    await writeTextAtomic(CACHE_PATH, body);
    runRenderMarkmap();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, rendering: true }));
    return;
  }

  if (url.pathname === '/api/render-status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(renderState));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

const server = http.createServer(async (req, res) => {
  if (!isLoopback(req.socket.remoteAddress)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, url);
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    }
    return;
  }

  serveStatic(url.pathname, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Markdown file: ${MARKDOWN_PATH}`);
  console.log(`Draft cache:   ${CACHE_PATH}`);
  console.log(`Editor:        http://${HOST}:${PORT}`);
});
