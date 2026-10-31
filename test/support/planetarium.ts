import { expect, type Page } from '@playwright/test';
import sharp from 'sharp';

/** the planetarium viewer, which draws the sky on a canvas */
export const sky = (page: Page) => page.locator('[role="img"]:has(canvas)');

/** the flat photo viewer's image */
export const flatPhoto = (page: Page) => page.locator('main picture img');

/**
 * A screenshot of the sky, including any panels over it, at one pixel per css pixel.
 *
 * The measurements all work in css pixels, and a device pixel screenshot takes about four times longer on a 2x screen.
 */
export const skyShot = (page: Page) => sky(page).screenshot({ scale: 'css' });

/** a screenshot of the middle quarter of the sky, clear of the panels at its edges, at one pixel per css pixel */
export const skyMiddleShot = async (page: Page) => {
  const box = (await sky(page).boundingBox())!;
  return page.screenshot({
    scale: 'css',
    clip: {
      x: box.x + box.width / 4,
      y: box.y + box.height / 4,
      width: box.width / 2,
      height: box.height / 2,
    },
  });
};

/**
 * Measures a sky screenshot.
 *
 * @returns `brightness` as the mean channel value from 0 to 255, and `blackShare` as the fraction of pixels that are nearly black.
 */
export const skyStats = async (shot: Buffer) => {
  const { data } = await sharp(shot)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let total = 0;
  let black = 0;
  for (let i = 0; i < data.length; i += 3) {
    const sum = data[i] + data[i + 1] + data[i + 2];
    total += sum;
    if (sum < 30) black += 1;
  }
  const pixels = data.length / 3;
  return { brightness: total / data.length, blackShare: black / pixels };
};

type Point = { x: number; y: number };

/** a grayscale screenshot at one pixel per css pixel */
const toGray = async (shot: Buffer, cssWidth: number) => {
  const { data, info } = await sharp(shot)
    .removeAlpha()
    .resize({ width: Math.round(cssWidth) })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};

/**
 * Finds where a patch of sky moved between two screenshots, by the smallest pixel difference.
 *
 * @param from - Patch center in the first screenshot, css pixels from the sky's top left.
 * @param guess - Where the patch should be in the second screenshot.
 * @returns The best matching patch center in the second screenshot.
 */
export const findPatch = async (
  page: Page,
  before: Buffer,
  after: Buffer,
  from: Point,
  guess: Point,
  { size = 64, search = 30 } = {}
) => {
  const { width: cssWidth } = (await sky(page).boundingBox())!;
  const [first, second] = await Promise.all(
    [before, after].map((shot) => toGray(shot, cssWidth))
  );
  const half = size / 2;
  const at = (image: typeof first, x: number, y: number) =>
    image.data[Math.round(y) * image.width + Math.round(x)];

  let best = { x: guess.x, y: guess.y, difference: Infinity };
  for (let dy = -search; dy <= search; dy += 1) {
    for (let dx = -search; dx <= search; dx += 1) {
      const x = guess.x + dx;
      const y = guess.y + dy;
      let difference = 0;
      for (let py = -half; py < half; py += 2) {
        for (let px = -half; px < half; px += 2) {
          difference += Math.abs(
            at(first, from.x + px, from.y + py) - at(second, x + px, y + py)
          );
        }
      }
      if (difference < best.difference) best = { x, y, difference };
    }
  }
  return { x: best.x, y: best.y };
};

/**
 * Checks that a patch of sky followed the pointer.
 *
 * Perspective stretches a patch dragged off center, so the match may land a little off.
 *
 * @returns How far the patch landed from the pointer, as a fraction of the drag.
 */
export const missedBy = (from: Point, to: Point, found: Point) =>
  Math.hypot(found.x - to.x, found.y - to.y) /
  Math.hypot(to.x - from.x, to.y - from.y);

/** mean channel difference between two screenshots of the same size, from 0 to 255 */
export const shotDifference = async (a: Buffer, b: Buffer) => {
  const [first, second] = await Promise.all(
    [a, b].map((shot) => sharp(shot).removeAlpha().raw().toBuffer())
  );
  let total = 0;
  for (let i = 0; i < first.length; i += 1) {
    total += Math.abs(first[i] - second[i]);
  }
  return total / first.length;
};

/** hides the home page panels, so a test can reach and see the sky anywhere */
export const hidePanels = (page: Page) =>
  page.addStyleTag({
    content: '[role="img"] ~ div:not([role]) { display: none !important; }',
  });

/**
 * Hovers a point of the sky and reads the cursor, which is `move` over the Earth.
 *
 * @param point - Fractions of the sky's width and height from its top left.
 */
export const cursorAt = async (page: Page, point: Point) => {
  const box = (await sky(page).boundingBox())!;
  await page.mouse.move(
    box.x + box.width * point.x,
    box.y + box.height * point.y
  );
  return sky(page).evaluate((element: HTMLElement) => element.style.cursor);
};

/**
 * Finds the top of the Earth in the middle column, by hovering down from the top.
 *
 * @returns The fraction of the sky's height where the Earth's top edge is, 1 when the column misses it.
 */
export const earthTop = async (page: Page) => {
  for (let y = 0.02; y < 1; y += 0.02) {
    if ((await cursorAt(page, { x: 0.5, y })) === 'move') return y;
  }
  return 1;
};

/** narrows down where the cursor stops offering to move the Earth, between a point on it and one off it */
const findEarthEdge = async (page: Page, on: Point, off: Point) => {
  for (let step = 0; step < 12; step += 1) {
    const middle = { x: (on.x + off.x) / 2, y: (on.y + off.y) / 2 };
    if ((await cursorAt(page, middle)) === 'move') on = middle;
    else off = middle;
  }
  return on;
};

/**
 * Finds the disk where the cursor offers to move the Earth, which must be whole on screen.
 *
 * @param on - A point on the Earth, in fractions of the sky's width and height.
 * @returns Its center and radius in css pixels.
 */
export const earthDisk = async (page: Page, on: Point) => {
  const { width, height } = (await sky(page).boundingBox())!;
  const left = await findEarthEdge(page, on, { x: 0, y: on.y });
  const right = await findEarthEdge(page, on, { x: 1, y: on.y });
  const x = (left.x + right.x) / 2;
  const top = await findEarthEdge(page, { x, y: on.y }, { x, y: 0 });
  const bottom = await findEarthEdge(page, { x, y: on.y }, { x, y: 1 });
  return {
    x: x * width,
    y: ((top.y + bottom.y) / 2) * height,
    radius: ((bottom.y - top.y) / 2) * height,
  };
};

/**
 * Measures how far the atmosphere's blue rim reaches from the Earth's center, every 5 degrees around.
 *
 * @returns Css pixels from the center to the rim's outer edge, by angle clockwise from the right.
 */
export const earthRim = async (
  page: Page,
  disk: { x: number; y: number; radius: number }
) => {
  const { width: cssWidth } = (await sky(page).boundingBox())!;
  const { data, info } = await sharp(await skyShot(page))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const scale = info.width / cssWidth;

  return Array.from({ length: 72 }, (_, i) => {
    const angle = (i * 5 * Math.PI) / 180;
    let reach = 0;
    for (let t = disk.radius / 2; t < disk.radius * 1.6; t += 1 / scale) {
      const x = Math.round((disk.x + Math.cos(angle) * t) * scale);
      const y = Math.round((disk.y + Math.sin(angle) * t) * scale);
      if (x < 0 || y < 0 || x >= info.width || y >= info.height) break;
      const index = (y * info.width + x) * 3;
      // the glow is far bluer than the stars and the milky way
      if (data[index + 2] >= 160 && data[index + 2] - data[index] >= 80) {
        reach = t;
      }
    }
    return reach;
  });
};

/** css pixel point of the sky from fractions of its width and height */
export const skyPoint = async (page: Page, point: Point) => {
  const { width, height } = (await sky(page).boundingBox())!;
  return { x: width * point.x, y: height * point.y };
};

/** mean brightness step between neighboring pixels, which falls as the view zooms in on a smooth image */
export const fineDetail = async (page: Page, shot: Buffer) => {
  const { width: cssWidth } = (await sky(page).boundingBox())!;
  const { data, width } = await toGray(shot, cssWidth);
  let total = 0;
  for (let i = 1; i < data.length; i += 1) {
    if (i % width) total += Math.abs(data[i] - data[i - 1]);
  }
  return total / data.length;
};

/**
 * Finds a short drag where the sky itself shows at both ends, not a panel or the earth.
 *
 * Spots off center to the side drag sideways and spots above or below drag up and down,
 * so the sky slides under the pointer instead of turning around it.
 *
 * @param size - Css pixels of clear sky needed around each end.
 * @param distance - Css pixels to drag.
 * @returns The drag ends in css pixels from the sky's top left, nearest the middle first, where perspective stretches the sky least.
 */
export const openSkyDrag = (page: Page, { size = 48, distance = 80 } = {}) =>
  page.evaluate(
    ({ size, distance }) => {
      const skyElement = document.querySelector('[role="img"]:has(canvas)')!;
      const box = skyElement.getBoundingClientRect();
      const others = [...document.querySelectorAll('canvas')]
        .filter((canvas) => !skyElement.contains(canvas))
        .map((canvas) => canvas.getBoundingClientRect());

      const isClear = (x: number, y: number) =>
        [-1, 0, 1].every((sx) =>
          [-1, 0, 1].every((sy) => {
            const px = box.left + x + (sx * size) / 2;
            const py = box.top + y + (sy * size) / 2;
            const isInside =
              px > box.left &&
              px < box.right &&
              py > box.top &&
              py < box.bottom;
            const isCovered = others.some(
              (rect) =>
                px >= rect.left &&
                px <= rect.right &&
                py >= rect.top &&
                py <= rect.bottom
            );
            return (
              isInside &&
              !isCovered &&
              skyElement.contains(document.elementFromPoint(px, py))
            );
          })
        );

      const spots: [number, number][] = [];
      for (let fy = 0.05; fy < 1; fy += 0.05) {
        for (let fx = 0.05; fx < 1; fx += 0.05) spots.push([fx, fy]);
      }
      spots.sort(
        ([ax, ay], [bx, by]) =>
          Math.hypot(ax - 0.5, ay - 0.5) - Math.hypot(bx - 0.5, by - 0.5)
      );

      for (const [fx, fy] of spots) {
        const from = { x: box.width * fx, y: box.height * fy };
        const isSideways = Math.abs(fx - 0.5) >= Math.abs(fy - 0.5);
        for (const step of [distance, -distance]) {
          const to = isSideways
            ? { x: from.x + step, y: from.y }
            : { x: from.x, y: from.y + step };
          if (isClear(from.x, from.y) && isClear(to.x, to.y)) {
            return { from, to };
          }
        }
      }
      throw new Error('no open sky to drag');
    },
    { size, distance }
  );

/**
 * Opens a page and waits until its sky is finished: every layer's full size image, which replaces a small preview,
 * has loaded and faded in.
 */
export const openSky = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(sky(page)).toHaveAttribute('aria-busy', 'false', {
    timeout: 20_000,
  });
};

/**
 * Stops the page clock, so the sky only drifts and renders when a test moves time forward.
 *
 * Installing the clock restarts `performance.now()` near zero, which is safe once `openSky` has seen every fade finish.
 * A clock left running would fire frames faster than a slow renderer can draw them.
 */
export const freezeTime = async (page: Page) => {
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1_000);
  await page.clock.runFor(50);
};

/**
 * Drags the sky with the mouse and holds still before letting go, so it does not keep turning.
 *
 * Needs a fake clock from `freezeTime` or `page.clock.install`.
 *
 * @param from - Css pixels from the sky's top left.
 * @param to - Css pixels from the sky's top left.
 */
export const dragSky = async (page: Page, from: Point, to: Point) => {
  const box = (await sky(page).boundingBox())!;
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  await page.mouse.move(box.x + to.x, box.y + to.y, { steps: 12 });
  await page.clock.runFor(150);
  await page.mouse.up();
  await page.clock.runFor(50);
};

/**
 * Flicks the sky with the mouse and lets go while still moving, at about 0.25 css pixels per millisecond.
 *
 * Needs a fake clock from `freezeTime`.
 */
export const flickSky = async (page: Page, from: Point, to: Point) => {
  const box = (await sky(page).boundingBox())!;
  await page.mouse.move(box.x + from.x, box.y + from.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    const x = from.x + ((to.x - from.x) * step) / 10;
    const y = from.y + ((to.y - from.y) * step) / 10;
    await page.mouse.move(box.x + x, box.y + y);
    await page.clock.runFor(16);
  }
  await page.mouse.up();
};

/** the middle of the sky in css pixels from its top left */
export const skyCenter = async (page: Page) => {
  const { width, height } = (await sky(page).boundingBox())!;
  return { x: width / 2, y: height / 2 };
};

/** holds an arrow key on the focused sky long enough to turn as far as it goes */
export const lookAllTheWay = async (
  page: Page,
  key: 'ArrowUp' | 'ArrowDown'
) => {
  await sky(page).focus();
  for (let press = 0; press < 25; press += 1) {
    await page.keyboard.press(key);
  }
  await page.waitForTimeout(1_000);
};

/** makes the browser report that WebGL is unavailable, like an old device or a blocked GPU */
export const disableWebGL = (page: Page) =>
  page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type.startsWith('webgl')) return null;
      return (getContext as Function).call(this, type, ...rest);
    } as typeof getContext;
  });
