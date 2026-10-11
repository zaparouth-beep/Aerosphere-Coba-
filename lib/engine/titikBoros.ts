import { PROPER_INALUM_V1 } from "./factors";
import { driversOf } from "./study";
import type { DeviceRole, RunResult, StageCode } from "./types";
import { STAGE_CODES } from "./types";

/**
 * Titik Boros page model: per indicator, the share of each stage, its severity
 * class, per-m² values and the biggest drivers; per stage, a status and the
 * order of the explanation boxes. Only reads the run; no UI or text.
 */

export type Severity = "red" | "orange" | "yellow" | "green" | "grey";
export const SEVERITIES: Severity[] = ["red", "orange", "yellow", "green", "grey"];
const RANK: Record<Severity, number> = { red: 0, orange: 1, yellow: 2, green: 3, grey: 4 };

/** Default share at which a stage is a titik boros (spec §4.6); projects can change it. */
export const DEFAULT_THRESHOLD_PCT = 30;
export const ORANGE_FROM_PCT = 20;
export const YELLOW_FROM_PCT = 10;

/** Red ≥ threshold · orange 20 %–<threshold · yellow 10–<20 % · green >0–<10 % · grey 0 or not calculated. */
export function severityOf(share: number | null | undefined, thresholdPct: number = DEFAULT_THRESHOLD_PCT): Severity {
  if (share === null || share === undefined || !(share > 0)) return "grey";
  if (share >= thresholdPct) return "red";
  if (share >= ORANGE_FROM_PCT) return "orange";
  if (share >= YELLOW_FROM_PCT) return "yellow";
  return "green";
}

/** Impact rows in display order; only those with a computed total are shown. */
export const IMPACT_KEYS = ["gwp", "ap", "ep", "adp_fossil"] as const;
export const USE_KEYS = ["water", "waste_b3", "waste_value"] as const;
export type IndicatorKey = (typeof IMPACT_KEYS)[number] | (typeof USE_KEYS)[number];

export interface TitikBorosDriver {
  /** Source group for impacts (electricity, chemical, …) or the component category for use rows. */
  kind: string;
  /** Component name for use rows; empty for grouped impact drivers. */
  name: string;
  /** Value per period, in the row unit. */
  value: number;
  roles: DeviceRole[];
}

export interface TitikBorosRow {
  key: IndicatorKey;
  group: "impact" | "use";
  unit: string;
  /** Per 1 m² of plated surface. */
  perStage: Record<StageCode, number>;
  /** Per period. */
  perStagePeriod: Record<StageCode, number>;
  share: Record<StageCode, number>;
  severity: Record<StageCode, Severity>;
  totalPerFU: number;
  total: number;
  topStage: StageCode | null;
  drivers: Record<StageCode, TitikBorosDriver[]>;
}

export interface TitikBorosStage {
  stage: StageCode;
  status: Severity;
  /** Number of shown indicators in which the stage reaches its status. */
  statusCount: number;
  meanShare: number;
  /** Indicators where the stage is red or orange, in row order. */
  hot: Array<{ key: IndicatorKey; share: number; severity: Severity }>;
  /** First row (display order) where the stage reaches its status; its drivers explain the box. */
  mainIndicator: IndicatorKey | null;
}

export interface TitikBorosModel {
  thresholdPct: number;
  rows: TitikBorosRow[];
  stages: TitikBorosStage[];
  /** Impact categories of the reporting profile that have no factor yet. */
  notComputedCount: number;
  summary: { stage: StageCode | null; redCount: number; indicatorCount: number };
  periodArea: number;
}

const zero = (): Record<StageCode, number> => ({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 });
const emptyDrivers = (): Record<StageCode, TitikBorosDriver[]> => ({ A: [], B: [], C: [], D: [], E: [], F: [] });

const USE_UNIT: Record<(typeof USE_KEYS)[number], string> = { water: "L", waste_b3: "kg", waste_value: "Rp" };
const USE_KIND: Record<(typeof USE_KEYS)[number], string> = { water: "water", waste_b3: "waste_b3", waste_value: "waste_value" };

export function buildTitikBoros(run: RunResult, opts: { thresholdPct?: number } = {}): TitikBorosModel {
  const T = opts.thresholdPct && opts.thresholdPct > 0 ? opts.thresholdPct : DEFAULT_THRESHOLD_PCT;
  const area = run.areaPlatedM2 > 0 ? run.areaPlatedM2 : NaN;

  const makeRow = (key: IndicatorKey, group: TitikBorosRow["group"], unit: string, period: Record<StageCode, number>, drivers: Record<StageCode, TitikBorosDriver[]>): TitikBorosRow => {
    const total = STAGE_CODES.reduce((s, x) => s + Math.max(period[x], 0), 0);
    const share = zero();
    const severity = {} as Record<StageCode, Severity>;
    let top: StageCode | null = null;
    for (const s of STAGE_CODES) {
      share[s] = total > 0 ? (Math.max(period[s], 0) / total) * 100 : 0;
      severity[s] = severityOf(share[s], T);
      if (share[s] > 0 && (top === null || share[s] > share[top])) top = s;
    }
    const perStage = Object.fromEntries(STAGE_CODES.map((s) => [s, period[s] / area])) as Record<StageCode, number>;
    return { key, group, unit, perStage, perStagePeriod: period, share, severity, totalPerFU: total / area, total, topStage: top, drivers };
  };

  const rows: TitikBorosRow[] = [];
  for (const key of IMPACT_KEYS) {
    const impact = run.impacts.find((i) => i.category === key && i.total !== null);
    if (!impact) continue;
    const period = Object.fromEntries(STAGE_CODES.map((s) => [s, impact.perStage[s] ?? 0])) as Record<StageCode, number>;
    const drivers = emptyDrivers();
    for (const s of STAGE_CODES) drivers[s] = driversOf(impact, s).map((d) => ({ kind: d.source, name: "", value: d.value, roles: d.roles }));
    rows.push(makeRow(key, "impact", impact.unit, period, drivers));
  }

  for (const key of USE_KEYS) {
    const period =
      key === "water"
        ? (Object.fromEntries(STAGE_CODES.map((s) => [s, run.perStage[s].waterL])) as Record<StageCode, number>)
        : key === "waste_b3"
          ? (Object.fromEntries(STAGE_CODES.map((s) => [s, run.perStage[s].wasteB3Kg])) as Record<StageCode, number>)
          : { ...run.waste.perStage };
    const finding = run.hotspots.find((h) => h.indicator === key);
    const drivers = emptyDrivers();
    for (const r of finding?.ranking ?? []) drivers[r.stage] = r.drivers.map((d) => ({ kind: USE_KIND[key], name: d.name, value: d.value, roles: [] }));
    rows.push(makeRow(key, "use", USE_UNIT[key], period, drivers));
  }

  const stages: TitikBorosStage[] = STAGE_CODES.map((stage) => {
    let status: Severity = "grey";
    for (const r of rows) if (RANK[r.severity[stage]] < RANK[status]) status = r.severity[stage];
    const statusCount = rows.filter((r) => r.severity[stage] === status).length;
    const meanShare = rows.length ? rows.reduce((s, r) => s + r.share[stage], 0) / rows.length : 0;
    const hot = rows.filter((r) => r.severity[stage] === "red" || r.severity[stage] === "orange").map((r) => ({ key: r.key, share: r.share[stage], severity: r.severity[stage] }));
    const mainIndicator = status === "grey" ? null : (rows.find((r) => r.severity[stage] === status)?.key ?? null);
    return { stage, status, statusCount, meanShare, hot, mainIndicator };
  }).sort((a, b) => RANK[a.status] - RANK[b.status] || b.statusCount - a.statusCount || b.meanShare - a.meanShare);

  const computed = new Set(run.impacts.filter((i) => i.total !== null).map((i) => i.category));
  const notComputedCount = PROPER_INALUM_V1.categories.filter((c) => !computed.has(c.key)).length;
  const first = stages[0];

  return {
    thresholdPct: T,
    rows,
    stages,
    notComputedCount,
    summary: {
      stage: first && first.status !== "grey" ? first.stage : null,
      redCount: first ? rows.filter((r) => r.severity[first.stage] === "red").length : 0,
      indicatorCount: rows.length,
    },
    periodArea: run.areaPlatedM2,
  };
}
