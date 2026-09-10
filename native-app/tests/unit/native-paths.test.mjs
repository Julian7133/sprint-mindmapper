import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitRelPath,
  resolveWithin,
  markmapRelPath,
  draftKey,
  validateRootDir,
} from '../../src/native-paths.mjs';

test('splitRelPath normalizes separators and empty segments', () => {
  assert.deepEqual(splitRelPath('foo/bar.md'), { parts: ['foo', 'bar.md'], ok: true });
  assert.deepEqual(splitRelPath('/foo\\bar/baz.md').parts, ['foo', 'bar', 'baz.md']);
  assert.equal(splitRelPath('').ok, false);
  assert.equal(splitRelPath('/').ok, false);
});

test('splitRelPath rejects traversal segments', () => {
  assert.equal(splitRelPath('../etc/passwd').ok, false);
  assert.equal(splitRelPath('a/../../b').ok, false);
  assert.equal(splitRelPath('a/./b').ok, false);
});

test('resolveWithin joins root and stays inside it', () => {
  assert.equal(resolveWithin('/Users/x/docs', 'planning/sprint-1.md'), '/Users/x/docs/planning/sprint-1.md');
  assert.throws(() => resolveWithin('/Users/x/docs', '../secret.md'));
  assert.throws(() => resolveWithin('/Users/x/docs', 'a/../../secret.md'));
});

test('markmapRelPath swaps .md for .html', () => {
  assert.equal(markmapRelPath('plan.md'), 'plan.html');
  assert.equal(markmapRelPath('a/b.PLAN.MD'), 'a/b.PLAN.html');
});

test('draftKey namespaces by folderId', () => {
  assert.equal(draftKey('f1', 'a.md'), 'f1:a.md');
});

test('validateRootDir rejects empty/non-string', () => {
  assert.equal(validateRootDir(''), null);
  assert.equal(validateRootDir(null), null);
  assert.equal(validateRootDir(undefined), null);
  assert.equal(validateRootDir('/Users/x'), '/Users/x');
});
