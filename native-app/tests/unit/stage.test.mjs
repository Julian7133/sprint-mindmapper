import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndexHtml, stage } from '../../scripts/stage.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..'); // native-app
const REPO = resolve(ROOT, '..');
const DIST = join(ROOT, 'dist');

const EDITOR_HTML = readFileSync(join(REPO, 'editor/index.html'), 'utf8');

test('buildIndexHtml rewrites paths and injects native bridge', () => {
  const html = buildIndexHtml(EDITOR_HTML);

  assert.match(html, /<title>AuraMindmap<\/title>/);
  assert.match(html, /<h1>AuraMindmap<\/h1>/);

  // No root-absolute asset references remain (Tauri asset protocol root).
  assert.ok(!/href="\//.test(html), 'no absolute hrefs');
  assert.ok(!html.includes('src="/app.js"'), 'no absolute script');
  assert.ok(!html.includes('/manifest.webmanifest'), 'no PWA manifest');

  // Relative rewrites applied.
  assert.ok(html.includes('href="./vendor/style.css"'));
  assert.ok(html.includes('href="./style.css"'));
  assert.ok(html.includes('href="./icons/icon.svg"'));

  // Native bridge injected before app.js.
  const nativeIdx = html.indexOf('native-bridge.bundle.js');
  const appIdx = html.indexOf('src="./app.js"');
  assert.ok(nativeIdx !== -1 && appIdx !== -1);
  assert.ok(nativeIdx < appIdx, 'bridge loads before app.js');
});

test('stage() produces a wired dist with the workspace re-export', () => {
  stage();

  for (const file of [
    'index.html',
    'app.js',
    'style.css',
    'workspace.mjs',
    'workspace-native.mjs',
    'native-bridge.mjs',
    'native-core.mjs',
    'native-paths.mjs',
    'native-store.mjs',
    'markmap-render.mjs',
    'embedded-assets.mjs',
    'paste-nodes.mjs',
    'link-index.mjs',
  ]) {
    assert.ok(existsSync(join(DIST, file)), `dist/${file} exists`);
  }

  const wsReexport = readFileSync(join(DIST, 'workspace.mjs'), 'utf8');
  assert.match(wsReexport, /workspace-native\.bundle\.js/);

  assert.ok(existsSync(join(DIST, 'vendor/MindElixir.js')), 'vendor copied');
  assert.ok(existsSync(join(DIST, 'icons/icon.svg')), 'icon copied');
});
