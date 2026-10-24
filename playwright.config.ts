import { defineConfig } from '@playwright/test';

// set BASE_URL to run the suite against a deployed site instead of a local build
const baseURL = process.env.BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: 'test',
  testMatch: '*.test.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // 27 inch qhd monitor at 1x
      name: 'desktop',
      use: { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 },
    },
    {
      // 14 inch laptop at 2x
      name: 'laptop',
      use: { viewport: { width: 1512, height: 860 }, deviceScaleFactor: 2 },
    },
    {
      // 6 inch phone at 3x
      name: 'phone',
      use: {
        viewport: { width: 390, height: 664 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  // serve the real build, skipped when testing a deployed site
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'vite build && vite preview --port 4173 --strictPort',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
