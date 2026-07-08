import { test, expect } from '@playwright/test';
import {
  launchExtensionContext,
  editorPageUrl,
  popupPageUrl,
} from './helpers/extension-context.mjs';

let context;
let extensionId;

test.beforeAll(async () => {
  ({ context, extensionId } = await launchExtensionContext());
});

test.afterAll(async () => {
  await context?.close();
});

test.describe('AuraMindmap Chrome Extension', () => {
  test('registers MV3 service worker and resolves extension id', async () => {
    const workers = context.serviceWorkers();
    expect(workers.length).toBeGreaterThanOrEqual(1);

    const workerUrl = workers[0].url();
    expect(workerUrl).toMatch(/^chrome-extension:\/\//);
    expect(workerUrl).toContain('/background.js');
    expect(extensionId).toMatch(/^[a-p]{32}$/);
  });

  test('editor page renders AuraMindmap shell', async () => {
    const page = await context.newPage();
    try {
      await page.goto(editorPageUrl(extensionId));

      await expect(page.getByRole('heading', { name: 'AuraMindmap' })).toBeVisible();
      await expect(page.getByTestId('btn-markers')).toBeVisible();
      await expect(page.getByTestId('map')).toBeVisible();
      await expect(page.getByTestId('status')).not.toHaveText('loading…', {
        timeout: 15_000,
      });
    } finally {
      await page.close();
    }
  });

  test('shows open-folder workflow when no folder is connected', async () => {
    const page = await context.newPage();
    try {
      await page.goto(editorPageUrl(extensionId));
      await expect(page.getByTestId('status')).not.toHaveText('loading…', {
        timeout: 15_000,
      });

      const reconnectPrompt = page.getByTestId('reconnect-prompt');
      if (await reconnectPrompt.isVisible()) {
        await expect(reconnectPrompt.getByRole('heading', { name: 'Reconnect folder' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Reconnect folder' })).toBeVisible();
        return;
      }

      // Fresh profile: no saved folder — open the file panel to reach folder actions.
      await page.getByTestId('file-name').click();
      await expect(page.getByTestId('file-panel')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Choose folder…' })).toBeVisible();
      await expect(page.getByTestId('folder-connect-hint')).toBeVisible();
      await expect(page.getByTestId('folder-connect-hint')).toContainText(/choose a folder/i);
      await expect(page.getByTestId('folder-connect-hint')).toContainText(/\.md files look disabled/i);
      await expect(page.getByTestId('status')).toContainText(/choose a folder|load error|no markdown/i);
    } finally {
      await page.close();
    }
  });

  test('map canvas stays empty without a connected folder', async () => {
    const page = await context.newPage();
    try {
      await page.goto(editorPageUrl(extensionId));
      await expect(page.getByTestId('status')).not.toHaveText('loading…', {
        timeout: 15_000,
      });

      await expect(page.getByTestId('map')).toBeVisible();
      await expect(page.locator('me-tpc')).toHaveCount(0);
      await expect(page.getByTestId('marker-picker')).toBeHidden();
    } finally {
      await page.close();
    }
  });

  test('popup page renders Open AuraMindmap button', async () => {
    const page = await context.newPage();
    try {
      await page.goto(popupPageUrl(extensionId));
      await expect(page.getByRole('button', { name: 'Open AuraMindmap' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Recent files' })).toBeVisible();
      await expect(page.getByText('No recent files')).toBeVisible();
    } finally {
      await page.close();
    }
  });
});

// TODO: Map editing, marker picker, save/autosave, and paste flows require a real
// folder handle (showDirectoryPicker cannot be driven by Playwright). Seed IndexedDB
// with a mock FileSystemDirectoryHandle only if a clean harness becomes available.
test.describe.skip('map editing (requires folder — not automatable)', () => {
  test('loads fixture markdown and assigns priority hotkey', async () => {
    // Blocked: needs showDirectoryPicker or mock folder handle in IndexedDB.
  });

  test('autosaves draft after marker edit', async () => {
    // Blocked: needs an open markdown file in folder mode.
  });
});
