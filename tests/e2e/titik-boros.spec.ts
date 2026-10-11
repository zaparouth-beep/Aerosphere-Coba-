import { expect, test } from "@playwright/test";

/**
 * Titik Boros e2e (demo project, screening factors). Run after `npm run build:static`.
 * SCREENSHOTS=1 also writes docs/screenshots/titik-boros-*.png.
 */

import { go, guardConsole, loginDemo } from "./helpers";

guardConsole();

test("three areas, colour classes and test values (Mode Ringkas)", async ({ page }, info) => {
  await loginDemo(page);
  await go(page, "/titik-boros");
  const main = page.locator("main");

  // Legend: one, with text for every colour.
  const legend = page.getByLabel("Legenda warna");
  for (const label of ["Titik boros", "Tinggi", "Sedang", "Rendah", "Tidak ada"]) await expect(legend.getByText(label, { exact: true })).toBeVisible();
  await expect(legend).toContainText("≥ 30%");

  // Area A: 7 bars, colours by class, totals per m².
  for (const k of ["gwp", "ap", "ep", "adp_fossil", "water", "waste_b3", "waste_value"]) await expect(page.getByTestId(`bar-${k}`)).toBeVisible();
  const want: Record<string, Record<string, string>> = {
    gwp: { A: "yellow", B: "green", C: "red", D: "yellow", E: "green", F: "yellow" },
    water: { A: "red", D: "red" },
    waste_b3: { F: "red", C: "yellow", D: "yellow", A: "yellow", B: "green", E: "green" },
  };
  for (const [k, stages] of Object.entries(want)) for (const [s, c] of Object.entries(stages)) await expect(page.getByTestId(`seg-${k}-${s}`)).toHaveAttribute("data-severity", c);
  await expect(page.getByTestId("seg-water-B")).toHaveCount(0);
  await expect(page.getByTestId("bar-gwp")).toContainText("7,39 kg CO₂e per m²");
  await expect(page.getByTestId("bar-gwp")).toContainText(/titik boros/i);
  await expect(page.getByTestId("not-computed-note")).toHaveText("12 kategori dampak lain belum dihitung (faktor belum tersedia).");

  // Area B: same values in the table; grey cells for zero.
  await expect(page.getByTestId("cell-gwp-C")).toContainText("38,5%");
  await expect(page.getByTestId("cell-gwp-C")).toHaveAttribute("data-severity", "red");
  await expect(page.getByTestId("cell-water-A")).toContainText("53,8%");
  await expect(page.getByTestId("cell-water-B")).toHaveAttribute("data-severity", "grey");
  await expect(page.getByTestId("cell-waste_b3-F")).toContainText("50,0%");

  // Area C: first box red, C/F/A/D red, summary sentence.
  const boxes = page.getByTestId("stage-boxes").locator("article");
  await expect(boxes.first()).toHaveAttribute("data-severity", "red");
  for (const s of ["C", "F", "A", "D"]) await expect(page.getByTestId(`box-${s}`)).toHaveAttribute("data-severity", "red");
  await expect(page.getByTestId("summary-sentence")).toContainText("Pelapisan utama adalah titik boros terbesar: merah di");
  await expect(page.getByTestId("box-C")).toContainText("Bahan kimia: 375 kg CO₂e per tahun");
  await expect(page.getByTestId("box-C")).toContainText("Lihat perhitungannya");

  // No technical terms in Mode Ringkas.
  expect(await main.innerText()).not.toMatch(/\b(hotspot|GWP|LCIA|FU)\b/i);

  // Layout: at ≥ 1280 px the table (7/12) and boxes (5/12) sit side by side; below, stacked.
  const table = await page.getByTestId("heat-table").boundingBox();
  const box = await page.getByTestId("stage-boxes").boundingBox();
  if (info.project.name === "desktop") expect(box!.x).toBeGreaterThan(table!.x + 200);
  else expect(box!.y).toBeGreaterThan(table!.y);

  if (process.env.SCREENSHOTS) {
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `docs/screenshots/titik-boros-${info.project.name === "desktop" ? "desktop" : "hp"}.png`, fullPage: true });
  }
});

test("hover and click link the three areas", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "hover needs a pointer");
  await loginDemo(page);
  await go(page, "/titik-boros");

  await page.getByTestId("seg-gwp-C").hover();
  await expect(page.getByRole("tooltip")).toContainText("C. Pelapisan utama");
  await expect(page.getByRole("tooltip")).toContainText("38,5%");
  await expect(page.getByTestId("cell-gwp-C")).toHaveAttribute("data-highlight", "true");
  await expect(page.getByTestId("box-C")).toHaveAttribute("data-highlight", "true");
  if (process.env.SCREENSHOTS) await page.screenshot({ path: "docs/screenshots/titik-boros-desktop-sorot.png" });

  await page.getByTestId("cell-water-A").hover();
  await expect(page.getByTestId("box-A")).toHaveAttribute("data-highlight", "true");

  await page.getByTestId("box-F").getByRole("button", { name: "Pengolahan air limbah" }).click();
  await page.mouse.move(0, 0);
  for (const k of ["gwp", "water", "waste_b3"]) await expect(page.getByTestId(`cell-${k}-F`)).toHaveAttribute("data-highlight", "true");
  await expect(page.getByTestId("box-F")).toHaveAttribute("data-highlight", "true");
});

test("buttons: Excel, copy, other stages, lever link", async ({ page, context }, info) => {
  test.skip(info.project.name === "mobile", "covered on desktop");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await loginDemo(page);
  await go(page, "/titik-boros");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Unduh tabel (Excel)" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^Titik-boros_.*\.xlsx$/);

  await page.getByRole("button", { name: "Salin" }).click();
  await expect(page.getByText("Tabel titik boros disalin.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Jejak karbon");

  const other = page.getByText(/Lihat tahap lain \(\d\)/);
  if (await other.count()) {
    await other.click();
    await expect(page.locator("details[open]")).toHaveCount(1);
  }

  await page.getByTestId("box-C").getByRole("link", { name: /Lihat perhitungannya/ }).first().click();
  await page.waitForURL(/\/simulasi\?skenario=/);
  await expect(page.locator("#detail-simulasi")).toBeVisible();
});

test("Mode Ahli: % / nilai toggle and threshold from project settings", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "covered on desktop");
  await loginDemo(page);
  // The demo account has every feature (Industri plan), so Mode Ahli is open.
  await page.getByRole("radio", { name: /Ahli/ }).click();

  await go(page, "/titik-boros");
  await page.getByRole("radio", { name: "nilai", exact: true }).click();
  await expect(page.getByTestId("cell-gwp-C")).toContainText("2,85");
  await expect(page.getByTestId("cell-gwp-C")).toHaveAttribute("data-severity", "red");
  await page.getByRole("radio", { name: "%", exact: true }).click();
  await expect(page.getByTestId("cell-gwp-C")).toContainText("38,5%");

  // Threshold 40 % → Pelapisan utama becomes orange for carbon.
  await go(page, "/pengaturan?tab=proyek");
  const input = page.getByLabel("Ambang titik boros (%)");
  await input.fill("40");
  await input.press("Enter");
  await go(page, "/titik-boros");
  await expect(page.getByLabel("Legenda warna")).toContainText("≥ 40%");
  await expect(page.getByTestId("cell-gwp-C")).toHaveAttribute("data-severity", "orange");
});

test("demo account has every feature (jury demo)", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "covered on desktop");
  await loginDemo(page);
  await expect(page.locator("aside")).toContainText("Industri");
  await page.getByRole("radio", { name: /Ahli/ }).click();
  await expect(page.getByRole("radio", { name: /Ahli/ })).toHaveAttribute("aria-checked", "true");
  await go(page, "/laporan");
  for (const tab of ["Teknis", "Kepatuhan"]) {
    await page.getByRole("tab", { name: new RegExp(tab) }).click();
    await expect(page.locator("main").getByText("Lihat paket")).toHaveCount(0);
  }
  await page.getByRole("tab", { name: /Laporan Kajian LCA/ }).click();
  await expect(page.locator("article.study-report")).not.toContainText("Contoh");
});
