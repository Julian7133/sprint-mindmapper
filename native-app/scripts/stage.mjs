import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeEmbeddedAssetsModule } from './build-assets.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = join(ROOT, 'dist');
const REPO = resolve(ROOT, '..');
const EDITOR = join(REPO, 'editor');
const EXT = join(REPO, 'extension');

/**
 * Shared editor modules that app.js imports. These have no bare package
 * imports and are served as relative ESM over the Tauri asset protocol, so we
 * copy them verbatim (no bundling, no divergence from the browser editor).
 */
const SHARED_EDITOR_FILES = [
  'app.js',
  'markmap-convert.mjs',
  'markers.mjs',
  'marker-picker.mjs',
  'priority-hotkeys.mjs',
  'type-to-edit.mjs',
  'paste-nodes.mjs',
  'tab-state.mjs',
  'link-picker.mjs',
  'backlinks-panel.mjs',
  'link-index.mjs',
  'link-target.mjs',
  'import-formats.mjs',
  'style.css',
];

const NATIVE_SRC_FILES = [
  'workspace-native.mjs',
  'native-core.mjs',
  'native-paths.mjs',
  'native-store.mjs',
  'native-bridge.mjs',
];

function assertReplaced(html, needle, label) {
  if (!html.includes(needle)) {
    throw new Error(`stage: index.html transform failed to find "${label}"`);
  }
}

export function buildIndexHtml(editorHtml) {
  let html = editorHtml;

  // Precise, non-colliding literals. Note `href="/style.css"` (with the
  // leading quote) never matches inside `href="./vendor/style.css"`.
  const transforms = [
    ['<link rel="manifest" href="/manifest.webmanifest" />', '', false],
    ['<title>Mindmap Editor</title>', '<title>AuraMindmap</title>', false],
    ['content="Sprint Map"', 'content="AuraMindmap"', false],
    ['<h1>Sprint Mindmap Editor</h1>', '<h1>AuraMindmap</h1>', false],
    ['href="/vendor/style.css"', 'href="./vendor/style.css"', false],
    ['href="/style.css"', 'href="./style.css"', false],
    ['href="/icons/icon.svg"', 'href="./icons/icon.svg"', true],
    ['src="/app.js"', 'src="./app.js"', false],
    ['>Use server workspace</button>', '>Choose folder</button>', false],
  ];

  for (const [from, to, all] of transforms) {
    assertReplaced(html, from, from);
    html = all ? html.split(from).join(to) : html.replace(from, to);
  }

  const appScript = '<script type="module" src="./app.js"></script>';
  assertReplaced(html, appScript, 'app script');
  html = html.replace(
    appScript,
    '<script type="module" src="./native-bridge.bundle.js"></script>\n    ' +
      appScript
  );

  return html;
}

export function stage() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  mkdirSync(join(DIST, 'vendor'), { recursive: true });
  mkdirSync(join(DIST, 'icons'), { recursive: true });

  // Shared editor sources (verbatim).
  for (const file of SHARED_EDITOR_FILES) {
    cpSync(join(EDITOR, file), join(DIST, file));
  }

  // Vendor assets (MindElixir JS + its CSS) referenced by index.html / app.js.
  cpSync(join(EDITOR, 'vendor'), join(DIST, 'vendor'), { recursive: true });

  // Favicon for the native window.
  cpSync(join(EDITOR, 'icons/icon.svg'), join(DIST, 'icons/icon.svg'));

  // In-browser markmap renderer source (single canonical copy lives in the
  // extension). It is bundled into workspace-native.bundle.js at build time.
  cpSync(join(EXT, 'editor/markmap-render.mjs'), join(DIST, 'markmap-render.mjs'));

  // Native-only sources.
  for (const file of NATIVE_SRC_FILES) {
    cpSync(join(ROOT, 'src', file), join(DIST, file));
  }

  // The workspace swap point — a real re-export file (MV3/CSP-safe pattern),
  // mirroring how the extension redirects to its native workspace.
  writeFileSync(
    join(DIST, 'workspace.mjs'),
    "export { createWorkspace } from './workspace-native.bundle.js';\n"
  );

  // Embedded CDN assets used by the markmap renderer.
  writeEmbeddedAssetsModule();

  // index.html with path rewrites + native bridge injection.
  const editorHtml = readFileSync(join(EDITOR, 'index.html'), 'utf8');
  writeFileSync(join(DIST, 'index.html'), buildIndexHtml(editorHtml));

  console.log(`Staged frontend into ${DIST}`);
  return DIST;
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) stage();
