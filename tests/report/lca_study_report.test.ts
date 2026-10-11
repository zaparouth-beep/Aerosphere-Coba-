import { describe, expect, it } from "vitest";
import fixtureJson from "../golden/plating_demo_v1.json";
import { hardChromeDemo } from "@/lib/domain/templates";
import { runAnalysis } from "@/lib/engine";
import { calculate, indicatorsOf } from "@/lib/engine/calculate";
import { SCREENING_V1 } from "@/lib/engine/factors";
import { buildStudyModel } from "@/lib/engine/study";
import { evaluateScenario } from "@/lib/engine/scenario";
import type { ProjectInput } from "@/lib/engine/types";
import { STUDY_SHEETS, buildStudyWorkbook } from "@/lib/io/studyExport";
import { formatShareRow, studyText } from "@/lib/report/lcaStudy";
import { topActions } from "@/lib/view/summary";

/**
 * M6 — Laporan Kajian LCA (spec §8). Percentages, absolute values and the
 * cradle/gate classification come from the engine (lib/engine/study.ts);
 * lib/report only phrases them. Golden row: spec §8.1 point 6.
 */
const fixture = fixtureJson as unknown as ProjectInput;
const model = buildStudyModel(runAnalysis(fixture, SCREENING_V1));
const row = (k: string) => model.rows.find((r) => r.key === k)!;

describe("study model (engine)", () => {
  it("has the 16 rows of the PROPER profile in table order and groups", () => {
    expect(model.rows.map((r) => r.no)).toEqual(["1", "2", "3", "4", "5", "6a", "6b", "7a", "7b", "7c", "8", "9", "10", "11", "12a", "12b"]);
    expect(model.rows.filter((r) => r.group === "primary").map((r) => r.no)).toEqual(["1", "2", "3", "4"]);
    expect(model.rows.filter((r) => r.group === "energy").map((r) => r.no)).toEqual(["12a", "12b"]);
  });

  it("GWP row equals the golden row 10,20 / 8,11 / 38,53 / 17,20 / 6,41 / 19,56", () => {
    expect(row("gwp").status).toBe("screening");
    expect(formatShareRow(row("gwp"), "id")).toEqual(["10,20", "8,11", "38,53", "17,20", "6,41", "19,56"]);
    expect(row("gwp").topStage).toBe("C");
  });

  it("every computed row sums to 100 % (unrounded, ±0.01)", () => {
    for (const r of model.rows.filter((x) => x.status !== "not_computed")) {
      const sum = Object.values(r.share).reduce<number>((s, v) => s + (v ?? 0), 0);
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.01);
    }
  });

  it("only GWP, AP and EP are filled from screening; the rest is 'not computed', never 0", () => {
    expect(model.rows.filter((r) => r.status !== "not_computed").map((r) => r.key)).toEqual(["gwp", "ap", "ep"]);
    for (const r of model.rows.filter((x) => x.status === "not_computed")) {
      expect(r.total).toBeNull();
      expect(r.perFU).toBeNull();
      expect(Object.values(r.share).every((v) => v === null)).toBe(true);
    }
  });

  it("absolute values per 1 m² and per period (cradle / gate / total)", () => {
    const g = row("gwp");
    expect(g.total).toBeCloseTo(1848.495, 6);
    expect(g.perFU).toBeCloseTo(7.394, 3);
    expect(g.cradlePerFU).toBeCloseTo(7.394, 3);
    expect(g.gatePerFU).toBeCloseTo(0, 9);
    const ap = row("ap");
    expect(ap.total).toBeCloseTo(10.5, 2);
    expect(ap.gate).toBeCloseTo(0.616, 6);
    expect(model.areaM2).toBe(250);
  });

  it("cradle point = upstream ≥ 50 %; gate point = gate ≥ 50 % or a stage ≥ 30 %", () => {
    expect(model.points.cradle).toEqual(["gwp", "ap", "ep"]);
    expect(model.points.gate).toContain("gwp"); // Pelapisan utama 38.5 %
    for (const k of model.points.gate) {
      const r = row(k);
      const maxShare = Math.max(...Object.values(r.share).map((v) => v ?? 0));
      expect(r.gatePct! >= 50 || maxShare >= 30).toBe(true);
    }
  });

  it("drivers of the top stage are grouped by source, with device roles for electricity", () => {
    const d = row("gwp").drivers;
    expect(d[0]!.source).toBe("chemical");
    expect(d[0]!.value).toBeCloseTo(375, 6);
    expect(d[1]!.source).toBe("electricity");
    expect(d[1]!.value).toBeCloseTo(337.15, 6);
    expect(d[1]!.roles).toEqual(["rectifier", "heater", "chiller"]);
  });

  it("no cross-category comparison without normalisation factors", () => {
    expect(model.normalization).toBeNull();
  });

  it("data quality: primary vs secondary share of the inventory data", () => {
    const q = model.dataQuality;
    expect(q.count).toBe(50);
    expect(q.primaryCount + q.secondaryCount).toBe(q.count);
    expect(Math.abs(q.primaryPct + q.secondaryPct - 100)).toBeLessThan(1e-9);
  });
});

describe("study text (ID / EN)", () => {
  const project = hardChromeDemo();
  const r = calculate(project);
  const ind = indicatorsOf(r);
  const actions = topActions(project.scenarios.map((s) => evaluateScenario(project, s, ind)));
  const m = buildStudyModel(r.analysis!);
  const ctx = { project, model: m, actions, resultId: "R-TEST", date: "2026-10-10" };
  const id = studyText(ctx, "id");
  const en = studyText(ctx, "en");

  it("title, standards and the fixed grave sentence", () => {
    expect(id.title).toBe("Laporan Kajian Life Cycle Assessment (LCA) Tahun 2026");
    expect(en.title).toBe("Life Cycle Assessment (LCA) Study Report 2026");
    expect(id.standards).toContain("SNI ISO 14040:2016");
    expect(id.standards.some((s) => s.startsWith("IAEG Aerospace LCA Framework v01 (2025)"))).toBe(true);
    expect(id.scope).toContain("Tahap grave (pemakaian dan akhir masa pakai part) berada di luar lingkup kajian ini.");
    expect(id.grave).toBe("Tidak dikaji (di luar lingkup)");
    expect(en.grave).toBe("Not assessed (outside the scope)");
  });

  it("per-category finding for GWP names stage, share, drivers and the technical reason", () => {
    const g = id.findings.find((f) => f.key === "gwp")!.text;
    expect(g).toContain("Global warming potential tertinggi di Pelapisan utama (38,53%)");
    expect(g).toContain("bahan kimia bath (375 kg CO₂ eq)");
    expect(g).toContain("listrik penyearah arus, pemanas, dan chiller (337 kg CO₂ eq)");
    expect(g).toMatch(/sebagian besar arus/);
    const ge = en.findings.find((f) => f.key === "gwp")!.text;
    expect(ge).toContain("Global warming potential is highest in Main plating (38.53%)");
  });

  it("states that categories are not compared without normalisation", () => {
    expect(id.crossCategory).toBe("Perbandingan antar kategori belum dilakukan karena memerlukan normalisasi; peringkat di atas berlaku per kategori.");
  });

  it("not-computed categories are listed with a footnote, not as findings", () => {
    expect(id.findings.map((f) => f.key)).toEqual(["gwp", "ap", "ep"]);
    expect(id.notComputedNote).toMatch(/belum dihitung/i);
    expect(en.notComputedNote).toMatch(/not calculated/i);
  });

  it("three recommendations with Rp saving and impact change", () => {
    expect(id.recommendations).toHaveLength(3);
    expect(id.recommendations[0]).toMatch(/Rp/);
  });

  it("footer has result id, factor profile, date, class and the review sentence; no client names", () => {
    expect(id.footer).toContain("R-TEST");
    expect(id.footer).toContain("Rahasia – Tenant");
    expect(id.footer).toContain("Belum melalui tinjauan kritis pihak ketiga");
    expect(id.footer).toContain("screening_v1@2026-10-11");
    const all = JSON.stringify([id, en]).toLowerCase();
    expect(all).not.toMatch(/inalum|pusri|sriwidjaja/);
  });
});

describe("Excel export", () => {
  it("has the six sheets of §8.3", async () => {
    expect(STUDY_SHEETS).toEqual(["Laporan", "Tabel_Dampak_%", "Nilai_Absolut", "Kesimpulan", "Data_Input", "Faktor"]);
    const project = hardChromeDemo();
    const r = calculate(project);
    const m = buildStudyModel(r.analysis!);
    const blob = await buildStudyWorkbook({ project, model: m, actions: [], resultId: "R-TEST", date: "2026-10-10" }, "both");
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual([...STUDY_SHEETS]);
    const t = wb.getWorksheet("Tabel_Dampak_%")!;
    const values = t.getSheetValues().flat().map(String);
    expect(values).toContain("belum dihitung / not calculated");
  });
});
