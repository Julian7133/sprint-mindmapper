/**
 * In-page Tauri IPC shim for the Playwright/WebKit native e2e harness.
 *
 * The real native frontend (workspace-native / native-core / native-store /
 * native-bridge, bundled into dist/) talks to the Rust backend exclusively
 * through `window.__TAURI_INTERNALS__`. In the Tauri app that object bridges to
 * Rust; here we install a faithful stand-in backed by an in-memory filesystem
 * and store, so the exact shipping code runs in a plain WebKit page.
 *
 * This is `addInitScript`-serialized, so it must be fully self-contained (no
 * imports, no outer references). Configuration (fixture files + saved-folder
 * record) is passed in as the single argument.
 *
 * Command payloads mirror what the bundles emit (verified against dist/):
 *   fs:      list_markdown{rootDir} read_text_file{rootDir,relPath}
 *            write_text_file{rootDir,relPath,text} delete_file{rootDir,relPath}
 *            path_exists{rootDir,relPath} open_markmap_in_default_app{...}
 *   window:  open_new_window{file}
 *   dialog:  plugin:dialog|open{options}
 *   opener:  plugin:opener|open_url{url}
 *   store:   plugin:store|load{path}->rid, get_store{path}->rid|null,
 *            set{rid,key,value} get{rid,key}->[value,exists] has{rid,key}
 *            delete{rid,key} save{rid} keys/values/entries/length/clear/reset
 *   event:   plugin:event|listen{event,handler}->eventId, unlisten
 */
export function installTauriMock(config) {
  const files = new Map(Object.entries(config.files || {}));
  const rootDir = config.rootDir || '/fixtures';

  // Per-path key/value stores (meta.json, drafts.json). Seeded from config.
  const stores = new Map(); // path -> Map(key->value)
  for (const [p, obj] of Object.entries(config.stores || {})) {
    stores.set(p, new Map(Object.entries(obj)));
  }
  const ridToPath = new Map();
  let nextRid = 1;

  function storeFor(path) {
    if (!stores.has(path)) stores.set(path, new Map());
    return stores.get(path);
  }

  // Observability for assertions.
  const calls = [];
  window.__tauriCalls = calls;
  window.__tauriDialogResult = config.dialogResult ?? null;

  // Event dispatch (menu bridge uses listen()).
  const callbacks = new Map(); // id -> fn
  const listeners = new Map(); // event -> Set<callbackId>
  let nextCallbackId = 1;
  let nextEventId = 1;

  window.__tauriMockEmit = (event, payload) => {
    const ids = listeners.get(event);
    if (!ids) return 0;
    let fired = 0;
    for (const id of ids) {
      const fn = callbacks.get(id);
      if (fn) {
        fn({ event, id, payload });
        fired += 1;
      }
    }
    return fired;
  };

  function listMarkdown() {
    return [...files.keys()].filter((r) => /\.md$/i.test(r)).sort();
  }

  async function invoke(cmd, args = {}) {
    calls.push({ cmd, args });

    // ---- Filesystem (custom Rust commands) ----
    if (cmd === 'list_markdown') return listMarkdown();
    if (cmd === 'read_text_file') {
      if (!files.has(args.relPath)) throw new Error(`ENOENT: ${args.relPath}`);
      return files.get(args.relPath);
    }
    if (cmd === 'write_text_file') {
      files.set(args.relPath, args.text);
      return null;
    }
    if (cmd === 'delete_file') {
      files.delete(args.relPath);
      return null;
    }
    if (cmd === 'path_exists') return files.has(args.relPath);
    if (cmd === 'open_markmap_in_default_app') return null;
    if (cmd === 'open_new_window') return null;

    // ---- Plugins ----
    if (cmd === 'plugin:dialog|open') return window.__tauriDialogResult;
    if (cmd === 'plugin:opener|open_url') return null;
    if (cmd === 'plugin:resources|close') return null;

    if (cmd === 'plugin:event|listen') {
      const set = listeners.get(args.event) || new Set();
      set.add(args.handler);
      listeners.set(args.event, set);
      return nextEventId++;
    }
    if (cmd === 'plugin:event|unlisten') return null;

    // ---- Store ----
    if (cmd === 'plugin:store|load') {
      const rid = nextRid++;
      ridToPath.set(rid, args.path);
      storeFor(args.path);
      return rid;
    }
    if (cmd === 'plugin:store|get_store') {
      for (const [rid, p] of ridToPath) if (p === args.path) return rid;
      return null;
    }
    if (cmd.startsWith('plugin:store|')) {
      const op = cmd.slice('plugin:store|'.length);
      const path = ridToPath.get(args.rid);
      const store = storeFor(path);
      switch (op) {
        case 'set':
          store.set(args.key, args.value);
          return null;
        case 'get':
          return store.has(args.key) ? [store.get(args.key), true] : [null, false];
        case 'has':
          return store.has(args.key);
        case 'delete': {
          const had = store.delete(args.key);
          return had;
        }
        case 'save':
        case 'reload':
        case 'reset':
          return null;
        case 'clear':
          store.clear();
          return null;
        case 'keys':
          return [...store.keys()];
        case 'values':
          return [...store.values()];
        case 'entries':
          return [...store.entries()];
        case 'length':
          return store.size;
        default:
          return null;
      }
    }

    throw new Error(`tauri-mock: unhandled command "${cmd}"`);
  }

  window.__TAURI_INTERNALS__ = {
    invoke,
    transformCallback(fn) {
      const id = nextCallbackId++;
      callbacks.set(id, fn);
      return id;
    },
    unregisterCallback(id) {
      callbacks.delete(id);
    },
    // Some builds probe metadata; harmless defaults.
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
  };
}
