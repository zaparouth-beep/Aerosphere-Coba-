export type ProcessStageId =
  | "pretreatment"
  | "strike"
  | "main_plating"
  | "post_treatment"
  | "utility"
  | "wwtp";

export interface ProcessStage {
  id: ProcessStageId;
  code: string; // A-F
  name: string;
  functionDesc: string;
}

export type LCICategory =
  | "Chemical"
  | "Anode"
  | "Water"
  | "Energy"
  | "WWTPChemical"
  | "Consumable";

export type DataType = "Measured" | "Calculated" | "Estimated";
export type Confidence = "High" | "Medium" | "Low";

export interface DataPedigree {
  source: string;
  dataType: DataType;
  measurementMethod: string;
  uncertaintyPct: number;
  period: string;
  confidence: Confidence;
}

/** One row of Life Cycle Inventory input, matching the 30-parameter candidate list. */
export interface LCIInputEntry extends DataPedigree {
  id: string;
  no: number;
  category: LCICategory;
  name: string;
  unit: string;
  stageId: ProcessStageId;
  quantity: number;
  /** Optional item-specific price per base unit (Rp/kg, Rp/L, Rp/kWh); falls back to the
   * category price in CostConfig when empty. */
  unitPriceRp?: number;
}

export interface AirEmissionEntry {
  id: string;
  parameter: string;
  relevance: string;
  applicable: boolean;
  valueKgPerPeriod: number;
}

export interface WaterEffluentEntry {
  id: string;
  parameter: string;
  unit: string;
  value: number;
}

export interface HazardousWasteEntry {
  id: string;
  wasteType: string;
  sourceStageId: ProcessStageId;
  quantityKgMonth: number;
  hazardClass: string;
  moisturePct: number;
  metalContentPct: number;
  treatment: string;
  disposal: string;
  destination: string;
  transportKm: number;
  recovery: boolean;
}

export type FunctionalUnitType = "m2_plated" | "part" | "kg_metal_deposited";

export interface FunctionalUnit {
  type: FunctionalUnitType;
  value: number; // total quantity produced during the period, in the chosen unit
}

export interface PartInfo {
  partName: string;
  material: string;
  initialStockMassKg: number;
  finishedMassKg: number;
  annualVolumeParts: number;
}

/** Unit prices applied to the actual LCI quantities to derive cost flow, so cost
 * always stays consistent with the inventory data instead of being entered twice. */
export interface CostConfig {
  energyPriceRpPerKwh: number;
  waterPriceRpPerL: number;
  chemicalPriceRpPerKg: number;
  wwtpChemicalPriceRpPerKg: number;
  consumablePriceRpPerKg: number;
  laborCostRpPerPeriod: number;
  wasteDisposalPriceRpPerKg: number;
  wasteTransportPriceRpPerKm: number;
  /** Months covered by the LCI period; hazardous waste is entered in kg/month. Optional so
   * projects saved before this field existed keep working (defaults to 1). */
  periodMonths?: number;
}

export interface WhatIfLever {
  id: string;
  label: string;
  description: string;
  /** 0 - 1, fraction reduction applied */
  reductionPct: number;
  affects: {
    rinseWaterPct?: number;
    rectifierEnergyPct?: number;
    dragOutChemicalPct?: number;
  };
}

export interface Project {
  id: string;
  name: string;
  facility: string;
  client: string;
  period: string;
  part: PartInfo;
  functionalUnit: FunctionalUnit;
  lciInputs: LCIInputEntry[];
  airEmissions: AirEmissionEntry[];
  waterEffluent: WaterEffluentEntry[];
  hazardousWaste: HazardousWasteEntry[];
  costConfig: CostConfig;
  whatIfLevers: WhatIfLever[];
}

export interface HotspotRow {
  stageId: ProcessStageId;
  energyPct: number;
  waterPct: number;
  chemicalPct: number;
  wastePct: number;
}

export interface IntensityMetrics {
  energyIntensity: number; // kWh / functional unit
  waterIntensity: number; // L / functional unit
  chemicalIntensity: number; // kg / functional unit
  wasteIntensity: number; // kg B3 / functional unit
}
