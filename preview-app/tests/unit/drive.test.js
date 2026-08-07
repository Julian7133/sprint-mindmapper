import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DRIVE_SCOPE,
  createTokenClient,
  downloadFileContent,
  driveAccessMessage,
  fetchFileMetadata,
} from '../../drive.js';

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createTokenClient', () => {
  it('initializes GIS token client with the Drive file scope', () => {
    const client = { requestAccessToken: vi.fn() };
    const initTokenClient = vi.fn(() => client);
    const callback = vi.fn();
    vi.stubGlobal('google', {
      accounts: {
        oauth2: {
          initTokenClient,
        },
      },
    });

    expect(createTokenClient({ clientId: 'client-id', callback })).toBe(client);
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-id',
      scope: DRIVE_SCOPE,
      callback,
    });
  });

  it('throws a clear error when GIS is not loaded', () => {
    expect(() => createTokenClient({ clientId: 'client-id', callback: vi.fn() })).toThrow(
      'Google Identity Services client is not loaded',
    );
  });
});

describe('Drive API helpers', () => {
  it('fetches metadata with an encoded Drive file ID and bearer token', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: 'Sprint Map.md', mimeType: 'text/markdown' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFileMetadata('token-123', 'folder/file id?x=1')).resolves.toEqual({
      name: 'Sprint Map.md',
      mimeType: 'text/markdown',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Ffile%20id%3Fx%3D1?fields=name,mimeType',
      { headers: { Authorization: 'Bearer token-123' } },
    );
  });

  it('downloads file content with an encoded Drive file ID', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => '# Sprint Plan\n',
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(downloadFileContent('token-456', 'abc/123')).resolves.toBe('# Sprint Plan\n');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/abc%2F123?alt=media',
      { headers: { Authorization: 'Bearer token-456' } },
    );
  });

  it('attaches status to metadata errors for app-level access guidance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'drive.file cannot access this file',
      })),
    );

    await expect(fetchFileMetadata('token', 'file-id')).rejects.toMatchObject({
      message: 'Drive metadata 403: drive.file cannot access this file',
      status: 403,
    });
  });

  it('attaches status to download errors for app-level access guidance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      })),
    );

    await expect(downloadFileContent('token', 'file-id')).rejects.toMatchObject({
      message: 'Drive download 404: Not Found',
      status: 404,
    });
  });
});

describe('driveAccessMessage', () => {
  it('explains how to recover from drive.file permission misses', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('Open it from Google Drive');
  });

  it('uses a generic retry message for other failures', () => {
    expect(driveAccessMessage(500)).toBe('Could not load this file from Google Drive. Please try again.');
  });
});
