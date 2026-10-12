import { expect, test } from "@playwright/test";
import { go, guardConsole, loginDemo } from "./helpers";

/** Interface language: Indonesian by default, English on request, remembered after reload. */

guardConsole();

test("switch the whole app between Indonesian and English", async ({ page }) => {
  await loginDemo(page);
  await go(page, "/beranda");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await page.getByTestId("lang-switch").getByRole("radio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("lang-switch").getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByTestId("lang-switch").getByRole("radio", { name: "Bahasa Indonesia" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
});
