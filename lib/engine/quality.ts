import type { Confidence, DataMeta, Pedigree, Project, SourceType, StageId } from "@/lib/domain/types";
import { CHEMICAL_CATEGORIES, STAGE_IDS, type LciResult } from "./lci";
import { concentrationFactor } from "./units";

/* -------------------------------- Pedigree ------------------------------- */

export const SOURCE_TIER: Record<SourceType, { tier: number; label: string }> = {
  measured: { tier: 1, label: "Tier 1 — terukur" },
  calculated: { tier: 2, label: "Tier 2 — dihitung" },
  supplier: { tier: 3, label: "Tier 3 — data pemasok" },
  database: { tier: 4, label: "Tier 4 — database LCA" },
  literature: { tier: 5, label: "Tier 5 — literatur/estimasi" },
};

export const PEDIGREE_KEYS: Array<{ key: keyof Pedigree; label: string }> = [
  { key: "reliability", label: "Reliability" },
  { key: "completeness", label: "Completeness" },
  { key: "temporal", label: "Temporal" },
  { key: "geographical", label: "Geographical" },
  { key: "technological", label: "Technological" },
];

/** Starting pedigree derived from the source type; editable with a reason. */
export function defaultPedigree(source: SourceType): Pedigree {
  switch (source) {
    case "measured":
      return { reliability: 1, completeness: 2, temporal: 1, geographical: 1, technological: 1 };
    case "calculated":
      return { reliability: 2, completeness: 2, temporal: 1, geographical: 1, technological: 2 };
    case "supplier":
      return { reliability: 2, completeness: 3, temporal: 2, geographical: 2, technological: 2 };
    case "database":
      return { reliability: 3, completeness: 3, temporal: 3, geographical: 3, technological: 3 };
    default:
      return { reliability: 4, completeness: 4, temporal: 3, geographical: 4, technological: 3 };
  }
}

export function pedigreeScore(p: Pedigree): number {
  return (p.reliability + p.completeness + p.temporal + p.geographical + p.technological) / 5;
}

export function confidenceOf(meta: DataMeta): Confidence {
  const s = pedigreeScore(meta.pedigree);
  return s <= 2 ? "High" : s <= 3.5 ? "Medium" : "Low";
}

/* ------------------------------- Validation ------------------------------ */

export type Severity = "error" | "warning" | "info";
export type IssueTab = "input" | "air" | "effluent" | "waste" | "production" | "prices" | "mapping" | "scope";

export interface Issue {
  key: string;
  code: string;
  severity: Severity;
  message: string;
  entityId?: string;
  tab: IssueTab;
  value?: string;
  reference?: string;
  /** Compliance findings are reported apart from LCIA (FR-04.5). */
  compliance?: boolean;
}

export interface BalanceCheck {
  inM3: number;
  outM3: number;
  closurePct: number;
}

export interface ValidationResult {
  issues: Issue[];
  errors: number;
  warnings: number;
  water: BalanceCheck;
  metal: { inputKg: number; coatingKg: number; closurePct: number } | null;
  completenessPct: number;
  stageCompleteness: Record<StageId, number>;
  avgPedigree: number;
  readyForApproval: boolean;
  readyForOfficialRun: boolean;
}

/** Literature benchmark per m² for 150 µm Ni (deck; Takuma et al. 2018). */
const NI_BENCHMARK = { niKg: [1.405, 1.735], kwh: [6.4, 8.7], waterL: [8, 13] } as const;

export function validate(project: Project, lci: LciResult, unmapped: string[]): ValidationResult {
  const issues: Issue[] = [];
  const add = (i: Omit<Issue, "key">) => issues.push({ ...i, key: `${i.code}:${i.entityId ?? "-"}` });
  const fmt = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });

  // Blocking rules (FR-04.1)
  for (const f of lci.flows) {
    if (f.error) add({ code: "UNIT_UNKNOWN", severity: "error", message: `${f.name}: ${f.error}`, entityId: f.id, tab: "input" });
  }
  const negatives = [
    ...project.inputs.filter((i) => i.quantity < 0).map((i) => ({ id: i.id, name: i.name, tab: "input" as const })),
    ...project.airEmissions.filter((a) => a.quantityKg < 0).map((a) => ({ id: a.id, name: a.parameter, tab: "air" as const })),
    ...project.waste.filter((w) => w.quantityKg < 0).map((w) => ({ id: w.id, name: w.wasteType, tab: "waste" as const })),
    ...project.effluent.filter((e) => e.value < 0).map((e) => ({ id: e.id, name: e.parameter, tab: "effluent" as const })),
  ];
  for (const n of negatives) add({ code: "NEGATIVE_VALUE", severity: "error", message: `${n.name} bernilai negatif. Pemakaian dan buangan tidak boleh kurang dari nol.`, entityId: n.id, tab: n.tab });
  if (!(lci.referenceFlow > 0)) {
    add({ code: "FU_ZERO", severity: "error", message: "Total luas dilapisi masih nol, jadi angka per m² belum bisa dihitung. Isi luas (atau jumlah part) di bagian Produksi.", tab: "production" });
  }
  if (project.inputs.some((i) => i.basis === "batch") && !(project.production.batches > 0)) {
    add({ code: "BATCH_ZERO", severity: "error", message: "Ada data yang dicatat per batch, tetapi jumlah batch dalam periode ini masih nol. Isi jumlah batch di bagian Produksi.", tab: "production" });
  }

  const stageCompleteness = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 } as Record<StageId, number>;
  let filled = 0;
  let total = 0;
  for (const stage of project.stages) {
    const rows = project.inputs.filter((i) => i.stageId === stage.id);
    const done = rows.filter((i) => i.quantity > 0).length;
    stageCompleteness[stage.id] = rows.length ? (done / rows.length) * 100 : stage.inBoundary ? 0 : 100;
    if (stage.inBoundary) {
      filled += done;
      total += rows.length;
      const hasEnergyOrChem = rows.some((i) => i.quantity > 0 && (i.category === "Energy" || CHEMICAL_CATEGORIES.includes(i.category)));
      // Utilities (E) and WWTP (F) can be energy-only; every in-boundary stage needs something.
      if (!hasEnergyOrChem) {
        add({ code: "STAGE_NO_DATA", severity: "error", message: `Tahap ${stage.name} ikut dihitung, tetapi belum ada data listrik atau bahan kimianya. Isi datanya atau keluarkan tahap ini dari perhitungan.`, entityId: stage.id, tab: "input" });
      }
    }
  }

  // Water balance (FR-04.3): in = product/evaporation/sludge + effluent, ±10%.
  const inM3 = lci.totals.waterL / 1000;
  const outM3 = project.production.effluentVolumeM3 + project.production.waterEvaporatedM3;
  const closurePct = inM3 > 0 ? (1 - Math.abs(inM3 - outM3) / inM3) * 100 : 0;
  if (inM3 > 0 && Math.abs(inM3 - outM3) / inM3 > 0.1) {
    add({
      code: "WATER_BALANCE",
      severity: "warning",
      message:
        outM3 > inM3
          ? `Air buangan dan penguapan (${fmt(outM3)} m³) lebih besar dari air masuk (${fmt(inM3)} m³). Periksa angka air masuk atau volume air buangan.`
          : `Ada ${fmt(inM3 - outM3)} m³ air masuk yang tidak tercatat keluar (air masuk ${fmt(inM3)} m³, keluar ${fmt(outM3)} m³). Periksa volume air buangan dan penguapan.`,
      tab: "production",
      value: `${fmt(outM3)} m³`,
      reference: `${fmt(inM3)} m³ ±10%`,
    });
  }

  // Metal balance (FR-04.4): metal in (anode + salts at main plating) vs coating ρ·A·t.
  let metal: ValidationResult["metal"] = null;
  if (lci.coatingMassKg > 0) {
    const inputKg = lci.flows
      .filter((f) => f.kind === "input" && f.stageId === "C" && (f.category === "Anode" || f.category === "Chemical"))
      .reduce((s, f) => s + f.quantity, 0);
    const closure = inputKg > 0 ? (lci.coatingMassKg / inputKg) * 100 : 0;
    metal = { inputKg, coatingKg: lci.coatingMassKg, closurePct: closure };
    if (inputKg < lci.coatingMassKg) {
      add({
        code: "METAL_BALANCE",
        severity: "warning",
        message: `Lapisan logam yang seharusnya terbentuk (${fmt(lci.coatingMassKg)} kg) lebih berat dari logam dan bahan kimia yang dimasukkan di tahap Plating Utama (${fmt(inputKg)} kg). Periksa ketebalan lapisan, luas, atau data anoda.`,
        tab: "production",
      });
    }
  }

  // Benchmark (F2 stage 1) for Ni ~150 µm per m².
  const ref = lci.referenceFlow;
  if (/^ni/i.test(project.production.coatingMetal) && project.scope.fuType === "m2" && ref > 0 && Math.abs(project.production.coatingThicknessUm - 150) <= 30) {
    const kwh = lci.totals.energyKwh / ref;
    if (kwh < NI_BENCHMARK.kwh[0] || kwh > NI_BENCHMARK.kwh[1]) {
      add({ code: "BENCHMARK_ENERGY", severity: "warning", message: `Listrik ${fmt(kwh)} kWh per m² berada di luar kisaran literatur untuk lapisan nikel 150 µm (${NI_BENCHMARK.kwh[0]}–${NI_BENCHMARK.kwh[1]} kWh per m²). Periksa angka meter.`, tab: "input" });
    }
    const water = lci.totals.waterL / ref;
    if (water < NI_BENCHMARK.waterL[0] || water > NI_BENCHMARK.waterL[1]) {
      add({ code: "BENCHMARK_WATER", severity: "warning", message: `Air ${fmt(water)} liter per m² berada di luar kisaran literatur (${NI_BENCHMARK.waterL[0]}–${NI_BENCHMARK.waterL[1]} liter per m²). Periksa angka flowmeter.`, tab: "input" });
    }
  }

  // Effluent limits (FR-04.5) → compliance findings.
  for (const e of project.effluent) {
    if (e.limit !== undefined && e.limit > 0 && e.value > e.limit && concentrationFactor(e.unit) !== null) {
      add({ code: "EFFLUENT_LIMIT", severity: "warning", compliance: true, message: `${e.parameter} di air buangan ${fmt(e.value)} ${e.unit}, melebihi batas yang diizinkan (${fmt(e.limit)} ${e.unit}).`, entityId: e.id, tab: "effluent", value: `${fmt(e.value)} ${e.unit}`, reference: `${fmt(e.limit)} ${e.unit}` });
    }
  }
  if (project.effluent.every((e) => e.limit === undefined)) {
    add({ code: "EFFLUENT_LIMIT_EMPTY", severity: "info", message: "Batas baku mutu air buangan belum diisi, jadi kepatuhan belum bisa dicek. Isi batasnya sesuai izin pembuangan fasilitas.", tab: "effluent" });
  }

  if (project.prices.isDemo) {
    add({ code: "PRICE_DEMO", severity: "warning", message: "Harga yang dipakai masih harga contoh. Ganti dengan harga dari faktur sebelum angka biaya dipakai untuk keputusan.", tab: "prices" });
  }
  if (unmapped.length > 0) {
    add({ code: "UNMAPPED", severity: "warning", message: `${unmapped.length} bahan belum punya data dampak dari database, jadi jejak karbonnya belum terhitung: ${unmapped.slice(0, 6).join(", ")}${unmapped.length > 6 ? ", …" : ""}. Hasil tetap bisa dilihat, tetapi belum bisa dijadikan hasil resmi.`, tab: "mapping" });
  }
  const lowRows = project.inputs.filter((i) => i.quantity > 0 && confidenceOf(i.meta) === "Low");
  if (lowRows.length > 0) {
    add({ code: "DQ_LOW", severity: "info", message: `${lowRows.length} angka masih perkiraan (keyakinan rendah): ${lowRows.slice(0, 5).map((r) => r.name).join(", ")}${lowRows.length > 5 ? ", …" : ""}. Ganti dengan data meter atau faktur bila ada.`, tab: "input" });
  }

  const accepted = project.dataset.acceptedWarnings;
  const errors = issues.filter((i) => i.severity === "error").length;
  const openWarnings = issues.filter((i) => i.severity === "warning" && !accepted[i.key]).length;
  const scores = project.inputs.filter((i) => i.quantity > 0).map((i) => pedigreeScore(i.meta.pedigree));

  return {
    issues,
    errors,
    warnings: issues.filter((i) => i.severity === "warning").length,
    water: { inM3, outM3, closurePct },
    metal,
    completenessPct: total > 0 ? (filled / total) * 100 : 0,
    stageCompleteness,
    avgPedigree: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    readyForApproval: errors === 0 && openWarnings === 0,
    readyForOfficialRun: errors === 0 && unmapped.length === 0 && project.dataset.status === "approved" && !!project.scope.lockedAt,
  };
}

export { STAGE_IDS };
