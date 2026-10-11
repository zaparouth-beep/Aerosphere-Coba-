import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the static export (npm run build:static → out/).
 * In the cloud container Chromium is pre-installed; elsewhere `npx playwright install chromium`.
 */
const chromium = process.env.PW_CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const PORT = 3400;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: chromium ? { executablePath: chromium } : {},
    acceptDownloads: true,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } },
  ],
  webServer: {
    command: `node scripts/serve-out.mjs out ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
  },
});
