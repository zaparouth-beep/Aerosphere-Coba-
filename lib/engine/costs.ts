import type { Trace } from "./trace";
import type { InventoryComponent, PriceTable, StageCode, WasteValueResult } from "./types";

/** Which wasted-value bucket a component's cost goes to; anodes, energy and fuel are not waste. */
const WASTE_BUCKET: Partial<Record<InventoryComponent["category"], keyof WasteValueResult["items"]>> = {
  chemical: "processChemicalRp",
  wwtp_chemical: "wwtpChemicalRp",
  consumable: "consumableRp",
  water: "waterRp",
  waste_b3: "b3TreatmentRp",
};

const zero = (): Record<StageCode, number> => ({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 });

/** Rp per canonical unit for a component (item price wins over the category price). */
export function unitPrice(c: InventoryComponent, prices: PriceTable): number {
  if (c.unitPriceRp !== undefined && c.unitPriceRp > 0) return c.unitPriceRp;
  switch (c.category) {
    case "electricity":
      return prices.electricityRpPerKWh;
    case "water":
      return prices.waterRpPerL;
    case "chemical":
    case "anode":
      return prices.chemicalRpPerKg;
    case "wwtp_chemical":
      return prices.wwtpChemicalRpPerKg;
    case "consumable":
      return prices.consumableRpPerKg;
    case "waste_b3":
      return prices.b3TreatmentRpPerKg;
    default:
      return 0;
  }
}

export interface CostResult {
  costRp: number;
  stageCostRp: Record<StageCode, number>;
  componentCostRp: Map<string, number>;
  waste: WasteValueResult;
  /** Wasted value per component (B3 transport is shared by B3 mass). */
  componentWasteRp: Map<string, number>;
}

/**
 * §4.5. Process cost = Σ qty × price + B3 transport + labour (+ other fixed cost).
 * Wasted value = process chemicals (not anodes) + WWTP chemicals + consumables
 * + B3 treatment & transport + water. Energy and labour are operating cost, not waste.
 */
export function computeCosts(active: InventoryComponent[], prices: PriceTable, trace: Trace): CostResult {
  const componentCostRp = new Map<string, number>();
  const componentWasteRp = new Map<string, number>();
  const stageCostRp = zero();
  const wastePerStage = zero();
  const items = { processChemicalRp: 0, wwtpChemicalRp: 0, consumableRp: 0, b3TreatmentRp: 0, b3TransportRp: 0, waterRp: 0 };
  let componentsRp = 0;

  const b3 = active.filter((c) => c.category === "waste_b3");
  const b3Mass = b3.reduce((s, c) => s + c.quantity, 0);

  for (const c of active) {
    if (c.category === "air_emission" || c.category === "effluent_param") continue;
    const cost = c.quantity * unitPrice(c, prices);
    componentCostRp.set(c.id, cost);
    componentsRp += cost;
    stageCostRp[c.stage] += cost;
    const bucket = WASTE_BUCKET[c.category];
    let wasted = 0;
    if (bucket) {
      items[bucket] += cost;
      wasted = cost;
    }
    if (c.category === "waste_b3" && b3Mass > 0) {
      const transport = prices.b3TransportRpPerPeriod * (c.quantity / b3Mass);
      stageCostRp[c.stage] += transport;
      wasted += transport;
    }
    if (wasted) {
      componentWasteRp.set(c.id, wasted);
      wastePerStage[c.stage] += wasted;
    }
  }
  items.b3TransportRp = prices.b3TransportRpPerPeriod;

  const fixed = prices.laborRpPerPeriod + (prices.otherFixedRpPerPeriod ?? 0);
  const costRp = componentsRp + prices.b3TransportRpPerPeriod + fixed;
  trace.add({
    id: "cost.total",
    label: "Biaya proses",
    formula: "Σ (jumlah × harga) + transport limbah B3 + tenaga kerja + biaya tetap lain",
    inputs: {
      komponen: { value: componentsRp, unit: "Rp" },
      transportB3: { value: prices.b3TransportRpPerPeriod, unit: "Rp" },
      tenagaKerja: { value: prices.laborRpPerPeriod, unit: "Rp" },
      biayaTetapLain: { value: prices.otherFixedRpPerPeriod ?? 0, unit: "Rp" },
    },
    result: { value: costRp, unit: "Rp" },
  });

  const totalRp = items.processChemicalRp + items.wwtpChemicalRp + items.consumableRp + items.b3TreatmentRp + items.b3TransportRp + items.waterRp;
  const pctOfCost = costRp > 0 ? (totalRp / costRp) * 100 : 0;
  trace.add({
    id: "waste.total",
    label: "Nilai terbuang",
    formula: "kimia proses (bukan anoda) + kimia IPAL + consumable + pengolahan & transport limbah B3 + air",
    inputs: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, { value: v, unit: "Rp" }])),
    result: { value: totalRp, unit: "Rp" },
  });
  trace.add({
    id: "waste.pct",
    label: "Persen nilai terbuang",
    formula: "nilai terbuang ÷ biaya proses × 100",
    inputs: { nilaiTerbuang: { value: totalRp, unit: "Rp" }, biayaProses: { value: costRp, unit: "Rp" } },
    result: { value: pctOfCost, unit: "%" },
  });

  return { costRp, stageCostRp, componentCostRp, componentWasteRp, waste: { totalRp, pctOfCost, items, perStage: wastePerStage } };
}
