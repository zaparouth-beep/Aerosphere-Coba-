import { describe, expect, it } from "vitest";
import fc from "fast-check";
import fixtureJson from "./plating_demo_v1.json";
import { hardChromeDemo } from "@/lib/domain/templates";
import { runAnalysis } from "@/lib/engine";
import { PROPER_INALUM_V1, SCREENING_V1 } from "@/lib/engine/factors";
import { toProjectInput } from "@/lib/engine/inventory";
import type { ProjectInput, StageCode } from "@/lib/engine/types";

/**
 * Golden values from docs/AEROSPHERE_SPEC.md §4.8.2 (profile screening_v1).
 * Do not edit these numbers to make a test pass: a mismatch is an engine bug
 * or a spec question, and must be reported.
 */
const fixture = fixtureJson as unknown as ProjectInput;
const result = runAnalysis(fixture, SCREENING_V1);
const impact = (k: string) => result.impacts.find((i) => i.category === k)!;
const near = (actual: number | null | undefined, expected: number, tol: number) => {
  expect(actual).not.toBeNull();
  expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(tol);
};

describe("golden §4.8.2 — inventory", () => {
  it("totals and per-m² intensities (exact)", () => {
    expect(result.totals.electricityKWh).toBe(965);
    expect(result.perFU.electricityKWh).toBe(3.86);
    expect(result.totals.waterL).toBe(6500);
    expect(result.perFU.waterL).toBe(26);
    expect(result.totals.chemicalKg).toBe(502);
    expect(result.perFU.chemicalKg).toBe(2.008);
    expect(result.totals.wasteB3Kg).toBe(200);
    expect(result.perFU.wasteB3Kg).toBe(0.8);
  });

  it("effluent = 0.90 × water in = 5.85 m³ (§4.4)", () => {
    near(result.totals.effluentM3, 5.85, 1e-9);
  });
});

describe("golden §4.8.2 — global warming (A1)", () => {
  const gwp = impact("gwp");
  it("by source: electricity, chemicals, water", () => {
    near(gwp.bySource.electricity, 591.545, 0.01);
    // "GWP bahan kimia 1.255,0" in §4.8.2 covers all kg inputs (process + WWTP chemicals, anodes, consumables).
    near((gwp.bySource.chemical ?? 0) + (gwp.bySource.wwtp_chemical ?? 0), 1255.0, 0.01);
    near(gwp.bySource.water, 1.95, 0.01);
  });
  it("total 1,848.495 kg → 7.394 kg CO₂e/m²", () => {
    near(gwp.total, 1848.495, 0.01);
    near(gwp.perFU, 7.394, 0.01);
  });
  it("per stage", () => {
    const want: Record<StageCode, number> = { A: 188.55, B: 150.0, C: 712.15, D: 317.85, E: 118.405, F: 361.54 };
    for (const [s, v] of Object.entries(want)) near(gwp.perStage[s as StageCode], v, 0.01);
  });
  it("share per stage (±0.1 pp)", () => {
    const want: Record<StageCode, number> = { C: 38.5, F: 19.6, D: 17.2, A: 10.2, B: 8.1, E: 6.4 };
    for (const [s, v] of Object.entries(want)) near(gwp.share[s as StageCode], v, 0.1);
  });
  it("hotspot: only C (≥ 30%)", () => {
    const h = result.hotspots.find((x) => x.indicator === "gwp")!;
    expect(h.flagged.map((f) => f.stage)).toEqual(["C"]);
  });
});

describe("golden §4.8.2 — acidification & eutrophication", () => {
  it("AP total 10.50 kg SO₂e", () => near(impact("ap").total, 10.5, 0.01));
  it("AP parts: electricity 3.86, process chemicals 4.524, WWTP chemicals 1.5, acid mist 0.616", () => {
    const ap = impact("ap");
    near(ap.bySource.electricity, 3.86, 0.01);
    near(ap.bySource.chemical, 4.524, 0.01);
    near(ap.bySource.wwtp_chemical, 1.5, 0.01);
    near(ap.bySource.direct_air, 0.616, 0.01);
  });
  it("EP total 1.994 kg PO₄e", () => near(impact("ep").total, 1.994, 0.005));
  it("EP parts: electricity 0.4825, chemicals 1.131, WWTP 0.375, COD 0.00515", () => {
    const ep = impact("ep");
    near(ep.bySource.electricity, 0.4825, 0.0005);
    near(ep.bySource.chemical, 1.131, 0.0005);
    near(ep.bySource.wwtp_chemical, 0.375, 0.0005);
    near(ep.bySource.direct_water, 0.00515, 0.0001);
  });
});

describe("golden §4.8.2 — hotspots for water and hazardous waste", () => {
  it("water: A 53.8% and D 46.2%, both flagged", () => {
    const h = result.hotspots.find((x) => x.indicator === "water")!;
    expect(h.flagged.map((f) => f.stage).sort()).toEqual(["A", "D"]);
    near(h.flagged.find((f) => f.stage === "A")!.share, 53.8, 0.1);
    near(h.flagged.find((f) => f.stage === "D")!.share, 46.2, 0.1);
  });
  it("hazardous waste: F 50%", () => {
    const h = result.hotspots.find((x) => x.indicator === "waste_b3")!;
    expect(h.flagged.map((f) => f.stage)).toEqual(["F"]);
    near(h.flagged[0]!.share, 50, 0.1);
  });
  it("drivers: top three components of the flagged stage", () => {
    const h = result.hotspots.find((x) => x.indicator === "gwp")!;
    const drivers = h.flagged[0]!.drivers;
    expect(drivers.length).toBe(3);
    for (let i = 1; i < drivers.length; i += 1) expect(drivers[i - 1]!.value).toBeGreaterThanOrEqual(drivers[i]!.value);
  });
});

describe("golden §4.8.2 — cost and wasted value (A2)", () => {
  it("process cost Rp50,025,000 → Rp200,100/m² (exact)", () => {
    expect(result.totals.costRp).toBe(50_025_000);
    expect(result.perFU.costRp).toBe(200_100);
  });
  it("wasted value Rp22,677,500 (45.3%) with its breakdown (exact)", () => {
    expect(result.waste.totalRp).toBe(22_677_500);
    near(result.waste.pctOfCost, 45.3, 0.05);
    expect(result.waste.items).toEqual({
      processChemicalRp: 15_750_000,
      wwtpChemicalRp: 2_500_000,
      consumableRp: 210_000,
      b3TreatmentRp: 1_600_000,
      b3TransportRp: 2_520_000,
      waterRp: 97_500,
    });
  });
});

describe("engine rules (§4.1, §4.7)", () => {
  it("null factors give not_computed, never 0 (proper_inalum_v1 before the openLCA pipeline)", () => {
    const r = runAnalysis(fixture, PROPER_INALUM_V1);
    for (const i of r.impacts) {
      expect(i.status).toBe("not_computed");
      expect(i.total).toBeNull();
    }
  });
  it("flows without a factor are listed as missing, and the category is partial", () => {
    const gwp = impact("gwp");
    expect(gwp.status).toBe("partial");
    expect(gwp.missing.length).toBeGreaterThan(0);
  });
  it("is pure: same input → same result, input not mutated", () => {
    const copy = structuredClone(fixture);
    const again = runAnalysis(copy, SCREENING_V1);
    expect(again).toEqual(result);
    expect(copy).toEqual(fixture);
  });
  it("every headline number has a trace step with the same value", () => {
    const byId = new Map(result.trace.map((t) => [t.id, t]));
    near(byId.get("impact.gwp.total")?.result.value, impact("gwp").total!, 1e-9);
    near(byId.get("cost.total")?.result.value, result.totals.costRp, 1e-9);
    near(byId.get("waste.total")?.result.value, result.waste.totalRp, 1e-9);
    near(byId.get("water.effluent")?.result.value, result.totals.effluentM3, 1e-9);
  });
  it("screening factors cap data confidence at medium", () => {
    expect(result.dataConfidence).toBe("medium");
  });
  it("measured effluent larger than water in → WATER_BALANCE warning and low confidence", () => {
    const r = runAnalysis({ ...fixture, effluentMeasuredM3: 10 }, SCREENING_V1);
    expect(r.warnings.map((w) => w.code)).toContain("WATER_BALANCE");
    expect(r.dataConfidence).toBe("low");
    expect(r.totals.effluentM3).toBe(10);
  });
  it("soft-deleted components are ignored", () => {
    const comps = fixture.components.map((c) => (c.id === "c01" ? { ...c, deletedAt: "2026-10-10T00:00:00Z" } : c));
    const r = runAnalysis({ ...fixture, components: comps }, SCREENING_V1);
    expect(r.totals.chemicalKg).toBe(472);
  });
});

describe("property: shares sum to 100% (§11)", () => {
  it("for any non-negative quantities, every computed category's shares sum to 100 ± 0.01", () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: 0, max: 5000, noNaN: true }), { minLength: fixture.components.length, maxLength: fixture.components.length }), (qs) => {
        const comps = fixture.components.map((c, i) => (c.category === "effluent_param" ? c : { ...c, quantity: qs[i]! }));
        const r = runAnalysis({ ...fixture, components: comps }, SCREENING_V1);
        for (const imp of r.impacts) {
          if (imp.total === null || imp.total <= 0) continue;
          const sum = Object.values(imp.share).reduce<number>((a, v) => a + (v ?? 0), 0);
          expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.01);
        }
      }),
      { numRuns: 60 },
    );
  });
});

describe("app demo project through the adapter matches the golden fixture", () => {
  const demo = runAnalysis(toProjectInput(hardChromeDemo()), SCREENING_V1);
  it("same GWP total, cost, and wasted value", () => {
    near(demo.impacts.find((i) => i.category === "gwp")!.total, 1848.495, 0.01);
    expect(demo.totals.costRp).toBe(50_025_000);
    expect(demo.waste.totalRp).toBe(22_677_500);
  });
  it("same per-stage GWP and AP/EP totals", () => {
    const g = demo.impacts.find((i) => i.category === "gwp")!;
    near(g.perStage.C, 712.15, 0.01);
    near(g.perStage.F, 361.54, 0.01);
    near(demo.impacts.find((i) => i.category === "ap")!.total, 10.5, 0.01);
    near(demo.impacts.find((i) => i.category === "ep")!.total, 1.994, 0.005);
  });
});
