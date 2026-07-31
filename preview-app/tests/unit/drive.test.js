import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DRIVE_SCOPE,
  createTokenClient,
  downloadFileContent,
  driveAccessMessage,
  fetchFileMetadata,
} from '../../drive.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createTokenClient', () => {
  it('initializes GIS with the configured client ID, scope, and callback', () => {
    const callback = vi.fn();
    const tokenClient = { requestAccessToken: vi.fn() };
    const initTokenClient = vi.fn(() => tokenClient);

    vi.stubGlobal('google', {
      accounts: {
        oauth2: { initTokenClient },
      },
    });

    const result = createTokenClient({ clientId: 'client-id.apps.googleusercontent.com', callback });

    expect(result).toBe(tokenClient);
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-id.apps.googleusercontent.com',
      scope: DRIVE_SCOPE,
      callback,
    });
  });
});

describe('Drive REST helpers', () => {
  it('fetches metadata with an encoded file ID and bearer token', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: 'Sprint Plan.md', mimeType: 'text/markdown' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const meta = await fetchFileMetadata('token-123', 'folder/file id');

    expect(meta).toEqual({ name: 'Sprint Plan.md', mimeType: 'text/markdown' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Ffile%20id?fields=name,mimeType',
      { headers: { Authorization: 'Bearer token-123' } },
    );
  });

  it('downloads markdown content with an encoded file ID and bearer token', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => '# Sprint\n',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const markdown = await downloadFileContent('token-123', 'folder/file id');

    expect(markdown).toBe('# Sprint\n');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Ffile%20id?alt=media',
      { headers: { Authorization: 'Bearer token-123' } },
    );
  });

  it('preserves status on download failures so the app can show access guidance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'drive.file scope cannot access this file',
      })),
    );

    await expect(downloadFileContent('token-123', 'file-1')).rejects.toMatchObject({
      message: 'Drive download 403: drive.file scope cannot access this file',
      status: 403,
    });
  });
});

describe('driveAccessMessage', () => {
  it('returns permission guidance for Drive file scope access failures', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('install the Chrome extension');
    expect(driveAccessMessage(500)).toBe('Could not load this file from Google Drive. Please try again.');
  });
});
