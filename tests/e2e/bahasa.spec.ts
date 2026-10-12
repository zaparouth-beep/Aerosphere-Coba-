import { expect, test } from "@playwright/test";
import { go, guardConsole, loginDemo } from "./helpers";

/** Interface language: Indonesian by default, English on request, remembered after reload. */

guardConsole();

test("switch the whole app between Indonesian and English", async ({ page }) => {
  await loginDemo(page);
  await go(page, "/beranda");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  const nav = page.getByRole("complementary").first();
  await page.getByTestId("lang-switch").getByRole("radio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  if (await nav.isVisible()) {
    await expect(nav).toContainText("My Data");
    await expect(nav).toContainText("Improvement Simulation");
  }
  if (process.env.SCREENSHOTS && test.info().project.name === "desktop") {
    await page.screenshot({ path: "docs/screenshots/bahasa-inggris-beranda.png" });
    await go(page, "/laporan");
    await page.getByRole("tab", { name: /Management summary/ }).click();
    await page.screenshot({ path: "docs/screenshots/bahasa-inggris-laporan.png" });
    await go(page, "/beranda");
  }
  await expect(page.getByTestId("lang-switch").getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByTestId("lang-switch").getByRole("radio", { name: "Bahasa Indonesia" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  if (await nav.isVisible()) await expect(nav).toContainText("Data Saya");
});
