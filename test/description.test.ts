import { expect, test } from '@playwright/test';
import {
  clearance,
  controlBoxes,
  drag,
  panelBox,
  selectAllText,
  userSelect,
  waitForInput,
  type Box,
} from './support/description.ts';
import { openPhoto } from './support/viewer.ts';

test.describe('description', () => {
  test('drags by its edge to anywhere clear of the other controls', async ({
    page,
  }) => {
    const text = /Explore the universe/;
    await page.goto('/');
    await expect(page.getByText(text)).toBeVisible();
    const viewport = page.viewportSize()!;
    const controls = await controlBoxes(page);
    const start = await panelBox(page, text);
    const isWide = viewport.width > 2 * (start.right - start.left);

    /** keeps a 10 pixel gap to the page's edges and the controls, or at least no less than it started with */
    const expectClear = (panel: Box) => {
      expect(panel.left).toBeGreaterThanOrEqual(9);
      expect(panel.top).toBeGreaterThanOrEqual(9);
      expect(panel.right).toBeLessThanOrEqual(viewport.width - 9);
      expect(panel.bottom).toBeLessThanOrEqual(viewport.height - 9);
      controls.forEach((control) =>
        expect(clearance(panel, control)).toBeGreaterThanOrEqual(
          Math.min(10, clearance(start, control)) - 1
        )
      );
    };

    await test.step('up and left: stops at the header and the timeline', async () => {
      await drag(
        page,
        { x: start.right - 6, y: start.top + 6 },
        { x: -3000, y: -3000 }
      );
      const moved = await panelBox(page, text);
      expect(moved.top).toBeLessThan(start.top - 20);
      if (isWide) expect(moved.left).toBeLessThan(start.left - 100);
      expectClear(moved);
    });

    await test.step('down and right: stops at the page edge and the info button', async () => {
      const from = await panelBox(page, text);
      await drag(
        page,
        { x: from.right - 6, y: from.top + 6 },
        { x: 3000, y: 3000 }
      );
      const moved = await panelBox(page, text);
      // a phone's panel fills nearly all the height between the header and the toolbars
      expect(moved.bottom).toBeGreaterThanOrEqual(from.bottom);
      if (isWide) {
        expect(moved.bottom).toBeGreaterThan(from.bottom + 20);
        expect(moved.right).toBeGreaterThan(from.right + 100);
      }
      expectClear(moved);
    });

    await test.step('the text inside selects instead of dragging', async () => {
      const from = await panelBox(page, text);
      const words = (await page.getByText(text).boundingBox())!;
      await drag(
        page,
        { x: words.x + 4, y: words.y + 8 },
        { x: words.width / 2, y: 0 }
      );
      expect(await panelBox(page, text)).toEqual(from);
      expect(
        await page.evaluate(() => getSelection()?.toString().length)
      ).toBeGreaterThan(5);
    });
  });

  test('keeps icons and the photo from being selected, but not text', async ({
    page,
  }) => {
    await openPhoto(page, 'stellar-jet');
    await page.getByTitle('More Info').click();
    await expect(page.getByText(/symmetric protostellar jet/)).toBeVisible();

    for (const icon of [
      page.locator('main picture').locator('..'),
      page.getByTitle('Back to home'),
      page.locator('#timeline header img'),
      page.locator('#timeline i').first(),
      page.getByTitle('More Info'),
    ]) {
      expect(await userSelect(icon)).toBe('none');
    }

    // selecting everything picks up the words, without the arrow or the timeline dots
    const selected = await selectAllText(page);
    expect(selected).toContain('Stellar Jet in Sh2-284');
    expect(selected).toContain('symmetric protostellar jet');
    expect(selected).not.toContain('←');
    expect(selected).not.toContain('●');
  });

  test('scrolls its text with the arrow keys once clicked, instead of panning the view', async ({
    page,
  }) => {
    // short enough that the text scrolls
    await page.setViewportSize({ width: 640, height: 420 });
    await page.goto('/');
    const words = page.getByText(/Explore the universe/);
    await expect(words).toBeVisible();
    const { x, y } = (await words.boundingBox())!;
    await waitForInput(page, { x: x + 4, y: y + 8 });
    await page.mouse.click(x + 4, y + 8);

    await page.keyboard.press('ArrowDown');
    await expect
      .poll(() => words.locator('..').evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
  });
});
