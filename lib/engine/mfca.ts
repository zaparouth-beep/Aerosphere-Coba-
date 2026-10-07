import type { InputCategory, Project, StageId } from "@/lib/domain/types";
import { CHEMICAL_CATEGORIES, STAGE_IDS, type LciResult } from "./lci";

/** ISO 14051 cost categories (FR-07.2). */
export type MfcaCostKey = "material" | "energy" | "system" | "waste";

export const MFCA_COST_LABEL: Record<MfcaCostKey, string> = {
  material: "Material cost",
  energy: "Energy cost",
  system: "System cost",
  waste: "Waste management cost",
};

export interface MfcaStage {
  stageId: StageId;
  materialInKg: number;
  positiveKg: number;
  negativeKg: number;
  positiveRatio: number;
  cost: Record<MfcaCostKey, { positive: number; negative: number }>;
  costLossRp: number;
}

export interface MfcaResult {
  stages: MfcaStage[];
  totals: Record<MfcaCostKey, { positive: number; negative: number }>;
  totalCostRp: number;
  positiveCostRp: number;
  costLossRp: number;
  costPerFu: number;
  materialInKg: number;
  positiveKg: number;
  materialLossKg: number;
  internalCarbonCostRp: number;
  /** Flow lines with their cost, for traceability and the cost tables. */
  lines: Array<{ id: string; name: string; stageId: StageId; key: MfcaCostKey; quantity: number; unit: string; unitPriceRp: number; costRp: number; priceSource: "item" | "category" | "book" }>;
}

export function categoryPrice(project: Project, category: InputCategory): number {
  const p = project.prices;
  switch (category) {
    case "Energy":
      return p.energyRpPerKwh;
    case "Water":
      return p.waterRpPerL;
    case "WWTPChemical":
      return p.wwtpChemicalRpPerKg;
    case "Consumable":
      return p.consumableRpPerKg;
    default:
      return p.chemicalRpPerKg;
  }
}

function emptyCost(): Record<MfcaCostKey, { positive: number; negative: number }> {
  return {
    material: { positive: 0, negative: 0 },
    energy: { positive: 0, negative: 0 },
    system: { positive: 0, negative: 0 },
    waste: { positive: 0, negative: 0 },
  };
}

/**
 * Material balance: Input = positive product + negative product (ISO 14051).
 * Positive product is the deposited coating (m = ρ·A·t) at the main plating
 * stage; energy and system cost are split by each stage's material
 * distribution ratio; waste management cost is fully negative.
 */
export function computeMfca(project: Project, lci: LciResult, ccTotalKg: number): MfcaResult {
  const inputsById = new Map(project.inputs.map((i) => [i.id, i]));
  const lines: MfcaResult["lines"] = [];
  const materialIn: Record<StageId, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  const materialCost: Record<StageId, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  const waterCost: Record<StageId, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  const energyCost: Record<StageId, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  const wasteCost: Record<StageId, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };

  for (const flow of lci.flows) {
    if (!flow.inBoundary || flow.kind !== "input" || flow.error) continue;
    const input = inputsById.get(flow.id);
    if (!input) continue;
    const hasItemPrice = input.unitPriceRp !== undefined && input.unitPriceRp > 0;
    const price = hasItemPrice ? (input.unitPriceRp as number) : categoryPrice(project, input.category);
    const cost = flow.quantity * price;
    const isMaterial = CHEMICAL_CATEGORIES.includes(input.category);
    const key: MfcaCostKey = input.category === "Energy" ? "energy" : "material";
    if (isMaterial) {
      materialIn[flow.stageId] += flow.quantity;
      materialCost[flow.stageId] += cost;
    } else if (input.category === "Water") {
      waterCost[flow.stageId] += cost;
    } else {
      energyCost[flow.stageId] += cost;
    }
    lines.push({ id: flow.id, name: flow.name, stageId: flow.stageId, key, quantity: flow.quantity, unit: flow.unit, unitPriceRp: price, costRp: cost, priceSource: hasItemPrice ? "item" : "category" });
  }

  // Waste: treatment per kg + transport per destination trip, shared by mass.
  const wasteFlows = lci.flows.filter((f) => f.kind === "waste" && f.inBoundary);
  const wasteMass = wasteFlows.reduce((s, f) => s + f.quantity, 0);
  const destinations = new Map<string, number>();
  for (const w of project.waste) {
    const key = w.destination.trim().toLowerCase();
    destinations.set(key, Math.max(destinations.get(key) ?? 0, w.transportKm));
  }
  const trips = project.prices.wasteTripsPerPeriod > 0 ? project.prices.wasteTripsPerPeriod : 0;
  const transportTotal = [...destinations.values()].reduce((s, km) => s + km, 0) * trips * project.prices.wasteTransportRpPerKm;
  for (const f of wasteFlows) {
    const treat = f.quantity * project.prices.wasteTreatmentRpPerKg;
    const transport = wasteMass > 0 ? transportTotal * (f.quantity / wasteMass) : 0;
    wasteCost[f.stageId] += treat + transport;
    lines.push({ id: f.id, name: f.name, stageId: f.stageId, key: "waste", quantity: f.quantity, unit: "kg", unitPriceRp: project.prices.wasteTreatmentRpPerKg, costRp: treat + transport, priceSource: "book" });
  }

  // System cost allocation key: labour hours per stage, else equal over in-boundary stages.
  const inBoundary = project.stages.filter((s) => s.inBoundary).map((s) => s.id);
  const hoursTotal = inBoundary.reduce((s, id) => s + (project.laborHoursByStage[id] ?? 0), 0);
  const systemTotal = project.prices.laborRpPerPeriod + project.prices.depreciationRpPerPeriod;
  const systemShare = (id: StageId) =>
    !inBoundary.includes(id) ? 0 : hoursTotal > 0 ? (project.laborHoursByStage[id] ?? 0) / hoursTotal : 1 / Math.max(inBoundary.length, 1);

  const coating = lci.coatingMassKg;
  const totalMaterial = STAGE_IDS.reduce((s, id) => s + materialIn[id], 0);
  const positiveC = Math.min(coating, materialIn.C);
  const overallRatio = totalMaterial > 0 ? positiveC / totalMaterial : 0;

  const stages: MfcaStage[] = STAGE_IDS.map((id) => {
    const positiveKg = id === "C" ? positiveC : 0;
    const ratio = materialIn[id] > 0 ? positiveKg / materialIn[id] : overallRatio;
    const cost = emptyCost();
    cost.material.positive = materialCost[id] * ratio;
    cost.material.negative = materialCost[id] * (1 - ratio) + waterCost[id];
    cost.energy.positive = energyCost[id] * ratio;
    cost.energy.negative = energyCost[id] * (1 - ratio);
    const sys = systemTotal * systemShare(id);
    cost.system.positive = sys * ratio;
    cost.system.negative = sys * (1 - ratio);
    cost.waste.negative = wasteCost[id];
    const costLossRp = cost.material.negative + cost.energy.negative + cost.system.negative + cost.waste.negative;
    return { stageId: id, materialInKg: materialIn[id], positiveKg, negativeKg: materialIn[id] - positiveKg, positiveRatio: ratio, cost, costLossRp };
  });

  const totals = emptyCost();
  for (const s of stages) {
    for (const k of Object.keys(totals) as MfcaCostKey[]) {
      totals[k].positive += s.cost[k].positive;
      totals[k].negative += s.cost[k].negative;
    }
  }
  const positiveCostRp = Object.values(totals).reduce((s, c) => s + c.positive, 0);
  const costLossRp = Object.values(totals).reduce((s, c) => s + c.negative, 0);
  const totalCostRp = positiveCostRp + costLossRp;
  const ref = lci.referenceFlow > 0 ? lci.referenceFlow : NaN;

  return {
    stages,
    totals,
    totalCostRp,
    positiveCostRp,
    costLossRp,
    costPerFu: totalCostRp / ref,
    materialInKg: totalMaterial,
    positiveKg: positiveC,
    materialLossKg: totalMaterial - positiveC,
    internalCarbonCostRp: ccTotalKg * project.prices.carbonPriceRpPerKgCO2e,
    lines,
  };
}
