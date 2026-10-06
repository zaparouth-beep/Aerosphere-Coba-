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
  const chemicalByStage = sumByStage(
    project.lciInputs,
    CHEMICAL_LIKE_CATEGORIES,
  );
  const wasteByStage = sumWasteByStage(project.hazardousWaste);

  const energyTotal = Object.values(energyByStage).reduce((a, b) => a + b, 0);
  const waterTotal = Object.values(waterByStage).reduce((a, b) => a + b, 0);
  const chemicalTotal = Object.values(chemicalByStage).reduce(
    (a, b) => a + b,
    0,
  );
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
  const totalChemical = totalQuantity(
    project.lciInputs,
    CHEMICAL_LIKE_CATEGORIES,
  );
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

export function computeEnvironmentalImpact(
  project: Project,
): EnvironmentalImpactSummary {
  const fu = functionalUnitDivisor(project);
  const totalEnergyKwh = totalQuantity(project.lciInputs, ["Energy"]);
  const totalWaterL = totalQuantity(project.lciInputs, ["Water"]);
  const totalChemicalKg = totalQuantity(
    project.lciInputs,
    CHEMICAL_LIKE_CATEGORIES,
  );
  const totalWasteKgB3 = totalWaste(project.hazardousWaste);
  const totalAirEmissionKg = project.airEmissions
    .filter((e) => e.applicable)
    .reduce((sum, e) => sum + e.valueKgPerPeriod, 0);

  const ghgFromEnergyKgCO2e =
    totalEnergyKwh * EMISSION_FACTORS.gridElectricityKgCO2ePerKwh;
  const ghgFromChemicalKgCO2e =
    totalChemicalKg * EMISSION_FACTORS.chemicalGenericKgCO2ePerKg;
  const ghgFromWaterKgCO2e =
    totalWaterL * EMISSION_FACTORS.waterTreatmentKgCO2ePerL;
  const totalGhgKgCO2e =
    ghgFromEnergyKgCO2e + ghgFromChemicalKgCO2e + ghgFromWaterKgCO2e;

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
  key: CostKey;
  label: string;
  totalRp: number;
}

export type CostKey =
  | "energy"
  | "water"
  | "chemical"
  | "wwtp_chemical"
  | "consumable"
  | "waste_disposal"
  | "waste_transport"
  | "labor";

export interface CostLine {
  id: string;
  name: string;
  costKey: CostKey;
  stageId: ProcessStageId;
  quantity: number;
  unit: string;
  unitPriceRp: number;
  priceSource: "item" | "category";
  totalRp: number;
}

export interface StageCostRow {
  stageId: ProcessStageId;
  /** Labor of this stage (hours × operators × rate), kept outside the flow totals. */
  laborRp: number;
  laborHours: number;
  byKey: Record<CostKey, number>;
  totalRp: number;
  pctOfAllocated: number;
}

export interface CostSummary {
  /** Resource-flow costs only (energy, water, chemicals, consumables, waste); labor is
   * deliberately excluded so charts and hotspots reflect environmental flows. */
  items: CostBreakdownItem[];
  /** Sum of `items`: the cost of the resource flows. */
  flowTotalRp: number;
  flowCostPerFunctionalUnit: number;
  /** Labor cost per process; not an LCI flow and not allocated to a stage. */
  laborRp: number;
  /** flowTotalRp + laborRp: full production cost per process. */
  totalRp: number;
  costPerFunctionalUnit: number;
  lines: CostLine[];
  byStage: StageCostRow[];
  /** Data-quality notes: unit mismatches, missing prices, etc. */
  warnings: string[];
}

export const COST_KEY_LABEL: Record<CostKey, string> = {
  energy: "Energi (listrik)",
  water: "Air proses",
  chemical: "Bahan kimia & anoda",
  wwtp_chemical: "Bahan kimia WWTP",
  consumable: "Consumable",
  waste_disposal: "Pengolahan limbah B3",
  waste_transport: "Transport limbah B3",
  labor: "Tenaga kerja",
};

const COST_KEYS = Object.keys(COST_KEY_LABEL) as CostKey[];

const CATEGORY_COST_KEY: Record<LCICategory, CostKey> = {
  Energy: "energy",
  Water: "water",
  Chemical: "chemical",
  Anode: "chemical",
  WWTPChemical: "wwtp_chemical",
  Consumable: "consumable",
};

export const CATEGORY_BASE_UNIT: Record<LCICategory, "kWh" | "L" | "kg"> = {
  Energy: "kWh",
  Water: "L",
  Chemical: "kg",
  Anode: "kg",
  WWTPChemical: "kg",
  Consumable: "kg",
};

/** Conversion of the numerator of a free-text unit ("kg/proses", "m3", ...) to the
 * base unit used by the price table. */
const UNIT_TO_BASE: Record<
  string,
  { base: "kWh" | "L" | "kg"; factor: number }
> = {
  kg: { base: "kg", factor: 1 },
  g: { base: "kg", factor: 0.001 },
  ton: { base: "kg", factor: 1000 },
  l: { base: "L", factor: 1 },
  ml: { base: "L", factor: 0.001 },
  m3: { base: "L", factor: 1000 },
  kwh: { base: "kWh", factor: 1 },
  mwh: { base: "kWh", factor: 1000 },
};

export function categoryPrice(cfg: CostConfig, category: LCICategory): number {
  switch (CATEGORY_COST_KEY[category]) {
    case "energy":
      return cfg.energyPriceRpPerKwh;
    case "water":
      return cfg.waterPriceRpPerL;
    case "wwtp_chemical":
      return cfg.wwtpChemicalPriceRpPerKg;
    case "consumable":
      return cfg.consumablePriceRpPerKg;
    default:
      return cfg.chemicalPriceRpPerKg;
  }
}

/** Convert an entry's quantity to the base unit of its category. `ok` is false when the
 * unit is unrecognised or incompatible, in which case the raw quantity is used. */
export function normalizeQuantity(entry: LCIInputEntry): {
  value: number;
  ok: boolean;
} {
  const head = (entry.unit.split("/")[0] ?? "").trim().toLowerCase();
  const conv = UNIT_TO_BASE[head];
  if (!conv || conv.base !== CATEGORY_BASE_UNIT[entry.category]) {
    return { value: entry.quantity, ok: false };
  }
  return { value: entry.quantity * conv.factor, ok: true };
}

function emptyCostByKey(): Record<CostKey, number> {
  return COST_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: 0 }),
    {} as Record<CostKey, number>,
  );
}

/** Cost flow formulas (all quantities in base units):
 *   input cost      = quantity × unit price            (item price, else category price)
 *   waste treatment = (kg/month ÷ processes per month) × Rp/kg
 *   waste transport = per destination: max km × trips/month × Rp/km ÷ processes per month,
 *                     shared across the waste types going there by quantity
 *   labor           = Σ stage hours × operators × Rp/hour + fixed extra per process
 *   total           = Σ all lines; cost per FU = total / functional unit */
export function computeCostBreakdown(project: Project): CostSummary {
  const fu = functionalUnitDivisor(project);
  const cfg: CostConfig = project.costConfig;
  const processesPerMonth =
    cfg.processesPerMonth && cfg.processesPerMonth > 0
      ? cfg.processesPerMonth
      : 1;
  const wasteShare = 1 / processesPerMonth;
  const warnings: string[] = [];
  const lines: CostLine[] = [];

  for (const entry of project.lciInputs) {
    const { value, ok } = normalizeQuantity(entry);
    if (!ok) {
      warnings.push(
        `Unit "${entry.unit}" pada "${entry.name}" tidak dikenali untuk kategori ${entry.category} (diharapkan ${CATEGORY_BASE_UNIT[entry.category]}); kuantitas dipakai apa adanya.`,
      );
    }
    const hasItemPrice =
      entry.unitPriceRp !== undefined && entry.unitPriceRp > 0;
    const unitPriceRp = hasItemPrice
      ? (entry.unitPriceRp as number)
      : categoryPrice(cfg, entry.category);
    lines.push({
      id: entry.id,
      name: entry.name,
      costKey: CATEGORY_COST_KEY[entry.category],
      stageId: entry.stageId,
      quantity: value,
      unit: CATEGORY_BASE_UNIT[entry.category],
      unitPriceRp,
      priceSource: hasItemPrice ? "item" : "category",
      totalRp: value * unitPriceRp,
    });
  }

  const tripsPerMonth =
    cfg.wasteTripsPerMonth && cfg.wasteTripsPerMonth > 0
      ? cfg.wasteTripsPerMonth
      : 1;
  const destinations = new Map<string, HazardousWasteEntry[]>();
  for (const w of project.hazardousWaste) {
    const key = w.destination.trim().toLowerCase();
    destinations.set(key, [...(destinations.get(key) ?? []), w]);
  }

  for (const w of project.hazardousWaste) {
    lines.push({
      id: `${w.id}-disposal`,
      name: `${w.wasteType} (olah)`,
      costKey: "waste_disposal",
      stageId: w.sourceStageId,
      quantity: w.quantityKgMonth * wasteShare,
      unit: "kg",
      unitPriceRp: cfg.wasteDisposalPriceRpPerKg,
      priceSource: "category",
      totalRp: w.quantityKgMonth * wasteShare * cfg.wasteDisposalPriceRpPerKg,
    });
  }

  for (const group of destinations.values()) {
    const tripKm = Math.max(...group.map((w) => w.transportKm));
    const tripCostRp =
      tripKm * tripsPerMonth * wasteShare * cfg.wasteTransportPriceRpPerKm;
    const groupQty = group.reduce((sum, w) => sum + w.quantityKgMonth, 0);
    for (const w of group) {
      const share =
        groupQty > 0 ? w.quantityKgMonth / groupQty : 1 / group.length;
      lines.push({
        id: `${w.id}-transport`,
        name: `${w.wasteType} (transport)`,
        costKey: "waste_transport",
        stageId: w.sourceStageId,
        quantity: tripKm * tripsPerMonth * wasteShare * share,
        unit: "km",
        unitPriceRp: cfg.wasteTransportPriceRpPerKm,
        priceSource: "category",
        totalRp: tripCostRp * share,
      });
    }
  }

  const unpriced = lines.filter((l) => l.unitPriceRp <= 0 && l.quantity > 0);
  const missingInputs = unpriced.filter(
    (l) => !l.id.includes("-disposal") && !l.id.includes("-transport"),
  );
  if (missingInputs.length > 0) {
    warnings.push(
      `${missingInputs.length} input belum punya harga riil (biaya dihitung Rp 0): ${missingInputs
        .map((l) => l.name)
        .join(
          ", ",
        )}. Isi di Data Proses → detail baris → Harga satuan, atau isi harga kategori di bawah.`,
    );
  }
  if (unpriced.length > missingInputs.length) {
    warnings.push(
      "Harga olah/transport limbah B3 belum diisi; biayanya dihitung Rp 0.",
    );
  }

  const totals = emptyCostByKey();
  const stageRows = new Map<ProcessStageId, Record<CostKey, number>>(
    PROCESS_STAGES.map((st) => [st.id, emptyCostByKey()]),
  );
  for (const line of lines) {
    totals[line.costKey] += line.totalRp;
    stageRows.get(line.stageId)![line.costKey] += line.totalRp;
  }
  const operators =
    cfg.laborOperators && cfg.laborOperators > 0 ? cfg.laborOperators : 1;
  const rate = cfg.laborRateRpPerHour ?? 0;
  const laborByStage = new Map<ProcessStageId, { hours: number; rp: number }>();
  for (const stage of PROCESS_STAGES) {
    const hours = cfg.laborHoursByStage?.[stage.id] ?? 0;
    laborByStage.set(stage.id, { hours, rp: hours * operators * rate });
  }
  const stageLaborRp = [...laborByStage.values()].reduce(
    (sum, v) => sum + v.rp,
    0,
  );
  const stageLaborHours = [...laborByStage.values()].reduce(
    (sum, v) => sum + v.hours,
    0,
  );
  totals.labor = stageLaborRp + cfg.laborCostRpPerPeriod;
  if (stageLaborHours > 0 && rate <= 0) {
    warnings.push(
      "Jam kerja sudah diisi tetapi tarif tenaga kerja per jam belum diisi.",
    );
  }
  if (totals.labor <= 0) {
    warnings.push(
      "Biaya tenaga kerja belum diisi (jam kerja per tahap × tarif per jam).",
    );
  }

  const items: CostBreakdownItem[] = COST_KEYS.filter(
    (key) => key !== "labor",
  ).map((key) => ({
    key,
    label: COST_KEY_LABEL[key],
    totalRp: totals[key],
  }));
  const flowTotalRp = items.reduce((sum, i) => sum + i.totalRp, 0);
  const laborRp = totals.labor;
  const totalRp = flowTotalRp + laborRp;
  const allocatedRp = flowTotalRp;

  const byStage: StageCostRow[] = PROCESS_STAGES.map((stage) => {
    const byKey = stageRows.get(stage.id)!;
    const stageTotal = COST_KEYS.reduce((sum, k) => sum + byKey[k], 0);
    return {
      stageId: stage.id,
      laborRp: laborByStage.get(stage.id)!.rp,
      laborHours: laborByStage.get(stage.id)!.hours,
      byKey,
      totalRp: stageTotal,
      pctOfAllocated: allocatedRp > 0 ? (stageTotal / allocatedRp) * 100 : 0,
    };
  });

  return {
    items,
    flowTotalRp,
    flowCostPerFunctionalUnit: flowTotalRp / fu,
    laborRp,
    totalRp,
    costPerFunctionalUnit: totalRp / fu,
    lines,
    byStage,
    warnings,
  };
}

export function buyToFlyRatio(project: Project): number {
  const { initialStockMassKg, finishedMassKg } = project.part;
  if (finishedMassKg <= 0) return 0;
  return initialStockMassKg / finishedMassKg;
}

export function scrapMassKg(project: Project): number {
  return Math.max(
    0,
    project.part.initialStockMassKg - project.part.finishedMassKg,
  );
}
