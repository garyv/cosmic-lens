import type { Page } from '@playwright/test';

/** the photo being viewed, not timeline previews */
export const photoImage = (page: Page) => page.locator('main picture img');

export const zoomButton = (page: Page, direction: 'in' | 'out') =>
  page.getByTitle(direction === 'in' ? 'Zoom in' : 'Zoom out');

/** opens a photo page and waits until the image is loaded and still */
export const openPhoto = async (page: Page, photoId: string) => {
  await page.goto(`/${photoId}`);
  await settle(page);
};

export const zoomIn = async (page: Page) => {
  await wakeControls(page);
  await zoomButton(page, 'in').click();
  await settle(page);
};

export const zoomOut = async (page: Page) => {
  await wakeControls(page);
  await zoomButton(page, 'out').click();
  await settle(page);
};

/** taps the middle of the photo, with raw mouse input so it works while page.clock holds animation frames */
export const touchPhoto = async (page: Page) => {
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
};

let wakeOffset = 0;

/** moves the mouse so gaze mode shows the controls again */
export const wakeControls = async (page: Page) => {
  wakeOffset = wakeOffset === 0 ? 1 : 0;
  await page.mouse.move(5 + wakeOffset, 300);
};

/**
 * Waits until the photo image is fully loaded and its box has stopped changing.
 *
 * Zoom animates for 300 ms, a 150 ms debounce then changes the srcset, and a new file may load after that.
 */
export const settle = async (
  page: Page,
  { quiet = 600, timeout = 15_000 } = {}
) => {
  const start = Date.now();
  let last = '';
  let stableSince = Date.now();

  while (Date.now() - start < timeout) {
    const state = await imageState(page);
    const key = JSON.stringify(state);
    if (key !== last || !state.loaded) {
      last = key;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= quiet) {
      return;
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`photo image did NOT settle within ${timeout} ms`);
};

export type ImageState = {
  loaded: boolean;
  currentSrc: string;
  layout: { width: number; height: number };
  box: { x: number; y: number; width: number; height: number };
};

export const imageState = (page: Page): Promise<ImageState> =>
  photoImage(page).evaluate((img: HTMLImageElement) => {
    const { x, y, width, height } = img.getBoundingClientRect();
    return {
      loaded: img.complete && img.naturalWidth > 0,
      currentSrc: new URL(img.currentSrc || img.src).pathname,
      layout: { width: img.offsetWidth, height: img.offsetHeight },
      box: { x, y, width, height },
    };
  });

/** which point of the image sits at the viewport center, as a 0 to 1 fraction of the image box */
export const centerPoint = async (page: Page) => {
  const { box } = await imageState(page);
  const viewport = page.viewportSize()!;
  return {
    x: (viewport.width / 2 - box.x) / box.width,
    y: (viewport.height / 2 - box.y) / box.height,
  };
};

/** true when the image box fills the whole viewport, within half a pixel */
export const coversViewport = async (page: Page) => {
  const { box } = await imageState(page);
  const viewport = page.viewportSize()!;
  return (
    box.x <= 0.5 &&
    box.y <= 0.5 &&
    box.x + box.width >= viewport.width - 0.5 &&
    box.y + box.height >= viewport.height - 0.5
  );
};

/** true when the photo is zoomed all the way out, so one side exactly fills the viewport */
export const isAtCover = async (page: Page) => {
  const { box } = await imageState(page);
  const viewport = page.viewportSize()!;
  return (
    Math.min(box.width - viewport.width, box.height - viewport.height) <= 0.5
  );
};

/**
 * Compares the loaded file with what the screen needs.
 *
 * @returns `fileWidth` real pixels in the loaded file, `neededWidth` device pixels the photo covers on screen, and `largestOffered` the widest file in the avif srcset.
 */
export const imagePixels = (page: Page) =>
  photoImage(page).evaluate(async (img: HTMLImageElement) => {
    // decode a copy because naturalWidth is scaled by the srcset width
    const copy = new Image();
    copy.src = img.currentSrc;
    await copy.decode();

    const srcset =
      img.parentElement
        ?.querySelector('source[type="image/avif"]')
        ?.getAttribute('srcset') ?? '';
    const offered = [...srcset.matchAll(/ (\d+)w/g)].map(([, w]) => Number(w));

    return {
      fileWidth: copy.naturalWidth,
      neededWidth: img.getBoundingClientRect().width * devicePixelRatio,
      largestOffered: Math.max(...offered),
    };
  });

/**
 * Records the photo image box on every animation frame until stopped.
 *
 * @returns A function that stops recording and returns the boxes seen.
 */
export const recordImageBoxes = async (page: Page) => {
  await photoImage(page).evaluate((img: HTMLImageElement) => {
    const boxes: DOMRect[] = [];
    const record = () => {
      boxes.push(img.getBoundingClientRect());
      (window as any).__recording = requestAnimationFrame(record);
    };
    (window as any).__boxes = boxes;
    record();
  });

  return () =>
    page.evaluate(() => {
      cancelAnimationFrame((window as any).__recording);
      return ((window as any).__boxes as DOMRect[]).map(
        ({ x, y, width, height }) => ({ x, y, width, height })
      );
    });
};
