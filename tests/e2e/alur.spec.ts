import { expect, test } from "@playwright/test";
import { go, guardConsole, loginDemo } from "./helpers";

/**
 * Hasil overview, flow diagram with drill-in and suggestions (Titik Boros) and
 * the before/after change lab with pins (Simulasi). Demo project, screening factors.
 * SCREENSHOTS=1 writes docs/screenshots/{hasil,titik-boros-alur,simulasi}-*.png.
 */

guardConsole();

const shot = (name: string) => `docs/screenshots/${name}.png`;

test("Hasil: overview cards, donuts with totals, flow, life cycle, contents list", async ({ page }, info) => {
  await loginDemo(page);
  await go(page, "/hasil");
  for (const id of ["informasi", "angka-utama", "jejak-karbon", "nilai-terbuang", "alur", "siklus-hidup", "per-tahap"]) await expect(page.locator(`#${id}`)).toBeVisible();
  await expect(page.locator("#informasi")).toContainText("250 m²");
  await expect(page.locator("#jejak-karbon")).toContainText("7,39");
  await expect(page.locator("#jejak-karbon")).toContainText("38,5%");
  await expect(page.locator("#nilai-terbuang")).toContainText("45,3% dari biaya proses");
  await expect(page.getByTestId("lifecycle-gwp")).toContainText("100,0% dibeli");
  await expect(page.locator('#alur [data-node="total"]')).toHaveCount(1);
  // Switching the indicator redraws the flow: water has only stages A and D.
  await page.locator("#alur").getByTestId("tile-water").click();
  await expect(page.locator('#alur [data-node="stage:A"]')).toHaveCount(1);
  await expect(page.locator('#alur [data-node="stage:B"]')).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toMatch(/\b(hotspot|GWP|LCIA|FU|Sankey)\b/i);
  if (info.project.name === "desktop") {
    await page.getByRole("navigation", { name: "Isi halaman" }).getByRole("link", { name: "Siklus hidup" }).click();
    await expect(page.locator("#siklus-hidup")).toBeInViewport();
  }
  if (process.env.SCREENSHOTS) await page.screenshot({ path: shot(`hasil-${info.project.name === "desktop" ? "desktop" : "hp"}`), fullPage: true });
});

test("Titik Boros: flow view, hover value, select → suggestions, drill in and back", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "hover needs a pointer");
  await loginDemo(page);
  await go(page, "/titik-boros");
  await page.getByRole("radio", { name: /Alur/ }).click();
  const flow = page.getByTestId("tb-flow");
  await expect(flow.locator('[data-node="stage:C"]')).toHaveCount(1);

  await flow.locator('[data-link="kind:chemical→stage:C"]').hover();
  await expect(page.getByRole("tooltip")).toContainText("1,5 kg CO₂e per m²");
  await expect(page.getByRole("tooltip")).toContainText("Bahan kimia → C. Pelapisan utama");

  await flow.locator('[data-node="stage:C"]').click();
  const panel = page.getByTestId("tb-flow-panel");
  await expect(panel).toContainText("C. Pelapisan utama");
  await expect(panel).toContainText("TITIK BOROS");
  await expect(panel).toContainText("Bahan kimia: 375 kg CO₂e per tahun");
  await expect(panel).toContainText("Lihat perhitungannya");
  // The same stage is highlighted in the table.
  await expect(page.getByTestId("cell-gwp-C")).toHaveAttribute("data-highlight", "true");
  if (process.env.SCREENSHOTS) {
    await page.mouse.move(0, 0);
    await flow.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: shot("titik-boros-alur") });
  }

  await page.getByTestId("tb-flow-panel-drill").click();
  await expect(flow.getByRole("navigation", { name: "Posisi di diagram" })).toContainText("C. Pelapisan utama");
  await expect(flow.locator('[data-node^="component:"]').first()).toBeVisible();
  if (process.env.SCREENSHOTS) {
    await page.mouse.move(0, 0);
    await flow.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.screenshot({ path: shot("titik-boros-alur-rinci") });
  }
  await page.getByTestId("tb-flow-reset").click();
  await expect(flow.locator('[data-node="total"]')).toHaveCount(1);
});

test("Simulasi: apply a change, see before/after, pin results, open the calculation", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "covered on desktop");
  await loginDemo(page);
  await go(page, "/simulasi");
  const lab = page.getByTestId("sim-flow");
  await expect(lab.locator('[data-node="total"]')).toContainText("▼");
  const panel = page.getByTestId("change-panel");
  await expect(panel).toContainText("Jejak karbon −11");
  await expect(page.getByTestId("pin-count")).toHaveText("0 pin aktif");
  await panel.getByRole("button", { name: "Sematkan" }).click();
  await expect(page.getByTestId("pin-count")).toHaveText("1 pin aktif");

  // Second change, pinned next to the first.
  const second = page.locator('[data-testid^="apply-"]').nth(1);
  await second.click();
  await panel.getByRole("button", { name: "Sematkan" }).click();
  await expect(page.getByTestId("pins").locator("li")).toHaveCount(2);

  // Before / after toggle.
  await page.getByRole("radio", { name: /Sebelum/ }).click();
  await expect(lab.locator('[data-node="total"]')).not.toContainText("▼");
  if (process.env.SCREENSHOTS) {
    await page.getByRole("radio", { name: /Sesudah/ }).click();
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: shot("simulasi-coba-perubahan") });
  }

  await panel.getByRole("button", { name: /Lihat perhitungannya/ }).click();
  await expect(page.locator("#detail-simulasi")).toBeInViewport();
});
