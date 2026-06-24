import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { importToMarkdown } from '../../import-formats.mjs';

describe('import-formats', () => {
  it('converts OPML to markdown', async () => {
    const opml = `<?xml version="1.0"?>
<opml><body>
  <outline text="Project">
    <outline text="Task A"/>
  </outline>
</body></opml>`;
    const md = await importToMarkdown('plan.opml', Buffer.from(opml));
    assert.match(md, /# Project/);
    assert.match(md, /## Task A/);
  });

  it('converts FreeMind .mm to markdown', async () => {
    const mm = `<map><node TEXT="Root"><node TEXT="Child"/></node></map>`;
    const md = await importToMarkdown('map.mm', Buffer.from(mm));
    assert.match(md, /# Root/);
    assert.match(md, /## Child/);
  });
});
