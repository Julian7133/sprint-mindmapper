import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8731);
const HOST = '127.0.0.1';
const REPO_ROOT = path.resolve(__dirname, '..');
const RENDER_SCRIPT = path.join(REPO_ROOT, 'render-markmap.sh');
const EDITOR_ROOT = __dirname;

function getWorkspaceRoot() {
  if (process.env.WORKSPACE_ROOT) return path.resolve(process.env.WORKSPACE_ROOT);
  if (process.argv[2]) {
    const arg = path.resolve(process.argv[2]);
    if (arg.endsWith('.md') && fs.existsSync(arg)) {
      return path.dirname(arg);
    }
    return arg;
  }
  return REPO_ROOT;
}

function getDefaultFile() {
  if (process.env.DEFAULT_FILE) return process.env.DEFAULT_FILE;
  if (process.argv[2]?.endsWith('.md')) {
    return path.basename(path.resolve(process.argv[2]));
  }
  return 'sprint-tasks.md';
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};

let renderState = { status: 'idle', message: '', file: null };

function isLoopback(remoteAddress) {
  return (
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1'
  );
}

function isPathInsideRoot(absPath, root) {
  const normalized = path.resolve(absPath);
  const normalizedRoot = path.resolve(root);
  return (
    normalized === normalizedRoot ||
    normalized.startsWith(normalizedRoot + path.sep)
  );
}

function resolveWorkspaceFile(relPath) {
  const workspaceRoot = getWorkspaceRoot();
  const defaultFile = getDefaultFile();
  const rel = (relPath || defaultFile).replace(/^[/\\]+/, '');
  const safe = path.normalize(rel);
  if (safe.startsWith('..') || path.isAbsolute(safe)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  const abs = path.resolve(workspaceRoot, safe);
  if (!isPathInsideRoot(abs, workspaceRoot)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }
  return abs;
}

function draftPath(filePath) {
  if (process.env.CACHE_PATH && !process.env.DEFAULT_FILE && process.argv[2]?.endsWith('.md')) {
    return process.env.CACHE_PATH;
  }
  return `${filePath}.editor-draft`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
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

async function listMarkdownFiles(dir = getWorkspaceRoot(), base = '') {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const files = [];
  for (const ent of entries) {
    if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
    const rel = base ? `${base}/${ent.name}` : ent.name;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      files.push(...(await listMarkdownFiles(abs, rel)));
    } else if (ent.name.endsWith('.md')) {
      files.push(rel);
    }
  }
  return files.sort();
}

function runRenderMarkmap(filePath) {
  const workspaceRoot = getWorkspaceRoot();
  const relFile = path.relative(workspaceRoot, filePath) || path.basename(filePath);
  if (process.env.SKIP_RENDER === '1') {
    renderState = { status: 'done', message: 'Render skipped (test mode)', file: relFile };
    return;
  }
  if (renderState.status === 'running') return;
  renderState = { status: 'running', message: 'Rendering markmap…', file: relFile };

  const child = spawn('bash', [RENDER_SCRIPT, filePath], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('close', (code) => {
    if (code === 0) {
      renderState = { status: 'done', message: 'Markmap HTML updated', file: relFile };
    } else {
      renderState = {
        status: 'error',
        message: stderr.trim() || `render-markmap.sh exited with code ${code}`,
        file: relFile,
      };
    }
  });
}

function markmapHtmlPath(filePath) {
  return `${filePath.replace(/\.md$/i, '')}.html`;
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

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleApi(req, res, url) {
  const fileParam = url.searchParams.get('file');

  if (url.pathname === '/api/info' && req.method === 'GET') {
    const workspaceRoot = getWorkspaceRoot();
    const defaultFile = getDefaultFile();
    const active = fileParam || defaultFile;
    const filePath = resolveWorkspaceFile(active);
    const draftExists = fs.existsSync(draftPath(filePath));
    json(res, 200, {
      workspaceRoot,
      defaultFile,
      activeFile: path.relative(workspaceRoot, filePath) || path.basename(filePath),
      markdownPath: filePath,
      markdownName: path.basename(filePath),
      draftExists,
    });
    return;
  }

  if (url.pathname === '/api/files' && req.method === 'GET') {
    const defaultFile = getDefaultFile();
    const files = await listMarkdownFiles();
    json(res, 200, {
      files,
      defaultFile,
      activeFile: fileParam || defaultFile,
    });
    return;
  }

  if (url.pathname === '/api/files' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    let name = (body.name || 'untitled.md').replace(/^[/\\]+/, '');
    if (!name.endsWith('.md')) name += '.md';
    const filePath = resolveWorkspaceFile(name);
    if (fs.existsSync(filePath)) {
      json(res, 409, { error: 'File already exists' });
      return;
    }
    const title = name.replace(/\.md$/i, '').replace(/[-_]+/g, ' ');
    await writeTextAtomic(filePath, `# ${title}\n`);
    json(res, 201, {
      file: path.relative(getWorkspaceRoot(), filePath) || name,
    });
    return;
  }

  if (url.pathname === '/api/files/rename' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const fromPath = resolveWorkspaceFile(body.from);
    let toName = (body.to || '').replace(/^[/\\]+/, '');
    if (!toName.endsWith('.md')) toName += '.md';
    const toPath = resolveWorkspaceFile(toName);
    if (!fs.existsSync(fromPath)) {
      json(res, 404, { error: 'Source file not found' });
      return;
    }
    if (fs.existsSync(toPath)) {
      json(res, 409, { error: 'Target file already exists' });
      return;
    }
    await fsp.rename(fromPath, toPath);
    const fromDraft = draftPath(fromPath);
    const toDraft = draftPath(toPath);
    if (fs.existsSync(fromDraft)) {
      await fsp.rename(fromDraft, toDraft);
    }
    json(res, 200, {
      file: path.relative(getWorkspaceRoot(), toPath) || toName,
    });
    return;
  }


  if (url.pathname === '/api/markdown' && req.method === 'GET') {
    const filePath = resolveWorkspaceFile(fileParam);
    const text = await readTextFile(filePath, '# Untitled\n');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(text);
    return;
  }

  if (url.pathname === '/api/draft' && req.method === 'GET') {
    const filePath = resolveWorkspaceFile(fileParam);
    const text = await readTextFile(draftPath(filePath), '');
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(text);
    return;
  }

  if (url.pathname === '/api/draft' && req.method === 'PUT') {
    const filePath = resolveWorkspaceFile(fileParam);
    const body = (await readBody(req)).toString('utf8');
    await writeTextAtomic(draftPath(filePath), body);
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/api/markdown' && req.method === 'PUT') {
    const filePath = resolveWorkspaceFile(fileParam);
    const body = (await readBody(req)).toString('utf8');
    await writeTextAtomic(filePath, body);
    await writeTextAtomic(draftPath(filePath), body);
    runRenderMarkmap(filePath);
    json(res, 200, { ok: true, rendering: true });
    return;
  }

  if (url.pathname === '/api/markmap' && req.method === 'GET') {
    const filePath = resolveWorkspaceFile(fileParam);
    const htmlPath = markmapHtmlPath(filePath);
    const workspaceRoot = getWorkspaceRoot();
    if (!isPathInsideRoot(htmlPath, workspaceRoot) && !isPathInsideRoot(htmlPath, REPO_ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    try {
      const html = await fsp.readFile(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Markmap HTML not found — save the file first');
        return;
      }
      throw err;
    }
    return;
  }

  if (url.pathname === '/api/render-status' && req.method === 'GET') {
    json(res, 200, renderState);
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
      if (err.statusCode === 403) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
    }
    return;
  }

  serveStatic(url.pathname, res);
});

export {
  getWorkspaceRoot,
  getDefaultFile,
  resolveWorkspaceFile,
  listMarkdownFiles,
  isPathInsideRoot,
  draftPath,
};

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  server.listen(PORT, HOST, () => {
    console.log(`Workspace:     ${getWorkspaceRoot()}`);
    console.log(`Default file:  ${getDefaultFile()}`);
    console.log(`Editor:        http://${HOST}:${PORT}`);
  });
}
