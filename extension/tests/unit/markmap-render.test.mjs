import { describe, it, expect } from 'vitest';
import { renderMarkmapHtml } from '../../editor/markmap-render.mjs';

describe('renderMarkmapHtml', () => {
  it('produces valid HTML with the root topic', async () => {
    const md = '# My Sprint\n## Task A\n## Task B';
    const html = await renderMarkmapHtml(md);
    expect(html).toContain('<html');
    expect(html).toContain('<svg');
    expect(html).toContain('My Sprint');
  });

  it('does not contain cdn.jsdelivr.net or unpkg.com', async () => {
    const html = await renderMarkmapHtml('# Test');
    expect(html).not.toContain('cdn.jsdelivr.net');
    expect(html).not.toContain('unpkg.com');
  });

  it('renders multiple sibling and nested child topics in output', async () => {
    const md = '# Root\n## Sibling A\n## Sibling B\n### Nested child';
    const html = await renderMarkmapHtml(md);

    expect(html).toContain('Root');
    expect(html).toContain('Sibling A');
    expect(html).toContain('Sibling B');
    expect(html).toContain('Nested child');
  });

  it('handles YAML frontmatter without crashing and still renders root', async () => {
    const md = `---
markmap:
  colorFreezeLevel: 2
---
# Root`;
    const html = await renderMarkmapHtml(md);

    expect(html).toContain('Root');
    expect(html).toContain('colorFreezeLevel');
  });

  it('handles empty markdown gracefully', async () => {
    const html = await renderMarkmapHtml('');
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toMatch(/<!DOCTYPE html>|<html/i);
  });

  it('handles whitespace-only markdown gracefully', async () => {
    const html = await renderMarkmapHtml('   \n  \t  ');
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('<svg');
  });

  it('returns a complete standalone document with inlined scripts', async () => {
    const html = await renderMarkmapHtml('# Standalone');

    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('<html');
    expect(html).toContain('<svg');
    expect(html).toContain('<script>');
    expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
  });

  it('does not contain eval( in output', async () => {
    const md = '# Safe\n## Child A\n### Grandchild';
    const html = await renderMarkmapHtml(md);
    expect(html).not.toMatch(/eval\s*\(/);
  });
});
