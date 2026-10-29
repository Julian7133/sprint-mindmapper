import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extensionPath, launchExtensionContext } from './helpers/extension-context.mjs';

const previewRoot = path.resolve(extensionPath, '../preview-app');
const markdown = '# Exact Drive Map\n\n## Current file\n- Work item\n';
let context, extensionId, server, wrongPortServer;
async function serve(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname.replace(/^\/$/, '/index.html');
  try {
    const file = path.resolve(previewRoot, `.${pathname}`);
    if (!file.startsWith(`${previewRoot}/`)) throw new Error('invalid path');
    let body = await readFile(file);
    if (pathname === '/config.js') body = Buffer.from(String(body).replace('REPLACE_WITH_PUBLISHED_EXTENSION_ID', extensionId));
    // Apply the actual global and document-specific Netlify headers.
    const toml = await readFile(path.join(previewRoot, 'netlify.toml'), 'utf8');
    const headers = {};
    for (const block of toml.split('[[headers]]').slice(1)) {
      const route = block.match(/for = "([^"]+)"/)[1];
      if (route !== '/*' && route !== pathname) continue;
      for (const [, name, value] of block.matchAll(/^    ([\w-]+) = "([^"\n]*)"/gm)) headers[name] = value;
    }
    const mime = pathname.endsWith('.html') ? 'text/html' : pathname.endsWith('.css') ? 'text/css' : 'text/javascript';
    res.writeHead(200, { ...headers, 'Content-Type': mime });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}

test.beforeAll(async () => {
  ({ context, extensionId } = await launchExtensionContext());
  server = createServer((req, res) => { void serve(req, res); });
  await new Promise((resolve) => server.listen(8888, 'localhost', resolve));
  wrongPortServer = createServer((req, res) => { void serve(req, res); });
  await new Promise((resolve) => wrongPortServer.listen(8889, 'localhost', resolve));
  await context.route('https://accounts.google.com/gsi/client', (route) => route.fulfill({
    contentType: 'text/javascript', body: `window.google = { accounts: { oauth2: { initTokenClient: ({callback}) => ({ requestAccessToken: () => callback({access_token:'test-only-token'}) }) } } };`,
  }));
  await context.route('https://www.googleapis.com/**', (route) => {
    const media = new URL(route.request().url()).searchParams.get('alt') === 'media';
    return route.fulfill({ contentType: media ? 'text/plain' : 'application/json', body: media ? markdown : JSON.stringify({ id: 'drive-file-123', name: 'Current Sprint.md' }) });
  });
});
test.afterAll(async () => {
  await context?.close();
  await Promise.all([server, wrongPortServer].filter(Boolean).map((s) => new Promise((resolve) => s.close(resolve))));
});

test('preview renders under deployment CSP; Edit opens exact content in the unpacked extension', async () => {
  const page = await context.newPage();
  await page.goto('http://localhost:8888/?fileId=drive-file-123');
  await expect(page.getByRole('button', { name: 'Edit in AuraMindmap' })).toBeEnabled();
  await expect(page.frameLocator('#preview').locator('.markmap-node').first()).toBeVisible();
  await expect(page.frameLocator('#preview').locator('body')).toContainText('Exact Drive Map');
  const frame = page.frames().find((f) => f.url().endsWith('/preview-frame.html'));
  expect(await frame.evaluate(() => { try { return !!parent.document; } catch { return false; } })).toBe(false);
  const opened = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Edit in AuraMindmap' }).click();
  const editor = await opened;
  await editor.waitForLoadState('domcontentloaded');
  expect(editor.url()).toMatch(new RegExp(`^chrome-extension://${extensionId}/editor/index.html\\?handoff=`));
  await expect(editor.locator('me-tpc').filter({ hasText: 'Exact Drive Map' })).toBeVisible();
  await expect(editor.getByTestId('file-name')).toHaveText('Current Sprint.md');
  await expect(editor.locator('.handoff-notice')).toContainText('local copy');
  await editor.reload();
  await expect(editor.locator('me-tpc').filter({ hasText: 'Work item' })).toBeVisible();
  const imported = await editor.evaluate(async () => {
    const { importToMarkdown } = await import('./import-formats-bundle.js');
    return importToMarkdown('test.opml', new TextEncoder().encode('<opml><body><outline text="Browser import"/></body></opml>').buffer);
  });
  expect(imported).toContain('Browser import');
  const again = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Edit in AuraMindmap' }).click();
  const second = await again;
  expect(second.url()).not.toBe(editor.url());
  await expect(second.locator('me-tpc').filter({ hasText: 'Exact Drive Map' })).toBeVisible();
  await expect(editor.locator('me-tpc').filter({ hasText: 'Exact Drive Map' })).toBeVisible();
  await second.close(); await editor.close(); await page.close();
});

test('external messages from an unapproved localhost port are rejected', async () => {
  const page = await context.newPage();
  await page.goto('http://localhost:8889/?fileId=drive-file-123');
  const before = context.pages().length;
  const response = await page.evaluate((id) => new Promise((resolve) => {
    chrome.runtime.sendMessage(id, { type: 'auramindmap:open-drive-file', fileId: 'drive-file-123', fileName: 'Test.md', markdown: '# Test' }, resolve);
  }), extensionId);
  expect(response).toEqual({ ok: false, error: 'origin not allowed' });
  expect(context.pages().length).toBe(before);
  await page.close();
});

test('missing extension falls back to its Store listing', async () => {
  const page = await context.newPage();
  await page.route('**/config.js', async (route) => {
    const source = await readFile(path.join(previewRoot, 'config.js'), 'utf8');
    await route.fulfill({ contentType: 'text/javascript', body: source.replace('REPLACE_WITH_PUBLISHED_EXTENSION_ID', 'a'.repeat(32)).replace('https://chrome.google.com/webstore/detail/REPLACE_WITH_EXTENSION_ID', 'http://localhost:8888/store-listing') });
  });
  await page.route('http://localhost:8888/store-listing', (route) => route.fulfill({ contentType: 'text/html', body: 'Store listing fallback' }));
  await page.goto('http://localhost:8888/?fileId=drive-file-123');
  await page.getByRole('button', { name: 'Edit in AuraMindmap' }).click();
  await expect(page).toHaveURL('http://localhost:8888/store-listing');
  await page.close();
});
