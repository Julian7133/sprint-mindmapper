import { test, expect } from '@playwright/test';
import { bootNative } from './setup.js';

/**
 * Native menu bridge: the Rust menu emits `auramindmap://menu` events that the
 * native bridge maps onto editor UI actions. We drive them via the shim's
 * __tauriMockEmit and assert the resulting UI / IPC.
 */

const MENU_EVENT = 'auramindmap://menu';

function emitMenu(page, action) {
  return page.evaluate(
    ({ event, action }) => window.__tauriMockEmit(event, { action }),
    { event: MENU_EVENT, action }
  );
}

test('File → New Map opens the new-file form', async ({ page }) => {
  await bootNative(page);
  await expect(page.getByTestId('status')).toContainText(/ready|draft restored/, {
    timeout: 15_000,
  });

  await expect(page.getByTestId('file-new-form')).toHaveClass(/hidden/);
  const fired = await emitMenu(page, 'new-file');
  expect(fired).toBeGreaterThan(0); // the bridge registered a listener
  await expect(page.getByTestId('file-panel')).not.toHaveClass(/hidden/);
  await expect(page.getByTestId('file-new-form')).not.toHaveClass(/hidden/);
});

test('File → Open Folder drives the native picker and connects the folder', async ({ page }) => {
  // Boot with no saved folder, then pick one via the (shimmed) native dialog.
  await bootNative(page, { record: null, dialogResult: '/fixtures' });
  await expect(page.getByTestId('status')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('workspace-label')).toHaveClass(/hidden/);

  await emitMenu(page, 'open-folder');

  // Dialog was invoked and the folder got adopted → label + files appear.
  await expect
    .poll(async () =>
      page.evaluate(
        () => (window.__tauriCalls || []).filter((c) => c.cmd === 'plugin:dialog|open').length
      )
    )
    .toBeGreaterThan(0);
  await expect(page.getByTestId('workspace-label')).toContainText('fixtures', { timeout: 10_000 });
  await expect(
    page.locator('[data-testid="map-tab"][aria-selected="true"]')
  ).toHaveCount(1);
});
