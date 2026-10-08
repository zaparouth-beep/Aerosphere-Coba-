/**
 * AeroSphere LCA domain model (PRD v1.0, Lampiran L1).
 *
 * Everything the user enters lives in `Project`. Calculation results are never
 * stored on the project itself: they are derived by the engine, either live
 * (draft) or frozen inside an immutable `Run`.
 */

export type StageId = "A" | "B" | "C" | "D" | "E" | "F";

export interface Stage {
  id: StageId;
  name: string;
  functionDesc: string;
  subprocesses: string[];
  inBoundary: boolean;
}

/* ----------------------------- Units & basis ----------------------------- */

export type Dimension = "mass" | "volume" | "energy" | "air" | "count";

/** How a quantity relates to the reporting period (FR-03.4). */
export type Basis = "period" | "month" | "batch";

/* ------------------------------ Data quality ----------------------------- */

/** Data hierarchy Tier 1–5 from the deck (FR-03.7). */
export type SourceType = "measured" | "calculated" | "supplier" | "database" | "literature";

/** Weidema pedigree matrix, 1 (best) – 5 (worst) (FR-04.6). */
export interface Pedigree {
  reliability: number;
  completeness: number;
  temporal: number;
  geographical: number;
  technological: number;
}

export interface DataMeta {
  sourceType: SourceType;
  source: string;
  method: string;
  uncertaintyPct: number;
  pedigree: Pedigree;
  note?: string;
}

export type Confidence = "High" | "Medium" | "Low";

/* --------------------------- LCIA & background --------------------------- */

/** EF 3.1 core impact categories (FR-06.2). */
export type ImpactId =
  | "cc"
  | "ac"
  | "euf"
  | "pof"
  | "pm"
  | "rum"
  | "ruf"
  | "htc"
  | "htnc"
  | "etf"
  | "wu";

export type ImpactVector = Record<ImpactId, number>;
/** Factor per canonical unit; a missing key means "not provided", never zero. */
export type ImpactFactors = Partial<Record<ImpactId, number>>;

export type MappingStatus = "exact" | "proxy" | "stoich" | "unmapped";

/** Link from a foreground flow to a background dataset (FR-05.2). */
export interface BackgroundMapping {
  status: MappingStatus;
  datasetId?: string;
  rationale?: string;
}

export interface BackgroundDataset {
  id: string;
  name: string;
  provider: string;
  version: string;
  geography: string;
  refUnit: "kg" | "L" | "kWh";
  factors: ImpactFactors;
  licenseScope: string;
  importedAt: string;
}

/** Characterisation factor for a direct elementary flow, per kg emitted. */
export interface ElementaryFlowCF {
  key: string;
  label: string;
  compartment: "air" | "water";
  factors: ImpactFactors;
  source: string;
}

export interface MethodPackage {
  release: string;
  primary: "EF 3.1";
  secondary?: "ReCiPe 2016 Midpoint (H)";
  flows: ElementaryFlowCF[];
}

/* -------------------------------- Inventory ------------------------------ */

export type InputCategory = "Chemical" | "Anode" | "Water" | "Energy" | "WWTPChemical" | "Consumable";

export interface InputFlow {
  id: string;
  no: number;
  category: InputCategory;
  name: string;
  stageId: StageId;
  quantity: number;
  unit: string;
  basis: Basis;
  meta: DataMeta;
  /** Real unit price in Rp per canonical unit; overrides the category price. */
  unitPriceRp?: number;
  mapping: BackgroundMapping;
}

export interface AirEmission {
  id: string;
  parameter: string;
  relevance: string;
  applicable: boolean;
  stageId: StageId;
  quantityKg: number;
  basis: Basis;
  /** Elementary flow key for characterisation; undefined = match by name, "none" = skip. */
  flowKey?: string;
  meta: DataMeta;
}

export interface EffluentParam {
  id: string;
  parameter: string;
  unit: string;
  value: number;
  flowKey?: string;
  /** Regulatory limit in the same unit, filled by the user (FR-04.5). */
  limit?: number;
}

export interface HazardousWaste {
  id: string;
  wasteType: string;
  stageId: StageId;
  quantityKg: number;
  basis: Basis;
  moisturePct: number;
  metalContentPct: number;
  treatment: string;
  destination: string;
  transportKm: number;
  recovery: boolean;
  meta: DataMeta;
  mapping: BackgroundMapping;
}

export interface Production {
  /** m² plated in the reporting period (reference flow when FU = m²). */
  areaM2: number;
  parts: number;
  /** kg of plated components produced (supporting FU). */
  componentMassKg: number;
  batches: number;
  /** Share of output that has to be reworked/rejected (B4). */
  reworkPct: number;
  coatingMetal: string;
  coatingThicknessUm: number;
  coatingDensityKgM3: number;
  /** Effluent volume per period, m³ (effluent concentrations refer to this). */
  effluentVolumeM3: number;
  /** Water leaving with product, evaporation and sludge, m³ per period (FR-04.3). */
  waterEvaporatedM3: number;
  /** kWh per Nm³ compressed air, required when compressed air is entered in Nm³. */
  compressorKwhPerNm3?: number;
}

/* ---------------------------------- Cost --------------------------------- */

export interface PriceBook {
  validFrom: string;
  /** True while the numbers are the demo dataset, so validation can flag them. */
  isDemo: boolean;
  energyRpPerKwh: number;
  waterRpPerL: number;
  chemicalRpPerKg: number;
  wwtpChemicalRpPerKg: number;
  consumableRpPerKg: number;
  wasteTreatmentRpPerKg: number;
  wasteTransportRpPerKm: number;
  wasteTripsPerPeriod: number;
  laborRpPerPeriod: number;
  depreciationRpPerPeriod: number;
  carbonPriceRpPerKgCO2e: number;
}

/* ------------------------------ Goal & scope ----------------------------- */

export type FuType = "m2" | "part" | "kg";
export type BoundaryType = "gate-to-gate" | "gate-to-gate+upstream" | "cradle-to-gate";
export type AllocationKey = "m2" | "mass" | "hours";

export interface Scope {
  version: number;
  lockedAt?: string;
  lockedBy?: string;
  goal: string;
  intendedAudience: string;
  fuType: FuType;
  boundary: BoundaryType;
  cutoffPct: number;
  allocation: AllocationKey;
  backgroundDb: string;
  assumptions: string[];
}

/* -------------------------------- Scenarios ------------------------------ */

export type LeverId =
  | "dragout"
  | "countercurrent"
  | "rectifier"
  | "tankCover"
  | "mistSuppressant"
  | "effluentTarget"
  | "gridFactor"
  | "bathConcentration";

export interface LeverSettings {
  dragout?: { reductionPct: number };
  countercurrent?: { stagesOld: number; stagesNew: number; ratio: number };
  rectifier?: { etaOld: number; etaNew: number };
  tankCover?: { heatReductionPct: number; mistReductionPct: number };
  mistSuppressant?: { reductionPct: number };
  effluentTarget?: { parameter: string; newValue: number; flocculantIncreasePct: number };
  gridFactor?: { kgCO2ePerKwh: number };
  bathConcentration?: { cOld: number; cNew: number };
}

export interface Scenario {
  id: string;
  code: string;
  name: string;
  description: string;
  levers: LeverSettings;
  capexRp: number;
  extraOpexRpPerPeriod: number;
  lifetimeYears: number;
  /** Qualitative effort and timeline for the management summary (PRD v1.1 §3.5), set by the team. */
  effort?: "rendah" | "sedang" | "tinggi";
  timeline?: string;
  status: "draft" | "recommended" | "approved";
  approvedBy?: string;
  approvedAt?: string;
}

/* ------------------------------ Governance ------------------------------- */

export type Role = "Admin" | "DataSteward" | "Engineer" | "Analyst" | "Executive" | "Auditor";

export interface DatasetState {
  version: number;
  status: "draft" | "approved";
  approvedBy?: string;
  approvedAt?: string;
  hash?: string;
  /** Accepted warnings: issue key → written reason (FR-04.2 / AC-02). */
  acceptedWarnings: Record<string, string>;
}

export interface AuditEvent {
  seq: number;
  ts: string;
  actor: string;
  role: Role;
  entity: string;
  entityId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  prevHash: string;
  hash: string;
}

export interface Targets {
  baselineLabel: string;
  gwpReductionPct: number;
  wasteReductionPct: number;
  waterReductionPct: number;
  targetYear: number;
  /** Discount rate for scenario NPV (LCC lite, F3). */
  discountRatePct: number;
}

export interface Project {
  schemaVersion: 2;
  id: string;
  name: string;
  facility: string;
  client: string;
  periodLabel: string;
  periodMonths: number;
  template: string;
  partName: string;
  substrate: string;
  coatingType: string;
  scope: Scope;
  scopeHistory: Scope[];
  stages: Stage[];
  inputs: InputFlow[];
  airEmissions: AirEmission[];
  effluent: EffluentParam[];
  waste: HazardousWaste[];
  production: Production;
  prices: PriceBook;
  backgrounds: BackgroundDataset[];
  method: MethodPackage;
  scenarios: Scenario[];
  targets: Targets;
  /** Stage scores for the priority formula (FR-08.3), 1 (hard/low) – 5 (easy/high). */
  stageEase: Record<StageId, number>;
  stageComplianceRisk: Record<StageId, number>;
  laborHoursByStage: Record<StageId, number>;
  dataset: DatasetState;
}
