import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DRIVE_SCOPE,
  createTokenClient,
  downloadFileContent,
  driveAccessMessage,
  fetchFileMetadata,
} from '../../drive.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createTokenClient', () => {
  it('initializes GIS with the configured Drive scope and callback', () => {
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

    const result = createTokenClient({ clientId: 'client-123', callback });

    expect(result).toBe(tokenClient);
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-123',
      scope: DRIVE_SCOPE,
      callback,
    });
  });

  it('fails loudly when the GIS script has not loaded', () => {
    expect(() => createTokenClient({ clientId: 'client-123', callback: vi.fn() })).toThrow(
      'Google Identity Services client is not loaded',
    );
  });
});

describe('Drive REST helpers', () => {
  it('fetchFileMetadata URL-encodes file IDs and sends bearer auth', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, opts) => {
        expect(url).toBe(
          'https://www.googleapis.com/drive/v3/files/folder%2Ffile%201?fields=name,mimeType',
        );
        expect(opts.headers.Authorization).toBe('Bearer token-1');
        return {
          ok: true,
          status: 200,
          json: async () => ({ name: 'Sprint.md', mimeType: 'text/markdown' }),
        };
      }),
    );

    await expect(fetchFileMetadata('token-1', 'folder/file 1')).resolves.toEqual({
      name: 'Sprint.md',
      mimeType: 'text/markdown',
    });
  });

  it('downloadFileContent URL-encodes file IDs and requests media content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, opts) => {
        expect(url).toBe('https://www.googleapis.com/drive/v3/files/drive%23file?alt=media');
        expect(opts.headers.Authorization).toBe('Bearer token-2');
        return {
          ok: true,
          status: 200,
          text: async () => '# Sprint\n',
        };
      }),
    );

    await expect(downloadFileContent('token-2', 'drive#file')).resolves.toBe('# Sprint\n');
  });

  it('attaches HTTP status to metadata failures for access guidance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      })),
    );

    try {
      await fetchFileMetadata('token', 'missing-file');
      throw new Error('expected fetchFileMetadata to fail');
    } catch (err) {
      expect(err.status).toBe(404);
      expect(err.message).toContain('Drive metadata 404: Not Found');
    }
  });

  it('attaches HTTP status and response detail to download failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'drive.file scope denied',
      })),
    );

    try {
      await downloadFileContent('token', 'denied-file');
      throw new Error('expected downloadFileContent to fail');
    } catch (err) {
      expect(err.status).toBe(403);
      expect(err.message).toContain('Drive download 403: drive.file scope denied');
    }
  });
});

describe('driveAccessMessage', () => {
  it('explains drive.file 403 and 404 access failures', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('Open it from Google Drive');
  });

  it('keeps other Drive failures generic', () => {
    expect(driveAccessMessage(500)).toBe('Could not load this file from Google Drive. Please try again.');
  });
});
