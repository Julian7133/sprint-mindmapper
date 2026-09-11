import { test, expect } from '@playwright/test';
import { bootNative } from './setup.js';

/**
 * Native workspace behaviour on the real staged frontend + shimmed Tauri IPC:
 * folder restore, file list, save (markdown + generated markmap html), create,
 * subfolder maps, and the "open markmap in default app" bridge command.
 */

async function ensureFilePanelOpen(page) {
  const panel = page.getByTestId('file-panel');
  if (await panel.evaluate((el) => el.classList.contains('hidden'))) {
    await page.locator('#file-name').click();
  }
  await expect(panel).not.toHaveClass(/hidden/);
}

function calls(page, cmd) {
  return page.evaluate(
    (c) => (window.__tauriCalls || []).filter((x) => x.cmd === c),
    cmd
  );
}

test.beforeEach(async ({ page }) => {
  await bootNative(page);
  await expect(page.getByTestId('status')).toContainText(/ready|draft restored/, {
    timeout: 15_000,
  });
});

test('restores the saved folder label and lists all markdown files', async ({ page }) => {
  await expect(page.getByTestId('workspace-label')).toContainText('fixtures');
  await ensureFilePanelOpen(page);
  const items = page.getByTestId('file-list-item');
  await expect(items).toHaveCount(3);
  await expect(items.filter({ hasText: 'alpha.md' })).toBeVisible();
  await expect(items.filter({ hasText: 'beta.md' })).toBeVisible();
  await expect(items.filter({ hasText: 'planning/gamma.md' })).toBeVisible();
});

test('opens a map that lives in a subfolder', async ({ page }) => {
  await ensureFilePanelOpen(page);
  await page.getByTestId('file-list-item').filter({ hasText: 'planning/gamma.md' }).click();
  await expect(page.getByTestId('status')).toContainText('ready', { timeout: 10_000 });
  await expect(page.getByText('Gamma', { exact: true })).toBeVisible();
  // Tab labels show the basename; the full rel path lives on the data-rel attr.
  await expect(
    page.locator('[data-testid="map-tab"][aria-selected="true"]')
  ).toHaveAttribute('data-rel', 'planning/gamma.md');
});

test('saving writes the markdown and its generated markmap html', async ({ page }) => {
  await page.locator('#btn-save').click();
  await expect(page.getByTestId('status')).toContainText(/saved/, { timeout: 15_000 });

  const writes = await calls(page, 'write_text_file');
  const written = writes.map((w) => w.args.relPath);
  expect(written).toContain('alpha.md');
  expect(written).toContain('alpha.html'); // markmap output rendered in-page
});

test('creating a file writes it and opens it in a new tab', async ({ page }) => {
  await ensureFilePanelOpen(page);
  await page.locator('#btn-new-file').click();
  await page.locator('#new-file-name').fill('fresh-map');
  await page.locator('#new-file-name').press('Enter');

  await expect(page.getByTestId('status')).toContainText(/ready|saved/, { timeout: 10_000 });
  const writes = await calls(page, 'write_text_file');
  expect(writes.map((w) => w.args.relPath)).toContain('fresh-map.md');
  await expect(
    page.locator('[data-testid="map-tab"][aria-selected="true"]')
  ).toContainText('fresh-map.md');
});

test('"open markmap" routes to the native default-app command', async ({ page }) => {
  // Save first so the markmap html exists, then trigger the bridge control.
  await page.locator('#btn-save').click();
  await expect(page.getByTestId('status')).toContainText(/saved/, { timeout: 15_000 });

  // The native bridge intercepts #btn-open-markmap via a document-level capture
  // listener, so the export panel's visibility is irrelevant. Dispatch a real
  // bubbling click straight on the element (it lives in a hidden panel).
  await page.evaluate(() =>
    document
      .getElementById('btn-open-markmap')
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  );
  await expect
    .poll(async () => (await calls(page, 'open_markmap_in_default_app')).length, {
      timeout: 5_000,
    })
    .toBe(1);
  const [call] = await calls(page, 'open_markmap_in_default_app');
  expect(call.args.relPath).toBe('alpha.html');
});
