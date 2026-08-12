import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DRIVE_SCOPE,
  createTokenClient,
  downloadFileContent,
  driveAccessMessage,
  fetchFileMetadata,
} from '../../drive.js';

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.fetch;
  delete globalThis.google;
});

describe('Drive helper', () => {
  it('creates a GIS token client with the default Drive file scope', () => {
    const tokenClient = { requestAccessToken: vi.fn() };
    const initTokenClient = vi.fn(() => tokenClient);
    const callback = vi.fn();
    globalThis.google = {
      accounts: {
        oauth2: { initTokenClient },
      },
    };

    const result = createTokenClient({ clientId: 'client-123', callback });

    expect(result).toBe(tokenClient);
    expect(initTokenClient).toHaveBeenCalledWith({
      client_id: 'client-123',
      scope: DRIVE_SCOPE,
      callback,
    });
  });

  it('throws a clear error when GIS is unavailable', () => {
    expect(() =>
      createTokenClient({ clientId: 'client-123', callback: vi.fn() })
    ).toThrow('Google Identity Services client is not loaded');
  });

  it('fetches metadata with an encoded Drive file id and bearer token', async () => {
    const metadata = {
      name: 'Sprint Plan.mm',
      mimeType: 'application/vnd.google-apps.drive-sdk',
    };
    const json = vi.fn(async () => metadata);
    const fetchMock = vi.fn(async () => ({ ok: true, json }));
    globalThis.fetch = fetchMock;

    await expect(fetchFileMetadata('token-abc', 'folder/file id')).resolves.toEqual(metadata);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/folder%2Ffile%20id?fields=name,mimeType',
      { headers: { Authorization: 'Bearer token-abc' } }
    );
    expect(json).toHaveBeenCalledOnce();
  });

  it('throws download errors with the Drive status for permission guidance', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: vi.fn(async () => 'missing drive.file access'),
    }));

    await expect(downloadFileContent('token-abc', 'restricted-file')).rejects.toMatchObject({
      message: 'Drive download 403: missing drive.file access',
      status: 403,
    });
  });

  it('maps permission failures to the open-with guidance message', () => {
    expect(driveAccessMessage(403)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(404)).toContain('Open it from Google Drive');
    expect(driveAccessMessage(500)).toBe(
      'Could not load this file from Google Drive. Please try again.'
    );
  });
});
