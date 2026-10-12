import { describe, expect, it } from "vitest";
import { hardChromeDemo } from "@/lib/domain/templates";
import type { LeverSettings, Project } from "@/lib/domain/types";
import { calculate, indicatorsOf } from "@/lib/engine/calculate";
import { evaluateScenario } from "@/lib/engine/scenario";

/** Simulasi Perbaikan responds to the data and to every lever, whatever the component names. */

const run = (p: Project, levers: LeverSettings) => {
  const ind = indicatorsOf(calculate(p));
  return evaluateScenario(p, { ...p.scenarios[0]!, levers }, ind);
};

describe("simulations follow the data", () => {
  it("more electricity on the rectifier gives a larger saving from a better rectifier", () => {
    const p = hardChromeDemo();
    const before = run(p, { rectifier: { etaOld: 75, etaNew: 88 } }).lcc.annualSavingRp;
    for (const i of p.inputs) if (/rectifier/i.test(i.name)) i.quantity *= 3;
    const after = run(p, { rectifier: { etaOld: 75, etaNew: 88 } }).lcc.annualSavingRp;
    expect(after).toBeCloseTo(before * 3, 0);
  });

  it("Indonesian component names are recognised (penyearah, pemanas, kabut)", () => {
    const p = hardChromeDemo();
    for (const i of p.inputs) {
      if (/rectifier/i.test(i.name)) i.name = "Listrik penyearah arus";
      if (/heater/i.test(i.name)) i.name = "Pemanas bath";
    }
    for (const a of p.airEmissions) if (/Cr\(VI\) mist/.test(a.parameter)) a.parameter = "Kabut krom";
    expect(run(p, { rectifier: { etaOld: 75, etaNew: 88 } }).delta.energyKwh.pct).toBeLessThan(-1);
    expect(run(p, { tankCover: { heatReductionPct: 20, mistReductionPct: 30 } }).delta.energyKwh.pct).toBeLessThan(-1);
    expect(run(p, { mistSuppressant: { reductionPct: 50 } }).delta.airKg.pct).toBeLessThan(-1);
  });

  it("mist and effluent improvements show in their own indicators", () => {
    const p = hardChromeDemo();
    expect(run(p, { mistSuppressant: { reductionPct: 50 } }).delta.airKg.abs).toBeLessThan(0);
    const eff = run(p, { effluentTarget: { parameter: "Ni", newValue: 0.064, flocculantIncreasePct: 10 } });
    expect(eff.delta.effluentMetalKg.abs).toBeLessThan(0);
  });

  it("a lever with nothing to act on says so instead of silently showing no change", () => {
    const p = hardChromeDemo();
    p.inputs = p.inputs.filter((i) => !/rectifier/i.test(i.name));
    const o = run(p, { rectifier: { etaOld: 75, etaNew: 88 } });
    expect(o.delta.energyKwh.pct).toBe(0);
    expect(o.assumptions.join(" ")).toMatch(/^.*Tidak ada listrik penyearah arus/);
  });
});
