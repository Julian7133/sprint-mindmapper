import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import JSZip from 'jszip';
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

  it('converts modern XMind content.json to markdown', async () => {
    const zip = new JSZip();
    zip.file(
      'content.json',
      JSON.stringify([
        {
          rootTopic: {
            title: 'Project [Alpha]',
            children: {
              attached: [
                {
                  title: 'Design',
                  children: {
                    attached: {
                      title: 'Review',
                    },
                  },
                },
                {
                  title: 'Ship',
                },
              ],
            },
          },
        },
      ]),
    );

    const md = await importToMarkdown('plan.xmind', await zip.generateAsync({ type: 'nodebuffer' }));

    assert.equal(md, '# Project \\[Alpha]\n## Design\n### Review\n## Ship\n');
  });

  it('converts nested legacy XMind content.json to markdown', async () => {
    const zip = new JSZip();
    zip.file(
      'worksheets/sheet-1/content.json',
      JSON.stringify({
        root: {
          topic: {
            title: 'Legacy Root',
            children: {
              attached: [
                {
                  title: 'Legacy Child',
                },
              ],
            },
          },
        },
      }),
    );

    const md = await importToMarkdown('legacy.xmind', await zip.generateAsync({ type: 'nodebuffer' }));

    assert.equal(md, '# Legacy Root\n## Legacy Child\n');
  });
});
