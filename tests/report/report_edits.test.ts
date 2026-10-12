import { describe, expect, it } from "vitest";
import { hardChromeDemo } from "@/lib/domain/templates";
import type { LeverId } from "@/lib/domain/types";
import { calculate, indicatorsOf } from "@/lib/engine/calculate";
import { buildStudyModel } from "@/lib/engine/study";
import { evaluateScenario } from "@/lib/engine/scenario";
import { buildStudyWorkbook } from "@/lib/io/studyExport";
import { buildDirections, candidateOutcomes, leverSteps, placeholderData } from "@/lib/report/directions";
import { editState, foreignNumbers, numbersIn, resolveText } from "@/lib/report/edits";
import { editDirections, studyText } from "@/lib/report/lcaStudy";
import type { ReportDocEdits } from "@/lib/store/useAppStore";

/** Report directions (work plans) and user edits of report text. */

const project = hardChromeDemo();
const results = calculate(project);
const ind = indicatorsOf(results);
const outcomes = project.scenarios.map((s) => evaluateScenario(project, s, ind));

describe("improvement directions", () => {
  const id = buildDirections(project, results, outcomes, "id");
  const en = buildDirections(project, results, outcomes, "en");

  it("directions follow the engine's ranking of every improvement on this data", () => {
    const ranked = candidateOutcomes(project, results, outcomes).slice(0, 3);
    expect(id.slice(0, ranked.length).map((d) => d.id)).toEqual(ranked.map((c) => c.outcome.scenario.id));
    expect(en.map((d) => d.id)).toEqual(id.map((d) => d.id));
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1]!.score).toBeGreaterThanOrEqual(ranked[i]!.score);
  });

  it("each plan has why, numbered steps, owner, target, measure, timing and the engine basis", () => {
    for (const d of id) {
      expect(d.why.length).toBeGreaterThan(20);
      expect(d.steps.length).toBeGreaterThanOrEqual(3);
      expect(d.owner).not.toBe("");
      expect(d.measure).not.toBe("");
      expect(d.schedule).not.toBe("");
      expect(JSON.stringify(d)).not.toMatch(/NaN|undefined/);
    }
    for (const d of id.filter((x) => !["data", "data-check"].includes(x.id) && !x.id.startsWith("hotspot-"))) expect(d.basis.length).toBeGreaterThan(0);
  });

  it("the yearly saving in the target is the engine's", () => {
    const c = candidateOutcomes(project, results, outcomes)[0]!;
    const d = id.find((x) => x.id === c.outcome.scenario.id)!;
    expect(d.target).toContain(`Rp${new Intl.NumberFormat("id-ID").format(Math.round(c.outcome.lcc.annualSavingRp))}`);
  });

  it("the reasons quote the line's own components", () => {
    const drag = id.find((d) => d.steps.some((s) => /talang tiris/.test(s)))!;
    expect(drag.why).toMatch(/Chromate\/passivation \(90 kg\)/);
  });

  it("different data gives different directions", () => {
    const dummy = hardChromeDemo();
    for (const i of dummy.inputs) i.quantity = 1;
    expect(placeholderData(dummy)).toEqual({ value: 1, count: dummy.inputs.length, total: dummy.inputs.length });
    const rd = calculate(dummy);
    const od = dummy.scenarios.map((s) => evaluateScenario(dummy, s, indicatorsOf(rd)));
    const dd = buildDirections(dummy, rd, od, "id");
    expect(dd[0]!.id).toBe("data-check");
    expect(dd.map((d) => d.why).join(" ")).not.toEqual(id.map((d) => d.why).join(" "));

    // No rectifier and no chemicals in B–D: those improvements are not suggested.
    const lean = hardChromeDemo();
    lean.inputs = lean.inputs.filter((i) => !/rectifier/i.test(i.name) && !(i.category === "Chemical" && ["B", "C", "D"].includes(i.stageId)));
    lean.scenarios = [];
    const rl = calculate(lean);
    const dl = buildDirections(lean, rl, [], "id", 8);
    expect(dl.map((d) => d.id)).not.toContain("auto-rectifier");
    expect(dl.map((d) => d.id)).not.toContain("auto-dragout");
    expect(dl.some((d) => d.id.startsWith("auto-"))).toBe(true);
  });

  it("every lever has written steps in both languages", () => {
    const levers: Array<[LeverId, object]> = [
      ["dragout", { reductionPct: 20 }],
      ["bathConcentration", { cOld: 250, cNew: 200 }],
      ["countercurrent", { stagesOld: 1, stagesNew: 3, ratio: 1 }],
      ["rectifier", { etaOld: 60, etaNew: 90 }],
      ["tankCover", { heatReductionPct: 30, mistReductionPct: 50 }],
      ["mistSuppressant", { reductionPct: 60 }],
      ["effluentTarget", { parameter: "Ni", newValue: 0.5, flocculantIncreasePct: 10 }],
      ["gridFactor", { kgCO2ePerKwh: 0.1 }],
    ];
    for (const [lever, settings] of levers) {
      for (const l of ["id", "en"] as const) {
        const steps = leverSteps(lever, { [lever]: settings }, l, project);
        expect(steps.length, `${lever} ${l}`).toBeGreaterThanOrEqual(4);
        expect(JSON.stringify(steps), `${lever} ${l}`).not.toMatch(/NaN|undefined/);
      }
    }
  });
});

describe("editing report text", () => {
  it("reads numbers as written", () => {
    expect(numbersIn("Hemat Rp3.180.000 per tahun; jejak karbon −11,2% (S1)")).toEqual(["3.180.000", "11,2", "1"]);
  });

  it("words may change freely; a number not in the engine text is flagged", () => {
    const base = "Tahap Plating menyumbang 57% dari listrik lini.";
    expect(foreignNumbers("Plating adalah sumber terbesar (57%).", base)).toEqual([]);
    expect(foreignNumbers("Plating menyumbang 75% dari listrik.", base)).toEqual(["75"]);
  });

  it("an edit applies only while the engine text is unchanged", () => {
    const doc: ReportDocEdits = { blocks: { a: { text: "Teks baru 57%", base: "Teks lama 57%", at: "" } }, hidden: [] };
    expect(editState(doc, "a", "Teks lama 57%")).toBe("edited");
    expect(resolveText(doc, "a", "Teks lama 57%")).toBe("Teks baru 57%");
    expect(editState(doc, "a", "Teks lama 60%")).toBe("stale");
    expect(resolveText(doc, "a", "Teks lama 60%")).toBe("Teks lama 60%");
    const bad: ReportDocEdits = { blocks: { a: { text: "Teks 99%", base: "Teks 57%", at: "" } }, hidden: [] };
    expect(editState(bad, "a", "Teks 57%")).toBe("invalid");
  });

  it("the Excel study report carries edited text and leaves out hidden directions", async () => {
    const model = buildStudyModel(results.analysis!);
    const dirs = buildDirections(project, results, outcomes, "id");
    const ctx = { project, model, actions: [], resultId: "R-TEST", date: "2026-10-10", directions: { id: dirs } };
    const original = studyText(ctx, "id").objective;
    const first = dirs[0]!;
    const edits = {
      text: (id: string, o: string) => (id === "id:objective" && o === original ? "Tujuan yang ditulis ulang oleh tim." : id === "id:authorNote" ? "Disusun bersama tim produksi." : o),
      hidden: (id: string) => id === `dir:${first.id}`,
    };
    expect(editDirections(dirs, "id", edits.text, edits.hidden).map((d) => d.id)).not.toContain(first.id);
    const blob = await buildStudyWorkbook(ctx, "id", edits);
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const all = [...wb.getWorksheet("Laporan")!.getSheetValues(), ...wb.getWorksheet("Kesimpulan")!.getSheetValues()].flat().map(String);
    expect(all).toContain("Tujuan yang ditulis ulang oleh tim.");
    expect(all).toContain("Disusun bersama tim produksi.");
    expect(all).not.toContain(first.title);
    if (dirs[1]) expect(all).toContain(dirs[1].title);
  });
});
