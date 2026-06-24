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
    await expect(page.getByTestId('marker-picker')).toBeVisible();
  });

  test('loads map and fixture content', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Sprint Mindmap Editor' })).toBeVisible();
    await expect(page.getByText('Branch A')).toBeVisible();
    await expect(page.getByText('Critical task')).toBeVisible();
  });

  test('assigns priority with Cmd/Ctrl+digit hotkey', async ({ page }) => {
    await selectNode(page, 'Task one');
    await page.keyboard.press('Control+2');

    const selected = page.locator('me-tpc.selected');
    await expect(selected.locator('.marker-pri')).toHaveText('2');
  });

  test('assigns task progress via marker picker', async ({ page }) => {
    await selectNode(page, 'Task one');
    const taskBtn = page.locator('.marker-picker-row .marker-pick-btn[data-section="taskProgress"][data-level="4"]');
    await taskBtn.click();

    const selected = page.locator('me-tpc.selected');
    await expect(selected.locator('.marker-task.task-4')).toBeVisible();
  });

  test('assigns flag and star via marker picker', async ({ page }) => {
    await selectNode(page, 'Task two');
    await page.locator('.marker-pick-btn[data-section="flag"][data-level="1"]').click();
    await page.locator('.marker-pick-btn[data-section="star"][data-level="3"]').click();

    const selected = page.locator('me-tpc.selected');
    await expect(selected.locator('.marker-flag')).toHaveText('⚑');
    await expect(selected.locator('.marker-star')).toHaveText('★');
  });

  test('clears priority with Cmd/Ctrl+Shift+0', async ({ page }) => {
    await selectNode(page, 'Critical task');
    await expect(page.locator('me-tpc.selected .marker-pri')).toHaveText('1');

    await page.keyboard.press('Control+Shift+0');
    await expect(page.locator('me-tpc.selected .marker-pri')).toHaveCount(0);
  });

  test('type-to-edit overwrites label on selected node', async ({ page }) => {
    await selectNode(page, 'Task one');
    await page.keyboard.type('Renamed');
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('map').getByText('Renamed')).toBeVisible();
    await expect(page.getByTestId('map').getByText('Task one')).toHaveCount(0);
  });

  test('Enter creates sibling and accepts immediate typing', async ({ page }) => {
    await selectNode(page, 'Task one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('New sibling');
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('map').getByText('New sibling')).toBeVisible();
  });

  test('priority filter dims other priorities when enabled', async ({ page }) => {
    await selectNode(page, 'Critical task');
    const filterBtn = page.getByTestId('priority-filter-btn');
    await expect(filterBtn).toBeEnabled();
    await filterBtn.click();
    await expect(filterBtn).toHaveClass(/active/);
    await expect(page.locator('me-tpc.dimmed').first()).toBeVisible();
  });

  test('autosaves draft after marker edit', async ({ page }) => {
    await selectNode(page, 'Task two');
    await page.locator('.marker-pick-btn[data-section="priority"][data-level="4"]').click();
    await expect(page.getByTestId('status')).toContainText(/draft saved/, {
      timeout: 5_000,
    });
  });
});
