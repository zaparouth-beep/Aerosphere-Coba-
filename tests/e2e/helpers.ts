import { expect, test, type Page } from "@playwright/test";

/** Shared e2e helpers: demo sign-in, safe navigation and console-error collection. */

export const errors: string[] = [];

export async function loginDemo(page: Page) {
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // Next.js logs this when a route prefetch is cut off by a test navigation and then falls back to a normal load.
    if (m.type() === "error" && !/Failed to fetch RSC payload .* Falling back to browser navigation/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  await page.goto("/masuk");
  await page.getByRole("button", { name: "Isi akun demo" }).click();
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL(/beranda|mulai/);
  // The demo account starts a guided tour that moves between pages; close it first.
  const skip = page.getByRole("button", { name: "Lewati tur" });
  await skip
    .waitFor({ timeout: 8000 })
    .then(() => skip.click())
    .catch(() => undefined);
  await expect(skip).toHaveCount(0);
}

/** Navigate once in-flight prefetches have settled (an aborted prefetch logs a console error). */
export async function go(page: Page, path: string) {
  await page.waitForLoadState("networkidle");
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/** Call once per spec file: each test starts clean and fails on any console or page error. */
export function guardConsole() {
  test.beforeEach(() => {
    errors.length = 0;
  });
  test.afterEach(() => {
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

