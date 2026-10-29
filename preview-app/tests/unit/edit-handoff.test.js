import { describe, it, expect, vi } from 'vitest';
import { sendEditHandoff } from '../../edit-handoff.js';
const file = { fileId: 'drive-1', fileName: 'Sprint.md', markdown: '# Sprint', accessToken: 'must-not-cross' };
describe('preview edit handoff', () => {
  it('sends file content without credentials', async () => {
    const runtime = { sendMessage: vi.fn((_id, _data, cb) => cb({ ok: true })) };
    expect(await sendEditHandoff('extension-id', file, runtime)).toEqual({ status: 'opened' });
    expect(runtime.sendMessage.mock.calls[0].slice(0, 2)).toEqual(['extension-id', {
      type: 'auramindmap:open-drive-file', fileId: 'drive-1', fileName: 'Sprint.md', markdown: '# Sprint',
    }]);
  });
  it('falls back when unavailable or not installed', async () => {
    expect(await sendEditHandoff('id', file, {})).toEqual({ status: 'unavailable' });
    const runtime = { lastError: { message: 'not installed' }, sendMessage: (_id, _data, cb) => cb() };
    expect(await sendEditHandoff('id', file, runtime)).toEqual({ status: 'unavailable' });
    expect(await sendEditHandoff('id', file, { sendMessage() { throw new Error(); } })).toEqual({ status: 'unavailable' });
  });
  it('reports extension rejection separately from missing installation', async () => {
    const runtime = { sendMessage: (_id, _data, cb) => cb({ ok: false, error: 'invalid message' }) };
    expect(await sendEditHandoff('id', file, runtime)).toEqual({ status: 'rejected', error: 'invalid message' });
  });
  it('times out if no callback arrives', async () => {
    expect(await sendEditHandoff('id', file, { sendMessage() {} }, 5)).toEqual({ status: 'unavailable' });
  });
});
