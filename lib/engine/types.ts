/**
 * Engine data model (docs/AEROSPHERE_SPEC.md §3.1). `runAnalysis` reads a
 * ProjectInput and a FactorSet and returns a RunResult; nothing else.
 */

export type StageCode = "A" | "B" | "C" | "D" | "E" | "F";

export const STAGES: Record<StageCode, { nameId: string; nameEn: string }> = {
  A: { nameId: "Pembersihan awal", nameEn: "Pre-treatment" },
  B: { nameId: "Lapisan pengikat", nameEn: "Activation / strike" },
  C: { nameId: "Pelapisan utama", nameEn: "Main plating" },
  D: { nameId: "Perlakuan akhir", nameEn: "Post-treatment" },
  E: { nameId: "Utilitas (listrik & panas)", nameEn: "Utilities" },
  F: { nameId: "Pengolahan air limbah", nameEn: "Wastewater treatment" },
};

export const STAGE_CODES: StageCode[] = ["A", "B", "C", "D", "E", "F"];

export type ComponentCategory =
  | "chemical"
  | "anode"
  | "wwtp_chemical"
  | "consumable"
  | "water"
  | "electricity"
  | "fuel"
  | "waste_b3"
  | "air_emission"
  | "effluent_param";

export type DataSource = "meter" | "invoice" | "weighing" | "lab" | "estimate" | "literature";

export type DeviceRole = "rectifier" | "heater" | "chiller" | "oven" | "ventilation" | "pump" | "compressed_air" | "di_ro" | "wwtp";

export interface InventoryComponent {
  id: string;
  stage: StageCode;
  category: ComponentCategory;
  name: string;
  /** Key into the factor table, e.g. "chem.generic", "elec.grid_id". */
  flowKey: string;
  /** Canonical unit: kg, L, kWh; mg/L for effluent parameters. */
  quantity: number;
  unit: string;
  source: DataSource;
  note?: string;
  deviceRole?: DeviceRole;
  scalesWith?: "dragout_load" | "effluent_volume" | "none";
  /** Overrides the category price (Rp per canonical unit). */
  unitPriceRp?: number;
  deletedAt?: string;
}

export interface PriceTable {
  electricityRpPerKWh: number;
  waterRpPerL: number;
  /** Process chemicals and anodes. */
  chemicalRpPerKg: number;
  wwtpChemicalRpPerKg: number;
  consumableRpPerKg: number;
  b3TreatmentRpPerKg: number;
  b3TransportRpPerPeriod: number;
  laborRpPerPeriod: number;
  /** Depreciation and other fixed cost per period; part of process cost, never "wasted". */
  otherFixedRpPerPeriod?: number;
}

export interface ProjectInput {
  projectId: string;
  name: string;
  facility: string;
  periodStart: string;
  periodEnd: string;
  periodLabel?: string;
  coatingType: "hard_chrome" | "nickel" | "cadmium" | "zinc_nickel" | "anodize_chromic" | "other";
  /** Reference flow: m² plated in the period (FU = 1 m²). */
  areaPlatedM2: number;
  components: InventoryComponent[];
  prices: PriceTable;
  methodProfile: "screening_v1" | "proper_inalum_v1";
  /** Measured effluent volume; when absent it is derived from the water balance (§4.4). */
  effluentMeasuredM3?: number;
  /** Share of water in that does not leave as effluent; default 0.10. */
  waterLossFraction?: number;
  /** Hotspot share threshold in %, default 30 (§4.6). */
  hotspotThresholdPct?: number;
}

/* ------------------------------ Factor tables ------------------------------ */

export interface FactorCategory {
  key: string;
  labelId: string;
  labelEn: string;
  unit: string;
  method: string;
  group?: "primary" | "secondary" | "energy";
  /** Row number in the INALUM-style table, e.g. "1", "6a". */
  no?: string;
}

export interface FactorFlow {
  unit: string;
  dataset: string;
  source: string;
  status: "screening" | "verified" | "missing";
  /** null = not available ("belum dihitung"), never read as 0. */
  factors: Record<string, number | null>;
}

export interface FactorSet {
  version: string;
  profile: ProjectInput["methodProfile"];
  status: "screening" | "verified" | "empty";
  categories: FactorCategory[];
  flows: Record<string, FactorFlow>;
  /** Characterisation of direct emissions; a category not listed does not apply to that emission. */
  directEmissionCF: Record<string, Record<string, number | null>>;
}

/* --------------------------------- Results -------------------------------- */

export interface TraceStep {
  id: string;
  label: string;
  formula: string;
  inputs: Record<string, { value: number; unit: string; source?: string }>;
  result: { value: number; unit: string };
}

export type ImpactStatus = "computed" | "partial" | "not_computed";

export type SourceGroup = "electricity" | "chemical" | "wwtp_chemical" | "water" | "fuel" | "waste_b3" | "direct_air" | "direct_water";

export interface ComponentContribution {
  componentId: string;
  name: string;
  stage: StageCode;
  source: SourceGroup;
  value: number;
  /** "cradle" = upstream factor (production of inputs); "gate" = direct emission at the line. */
  point: "cradle" | "gate";
}

export interface ImpactResult {
  category: string;
  labelId: string;
  labelEn: string;
  unit: string;
  method: string;
  status: ImpactStatus;
  total: number | null;
  perFU: number | null;
  perStage: Record<StageCode, number | null>;
  /** % of the category total per stage. */
  share: Record<StageCode, number | null>;
  bySource: Partial<Record<SourceGroup, number>>;
  byPoint: { cradle: number | null; gate: number | null };
  contributions: ComponentContribution[];
  /** Components whose factor is missing for this category (counted as "belum dihitung", not 0). */
  missing: string[];
}

export interface Totals {
  electricityKWh: number;
  waterL: number;
  chemicalKg: number;
  wasteB3Kg: number;
  effluentM3: number;
  costRp: number;
  wasteValueRp: number;
}

export interface StageResult {
  electricityKWh: number;
  waterL: number;
  chemicalKg: number;
  wasteB3Kg: number;
  /** Component costs + share of B3 transport; labour and fixed cost are not allocated to stages. */
  costRp: number;
  wasteValueRp: number;
}

export interface WasteValueResult {
  totalRp: number;
  pctOfCost: number;
  items: {
    processChemicalRp: number;
    wwtpChemicalRp: number;
    consumableRp: number;
    b3TreatmentRp: number;
    b3TransportRp: number;
    waterRp: number;
  };
  perStage: Record<StageCode, number>;
}

export type HotspotIndicator = string;

export interface HotspotStage {
  stage: StageCode;
  value: number;
  share: number;
  rank: number;
  drivers: Array<{ componentId: string; name: string; value: number; sharePct: number }>;
}

export interface HotspotFinding {
  indicator: HotspotIndicator;
  thresholdPct: number;
  ranking: HotspotStage[];
  flagged: HotspotStage[];
}

export interface EngineWarning {
  code: "WATER_BALANCE" | "SCREENING_FACTORS" | "FACTOR_MISSING" | "NO_AREA";
  message: string;
}

export interface RunResult {
  factorVersion: string;
  perStage: Record<StageCode, StageResult>;
  totals: Totals;
  perFU: Totals;
  impacts: ImpactResult[];
  hotspots: HotspotFinding[];
  waste: WasteValueResult;
  dataConfidence: "high" | "medium" | "low";
  warnings: EngineWarning[];
  trace: TraceStep[];
}
