import type { EngineWarning, InventoryComponent, ProjectInput } from "./types";
import type { Trace } from "./trace";

export const DEFAULT_WATER_LOSS = 0.1;

export interface WaterBalance {
  waterInL: number;
  effluentM3: number;
  measured: boolean;
  warning: EngineWarning | null;
  /** Effluent loads in kg per effluent parameter component (Q × C). */
  loadsKg: Map<string, number>;
}

/**
 * §4.4: effluent = water in × (1 − loss), unless a measured volume is given.
 * A measured volume above water in is flagged but does not block the run.
 */
export function waterBalance(input: ProjectInput, active: InventoryComponent[], trace: Trace): WaterBalance {
  const waterInL = active.filter((c) => c.category === "water").reduce((s, c) => s + c.quantity, 0);
  trace.add({ id: "water.in", label: "Air masuk", formula: "Σ komponen air", inputs: {}, result: { value: waterInL, unit: "L" } });

  const loss = input.waterLossFraction ?? DEFAULT_WATER_LOSS;
  const measured = input.effluentMeasuredM3 !== undefined && input.effluentMeasuredM3 > 0;
  const effluentM3 = measured ? (input.effluentMeasuredM3 as number) : (waterInL / 1000) * (1 - loss);
  trace.add({
    id: "water.effluent",
    label: "Volume air buangan",
    formula: measured ? "volume terukur" : "air masuk × (1 − bagian hilang)",
    inputs: measured ? { terukur: { value: effluentM3, unit: "m³" } } : { airMasuk: { value: waterInL / 1000, unit: "m³" }, bagianHilang: { value: loss, unit: "-" } },
    result: { value: effluentM3, unit: "m³" },
  });

  const warning: EngineWarning | null =
    measured && effluentM3 * 1000 > waterInL
      ? { code: "WATER_BALANCE", message: "Air buangan lebih besar dari air masuk. Periksa angka air masuk atau volume efluen." }
      : null;

  const loadsKg = new Map<string, number>();
  for (const c of active) {
    if (c.category !== "effluent_param" || c.unit.toLowerCase() !== "mg/l") continue;
    loadsKg.set(c.id, (effluentM3 * c.quantity) / 1000);
  }
  return { waterInL, effluentM3, measured, warning, loadsKg };
}
