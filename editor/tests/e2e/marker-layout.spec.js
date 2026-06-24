import { test, expect } from '@playwright/test';

async function rowMetrics(page) {
  return page.locator('.marker-picker-row').evaluateAll((rows) =>
    rows.map((row) => {
      const rect = row.getBoundingClientRect();
      const clear = row.querySelector('.marker-pick-clear');
      const clearRect = clear?.getBoundingClientRect();
      const buttons = [...row.querySelectorAll('.marker-pick-btn')].map((btn) => {
        const r = btn.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
      return {
        width: rect.width,
        right: rect.right,
        clearRight: clearRect?.right ?? null,
        buttons,
      };
    })
  );
}

function maxDelta(values) {
  return Math.max(...values) - Math.min(...values);
}

test.describe('Marker picker layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('status')).toContainText(/ready|draft restored/, {
      timeout: 15_000,
    });
    await expect(page.getByTestId('marker-picker')).toBeVisible();
  });

  test('all marker rows share the same width and right edge', async ({ page }) => {
    const metrics = await rowMetrics(page);

    expect(metrics.length).toBe(5);

    const widths = metrics.map((m) => m.width);
    const rights = metrics.map((m) => m.right);
    const clearRights = metrics.map((m) => m.clearRight);

    expect(maxDelta(widths)).toBeLessThan(1);
    expect(maxDelta(rights)).toBeLessThan(1);
    expect(maxDelta(clearRights)).toBeLessThan(1);
  });

  test('every picker button slot matches the grid cell size', async ({ page }) => {
    const slotSize = await page
      .locator('.marker-picker')
      .evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--marker-size')));

    expect(slotSize).toBe(32);

    const metrics = await rowMetrics(page);
    for (const row of metrics) {
      for (const btn of row.buttons) {
        expect(btn.width).toBeGreaterThanOrEqual(slotSize - 1);
        expect(btn.width).toBeLessThanOrEqual(slotSize + 1);
        expect(btn.height).toBeGreaterThanOrEqual(slotSize - 1);
        expect(btn.height).toBeLessThanOrEqual(slotSize + 1);
      }
    }
  });

  test('task row does not exceed priority row width', async ({ page }) => {
    const metrics = await rowMetrics(page);
    const bySection = Object.fromEntries(
      await page.locator('.marker-picker-section').evaluateAll((sections) =>
        sections.map((section) => {
          const row = section.querySelector('.marker-picker-row');
          const label = section.querySelector('.marker-picker-label')?.textContent?.trim();
          const rect = row.getBoundingClientRect();
          return [label, rect.width];
        })
      )
    );

    expect(bySection.Task).toBeLessThanOrEqual(bySection.Priority + 1);
    expect(bySection.Task).toBeGreaterThanOrEqual(bySection.Priority - 1);
  });
});
