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

describe('createTokenClient', () => {
  it('initializes the GIS token client with the preview app Drive scope', () => {
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

    const client = createTokenClient({ clientId: 'client-id.apps.googleusercontent.com', callback });

    expect(client).toBe(tokenClient);
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-id.apps.googleusercontent.com',
      scope: DRIVE_SCOPE,
      callback,
    });
  });

  it('fails clearly when Google Identity Services is unavailable', () => {
    vi.stubGlobal('google', undefined);

    expect(() => createTokenClient({ clientId: 'client-id', callback: vi.fn() })).toThrow(
      'Google Identity Services client is not loaded',
    );
  });
});

describe('Drive API helpers', () => {
  it('fetches file metadata with an encoded file ID and bearer token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        expect(url).toBe(
          'https://www.googleapis.com/drive/v3/files/folder%2Fmap%20one.md?fields=name,mimeType',
        );
        expect(options.headers.Authorization).toBe('Bearer access-token');
        return {
          ok: true,
          json: async () => ({ name: 'map one.md', mimeType: 'text/markdown' }),
        };
      }),
    );

    await expect(fetchFileMetadata('access-token', 'folder/map one.md')).resolves.toEqual({
      name: 'map one.md',
      mimeType: 'text/markdown',
    });
  });

  it('downloads file content using the media endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        expect(url).toBe('https://www.googleapis.com/drive/v3/files/map%3Fid%3D1?alt=media');
        expect(options.headers.Authorization).toBe('Bearer access-token');
        return {
          ok: true,
          text: async () => '# Sprint\n',
        };
      }),
    );

    await expect(downloadFileContent('access-token', 'map?id=1')).resolves.toBe('# Sprint\n');
  });

  it('preserves Drive metadata failure status for access guidance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'file not visible',
      })),
    );

    await expect(fetchFileMetadata('access-token', 'hidden-file')).rejects.toMatchObject({
      message: 'Drive metadata 404: file not visible',
      status: 404,
    });
  });

  it('falls back to status text when download error details are unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => {
          throw new Error('body unavailable');
        },
      })),
    );

    await expect(downloadFileContent('access-token', 'forbidden-file')).rejects.toMatchObject({
      message: 'Drive download 403: Forbidden',
      status: 403,
    });
  });
});

describe('driveAccessMessage', () => {
  it('points permission failures toward Drive Open-with or the extension', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('Open it from Google Drive');
  });

  it('uses a generic retry message for non-permission failures', () => {
    expect(driveAccessMessage(500)).toBe('Could not load this file from Google Drive. Please try again.');
  });
});
