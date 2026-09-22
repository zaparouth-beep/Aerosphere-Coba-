import { PROCESS_STAGES } from "./constants";
import type {
  CostConfig,
  HazardousWasteEntry,
  HotspotRow,
  IntensityMetrics,
  LCICategory,
  LCIInputEntry,
  Project,
  ProcessStageId,
} from "./types";

/** Categories treated as "material/chemical input" for the Chemical Intensity (CI)
 * formula — matches the deck's WWTP row showing a non-zero Chemical % (reducing
 * agent, oxidant, lime, coagulant all counted as chemical input). */
export const CHEMICAL_LIKE_CATEGORIES: LCICategory[] = [
  "Chemical",
  "WWTPChemical",
  "Anode",
  "Consumable",
];

function emptyStageRecord(): Record<ProcessStageId, number> {
  return PROCESS_STAGES.reduce(
    (acc, stage) => ({ ...acc, [stage.id]: 0 }),
    {} as Record<ProcessStageId, number>,
  );
}

export function sumByStage(
  entries: LCIInputEntry[],
  categories?: LCICategory[],
): Record<ProcessStageId, number> {
  const totals = emptyStageRecord();
  for (const entry of entries) {
    if (categories && !categories.includes(entry.category)) continue;
    totals[entry.stageId] += entry.quantity;
  }
  return totals;
}

export function sumWasteByStage(
  waste: HazardousWasteEntry[],
): Record<ProcessStageId, number> {
  const totals = emptyStageRecord();
  for (const w of waste) {
    totals[w.sourceStageId] += w.quantityKgMonth;
  }
  return totals;
}

export function totalQuantity(
  entries: LCIInputEntry[],
  categories?: LCICategory[],
): number {
  return entries.reduce((sum, e) => {
    if (categories && !categories.includes(e.category)) return sum;
    return sum + e.quantity;
  }, 0);
}

export function totalWaste(waste: HazardousWasteEntry[]): number {
  return waste.reduce((sum, w) => sum + w.quantityKgMonth, 0);
}

function toPercentRow(
  totals: Record<ProcessStageId, number>,
  grandTotal: number,
): Record<ProcessStageId, number> {
  const pct = emptyStageRecord();
  if (grandTotal <= 0) return pct;
  for (const stage of PROCESS_STAGES) {
    pct[stage.id] = (totals[stage.id] / grandTotal) * 100;
  }
  return pct;
}

export function computeHotspotTable(project: Project): HotspotRow[] {
  const energyByStage = sumByStage(project.lciInputs, ["Energy"]);
  const waterByStage = sumByStage(project.lciInputs, ["Water"]);
  const chemicalByStage = sumByStage(project.lciInputs, CHEMICAL_LIKE_CATEGORIES);
  const wasteByStage = sumWasteByStage(project.hazardousWaste);

  const energyTotal = Object.values(energyByStage).reduce((a, b) => a + b, 0);
  const waterTotal = Object.values(waterByStage).reduce((a, b) => a + b, 0);
  const chemicalTotal = Object.values(chemicalByStage).reduce((a, b) => a + b, 0);
  const wasteTotal = Object.values(wasteByStage).reduce((a, b) => a + b, 0);

  const energyPct = toPercentRow(energyByStage, energyTotal);
  const waterPct = toPercentRow(waterByStage, waterTotal);
  const chemicalPct = toPercentRow(chemicalByStage, chemicalTotal);
  const wastePct = toPercentRow(wasteByStage, wasteTotal);

  return PROCESS_STAGES.map((stage) => ({
    stageId: stage.id,
    energyPct: energyPct[stage.id],
    waterPct: waterPct[stage.id],
    chemicalPct: chemicalPct[stage.id],
    wastePct: wastePct[stage.id],
  }));
}

export type HotspotKey = "energyPct" | "waterPct" | "chemicalPct" | "wastePct";

export function findHotspotStage(
  rows: HotspotRow[],
  key: HotspotKey,
): ProcessStageId | null {
  let best: HotspotRow | null = null;
  for (const row of rows) {
    if (row[key] <= 0) continue;
    if (!best || row[key] > best[key]) best = row;
  }
  return best?.stageId ?? null;
}

export function functionalUnitDivisor(project: Project): number {
  return project.functionalUnit.value > 0 ? project.functionalUnit.value : 1;
}

export function computeIntensities(project: Project): IntensityMetrics {
  const fu = functionalUnitDivisor(project);
  const totalEnergy = totalQuantity(project.lciInputs, ["Energy"]);
  const totalWater = totalQuantity(project.lciInputs, ["Water"]);
  const totalChemical = totalQuantity(project.lciInputs, CHEMICAL_LIKE_CATEGORIES);
  const totalWasteKg = totalWaste(project.hazardousWaste);

  return {
    energyIntensity: totalEnergy / fu,
    waterIntensity: totalWater / fu,
    chemicalIntensity: totalChemical / fu,
    wasteIntensity: totalWasteKg / fu,
  };
}

/** Simplified, clearly-labelled emission factors used only for an indicative GHG
 * estimate in the demo — swap for a verified LCIA database (e.g. ecoinvent) before
 * using these numbers for real reporting. */
export const EMISSION_FACTORS = {
  gridElectricityKgCO2ePerKwh: 0.85,
  chemicalGenericKgCO2ePerKg: 2.5,
  waterTreatmentKgCO2ePerL: 0.0003,
};

export interface EnvironmentalImpactSummary {
  totalEnergyKwh: number;
  totalWaterL: number;
  totalChemicalKg: number;
  totalWasteKgB3: number;
  totalAirEmissionKg: number;
  ghgFromEnergyKgCO2e: number;
  ghgFromChemicalKgCO2e: number;
  ghgFromWaterKgCO2e: number;
  totalGhgKgCO2e: number;
  ghgPerFunctionalUnit: number;
}

export function computeEnvironmentalImpact(project: Project): EnvironmentalImpactSummary {
  const fu = functionalUnitDivisor(project);
  const totalEnergyKwh = totalQuantity(project.lciInputs, ["Energy"]);
  const totalWaterL = totalQuantity(project.lciInputs, ["Water"]);
  const totalChemicalKg = totalQuantity(project.lciInputs, CHEMICAL_LIKE_CATEGORIES);
  const totalWasteKgB3 = totalWaste(project.hazardousWaste);
  const totalAirEmissionKg = project.airEmissions
    .filter((e) => e.applicable)
    .reduce((sum, e) => sum + e.valueKgPerPeriod, 0);

  const ghgFromEnergyKgCO2e = totalEnergyKwh * EMISSION_FACTORS.gridElectricityKgCO2ePerKwh;
  const ghgFromChemicalKgCO2e = totalChemicalKg * EMISSION_FACTORS.chemicalGenericKgCO2ePerKg;
  const ghgFromWaterKgCO2e = totalWaterL * EMISSION_FACTORS.waterTreatmentKgCO2ePerL;
  const totalGhgKgCO2e = ghgFromEnergyKgCO2e + ghgFromChemicalKgCO2e + ghgFromWaterKgCO2e;

  return {
    totalEnergyKwh,
    totalWaterL,
    totalChemicalKg,
    totalWasteKgB3,
    totalAirEmissionKg,
    ghgFromEnergyKgCO2e,
    ghgFromChemicalKgCO2e,
    ghgFromWaterKgCO2e,
    totalGhgKgCO2e,
    ghgPerFunctionalUnit: totalGhgKgCO2e / fu,
  };
}

export interface CostBreakdownItem {
  key: string;
  label: string;
  totalRp: number;
}

export interface CostSummary {
  items: CostBreakdownItem[];
  totalRp: number;
  costPerFunctionalUnit: number;
}

export function computeCostBreakdown(project: Project): CostSummary {
  const fu = functionalUnitDivisor(project);
  const cfg: CostConfig = project.costConfig;

  const energyCost = totalQuantity(project.lciInputs, ["Energy"]) * cfg.energyPriceRpPerKwh;
  const waterCost = totalQuantity(project.lciInputs, ["Water"]) * cfg.waterPriceRpPerL;
  const chemicalCost =
    totalQuantity(project.lciInputs, ["Chemical", "Anode"]) * cfg.chemicalPriceRpPerKg;
  const wwtpChemicalCost =
    totalQuantity(project.lciInputs, ["WWTPChemical"]) * cfg.wwtpChemicalPriceRpPerKg;
  const consumableCost =
    totalQuantity(project.lciInputs, ["Consumable"]) * cfg.consumablePriceRpPerKg;
  const wasteDisposalCost = totalWaste(project.hazardousWaste) * cfg.wasteDisposalPriceRpPerKg;
  const wasteTransportCost = project.hazardousWaste.reduce(
    (sum, w) => sum + w.transportKm * cfg.wasteTransportPriceRpPerKm,
    0,
  );
  const laborCost = cfg.laborCostRpPerPeriod;

  const items: CostBreakdownItem[] = [
    { key: "energy", label: "Energi (listrik)", totalRp: energyCost },
    { key: "water", label: "Air proses", totalRp: waterCost },
    { key: "chemical", label: "Bahan kimia & anoda", totalRp: chemicalCost },
    { key: "wwtp_chemical", label: "Bahan kimia WWTP", totalRp: wwtpChemicalCost },
    { key: "consumable", label: "Consumable", totalRp: consumableCost },
    { key: "waste_disposal", label: "Pengolahan limbah B3", totalRp: wasteDisposalCost },
    { key: "waste_transport", label: "Transport limbah B3", totalRp: wasteTransportCost },
    { key: "labor", label: "Tenaga kerja", totalRp: laborCost },
  ];

  const totalRp = items.reduce((sum, i) => sum + i.totalRp, 0);

  return {
    items,
    totalRp,
    costPerFunctionalUnit: totalRp / fu,
  };
}

export function buyToFlyRatio(project: Project): number {
  const { initialStockMassKg, finishedMassKg } = project.part;
  if (finishedMassKg <= 0) return 0;
  return initialStockMassKg / finishedMassKg;
}

export function scrapMassKg(project: Project): number {
  return Math.max(0, project.part.initialStockMassKg - project.part.finishedMassKg);
}
