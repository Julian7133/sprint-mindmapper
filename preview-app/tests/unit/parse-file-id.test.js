import { describe, it, expect } from 'vitest';
import { parseFileId } from '../../parse-file-id.js';

describe('parseFileId', () => {
  it('reads fileId from Drive Open-with state JSON', () => {
    const state = encodeURIComponent(JSON.stringify({ ids: ['abc123'], action: 'open' }));
    expect(parseFileId(`?state=${state}`)).toBe('abc123');
  });

  it('reads ?fileId= query param', () => {
    expect(parseFileId('?fileId=drive-file-99')).toBe('drive-file-99');
  });

  it('reads ?id= query param', () => {
    expect(parseFileId('?id=legacy-id-7')).toBe('legacy-id-7');
  });

  it('returns null when no file id is present', () => {
    expect(parseFileId('')).toBeNull();
    expect(parseFileId('?foo=bar')).toBeNull();
  });

  it('prefers state ids over fileId param', () => {
    const state = encodeURIComponent(JSON.stringify({ ids: ['from-state'] }));
    expect(parseFileId(`?state=${state}&fileId=ignored`)).toBe('from-state');
  });

  it('ignores malformed state JSON', () => {
    expect(parseFileId('?state=not-json&fileId=fallback')).toBe('fallback');
  });
});
