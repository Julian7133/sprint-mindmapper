import { describe, it, expect, vi } from 'vitest';
import { handleExternalMessage, isAllowedExternalOrigin, isOpenDriveFileMessage, MAX_MARKDOWN_LENGTH } from '../../background-external.mjs';

const valid = { type: 'auramindmap:open-drive-file', fileId: 'drive-file_1', fileName: 'Sprint.md', markdown: '# Sprint\n- Task' };
const deps = () => ({ storeHandoff: vi.fn(async () => {}), removeHandoff: vi.fn(async () => {}), openEditorWindow: vi.fn(async () => {}) });

describe('external handoff boundary', () => {
  it.each(['https://aura.berlow.de', 'http://localhost:8888'])('allows only the configured origin: %s', (origin) => {
    expect(isAllowedExternalOrigin(origin)).toBe(true);
  });
  it.each([undefined, 'null', 'https://evil.example', 'https://aura.berlow.de.evil', 'http://aura.berlow.de', 'https://aura.berlow.de:8443', 'https://aura.berlow.de/', 'http://localhost:8889', 'http://localhost', 'http://127.0.0.1:8888'])('rejects origin %s', (origin) => {
    expect(isAllowedExternalOrigin(origin)).toBe(false);
  });
  it('accepts only bounded file data and rejects tokens, paths, invalid IDs and extra fields', () => {
    expect(isOpenDriveFileMessage(valid)).toBe(true);
    for (const message of [null, [], {}, { ...valid, type: 'other' }, { ...valid, token: 'secret' }, { ...valid, accessToken: 'secret' }, { ...valid, fileId: '../id?x' }, { ...valid, fileName: '../sprint.md' }, { ...valid, fileName: 'a\\sprint.md' }, { ...valid, fileName: 'a\n.md' }, { ...valid, fileName: '.hidden.md' }, { ...valid, markdown: 'x'.repeat(MAX_MARKDOWN_LENGTH + 1) }]) {
      expect(isOpenDriveFileMessage(message)).toBe(false);
    }
  });
  it('stores each request separately before opening its own editor', async () => {
    const d = deps();
    expect(await handleExternalMessage(valid, { origin: 'https://aura.berlow.de' }, d)).toEqual({ ok: true });
    expect(await handleExternalMessage(valid, { origin: 'http://localhost:8888' }, d)).toEqual({ ok: true });
    const [key, payload] = d.storeHandoff.mock.calls[0];
    expect(key).toMatch(/^driveHandoff:[\da-f-]{36}$/);
    expect(payload).toEqual(valid);
    expect(d.openEditorWindow).toHaveBeenCalledWith(key.slice('driveHandoff:'.length));
    expect(d.storeHandoff.mock.calls[1][0]).not.toBe(key);
    expect(d.storeHandoff.mock.invocationCallOrder[0]).toBeLessThan(d.openEditorWindow.mock.invocationCallOrder[0]);
  });
  it('rejects invalid messages and origins without side effects', async () => {
    const d = deps();
    await handleExternalMessage(valid, { origin: 'https://evil.example' }, d);
    await handleExternalMessage({ ...valid, token: 'x' }, { origin: 'https://aura.berlow.de' }, d);
    expect(d.storeHandoff).not.toHaveBeenCalled();
    expect(d.openEditorWindow).not.toHaveBeenCalled();
  });
  it('cleans up a pending request when opening fails', async () => {
    const d = deps(); d.openEditorWindow.mockRejectedValue(new Error('denied'));
    expect((await handleExternalMessage(valid, { origin: 'https://aura.berlow.de' }, d)).ok).toBe(false);
    expect(d.removeHandoff).toHaveBeenCalledWith(d.storeHandoff.mock.calls[0][0]);
  });
});
