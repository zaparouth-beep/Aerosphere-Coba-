import type { InputCategory, Project, StageId } from "@/lib/domain/types";
import { basisFactor, concentrationFactor, toCanonical } from "./units";

export const STAGE_IDS: StageId[] = ["A", "B", "C", "D", "E", "F"];

export const CHEMICAL_CATEGORIES: InputCategory[] = ["Chemical", "Anode", "WWTPChemical", "Consumable"];

export type StageRecord = Record<StageId, number>;

export function emptyStageRecord(): StageRecord {
  return { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
}

export interface LciFlow {
  id: string;
  kind: "input" | "air" | "waste" | "effluent";
  name: string;
  category: InputCategory | "AirEmission" | "Waste" | "Effluent";
  stageId: StageId;
  /** Quantity per reporting period in canonical unit. */
  quantity: number;
  unit: string;
  inBoundary: boolean;
  error?: string;
  uncertaintyPct: number;
}

export interface LciResult {
  /** Reference flow of the functional unit for the period (m², parts or kg). */
  referenceFlow: number;
  fuLabel: string;
  flows: LciFlow[];
  totals: { energyKwh: number; waterL: number; chemicalKg: number; wasteKg: number; effluentM3: number; airKg: number };
  byStage: { energy: StageRecord; water: StageRecord; chemical: StageRecord; waste: StageRecord };
  intensity: { energy: number; water: number; chemical: number; waste: number };
  /** Coating mass deposited per period, kg (m = ρ × A × t, FR-04.4). */
  coatingMassKg: number;
}

export const FU_LABEL: Record<Project["scope"]["fuType"], string> = { m2: "m²", part: "part", kg: "kg komponen" };

export function referenceFlow(project: Project): number {
  const p = project.production;
  const goodShare = 1 - Math.min(Math.max(p.reworkPct, 0), 99) / 100;
  const raw = project.scope.fuType === "m2" ? p.areaM2 : project.scope.fuType === "part" ? p.parts : p.componentMassKg;
  // Rework multiplies the burden per *good* unit (gap B4).
  return raw * goodShare;
}

export function coatingMassKg(project: Project): number {
  const p = project.production;
  return p.coatingDensityKgM3 * p.areaM2 * p.coatingThicknessUm * 1e-6;
}

export function computeLci(project: Project): LciResult {
  const { production, periodMonths } = project;
  const inBoundary = new Set(project.stages.filter((s) => s.inBoundary).map((s) => s.id));
  const flows: LciFlow[] = [];

  for (const input of project.inputs) {
    const conv = toCanonical(input.quantity, input.unit, input.category, production);
    const factor = basisFactor(input.basis, periodMonths, production.batches);
    flows.push({
      id: input.id,
      kind: "input",
      name: input.name,
      category: input.category,
      stageId: input.stageId,
      quantity: conv.ok ? conv.value * factor : 0,
      unit: conv.ok ? conv.unit : input.unit,
      inBoundary: inBoundary.has(input.stageId),
      error: conv.ok ? undefined : conv.error,
      uncertaintyPct: input.meta.uncertaintyPct,
    });
  }

  for (const air of project.airEmissions) {
    if (!air.applicable) continue;
    flows.push({
      id: air.id,
      kind: "air",
      name: air.parameter,
      category: "AirEmission",
      stageId: air.stageId,
      quantity: air.quantityKg * basisFactor(air.basis, periodMonths, production.batches),
      unit: "kg",
      inBoundary: inBoundary.has(air.stageId),
      uncertaintyPct: air.meta.uncertaintyPct,
    });
  }

  for (const w of project.waste) {
    flows.push({
      id: w.id,
      kind: "waste",
      name: w.wasteType,
      category: "Waste",
      stageId: w.stageId,
      quantity: w.quantityKg * basisFactor(w.basis, periodMonths, production.batches),
      unit: "kg",
      inBoundary: inBoundary.has(w.stageId),
      uncertaintyPct: w.meta.uncertaintyPct,
    });
  }

  // Effluent load = Q × C (PRD 2.2.4), attributed to the WWTP stage.
  for (const e of project.effluent) {
    const f = concentrationFactor(e.unit);
    if (f === null) continue;
    flows.push({
      id: e.id,
      kind: "effluent",
      name: e.parameter,
      category: "Effluent",
      stageId: "F",
      quantity: e.value * f * production.effluentVolumeM3,
      unit: "kg",
      inBoundary: inBoundary.has("F"),
      uncertaintyPct: 0,
    });
  }

  const byStage = {
    energy: emptyStageRecord(),
    water: emptyStageRecord(),
    chemical: emptyStageRecord(),
    waste: emptyStageRecord(),
  };
  const totals = { energyKwh: 0, waterL: 0, chemicalKg: 0, wasteKg: 0, effluentM3: production.effluentVolumeM3, airKg: 0 };

  for (const f of flows) {
    if (!f.inBoundary) continue;
    if (f.category === "Energy") {
      byStage.energy[f.stageId] += f.quantity;
      totals.energyKwh += f.quantity;
    } else if (f.category === "Water") {
      byStage.water[f.stageId] += f.quantity;
      totals.waterL += f.quantity;
    } else if (f.kind === "input" && CHEMICAL_CATEGORIES.includes(f.category as InputCategory)) {
      byStage.chemical[f.stageId] += f.quantity;
      totals.chemicalKg += f.quantity;
    } else if (f.kind === "waste") {
      byStage.waste[f.stageId] += f.quantity;
      totals.wasteKg += f.quantity;
    } else if (f.kind === "air") {
      totals.airKg += f.quantity;
    }
  }

  const ref = referenceFlow(project);
  const div = ref > 0 ? ref : NaN;
  return {
    referenceFlow: ref,
    fuLabel: FU_LABEL[project.scope.fuType],
    flows,
    totals,
    byStage,
    intensity: {
      energy: totals.energyKwh / div,
      water: totals.waterL / div,
      chemical: totals.chemicalKg / div,
      waste: totals.wasteKg / div,
    },
    coatingMassKg: coatingMassKg(project),
  };
}
