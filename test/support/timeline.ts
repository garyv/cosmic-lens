import { expect, type Page } from '@playwright/test';

/** one dot per photo plus earth, ordered by distance */
export const timelineDots = (page: Page) => page.locator('#timeline a');

/** the caption link under the timeline preview */
export const previewCaption = (page: Page, title: string) =>
  page.getByRole('link', { name: title, exact: true });

/** the title in the preview caption, whichever photo it shows, or an empty string with no preview */
const shownTitle = async (page: Page) =>
  (await page.locator('#timeline ~ div h3 a').allTextContents())[0] ?? '';

/**
 * Hovers timeline dots one by one until the preview shows the photo, the way a user scans the timeline.
 *
 * Dots carry only a distance, and photos can share one, so the caption is the only way to tell them apart.
 */
export const previewPhoto = async (page: Page, title: string) => {
  const dots = timelineDots(page);
  const caption = previewCaption(page, title);
  await expect(dots.first()).toBeVisible();

  for (const dot of await dots.all()) {
    const before = await shownTitle(page);
    await dot.hover();
    // the preview renders a moment after the hover, and stays put if this dot's photo already shows
    const start = Date.now();
    let shown = before;
    while (shown === before && Date.now() - start < 2_000) {
      await page.waitForTimeout(25);
      shown = await shownTitle(page);
    }
    if (shown === title) return caption;
  }
  await expect(caption, `no timeline dot previews ${title}`).toBeVisible();
  return caption;
};
