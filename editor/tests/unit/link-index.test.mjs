import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../../markmap-convert.mjs';
import {
  collectLinksFromRoot,
  buildIndex,
  indexMarkdowns,
  getBacklinks,
} from '../../link-index.mjs';

const mdA = [
  '# Map A',
  '## Section A1',
  '- [task A1](map:map-b.md#nb1)',
  '- [to B node](map:map-b.md#nb2)',
  '- [external](https://example.com)',
  '- [self link](map:map-a.md#na1)',
  '- [plain](map:map-b.md)',
].join('\n');

const mdB = [
  '# Map B',
  '## Section B1',
  '- [into A](map:map-a.md#na1)',
].join('\n');

test('collectLinksFromRoot: collects only internal map: links with paths', () => {
  const { root } = parseMarkdown(mdA);
  const links = collectLinksFromRoot(root, 'map-a.md');
  const files = links.map((l) => l.target.file);
  assert.deepEqual(files, ['map-b.md', 'map-b.md', 'map-a.md', 'map-b.md']);
  assert.ok(links.every((l) => l.fromFile === 'map-a.md'));
});

test('indexMarkdowns + getBacklinks: file and node level', () => {
  const index = indexMarkdowns({ 'map-a.md': mdA, 'map-b.md': mdB });

  // Links INTO map-a.md
  const intoA = getBacklinks(index, 'map-a.md');
  assert.equal(intoA.fileLinks.length, 2); // self-link + from B
  assert.deepEqual(
    intoA.fileLinks.map((l) => l.fromFile).sort(),
    ['map-a.md', 'map-b.md']
  );

  // Links into the specific node map-a.md#na1
  const intoANode = getBacklinks(index, 'map-a.md', 'na1');
  assert.equal(intoANode.nodeLinks.length, 2);
  assert.ok(intoANode.nodeLinks.every((l) => l.target.nodeRef === 'na1'));

  // Links into map-b.md#nb2
  const intoBNode = getBacklinks(index, 'map-b.md', 'nb2');
  assert.equal(intoBNode.nodeLinks.length, 1);
  assert.equal(intoBNode.nodeLinks[0].fromFile, 'map-a.md');

  // Node-level for a file with no targeted links
  const intoBNone = getBacklinks(index, 'map-b.md', 'zzz');
  assert.equal(intoBNone.nodeLinks.length, 0);
});

test('buildIndex: whole-file target not matched at node level', () => {
  const index = buildIndex([
    { fromFile: 'x.md', fromNodeId: 'x1', fromTopic: 'X', target: { internal: true, file: 'map-a.md', nodeRef: null } },
  ]);
  assert.equal(getBacklinks(index, 'map-a.md').fileLinks.length, 1);
  assert.equal(getBacklinks(index, 'map-a.md', 'na1').nodeLinks.length, 0);
});

test('indexMarkdowns: external links ignored', () => {
  const index = indexMarkdowns({ 'map-a.md': mdA });
  const externals = index.links.filter((l) => !l.target.internal);
  assert.equal(externals.length, 0);
});
