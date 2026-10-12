import { getLang, tx } from "@/lib/i18n";
import type { ImpactId, ImpactVector, Project, StageId } from "@/lib/domain/types";
import { IMPACT_IDS, resolveFlowKey, zeroVector } from "./method";
import type { LciFlow, LciResult } from "./lci";

export type SourceKey = "electricity" | "water" | "chemicals" | "wwtpChemicals" | "consumables" | "wasteTreatment" | "directAir" | "directWater";

/** Display labels (follow the interface language); never stored in results. */
export const SOURCE_LABEL: Record<SourceKey, string> = {
  get electricity() { return tx("Listrik", "Electricity"); },
  get water() { return tx("Air proses", "Process water"); },
  get chemicals() { return tx("Kimia & anoda", "Chemicals & anodes"); },
  get wwtpChemicals() { return tx("Kimia IPAL", "WWTP chemicals"); },
  get consumables() { return tx("Consumable", "Consumables"); },
  get wasteTreatment() { return tx("Pengolahan limbah B3", "Hazardous (B3) waste treatment"); },
  get directAir() { return tx("Emisi udara langsung", "Direct air emissions"); },
  get directWater() { return tx("Efluen langsung", "Direct effluent"); },
};

export type GhgScope = "scope1" | "scope2" | "scope3cat1" | "scope3cat5";
export const SCOPE_LABEL: Record<GhgScope, string> = {
  get scope1() { return tx("Scope 1 — emisi langsung", "Scope 1 — direct emissions"); },
  get scope2() { return tx("Scope 2 — listrik dibeli", "Scope 2 — purchased electricity"); },
  get scope3cat1() { return tx("Scope 3 kat. 1 — barang dibeli", "Scope 3 cat. 1 — purchased goods"); },
  get scope3cat5() { return tx("Scope 3 kat. 5 — limbah", "Scope 3 cat. 5 — waste"); },
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
  /** Indonesian; `uncharacterisedEn` holds the same list in English (show with uncharacterisedText). */
  uncharacterised: string[];
  uncharacterisedEn?: string[];
  /** Indonesian; `errorsEn` holds the same list in English (show with lciaErrorsText). */
  errors: string[];
  errorsEn?: string[];
}

/** Flows without characterisation factors, in the interface language. */
export const uncharacterisedText = (l: Pick<LciaResult, "uncharacterised" | "uncharacterisedEn">): string[] =>
  getLang() === "en" && l.uncharacterisedEn ? l.uncharacterisedEn : l.uncharacterised;
/** Dataset/unit mismatch errors, in the interface language. */
export const lciaErrorsText = (l: Pick<LciaResult, "errors" | "errorsEn">): string[] => (getLang() === "en" && l.errorsEn ? l.errorsEn : l.errors);

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
  const uncharacterisedEn: string[] = [];
  const errors: string[] = [];
  const errorsEn: string[] = [];

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
      errorsEn.push(`Dataset "${ds.name}" is per ${ds.refUnit}, flow "${flow.name}" is in ${flow.unit}.`);
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
        uncharacterisedEn.push(`${flow.name} (${compartment})`);
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

  return { totals, perFu, uncertainty, byStage, bySource, ghgScopes, contributions, coverage, unmapped, uncharacterised, uncharacterisedEn, errors, errorsEn };
}
