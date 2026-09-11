import { test, expect } from '@playwright/test';
import { bootNative } from './setup.js';

/**
 * Tab behaviour on the REAL native frontend (dist/) with the Tauri IPC shimmed.
 * The reported bug: "opening a second mindmap in a tab shows nothing".
 *
 * Root cause: MindElixir sets an inline `position: relative` on each `.map-doc`
 * in its constructor, overriding the stylesheet's `position: absolute; inset: 0`.
 * The per-tab containers then collapse to content height and STACK vertically in
 * normal flow instead of overlapping — so every tab after the first lands a full
 * map-height below the viewport (blank). Only visible with real-sized maps: tiny
 * fixtures fit the viewport and hide it, which is why the earlier on-screen
 * assertion passed while the packaged app stayed broken. Fixed in CSS with
 * `.map-doc { position: absolute !important; inset: 0 !important }` — see the
 * large-map layout guard below, which fails without that rule.
 */

async function ensureFilePanelOpen(page) {
  const panel = page.getByTestId('file-panel');
  if (await panel.evaluate((el) => el.classList.contains('hidden'))) {
    await page.locator('#file-name').click();
  }
  await expect(panel).not.toHaveClass(/hidden/);
}

function activeTab(page) {
  return page.locator('[data-testid="map-tab"][aria-selected="true"]');
}

async function openFromList(page, name) {
  await ensureFilePanelOpen(page);
  await page.getByTestId('file-list-item').filter({ hasText: name }).click();
  // Close the panel so it doesn't overlay the tab bar (it's fixed at top-left
  // and would intercept subsequent map-tab clicks).
  const panel = page.getByTestId('file-panel');
  if (!(await panel.evaluate((el) => el.classList.contains('hidden')))) {
    await page.locator('#file-name').click();
  }
  await expect(panel).toHaveClass(/hidden/);
}

/** Geometry of the active map's root node relative to its container. */
async function activeRootGeometry(page) {
  return page.evaluate(() => {
    const active = document.querySelector('.map-doc.active');
    const root = active?.querySelector('me-root');
    if (!active || !root) return null;
    const c = active.getBoundingClientRect();
    const r = root.getBoundingClientRect();
    return {
      container: { x: c.x, y: c.y, w: c.width, h: c.height },
      root: { x: r.x, y: r.y, w: r.width, h: r.height },
      // Is the root box inside the visible container box?
      onScreen:
        r.x + r.width > c.x &&
        r.x < c.x + c.width &&
        r.y + r.height > c.y &&
        r.y < c.y + c.height &&
        r.width > 0 &&
        r.height > 0,
    };
  });
}

test.beforeEach(async ({ page }) => {
  await bootNative(page);
  await expect(page.getByTestId('status')).toContainText(/ready|draft restored/, {
    timeout: 15_000,
  });
});

test('boots restored into folder mode with the first map visible', async ({ page }) => {
  await expect(page.getByText('Alpha', { exact: true })).toBeVisible();
  await expect(page.getByText('AlphaBranchOne')).toBeVisible();
  await expect(activeTab(page)).toContainText('alpha.md');
  const geo = await activeRootGeometry(page);
  expect(geo?.onScreen).toBe(true);
});

test('opening a second mindmap in a tab renders it on screen', async ({ page }) => {
  await openFromList(page, 'beta.md');
  await expect(page.getByTestId('status')).toContainText('ready', { timeout: 10_000 });

  // Second map is the active one and its content is shown; first is hidden.
  await expect(activeTab(page)).toContainText('beta.md');
  await expect(page.getByTestId('map-tab')).toHaveCount(2);
  await expect(page.getByText('Beta', { exact: true })).toBeVisible();
  await expect(page.getByText('BetaBranchOne')).toBeVisible();
  await expect(page.getByText('AlphaBranchOne')).not.toBeVisible();

  // The regression itself: the freshly opened map must be on screen, not
  // scrolled off into the void (mirrors activateTab's post-visibility center).
  const geo = await activeRootGeometry(page);
  expect(geo, 'active map root geometry').not.toBeNull();
  expect(geo.onScreen, `root ${JSON.stringify(geo.root)} vs ${JSON.stringify(geo.container)}`).toBe(true);
});

test('switching back to the first tab restores its map, centered', async ({ page }) => {
  await openFromList(page, 'beta.md');
  await expect(page.getByTestId('map-tab')).toHaveCount(2);

  await page.getByTestId('map-tab').filter({ hasText: 'alpha.md' }).click();
  await expect(activeTab(page)).toContainText('alpha.md');
  await expect(page.getByText('AlphaBranchOne')).toBeVisible();
  await expect(page.getByText('BetaBranchOne')).not.toBeVisible();
  expect((await activeRootGeometry(page))?.onScreen).toBe(true);
});

test('re-opening an already-open map just activates its tab', async ({ page }) => {
  await openFromList(page, 'beta.md');
  await expect(page.getByTestId('map-tab')).toHaveCount(2);
  await openFromList(page, 'alpha.md');
  await expect(page.getByTestId('map-tab')).toHaveCount(2);
  await expect(activeTab(page)).toContainText('alpha.md');
});

test('closing the active tab activates and renders its neighbour', async ({ page }) => {
  await openFromList(page, 'beta.md');
  await expect(activeTab(page)).toContainText('beta.md');

  await activeTab(page).locator('[data-testid="tab-close"]').click();
  await expect(page.getByTestId('map-tab')).toHaveCount(1);
  await expect(activeTab(page)).toContainText('alpha.md');
  await expect(page.getByText('AlphaBranchOne')).toBeVisible();
  expect((await activeRootGeometry(page))?.onScreen).toBe(true);
});

test('a second LARGE map stays in the viewport (map-doc overlap guard)', async ({ page }) => {
  // The actual bug only shows with real-sized maps: without the CSS fix the
  // .map-doc collapses to content height and tabs stack, pushing the 2nd tab far
  // below the viewport. This test FAILS without `position:absolute !important`
  // (pre-fix: active map-doc ~11000px tall, root ~16000px down; post-fix: ~viewport
  // height, root on screen). Engine-independent — the bug is not WKWebView-only.
  const big = (title, n) => {
    let md = `# ${title}\n\n`;
    for (let i = 0; i < n; i++) {
      md += `## ${title} Branch ${i}\n`;
      for (let j = 0; j < 5; j++) md += `### ${title} Leaf ${i}.${j} longer text\n`;
    }
    return md;
  };
  await bootNative(page, {
    files: { 'big-a.md': big('Aay', 40), 'big-b.md': big('Bee', 40) },
    record: {
      rootDir: '/fixtures',
      folderId: 'fixture-folder',
      folderLabel: 'fixtures',
      activeFile: 'big-a.md',
      openTabs: ['big-a.md'],
    },
  });
  await expect(page.getByTestId('status')).toContainText(/ready|draft restored/, { timeout: 15_000 });
  await openFromList(page, 'big-b.md');
  await expect(page.getByTestId('status')).toContainText('ready', { timeout: 10_000 });

  const geo = await page.evaluate(() => {
    const active = document.querySelector('.map-doc.active');
    const r = active.getBoundingClientRect();
    const root = active.querySelector('me-root').getBoundingClientRect();
    return {
      docHeight: r.height,
      viewportH: window.innerHeight,
      rootTop: root.y,
      rootOnScreen: root.y >= 0 && root.y <= window.innerHeight,
      computedPosition: getComputedStyle(active).position,
    };
  });
  // map-doc must be clamped to the viewport box, not grown to content height.
  expect(geo.computedPosition).toBe('absolute');
  expect(geo.docHeight).toBeLessThan(geo.viewportH + 50);
  expect(geo.rootOnScreen, `root at y=${Math.round(geo.rootTop)} outside viewport ${geo.viewportH}`).toBe(true);
});

test('detach routes through the native open_new_window command', async ({ page }) => {
  await openFromList(page, 'beta.md');
  await expect(activeTab(page)).toContainText('beta.md');

  await activeTab(page).locator('[data-testid="tab-detach"]').click();

  const detachCalls = await page.evaluate(() =>
    (window.__tauriCalls || []).filter((c) => c.cmd === 'open_new_window')
  );
  expect(detachCalls.length).toBe(1);
  expect(detachCalls[0].args.file).toBe('beta.md');
  // Detach opens a native window instead of a browser popup: still 2 tabs here.
  await expect(page.getByTestId('map-tab')).toHaveCount(2);
});
