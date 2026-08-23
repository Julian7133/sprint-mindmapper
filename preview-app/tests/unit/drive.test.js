import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTokenClient,
  downloadFileContent,
  driveAccessMessage,
  fetchFileMetadata,
  DRIVE_SCOPE,
} from '../../drive.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('createTokenClient', () => {
  it('initializes GIS token client with the configured Drive scope', () => {
    const tokenClient = { requestAccessToken: vi.fn() };
    const initTokenClient = vi.fn(() => tokenClient);
    const callback = vi.fn();
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient,
        },
      },
    });

    const client = createTokenClient({ clientId: 'client-123', callback });

    expect(client).toBe(tokenClient);
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-123',
      scope: DRIVE_SCOPE,
      callback,
    });
  });

  it('fails fast when the GIS script is unavailable', () => {
    vi.stubGlobal('google', undefined);

    expect(() => createTokenClient({ clientId: 'client-123', callback: vi.fn() })).toThrow(
      'Google Identity Services client is not loaded',
    );
  });
});

describe('Drive REST helpers', () => {
  it('fetches metadata with encoded file IDs and bearer auth', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: 'Roadmap.md', mimeType: 'text/markdown' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFileMetadata('token-abc', 'folder/file 1')).resolves.toEqual({
      name: 'Roadmap.md',
      mimeType: 'text/markdown',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Ffile%201?fields=name,mimeType',
      {
        headers: { Authorization: 'Bearer token-abc' },
      },
    );
  });

  it('attaches response status and detail to metadata failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'drive.file scope cannot access this file',
      })),
    );

    await expect(fetchFileMetadata('token-abc', 'restricted')).rejects.toMatchObject({
      message: 'Drive metadata 403: drive.file scope cannot access this file',
      status: 403,
    });
  });

  it('downloads file content as text with the alt=media endpoint', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => '# Sprint Plan',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadFileContent('token-abc', 'doc:123')).resolves.toBe('# Sprint Plan');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/doc%3A123?alt=media',
      {
        headers: { Authorization: 'Bearer token-abc' },
      },
    );
  });

  it('attaches response status and fallback status text to download failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      })),
    );

    await expect(downloadFileContent('token-abc', 'missing')).rejects.toMatchObject({
      message: 'Drive download 404: Not Found',
      status: 404,
    });
  });
});

describe('driveAccessMessage', () => {
  it('guides users to Drive Open-with or the extension for permission-scoped failures', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('install the Chrome extension');
  });

  it('uses a generic retry message for unexpected statuses', () => {
    expect(driveAccessMessage(500)).toBe('Could not load this file from Google Drive. Please try again.');
  });
});
