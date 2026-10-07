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
