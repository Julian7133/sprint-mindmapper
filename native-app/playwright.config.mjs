import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8744;

/**
 * Native-app e2e: drives the real staged frontend (dist/) in WebKit — the
 * engine closest to the app's WKWebView — with the Tauri IPC layer shimmed
 * in-page. Runs on macOS and on a stock GitHub `ubuntu-latest` runner
 * (`npx playwright install --with-deps webkit`); no Tauri build, no Linux VM,
 * no WebDriver. `npm run test:e2e` builds dist/ first, then runs this.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.e2e\.js/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }],
  webServer: {
    command: `node tests/e2e/serve.mjs`,
    cwd: __dirname,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { ...process.env, PORT: String(PORT) },
  },
});
