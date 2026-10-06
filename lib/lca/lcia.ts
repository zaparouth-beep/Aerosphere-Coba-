import { PROCESS_STAGES } from "./constants";
import {
  CATEGORY_BASE_UNIT,
  CHEMICAL_LIKE_CATEGORIES,
  functionalUnitDivisor,
  normalizeQuantity,
  totalQuantity,
  totalWaste,
  wastePerProcessFactor,
} from "./calculations";
import type {
  ImpactFactors,
  ImpactId,
  LCICategory,
  Project,
  ProcessStageId,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Impact categories and characterisation factors (ISO 14044 §4.4.2)          */
/* -------------------------------------------------------------------------- */

export interface ImpactCategoryDef {
  id: ImpactId;
  label: string;
  short: string;
  unit: string;
  method: string;
}

export const IMPACT_CATEGORIES: ImpactCategoryDef[] = [
  {
    id: "gwp",
    label: "Global Warming Potential (GWP100)",
    short: "GWP",
    unit: "kg CO₂-eq",
    method: "IPCC AR6, 100 tahun",
  },
  {
    id: "ap",
    label: "Acidification Potential",
    short: "AP",
    unit: "kg SO₂-eq",
    method: "CML-IA baseline",
  },
  {
    id: "ep",
    label: "Eutrophication Potential",
    short: "EP",
    unit: "kg PO₄³⁻-eq",
    method: "CML-IA baseline",
  },
  {
    id: "adpFossil",
    label: "Abiotic Depletion – Fossil (energi)",
    short: "ADP fossil",
    unit: "MJ",
    method: "CML-IA baseline",
  },
  {
    id: "adpElements",
    label: "Abiotic Depletion – Elements (mineral/logam)",
    short: "ADP elements",
    unit: "kg Sb-eq",
    method: "CML-IA baseline",
  },
];

export const IMPACT_IDS = IMPACT_CATEGORIES.map((c) => c.id);

export interface ElementaryFlowDef {
  key: string;
  label: string;
  medium: "air" | "water";
  /** Characterisation factors per kg of the substance emitted. */
  factors: ImpactFactors;
}

/** Characterisation factors for the elementary flows a plating line can emit directly.
 * Values follow IPCC AR6 (GWP100, fossil CH4) and CML-IA baseline (AP, EP). Check them
 * against the method version loaded in your openLCA installation before reporting. */
export const ELEMENTARY_FLOWS: ElementaryFlowDef[] = [
  { key: "co2", label: "CO₂ (fosil)", medium: "air", factors: { gwp: 1 } },
  { key: "ch4", label: "CH₄ (fosil)", medium: "air", factors: { gwp: 29.8 } },
  { key: "n2o", label: "N₂O", medium: "air", factors: { gwp: 273 } },
  { key: "so2", label: "SO₂", medium: "air", factors: { ap: 1.2 } },
  {
    key: "nox",
    label: "NOx (sebagai NO₂)",
    medium: "air",
    factors: { ap: 0.5, ep: 0.13 },
  },
  {
    key: "nh3_air",
    label: "NH₃ (udara)",
    medium: "air",
    factors: { ap: 1.6, ep: 0.35 },
  },
  { key: "hcl", label: "HCl", medium: "air", factors: { ap: 0.88 } },
  { key: "hf", label: "HF", medium: "air", factors: { ap: 1.6 } },
  { key: "h2s", label: "H₂S", medium: "air", factors: { ap: 1.88 } },
  { key: "cod", label: "COD", medium: "water", factors: { ep: 0.022 } },
  { key: "n_total", label: "N total", medium: "water", factors: { ep: 0.42 } },
  { key: "p_total", label: "P total", medium: "water", factors: { ep: 3.06 } },
  { key: "po4", label: "Fosfat (PO₄³⁻)", medium: "water", factors: { ep: 1 } },
  { key: "no3", label: "Nitrat (NO₃⁻)", medium: "water", factors: { ep: 0.1 } },
  {
    key: "nh4",
    label: "Amonium (NH₄⁺)",
    medium: "water",
    factors: { ep: 0.33 },
  },
];

const FLOW_BY_KEY = new Map(ELEMENTARY_FLOWS.map((f) => [f.key, f]));

/** Name-based matching so common parameters are characterised without extra input. */
const AUTO_MATCH: Array<{
  test: RegExp;
  key: string;
  medium: "air" | "water";
}> = [
  { test: /^(co2|carbon dioxide)\b/i, key: "co2", medium: "air" },
  { test: /^(ch4|methane)\b/i, key: "ch4", medium: "air" },
  { test: /^(n2o|nitrous oxide)\b/i, key: "n2o", medium: "air" },
  {
    test: /^(so2|sulfur dioxide|sulphur dioxide)\b/i,
    key: "so2",
    medium: "air",
  },
  { test: /^(nox|nitrogen oxides?)\b/i, key: "nox", medium: "air" },
  { test: /^(nh3|ammonia)\b/i, key: "nh3_air", medium: "air" },
  { test: /^hf\b|hydrogen fluoride/i, key: "hf", medium: "air" },
  { test: /^h2s\b|hydrogen sulfide/i, key: "h2s", medium: "air" },
  { test: /^cod\b|chemical oxygen demand/i, key: "cod", medium: "water" },
  {
    test: /^(total n|n total|total nitrogen|nitrogen total)\b/i,
    key: "n_total",
    medium: "water",
  },
  { test: /^(total p|p total|total phosph)/i, key: "p_total", medium: "water" },
  { test: /phosphate|fosfat/i, key: "po4", medium: "water" },
  { test: /nitrate|nitrat/i, key: "no3", medium: "water" },
  { test: /ammonium|amonium/i, key: "nh4", medium: "water" },
];

export function resolveFlow(
  parameter: string,
  flow: string | undefined,
  medium: "air" | "water",
): ElementaryFlowDef | null {
  if (flow === "none") return null;
  if (flow) return FLOW_BY_KEY.get(flow) ?? null;
  const hit = AUTO_MATCH.find(
    (m) => m.medium === medium && m.test.test(parameter.trim()),
  );
  return hit ? (FLOW_BY_KEY.get(hit.key) ?? null) : null;
}

/* -------------------------------------------------------------------------- */
/* Result types                                                               */
/* -------------------------------------------------------------------------- */

export type SourceKey =
  | "energy"
  | "water"
  | "chemical"
  | "wwtp_chemical"
  | "consumable"
  | "waste_treatment"
  | "air_direct"
  | "water_direct";

export const SOURCE_LABEL: Record<SourceKey, string> = {
  energy: "Energi (listrik)",
  water: "Air proses",
  chemical: "Bahan kimia & anoda",
  wwtp_chemical: "Bahan kimia WWTP",
  consumable: "Consumable",
  waste_treatment: "Pengolahan limbah B3",
  air_direct: "Emisi udara langsung",
  water_direct: "Efluen air langsung",
};

export type StageOrDirect = ProcessStageId | "direct";
export type ImpactValues = Record<ImpactId, number>;

export interface ImpactContribution {
  id: string;
  name: string;
  source: SourceKey;
  stageId: StageOrDirect;
  /** Quantity in the base unit the factors refer to, for traceability. */
  quantity: number;
  unit: string;
  values: ImpactValues;
  /** Pedigree-based relative uncertainty (%), 0 when no pedigree is available. */
  uncertaintyPct: number;
  /** Which impact factors were provided (false = treated as missing, not as zero). */
  covered: Record<ImpactId, boolean>;
  needsBackground: boolean;
}

export interface CoverageRow {
  impact: ImpactId;
  coveredCount: number;
  totalCount: number;
  /** Share of the mass of kg-based background flows that has a factor (ISO cut-off check). */
  coveredMassPct: number;
  missing: string[];
}

export interface LCIAResult {
  totals: ImpactValues;
  perFunctionalUnit: ImpactValues;
  /** Absolute ± uncertainty (root-sum-of-squares of pedigree uncertainties). */
  uncertainty: ImpactValues;
  bySource: Record<SourceKey, ImpactValues>;
  byStage: Record<StageOrDirect, ImpactValues>;
  contributions: ImpactContribution[];
  coverage: CoverageRow[];
  /** Direct flows that exist in the inventory but have no characterisation factor. */
  uncharacterised: string[];
  warnings: string[];
}

function formatBalance(n: number): string {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 1 });
}

function zeroValues(): ImpactValues {
  return { gwp: 0, ap: 0, ep: 0, adpFossil: 0, adpElements: 0 };
}

function zeroCovered(value: boolean): Record<ImpactId, boolean> {
  return {
    gwp: value,
    ap: value,
    ep: value,
    adpFossil: value,
    adpElements: value,
  };
}

const CATEGORY_SOURCE: Record<LCICategory, SourceKey> = {
  Energy: "energy",
  Water: "water",
  Chemical: "chemical",
  Anode: "chemical",
  WWTPChemical: "wwtp_chemical",
  Consumable: "consumable",
};

/** Effluent concentration unit → kg of substance per m³ of effluent. */
const CONC_TO_KG_PER_M3: Record<string, number> = {
  "mg/l": 0.001,
  "g/l": 1,
  "kg/m3": 1,
  "µg/l": 1e-6,
  "ug/l": 1e-6,
};

/* -------------------------------------------------------------------------- */
/* Engine                                                                     */
/* -------------------------------------------------------------------------- */

/** LCIA following ISO 14040/14044: classification and characterisation only (no
 * normalisation or weighting).
 *
 *   impact_k = Σ_i  quantity_i × factor_i,k
 *
 * with i = background inputs (LCI input × cradle-to-gate factor, waste × treatment
 * factor) and direct elementary flows (air emissions, effluent × characterisation
 * factor). All results are per process, then divided by the functional unit. */
export function computeLCIA(project: Project): LCIAResult {
  const fu = functionalUnitDivisor(project);
  const warnings: string[] = [];
  const contributions: ImpactContribution[] = [];
  const categoryFactors = project.lcia?.categoryFactors ?? {};

  // 1. Background-linked inputs ------------------------------------------------
  for (const entry of project.lciInputs) {
    if (entry.quantity <= 0) continue;
    const { value, ok } = normalizeQuantity(entry);
    if (!ok) {
      warnings.push(
        `Unit "${entry.unit}" pada "${entry.name}" tidak dapat dikonversi ke ${CATEGORY_BASE_UNIT[entry.category]}, jadi input ini dikeluarkan dari hasil (cut-off). Perbaiki unitnya di Data Proses.`,
      );
    }
    const values = zeroValues();
    const covered = zeroCovered(false);
    for (const id of IMPACT_IDS) {
      // Per impact: the item's own factor first, then the category default.
      const f = entry.bgFactors?.[id] ?? categoryFactors[entry.category]?.[id];
      if (ok && f !== undefined && Number.isFinite(f)) {
        values[id] = value * f;
        covered[id] = true;
      }
    }
    contributions.push({
      id: entry.id,
      name: entry.name,
      source: CATEGORY_SOURCE[entry.category],
      stageId: entry.stageId,
      quantity: value,
      unit: CATEGORY_BASE_UNIT[entry.category],
      values,
      uncertaintyPct: entry.uncertaintyPct,
      covered,
      needsBackground: true,
    });
  }

  // 2. Hazardous waste treatment (kg/month → per process) ---------------------
  const wasteShare = wastePerProcessFactor(project);
  for (const w of project.hazardousWaste) {
    if (w.quantityKgMonth <= 0) continue;
    const kg = w.quantityKgMonth * wasteShare;
    const factors = w.bgFactors ?? {};
    const values = zeroValues();
    const covered = zeroCovered(false);
    for (const id of IMPACT_IDS) {
      const f = factors[id];
      if (f !== undefined && Number.isFinite(f)) {
        values[id] = kg * f;
        covered[id] = true;
      }
    }
    contributions.push({
      id: w.id,
      name: w.wasteType,
      source: "waste_treatment",
      stageId: w.sourceStageId,
      quantity: kg,
      unit: "kg",
      values,
      uncertaintyPct: 0,
      covered,
      needsBackground: true,
    });
  }

  // 3. Direct air emissions (kg/process × characterisation factor) -----------
  const uncharacterised: string[] = [];
  for (const e of project.airEmissions) {
    if (!e.applicable || e.valueKgPerPeriod <= 0) continue;
    const flow = resolveFlow(e.parameter, e.flow, "air");
    if (!flow) {
      uncharacterised.push(`${e.parameter} (udara)`);
      continue;
    }
    const values = zeroValues();
    for (const id of IMPACT_IDS)
      values[id] = e.valueKgPerPeriod * (flow.factors[id] ?? 0);
    contributions.push({
      id: e.id,
      name: `${e.parameter} → ${flow.label}`,
      source: "air_direct",
      stageId: "direct",
      quantity: e.valueKgPerPeriod,
      unit: "kg",
      values,
      uncertaintyPct: 0,
      covered: zeroCovered(true),
      needsBackground: false,
    });
  }

  // 4. Direct effluent (concentration × effluent volume) ----------------------
  const volumeEntry = project.waterEffluent.find((w) =>
    /effluent volume|volume efluen/i.test(w.parameter),
  );
  let volumeM3 = 0;
  if (volumeEntry) {
    const u = volumeEntry.unit.trim().toLowerCase();
    volumeM3 = u === "l" ? volumeEntry.value / 1000 : volumeEntry.value;
  }
  for (const w of project.waterEffluent) {
    if (w === volumeEntry || w.value <= 0) continue;
    const flow = resolveFlow(w.parameter, w.flow, "water");
    if (!flow) {
      if (!/^ph$/i.test(w.parameter.trim()))
        uncharacterised.push(`${w.parameter} (air)`);
      continue;
    }
    const perM3 = CONC_TO_KG_PER_M3[w.unit.trim().toLowerCase()];
    if (perM3 === undefined) {
      warnings.push(
        `Unit "${w.unit}" pada efluen "${w.parameter}" tidak dikenali (pakai mg/L, g/L, µg/L, atau kg/m3).`,
      );
      continue;
    }
    if (volumeM3 <= 0) {
      warnings.push(
        `Volume efluen belum diisi, jadi beban "${w.parameter}" tidak dapat dihitung.`,
      );
      continue;
    }
    const kg = w.value * perM3 * volumeM3;
    const values = zeroValues();
    for (const id of IMPACT_IDS) values[id] = kg * (flow.factors[id] ?? 0);
    contributions.push({
      id: w.id,
      name: `${w.parameter} → ${flow.label}`,
      source: "water_direct",
      stageId: "wwtp",
      quantity: kg,
      unit: "kg",
      values,
      uncertaintyPct: 0,
      covered: zeroCovered(true),
      needsBackground: false,
    });
  }

  // Water balance: effluent cannot exceed the water entering the line by a wide margin.
  const waterInM3 = totalQuantity(project.lciInputs, ["Water"]) / 1000;
  if (volumeM3 > 0 && waterInM3 > 0 && volumeM3 > waterInM3 * 1.2) {
    warnings.push(
      `Neraca air tidak konsisten: volume efluen ${formatBalance(volumeM3)} m³ lebih besar dari air masuk ${formatBalance(waterInM3)} m³ per proses. Beban polutan efluen (COD, N, P) ikut terlalu besar.`,
    );
  }

  // 5. Aggregate --------------------------------------------------------------
  const totals = zeroValues();
  const bySource = Object.keys(SOURCE_LABEL).reduce(
    (acc, k) => ({ ...acc, [k]: zeroValues() }),
    {} as Record<SourceKey, ImpactValues>,
  );
  const byStage = [
    ...PROCESS_STAGES.map((s) => s.id as StageOrDirect),
    "direct" as StageOrDirect,
  ].reduce(
    (acc, k) => ({ ...acc, [k]: zeroValues() }),
    {} as Record<StageOrDirect, ImpactValues>,
  );
  const variance = zeroValues();
  for (const c of contributions) {
    for (const id of IMPACT_IDS) {
      totals[id] += c.values[id];
      bySource[c.source][id] += c.values[id];
      byStage[c.stageId][id] += c.values[id];
      variance[id] += (c.values[id] * (c.uncertaintyPct / 100)) ** 2;
    }
  }
  const uncertainty = zeroValues();
  const perFunctionalUnit = zeroValues();
  for (const id of IMPACT_IDS) {
    uncertainty[id] = Math.sqrt(variance[id]);
    perFunctionalUnit[id] = totals[id] / fu;
  }

  // 6. Completeness check (ISO 14044 §4.2.3.3 cut-off / §4.5.3.2) -------------
  const background = contributions.filter((c) => c.needsBackground);
  const coverage: CoverageRow[] = IMPACT_IDS.map((impact) => {
    const covered = background.filter((c) => c.covered[impact]);
    const kgBased = background.filter((c) => c.unit === "kg");
    const kgTotal = kgBased.reduce((s, c) => s + c.quantity, 0);
    const kgCovered = kgBased
      .filter((c) => c.covered[impact])
      .reduce((s, c) => s + c.quantity, 0);
    return {
      impact,
      coveredCount: covered.length,
      totalCount: background.length,
      coveredMassPct: kgTotal > 0 ? (kgCovered / kgTotal) * 100 : 0,
      missing: background.filter((c) => !c.covered[impact]).map((c) => c.name),
    };
  });

  return {
    totals,
    perFunctionalUnit,
    uncertainty,
    bySource,
    byStage,
    contributions,
    coverage,
    uncharacterised,
    warnings,
  };
}

/* -------------------------------------------------------------------------- */
/* Summary used by Overview / What-If / Report                                */
/* -------------------------------------------------------------------------- */

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
  lcia: LCIAResult;
}

/** GHG now comes from the LCIA engine (GWP100 of background factors + direct emissions);
 * until background factors are entered it reports only what has data behind it. */
export function computeEnvironmentalImpact(
  project: Project,
): EnvironmentalImpactSummary {
  const lcia = computeLCIA(project);
  const s = lcia.bySource;
  return {
    totalEnergyKwh: totalQuantity(project.lciInputs, ["Energy"]),
    totalWaterL: totalQuantity(project.lciInputs, ["Water"]),
    totalChemicalKg: totalQuantity(project.lciInputs, CHEMICAL_LIKE_CATEGORIES),
    totalWasteKgB3:
      totalWaste(project.hazardousWaste) * wastePerProcessFactor(project),
    totalAirEmissionKg: project.airEmissions
      .filter((e) => e.applicable)
      .reduce((sum, e) => sum + e.valueKgPerPeriod, 0),
    ghgFromEnergyKgCO2e: s.energy.gwp,
    ghgFromChemicalKgCO2e:
      s.chemical.gwp + s.wwtp_chemical.gwp + s.consumable.gwp,
    ghgFromWaterKgCO2e: s.water.gwp,
    totalGhgKgCO2e: lcia.totals.gwp,
    ghgPerFunctionalUnit: lcia.perFunctionalUnit.gwp,
    lcia,
  };
}
