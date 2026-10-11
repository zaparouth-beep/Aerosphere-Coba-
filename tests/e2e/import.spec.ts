import { expect, test } from "@playwright/test";
import { go, guardConsole, loginDemo } from "./helpers";

/**
 * Upload any document (PDF, Word, CSV), review the rows, replace the project
 * data, see the comparison in Hasil, and restore the previous data.
 * The AI reader is not available on the local static server (no Netlify function).
 */

guardConsole();

test.beforeEach(({}, info) => {
  test.skip(info.project.name === "mobile", "covered on desktop");
});

const fixture = (f: string) => `tests/fixtures/import/${f}`;

test("PDF: review, replace project data, comparison in Hasil, restore", async ({ page }) => {
  await loginDemo(page);
  await go(page, "/data");
  await page.getByTestId("document-upload").setInputFiles(fixture("lci.pdf"));
  const review = page.getByTestId("import-review");
  await expect(review).toBeVisible({ timeout: 20_000 });
  await expect(review).toContainText("5 input");
  await expect(review).toContainText("3 output");
  await expect(review).toContainText("2 hasil dampak");
  await expect(review).toContainText("Input dan output lengkap");
  await expect(page.getByTestId("ai-unavailable")).toBeVisible();
  await expect(page.getByTestId("ai-run")).toBeDisabled();
  if (process.env.SCREENSHOTS) await page.screenshot({ path: "docs/screenshots/unggah-dokumen-tinjau.png" });

  await page.getByTestId("import-apply").click();
  await expect(page.getByText(/Data proyek diganti dari lci\.pdf/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Kembalikan data sebelum unggah/ })).toBeVisible();
  await expect(page.locator("main")).toContainText("Data versi 2");

  await go(page, "/hasil");
  await expect(page.locator("#informasi")).toContainText("250 m²");
  const cmp = page.getByTestId("external-impacts");
  await expect(cmp).toContainText("Global warming potential");
  await expect(cmp).toContainText("1.850 kg CO2 eq");
  if (process.env.SCREENSHOTS) {
    await cmp.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "docs/screenshots/unggah-dokumen-pembanding.png" });
  }

  await go(page, "/data");
  await page.getByRole("button", { name: /Kembalikan data sebelum unggah/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Kembalikan" }).click();
  await expect(page.getByText("Data sebelum unggah dikembalikan")).toBeVisible();
  await expect(page.locator("main")).toContainText("Data versi 3");
});

test("Word document is read the same way", async ({ page }) => {
  await loginDemo(page);
  await go(page, "/data");
  await page.getByTestId("document-upload").setInputFiles(fixture("lci.docx"));
  const review = page.getByTestId("import-review");
  await expect(review).toBeVisible({ timeout: 20_000 });
  await expect(review).toContainText("5 input");
  await expect(review).toContainText("3 output");
  await expect(page.getByTestId("import-apply")).toBeEnabled();
});

test("a document with only inputs cannot be applied", async ({ page }) => {
  await loginDemo(page);
  await go(page, "/data");
  await page.getByTestId("document-upload").setInputFiles(fixture("hanya-input.csv"));
  await expect(page.getByTestId("import-problems")).toContainText("output");
  await expect(page.getByTestId("import-apply")).toBeDisabled();
  // Correcting a row in the review makes it valid: mark the second chemical as B3 waste.
  const row = page.getByTestId("import-row").filter({ has: page.locator('input[value="Asam borat"]') });
  await row.getByLabel(/Jenis/).selectOption("waste");
  await expect(page.getByTestId("import-apply")).toBeEnabled();
});
