import { defineConfig } from '@playwright/test';

/**
 * E2E tests run the real game in the system Chrome (channel "chrome"), against the Vite dev server.
 * `npm run test:e2e`
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5199',
    channel: 'chrome',
    viewport: { width: 1366, height: 768 },
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5199 --strictPort',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: true,
    env: { VITE_CACHE_DIR: 'node_modules/.vite-e2e' },
    timeout: 60_000,
  },
});
