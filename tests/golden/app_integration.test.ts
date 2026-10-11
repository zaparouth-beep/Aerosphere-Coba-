import { describe, expect, it } from "vitest";
import { hardChromeDemo } from "@/lib/domain/templates";
import { calculate, indicatorsOf } from "@/lib/engine/calculate";
import { conclusion, headlines, topActions, worstStage } from "@/lib/view/summary";
import { evaluateScenario } from "@/lib/engine/scenario";

/** A1/A2 must be fixed everywhere the app shows the numbers, not only in runAnalysis. */
describe("app uses the new engine (A1, A2)", () => {
  const project = hardChromeDemo();
  const r = calculate(project);
  const ind = indicatorsOf(r);

  it("headline carbon is 7.394 kg CO₂e/m², not electricity only", () => {
    expect(Math.abs(ind.ccKg - 1848.495)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(ind.perFu.cc - 7.394)).toBeLessThanOrEqual(0.01);
  });

  it("Mode Ahli climate change (EF 3.1 view) agrees with the screening total", () => {
    expect(Math.abs(r.lcia.totals.cc - 1848.495)).toBeLessThanOrEqual(0.01);
  });

  it("wasted value is Rp22,677,500 and the conclusion says 45%, not 97%", () => {
    expect(ind.wasteValueRp).toBe(22_677_500);
    const heads = headlines(ind, r.lci.referenceFlow, "m²", null);
    const outcomes = project.scenarios.map((s) => evaluateScenario(project, s, ind));
    const text = conclusion(r, worstStage(project, r, heads), topActions(outcomes), (v) => `Rp${Math.round(v)}`, (v) => `${Math.round(v)}%`).join(" ");
    expect(text).toContain("45%");
    expect(text).not.toContain("97%");
  });

  it("carbon headline card shows 7.394 kg CO₂e per m²", () => {
    const heads = headlines(ind, r.lci.referenceFlow, "m²", null);
    const carbon = heads.find((h) => h.key === "cc")!;
    expect(carbon.value).toBeCloseTo(7.394, 2);
  });

  it("reducing drag-out now lowers carbon (it was 0.00% before A1)", () => {
    const s1 = evaluateScenario(project, project.scenarios[0]!, ind);
    expect(s1.delta.ccKg.pct).toBeLessThan(0);
  });

  it("a cleaner grid factor lowers the headline carbon (lever S8 still works)", () => {
    const out = evaluateScenario(project, { id: "g", code: "S8", name: "", description: "", levers: { gridFactor: { kgCO2ePerKwh: 0.3 } }, capexRp: 0, extraOpexRpPerPeriod: 0, lifetimeYears: 5, status: "draft" }, ind);
    expect(out.indicators.ccKg).toBeCloseTo(1848.495 - 965 * (0.613 - 0.3), 6);
    expect(out.results.analysis!.factorVersion).toContain("+grid=0.3");
  });
});
