import type { ImpactId, ImpactVector, Project, StageId } from "@/lib/domain/types";
import { IMPACT_IDS, resolveFlowKey, zeroVector } from "./method";
import type { LciFlow, LciResult } from "./lci";

export type SourceKey = "electricity" | "water" | "chemicals" | "wwtpChemicals" | "consumables" | "wasteTreatment" | "directAir" | "directWater";

export const SOURCE_LABEL: Record<SourceKey, string> = {
  electricity: "Listrik",
  water: "Air proses",
  chemicals: "Kimia & anoda",
  wwtpChemicals: "Kimia IPAL",
  consumables: "Consumable",
  wasteTreatment: "Pengolahan limbah B3",
  directAir: "Emisi udara langsung",
  directWater: "Efluen langsung",
};

export type GhgScope = "scope1" | "scope2" | "scope3cat1" | "scope3cat5";
export const SCOPE_LABEL: Record<GhgScope, string> = {
  scope1: "Scope 1 — emisi langsung",
  scope2: "Scope 2 — listrik dibeli",
  scope3cat1: "Scope 3 kat. 1 — barang dibeli",
  scope3cat5: "Scope 3 kat. 5 — limbah",
};

export interface Contribution {
  flowId: string;
  name: string;
  source: SourceKey;
  stageId: StageId;
  quantity: number;
  unit: string;
  dataset?: string;
  values: ImpactVector;
  covered: Record<ImpactId, boolean>;
  needsBackground: boolean;
  uncertaintyPct: number;
}

export interface CoverageRow {
  impact: ImpactId;
  covered: number;
  total: number;
  missing: string[];
}

export interface LciaResult {
  totals: ImpactVector;
  perFu: ImpactVector;
  uncertainty: ImpactVector;
  byStage: Record<StageId, ImpactVector>;
  bySource: Record<SourceKey, ImpactVector>;
  ghgScopes: Record<GhgScope, number>;
  contributions: Contribution[];
  coverage: CoverageRow[];
  unmapped: string[];
  uncharacterised: string[];
  errors: string[];
}

function coveredAll(v: boolean): Record<ImpactId, boolean> {
  return Object.fromEntries(IMPACT_IDS.map((id) => [id, v])) as Record<ImpactId, boolean>;
}

const CATEGORY_SOURCE: Record<string, SourceKey> = {
  Energy: "electricity",
  Water: "water",
  Chemical: "chemicals",
  Anode: "chemicals",
  WWTPChemical: "wwtpChemicals",
  Consumable: "consumables",
};

/**
 * Impact_k = Σ_i g_i × CF_i,k (FR-06.1). Background inputs carry aggregated
 * cradle-to-gate factors (system processes, PRD 2.2.3); direct emissions are
 * characterised with the method package.
 */
export function computeLcia(project: Project, lci: LciResult): LciaResult {
  const datasets = new Map(project.backgrounds.map((d) => [d.id, d]));
  const flowCf = new Map(project.method.flows.map((f) => [f.key, f]));
  const includeUpstream = project.scope.boundary !== "gate-to-gate";
  const includeWasteTreatment = project.scope.boundary === "cradle-to-gate";
  const contributions: Contribution[] = [];
  const unmapped: string[] = [];
  const uncharacterised: string[] = [];
  const errors: string[] = [];

  const inputsById = new Map(project.inputs.map((i) => [i.id, i]));
  const wasteById = new Map(project.waste.map((w) => [w.id, w]));
  const airById = new Map(project.airEmissions.map((a) => [a.id, a]));
  const effById = new Map(project.effluent.map((e) => [e.id, e]));

  const pushBackground = (flow: LciFlow, source: SourceKey, mappingDatasetId: string | undefined, status: string) => {
    const values = zeroVector();
    const covered = coveredAll(false);
    const ds = mappingDatasetId ? datasets.get(mappingDatasetId) : undefined;
    if (status === "unmapped" || !ds) {
      unmapped.push(flow.name);
    } else if (ds.refUnit !== flow.unit) {
      errors.push(`Dataset "${ds.name}" per ${ds.refUnit}, aliran "${flow.name}" dalam ${flow.unit}.`);
    } else {
      for (const id of IMPACT_IDS) {
        const f = ds.factors[id];
        if (f !== undefined && Number.isFinite(f)) {
          values[id] = flow.quantity * f;
          covered[id] = true;
        }
      }
    }
    contributions.push({
      flowId: flow.id,
      name: flow.name,
      source,
      stageId: flow.stageId,
      quantity: flow.quantity,
      unit: flow.unit,
      dataset: ds?.name,
      values,
      covered,
      needsBackground: true,
      uncertaintyPct: flow.uncertaintyPct,
    });
  };

  for (const flow of lci.flows) {
    if (!flow.inBoundary || flow.quantity <= 0 || flow.error) continue;
    if (flow.kind === "input") {
      if (!includeUpstream) continue;
      const input = inputsById.get(flow.id);
      if (!input) continue;
      pushBackground(flow, CATEGORY_SOURCE[input.category] ?? "chemicals", input.mapping.datasetId, input.mapping.status);
    } else if (flow.kind === "waste") {
      if (!includeWasteTreatment) continue;
      const w = wasteById.get(flow.id);
      if (!w) continue;
      pushBackground(flow, "wasteTreatment", w.mapping.datasetId, w.mapping.status);
    } else {
      const compartment = flow.kind === "air" ? "air" : "water";
      const flowKey =
        flow.kind === "air" ? airById.get(flow.id)?.flowKey : effById.get(flow.id)?.flowKey;
      const key = resolveFlowKey(flow.name, flowKey, compartment);
      const cf = key ? flowCf.get(key) : undefined;
      const values = zeroVector();
      let any = false;
      if (cf) {
        for (const id of IMPACT_IDS) {
          const f = cf.factors[id];
          if (f !== undefined) {
            values[id] = flow.quantity * f;
            any = true;
          }
        }
      }
      if (!any) {
        uncharacterised.push(`${flow.name} (${compartment === "air" ? "udara" : "air"})`);
        continue;
      }
      contributions.push({
        flowId: flow.id,
        name: `${flow.name} → ${cf!.label}`,
        source: flow.kind === "air" ? "directAir" : "directWater",
        stageId: flow.stageId,
        quantity: flow.quantity,
        unit: "kg",
        values,
        covered: coveredAll(true),
        needsBackground: false,
        uncertaintyPct: flow.uncertaintyPct,
      });
    }
  }

  const totals = zeroVector();
  const variance = zeroVector();
  const byStage = { A: zeroVector(), B: zeroVector(), C: zeroVector(), D: zeroVector(), E: zeroVector(), F: zeroVector() };
  const bySource = Object.fromEntries(Object.keys(SOURCE_LABEL).map((k) => [k, zeroVector()])) as Record<SourceKey, ImpactVector>;
  const ghgScopes: Record<GhgScope, number> = { scope1: 0, scope2: 0, scope3cat1: 0, scope3cat5: 0 };

  for (const c of contributions) {
    for (const id of IMPACT_IDS) {
      totals[id] += c.values[id];
      byStage[c.stageId][id] += c.values[id];
      bySource[c.source][id] += c.values[id];
      variance[id] += (c.values[id] * (c.uncertaintyPct / 100)) ** 2;
    }
    const scope: GhgScope =
      c.source === "electricity"
        ? "scope2"
        : c.source === "directAir" || c.source === "directWater"
          ? "scope1"
          : c.source === "wasteTreatment"
            ? "scope3cat5"
            : "scope3cat1";
    ghgScopes[scope] += c.values.cc;
  }

  const ref = lci.referenceFlow > 0 ? lci.referenceFlow : NaN;
  const perFu = zeroVector();
  const uncertainty = zeroVector();
  for (const id of IMPACT_IDS) {
    perFu[id] = totals[id] / ref;
    uncertainty[id] = Math.sqrt(variance[id]);
  }

  const bg = contributions.filter((c) => c.needsBackground);
  const coverage = IMPACT_IDS.map((impact) => ({
    impact,
    covered: bg.filter((c) => c.covered[impact]).length,
    total: bg.length,
    missing: bg.filter((c) => !c.covered[impact]).map((c) => c.name),
  }));

  return { totals, perFu, uncertainty, byStage, bySource, ghgScopes, contributions, coverage, unmapped, uncharacterised, errors };
}
