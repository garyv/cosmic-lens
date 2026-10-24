import { expect, test } from '@playwright/test';
import {
  centerPoint,
  coversViewport,
  imageState,
  openPhoto,
  imagePixels,
  isAtCover,
  recordImageBoxes,
  settle,
  touchPhoto,
  wakeControls,
  zoomButton,
  zoomIn,
  zoomOut,
} from './support/viewer.ts';
import { slowImages } from './support/network.ts';
import { previewPhoto, timelineDots } from './support/timeline.ts';

const stellarJet = 'Stellar Jet in Sh2-284';
const cosmicCliffs = '“Cosmic Cliffs” in the Carina Nebula';

test.describe('viewer', () => {
  test('opens a photo from the timeline and explores it', async ({ page }) => {
    await test.step('home: timeline lists every photo and earth', async () => {
      await page.goto('/');
      await expect(timelineDots(page)).toHaveCount(9);
    });

    const caption =
      await test.step('timeline: hovering dots finds the stellar-jet preview', () =>
        previewPhoto(page, stellarJet));

    await test.step('preview: clicking the caption opens /stellar-jet', async () => {
      await caption.click();
      await expect(page).toHaveURL('/stellar-jet');
      await expect(page).toHaveTitle(`${stellarJet} - Cosmic Lens`);
    });

    const cover =
      await test.step('photo: image loads and covers the viewport', async () => {
        await expect(
          page.getByRole('heading', { name: stellarJet })
        ).toBeVisible();
        await settle(page);
        expect(await coversViewport(page)).toBe(true);
        return imageState(page);
      });

    await test.step('idle: controls hide after 3 seconds in gaze mode', async () => {
      await page.clock.install();
      await wakeControls(page);
      await expect(zoomButton(page, 'in')).toBeVisible();
      await page.clock.fastForward(3_100);
      await expect(zoomButton(page, 'in')).toBeHidden();
      await page.clock.resume();
    });

    await test.step('zoom in: image grows around the viewport center', async () => {
      const center = await centerPoint(page);
      await zoomIn(page);
      const { box } = await imageState(page);
      expect(box.width).toBeGreaterThan(cover.box.width * 1.5);
      const after = await centerPoint(page);
      expect(after.x).toBeCloseTo(center.x, 2);
      expect(after.y).toBeCloseTo(center.y, 2);
    });

    await test.step('zoom out: image returns to cover scale', async () => {
      await zoomOut(page);
      const { box } = await imageState(page);
      expect(box.width).toBeCloseTo(cover.box.width, 0);
      expect(await coversViewport(page)).toBe(true);
    });

    await test.step('= key: zooms in around the viewport center', async () => {
      const center = await centerPoint(page);
      await page.keyboard.press('=');
      await settle(page);
      const { box } = await imageState(page);
      expect(box.width).toBeGreaterThan(cover.box.width * 1.5);
      const after = await centerPoint(page);
      expect(after.x).toBeCloseTo(center.x, 2);
      expect(after.y).toBeCloseTo(center.y, 2);
    });

    await test.step('arrow keys: show more of the side they point to', async () => {
      const before = await centerPoint(page);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowDown');
      await settle(page);
      const after = await centerPoint(page);
      expect(after.x).toBeGreaterThan(before.x + 0.01);
      expect(after.y).toBeGreaterThan(before.y + 0.01);
    });

    await test.step('- key: zooms back out to cover scale', async () => {
      await page.keyboard.press('-');
      await settle(page);
      expect(await isAtCover(page)).toBe(true);
      expect(await coversViewport(page)).toBe(true);
    });

    await test.step('info: description opens and closes', async () => {
      const description = page.getByText(/symmetric protostellar jet/);
      await wakeControls(page);
      await page.getByTitle('More Info').click();
      await expect(description).toBeVisible();
      await page.getByTitle('More Info').click();
      await expect(description).toBeHidden();
    });

    await test.step('back link: returns home', async () => {
      await wakeControls(page);
      await page.getByTitle('Back to home').click();
      await expect(page).toHaveURL('/');
      await expect(timelineDots(page)).toHaveCount(9);
    });
  });

  test('clicking the photo takes focus off the toolbar', async ({ page }) => {
    await openPhoto(page, 'stellar-jet');
    await zoomIn(page);
    await page.clock.install();

    await test.step('toolbar focused: controls stay visible', async () => {
      await expect(zoomButton(page, 'in')).toBeFocused();
      await page.clock.fastForward(3_100);
      await expect(zoomButton(page, 'in')).toBeVisible();
    });

    await test.step('photo clicked: focus leaves and controls hide', async () => {
      await touchPhoto(page);
      await expect(zoomButton(page, 'in')).not.toBeFocused();
      await page.clock.fastForward(3_100);
      await expect(zoomButton(page, 'in')).toBeHidden();
    });
  });

  test('keeps the image centered through three zoom ins on stellar-jet', async ({
    page,
  }) => {
    await openPhoto(page, 'stellar-jet');

    for (const click of [1, 2, 3]) {
      await test.step(`zoom in ${click}: center point and cover hold`, async () => {
        const center = await centerPoint(page);
        await zoomIn(page);
        const after = await centerPoint(page);
        expect(after.x).toBeCloseTo(center.x, 2);
        expect(after.y).toBeCloseTo(center.y, 2);
        expect(await coversViewport(page)).toBe(true);
      });
    }
  });

  test('does NOT shift the photo while a slow image loads', async ({
    page,
  }) => {
    await slowImages(page, { delay: 1500 });
    const viewport = page.viewportSize()!;
    const coversEveryFrame = (boxes: Box[]) =>
      boxes.forEach((box) => {
        expect(box.x).toBeLessThanOrEqual(0.5);
        expect(box.y).toBeLessThanOrEqual(0.5);
        expect(box.x + box.width).toBeGreaterThanOrEqual(viewport.width - 0.5);
        expect(box.y + box.height).toBeGreaterThanOrEqual(
          viewport.height - 0.5
        );
      });

    await test.step('fresh load: photo covers the viewport from the first frame', async () => {
      await page.goto('/stellar-jet');
      const stopRecording = await recordImageBoxes(page);
      await settle(page);
      coversEveryFrame(await stopRecording());
    });

    for (const click of [1, 2, 3]) {
      await test.step(`zoom in ${click}: image only grows and keeps covering`, async () => {
        const stopRecording = await recordImageBoxes(page);
        await zoomIn(page);
        const boxes = await stopRecording();

        coversEveryFrame(boxes);
        boxes.forEach((box, frame) => {
          expect(box.width).toBeGreaterThanOrEqual(
            boxes[Math.max(0, frame - 1)].width
          );
        });
      });
    }
  });

  test('loads the sharpest file each zoom level needs', async ({ page }) => {
    await openPhoto(page, 'cosmic-cliffs');

    for (const click of [1, 2, 3]) {
      await test.step(`zoom in ${click}: file covers the screen pixels or is the largest offered`, async () => {
        await zoomIn(page);
        const { fileWidth, neededWidth, largestOffered } =
          await imagePixels(page);
        expect(fileWidth).toBeGreaterThanOrEqual(
          Math.min(neededWidth, largestOffered) * 0.95
        );
      });
    }
  });

  test('starts each photo at cover zoom after leaving a zoomed photo', async ({
    page,
  }) => {
    const fresh =
      await test.step('cosmic-cliffs opened directly: cover zoom', async () => {
        await openPhoto(page, 'cosmic-cliffs');
        return imageState(page);
      });

    await test.step('stellar-jet: zoom in twice', async () => {
      await openPhoto(page, 'stellar-jet');
      await zoomIn(page);
      await zoomIn(page);
    });

    await test.step('timeline: cosmic-cliffs opens at cover zoom with the same file', async () => {
      await wakeControls(page);
      await (await previewPhoto(page, cosmicCliffs)).click();
      await expect(page).toHaveURL('/cosmic-cliffs');
      await settle(page);
      const state = await imageState(page);
      expect(state.box.width).toBeCloseTo(fresh.box.width, 0);
      expect(state.box.y).toBeCloseTo(fresh.box.y, 0);
      expect(state.currentSrc).toBe(fresh.currentSrc);
      expect(await coversViewport(page)).toBe(true);
    });
  });

  test('keeps the photo covering the viewport through resizes', async ({
    page,
  }) => {
    await openPhoto(page, 'cosmic-cliffs');
    const { width, height } = page.viewportSize()!;

    await test.step('rotate at cover: photo stays at cover zoom', async () => {
      await page.setViewportSize({ width: height, height: width });
      await settle(page);
      expect(await coversViewport(page)).toBe(true);
      expect(await isAtCover(page)).toBe(true);
    });

    await test.step('rotate back: photo returns to cover zoom', async () => {
      await page.setViewportSize({ width, height });
      await settle(page);
      expect(await coversViewport(page)).toBe(true);
      expect(await isAtCover(page)).toBe(true);
    });

    await test.step('zoom in then shrink: zoomed photo still covers', async () => {
      await zoomIn(page);
      await page.setViewportSize({ width, height: Math.round(height * 0.7) });
      await settle(page);
      expect(await coversViewport(page)).toBe(true);
      expect(await isAtCover(page)).toBe(false);
    });
  });
});

type Box = { x: number; y: number; width: number; height: number };
