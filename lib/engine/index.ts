import { dataConfidence } from "./confidence";
import { computeCosts } from "./costs";
import { findHotspots, type IndicatorInput } from "./hotspot";
import { computeImpacts } from "./impacts";
import { Trace } from "./trace";
import type { EngineWarning, FactorSet, ProjectInput, RunResult, StageCode, StageResult, Totals } from "./types";
import { STAGE_CODES } from "./types";
import { waterBalance } from "./water";

export type { ProjectInput, RunResult } from "./types";

const KG_CATEGORIES = new Set(["chemical", "anode", "wwtp_chemical", "consumable"]);

/**
 * Engine entry point (§4.1): a pure function of the input and the versioned
 * factor set. No UI, clock or randomness; every headline number is traced.
 */
export function runAnalysis(input: ProjectInput, factors: FactorSet): RunResult {
  const trace = new Trace();
  const active = input.components.filter((c) => !c.deletedAt);
  const area = input.areaPlatedM2;
  const warnings: EngineWarning[] = [];
  if (!(area > 0)) warnings.push({ code: "NO_AREA", message: "Luas permukaan dilapisi belum diisi, jadi angka per m² tidak bisa dihitung." });

  // Inventory per stage (§4.3).
  const perStage = Object.fromEntries(
    STAGE_CODES.map((s) => [s, { electricityKWh: 0, waterL: 0, chemicalKg: 0, wasteB3Kg: 0, costRp: 0, wasteValueRp: 0 } satisfies StageResult]),
  ) as Record<StageCode, StageResult>;
  for (const c of active) {
    const st = perStage[c.stage];
    if (c.category === "electricity") st.electricityKWh += c.quantity;
    else if (c.category === "water") st.waterL += c.quantity;
    else if (KG_CATEGORIES.has(c.category)) st.chemicalKg += c.quantity;
    else if (c.category === "waste_b3") st.wasteB3Kg += c.quantity;
  }
  const sum = (k: keyof StageResult) => STAGE_CODES.reduce((s, id) => s + perStage[id][k], 0);

  const water = waterBalance(input, active, trace);
  if (water.warning) warnings.push(water.warning);

  const impacts = computeImpacts(factors, active, water.loadsKg, area, trace);
  if (factors.status === "screening") {
    warnings.push({ code: "SCREENING_FACTORS", message: `Faktor dampak berstatus skrining (${factors.version}); belum hasil LCA formal.` });
  }
  for (const i of impacts) {
    if (i.status === "partial") warnings.push({ code: "FACTOR_MISSING", message: `${i.labelId}: ${i.missing.length} komponen belum punya faktor dan belum dihitung.` });
  }

  const costs = computeCosts(active, input.prices, trace);
  for (const s of STAGE_CODES) {
    perStage[s].costRp = costs.stageCostRp[s];
    perStage[s].wasteValueRp = costs.waste.perStage[s];
  }

  const totals: Totals = {
    electricityKWh: sum("electricityKWh"),
    waterL: sum("waterL"),
    chemicalKg: sum("chemicalKg"),
    wasteB3Kg: sum("wasteB3Kg"),
    effluentM3: water.effluentM3,
    costRp: costs.costRp,
    wasteValueRp: costs.waste.totalRp,
  };
  for (const [k, unit] of [["electricityKWh", "kWh"], ["waterL", "L"], ["chemicalKg", "kg"], ["wasteB3Kg", "kg"]] as const) {
    trace.add({ id: `inventory.${k}`, label: `Total ${k}`, formula: "Σ komponen", inputs: {}, result: { value: totals[k], unit } });
  }
  const div = area > 0 ? area : NaN;
  const perFU = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / div])) as unknown as Totals;
  trace.add({
    id: "cost.perFU",
    label: "Biaya proses per m²",
    formula: "biaya proses ÷ luas dilapisi",
    inputs: { biaya: { value: totals.costRp, unit: "Rp" }, luas: { value: area, unit: "m²" } },
    result: { value: perFU.costRp, unit: "Rp/m²" },
  });

  // Titik boros per indicator (§4.6).
  const indicators: IndicatorInput[] = [];
  for (const i of impacts) {
    if (i.total === null) continue;
    indicators.push({ indicator: i.category, perStage: i.perStage as Record<StageCode, number>, contributions: i.contributions });
  }
  const qtyIndicator = (indicator: string, pick: (s: StageResult) => number, category: string): IndicatorInput => ({
    indicator,
    perStage: Object.fromEntries(STAGE_CODES.map((s) => [s, pick(perStage[s])])) as Record<StageCode, number>,
    contributions: active.filter((c) => c.category === category).map((c) => ({ componentId: c.id, name: c.name, stage: c.stage, value: c.quantity })),
  });
  indicators.push(qtyIndicator("water", (s) => s.waterL, "water"));
  indicators.push(qtyIndicator("waste_b3", (s) => s.wasteB3Kg, "waste_b3"));
  indicators.push({
    indicator: "waste_value",
    perStage: costs.waste.perStage,
    contributions: active.filter((c) => costs.componentWasteRp.has(c.id)).map((c) => ({ componentId: c.id, name: c.name, stage: c.stage, value: costs.componentWasteRp.get(c.id)! })),
  });
  const hotspots = findHotspots(indicators, input.hotspotThresholdPct ?? 30);

  return {
    factorVersion: factors.version,
    perStage,
    totals,
    perFU,
    impacts,
    hotspots,
    waste: costs.waste,
    dataConfidence: dataConfidence(active, impacts.find((i) => i.category === "gwp"), factors, warnings),
    warnings,
    trace: trace.steps,
  };
}
