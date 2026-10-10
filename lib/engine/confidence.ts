import type { DataSource, EngineWarning, FactorSet, ImpactResult, InventoryComponent } from "./types";

const SCORE: Record<DataSource, number> = { meter: 3, weighing: 3, lab: 3, invoice: 2, estimate: 1, literature: 1 };

/**
 * §4.7: score per component (meter/weighing/lab 3, invoice 2, estimate/literature 1),
 * weighted by contribution to the carbon footprint. Screening factors cap the
 * result at "medium"; a water-balance warning lowers it to "low" (§4.4).
 */
export function dataConfidence(
  active: InventoryComponent[],
  gwp: ImpactResult | undefined,
  set: FactorSet,
  warnings: EngineWarning[],
): "high" | "medium" | "low" {
  if (warnings.some((w) => w.code === "WATER_BALANCE")) return "low";
  const weight = new Map<string, number>();
  for (const c of gwp?.contributions ?? []) weight.set(c.componentId, (weight.get(c.componentId) ?? 0) + Math.abs(c.value));
  const inventory = active.filter((c) => c.category !== "effluent_param" && c.category !== "air_emission" && c.quantity > 0);
  const totalWeight = inventory.reduce((s, c) => s + (weight.get(c.id) ?? 0), 0);
  const score =
    totalWeight > 0
      ? inventory.reduce((s, c) => s + (weight.get(c.id) ?? 0) * SCORE[c.source], 0) / totalWeight
      : inventory.length
        ? inventory.reduce((s, c) => s + SCORE[c.source], 0) / inventory.length
        : 1;
  let level: "high" | "medium" | "low" = score >= 2.5 ? "high" : score >= 1.8 ? "medium" : "low";
  if (set.status !== "verified" && level === "high") level = "medium";
  return level;
}
