import { describe, expect, it } from "vitest";
import fixtureJson from "../golden/plating_demo_v1.json";
import { hardChromeDemo } from "@/lib/domain/templates";
import { runAnalysis } from "@/lib/engine";
import { calculate, indicatorsOf } from "@/lib/engine/calculate";
import { SCREENING_V1 } from "@/lib/engine/factors";
import { buildFlow, compareFlows, lifeCycleSplit } from "@/lib/engine/flow";
import { evaluateScenario } from "@/lib/engine/scenario";
import type { ProjectInput } from "@/lib/engine/types";

/**
 * Flow diagrams (Hasil, Titik Boros, Simulasi): inputs → stages → line, with
 * drill-in. Values must equal the engine's per-stage results (golden §4.8.2).
 */
const run = runAnalysis(fixtureJson as unknown as ProjectInput, SCREENING_V1);
const linkValue = (f: ReturnType<typeof buildFlow>, s: string, t: string) => f.links.find((l) => l.source === s && l.target === t)?.value;

describe("root flow (sources → stages → line)", () => {
  const f = buildFlow(run, "gwp");

  it("three columns: sources, stages A–F, line total", () => {
    expect(new Set(f.nodes.map((n) => n.column))).toEqual(new Set([0, 1, 2]));
    expect(f.nodes.filter((n) => n.column === 1).map((n) => n.id)).toEqual(["stage:A", "stage:B", "stage:C", "stage:D", "stage:E", "stage:F"]);
    expect(f.nodes.find((n) => n.column === 2)!.id).toBe("total");
  });

  it("carbon into Pelapisan utama: chemicals 375, electricity 337.15 kg CO₂e", () => {
    expect(linkValue(f, "kind:chemical", "stage:C")).toBeCloseTo(375, 6);
    expect(linkValue(f, "kind:electricity", "stage:C")).toBeCloseTo(337.15, 6);
  });

  it("flows are conserved: stage in = stage out, line total = 1,848.495 kg CO₂e (7.394 per m²)", () => {
    for (const s of ["A", "B", "C", "D", "E", "F"]) {
      const inflow = f.links.filter((l) => l.target === `stage:${s}`).reduce((a, l) => a + l.value, 0);
      expect(inflow).toBeCloseTo(linkValue(f, `stage:${s}`, "total") ?? 0, 9);
    }
    expect(f.total).toBeCloseTo(1848.495, 6);
    expect(f.totalPerFU).toBeCloseTo(7.394, 3);
    expect(linkValue(f, "stage:C", "total")).toBeCloseTo(712.15, 6);
  });

  it("stage nodes carry the severity class of Titik Boros", () => {
    expect(f.nodes.find((n) => n.id === "stage:C")!.severity).toBe("red");
    expect(f.nodes.find((n) => n.id === "stage:B")!.severity).toBe("green");
  });

  it("water: process water to Pembersihan awal 3,500 L and Perlakuan akhir 3,000 L", () => {
    const w = buildFlow(run, "water");
    expect(w.total).toBe(6500);
    expect(linkValue(w, "stage:A", "total")).toBe(3500);
    expect(linkValue(w, "stage:D", "total")).toBe(3000);
    expect(w.nodes.some((n) => n.id === "stage:B")).toBe(false); // no water in B → not drawn
  });

  it("wasted value adds up to Rp22,677,500", () => {
    expect(buildFlow(run, "waste_value").total).toBeCloseTo(22_677_500, 6);
  });
});

describe("drill in", () => {
  it("a stage shows its components; their sum is the stage value", () => {
    const f = buildFlow(run, "gwp", { stage: "C" });
    expect(f.focus).toEqual({ stage: "C" });
    const comps = f.links.filter((l) => l.target === "stage:C");
    expect(comps.length).toBeGreaterThan(2);
    expect(comps.reduce((a, l) => a + l.value, 0)).toBeCloseTo(712.15, 6);
    expect(f.nodes.every((n) => n.column <= 1)).toBe(true);
  });

  it("a source shows where it is used per stage", () => {
    const f = buildFlow(run, "gwp", { kind: "electricity" });
    expect(f.links.reduce((a, l) => a + l.value, 0)).toBeCloseTo(591.545, 6);
  });
});

describe("before / after a simulation", () => {
  it("reducing drag-out lowers chemicals into Pelapisan utama", () => {
    const project = hardChromeDemo();
    const r = calculate(project);
    const out = evaluateScenario(project, project.scenarios[0]!, indicatorsOf(r));
    const cmp = compareFlows(buildFlow(r.analysis!, "gwp"), buildFlow(out.results.analysis!, "gwp"));
    const link = cmp.find((l) => l.source === "kind:chemical" && l.target === "stage:C")!;
    expect(link.after).toBeLessThan(link.before);
    expect(link.deltaPct).toBeLessThan(0);
    const total = cmp.find((l) => l.source === "total")!;
    expect(total.after).toBeLessThan(total.before);
  });
});

describe("life cycle split", () => {
  it("carbon is 100 % upstream (purchased materials and electricity), grave not assessed", () => {
    const rows = lifeCycleSplit(run);
    const g = rows.find((x) => x.key === "gwp")!;
    expect(g.upstreamPct).toBeCloseTo(100, 6);
    expect(g.linePct).toBeCloseTo(0, 6);
    const ap = rows.find((x) => x.key === "ap")!;
    expect(ap.upstreamPct + ap.linePct).toBeCloseTo(100, 6);
    expect(ap.linePct).toBeCloseTo((0.616 / 10.5) * 100, 1);
  });
});
