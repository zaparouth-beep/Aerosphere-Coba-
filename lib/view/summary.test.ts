import { describe, expect, it } from "vitest";
import { hardChromeDemo } from "@/lib/domain/templates";
import { calculate, indicatorsOf } from "@/lib/engine/calculate";
import { evaluateScenario } from "@/lib/engine/scenario";
import { conclusion, headlines, overallConfidence, plainStage, topActions, worstStage } from "./summary";

describe("Mode Ringkas summary (PRD v1.1 §3.5)", () => {
  const project = hardChromeDemo();
  const results = calculate(project);
  const ind = indicatorsOf(results);
  const outcomes = project.scenarios.map((s) => evaluateScenario(project, s, ind));

  it("four headline numbers per m², taken from the engine", () => {
    const h = headlines(ind, results.lci.referenceFlow, "m²", null);
    expect(h.map((x) => x.key)).toEqual(["cc", "water", "waste", "cost"]);
    expect(h[1]!.value).toBeCloseTo(ind.waterL / 250, 6);
    expect(h.every((x) => x.changePct === null)).toBe(true);
  });

  it("change vs comparison drives the worst indicator", () => {
    const prev = { indicators: { ...ind, wasteKg: ind.wasteKg / 2 }, ref: results.lci.referenceFlow };
    const h = headlines(ind, results.lci.referenceFlow, "m²", prev);
    expect(h.find((x) => x.key === "waste")!.changePct).toBeCloseTo(100, 6);
    expect(worstStage(project, results, h)!.key).toBe("waste");
  });

  it("uses everyday stage names, not codes", () => {
    expect(plainStage(project, "F")).toBe("Pengolahan air limbah");
    expect(plainStage({ ...project, stages: project.stages.map((s) => (s.id === "F" ? { ...s, name: "WWTP Lini 2" } : s)) }, "F")).toBe("WWTP Lini 2");
  });

  it("top actions are sorted by yearly saving, at most three", () => {
    const a = topActions(outcomes);
    expect(a.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < a.length; i += 1) expect(a[i - 1]!.savingRpYear).toBeGreaterThanOrEqual(a[i]!.savingRpYear);
  });

  it("conclusion has three sentences of at most 20 words", () => {
    const heads = headlines(ind, results.lci.referenceFlow, "m²", null);
    const s = conclusion(results, worstStage(project, results, heads), topActions(outcomes), (v) => `Rp${Math.round(v)}`, (v) => `${Math.round(v)}%`);
    expect(s).toHaveLength(3);
    for (const line of s) expect(line.split(/\s+/).length).toBeLessThanOrEqual(20);
  });

  it("confidence comes with an honest sentence", () => {
    const c = overallConfidence(project);
    expect(["High", "Medium", "Low"]).toContain(c.level);
    expect(c.sentence.length).toBeGreaterThan(20);
  });
});
