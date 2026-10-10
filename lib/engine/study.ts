import { PROPER_INALUM_V1 } from "./factors";
import type { DataQuality, DeviceRole, FactorSet, ImpactResult, RunResult, SourceGroup, StageCode } from "./types";
import { STAGE_CODES } from "./types";

/**
 * Numbers for the LCA study report (spec §8): the category table of the PROPER
 * profile, filled from the run where allowed, plus absolute values, the
 * cradle/gate classification, top-stage drivers and data quality. Only selects
 * and divides engine results; the report layer phrases them.
 */

/** §4.2.2: until the openLCA pipeline runs, only these may be filled from screening_v1 (labelled "skrining"). */
export const SCREENING_FILL = ["gwp", "ap", "ep"] as const;

/** §8.1 point 5: cradle point when upstream ≥ 50 %; gate point when gate ≥ 50 % or one stage ≥ 30 %. */
export const POINT_THRESHOLD_PCT = 50;
export const STAGE_THRESHOLD_PCT = 30;

export interface StudyDriver {
  source: SourceGroup;
  value: number;
  /** Device roles of the electricity rows in this group, in input order. */
  roles: DeviceRole[];
  names: string[];
}

export interface StudyRow {
  no: string;
  key: string;
  group: "primary" | "secondary" | "energy";
  labelId: string;
  labelEn: string;
  unit: string;
  method: string;
  /** "screening": filled from the screening profile; "computed": from a verified profile. */
  status: "computed" | "screening" | "not_computed";
  /** Components without a factor in a computed row (e.g. B3 waste for GWP). */
  missing: string[];
  share: Record<StageCode, number | null>;
  topStage: StageCode | null;
  total: number | null;
  perFU: number | null;
  cradle: number | null;
  gate: number | null;
  cradlePerFU: number | null;
  gatePerFU: number | null;
  cradlePct: number | null;
  gatePct: number | null;
  drivers: StudyDriver[];
}

export interface StudyModel {
  profileLabel: string;
  profileVersion: string;
  valuesVersion: string;
  areaM2: number;
  rows: StudyRow[];
  points: { cradle: string[]; gate: string[] };
  /** Normalisation factors (e.g. ReCiPe 2016 H). Null = not imported, so no cross-category ranking. */
  normalization: null;
  inventory: { key: "electricityKWh" | "waterL" | "chemicalKg" | "wasteB3Kg" | "effluentM3"; unit: string; perFU: number; total: number }[];
  dataQuality: DataQuality;
  dataConfidence: RunResult["dataConfidence"];
}

const empty = <T>(v: T): Record<StageCode, T> => ({ A: v, B: v, C: v, D: v, E: v, F: v });

function driversOf(impact: ImpactResult, stage: StageCode): StudyDriver[] {
  const groups = new Map<SourceGroup, StudyDriver>();
  for (const c of impact.contributions) {
    if (c.stage !== stage) continue;
    const g = groups.get(c.source) ?? { source: c.source, value: 0, roles: [], names: [] };
    g.value += c.value;
    g.names.push(c.name);
    if (c.deviceRole && !g.roles.includes(c.deviceRole)) g.roles.push(c.deviceRole);
    groups.set(c.source, g);
  }
  return [...groups.values()].filter((g) => g.value > 0).sort((a, b) => b.value - a.value);
}

export function buildStudyModel(run: RunResult, profile: FactorSet = PROPER_INALUM_V1): StudyModel {
  const area = run.areaPlatedM2;
  const perArea = (v: number | null) => (v !== null && area > 0 ? v / area : null);
  const fill = new Set<string>(SCREENING_FILL);

  const rows: StudyRow[] = profile.categories.map((cat) => {
    const base = {
      no: cat.no ?? "",
      key: cat.key,
      group: cat.group ?? "secondary",
      labelId: cat.labelId,
      labelEn: cat.labelEn,
      unit: cat.unit,
      method: cat.method,
    } as const;
    const impact = fill.has(cat.key) ? run.impacts.find((i) => i.category === cat.key && i.total !== null) : undefined;
    if (!impact || impact.total === null) {
      return {
        ...base,
        status: "not_computed",
        missing: [],
        share: empty<number | null>(null),
        topStage: null,
        total: null,
        perFU: null,
        cradle: null,
        gate: null,
        cradlePerFU: null,
        gatePerFU: null,
        cradlePct: null,
        gatePct: null,
        drivers: [],
      } satisfies StudyRow;
    }
    const total = impact.total;
    let top: StageCode | null = null;
    for (const s of STAGE_CODES) if ((impact.share[s] ?? 0) > 0 && (top === null || (impact.share[s] ?? 0) > (impact.share[top] ?? 0))) top = s;
    const pct = (v: number | null) => (v !== null && total > 0 ? (v / total) * 100 : null);
    return {
      ...base,
      status: profile.status === "verified" ? "computed" : "screening",
      missing: impact.missing,
      share: { ...impact.share },
      topStage: top,
      total,
      perFU: impact.perFU,
      cradle: impact.byPoint.cradle,
      gate: impact.byPoint.gate,
      cradlePerFU: perArea(impact.byPoint.cradle),
      gatePerFU: perArea(impact.byPoint.gate),
      cradlePct: pct(impact.byPoint.cradle),
      gatePct: pct(impact.byPoint.gate),
      drivers: top ? driversOf(impact, top) : [],
    } satisfies StudyRow;
  });

  const computed = rows.filter((r) => r.status !== "not_computed");
  const points = {
    cradle: computed.filter((r) => (r.cradlePct ?? 0) >= POINT_THRESHOLD_PCT).map((r) => r.key),
    gate: computed
      .filter((r) => (r.gatePct ?? 0) >= POINT_THRESHOLD_PCT || STAGE_CODES.some((s) => (r.share[s] ?? 0) >= STAGE_THRESHOLD_PCT))
      .map((r) => r.key),
  };

  const units = { electricityKWh: "kWh", waterL: "L", chemicalKg: "kg", wasteB3Kg: "kg", effluentM3: "m³" } as const;
  const inventory = (Object.keys(units) as Array<keyof typeof units>).map((key) => ({ key, unit: units[key], perFU: run.perFU[key], total: run.totals[key] }));

  return {
    profileLabel: profile.label ?? profile.profile,
    profileVersion: profile.version,
    valuesVersion: run.factorVersion,
    areaM2: area,
    rows,
    points,
    normalization: null,
    inventory,
    dataQuality: run.dataQuality,
    dataConfidence: run.dataConfidence,
  };
}
