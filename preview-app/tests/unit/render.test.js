import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { renderMarkmapHtml } from '../../markmap-bundle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(join(__dirname, '../../app.js'), 'utf8');

describe('app.js import guard', () => {
  it('imports renderMarkmapHtml from markmap-bundle.js (not the bare-import source)', () => {
    expect(appSource).toMatch(/from ['"]\.\/markmap-bundle\.js['"]/);
    expect(appSource).not.toMatch(/render-markmap-inbrowser\.mjs/);
  });
});

describe('renderMarkmapHtml', () => {
  it('returns HTML containing node text from sample markdown', async () => {
    const html = await renderMarkmapHtml('# A\n## B');
    expect(html).toMatch(/<!DOCTYPE html>|<html/i);
    expect(html).toContain('A');
    expect(html).toContain('B');
  });

  it('does not contain cdn.jsdelivr or unpkg in rendered output', async () => {
    const html = await renderMarkmapHtml('# Test');
    expect(html).not.toMatch(/cdn\.jsdelivr\.net/i);
    expect(html).not.toMatch(/unpkg\.com/i);
  });
});
