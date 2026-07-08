import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the unpacked extension root (contains manifest.json). */
export const extensionPath = path.resolve(__dirname, '../../..');

/**
 * Launch a persistent Chromium profile with the unpacked MV3 extension loaded.
 * @returns {Promise<{ context: import('@playwright/test').BrowserContext, extensionId: string }>}
 */
export async function launchExtensionContext() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  }

  const extensionId = new URL(serviceWorker.url()).host;
  if (!extensionId) {
    throw new Error(`Could not parse extension id from ${serviceWorker.url()}`);
  }

  return { context, extensionId };
}

/** @param {string} extensionId */
export function editorPageUrl(extensionId) {
  return `chrome-extension://${extensionId}/editor/index.html`;
}

/** @param {string} extensionId */
export function sidePanelPageUrl(extensionId) {
  return `chrome-extension://${extensionId}/editor/side-panel.html`;
}

/** @param {string} extensionId */
export function popupPageUrl(extensionId) {
  return `chrome-extension://${extensionId}/popup.html`;
}
