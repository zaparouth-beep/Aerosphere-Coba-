import { expect, test } from "@playwright/test";
import { go, guardConsole, loginDemo } from "./helpers";

/**
 * Reports: detailed improvement directions and text the user can adjust
 * before printing or downloading. Numbers stay those of the engine.
 */

guardConsole();

test.beforeEach(({}, info) => {
  test.skip(info.project.name === "mobile", "covered on desktop");
});

test("Kajian LCA: directions, edit text, numbers guarded, leave out a direction, reset", async ({ page }) => {
  await loginDemo(page);
  await go(page, "/laporan");
  const report = page.locator("article.study-report");
  await expect(report).toContainText("Arahan Perbaikan");
  await expect(report.getByTestId("directions")).toContainText("Langkah kerja");
  await expect(report.getByTestId("directions")).toContainText("Penanggung jawab");

  await page.getByTestId("report-edit-toggle").click();
  await expect(page.getByTestId("report-edit-help")).toBeVisible();
  const objective = page.locator('[data-block="id:objective"]');
  await objective.fill("Menilai dampak lingkungan lini untuk menyusun program perbaikan tahunan perusahaan.");

  // A number that the engine did not produce blocks print and download.
  const title = page.locator('[data-block="id:title"]');
  const original = await title.inputValue();
  await title.fill(original.replace(/\d{4}/, "1999"));
  await expect(page.getByTestId("report-edit-invalid")).toBeVisible();
  await expect(page.getByRole("button", { name: /Cetak \/ simpan PDF/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Unduh Excel/ })).toBeDisabled();
  await title.fill(original);
  await expect(page.getByTestId("report-edit-invalid")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Cetak \/ simpan PDF/ })).toBeEnabled();

  // Leave the first direction out of the report.
  await page.getByTestId("report-include").first().click();
  if (process.env.SCREENSHOTS) await page.screenshot({ path: "docs/screenshots/laporan-ubah-teks.png", fullPage: false });
  await page.getByTestId("report-edit-toggle").click();
  await expect(report).toContainText("Menilai dampak lingkungan lini untuk menyusun program perbaikan tahunan perusahaan.");
  await expect(page.getByTestId("report-edit-count")).toContainText("1 bagian diubah");
  await expect(page.getByTestId("report-edit-count")).toContainText("1 bagian tidak disertakan");

  // Edits survive a reload (saved in this browser), then everything can be restored.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(report).toContainText("program perbaikan tahunan perusahaan");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Unduh Excel/ }).click();
  expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
  await page.getByRole("button", { name: "Kembalikan semua teks asli" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Kembalikan" }).click();
  await expect(report).not.toContainText("program perbaikan tahunan perusahaan");
  await expect(page.getByTestId("report-edit-count")).toHaveCount(0);
});

test("Ringkasan untuk manajemen: directions and editable conclusion", async ({ page }) => {
  await loginDemo(page);
  await go(page, "/laporan");
  await page.getByRole("tab", { name: /Ringkasan untuk manajemen/ }).click();
  await expect(page.getByTestId("directions")).toContainText("Cara mengukur keberhasilan");
  await page.getByTestId("report-edit-toggle").click();
  await page.locator('[data-block="kesimpulan:0"]').fill("Pelapisan utama adalah prioritas perbaikan pertama.");
  await page.getByTestId("report-edit-toggle").click();
  await expect(page.locator("main")).toContainText("Pelapisan utama adalah prioritas perbaikan pertama.");
});

test("Teknis: professional wording, editable summary, directions per template", async ({ page }) => {
  await loginDemo(page);
  await go(page, "/laporan");
  await page.getByRole("tab", { name: /Teknis/ }).click();
  await page.getByRole("button", { name: /Executive One-pager/ }).click();
  const preview = page.locator("article").last();
  await expect(preview).toContainText("Untuk setiap 1 m² permukaan yang dilapisi");
  await expect(preview).toContainText("Arahan tindak lanjut");
  await page.getByTestId("report-edit-toggle").click();
  const p1 = page.locator('[data-block="ringkasan:1"]');
  await p1.fill(`${await p1.inputValue()} Ringkasan ini disiapkan untuk rapat direksi.`);
  await page.getByTestId("report-edit-toggle").click();
  await expect(preview).toContainText("Ringkasan ini disiapkan untuk rapat direksi.");
  if (process.env.SCREENSHOTS) await page.screenshot({ path: "docs/screenshots/laporan-teknis-onepager.png", fullPage: true });

  await page.getByRole("button", { name: /Scenario Decision Brief/ }).click();
  await expect(preview).toContainText("Arahan perbaikan");
  await expect(preview.getByTestId("directions")).toContainText("Langkah kerja");
  await expect(preview).not.toContainText("Ringkasan ini disiapkan untuk rapat direksi.");
  if (process.env.SCREENSHOTS) await page.screenshot({ path: "docs/screenshots/laporan-arahan-perbaikan.png", fullPage: true });
});

test("directions follow the data: a changed input shows up in the report's reasons", async ({ page }) => {
  await loginDemo(page);
  await go(page, "/data");
  const qty = page.getByLabel("Kuantitas Rectifier electricity");
  if (!(await qty.isVisible())) await page.getByRole("tab", { name: /Listrik|Energi/ }).first().click();
  await qty.fill("90000");
  await qty.press("Enter");
  await go(page, "/laporan");
  await page.getByRole("tab", { name: /Ringkasan untuk manajemen/ }).click();
  const dirs = page.getByTestId("directions");
  await expect(dirs).toContainText("Rectifier electricity (90.000 kWh)");
  if (process.env.SCREENSHOTS) {
    await dirs.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "docs/screenshots/laporan-arahan-ikut-data.png" });
  }
});
