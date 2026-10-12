import { NO_REASON, REFERENCES, reasonFor } from "@/lib/content/reasons";
import type { Project, StageId } from "@/lib/domain/types";
import { coatingTypeOf } from "@/lib/engine/inventory";
import type { LeverDef, ScenarioOutcome } from "@/lib/engine/scenario";
import type { IndicatorKey, Severity, TitikBorosDriver, TitikBorosModel, TitikBorosRow, TitikBorosStage } from "@/lib/engine/titikBoros";
import type { DeviceRole, StageCode } from "@/lib/engine/types";
import { STAGE_CODES } from "@/lib/engine/types";
import { locale, pick, tx } from "@/lib/i18n";
import { defaultStageName, plainStage } from "@/lib/view/summary";

/**
 * Words and formatting for the Titik Boros page. Numbers come from the engine
 * (lib/engine/titikBoros.ts); this file only labels and formats them.
 */

/** Colour system shared by chart, table and boxes. Text contrast ≥ 4.5:1 on every fill (checked in tests). */
export const SEVERITY_STYLE: Record<Severity, { bg: string; fg: string; label: string; range: (t: number) => string }> = {
  red: {
    bg: "#A61B1B",
    fg: "#FFFFFF",
    get label() {
      return tx("Titik boros", "Waste hotspot");
    },
    range: (t) => `≥ ${fmtNum(t)}%`,
  },
  orange: {
    bg: "#E8731A",
    fg: "#1A1206",
    get label() {
      return tx("Tinggi", "High");
    },
    range: (t) => `20% – < ${fmtNum(t)}%`,
  },
  yellow: {
    bg: "#FBE27A",
    fg: "#1A1206",
    get label() {
      return tx("Sedang", "Medium");
    },
    range: () => "10% – < 20%",
  },
  green: {
    bg: "#7CC48F",
    fg: "#0B1F12",
    get label() {
      return tx("Rendah", "Low");
    },
    range: () => "> 0% – < 10%",
  },
  grey: {
    bg: "#E4E2DC",
    fg: "#3A3A3A",
    get label() {
      return tx("Tidak ada", "None");
    },
    range: () => tx("0 atau belum dihitung", "0 or not calculated"),
  },
};

export const BADGE: Record<Severity, string> = {
  get red() {
    return tx("TITIK BOROS", "WASTE HOTSPOT");
  },
  get orange() {
    return tx("TINGGI", "HIGH");
  },
  get yellow() {
    return tx("SEDANG", "MEDIUM");
  },
  get green() {
    return tx("RENDAH", "LOW");
  },
  get grey() {
    return tx("TIDAK ADA", "NONE");
  },
};

/** Plain-language row names (Mode Ringkas) and the technical name shown only in Mode Ahli tooltips. */
export const INDICATOR: Record<IndicatorKey, { label: string; expert: string }> = {
  gwp: {
    get label() {
      return tx("Jejak karbon", "Carbon footprint");
    },
    get expert() {
      return tx("Global warming potential (GWP100, skrining)", "Global warming potential (GWP100, screening)");
    },
  },
  ap: {
    get label() {
      return tx("Potensi hujan asam", "Acid rain potential");
    },
    get expert() {
      return tx("Acidification potential (AP, skrining)", "Acidification potential (AP, screening)");
    },
  },
  ep: {
    get label() {
      return tx("Potensi pencemaran nutrien air", "Water nutrient pollution potential");
    },
    get expert() {
      return tx("Eutrophication potential (EP, skrining)", "Eutrophication potential (EP, screening)");
    },
  },
  adp_fossil: {
    get label() {
      return tx("Pemakaian bahan bakar fosil (abiotik fosil)", "Fossil fuel use (abiotic fossil)");
    },
    get expert() {
      return tx("Abiotic depletion, fossil (ADP fosil, skrining)", "Abiotic depletion, fossil (ADP fossil, screening)");
    },
  },
  water: {
    get label() {
      return tx("Pemakaian air", "Water use");
    },
    get expert() {
      return tx("Inventori: air masuk (L)", "Inventory: water in (L)");
    },
  },
  waste_b3: {
    get label() {
      return tx("Limbah berbahaya (B3)", "Hazardous (B3) waste");
    },
    get expert() {
      return tx("Inventori: limbah B3 (kg)", "Inventory: B3 waste (kg)");
    },
  },
  waste_value: {
    get label() {
      return tx("Nilai terbuang", "Wasted value");
    },
    get expert() {
      return tx("Nilai terbuang §4.5 (Rp)", "Wasted value §4.5 (Rp)");
    },
  },
};

export const GROUP_LABEL = {
  get impact() {
    return tx("Dampak lingkungan", "Environmental impact");
  },
  get use() {
    return tx("Pemakaian & buangan", "Use & discharge");
  },
};

/** Two-line stage header (code + short name); the full name goes in the tooltip. */
export const STAGE_SHORT: Record<StageCode, string> = {
  get A() {
    return tx("Pembersihan", "Pre-treatment");
  },
  get B() {
    return tx("Pengikat", "Strike");
  },
  get C() {
    return tx("Pelapisan", "Plating");
  },
  get D() {
    return tx("Akhir", "Post-treatment");
  },
  get E() {
    return tx("Utilitas", "Utilities");
  },
  get F() {
    return tx("Air limbah", "Wastewater");
  },
};

export const stageName = (project: Project, s: StageCode) => plainStage(project, s as StageId);

/** Unit shown with a value, e.g. "kg CO₂e"; Rp values carry the unit as a prefix. */
export function unitOf(row: Pick<TitikBorosRow, "unit">): string {
  return row.unit.replace(/ eq$/, "e");
}

export function fmtNum(v: number, digits = 1): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(v);
}

export function fmtPct(v: number): string {
  return `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)}%`;
}

/** At most three significant digits, never scientific notation. */
export function fmt3(v: number): string {
  if (!Number.isFinite(v)) return "–";
  if (v === 0) return "0";
  return new Intl.NumberFormat(locale(), { maximumSignificantDigits: 3 }).format(v);
}

export function fmtValue(v: number, row: Pick<TitikBorosRow, "unit">): string {
  return row.unit === "Rp" ? `Rp${fmt3(v)}` : `${fmt3(v)} ${unitOf(row)}`;
}

export const perFuText = (v: number, row: Pick<TitikBorosRow, "unit">) => `${fmtValue(v, row)} per m²`;

export const periodWord = (project: Project) => (project.periodMonths === 12 ? tx("per tahun", "per year") : tx("per periode", "per period"));

export const ROLE: Record<DeviceRole, string> = {
  get rectifier() {
    return tx("penyearah arus", "rectifier");
  },
  get heater() {
    return tx("pemanas", "heater");
  },
  get chiller() {
    return tx("chiller", "chiller");
  },
  get oven() {
    return tx("oven", "oven");
  },
  get ventilation() {
    return tx("ventilasi", "ventilation");
  },
  get pump() {
    return tx("pompa", "pump");
  },
  get compressed_air() {
    return tx("udara tekan", "compressed air");
  },
  get di_ro() {
    return tx("unit air murni", "pure water unit");
  },
  get wwtp() {
    return tx("pengolahan air limbah", "wastewater treatment");
  },
};

export const KIND: Record<string, string> = {
  get electricity() {
    return tx("Listrik", "Electricity");
  },
  get chemical() {
    return tx("Bahan kimia", "Chemicals");
  },
  get wwtp_chemical() {
    return tx("Bahan kimia pengolahan air limbah", "Wastewater treatment chemicals");
  },
  get water() {
    return tx("Air", "Water");
  },
  get fuel() {
    return tx("Bahan bakar", "Fuel");
  },
  get waste_b3() {
    return tx("Pengolahan limbah B3", "Hazardous (B3) waste treatment");
  },
  get direct_air() {
    return tx("Emisi udara langsung", "Direct air emissions");
  },
  get direct_water() {
    return tx("Zat di air buangan", "Substances in wastewater");
  },
};

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${tx("dan", "and")} ${items[items.length - 1]}`;
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
      out.push({ text: pick(r), refs: r.refs.map((code) => ({ code, title: REFERENCES[code]?.title ?? code, url: REFERENCES[code]?.url })) });
    }
  }
  return out;
}

export const noReasonText = () => pick(NO_REASON);

export function summarySentence(project: Project, model: TitikBorosModel): string | null {
  const s = model.summary;
  if (!s.stage) return null;
  if (s.redCount === 0)
    return tx(
      `${stageName(project, s.stage)} adalah tahap paling boros, walaupun belum ada indikator yang mencapai ${fmtNum(model.thresholdPct)}%.`,
      `${stageName(project, s.stage)} is the most wasteful stage, although no indicator has reached ${fmtNum(model.thresholdPct)}% yet.`,
    );
  return tx(
    `${stageName(project, s.stage)} adalah titik boros terbesar: merah di ${s.redCount} dari ${s.indicatorCount} indikator.`,
    `${stageName(project, s.stage)} is the biggest waste hotspot: red in ${s.redCount} of ${s.indicatorCount} indicators.`,
  );
}

export const fullStage = (s: StageCode) => `${s}. ${defaultStageName(s as StageId)}`;

/** Tab-separated table for "Salin" (percent and per-m² values). */
export function tableTsv(project: Project, model: TitikBorosModel): string {
  const head = [tx("Indikator", "Indicator"), tx("Satuan", "Unit"), ...STAGE_CODES.map((s) => `${s} ${stageName(project, s)} (%)`), "Total per m²"];
  const lines = [head.join("\t")];
  for (const r of model.rows) {
    lines.push([INDICATOR[r.key].label, `${r.unit === "Rp" ? "Rp" : unitOf(r)} per m²`, ...STAGE_CODES.map((s) => fmtNum(r.share[s], 1)), fmt3(r.totalPerFU)].join("\t"));
  }
  return lines.join("\n");
}
