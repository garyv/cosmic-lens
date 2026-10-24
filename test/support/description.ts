import { expect, type Locator, type Page } from '@playwright/test';

export type Box = { left: number; top: number; right: number; bottom: number };

type Point = { x: number; y: number };

/** the description panel holding some of its text */
export const panelWith = (page: Page, text: RegExp) =>
  page.getByText(text).locator('xpath=../..');

export const panelBox = async (page: Page, text: RegExp): Promise<Box> => {
  const { x, y, width, height } = (await panelWith(page, text).boundingBox())!;
  return { left: x, top: y, right: x + width, bottom: y + height };
};

/** the page's other controls: headers, the timeline and toolbars */
export const controlBoxes = (page: Page): Promise<Box[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll('main header, main nav, [role="toolbar"]')]
      .filter((element) => !element.closest('nav') || element.matches('nav'))
      .map((element) => {
        const { left, top, right, bottom } = element.getBoundingClientRect();
        return { left, top, right, bottom };
      })
  );

/** how far apart two boxes are, negative when they overlap */
export const clearance = (a: Box, b: Box) =>
  Math.max(
    b.left - a.right,
    a.left - b.right,
    b.top - a.bottom,
    a.top - b.bottom
  );

/** waits for a point to take pointer input, which the view transition after a page loads holds for a moment */
export const waitForInput = (page: Page, point: Point) =>
  expect
    .poll(() =>
      page.evaluate(
        ({ x, y }) =>
          document.elementFromPoint(x, y) !== document.documentElement,
        point
      )
    )
    .toBe(true);

/** drags with the mouse in small steps, like a hand would */
export const drag = async (page: Page, from: Point, by: Point) => {
  await waitForInput(page, from);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 20 });
  await page.mouse.up();
};

/** the computed `user-select` of an element */
export const userSelect = (locator: Locator) =>
  locator.evaluate((element) => getComputedStyle(element).userSelect);

/** the text a select all picks up, which leaves out anything that can't be selected */
export const selectAllText = (page: Page) =>
  page.evaluate(() => {
    getSelection()?.selectAllChildren(document.body);
    return getSelection()?.toString() ?? '';
  });
