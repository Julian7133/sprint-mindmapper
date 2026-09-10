import { describe, it, expect } from 'vitest';
import {
  parseTarget,
  formatInternalTarget,
  resolveNodeRef,
  isInternalTarget,
  normalizeTargetFile,
  isSafeExternalUrl,
} from '../../editor/link-target.mjs';
import {
  indexMarkdowns,
  getBacklinks,
} from '../../editor/link-index.mjs';
import {
  parseMarkdown,
  serializeMarkdown,
} from '../../editor/markmap-convert.mjs';

describe('extension link-target (M2)', () => {
  it('parses and formats internal targets', () => {
    expect(parseTarget('map:sub/foo.md#me3')).toMatchObject({
      internal: true,
      file: 'sub/foo.md',
      nodeRef: 'me3',
    });
    expect(formatInternalTarget('foo.md', 'me3')).toBe('map:foo.md#me3');
    expect(isInternalTarget('https://x.com')).toBe(false);
  });

  it('hardens internal paths and external urls', () => {
    expect(normalizeTargetFile('sub/foo.md')).toBe('sub/foo.md');
    for (const p of ['', '../foo.md', '/abs/foo.md', 'a\\b.md', 'foo.txt', 'foo#bar.md']) {
      expect(normalizeTargetFile(p)).toBeNull();
    }
    expect(parseTarget('map:../evil.md')).toBeNull();
    expect(formatInternalTarget('../evil.md', 'me1')).toBeNull();
    expect(isSafeExternalUrl('https://x.com')).toBe(true);
    for (const u of ['javascript:alert(1)', 'data:text/html,x', 'file:///x', 'ftp://x']) {
      expect(isSafeExternalUrl(u)).toBe(false);
    }
  });

  it('resolves id, then topic-path fallback, then broken root', () => {
    const root = {
      id: 'root',
      topic: 'Root',
      children: [{ id: 'a1', topic: 'Alpha', children: [{ id: 'a2', topic: 'Nested' }] }],
    };
    expect(resolveNodeRef(root, 'a2').node.topic).toBe('Nested');
    expect(resolveNodeRef(root, 'Alpha/Nested').node.topic).toBe('Nested');
    expect(resolveNodeRef(root, 'nope').broken).toBe(true);
  });

  it('persists node ids across the markdown roundtrip', () => {
    const src = '# Root\n## Child\n- [x](map:other.md#me9)\n';
    const a = parseMarkdown(src);
    const md = serializeMarkdown(a.frontmatter, a.root);
    const b = parseMarkdown(md);
    const child = b.root.children[0];
    expect(child.id).toBe('me1');
    expect(child.children[0].id).toBe('me2');
    expect(child.children[0].hyperLink).toBe('map:other.md#me9');
  });

  it('builds a folder-wide backlink index', () => {
    const mdA = '# A\n## S\n- [t](map:b.md#nb1)\n';
    const mdB = '# B\n## S\n- [u](map:a.md#na1)\n';
    const index = indexMarkdowns({ 'a.md': mdA, 'b.md': mdB });
    expect(getBacklinks(index, 'a.md', 'na1').nodeLinks).toHaveLength(1);
    expect(getBacklinks(index, 'a.md').fileLinks).toHaveLength(1);
  });
});
