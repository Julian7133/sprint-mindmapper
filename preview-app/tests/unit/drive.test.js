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
});

describe('preview Drive helpers', () => {
  it('creates a GIS token client with the app Drive scope', () => {
    const tokenClient = { requestAccessToken: vi.fn() };
    const initTokenClient = vi.fn(() => tokenClient);
    const callback = vi.fn();

    vi.stubGlobal('google', {
      accounts: {
        oauth2: { initTokenClient },
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

  it('fails clearly when Google Identity Services is unavailable', () => {
    vi.stubGlobal('google', undefined);

    expect(() => createTokenClient({ clientId: 'client-123', callback: vi.fn() })).toThrow(
      /Google Identity Services client is not loaded/,
    );
  });

  it('fetches file metadata with an encoded Drive file id and bearer token', async () => {
    const fetch = vi.fn(async (url, opts) => {
      expect(url).toBe(
        'https://www.googleapis.com/drive/v3/files/folder%2Ffile%20%231?fields=name,mimeType',
      );
      expect(opts.headers.Authorization).toBe('Bearer token-abc');
      return {
        ok: true,
        json: async () => ({ name: 'Sprint.md', mimeType: 'text/markdown' }),
      };
    });
    vi.stubGlobal('fetch', fetch);

    await expect(fetchFileMetadata('token-abc', 'folder/file #1')).resolves.toEqual({
      name: 'Sprint.md',
      mimeType: 'text/markdown',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('attaches Drive response status to metadata failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'insufficient permissions',
      })),
    );

    await expect(fetchFileMetadata('token-abc', 'file-1')).rejects.toMatchObject({
      message: 'Drive metadata 403: insufficient permissions',
      status: 403,
    });
  });

  it('downloads markdown content with an encoded Drive file id', async () => {
    const fetch = vi.fn(async (url, opts) => {
      expect(url).toBe('https://www.googleapis.com/drive/v3/files/file%20%231?alt=media');
      expect(opts.headers.Authorization).toBe('Bearer token-abc');
      return {
        ok: true,
        text: async () => '# Sprint\n',
      };
    });
    vi.stubGlobal('fetch', fetch);

    await expect(downloadFileContent('token-abc', 'file #1')).resolves.toBe('# Sprint\n');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('attaches Drive response status to download failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      })),
    );

    await expect(downloadFileContent('token-abc', 'missing-file')).rejects.toMatchObject({
      message: 'Drive download 404: Not Found',
      status: 404,
    });
  });

  it('maps Drive permission failures to the user-facing access guidance', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(500)).toBe('Could not load this file from Google Drive. Please try again.');
  });
});
