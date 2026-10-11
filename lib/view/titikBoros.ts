import { NO_REASON, REFERENCES, reasonFor } from "@/lib/content/reasons";
import type { Project, StageId } from "@/lib/domain/types";
import { coatingTypeOf } from "@/lib/engine/inventory";
import type { LeverDef, ScenarioOutcome } from "@/lib/engine/scenario";
import type { IndicatorKey, Severity, TitikBorosDriver, TitikBorosModel, TitikBorosRow, TitikBorosStage } from "@/lib/engine/titikBoros";
import type { DeviceRole, StageCode } from "@/lib/engine/types";
import { STAGE_CODES, STAGES } from "@/lib/engine/types";
import { plainStage } from "@/lib/view/summary";

/**
 * Words and formatting for the Titik Boros page. Numbers come from the engine
 * (lib/engine/titikBoros.ts); this file only labels and formats them.
 */

/** Colour system shared by chart, table and boxes. Text contrast ≥ 4.5:1 on every fill (checked in tests). */
export const SEVERITY_STYLE: Record<Severity, { bg: string; fg: string; label: string; range: (t: number) => string }> = {
  red: { bg: "#A61B1B", fg: "#FFFFFF", label: "Titik boros", range: (t) => `≥ ${fmtNum(t)}%` },
  orange: { bg: "#E8731A", fg: "#1A1206", label: "Tinggi", range: (t) => `20% – < ${fmtNum(t)}%` },
  yellow: { bg: "#FBE27A", fg: "#1A1206", label: "Sedang", range: () => "10% – < 20%" },
  green: { bg: "#7CC48F", fg: "#0B1F12", label: "Rendah", range: () => "> 0% – < 10%" },
  grey: { bg: "#E4E2DC", fg: "#3A3A3A", label: "Tidak ada", range: () => "0 atau belum dihitung" },
};

export const BADGE: Record<Severity, string> = { red: "TITIK BOROS", orange: "TINGGI", yellow: "SEDANG", green: "RENDAH", grey: "TIDAK ADA" };

/** Plain-language row names (Mode Ringkas) and the technical name shown only in Mode Ahli tooltips. */
export const INDICATOR: Record<IndicatorKey, { label: string; expert: string }> = {
  gwp: { label: "Jejak karbon", expert: "Global warming potential (GWP100, skrining)" },
  ap: { label: "Potensi hujan asam", expert: "Acidification potential (AP, skrining)" },
  ep: { label: "Potensi pencemaran nutrien air", expert: "Eutrophication potential (EP, skrining)" },
  adp_fossil: { label: "Pemakaian bahan bakar fosil (abiotik fosil)", expert: "Abiotic depletion, fossil (ADP fosil, skrining)" },
  water: { label: "Pemakaian air", expert: "Inventori: air masuk (L)" },
  waste_b3: { label: "Limbah berbahaya (B3)", expert: "Inventori: limbah B3 (kg)" },
  waste_value: { label: "Nilai terbuang", expert: "Nilai terbuang §4.5 (Rp)" },
};

export const GROUP_LABEL = { impact: "Dampak lingkungan", use: "Pemakaian & buangan" } as const;

/** Two-line stage header (code + short name); the full name goes in the tooltip. */
export const STAGE_SHORT: Record<StageCode, string> = { A: "Pembersihan", B: "Pengikat", C: "Pelapisan", D: "Akhir", E: "Utilitas", F: "Air limbah" };

export const stageName = (project: Project, s: StageCode) => plainStage(project, s as StageId);

/** Unit shown with a value, e.g. "kg CO₂e"; Rp values carry the unit as a prefix. */
export function unitOf(row: Pick<TitikBorosRow, "unit">): string {
  return row.unit.replace(/ eq$/, "e");
}

export function fmtNum(v: number, digits = 1): string {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(v);
}

export function fmtPct(v: number): string {
  return `${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)}%`;
}

/** At most three significant digits, never scientific notation. */
export function fmt3(v: number): string {
  if (!Number.isFinite(v)) return "–";
  if (v === 0) return "0";
  return new Intl.NumberFormat("id-ID", { maximumSignificantDigits: 3 }).format(v);
}

export function fmtValue(v: number, row: Pick<TitikBorosRow, "unit">): string {
  return row.unit === "Rp" ? `Rp${fmt3(v)}` : `${fmt3(v)} ${unitOf(row)}`;
}

export const perFuText = (v: number, row: Pick<TitikBorosRow, "unit">) => `${fmtValue(v, row)} per m²`;

export const periodWord = (project: Project) => (project.periodMonths === 12 ? "per tahun" : "per periode");

export const ROLE: Record<DeviceRole, string> = {
  rectifier: "penyearah arus",
  heater: "pemanas",
  chiller: "chiller",
  oven: "oven",
  ventilation: "ventilasi",
  pump: "pompa",
  compressed_air: "udara tekan",
  di_ro: "unit air murni",
  wwtp: "pengolahan air limbah",
};

export const KIND: Record<string, string> = {
  electricity: "Listrik",
  chemical: "Bahan kimia",
  wwtp_chemical: "Bahan kimia pengolahan air limbah",
  water: "Air",
  fuel: "Bahan bakar",
  waste_b3: "Pengolahan limbah B3",
  direct_air: "Emisi udara langsung",
  direct_water: "Zat di air buangan",
};

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} dan ${items[items.length - 1]}`;
}

export function driverName(d: TitikBorosDriver): string {
  if (d.name) return d.name;
  const base = KIND[d.kind] ?? d.kind;
  return d.kind === "electricity" && d.roles.length ? `${base} (${list(d.roles.map((r) => ROLE[r]))})` : base;
}

export function driverText(d: TitikBorosDriver, row: Pick<TitikBorosRow, "unit">, project: Project): string {
  return `${driverName(d)}: ${fmtValue(d.value, row)} ${periodWord(project)}`;
}

/** Levers that can act on a stage (spec §6). */
export const STAGE_LEVERS: Record<StageCode, Array<LeverDef["id"]>> = {
  A: ["countercurrent", "dragout"],
  B: ["dragout", "countercurrent"],
  C: ["dragout", "bathConcentration", "rectifier", "mistSuppressant", "tankCover"],
  D: ["countercurrent", "dragout"],
  E: ["rectifier", "tankCover", "gridFactor"],
  F: ["dragout", "effluentTarget"],
};

/** One or two saved simulations that use a lever relevant to the stage and save money, best first. */
export function leversFor(stage: StageCode, outcomes: ScenarioOutcome[]): ScenarioOutcome[] {
  const ids = new Set<string>(STAGE_LEVERS[stage]);
  return outcomes
    .filter((o) => Object.keys(o.scenario.levers).some((k) => ids.has(k)) && o.lcc.annualSavingRp > 0)
    .sort((a, b) => b.lcc.annualSavingRp - a.lcc.annualSavingRp)
    .slice(0, 2);
}

export interface BoxReason {
  text: string;
  refs: Array<{ code: string; title: string; url?: string }>;
}

/** Technical reasons (§7) for the stage, from the top-2 drivers of each red/orange indicator. */
export function reasonsFor(project: Project, model: TitikBorosModel, box: TitikBorosStage): BoxReason[] {
  const coating = coatingTypeOf(project);
  const keys = box.hot.length ? box.hot.map((h) => h.key) : box.mainIndicator ? [box.mainIndicator] : [];
  const seen = new Set<string>();
  const out: BoxReason[] = [];
  for (const key of keys) {
    const row = model.rows.find((r) => r.key === key);
    for (const d of row?.drivers[box.stage].slice(0, 2) ?? []) {
      const r = reasonFor(coating, box.stage, d.kind, d.roles);
      if (!r || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ text: r.id, refs: r.refs.map((code) => ({ code, title: REFERENCES[code]?.title ?? code, url: REFERENCES[code]?.url })) });
    }
  }
  return out;
}

export const NO_REASON_TEXT = NO_REASON.id;

export function summarySentence(project: Project, model: TitikBorosModel): string | null {
  const s = model.summary;
  if (!s.stage) return null;
  if (s.redCount === 0) return `${stageName(project, s.stage)} adalah tahap paling boros, walaupun belum ada indikator yang mencapai ${fmtNum(model.thresholdPct)}%.`;
  return `${stageName(project, s.stage)} adalah titik boros terbesar: merah di ${s.redCount} dari ${s.indicatorCount} indikator.`;
}

export const fullStage = (s: StageCode) => `${s}. ${STAGES[s].nameId}`;

/** Tab-separated table for "Salin" (percent and per-m² values). */
export function tableTsv(project: Project, model: TitikBorosModel): string {
  const head = ["Indikator", "Satuan", ...STAGE_CODES.map((s) => `${s} ${stageName(project, s)} (%)`), "Total per m²"];
  const lines = [head.join("\t")];
  for (const r of model.rows) {
    lines.push([INDICATOR[r.key].label, `${r.unit === "Rp" ? "Rp" : unitOf(r)} per m²`, ...STAGE_CODES.map((s) => fmtNum(r.share[s], 1)), fmt3(r.totalPerFU)].join("\t"));
  }
  return lines.join("\n");
}
