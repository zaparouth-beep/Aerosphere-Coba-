import type { LeverId, LeverSettings, Project, Scenario } from "@/lib/domain/types";
import { calculate, indicatorsOf, isMetalParameter, type Indicators, type Results } from "./calculate";
import { deviceRoleOf } from "./inventory";
import { GRID_SENSITIVITY_RANGE } from "./method";
import { concentrationFactor } from "./units";
import { locale, tx } from "@/lib/i18n";

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
  {
    id: "dragout",
    get label() {
      return tx("Kurangi larutan yang terbawa part", "Reduce solution carried out by parts");
    },
    technical: "Drag-out reduction",
    get description() {
      return tx("Perpanjang waktu tiris, pasang tangki penampung tetesan, atau atur posisi rak agar larutan kembali ke tangki proses.", "Extend the drip time, add a drag-out tank, or adjust the racks so the solution drains back into the process tank.");
    },
    get affects() {
      return tx("Pemakaian bahan kimia tahap B–D, kadar logam di air buangan, bahan kimia IPAL, dan lumpur B3", "Chemical use in stages B–D, metals in wastewater, WWTP chemicals, and hazardous (B3) sludge");
    },
  },
  {
    id: "countercurrent",
    get label() {
      return tx("Terapkan bilasan bertingkat", "Use multi-stage rinsing");
    },
    technical: "Counter-flow rinse",
    get description() {
      return tx("Air bilas mengalir dari tangki bilas terakhir ke tangki sebelumnya, sehingga kebutuhan air bersih jauh lebih kecil.", "Rinse water flows from the last rinse tank back to the previous one, so far less fresh water is needed.");
    },
    get affects() {
      return tx("Pemakaian air bilas, volume air buangan, dan listrik unit DI/RO", "Rinse water use, wastewater volume, and DI/RO unit electricity");
    },
  },
  {
    id: "rectifier",
    get label() {
      return tx("Tingkatkan efisiensi penyearah arus", "Upgrade rectifier efficiency");
    },
    technical: "Rectifier efficiency",
    get description() {
      return tx("Penyearah arus yang lebih efisien (mis. tipe switch-mode) membuang lebih sedikit listrik menjadi panas.", "A more efficient rectifier (e.g. switch-mode) wastes less electricity as heat.");
    },
    get affects() {
      return tx("Listrik penyearah arus dan jejak karbonnya", "Rectifier electricity and its carbon footprint");
    },
  },
  {
    id: "tankCover",
    get label() {
      return tx("Pasang penutup dan insulasi tangki", "Fit tank covers and insulation");
    },
    technical: "Tank cover & insulation",
    get description() {
      return tx("Penutup atau bola apung dan insulasi dinding tangki mengurangi panas yang hilang serta kabut yang keluar dari tangki.", "Covers or floating balls and insulated tank walls reduce heat loss and the mist escaping from the tank.");
    },
    get affects() {
      return tx("Listrik pemanas tangki, kabut krom, dan kabut asam", "Tank heater electricity, chromium mist, and acid mist");
    },
  },
  {
    id: "mistSuppressant",
    get label() {
      return tx("Gunakan penekan kabut", "Use a mist suppressant");
    },
    technical: "Mist suppressant",
    get description() {
      return tx("Aditif bebas PFOS pada larutan krom yang menahan kabut tetap di permukaan tangki.", "A PFOS-free additive in the chrome bath that keeps mist at the tank surface.");
    },
    get affects() {
      return tx("Kabut krom dan kabut asam di area kerja", "Chromium mist and acid mist in the work area");
    },
  },
  {
    id: "effluentTarget",
    get label() {
      return tx("Tingkatkan kinerja IPAL", "Improve wastewater treatment");
    },
    technical: "Effluent target (WWTP upgrade)",
    get description() {
      return tx("Sesuaikan dosis bahan kimia dan proses pengendapan di IPAL agar kadar logam di air buangan mencapai target.", "Adjust chemical dosing and settling at the WWTP so metal levels in the wastewater meet the target.");
    },
    get affects() {
      return tx("Kadar logam di air buangan, pemakaian bahan penggumpal, dan lumpur IPAL", "Metals in wastewater, flocculant use, and WWTP sludge");
    },
  },
  {
    id: "gridFactor",
    get label() {
      return tx("Beralih ke listrik rendah emisi", "Switch to low-emission electricity");
    },
    technical: "Grid emission factor",
    get description() {
      return tx("Sertifikat energi terbarukan, kontrak listrik hijau, atau PLTS atap menurunkan emisi dari setiap kWh yang dipakai.", "Renewable energy certificates, a green power contract, or rooftop solar lower the emissions of every kWh used.");
    },
    get affects() {
      return tx("Jejak karbon dari pemakaian listrik", "Carbon footprint of electricity use");
    },
  },
  {
    id: "bathConcentration",
    get label() {
      return tx("Turunkan konsentrasi larutan proses", "Lower the process bath concentration");
    },
    technical: "Bath concentration",
    get description() {
      return tx("Operasikan larutan di batas bawah rentang kendali, sehingga bahan kimia yang terbawa keluar lebih sedikit.", "Run the bath at the lower end of its control range so less chemical is carried out.");
    },
    get affects() {
      return tx("Bahan kimia tahap pelapisan utama yang terbuang", "Chemicals lost from the main plating stage");
    },
  },
];

/** Default lever values (spec §6); used for new simulations and for directions suggested from the results. */
export const LEVER_DEFAULTS: Required<LeverSettings> = {
  dragout: { reductionPct: 20 },
  countercurrent: { stagesOld: 2, stagesNew: 3, ratio: 1000 },
  rectifier: { etaOld: 75, etaNew: 88 },
  tankCover: { heatReductionPct: 20, mistReductionPct: 30 },
  mistSuppressant: { reductionPct: 50 },
  effluentTarget: { parameter: "Ni", newValue: 0.064, flocculantIncreasePct: 10 },
  gridFactor: { kgCO2ePerKwh: 0.5 },
  bathConcentration: { cOld: 55, cNew: 47.5 },
};

type Draft = Project;

const pct = (n: number) => `${n.toLocaleString(locale(), { maximumFractionDigits: 1 })}%`;
const isMetal = isMetalParameter;
/** Electricity rows by device, in English or Indonesian ("Rectifier electricity", "Listrik penyearah arus"). */
const isDevice = (i: Project["inputs"][number], role: string) => i.category === "Energy" && deviceRoleOf(i.name) === role;
/** Mist and fume rows ("Cr(VI) mist", "Acid mist", "Kabut krom", "Kabut asam"). */
const isMist = (parameter: string) => /mist|kabut|fume|uap asam/i.test(parameter);
const NOTHING = (what: string, whatEn: string) =>
  tx(
    `Tidak ada ${what} di data proyek, sehingga perbaikan ini belum mengubah hasil. Tambahkan atau ganti nama komponennya di Data Saya.`,
    `No ${whatEn} in the project data, so this improvement does not change the results yet. Add or rename the component in My Data.`,
  );
/** Assumption lines saying a lever found nothing to change (Indonesian or English wording). */
export const isNothingNote = (a: string) => a.startsWith("Tidak ada ") || a.startsWith("No ") && a.includes("in the project data");

function dragout(p: Draft, s: NonNullable<LeverSettings["dragout"]>): string[] {
  const r = Math.min(Math.max(s.reductionPct, 0), 100) / 100;
  const none = !p.inputs.some((i) => i.category === "Chemical" && ["B", "C", "D"].includes(i.stageId) && i.quantity > 0);
  for (const i of p.inputs) {
    if (i.category === "Chemical" && ["B", "C", "D"].includes(i.stageId)) i.quantity *= 1 - r;
    if (i.category === "WWTPChemical") i.quantity *= 1 - r;
  }
  for (const w of p.waste) if (w.stageId === "F") w.quantityKg *= 1 - r;
  for (const e of p.effluent) if (isMetal(e.parameter) && concentrationFactor(e.unit) !== null) e.value *= 1 - r;
  return [
    tx(`Drag-out turun ${pct(r * 100)}.`, `Drag-out reduced by ${pct(r * 100)}.`),
    tx(
      "Asumsi default: seluruh konsumsi kimia (kategori Chemical) tahap B/C/D adalah pengganti kehilangan drag-out (koefisien 1,0; belum divalidasi data pabrik).",
      "Default assumption: all chemical consumption (Chemical category) in stages B/C/D replaces drag-out losses (coefficient 1.0; not yet validated with plant data).",
    ),
    tx(
      "Beban logam ke IPAL turun sebanding; kimia IPAL dan lumpur IPAL turun proporsional terhadap beban logam (koefisien 1,0).",
      "Metal load to the WWTP falls by the same share; WWTP chemicals and WWTP sludge fall in proportion to the metal load (coefficient 1.0).",
    ),
    tx(
      "Anoda tidak berubah karena logam anoda ≈ logam yang terdeposit (Takuma et al. 2018).",
      "Anodes do not change because anode metal ≈ deposited metal (Takuma et al. 2018).",
    ),
    ...(none ? [NOTHING("bahan kimia di tahap B, C, atau D", "chemicals in stages B, C or D")] : []),
  ];
}

function countercurrent(p: Draft, s: NonNullable<LeverSettings["countercurrent"]>): string[] {
  const ratio = s.ratio > 1 ? s.ratio : 1000;
  const nOld = Math.max(1, Math.round(s.stagesOld));
  const nNew = Math.max(1, Math.round(s.stagesNew));
  const factor = ratio ** (1 / nNew) / ratio ** (1 / nOld);
  const none = !p.inputs.some((i) => i.category === "Water" && i.quantity > 0);
  for (const i of p.inputs) {
    if (i.category === "Water") i.quantity *= factor;
    if (isDevice(i, "di_ro")) i.quantity *= factor;
  }
  p.production.effluentVolumeM3 *= factor;
  // Same pollutant mass in less water → concentrations rise by 1/factor.
  for (const e of p.effluent) if (concentrationFactor(e.unit) !== null && factor > 0) e.value /= factor;
  return [
    tx(
      `Tingkat bilas ${nOld} → ${nNew}, rasio C₀/Cₙ = ${ratio}: debit air × ${factor.toFixed(3)}.`,
      `Rinse stages ${nOld} → ${nNew}, ratio C₀/Cₙ = ${ratio}: water flow × ${factor.toFixed(3)}.`,
    ),
    tx(
      "Volume efluen dan listrik DI/RO ikut skala yang sama; beban polutan efluen tetap (konsentrasi naik).",
      "Effluent volume and DI/RO electricity scale the same way; the effluent pollutant load stays the same (concentrations rise).",
    ),
    ...(none ? [NOTHING("pemakaian air", "water use")] : []),
  ];
}

function rectifier(p: Draft, s: NonNullable<LeverSettings["rectifier"]>): string[] {
  const f = s.etaNew > 0 ? s.etaOld / s.etaNew : 1;
  const none = !p.inputs.some((i) => isDevice(i, "rectifier") && i.quantity > 0);
  for (const i of p.inputs) if (isDevice(i, "rectifier")) i.quantity *= f;
  return [
    tx(
      `Efisiensi rectifier ${pct(s.etaOld)} → ${pct(s.etaNew)}: E_baru = E_lama × η_lama ÷ η_baru (× ${f.toFixed(3)}).`,
      `Rectifier efficiency ${pct(s.etaOld)} → ${pct(s.etaNew)}: E_new = E_old × η_old ÷ η_new (× ${f.toFixed(3)}).`,
    ),
    ...(none ? [NOTHING("listrik penyearah arus (rectifier)", "rectifier electricity")] : []),
  ];
}

function scaleMist(p: Draft, r: number) {
  for (const a of p.airEmissions) if (isMist(a.parameter)) a.quantityKg *= 1 - r;
}

function tankCover(p: Draft, s: NonNullable<LeverSettings["tankCover"]>): string[] {
  const rh = Math.min(Math.max(s.heatReductionPct, 0), 100) / 100;
  const rm = Math.min(Math.max(s.mistReductionPct, 0), 100) / 100;
  const none = !p.inputs.some((i) => isDevice(i, "heater") && i.quantity > 0) && !p.airEmissions.some((a) => isMist(a.parameter) && a.quantityKg > 0);
  for (const i of p.inputs) if (isDevice(i, "heater")) i.quantity *= 1 - rh;
  scaleMist(p, rm);
  return [
    tx(
      `kWh heater × (1 − ${pct(rh * 100)}); Cr(VI) mist dan acid mist × (1 − ${pct(rm * 100)}).`,
      `Heater kWh × (1 − ${pct(rh * 100)}); Cr(VI) mist and acid mist × (1 − ${pct(rm * 100)}).`,
    ),
    ...(none ? [NOTHING("listrik pemanas (heater) maupun kabut dari tangki", "heater electricity or tank mist")] : []),
  ];
}

function mistSuppressant(p: Draft, s: NonNullable<LeverSettings["mistSuppressant"]>): string[] {
  const r = Math.min(Math.max(s.reductionPct, 0), 100) / 100;
  const none = !p.airEmissions.some((a) => isMist(a.parameter) && a.quantityKg > 0);
  scaleMist(p, r);
  return [
    tx(`Cr(VI) mist dan acid mist × (1 − ${pct(r * 100)}).`, `Cr(VI) mist and acid mist × (1 − ${pct(r * 100)}).`),
    ...(none ? [NOTHING("emisi kabut (mist) di emisi udara", "mist emissions among the air emissions")] : []),
  ];
}

function effluentTarget(p: Draft, s: NonNullable<LeverSettings["effluentTarget"]>): string[] {
  const target = p.effluent.find((e) => e.parameter.trim().toLowerCase() === s.parameter.trim().toLowerCase());
  const x = Math.max(s.flocculantIncreasePct, 0) / 100;
  if (!target) return [tx(`Parameter efluen "${s.parameter}" tidak ditemukan; lever tidak diterapkan.`, `Effluent parameter "${s.parameter}" not found; the improvement was not applied.`)];
  const old = target.value;
  target.value = Math.max(s.newValue, 0);
  for (const i of p.inputs) if (i.category === "WWTPChemical" && /coagulant|flocculant|flokulan|koagulan|penggumpal/i.test(i.name)) i.quantity *= 1 + x;
  for (const w of p.waste) if (w.stageId === "F") w.quantityKg *= 1 + x * 0.1;
  return [
    `${target.parameter}: ${old} → ${target.value} ${target.unit} (Load = Q × C).`,
    tx(
      `Flokulan +${pct(x * 100)}; lumpur IPAL +${pct(x * 10)} (asumsi: tambahan lumpur kecil, mengikuti Takuma et al. 2018).`,
      `Flocculant +${pct(x * 100)}; WWTP sludge +${pct(x * 10)} (assumption: small extra sludge, following Takuma et al. 2018).`,
    ),
  ];
}

function gridFactor(p: Draft, s: NonNullable<LeverSettings["gridFactor"]>): string[] {
  const ids = new Set(p.inputs.filter((i) => i.category === "Energy" && i.mapping.datasetId).map((i) => i.mapping.datasetId!));
  for (const d of p.backgrounds) if (ids.has(d.id)) d.factors = { ...d.factors, cc: s.kgCO2ePerKwh };
  return [
    tx(
      `Faktor emisi listrik diganti ${s.kgCO2ePerKwh} kg CO₂e/kWh (hanya climate change; kategori lain dari dataset tidak berubah).`,
      `Electricity emission factor replaced with ${s.kgCO2ePerKwh} kg CO₂e/kWh (climate change only; other dataset categories unchanged).`,
    ),
  ];
}

function bathConcentration(p: Draft, s: NonNullable<LeverSettings["bathConcentration"]>): string[] {
  const f = s.cOld > 0 ? s.cNew / s.cOld : 1;
  for (const i of p.inputs) if (i.category === "Chemical" && i.stageId === "C") i.quantity *= f;
  return [
    tx(
      `Konsentrasi bath ${s.cOld} → ${s.cNew} g/L: kehilangan drag-out kimia tahap C × ${f.toFixed(3)}.`,
      `Bath concentration ${s.cOld} → ${s.cNew} g/L: stage C chemical drag-out loss × ${f.toFixed(3)}.`,
    ),
    tx(
      "Pastikan nilai baru tetap di dalam control limit SCM (lever tidak boleh mendorong parameter keluar spec limit).",
      "Make sure the new value stays within the SCM control limits (the improvement must not push the parameter outside the spec limits).",
    ),
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
  const keys = ["energyKwh", "waterL", "chemicalKg", "wasteKg", "effluentM3", "ccKg", "costRp", "costLossRp", "wasteValueRp", "airKg", "effluentMetalKg"] as const;
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
    { parameter: tx("Listrik ±10%", "Electricity ±10%"), low: run(scaleCat(["Energy"], 0.9)), high: run(scaleCat(["Energy"], 1.1)), lowLabel: "−10%", highLabel: "+10%" },
    { parameter: tx("Kimia ±10%", "Chemicals ±10%"), low: run(scaleCat(["Chemical", "Anode", "WWTPChemical", "Consumable"], 0.9)), high: run(scaleCat(["Chemical", "Anode", "WWTPChemical", "Consumable"], 1.1)), lowLabel: "−10%", highLabel: "+10%" },
    { parameter: tx("Air ±10%", "Water ±10%"), low: run(scaleCat(["Water"], 0.9)), high: run(scaleCat(["Water"], 1.1)), lowLabel: "−10%", highLabel: "+10%" },
    {
      parameter: tx("Volume produksi ±10%", "Production volume ±10%"),
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
      parameter: tx(`Faktor grid ${GRID_SENSITIVITY_RANGE.low}–${GRID_SENSITIVITY_RANGE.high}`, `Grid factor ${GRID_SENSITIVITY_RANGE.low}–${GRID_SENSITIVITY_RANGE.high}`),
      low: run((p) => void gridFactor(p, { kgCO2ePerKwh: GRID_SENSITIVITY_RANGE.low })),
      high: run((p) => void gridFactor(p, { kgCO2ePerKwh: GRID_SENSITIVITY_RANGE.high })),
      lowLabel: String(GRID_SENSITIVITY_RANGE.low),
      highLabel: String(GRID_SENSITIVITY_RANGE.high),
    });
  }
  rows.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  return { base, rows };
}
