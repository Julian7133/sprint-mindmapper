import { test, expect } from '@playwright/test';

async function ensureFilePanelOpen(page) {
  const panel = page.getByTestId('file-panel');
  const isHidden = await panel.evaluate((el) => el.classList.contains('hidden'));
  if (isHidden) {
    await page.locator('#file-name').click();
  }
  await expect(panel).not.toHaveClass(/hidden/);
}

function activeTab(page) {
  return page.locator('[data-testid="map-tab"][aria-selected="true"]');
}

test.describe('Map tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('status')).toContainText(/ready|draft restored/, {
      timeout: 15_000,
    });
  });

  test('opens a second tab and switches between maps', async ({ page }) => {
    await expect(page.getByText('Branch A')).toBeVisible();
    await expect(activeTab(page)).toContainText('sample-tasks.md');

    await ensureFilePanelOpen(page);
    await page.getByTestId('file-list-item').filter({ hasText: 'other-tasks.md' }).click();
    await expect(page.getByTestId('status')).toContainText('ready', { timeout: 10_000 });

    await expect(page.getByText('Other Project')).toBeVisible();
    await expect(page.getByText('Branch A')).not.toBeVisible();
    await expect(page.getByTestId('tab-bar')).not.toHaveClass(/hidden/);
    await expect(page.getByTestId('map-tab')).toHaveCount(2);
    await expect(activeTab(page)).toContainText('other-tasks.md');

    // Switch back via the tab bar.
    await page.getByTestId('map-tab').filter({ hasText: 'sample-tasks.md' }).click();
    await expect(page.getByText('Branch A')).toBeVisible();
    await expect(page.getByText('Other Project')).not.toBeVisible();
    await expect(activeTab(page)).toContainText('sample-tasks.md');
  });

  test('opening an already-open file just activates its existing tab', async ({ page }) => {
    await ensureFilePanelOpen(page);
    await page.getByTestId('file-list-item').filter({ hasText: 'other-tasks.md' }).click();
    await expect(page.getByTestId('map-tab')).toHaveCount(2);

    // Re-open sample-tasks.md from the file list — should not duplicate the tab.
    await page.getByTestId('file-list-item').filter({ hasText: 'sample-tasks.md' }).click();
    await expect(page.getByTestId('map-tab')).toHaveCount(2);
    await expect(activeTab(page)).toContainText('sample-tasks.md');
    await expect(page.getByText('Branch A')).toBeVisible();
  });

  test('closing the active tab activates its neighbour', async ({ page }) => {
    await ensureFilePanelOpen(page);
    await page.getByTestId('file-list-item').filter({ hasText: 'other-tasks.md' }).click();
    await expect(page.getByTestId('map-tab')).toHaveCount(2);
    await expect(activeTab(page)).toContainText('other-tasks.md');

    await activeTab(page).locator('[data-testid="tab-close"]').click();

    await expect(page.getByTestId('map-tab')).toHaveCount(1);
    await expect(activeTab(page)).toContainText('sample-tasks.md');
    await expect(page.getByText('Branch A')).toBeVisible();
  });

  test('cycling tabs with Ctrl/Cmd+Tab switches the active map', async ({ page }) => {
    await ensureFilePanelOpen(page);
    await page.getByTestId('file-list-item').filter({ hasText: 'other-tasks.md' }).click();
    await expect(page.getByTestId('map-tab')).toHaveCount(2);
    await expect(activeTab(page)).toContainText('other-tasks.md');

    await page.keyboard.press('Control+Tab');
    await expect(activeTab(page)).toContainText('sample-tasks.md');
    await expect(page.getByText('Branch A')).toBeVisible();

    await page.keyboard.press('Control+Shift+Tab');
    await expect(activeTab(page)).toContainText('other-tasks.md');
    await expect(page.getByText('Other Project')).toBeVisible();
  });

  test('detach opens the map in a new window', async ({ page }) => {
    await ensureFilePanelOpen(page);
    await page.getByTestId('file-list-item').filter({ hasText: 'other-tasks.md' }).click();
    await expect(page.getByTestId('map-tab')).toHaveCount(2);
    await expect(activeTab(page)).toContainText('other-tasks.md');

    const popupPromise = page.waitForEvent('popup');
    await activeTab(page).locator('[data-testid="tab-detach"]').click();
    const popup = await popupPromise;
    await popup.waitForLoadState('load');

    expect(popup.url()).toContain('file=');
    await expect(popup.getByTestId('status')).toContainText(/ready|draft restored/, {
      timeout: 15_000,
    });
    await expect(popup.getByText('Other Project')).toBeVisible();
  });
});