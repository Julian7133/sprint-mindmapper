import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  resolveWorkspaceFile,
  listMarkdownFiles,
  isPathInsideRoot,
} from '../../server.mjs';

let tmpDir;

before(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mindmap-ws-'));
  await fsp.writeFile(path.join(tmpDir, 'alpha.md'), '# Alpha\n');
  await fsp.mkdir(path.join(tmpDir, 'nested'), { recursive: true });
  await fsp.writeFile(path.join(tmpDir, 'nested', 'beta.md'), '# Beta\n');
  process.env.WORKSPACE_ROOT = tmpDir;
  process.env.DEFAULT_FILE = 'alpha.md';
});

after(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true });
  delete process.env.WORKSPACE_ROOT;
  delete process.env.DEFAULT_FILE;
});

describe('server workspace', () => {
  it('lists markdown files recursively', async () => {
    const files = await listMarkdownFiles(tmpDir);
    assert.deepEqual(files, ['alpha.md', 'nested/beta.md']);
  });

  it('resolves files within workspace', () => {
    const resolved = resolveWorkspaceFile('nested/beta.md');
    assert.equal(resolved, path.join(tmpDir, 'nested', 'beta.md'));
  });

  it('rejects path traversal', () => {
    assert.throws(() => resolveWorkspaceFile('../../etc/passwd'), (err) => {
      return err.statusCode === 403;
    });
  });

  it('isPathInsideRoot guards nested paths', () => {
    assert.equal(isPathInsideRoot(path.join(tmpDir, 'alpha.md'), tmpDir), true);
    assert.equal(isPathInsideRoot('/etc/passwd', tmpDir), false);
  });
});
