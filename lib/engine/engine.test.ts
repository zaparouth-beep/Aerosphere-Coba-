import { describe, expect, it } from "vitest";
import { hardChromeDemo, niWattsTemplate } from "@/lib/domain/templates";
import { calculate, indicatorsOf } from "./calculate";
import { buildInsights, GuardrailError, parseWhatIf, render } from "./copilot";
import { sha256Hex } from "./hash";
import { appendEvent, createRun, rerunCheck, verifyChain } from "./run";
import { applyScenario, evaluateScenario, sensitivity } from "./scenario";
import { toCanonical } from "./units";

const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe("hash", () => {
  it("matches SHA-256 test vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("a".repeat(1000))).toBe("41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  });
});

describe("LCI (AC-01)", () => {
  it("demo intensities match the PRD dataset", () => {
    const r = calculate(hardChromeDemo());
    close(r.lci.totals.energyKwh, 965);
    close(r.lci.intensity.energy, 3.86);
    close(r.lci.intensity.water, 26);
    close(r.lci.intensity.chemical, 502 / 250);
    close(r.lci.intensity.waste, 0.8);
  });

  it("converts units and basis to the reporting period", () => {
    const p = hardChromeDemo();
    const rect = p.inputs.find((i) => i.name === "Rectifier electricity")!;
    rect.quantity = 25;
    rect.basis = "month";
    rect.unit = "kWh";
    expect(calculate(p).lci.flows.find((f) => f.id === rect.id)!.quantity).toBe(300);
    rect.unit = "MWh";
    rect.quantity = 0.3;
    rect.basis = "period";
    close(calculate(p).lci.flows.find((f) => f.id === rect.id)!.quantity, 300);
  });

  it("requires a compressor factor for Nm³ (FR-03.3)", () => {
    expect(toCanonical(10, "Nm3", "Energy", {}).ok).toBe(false);
    const ok = toCanonical(10, "Nm3", "Energy", { compressorKwhPerNm3: 0.12 });
    expect(ok.ok && ok.value).toBeCloseTo(1.2);
    expect(toCanonical(1, "kg", "Energy", {}).ok).toBe(false);
  });
});

describe("validation", () => {
  it("flags the 100 m³ vs 6,5 m³ water balance (AC-02) and blocks approval", () => {
    const p = hardChromeDemo();
    p.production.effluentVolumeM3 = 100;
    p.production.waterEvaporatedM3 = 0;
    const v = calculate(p).validation;
    expect(v.issues.some((i) => i.code === "WATER_BALANCE")).toBe(true);
    expect(v.readyForApproval).toBe(false);
    const accepted = Object.fromEntries(v.issues.filter((i) => i.severity === "warning").map((i) => [i.key, "diterima untuk uji"]));
    p.dataset.acceptedWarnings = accepted;
    expect(calculate(p).validation.readyForApproval).toBe(true);
  });

  it("demo dataset closes the water balance", () => {
    const v = calculate(hardChromeDemo()).validation;
    expect(v.issues.some((i) => i.code === "WATER_BALANCE")).toBe(false);
    expect(v.errors).toBe(0);
  });

  it("blocks negative values and FU = 0", () => {
    const p = hardChromeDemo();
    p.inputs[0]!.quantity = -1;
    p.production.areaM2 = 0;
    const codes = calculate(p).validation.issues.filter((i) => i.severity === "error").map((i) => i.code);
    expect(codes).toContain("NEGATIVE_VALUE");
    expect(codes).toContain("FU_ZERO");
  });

  it("checks the Ni metal balance and benchmark for the Takuma template", () => {
    const r = calculate(niWattsTemplate());
    close(r.lci.coatingMassKg / 250, 1.3362, 1e-3);
    expect(r.validation.metal!.closurePct).toBeGreaterThan(90);
    expect(r.validation.issues.some((i) => i.code === "BENCHMARK_ENERGY")).toBe(false);
    expect(r.lcia.uncharacterised.some((u) => u.startsWith("Boron"))).toBe(true);
  });
});

describe("LCIA", () => {
  it("climate change counts electricity, chemicals and water (A1, golden §4.8.2)", () => {
    const r = calculate(hardChromeDemo());
    close(r.lcia.totals.cc, 1848.495, 1e-6);
    close(r.lcia.ghgScopes.scope2, 965 * 0.613, 1e-9);
    expect(r.lcia.unmapped.length).toBe(0);
  });

  it("gate-to-gate excludes background", () => {
    const p = hardChromeDemo();
    p.scope.boundary = "gate-to-gate";
    expect(calculate(p).lcia.totals.cc).toBe(0);
  });
});

describe("MFCA", () => {
  it("demo total cost is Rp50.025.000 and Rp200.100 per m²", () => {
    const r = calculate(hardChromeDemo());
    close(r.mfca.totalCostRp, 50_025_000, 1e-3);
    close(r.mfca.costPerFu, 200_100, 1e-3);
    close(r.mfca.positiveCostRp + r.mfca.costLossRp, r.mfca.totalCostRp, 1e-3);
    close(r.mfca.positiveKg + r.mfca.materialLossKg, r.mfca.materialInKg, 1e-9);
  });
});

describe("scenarios", () => {
  it("drag-out 20% only changes the documented flows (AC-06)", () => {
    const p = hardChromeDemo();
    const { project: s } = applyScenario(p, { dragout: { reductionPct: 20 } });
    p.inputs.forEach((orig, idx) => {
      const next = s.inputs[idx]!;
      const shouldChange = (orig.category === "Chemical" && ["B", "C", "D"].includes(orig.stageId)) || orig.category === "WWTPChemical";
      if (shouldChange && orig.quantity > 0) close(next.quantity, orig.quantity * 0.8);
      else expect(next.quantity).toBe(orig.quantity);
    });
    p.waste.forEach((w, idx) => expect(s.waste[idx]!.quantityKg).toBe(w.stageId === "F" ? w.quantityKg * 0.8 : w.quantityKg));
    expect(s.production.effluentVolumeM3).toBe(p.production.effluentVolumeM3);
    s.inputs.filter((i) => i.category === "Water").forEach((w, idx) => expect(w.quantity).toBe(p.inputs.filter((i) => i.category === "Water")[idx]!.quantity));
  });

  it("countercurrent rinse keeps pollutant load constant", () => {
    const p = hardChromeDemo();
    const before = calculate(p).lci.flows.find((f) => f.name === "Ni")!.quantity;
    const { project: s } = applyScenario(p, { countercurrent: { stagesOld: 2, stagesNew: 3, ratio: 1000 } });
    const after = calculate(s).lci.flows.find((f) => f.name === "Ni")!.quantity;
    close(after, before, 1e-9);
    expect(s.production.effluentVolumeM3).toBeLessThan(p.production.effluentVolumeM3);
  });

  it("rectifier efficiency and LCC", () => {
    const p = hardChromeDemo();
    const base = indicatorsOf(calculate(p));
    const out = evaluateScenario(p, { id: "x", code: "S3", name: "", description: "", levers: { rectifier: { etaOld: 75, etaNew: 88 } }, capexRp: 1_000_000, extraOpexRpPerPeriod: 0, lifetimeYears: 5, status: "draft" }, base);
    close(out.indicators.energyKwh, 965 - 300 + 300 * (75 / 88), 1e-9);
    expect(out.delta.costRp.abs).toBeLessThan(0);
    expect(out.lcc.paybackYears).not.toBeNull();
  });

  it("sensitivity ranks parameters", () => {
    // Since A1 chemicals count too, so production volume (area) swings carbon per m² most.
    const s = sensitivity(hardChromeDemo(), (i) => i.perFu.cc);
    expect(s.rows[0]!.parameter).toMatch(/Volume produksi/);
    const grid = s.rows.find((r) => /grid/.test(r.parameter))!;
    expect(grid.high).toBeGreaterThan(grid.low);
  });
});

describe("runs & audit", () => {
  it("re-run from manifest reproduces the hash (AC-03)", () => {
    const run = createRun(hardChromeDemo(), { id: "R-1", label: "R-1", kind: "draft", actor: "test", now: "2026-10-07T00:00:00Z" });
    expect(rerunCheck(run).ok).toBe(true);
    run.snapshot.inputs[0]!.quantity += 1;
    expect(rerunCheck(run).ok).toBe(false);
  });

  it("hash chain detects tampering", () => {
    let log = appendEvent([], { actor: "a", role: "Admin", entity: "x", entityId: "1", action: "create", ts: "t1" });
    log = appendEvent(log, { actor: "a", role: "Admin", entity: "x", entityId: "1", action: "update", oldValue: 1, newValue: 2, reason: "koreksi", ts: "t2" });
    expect(verifyChain(log)).toBeNull();
    log[0] = { ...log[0]!, action: "delete" };
    expect(verifyChain(log)).toBe(1);
  });
});

describe("copilot guardrail (AC-05)", () => {
  it("rejects free numbers and renders placeholders", () => {
    expect(() => render("GWP turun 12% tahun ini", {})).toThrow(GuardrailError);
    expect(render("GWP {{x}} sesuai ISO 14044", { x: "2,4 kg" })).toBe("GWP 2,4 kg sesuai ISO 14044");
    expect(() => render("Nilai {{y}}", {})).toThrow(GuardrailError);
  });

  it("builds insights for the demo without guardrail rejections", () => {
    const p = hardChromeDemo();
    const r = calculate(p);
    const base = indicatorsOf(r);
    const ins = buildInsights(p, r, p.scenarios.map((s) => evaluateScenario(p, s, base)));
    expect(ins.rejected).toEqual([]);
    expect(ins.map((i) => i.id)).toEqual(expect.arrayContaining(["hot-energy", "hot-waste", "impact-cc", "cost-loss", "quality"]));
  });

  it("parses natural-language what-if", () => {
    const r = parseWhatIf("Apa yang terjadi bila drag-out turun 20%?");
    expect(r?.levers.dragout?.reductionPct).toBe(20);
    expect(parseWhatIf("halo")).toBeNull();
  });
});
