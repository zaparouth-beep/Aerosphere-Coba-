import { describe, expect, it } from "vitest";
import fixtureJson from "../golden/plating_demo_v1.json";
import { hardChromeDemo } from "@/lib/domain/templates";
import { runAnalysis } from "@/lib/engine";
import { calculate } from "@/lib/engine/calculate";
import { SCREENING_V1 } from "@/lib/engine/factors";
import { toProjectInput } from "@/lib/engine/inventory";
import { buildTitikBoros, severityOf, type Severity } from "@/lib/engine/titikBoros";
import type { ProjectInput, StageCode } from "@/lib/engine/types";

/**
 * Titik Boros (prompt "Kerjakan ulang halaman Titik Boros", replaces spec §5.3).
 * Test values on fixture plating_demo_v1 with screening_v1 — do not edit to pass.
 */
const fixture = fixtureJson as unknown as ProjectInput;
const model = buildTitikBoros(runAnalysis(fixture, SCREENING_V1), { thresholdPct: 30 });
const row = (k: string) => model.rows.find((r) => r.key === k)!;
const pct = (k: string, s: StageCode) => Math.round((row(k).share[s] ?? 0) * 10) / 10;
const cls = (k: string, s: StageCode) => row(k).severity[s];

describe("severity classes", () => {
  it("red ≥ threshold, orange 20–<threshold, yellow 10–<20, green >0–<10, grey 0 or not calculated", () => {
    expect(severityOf(30, 30)).toBe("red");
    expect(severityOf(29.99, 30)).toBe("orange");
    expect(severityOf(20, 30)).toBe("orange");
    expect(severityOf(19.99, 30)).toBe("yellow");
    expect(severityOf(10, 30)).toBe("yellow");
    expect(severityOf(9.99, 30)).toBe("green");
    expect(severityOf(0.01, 30)).toBe("green");
    expect(severityOf(0, 30)).toBe("grey");
    expect(severityOf(null, 30)).toBe("grey");
  });

  it("threshold comes from the project setting, not a constant", () => {
    expect(severityOf(26, 25)).toBe("red");
    const m = buildTitikBoros(runAnalysis(fixture, SCREENING_V1), { thresholdPct: 40 });
    expect(m.thresholdPct).toBe(40);
    expect(m.rows.find((r) => r.key === "gwp")!.severity.C).toBe("orange"); // 38.5 % < 40 %
  });
});

describe("rows (same order and groups in chart and table)", () => {
  it("impact rows with factors first, then use & waste", () => {
    expect(model.rows.map((r) => r.key)).toEqual(["gwp", "ap", "ep", "adp_fossil", "water", "waste_b3", "waste_value"]);
    expect(model.rows.filter((r) => r.group === "impact").map((r) => r.key)).toEqual(["gwp", "ap", "ep", "adp_fossil"]);
    expect(model.notComputedCount).toBe(12);
  });

  it("carbon: A 10.2 Kuning · B 8.1 Hijau · C 38.5 Merah · D 17.2 Kuning · E 6.4 Hijau · F 19.6 Kuning", () => {
    const want: Array<[StageCode, number, Severity]> = [
      ["A", 10.2, "yellow"],
      ["B", 8.1, "green"],
      ["C", 38.5, "red"],
      ["D", 17.2, "yellow"],
      ["E", 6.4, "green"],
      ["F", 19.6, "yellow"],
    ];
    for (const [s, p, c] of want) {
      expect(pct("gwp", s)).toBe(p);
      expect(cls("gwp", s)).toBe(c);
    }
    expect(row("gwp").totalPerFU).toBeCloseTo(7.394, 3);
  });

  it("water: A 53.8 Merah · D 46.2 Merah · B, C, E, F Abu-abu", () => {
    expect(pct("water", "A")).toBe(53.8);
    expect(pct("water", "D")).toBe(46.2);
    expect(cls("water", "A")).toBe("red");
    expect(cls("water", "D")).toBe("red");
    for (const s of ["B", "C", "E", "F"] as StageCode[]) expect(cls("water", s)).toBe("grey");
  });

  it("B3 waste: F 50 Merah · C 15 Kuning · D 12 Kuning · A 10 Kuning · B 8 Hijau · E 5 Hijau", () => {
    const want: Array<[StageCode, number, Severity]> = [
      ["F", 50, "red"],
      ["C", 15, "yellow"],
      ["D", 12, "yellow"],
      ["A", 10, "yellow"],
      ["B", 8, "green"],
      ["E", 5, "green"],
    ];
    for (const [s, p, c] of want) {
      expect(pct("waste_b3", s)).toBe(p);
      expect(cls("waste_b3", s)).toBe(c);
    }
  });

  it("every row of percentages adds up to 100 % (±0.1)", () => {
    for (const r of model.rows) {
      const sum = Object.values(r.share).reduce<number>((s, v) => s + (v ?? 0), 0);
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.1);
    }
  });

  it("top stage per row is the largest share", () => {
    expect(row("gwp").topStage).toBe("C");
    expect(row("water").topStage).toBe("A");
    expect(row("waste_b3").topStage).toBe("F");
  });

  it("carbon drivers in Pelapisan utama: chemicals 375, electricity 337.15 kg CO₂e per period", () => {
    const d = row("gwp").drivers.C;
    expect(d[0]!.kind).toBe("chemical");
    expect(d[0]!.value).toBeCloseTo(375, 6);
    expect(d[1]!.kind).toBe("electricity");
    expect(d[1]!.value).toBeCloseTo(337.15, 6);
  });
});

describe("stage boxes", () => {
  it("first box is red; C, F, A and D are all red in at least one indicator", () => {
    expect(model.stages[0]!.status).toBe("red");
    for (const s of ["C", "F", "A", "D"] as StageCode[]) {
      const box = model.stages.find((b) => b.stage === s)!;
      expect(box.status).toBe("red");
      expect(box.hot.some((h) => h.severity === "red")).toBe(true);
    }
  });

  it("boxes are sorted by status, then number of indicators in that class, then mean share", () => {
    const rank: Record<Severity, number> = { red: 0, orange: 1, yellow: 2, green: 3, grey: 4 };
    for (let i = 1; i < model.stages.length; i++) {
      const a = model.stages[i - 1]!;
      const b = model.stages[i]!;
      const key = (x: typeof a) => [rank[x.status], -x.statusCount, -x.meanShare];
      const [ka, kb] = [key(a), key(b)];
      const cmp = ka[0]! - kb[0]! || ka[1]! - kb[1]! || ka[2]! - kb[2]!;
      expect(cmp).toBeLessThanOrEqual(0);
    }
    expect(model.stages[0]!.stage).toBe("C");
  });

  it("main indicator of a box is the first row where the stage reaches its status", () => {
    expect(model.stages.find((b) => b.stage === "C")!.mainIndicator).toBe("gwp");
    expect(model.stages.find((b) => b.stage === "A")!.mainIndicator).toBe("water");
    expect(model.stages.find((b) => b.stage === "F")!.mainIndicator).toBe("waste_b3");
  });

  it("summary sentence numbers: biggest stage and red count out of the shown indicators", () => {
    expect(model.summary.stage).toBe("C");
    expect(model.summary.indicatorCount).toBe(7);
    expect(model.summary.redCount).toBe(model.rows.filter((r) => r.severity.C === "red").length);
  });
});

describe("app run (demo project)", () => {
  it("uses the threshold stored on the project", () => {
    const p = hardChromeDemo();
    p.hotspotThresholdPct = 35;
    expect(toProjectInput(p).hotspotThresholdPct).toBe(35);
    const r = calculate(p);
    const m = buildTitikBoros(r.analysis!, { thresholdPct: p.hotspotThresholdPct });
    expect(m.thresholdPct).toBe(35);
  });
});
