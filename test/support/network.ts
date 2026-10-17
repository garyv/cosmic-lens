import type { Page } from '@playwright/test';

/**
 * Holds every photo image response for a while before letting it through.
 *
 * @param page - The page whose image requests are slowed.
 * @param options.delay - How long to hold each response in milliseconds.
 */
export const slowImages = async (page: Page, { delay = 1500 } = {}) => {
  await page.route('**/images/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    await route.continue();
  });
};
