import { test, expect } from '@playwright/test';

async function selectNode(page, label) {
  const node = page.locator('me-tpc', { hasText: label }).first();
  await node.click();
  await expect(node).toHaveClass(/selected/);
}

test.describe('Sprint Mindmap Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('status')).toContainText(/ready|draft restored/, {
      timeout: 15_000,
    });
  });

  test('loads map and fixture content', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Sprint Mindmap Editor' })).toBeVisible();
    await expect(page.getByText('Branch A')).toBeVisible();
    await expect(page.getByText('Critical task')).toBeVisible();
  });

  test('registers service worker for PWA shell', async ({ page }) => {
    const registered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg;
    });
    expect(registered).toBe(true);
  });

  test('assigns priority with plain digit hotkey', async ({ page }) => {
    await selectNode(page, 'Task one');
    await page.keyboard.press('2');

    const selected = page.locator('me-tpc.selected');
    await expect(selected.locator('.pri-badge')).toHaveText('2');
  });

  test('assigns priority via toolbar buttons', async ({ page }) => {
    await selectNode(page, 'Task one');
    await page.getByTestId('pri-btn-3').click();

    const selected = page.locator('me-tpc.selected');
    await expect(selected.locator('.pri-badge')).toHaveText('3');
  });

  test('clears priority with 0 key', async ({ page }) => {
    await selectNode(page, 'Critical task');
    await expect(page.locator('me-tpc.selected .pri-badge')).toHaveText('1');

    await page.keyboard.press('0');
    await expect(page.locator('me-tpc.selected .pri-badge')).toHaveCount(0);
  });

  test('priority filter dims other priorities when enabled', async ({ page }) => {
    await selectNode(page, 'Critical task');
    const filterBtn = page.getByTestId('priority-filter-btn');
    await expect(filterBtn).toBeEnabled();
    await filterBtn.click();
    await expect(filterBtn).toHaveClass(/active/);

    await expect(page.locator('me-tpc.dimmed').first()).toBeVisible();
  });

  test('autosaves draft after edit', async ({ page }) => {
    await selectNode(page, 'Task two');
    await page.getByTestId('pri-btn-4').click();
    await expect(page.getByTestId('status')).toContainText(/draft saved/, {
      timeout: 5_000,
    });
  });
});
