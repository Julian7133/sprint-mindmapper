import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInternalTarget,
  parseTarget,
  formatInternalTarget,
  normalizeTargetFile,
  isSafeExternalUrl,
  resolveNodeRef,
  decodeTopicPath,
  topicPathFromNode,
} from '../../link-target.mjs';

function tree() {
  return {
    id: 'root',
    topic: 'Root',
    children: [
      { id: 'a1', topic: 'Alpha', children: [{ id: 'a2', topic: 'Nested', children: [] }] },
      { id: 'b1', topic: 'Beta', children: [] },
      { id: 'b2', topic: 'Beta', children: [] },
    ],
  };
}

test('parseTarget: external href passes through', () => {
  assert.equal(isInternalTarget('https://x.com'), false);
  const t = parseTarget('https://x.com');
  assert.equal(t.internal, false);
  assert.equal(t.href, 'https://x.com');
});

test('parseTarget: map whole-file target', () => {
  const t = parseTarget('map:sub/foo.md');
  assert.equal(t.internal, true);
  assert.equal(t.file, 'sub/foo.md');
  assert.equal(t.nodeRef, null);
});

test('parseTarget: map node target with url-encoded ref', () => {
  const t = parseTarget('map:foo.md#me3');
  assert.equal(t.file, 'foo.md');
  assert.equal(t.nodeRef, 'me3');
  const t2 = parseTarget('map:foo.md#my%20task');
  assert.equal(t2.nodeRef, 'my task');
});

test('parseTarget: rejects empty map target', () => {
  assert.equal(parseTarget('map:'), null);
});

test('formatInternalTarget: round-trips file and node ref', () => {
  const href = formatInternalTarget('foo.md', 'me3');
  assert.equal(href, 'map:foo.md#me3');
  const parsed = parseTarget(href);
  assert.equal(parsed.file, 'foo.md');
  assert.equal(parsed.nodeRef, 'me3');
});

test('resolveNodeRef: empty ref resolves to root', () => {
  const r = resolveNodeRef(tree(), null);
  assert.equal(r.mode, 'root');
  assert.equal(r.node.id, 'root');
});

test('resolveNodeRef: resolves by exact id', () => {
  const r = resolveNodeRef(tree(), 'a2');
  assert.equal(r.mode, 'id');
  assert.equal(r.node.topic, 'Nested');
});

test('resolveNodeRef: topic-path fallback for missing id', () => {
  const r = resolveNodeRef(tree(), 'Alpha/Nested');
  assert.equal(r.mode, 'path');
  assert.equal(r.node.topic, 'Nested');
  assert.equal(r.broken, false);
});

test('resolveNodeRef: broken path degrades to deepest match', () => {
  const r = resolveNodeRef(tree(), 'Alpha/Missing/Deep');
  assert.equal(r.mode, 'path');
  assert.equal(r.broken, true);
  assert.equal(r.node.topic, 'Alpha');
});

test('resolveNodeRef: unresolved garbage falls back to root, broken', () => {
  const r = resolveNodeRef(tree(), 'zzz');
  assert.equal(r.mode, 'path');
  assert.equal(r.broken, true);
  assert.equal(r.node.id, 'root');
});

test('decodeTopicPath splits and decodes segments', () => {
  assert.deepEqual(decodeTopicPath('Alpha/Beta'), ['Alpha', 'Beta']);
  assert.deepEqual(decodeTopicPath('my%20task/sub'), ['my task', 'sub']);
});

test('topicPathFromNode builds root->node topic breadcrumb', () => {
  const root = tree();
  const nested = root.children[0].children[0];
  assert.deepEqual(topicPathFromNode(root, nested), ['Alpha', 'Nested']);
});

test('normalizeTargetFile: accepts safe relative nested .md paths', () => {
  assert.equal(normalizeTargetFile('foo.md'), 'foo.md');
  assert.equal(normalizeTargetFile('sub/dir/map.md'), 'sub/dir/map.md');
  assert.equal(normalizeTargetFile('  spaced name.md  '), 'spaced name.md');
});

test('normalizeTargetFile: rejects unsafe paths', () => {
  const bad = [
    '',
    '   ',
    '/abs/foo.md',
    '\\abs\\foo.md',
    'foo\\bar.md',
    '../foo.md',
    'a/../foo.md',
    './foo.md',
    'a/./foo.md',
    'foo',
    'foo.txt',
    'foo#bar.md',
    'foo.md\u0000',
    'foo\nbar.md',
  ];
  for (const p of bad) {
    assert.equal(normalizeTargetFile(p), null, `should reject ${JSON.stringify(p)}`);
  }
});

test('isSafeExternalUrl: only http/https accepted', () => {
  assert.equal(isSafeExternalUrl('https://example.com'), true);
  assert.equal(isSafeExternalUrl('http://example.com/x'), true);
  const bad = ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://x', 'not a url', ''];
  for (const u of bad) assert.equal(isSafeExternalUrl(u), false, `should reject ${u}`);
});

test('parseTarget: rejects unsafe internal targets as null', () => {
  assert.equal(parseTarget('map:../evil.md'), null);
  assert.equal(parseTarget('map:/abs/foo.md'), null);
  assert.equal(parseTarget('map:foo'), null);
  assert.equal(parseTarget('map:foo.txt'), null);
});

test('parseTarget: strips control chars from nodeRef -> null ref', () => {
  const t = parseTarget('map:foo.md#me%00x');
  assert.equal(t.nodeRef, null);
});

test('formatInternalTarget: returns null for unsafe file', () => {
  assert.equal(formatInternalTarget('../evil.md', 'me1'), null);
  assert.equal(formatInternalTarget('foo', 'me1'), null);
});
