import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, '../fixtures');

const REL = 'broadcast-sync-fixture.md';
const DRAFT = `${REL}.editor-draft`;
const fixturePath = path.join(fixtureDir, REL);
const draftPath = path.join(fixtureDir, DRAFT);

test.describe('BroadcastChannel save sync', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async () => {
    fs.writeFileSync(fixturePath, '# Broadcast Fixture\n## A\n');
    fs.rmSync(draftPath, { force: true });
  });

  test.afterEach(async () => {
    fs.rmSync(fixturePath, { force: true });
    fs.rmSync(draftPath, { force: true });
  });

  test('reloads the freshly saved markdown, not a stale draft, on external save', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    try {
      await pageA.goto(`/?file=${REL}`);
      await pageB.goto(`/?file=${REL}`);
      await expect(pageA.getByTestId('status')).toContainText(/ready|draft restored/);
      await expect(pageB.getByTestId('status')).toContainText(/ready|draft restored/);
      await expect(pageA.getByText('Broadcast Fixture')).toBeVisible();
      await expect(pageB.getByText('Broadcast Fixture')).toBeVisible();

      // Seed a stale draft for page B (server-side draft file) that differs from
      // the saved markdown. Page B itself is not dirty.
      await pageB.evaluate((rel) =>
        fetch(`/api/draft?file=${rel}`, {
          method: 'PUT',
          body: '# STALE DRAFT\n',
        })
      , REL);

      // Window A edits the map and saves — this writes markdown to disk and
      // posts a broadcast for page B.
      await pageA.getByTestId('map').locator('me-tpc').first().click();
      await pageA.keyboard.press('Enter');
      await pageA.keyboard.type('NewChild');
      await pageA.keyboard.press('Enter');
      await pageA.keyboard.press('Control+s');
      await expect(pageA.getByTestId('status')).toContainText(/saved/, { timeout: 10_000 });

      // Page B must reload from the just-saved markdown, not the stale draft.
      await expect(pageB.getByText('NewChild')).toBeVisible({ timeout: 10_000 });
      await expect(pageB.getByText('STALE DRAFT')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('does not clobber a dirty doc and warns when another window saves', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    try {
      await pageA.goto(`/?file=${REL}`);
      await pageB.goto(`/?file=${REL}`);
      await expect(pageA.getByTestId('status')).toContainText(/ready|draft restored/);
      await expect(pageB.getByTestId('status')).toContainText(/ready|draft restored/);
      await expect(pageB.getByText('Broadcast Fixture')).toBeVisible();

      // Page B holds an unsaved local edit (dirty) — its draft autosaves.
      await pageB.getByTestId('map').locator('me-tpc').first().click();
      await pageB.keyboard.press('Enter');
      await pageB.keyboard.type('LocalEdit');
      await pageB.keyboard.press('Enter');

      // Window A saves a change and broadcasts.
      await pageA.getByTestId('map').locator('me-tpc').first().click();
      await pageA.keyboard.press('Enter');
      await pageA.keyboard.type('RemoteEdit');
      await pageA.keyboard.press('Enter');
      await pageA.keyboard.press('Control+s');
      await expect(pageA.getByTestId('status')).toContainText(/saved/, { timeout: 10_000 });

      // Page B must NOT reload over its unsaved edit; it warns instead.
      await expect(pageB.getByTestId('status')).toContainText(/unsaved local changes|Saved by another window/, {
        timeout: 10_000,
      });
      await expect(pageB.getByTestId('map').getByText('LocalEdit')).toBeVisible();
      await expect(pageB.getByTestId('map').getByText('RemoteEdit')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});