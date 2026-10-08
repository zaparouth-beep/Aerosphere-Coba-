import type { LeverId, LeverSettings, Project, Scenario } from "@/lib/domain/types";
import { calculate, indicatorsOf, type Indicators, type Results } from "./calculate";
import { GRID_SENSITIVITY_RANGE } from "./method";
import { concentrationFactor } from "./units";

/**
 * Deterministic, documented lever propagation (PRD 2.2.5, FR-09.2). Each
 * lever is a named pure function over a cloned project; it only touches the
 * flows listed in its definition (AC-06) and reports the assumptions used.
 */

export interface LeverDef {
  id: LeverId;
  /** Everyday label shown by default; `technical` is shown in Mode Ahli. */
  label: string;
  technical: string;
  description: string;
  affects: string;
}

export const LEVERS: LeverDef[] = [
  { id: "dragout", label: "Kurangi larutan terbawa part", technical: "Drag-out reduction", description: "Perbaikan waktu tiris, drag-out tank, atau rak.", affects: "Bahan kimia tahap B–D, logam di air buangan, kimia pengolahan air limbah, lumpur B3" },
  { id: "countercurrent", label: "Bilasan bertingkat", technical: "Counter-flow rinse", description: "Tambah tingkat bilas: Q = D × (C₀/Cₙ)^(1/n).", affects: "Air bilas, volume air buangan, listrik air DI/RO" },
  { id: "rectifier", label: "Perbaiki penyearah arus", technical: "Rectifier efficiency", description: "Efisiensi rectifier (mis. SCR → switch-mode).", affects: "Listrik penyearah arus" },
  { id: "tankCover", label: "Pasang tutup & insulasi tangki", technical: "Tank cover & insulation", description: "Kurangi kehilangan panas dan kabut.", affects: "Listrik pemanas, kabut krom dan kabut asam" },
  { id: "mistSuppressant", label: "Tambahkan penekan kabut", technical: "Mist suppressant", description: "Aditif penekan kabut pada bath krom.", affects: "Kabut krom dan kabut asam" },
  { id: "effluentTarget", label: "Tingkatkan pengolahan air limbah", technical: "Effluent target (WWTP upgrade)", description: "Target konsentrasi efluen baru.", affects: "Logam di air buangan, flokulan, lumpur" },
  { id: "gridFactor", label: "Pakai listrik lebih bersih", technical: "Grid emission factor", description: "Faktor emisi listrik baru (PPA/REC).", affects: "Jejak karbon dari listrik" },
  { id: "bathConcentration", label: "Turunkan konsentrasi larutan", technical: "Bath concentration", description: "Turunkan konsentrasi bath dalam control limit.", affects: "Bahan kimia tahap plating yang terbuang" },
];

type Draft = Project;

const pct = (n: number) => `${n.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
const isMetal = (param: string) => /^(ni|cr|cd|zn|cu)\b|^cr\s*\(?vi\)?$|cr total/i.test(param.trim());

function dragout(p: Draft, s: NonNullable<LeverSettings["dragout"]>): string[] {
  const r = Math.min(Math.max(s.reductionPct, 0), 100) / 100;
  for (const i of p.inputs) {
    if (i.category === "Chemical" && ["B", "C", "D"].includes(i.stageId)) i.quantity *= 1 - r;
    if (i.category === "WWTPChemical") i.quantity *= 1 - r;
  }
  for (const w of p.waste) if (w.stageId === "F") w.quantityKg *= 1 - r;
  for (const e of p.effluent) if (isMetal(e.parameter) && concentrationFactor(e.unit) !== null) e.value *= 1 - r;
  return [
    `Drag-out turun ${pct(r * 100)}.`,
    "Asumsi default: seluruh konsumsi kimia (kategori Chemical) tahap B/C/D adalah pengganti kehilangan drag-out (koefisien 1,0; belum divalidasi data pabrik).",
    "Beban logam ke IPAL turun sebanding; kimia IPAL dan lumpur IPAL turun proporsional terhadap beban logam (koefisien 1,0).",
    "Anoda tidak berubah karena logam anoda ≈ logam yang terdeposit (Takuma et al. 2018).",
  ];
}

function countercurrent(p: Draft, s: NonNullable<LeverSettings["countercurrent"]>): string[] {
  const ratio = s.ratio > 1 ? s.ratio : 1000;
  const nOld = Math.max(1, Math.round(s.stagesOld));
  const nNew = Math.max(1, Math.round(s.stagesNew));
  const factor = ratio ** (1 / nNew) / ratio ** (1 / nOld);
  for (const i of p.inputs) {
    if (i.category === "Water") i.quantity *= factor;
    if (i.category === "Energy" && /di\s*\/?\s*ro/i.test(i.name)) i.quantity *= factor;
  }
  p.production.effluentVolumeM3 *= factor;
  // Same pollutant mass in less water → concentrations rise by 1/factor.
  for (const e of p.effluent) if (concentrationFactor(e.unit) !== null && factor > 0) e.value /= factor;
  return [
    `Tingkat bilas ${nOld} → ${nNew}, rasio C₀/Cₙ = ${ratio}: debit air × ${factor.toFixed(3)}.`,
    "Volume efluen dan listrik DI/RO ikut skala yang sama; beban polutan efluen tetap (konsentrasi naik).",
  ];
}

function rectifier(p: Draft, s: NonNullable<LeverSettings["rectifier"]>): string[] {
  const f = s.etaNew > 0 ? s.etaOld / s.etaNew : 1;
  for (const i of p.inputs) if (i.category === "Energy" && /rectifier/i.test(i.name)) i.quantity *= f;
  return [`Efisiensi rectifier ${pct(s.etaOld)} → ${pct(s.etaNew)}: E_baru = E_lama × η_lama ÷ η_baru (× ${f.toFixed(3)}).`];
}

function scaleMist(p: Draft, r: number) {
  for (const a of p.airEmissions) if (/cr\s*\(?vi\)?\s*mist|acid mist/i.test(a.parameter)) a.quantityKg *= 1 - r;
}

function tankCover(p: Draft, s: NonNullable<LeverSettings["tankCover"]>): string[] {
  const rh = Math.min(Math.max(s.heatReductionPct, 0), 100) / 100;
  const rm = Math.min(Math.max(s.mistReductionPct, 0), 100) / 100;
  for (const i of p.inputs) if (i.category === "Energy" && /heater/i.test(i.name)) i.quantity *= 1 - rh;
  scaleMist(p, rm);
  return [`kWh heater × (1 − ${pct(rh * 100)}); Cr(VI) mist dan acid mist × (1 − ${pct(rm * 100)}).`];
}

function mistSuppressant(p: Draft, s: NonNullable<LeverSettings["mistSuppressant"]>): string[] {
  const r = Math.min(Math.max(s.reductionPct, 0), 100) / 100;
  scaleMist(p, r);
  return [`Cr(VI) mist dan acid mist × (1 − ${pct(r * 100)}).`];
}

function effluentTarget(p: Draft, s: NonNullable<LeverSettings["effluentTarget"]>): string[] {
  const target = p.effluent.find((e) => e.parameter.trim().toLowerCase() === s.parameter.trim().toLowerCase());
  const x = Math.max(s.flocculantIncreasePct, 0) / 100;
  if (!target) return [`Parameter efluen "${s.parameter}" tidak ditemukan; lever tidak diterapkan.`];
  const old = target.value;
  target.value = Math.max(s.newValue, 0);
  for (const i of p.inputs) if (i.category === "WWTPChemical" && /coagulant|flocculant|flokulan/i.test(i.name)) i.quantity *= 1 + x;
  for (const w of p.waste) if (w.stageId === "F") w.quantityKg *= 1 + x * 0.1;
  return [
    `${target.parameter}: ${old} → ${target.value} ${target.unit} (Load = Q × C).`,
    `Flokulan +${pct(x * 100)}; lumpur IPAL +${pct(x * 10)} (asumsi: tambahan lumpur kecil, mengikuti Takuma et al. 2018).`,
  ];
}

function gridFactor(p: Draft, s: NonNullable<LeverSettings["gridFactor"]>): string[] {
  const ids = new Set(p.inputs.filter((i) => i.category === "Energy" && i.mapping.datasetId).map((i) => i.mapping.datasetId!));
  for (const d of p.backgrounds) if (ids.has(d.id)) d.factors = { ...d.factors, cc: s.kgCO2ePerKwh };
  return [`Faktor emisi listrik diganti ${s.kgCO2ePerKwh} kg CO₂e/kWh (hanya climate change; kategori lain dari dataset tidak berubah).`];
}

function bathConcentration(p: Draft, s: NonNullable<LeverSettings["bathConcentration"]>): string[] {
  const f = s.cOld > 0 ? s.cNew / s.cOld : 1;
  for (const i of p.inputs) if (i.category === "Chemical" && i.stageId === "C") i.quantity *= f;
  return [
    `Konsentrasi bath ${s.cOld} → ${s.cNew} g/L: kehilangan drag-out kimia tahap C × ${f.toFixed(3)}.`,
    "Pastikan nilai baru tetap di dalam control limit SCM (lever tidak boleh mendorong parameter keluar spec limit).",
  ];
}

const ORDER: LeverId[] = ["dragout", "bathConcentration", "countercurrent", "rectifier", "tankCover", "mistSuppressant", "effluentTarget", "gridFactor"];

export function applyLever(p: Draft, id: LeverId, levers: LeverSettings): string[] {
  switch (id) {
    case "dragout":
      return levers.dragout ? dragout(p, levers.dragout) : [];
    case "countercurrent":
      return levers.countercurrent ? countercurrent(p, levers.countercurrent) : [];
    case "rectifier":
      return levers.rectifier ? rectifier(p, levers.rectifier) : [];
    case "tankCover":
      return levers.tankCover ? tankCover(p, levers.tankCover) : [];
    case "mistSuppressant":
      return levers.mistSuppressant ? mistSuppressant(p, levers.mistSuppressant) : [];
    case "effluentTarget":
      return levers.effluentTarget ? effluentTarget(p, levers.effluentTarget) : [];
    case "gridFactor":
      return levers.gridFactor ? gridFactor(p, levers.gridFactor) : [];
    case "bathConcentration":
      return levers.bathConcentration ? bathConcentration(p, levers.bathConcentration) : [];
  }
}

export function activeLevers(levers: LeverSettings): LeverId[] {
  return ORDER.filter((id) => levers[id] !== undefined);
}

/** Scenario = baseline + delta (FR-09.1); returns the modified project and assumptions. */
export function applyScenario(project: Project, levers: LeverSettings): { project: Project; assumptions: string[] } {
  const draft = structuredClone(project);
  const assumptions: string[] = [];
  for (const id of activeLevers(levers)) assumptions.push(...applyLever(draft, id, levers));
  return { project: draft, assumptions };
}

export interface ScenarioOutcome {
  scenario: Scenario;
  results: Results;
  indicators: Indicators;
  assumptions: string[];
  delta: Record<keyof Omit<Indicators, "perFu">, { abs: number; pct: number }>;
  lcc: { annualSavingRp: number; paybackYears: number | null; npvRp: number };
}

function deltaOf(base: Indicators, s: Indicators): ScenarioOutcome["delta"] {
  const keys = ["energyKwh", "waterL", "chemicalKg", "wasteKg", "effluentM3", "ccKg", "costRp", "costLossRp"] as const;
  return Object.fromEntries(
    keys.map((k) => [k, { abs: s[k] - base[k], pct: base[k] !== 0 ? ((s[k] - base[k]) / base[k]) * 100 : 0 }]),
  ) as ScenarioOutcome["delta"];
}

export function evaluateScenario(project: Project, scenario: Scenario, base: Indicators): ScenarioOutcome {
  const { project: modified, assumptions } = applyScenario(project, scenario.levers);
  const results = calculate(modified);
  const indicators = indicatorsOf(results);
  const periodsPerYear = 12 / Math.max(project.periodMonths, 1);
  const annualSavingRp = (base.costRp - indicators.costRp) * periodsPerYear - scenario.extraOpexRpPerPeriod * periodsPerYear;
  const r = project.targets.discountRatePct / 100;
  let npv = -scenario.capexRp;
  for (let y = 1; y <= Math.max(scenario.lifetimeYears, 0); y += 1) npv += annualSavingRp / (1 + r) ** y;
  return {
    scenario,
    results,
    indicators,
    assumptions,
    delta: deltaOf(base, indicators),
    lcc: {
      annualSavingRp,
      paybackYears: annualSavingRp > 0 ? scenario.capexRp / annualSavingRp : null,
      npvRp: npv,
    },
  };
}

/** Bridge (waterfall): apply levers one by one and record the running value. */
export function bridge(project: Project, levers: LeverSettings, metric: (i: Indicators) => number) {
  const draft = structuredClone(project);
  const steps: Array<{ label: string; value: number; delta: number }> = [];
  let prev = metric(indicatorsOf(calculate(draft)));
  steps.push({ label: "Baseline", value: prev, delta: 0 });
  for (const id of activeLevers(levers)) {
    applyLever(draft, id, levers);
    const v = metric(indicatorsOf(calculate(draft)));
    steps.push({ label: LEVERS.find((l) => l.id === id)?.label ?? id, value: v, delta: v - prev });
    prev = v;
  }
  return steps;
}

/* ------------------------- Sensitivity (FR-09.4) ------------------------- */

export interface TornadoRow {
  parameter: string;
  low: number;
  high: number;
  lowLabel: string;
  highLabel: string;
}

export function sensitivity(project: Project, metric: (i: Indicators) => number): { base: number; rows: TornadoRow[] } {
  const base = metric(indicatorsOf(calculate(project)));
  const run = (mutate: (p: Project) => void) => {
    const p = structuredClone(project);
    mutate(p);
    return metric(indicatorsOf(calculate(p)));
  };
  const scaleCat = (cats: string[], f: number) => (p: Project) => {
    for (const i of p.inputs) if (cats.includes(i.category)) i.quantity *= f;
  };
  const rows: TornadoRow[] = [
    { parameter: "Listrik ±10%", low: run(scaleCat(["Energy"], 0.9)), high: run(scaleCat(["Energy"], 1.1)), lowLabel: "−10%", highLabel: "+10%" },
    { parameter: "Kimia ±10%", low: run(scaleCat(["Chemical", "Anode", "WWTPChemical", "Consumable"], 0.9)), high: run(scaleCat(["Chemical", "Anode", "WWTPChemical", "Consumable"], 1.1)), lowLabel: "−10%", highLabel: "+10%" },
    { parameter: "Air ±10%", low: run(scaleCat(["Water"], 0.9)), high: run(scaleCat(["Water"], 1.1)), lowLabel: "−10%", highLabel: "+10%" },
    {
      parameter: "Volume produksi ±10%",
      low: run((p) => {
        p.production.areaM2 *= 0.9;
        p.production.parts *= 0.9;
        p.production.componentMassKg *= 0.9;
      }),
      high: run((p) => {
        p.production.areaM2 *= 1.1;
        p.production.parts *= 1.1;
        p.production.componentMassKg *= 1.1;
      }),
      lowLabel: "−10%",
      highLabel: "+10%",
    },
  ];
  const hasGrid = project.inputs.some((i) => i.category === "Energy" && i.mapping.datasetId);
  if (hasGrid) {
    rows.push({
      parameter: `Faktor grid ${GRID_SENSITIVITY_RANGE.low}–${GRID_SENSITIVITY_RANGE.high}`,
      low: run((p) => void gridFactor(p, { kgCO2ePerKwh: GRID_SENSITIVITY_RANGE.low })),
      high: run((p) => void gridFactor(p, { kgCO2ePerKwh: GRID_SENSITIVITY_RANGE.high })),
      lowLabel: String(GRID_SENSITIVITY_RANGE.low),
      highLabel: String(GRID_SENSITIVITY_RANGE.high),
    });
  }
  rows.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  return { base, rows };
}
