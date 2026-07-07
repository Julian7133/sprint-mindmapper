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
});
