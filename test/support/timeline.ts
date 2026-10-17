import { expect, type Page } from '@playwright/test';

/** one dot per photo plus earth, ordered by distance */
export const timelineDots = (page: Page) => page.locator('#timeline a');

/** the caption link under the timeline preview */
export const previewCaption = (page: Page, title: string) =>
  page.getByRole('link', { name: title, exact: true });

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
    await dot.hover();
    // the preview renders a moment after the hover
    const isPreviewed = await caption
      .waitFor({ state: 'visible', timeout: 500 })
      .then(() => true)
      .catch(() => false);
    if (isPreviewed) return caption;
  }
  await expect(caption, `no timeline dot previews ${title}`).toBeVisible();
  return caption;
};
