import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, '../fixtures');

async function ensureFilePanelOpen(page) {
  const panel = page.getByTestId('file-panel');
  const isHidden = await panel.evaluate((el) => el.classList.contains('hidden'));
  if (isHidden) {
    await page.locator('#file-name').click();
  }
  await expect(panel).not.toHaveClass(/hidden/);
}

test.describe('Workspace file workflows', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('status')).toContainText(/ready|draft restored/, {
      timeout: 15_000,
    });
  });

  test('switches between workspace files and updates the canvas', async ({ page }) => {
    await expect(page.getByText('Branch A')).toBeVisible();

    await ensureFilePanelOpen(page);
    await page.getByTestId('file-list-item').filter({ hasText: 'other-tasks.md' }).click();

    await expect(page.getByTestId('status')).toContainText('ready', { timeout: 10_000 });
    await expect(page.getByText('Other Project')).toBeVisible();
    await expect(page.getByText('Branch A')).not.toBeVisible();

    await ensureFilePanelOpen(page);
    await page.getByTestId('file-list-item').filter({ hasText: 'sample-tasks.md' }).click();

    await expect(page.getByTestId('status')).toContainText('ready', { timeout: 10_000 });
    await expect(page.getByText('Branch A')).toBeVisible();
  });

  test('creates a new markdown file via inline form', async ({ page }) => {
    const fileName = `notes-${Date.now()}.md`;
    const rootTopic = fileName.replace(/\.md$/i, '').replace(/[-_]+/g, ' ');

    await ensureFilePanelOpen(page);
    await page.getByRole('button', { name: 'New file' }).click();
    await expect(page.getByTestId('file-new-form')).toBeVisible();

    await page.locator('#new-file-name').fill(fileName);
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page.getByTestId('status')).toContainText('ready', { timeout: 10_000 });
    await expect(page.getByTestId('file-name')).toHaveText(fileName);
    await expect(page.locator('me-tpc', { hasText: rootTopic }).first()).toBeVisible();
    await expect(page.getByTestId('file-list-item').filter({ hasText: fileName })).toHaveClass(/active/);
  });

  test('imports OPML and opens the converted mindmap', async ({ page }) => {
    await ensureFilePanelOpen(page);
    await page.getByRole('button', { name: 'Import…' }).click();

    const opmlPath = path.join(fixtureDir, 'sample-import.opml');
    await page.locator('#import-input').setInputFiles(opmlPath);

    await expect(page.getByTestId('status')).toContainText(/imported|ready/, {
      timeout: 10_000,
    });
    await expect(page.getByText('Imported Root')).toBeVisible();
    await expect(page.getByText('Imported child')).toBeVisible();
    await expect(page.getByTestId('file-name')).toHaveText(/sample-import(-\d+)?\.md/);
  });
});
