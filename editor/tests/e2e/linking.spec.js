import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, '../fixtures');

const MAP_A = 'links-a.md';
const MAP_B = 'links-b.md';
const mapAPath = path.join(fixtureDir, MAP_A);
const mapBPath = path.join(fixtureDir, MAP_B);

const CONTENT_A = [
  '# Map A',
  '## Alpha',
  '### NodeA1 <!--smm:na1-->',
].join('\n') + '\n';

const CONTENT_B = [
  '# Map B',
  '## Beta',
  '### NodeB1 <!--smm:nb1-->',
  '- [points into A](map:links-a.md#na1)',
].join('\n') + '\n';

function writeFixtures(extraA = '') {
  fs.writeFileSync(mapAPath, CONTENT_A + extraA);
  fs.writeFileSync(mapBPath, CONTENT_B);
}

test.describe('Cross-map links (M2)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => writeFixtures());
  test.afterEach(() => {
    fs.rmSync(mapAPath, { force: true });
    fs.rmSync(mapBPath, { force: true });
    for (const f of fs.readdirSync(fixtureDir)) {
      if (f.startsWith('links-') && f.endsWith('.md.editor-draft')) {
        fs.rmSync(path.join(fixtureDir, f), { force: true });
      }
    }
  });

  async function openMap(page, rel, topic) {
    await page.goto(`/?file=${rel}`);
    await expect(page.getByTestId('status')).toContainText(/ready|draft restored/, {
      timeout: 15_000,
    });
    await expect(page.getByText(topic)).toBeVisible();
  }

  test('creates an internal link via the picker, saves, survives roundtrip, and navigates on click', async ({
    page,
  }) => {
    await openMap(page, MAP_A, 'Map A');

    // Right-click a node and open the link picker from the context menu.
    await page.locator('me-tpc').filter({ hasText: 'NodeA1' }).click({ button: 'right' });
    await page
      .locator('.context-menu .menu-list li')
      .filter({ hasText: 'Set link…' })
      .click();
    await expect(page.getByTestId('link-picker')).toBeVisible();

    // Switch to "This folder", pick map B, then a target node.
    await page.locator('.link-picker-tab').filter({ hasText: 'This folder' }).click();
    await page.getByTestId('link-picker-map').selectOption(MAP_B);
    await expect(page.getByTestId('link-picker-node').filter({ hasText: 'NodeB1' })).toBeVisible();
    await page.getByTestId('link-picker-node').filter({ hasText: 'NodeB1' }).click();
    await page.locator('.link-picker-apply').click();
    await expect(page.locator('a.hyper-link')).toHaveCount(1);
    await expect(page.locator('a.hyper-link').first()).toHaveAttribute(
      'href',
      'map:links-b.md#nb1'
    );

    // Dismiss the lingering MindElixir context menu so it can't intercept clicks.
    await page.evaluate(() => {
      const w = document.querySelector('.context-menu');
      if (w) w.hidden = true;
    });

    // Save and verify the markdown on disk contains the internal target.
    await page.locator('#btn-save').click();
    await expect(page.getByTestId('status')).toContainText(/saved/, { timeout: 10_000 });
    const savedA = fs.readFileSync(mapAPath, 'utf8');
    expect(savedA).toContain('map:links-b.md#nb1');
    expect(savedA).toContain('<!--smm:na1-->');

    // Roundtrip: reload and confirm the link + id survive.
    await page.reload();
    await expect(page.getByTestId('status')).toContainText(/ready|draft restored/, {
      timeout: 15_000,
    });
    await expect(page.locator('a.hyper-link')).toHaveCount(1);

    // Click the internal link -> opens map B and selects NodeB1.
    await page.locator('a.hyper-link').click();
    await expect(page.getByText('Map B')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[data-testid="map-tab"][aria-selected="true"]')
    ).toContainText(MAP_B);
    await expect(page.locator('me-tpc.selected').filter({ hasText: 'NodeB1' })).toBeVisible();
  });

  test('shows backlinks in the panel and navigates from a source row', async ({ page }) => {
    await openMap(page, MAP_A, 'Map A');

    await page.getByTestId('btn-backlinks').click();
    await expect(page.getByTestId('backlinks-panel')).toBeVisible();

    // Map B links into Map A's node na1, so a source row appears.
    const source = page.getByTestId('backlinks-source').filter({ hasText: MAP_B });
    await expect(source).toBeVisible();
    await expect(source).toContainText('points into A');

    // Clicking the source navigates to map B and selects the source node.
    await source.click();
    await expect(page.getByText('Map B')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[data-testid="map-tab"][aria-selected="true"]')
    ).toContainText(MAP_B);
  });

  test('reindexes backlinks after a save', async ({ page }) => {
    // Start with NO backlink into map A, then add one in map B and save.
    fs.writeFileSync(mapBPath, '# Map B\n## Beta\n- [fresh](map:links-a.md#na1)\n');
    await openMap(page, MAP_B, 'Map B');

    await page.locator('#btn-save').click();
    await expect(page.getByTestId('status')).toContainText(/saved/, { timeout: 10_000 });

    // Open map A and check the panel now shows the fresh backlink.
    await openMap(page, MAP_A, 'Map A');
    await page.getByTestId('btn-backlinks').click();
    await expect(page.getByTestId('backlinks-panel')).toBeVisible();
    await expect(page.getByTestId('backlinks-source').filter({ hasText: MAP_B })).toBeVisible();
  });

  test('gracefully falls back on a broken node target', async ({ page }) => {
    // NodeA1 links to a node id that does not exist in map B.
    writeFixtures('\n- [broken](map:links-b.md#ghost)\n');
    await openMap(page, MAP_A, 'Map A');

    const brokenLink = page.locator('a.hyper-link').filter({ hasText: '🔗' }).first();
    await expect(brokenLink).toBeVisible();
    await brokenLink.click();

    // Map B opens, but the target node can't be resolved -> error status, no selection.
    await expect(page.getByText('Map B')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('status')).toContainText(/not found/, { timeout: 10_000 });
    await expect(page.locator('me-tpc.selected')).toHaveCount(0);
  });

  test('rejects a link to a missing map without creating a ghost tab', async ({ page }) => {
    writeFixtures('\n- [ghost](map:ghost.md#x)\n');
    await openMap(page, MAP_A, 'Map A');

    await expect(page.getByTestId('map-tab')).toHaveCount(1);
    await page.locator('a.hyper-link').first().click();

    // No new map opened and no ghost tab was created.
    await expect(page.getByTestId('status')).toContainText(/Map not found/i, { timeout: 10_000 });
    await expect(page.getByTestId('map-tab')).toHaveCount(1);
  });

  test('link picker rejects unsafe external schemes without closing', async ({ page }) => {
    await openMap(page, MAP_A, 'Map A');

    await page.locator('me-tpc').filter({ hasText: 'NodeA1' }).click({ button: 'right' });
    await page
      .locator('.context-menu .menu-list li')
      .filter({ hasText: 'Set link…' })
      .click();
    await expect(page.getByTestId('link-picker')).toBeVisible();

    // External mode is default; type an unsafe scheme.
    await page.locator('.link-picker-url').fill('javascript:alert(1)');
    await page.locator('.link-picker-apply').click();

    // Dialog stays open and an accessible error is announced.
    await expect(page.getByTestId('link-picker')).toBeVisible();
    await expect(page.getByTestId('link-picker-error')).toBeVisible();
    await expect(page.getByTestId('link-picker-error')).toContainText(/http|https/i);

    // A valid https URL applies and closes the dialog.
    await page.locator('.link-picker-url').fill('https://example.com/x');
    await page.locator('.link-picker-apply').click();
    await expect(page.getByTestId('link-picker')).toBeHidden();
    await expect(page.locator('a.hyper-link')).toHaveCount(1);
    await expect(page.locator('a.hyper-link').first()).toHaveAttribute('href', 'https://example.com/x');
  });
});
