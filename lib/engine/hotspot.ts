import type { ImpactId, Project, StageId } from "@/lib/domain/types";
import { STAGE_IDS, type LciResult } from "./lci";
import type { LciaResult } from "./lcia";
import type { MfcaResult } from "./mfca";
import { IMPACT_IDS } from "./method";

export type HotspotMetric = "energy" | "water" | "chemical" | "waste" | "costLoss" | ImpactId;

export const OPERATIONAL_METRICS: Array<{ id: HotspotMetric; label: string }> = [
  { id: "energy", label: "Energi" },
  { id: "water", label: "Air" },
  { id: "chemical", label: "Kimia" },
  { id: "waste", label: "Limbah B3" },
  { id: "costLoss", label: "Cost loss" },
];

export interface HotspotWeights {
  environment: number;
  costLoss: number;
  ease: number;
  compliance: number;
}

export const DEFAULT_WEIGHTS: HotspotWeights = { environment: 40, costLoss: 25, ease: 20, compliance: 15 };

export interface HotspotResult {
  metrics: HotspotMetric[];
  /** share[stage][metric] in %, FR-08.1. */
  share: Record<StageId, Partial<Record<HotspotMetric, number>>>;
  priority: Array<{ stageId: StageId; score: number; environment: number; costLoss: number; ease: number; compliance: number }>;
}

function shares(values: Record<StageId, number>): Record<StageId, number> {
  const total = STAGE_IDS.reduce((s, id) => s + Math.max(values[id], 0), 0);
  return Object.fromEntries(STAGE_IDS.map((id) => [id, total > 0 ? (Math.max(values[id], 0) / total) * 100 : 0])) as Record<StageId, number>;
}

export function computeHotspots(
  project: Project,
  lci: LciResult,
  lcia: LciaResult,
  mfca: MfcaResult,
  weights: HotspotWeights = DEFAULT_WEIGHTS,
): HotspotResult {
  const metricValues: Partial<Record<HotspotMetric, Record<StageId, number>>> = {
    energy: lci.byStage.energy,
    water: lci.byStage.water,
    chemical: lci.byStage.chemical,
    waste: lci.byStage.waste,
    costLoss: Object.fromEntries(mfca.stages.map((s) => [s.stageId, s.costLossRp])) as Record<StageId, number>,
  };
  for (const id of IMPACT_IDS) {
    if (lcia.totals[id] > 0) {
      metricValues[id] = Object.fromEntries(STAGE_IDS.map((s) => [s, lcia.byStage[s][id]])) as Record<StageId, number>;
    }
  }
  const metrics = Object.keys(metricValues) as HotspotMetric[];
  const share = Object.fromEntries(STAGE_IDS.map((s) => [s, {}])) as HotspotResult["share"];
  for (const m of metrics) {
    const sh = shares(metricValues[m]!);
    for (const s of STAGE_IDS) share[s][m] = sh[s];
  }

  const envMetrics = metrics.filter((m) => m !== "costLoss");
  const wSum = weights.environment + weights.costLoss + weights.ease + weights.compliance || 1;
  const priority = STAGE_IDS.map((stageId) => {
    const environment = envMetrics.length ? envMetrics.reduce((s, m) => s + (share[stageId][m] ?? 0), 0) / envMetrics.length / 100 : 0;
    const costLoss = (share[stageId].costLoss ?? 0) / 100;
    const ease = ((project.stageEase[stageId] ?? 3) - 1) / 4;
    const compliance = ((project.stageComplianceRisk[stageId] ?? 3) - 1) / 4;
    const score =
      ((weights.environment * environment + weights.costLoss * costLoss + weights.ease * ease + weights.compliance * compliance) / wSum) * 100;
    return { stageId, score, environment: environment * 100, costLoss: costLoss * 100, ease: ease * 100, compliance: compliance * 100 };
  }).sort((a, b) => b.score - a.score);

  return { metrics, share, priority };
}

export interface ParetoRow {
  name: string;
  stageId: StageId;
  value: number;
  sharePct: number;
  cumulativePct: number;
  top20: boolean;
}

/** Flows ranked by contribution with cumulative share (Pareto, FR-08.2). */
export function pareto(items: Array<{ name: string; stageId: StageId; value: number }>): ParetoRow[] {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, i) => s + i.value, 0);
  const topN = Math.max(1, Math.ceil(sorted.length * 0.2));
  let cum = 0;
  return sorted.map((i, idx) => {
    cum += i.value;
    return { ...i, sharePct: total > 0 ? (i.value / total) * 100 : 0, cumulativePct: total > 0 ? (cum / total) * 100 : 0, top20: idx < topN };
  });
}

/* ----------------------- Titik boros rule (spec §4.6) ---------------------- */

export interface IndicatorInput {
  indicator: string;
  /** Value per stage; stages with 0 are ranked but never flagged. */
  perStage: Record<StageId, number>;
  /** Per-component contributions used to name the top-3 drivers of a stage. */
  contributions: Array<{ componentId: string; name: string; stage: StageId; value: number }>;
}

/** A stage is a titik boros when its share ≥ threshold or it ranks first. */
export function findHotspots(inputs: IndicatorInput[], thresholdPct = 30): HotspotFindingLite[] {
  return inputs.map(({ indicator, perStage, contributions }) => {
    const total = STAGE_IDS.reduce((s, id) => s + Math.max(perStage[id], 0), 0);
    const ranking = STAGE_IDS.map((stage) => ({ stage, value: perStage[stage], share: total > 0 ? (Math.max(perStage[stage], 0) / total) * 100 : 0 }))
      .sort((a, b) => b.share - a.share)
      .map((r, i) => {
        const stageTotal = Math.max(r.value, 0);
        const drivers = contributions
          .filter((c) => c.stage === r.stage && c.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map((c) => ({ componentId: c.componentId, name: c.name, value: c.value, sharePct: stageTotal > 0 ? (c.value / stageTotal) * 100 : 0 }));
        return { ...r, rank: i + 1, drivers };
      });
    const flagged = total > 0 ? ranking.filter((r) => r.value > 0 && (r.share >= thresholdPct || r.rank === 1)) : [];
    return { indicator, thresholdPct, ranking, flagged };
  });
}

export interface HotspotFindingLite {
  indicator: string;
  thresholdPct: number;
  ranking: Array<{ stage: StageId; value: number; share: number; rank: number; drivers: Array<{ componentId: string; name: string; value: number; sharePct: number }> }>;
  flagged: HotspotFindingLite["ranking"];
}
