import { expect, test, type Page } from "@playwright/test";
import { go, guardConsole, loginDemo } from "./helpers";

/**
 * Simulasi Perbaikan follows the data: after "Hitung hasil" (which shows the
 * saved result in other menus), changing numbers in Data Saya or in the
 * simulation settings changes the simulation results.
 */

guardConsole();

test.beforeEach(({}, info) => {
  test.skip(info.project.name === "mobile", "covered on desktop");
});

const rectifierSaving = async (page: Page) => (await page.getByRole("radio", { name: /Perbaiki penyearah arus/ }).innerText()).match(/Rp[\d.]+/)![0];

test("changing input data after saving a result changes the simulation", async ({ page }) => {
  await loginDemo(page);
  await go(page, "/simulasi");
  const before = await rectifierSaving(page);

  // Save a result: other menus now show it (locked).
  await page.getByRole("button", { name: "Hitung hasil" }).click();
  await expect(page.getByText(/Hasil #R-\d{4}-\d{3} \(terkunci\)/)).toBeVisible();
  await expect(page.getByTestId("sim-live-note")).toBeVisible();

  // Triple the rectifier electricity in Data Saya.
  await go(page, "/data");
  const qty = page.getByLabel("Kuantitas Rectifier electricity");
  if (!(await qty.isVisible())) await page.getByRole("tab", { name: /Listrik|Energi/ }).first().click();
  await qty.fill("900");
  await qty.press("Enter");
  await expect(page.getByText(/Tampilan pindah ke data terkini/)).toBeVisible();

  await go(page, "/simulasi");
  const after = await rectifierSaving(page);
  expect(after).not.toBe(before);
  await page.getByRole("radio", { name: /Perbaiki penyearah arus/ }).click();
  await expect(page.getByTestId("change-values")).toContainText("Listrik");
  if (process.env.SCREENSHOTS) await page.screenshot({ path: "docs/screenshots/simulasi-ikut-data.png" });
});

test("changing a simulation setting updates the result, even while a saved result is selected", async ({ page }) => {
  await loginDemo(page);
  await go(page, "/simulasi");
  await page.getByRole("button", { name: "Hitung hasil" }).click();
  const before = await rectifierSaving(page);
  await page.getByRole("button", { name: /Perbaiki penyearah arus/ }).first().click();
  const eta = page.locator("#detail-simulasi").getByLabel("Efisiensi baru (%)");
  await eta.fill("97");
  await eta.press("Enter");
  await expect(eta).toHaveValue("97");
  await expect.poll(() => rectifierSaving(page)).not.toBe(before);
});
