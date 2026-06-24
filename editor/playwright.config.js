import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureMd = path.join(__dirname, 'tests/fixtures/sample-tasks.md');
const testDraft = path.join(__dirname, 'tests/fixtures/.test-draft');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8732',
    trace: 'on-first-retry',
  },
  webServer: {
    command: `node server.mjs "${fixtureMd}"`,
    cwd: __dirname,
    url: 'http://127.0.0.1:8732',
    reuseExistingServer: false,
    env: {
      ...process.env,
      PORT: '8732',
      SKIP_RENDER: '1',
      CACHE_PATH: testDraft,
    },
  },
});
