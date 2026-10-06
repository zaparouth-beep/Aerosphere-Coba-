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

/** LCIA impact categories supported by the calculation engine. */
export type ImpactId = "gwp" | "ap" | "ep" | "adpFossil" | "adpElements";
/** Impact per base unit of a flow (kg, L or kWh). `undefined` = not provided. */
export type ImpactFactors = Partial<Record<ImpactId, number>>;

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
  /** Real item-specific price per base unit (Rp/kg, Rp/L, Rp/kWh). When empty, the category
   * price in CostConfig is used; when that is also empty the cost is not counted. */
  unitPriceRp?: number;
  /** Cradle-to-gate impact per base unit from a background database (e.g. an ecoinvent
   * process computed in openLCA); falls back to the category factors in `Project.lcia`. */
  bgProcess?: string;
  bgFactors?: ImpactFactors;
}

export interface AirEmissionEntry {
  id: string;
  parameter: string;
  relevance: string;
  applicable: boolean;
  valueKgPerPeriod: number;
  /** Elementary flow used for characterisation: undefined = match by name, "none" = skip. */
  flow?: string;
}

export interface WaterEffluentEntry {
  id: string;
  parameter: string;
  unit: string;
  value: number;
  flow?: string;
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
  /** Treatment/disposal impact per kg of waste (background process). */
  bgProcess?: string;
  bgFactors?: ImpactFactors;
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
  /** Number of production processes (runs) in one month. LCI quantities are per process,
   * while hazardous waste and its transport are entered per month. Optional so projects
   * saved before this field existed keep working (defaults to 1). */
  processesPerMonth?: number;
  /** Waste pick-ups per month for each distinct destination (default 1). A truck going to
   * one destination is charged once, however many waste types it carries. */
  wasteTripsPerMonth?: number;
  /** Labor: operators × hours in each stage × hourly rate. laborCostRpPerPeriod stays as an
   * optional fixed extra per process (supervision, overhead). */
  laborOperators?: number;
  laborRateRpPerHour?: number;
  laborHoursByStage?: Partial<Record<ProcessStageId, number>>;
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

export interface LCIAConfig {
  /** Default background factors per LCI category (e.g. grid electricity per kWh). */
  categoryFactors?: Partial<Record<LCICategory, ImpactFactors>>;
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
  lcia?: LCIAConfig;
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
