const CACHE_NAME = 'auramindmap-ext-v1';

const SHELL_PATHS = [
  'editor/index.html',
  'editor/app.js',
  'editor/style.css',
  'editor/workspace.mjs',
  'editor/workspace-extension.mjs',
  'editor/workspace-storage.mjs',
  // markmap-bundle.js is the browser-resolvable esbuild output (markmap-lib/-view
  // inlined). The source markmap-render.mjs is a build input only — not shipped/cached.
  'editor/markmap-bundle.js',
  'editor/markmap-convert.mjs',
  'editor/markers.mjs',
  'editor/marker-picker.mjs',
  'editor/priority-hotkeys.mjs',
  'editor/type-to-edit.mjs',
  'editor/paste-nodes.mjs',
  'editor/import-formats.mjs',
  'editor/vendor/MindElixir.js',
  'editor/vendor/style.css',
];

const SHELL_URLS = SHELL_PATHS.map((path) => `${self.location.origin}/${path}`);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('auramindmap-ext-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
