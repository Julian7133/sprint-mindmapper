import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNativeFolderController } from '../../src/native-core.mjs';

function makeFs() {
  // Keys are the canonical absolute path (`root/rel`) so the fake mirrors the
  // real Rust contract: it receives rootDir + relPath and can itself reject an
  // escaping relPath, exactly like the authoritative Rust boundary.
  const files = new Map(); // abs -> text
  function join(root, rel) {
    const r = rel.replace(/^[/\\]+/, '');
    if (r.split(/[/\\]/).some((s) => s === '..' || s === '.' || !s)) {
      throw new Error(`path escapes root: ${rel}`);
    }
    return root.replace(/\/+$/, '') + '/' + r;
  }
  return {
    files,
    async listMarkdown(root) {
      if (root === '/gone') throw new Error('Not a directory: /gone');
      const rootPrefix = root.replace(/\/+$/, '') + '/';
      const out = [];
      for (const abs of files.keys()) {
        if (!abs.startsWith(rootPrefix)) continue;
        const rel = abs.slice(rootPrefix.length);
        const segments = rel.split('/');
        if (segments.some((s) => s.startsWith('.') || s === 'node_modules')) continue;
        if (rel.endsWith('.md') && !rel.endsWith('.editor-draft')) out.push(rel);
      }
      return out.sort();
    },
    async readText(root, rel) {
      const abs = join(root, rel);
      if (!files.has(abs)) throw new Error(`ENOENT ${abs}`);
      return files.get(abs);
    },
    async writeText(root, rel, text) {
      files.set(join(root, rel), text);
    },
    async deleteFile(root, rel) {
      files.delete(join(root, rel));
    },
    async exists(root, rel) {
      return files.has(join(root, rel));
    },
  };
}

function makeStore() {
  let record = null;
  const drafts = new Map();
  return {
    record,
    drafts,
    async readSavedFolderRecord() {
      return record;
    },
    async writeSavedFolderRecord(r) {
      record = r;
    },
    async clearSavedFolderRecord() {
      record = null;
    },
    async readDraft(k) {
      return drafts.get(k) || '';
    },
    async writeDraft(k, t) {
      drafts.set(k, t);
    },
    async deleteDraft(k) {
      drafts.delete(k);
    },
  };
}

const ROOT = '/Users/x/docs';

function makeController(overrides = {}) {
  const fs = makeFs();
  const store = makeStore();
  const controller = createNativeFolderController({
    store,
    fs,
    render: overrides.render ?? (async (md) => `<html>${md}</html>`),
    importer: null,
  });
  controller.setImporter({
    convert: async () => ({ markdown: '# imported\n', suggestedName: 'imported.md' }),
  });
  return { controller, fs, store };
}

test('adopt + getInfo lists files and active', async () => {
  const { controller, fs } = makeController();
  fs.files.set(`${ROOT}/plan.md`, '# Plan');
  await controller.adoptFromPath(ROOT);
  const info = await controller.getInfo();
  assert.equal(info.folderName, 'docs');
  assert.equal(info.activeFile, 'plan.md');
  assert.deepEqual(info.files, ['plan.md']);
  assert.equal(info.mode, 'folder');
});

test('createFile writes heading and returns rel', async () => {
  const { controller, fs } = makeController();
  await controller.adoptFromPath(ROOT);
  const rel = await controller.createFile('sprint-1');
  assert.equal(rel, 'sprint-1.md');
  assert.equal(fs.files.get(`${ROOT}/sprint-1.md`), '# sprint 1\n');
});

test('saveMarkdown writes md + html + draft, getMarkmapHtml returns html', async () => {
  const { controller, fs } = makeController();
  await controller.adoptFromPath(ROOT);
  await controller.saveMarkdown('a.md', '# A');
  assert.equal(fs.files.get(`${ROOT}/a.md`), '# A');
  assert.equal(fs.files.get(`${ROOT}/a.html`), '<html># A</html>');
  assert.equal((await controller.getMarkmapHtml('a.md')), '<html># A</html>');
  assert.equal(await controller.getMarkmapHtml('missing.md'), null);
});

test('renameFile copies content + migrates draft', async () => {
  const { controller, fs } = makeController();
  await controller.adoptFromPath(ROOT);
  await controller.writeDraft('a.md', 'draft-a');
  fs.files.set(`${ROOT}/a.md`, '# A');
  const rel = await controller.renameFile('a.md', 'b.md');
  assert.equal(rel, 'b.md');
  assert.equal(fs.files.get(`${ROOT}/b.md`), '# A');
  assert.equal(fs.files.has(`${ROOT}/a.md`), false);
  assert.equal(await controller.readDraft('b.md'), 'draft-a');
  assert.equal(await controller.readDraft('a.md'), '');
});

test('importBinary dedupes colliding names', async () => {
  const { controller, fs } = makeController();
  await controller.adoptFromPath(ROOT);
  fs.files.set(`${ROOT}/imported.md`, '# existing');
  const { file } = await controller.importBinary('imported.xmind', new Uint8Array());
  assert.equal(file, 'imported-2.md');
  assert.equal(fs.files.get(`${ROOT}/imported-2.md`), '# imported\n');
});

test('persistSession + restore round-trips openTabs/active', async () => {
  const { controller, store } = makeController();
  await controller.adoptFromPath(ROOT);
  await controller.persistSession({ openTabs: ['a.md', 'b.md'], activeFile: 'b.md' });
  assert.equal(controller.getOpenTabs().length, 2);
  const record = await store.readSavedFolderRecord();
  assert.equal(record.rootDir, ROOT);

  const fs2 = makeFs();
  const store2 = makeStore();
  const c2 = createNativeFolderController({
    store: store2,
    fs: fs2,
    render: async (md) => `<html>${md}</html>`,
    importer: null,
  });
  store2.writeSavedFolderRecord(record);
  await c2.restore(await store2.readSavedFolderRecord());
  assert.equal(c2.getActiveFile(), 'b.md');
  assert.deepEqual(c2.getOpenTabs(), ['a.md', 'b.md']);
});

test('dismiss clears the saved record', async () => {
  const { controller } = makeController();
  await controller.adoptFromPath(ROOT);
  await controller.dismiss();
  assert.equal(controller.isConnected(), false);
});

test('readMarkdown/saveMarkdown reject a path that escapes the root', async () => {
  const { controller, fs } = makeController();
  await controller.adoptFromPath(ROOT);
  await assert.rejects(() => controller.readMarkdown('../secret.md'));
  await assert.rejects(() => controller.saveMarkdown('../evil.md', '# nope'));
  await assert.rejects(() => controller.renameFile('a.md', '../evil.md'));
  assert.equal(fs.files.has(`${ROOT}/../evil.md`), false);
});

test('saveMarkdown passes only the relPath (never an absolute) to fs', async () => {
  const writes = [];
  const fs = makeFs();
  const store = makeStore();
  const controller = createNativeFolderController({
    store,
    fs: {
      ...fs,
      async writeText(root, rel, text) {
        writes.push({ root, rel, text });
        await fs.writeText(root, rel, text);
      },
    },
    render: async (md) => `<html>${md}</html>`,
    importer: null,
  });
  await controller.adoptFromPath(ROOT);
  await controller.saveMarkdown('a.md', '# A');
  const mdWrite = writes.find((w) => w.rel === 'a.md');
  const htmlWrite = writes.find((w) => w.rel === 'a.html');
  assert.equal(mdWrite.root, ROOT);
  assert.equal(htmlWrite.root, ROOT);
  assert.equal(mdWrite.rel.startsWith('/'), false);
  assert.equal(htmlWrite.rel.startsWith('/'), false);
});

test('restore rejects when the persisted root no longer exists', async () => {
  const { controller } = makeController();
  await assert.rejects(
    () => controller.restore({ rootDir: '/gone', folderId: 'f', activeFile: 'a.md' }),
    /Folder no longer available/
  );
  assert.equal(controller.isConnected(), false);
});
