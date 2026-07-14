import { describe, it, expect, vi } from 'vitest';
import {
  PENDING_DRIVE_FILE_KEY,
  handleExternalMessage,
  isAllowedExternalOrigin,
  isOpenDriveFileMessage,
} from '../../background-external.mjs';

describe('isAllowedExternalOrigin', () => {
  it('allows preview production origin', () => {
    expect(isAllowedExternalOrigin('https://preview.auramindmap.com')).toBe(true);
  });

  it('allows localhost with port', () => {
    expect(isAllowedExternalOrigin('http://localhost:8888')).toBe(true);
  });

  it('rejects other origins', () => {
    expect(isAllowedExternalOrigin('https://evil.example')).toBe(false);
    expect(isAllowedExternalOrigin('https://preview.auramindmap.com.evil')).toBe(false);
    expect(isAllowedExternalOrigin(undefined)).toBe(false);
  });
});

describe('isOpenDriveFileMessage', () => {
  it('accepts valid handoff messages', () => {
    expect(
      isOpenDriveFileMessage({
        type: 'auramindmap:open-drive-file',
        fileId: 'abc123',
      }),
    ).toBe(true);
  });

  it('rejects invalid messages', () => {
    expect(isOpenDriveFileMessage(null)).toBe(false);
    expect(isOpenDriveFileMessage({ type: 'other', fileId: 'x' })).toBe(false);
    expect(isOpenDriveFileMessage({ type: 'auramindmap:open-drive-file' })).toBe(false);
  });
});

describe('handleExternalMessage', () => {
  it('stores pending file id and opens editor for allowed origin', async () => {
    const setPendingDriveFileId = vi.fn(async () => {});
    const openEditorWindow = vi.fn(async () => {});

    const result = await handleExternalMessage(
      { type: 'auramindmap:open-drive-file', fileId: 'drive-file-1' },
      { origin: 'https://preview.auramindmap.com' },
      { setPendingDriveFileId, openEditorWindow },
    );

    expect(result).toEqual({ ok: true });
    expect(setPendingDriveFileId).toHaveBeenCalledWith('drive-file-1');
    expect(openEditorWindow).toHaveBeenCalled();
  });

  it('rejects disallowed origins', async () => {
    const setPendingDriveFileId = vi.fn(async () => {});
    const openEditorWindow = vi.fn(async () => {});

    const result = await handleExternalMessage(
      { type: 'auramindmap:open-drive-file', fileId: 'drive-file-1' },
      { origin: 'https://evil.example' },
      { setPendingDriveFileId, openEditorWindow },
    );

    expect(result.ok).toBe(false);
    expect(setPendingDriveFileId).not.toHaveBeenCalled();
    expect(openEditorWindow).not.toHaveBeenCalled();
  });
});

describe('PENDING_DRIVE_FILE_KEY', () => {
  it('matches workspace consume key', () => {
    expect(PENDING_DRIVE_FILE_KEY).toBe('pendingDriveFileId');
  });
});
