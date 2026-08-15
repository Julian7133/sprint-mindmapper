import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTokenClient,
  downloadFileContent,
  driveAccessMessage,
  DRIVE_SCOPE,
  fetchFileMetadata,
} from '../../drive.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createTokenClient', () => {
  it('configures GIS with the app Drive scope by default', () => {
    const initTokenClient = vi.fn(() => ({ requestAccessToken: vi.fn() }));
    vi.stubGlobal('google', {
      accounts: {
        oauth2: { initTokenClient },
      },
    });
    const callback = vi.fn();

    const client = createTokenClient({ clientId: 'client-123', callback });

    expect(client).toBeTruthy();
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-123',
      scope: DRIVE_SCOPE,
      callback,
    });
  });

  it('fails clearly when Google Identity Services is unavailable', () => {
    vi.stubGlobal('google', undefined);

    expect(() => createTokenClient({ clientId: 'client-123', callback: vi.fn() })).toThrow(
      'Google Identity Services client is not loaded',
    );
  });
});

describe('Drive REST helpers', () => {
  it('fetches metadata with an encoded file ID and bearer token', async () => {
    const metadata = { name: 'Sprint Map.md', mimeType: 'text/markdown' };
    const json = vi.fn(async () => metadata);
    const fetch = vi.fn(async () => ({
      ok: true,
      json,
    }));
    vi.stubGlobal('fetch', fetch);

    await expect(fetchFileMetadata('token-abc', 'folder/file #1')).resolves.toEqual(metadata);

    expect(fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Ffile%20%231?fields=name,mimeType',
      { headers: { Authorization: 'Bearer token-abc' } },
    );
    expect(json).toHaveBeenCalledOnce();
  });

  it('downloads file content with an encoded file ID and bearer token', async () => {
    const text = vi.fn(async () => '# Sprint Plan');
    const fetch = vi.fn(async () => ({
      ok: true,
      text,
    }));
    vi.stubGlobal('fetch', fetch);

    await expect(downloadFileContent('token-def', 'file with spaces')).resolves.toBe('# Sprint Plan');

    expect(fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/file%20with%20spaces?alt=media',
      { headers: { Authorization: 'Bearer token-def' } },
    );
    expect(text).toHaveBeenCalledOnce();
  });

  it('preserves Drive error status and response details for access guidance', async () => {
    const fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: vi.fn(async () => 'insufficientFilePermissions'),
    }));
    vi.stubGlobal('fetch', fetch);

    await expect(fetchFileMetadata('token-abc', 'restricted-file')).rejects.toMatchObject({
      message: 'Drive metadata 403: insufficientFilePermissions',
      status: 403,
    });
  });

  it('falls back to status text when Drive error bodies are unavailable', async () => {
    const fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn(async () => {
        throw new Error('network body read failed');
      }),
    }));
    vi.stubGlobal('fetch', fetch);

    await expect(downloadFileContent('token-abc', 'file-1')).rejects.toMatchObject({
      message: 'Drive download 500: Internal Server Error',
      status: 500,
    });
  });
});

describe('driveAccessMessage', () => {
  it('explains permission-scoped Drive failures for 403 and 404 responses', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('Open it from Google Drive');
  });

  it('uses a generic retry message for other Drive failures', () => {
    expect(driveAccessMessage(500)).toBe('Could not load this file from Google Drive. Please try again.');
  });
});
