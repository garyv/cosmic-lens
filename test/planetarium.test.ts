import { expect, test } from '@playwright/test';
import {
  disableWebGL,
  dragSky,
  flickSky,
  findPatch,
  fineDetail,
  missedBy,
  flatPhoto,
  freezeTime,
  cursorAt,
  earthDisk,
  earthRim,
  earthTop,
  hidePanels,
  shotDifference,
  skyPoint,
  lookAllTheWay,
  openSky,
  openSkyDrag,
  sky,
  skyCenter,
  skyMiddleShot,
  skyShot,
  skyStats,
} from './support/planetarium.ts';
import { openPhoto, wakeControls, zoomButton } from './support/viewer.ts';
import { previewPhoto, timelineDots } from './support/timeline.ts';

const cosmicBackground = 'Cosmic Microwave Background All-Sky Map';
const stellarJet = 'Stellar Jet in Sh2-284';

test.describe('planetarium', () => {
  test('wraps the cosmic background around the viewer', async ({ page }) => {
    await test.step('open: the sky canvas draws the map, NOT the flat image', async () => {
      await openSky(page, '/cosmic-background');
      await expect(flatPhoto(page)).toHaveCount(0);
      const { brightness, blackShare } = await skyStats(await skyShot(page));
      expect(brightness).toBeGreaterThan(40);
      expect(blackShare).toBeLessThan(0.01);
    });

    await test.step('idle: the map holds still', async () => {
      const before = await skyMiddleShot(page);
      await page.waitForTimeout(1_500);
      expect(
        await shotDifference(before, await skyMiddleShot(page))
      ).toBeLessThan(0.5);
    });

    await test.step('drag: the sky under the pointer follows it', async () => {
      await freezeTime(page);
      const from = await skyCenter(page);
      const to = { x: from.x + 120, y: from.y };
      const before = await skyShot(page);
      await dragSky(page, from, to);
      const found = await findPatch(
        page,
        before,
        await skyShot(page),
        from,
        to
      );
      expect(missedBy(from, to, found)).toBeLessThan(0.2);
    });

    await test.step('flick: the sky keeps turning after release', async () => {
      const center = await skyCenter(page);
      const from = { x: center.x * 0.6, y: center.y };
      const to = { x: from.x + 40, y: from.y };
      await flickSky(page, from, to);
      const released = await skyShot(page);
      await page.clock.runFor(1_500);
      const found = await findPatch(
        page,
        released,
        await skyShot(page),
        to,
        { x: to.x + 60, y: to.y },
        { search: 60 }
      );
      expect(found.x - to.x).toBeGreaterThan(20);
    });

    await test.step('zoom in button: features grow', async () => {
      const before = await fineDetail(page, await skyShot(page));
      await wakeControls(page);
      await zoomButton(page, 'in').click();
      await page.clock.runFor(1_000);
      const after = await fineDetail(page, await skyShot(page));
      expect(after).toBeLessThan(before * 0.85);
    });
  });

  test('pans and zooms with the keyboard, without clicking the sky first', async ({
    page,
  }) => {
    await openSky(page, '/cosmic-background');
    await freezeTime(page);
    const center = await skyCenter(page);

    await test.step('right arrow: the view turns right, so the sky moves left', async () => {
      const before = await skyShot(page);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.clock.runFor(500);
      const found = await findPatch(
        page,
        before,
        await skyShot(page),
        center,
        { x: center.x - 130, y: center.y },
        { size: 48, search: 110 }
      );
      expect(found.x).toBeLessThan(center.x - 40);
      expect(Math.abs(found.y - center.y)).toBeLessThan(5);
    });

    await test.step('= and +: zoom in, -: zooms back out', async () => {
      const start = await fineDetail(page, await skyShot(page));
      await page.keyboard.press('=');
      await page.clock.runFor(1_000);
      const zoomedIn = await fineDetail(page, await skyShot(page));
      expect(zoomedIn).toBeLessThan(start * 0.85);

      await page.keyboard.press('+');
      await page.clock.runFor(1_000);
      expect(await fineDetail(page, await skyShot(page))).toBeLessThan(
        zoomedIn * 0.85
      );

      await page.keyboard.press('-');
      await page.keyboard.press('-');
      await page.clock.runFor(1_000);
      const zoomedOut = await fineDetail(page, await skyShot(page));
      expect(Math.abs(zoomedOut / start - 1)).toBeLessThan(0.1);
    });

    await test.step('cmd or ctrl with =: left to the browser', async () => {
      const before = await skyMiddleShot(page);
      await page.keyboard.press('ControlOrMeta+Equal');
      await page.clock.runFor(1_000);
      expect(await shotDifference(before, await skyMiddleShot(page))).toBe(0);
    });
  });

  test('fills the poles, looking straight up and straight down', async ({
    page,
  }) => {
    await openSky(page, '/cosmic-background');
    const brightness: number[] = [];

    for (const key of ['ArrowUp', 'ArrowDown'] as const) {
      await test.step(`${key}: no gaps in the sky`, async () => {
        await lookAllTheWay(page, key);
        const stats = await skyStats(await skyShot(page));
        expect(stats.blackShare).toBeLessThan(0.01);
        brightness.push(stats.brightness);
      });
    }

    await test.step('below: as bright as above, with no dark lower half', async () => {
      const [up, down] = brightness;
      expect(down).toBeGreaterThan(up * 0.75);
    });
  });

  test('keeps the timeline, description and gaze mode on a planetarium page', async ({
    page,
  }) => {
    await openSky(page, '/cosmic-background');

    await test.step('header and timeline: show as on flat photos', async () => {
      // loading can outlast the 3 seconds before gaze mode hides them
      await wakeControls(page);
      await expect(
        page.getByRole('heading', { name: cosmicBackground })
      ).toBeVisible();
      await expect(timelineDots(page)).toHaveCount(9);
    });

    await test.step('info: description opens and closes', async () => {
      const description = page.getByText(/standing inside the oldest/);
      await wakeControls(page);
      await page.getByTitle('More Info').click();
      await expect(description).toBeVisible();
      await page.getByTitle('More Info').click();
      await expect(description).toBeHidden();
    });

    await test.step('idle after dragging the sky: controls hide after 3 seconds', async () => {
      await page.clock.install();
      const from = await skyCenter(page);
      await dragSky(page, from, { x: from.x + 40, y: from.y });
      await expect(zoomButton(page, 'in')).toBeVisible();
      await page.clock.fastForward(3_100);
      await expect(zoomButton(page, 'in')).toBeHidden();
    });
  });

  test('circles the Earth on the home page', async ({ page }) => {
    await openSky(page, '/');

    await test.step('info: the description shows on arrival and hides', async () => {
      const description = page.getByText(/Explore the universe/);
      await expect(description).toBeVisible();
      await page.getByTitle('More Info').click();
      await expect(description).toBeHidden();
      await page.getByTitle('More Info').click();
      await expect(description).toBeVisible();
    });

    await test.step('empty space: a drag between the panels turns the sky', async () => {
      await freezeTime(page);
      // a short drag, since the only open sky on a phone is far off center
      const { from, to } = await openSkyDrag(page, { size: 32, distance: 40 });
      const before = await skyShot(page);
      await dragSky(page, from, to);
      expect(await shotDifference(before, await skyShot(page))).toBeGreaterThan(
        1
      );
    });

    await test.step('timeline: previews a photo over the sky', async () => {
      await expect(await previewPhoto(page, stellarJet)).toBeVisible();
    });

    await hidePanels(page);

    // the earth's top starts 30% of the view above the bottom edge
    const onEarth = { x: 0.5, y: 0.76 };

    await test.step('start: the earth rises from the bottom middle', async () => {
      expect(await earthTop(page)).toBeCloseTo(0.7, 1);
      expect(await cursorAt(page, onEarth)).toBe('move');
    });

    await test.step('drag the stars: the camera circles the earth, which stays while the stars sweep the other way', async () => {
      const from = await skyPoint(page, { x: 0.6, y: 0.25 });
      const to = { x: from.x - 40, y: from.y };
      const before = await skyShot(page);
      await dragSky(page, from, to);
      const found = await findPatch(
        page,
        before,
        await skyShot(page),
        from,
        { x: from.x + 60, y: from.y },
        { size: 32, search: 50 }
      );
      expect(found.x - from.x).toBeGreaterThan(20);
      expect(await cursorAt(page, onEarth)).toBe('move');
    });

    await test.step('drag the earth: it moves up the screen', async () => {
      const top = await earthTop(page);
      await dragSky(
        page,
        await skyPoint(page, onEarth),
        await skyPoint(page, { x: onEarth.x, y: onEarth.y - 0.37 })
      );
      expect(await earthTop(page)).toBeLessThan(top - 0.15);
    });

    await test.step('zoom in button: the earth grows around its place', async () => {
      const top = await earthTop(page);
      await zoomButton(page, 'in').click();
      await page.clock.runFor(1_000);
      expect(await earthTop(page)).toBeLessThan(top - 0.05);
    });

    await test.step('idle after a click: the view goes back to circling the earth on its own', async () => {
      const from = await skyPoint(page, { x: 0.8, y: 0.2 });
      await dragSky(page, from, from);
      const before = await skyShot(page);
      await page.clock.runFor(3_000);
      const found = await findPatch(
        page,
        before,
        await skyShot(page),
        from,
        from,
        { size: 32, search: 50 }
      );
      expect(Math.hypot(found.x - from.x, found.y - from.y)).toBeGreaterThan(5);
    });

    await test.step('drag the earth toward a corner: it stays round', async () => {
      await zoomButton(page, 'out').click();
      await page.clock.runFor(1_000);
      const grab = { x: 0.5, y: (await earthTop(page)) + 0.03 };
      const drop = { x: 0.75, y: grab.y - 0.25 };
      await dragSky(
        page,
        await skyPoint(page, grab),
        await skyPoint(page, drop)
      );

      const disk = await earthDisk(page, drop);
      const rim = await earthRim(page, disk);
      // the rim of each eighth of the way around, where a star or two may cross it
      for (let eighth = 0; eighth < 8; eighth += 1) {
        const reaches = rim
          .slice(eighth * 9, eighth * 9 + 9)
          .sort((a, b) => a - b);
        expect(reaches[4] / disk.radius).toBeGreaterThan(0.95);
        expect(reaches[4] / disk.radius).toBeLessThan(1.08);
      }
    });
  });

  test('does NOT load three.js on flat photo pages', async ({ page }) => {
    await openPhoto(page, 'stellar-jet');
    // three.js marks the window with its version when it loads
    expect(await page.evaluate(() => '__THREE__' in window)).toBe(false);
  });

  test.describe('without WebGL', () => {
    test.beforeEach(({ page }) => disableWebGL(page));

    test('shows the flat viewer and a plain home page instead', async ({
      page,
    }) => {
      await test.step('cosmic background: the flat image shows', async () => {
        await page.goto('/cosmic-background');
        await expect(flatPhoto(page)).toBeVisible();
        await expect(sky(page)).toHaveCount(0);
      });

      await test.step('home: the panels work over a black page', async () => {
        await page.goto('/');
        await expect(sky(page)).toHaveCount(0);
        await expect(
          page.getByRole('heading', { name: 'Cosmic Lens' })
        ).toBeVisible();
        await expect(timelineDots(page)).toHaveCount(9);
        await expect(zoomButton(page, 'in')).toHaveCount(0);
      });
    });
  });
});
