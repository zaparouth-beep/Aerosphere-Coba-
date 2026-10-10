import { flowFactor } from "./factors";
import type { Trace } from "./trace";
import type { ComponentContribution, FactorSet, ImpactResult, InventoryComponent, SourceGroup, StageCode } from "./types";
import { STAGE_CODES } from "./types";

/** Components whose impact comes from an upstream (cradle) factor per unit. */
const UPSTREAM: Record<string, SourceGroup> = {
  electricity: "electricity",
  chemical: "chemical",
  anode: "chemical",
  consumable: "chemical",
  wwtp_chemical: "wwtp_chemical",
  water: "water",
  fuel: "fuel",
  waste_b3: "waste_b3",
};

const emptyStages = <T>(v: T): Record<StageCode, T> => ({ A: v, B: v, C: v, D: v, E: v, F: v });

/**
 * §4.3: Impact[s,k] = Σ qty × factor (inputs of stage s) + Σ direct emission × CF.
 * A category with no factor at all is not_computed (total null); one with some
 * missing factors is partial and lists the components that were not counted.
 */
export function computeImpacts(
  set: FactorSet,
  active: InventoryComponent[],
  effluentLoadsKg: Map<string, number>,
  areaM2: number,
  trace: Trace,
): ImpactResult[] {
  return set.categories.map((cat) => {
    const contributions: ComponentContribution[] = [];
    const missing: string[] = [];

    for (const c of active) {
      const upstream = UPSTREAM[c.category];
      if (upstream) {
        const f = flowFactor(set, c.flowKey, cat.key);
        if (typeof f === "number") contributions.push({ componentId: c.id, name: c.name, stage: c.stage, source: upstream, value: c.quantity * f, point: "cradle" });
        else if (c.quantity > 0) missing.push(c.name);
        continue;
      }
      const cf = set.directEmissionCF[c.flowKey]?.[cat.key];
      if (typeof cf !== "number") continue; // category does not apply to this emission
      if (c.category === "air_emission") {
        contributions.push({ componentId: c.id, name: c.name, stage: c.stage, source: "direct_air", value: c.quantity * cf, point: "gate" });
      } else if (c.category === "effluent_param") {
        const load = effluentLoadsKg.get(c.id);
        if (load !== undefined) contributions.push({ componentId: c.id, name: c.name, stage: c.stage, source: "direct_water", value: load * cf, point: "gate" });
      }
    }

    const computed = contributions.length > 0;
    const perStage = emptyStages<number | null>(computed ? 0 : null);
    const bySource: Partial<Record<SourceGroup, number>> = {};
    let cradle = 0;
    let gate = 0;
    for (const x of contributions) {
      perStage[x.stage] = (perStage[x.stage] as number) + x.value;
      bySource[x.source] = (bySource[x.source] ?? 0) + x.value;
      if (x.point === "cradle") cradle += x.value;
      else gate += x.value;
    }
    const total = computed ? contributions.reduce((s, x) => s + x.value, 0) : null;
    const share = emptyStages<number | null>(null);
    if (total !== null && total > 0) for (const s of STAGE_CODES) share[s] = ((perStage[s] as number) / total) * 100;
    if (total !== null && total === 0) for (const s of STAGE_CODES) share[s] = 0;

    if (total !== null) {
      trace.add({
        id: `impact.${cat.key}.total`,
        label: `${cat.labelId} total`,
        formula: "Σ jumlah × faktor (hulu) + Σ emisi langsung × CF",
        inputs: Object.fromEntries(Object.entries(bySource).map(([k, v]) => [k, { value: v as number, unit: cat.unit }])),
        result: { value: total, unit: cat.unit },
      });
      for (const s of STAGE_CODES) {
        trace.add({ id: `impact.${cat.key}.stage.${s}`, label: `${cat.labelId} tahap ${s}`, formula: "Σ kontribusi komponen tahap", inputs: {}, result: { value: perStage[s] as number, unit: cat.unit } });
      }
    }
    const perFU = total !== null && areaM2 > 0 ? total / areaM2 : null;
    if (perFU !== null) {
      trace.add({
        id: `impact.${cat.key}.perFU`,
        label: `${cat.labelId} per m²`,
        formula: "total ÷ luas dilapisi",
        inputs: { total: { value: total as number, unit: cat.unit }, luas: { value: areaM2, unit: "m²" } },
        result: { value: perFU, unit: `${cat.unit}/m²` },
      });
    }

    return {
      category: cat.key,
      labelId: cat.labelId,
      labelEn: cat.labelEn,
      unit: cat.unit,
      method: cat.method,
      status: !computed ? "not_computed" : missing.length ? "partial" : "computed",
      total,
      perFU,
      perStage,
      share,
      bySource,
      byPoint: { cradle: computed ? cradle : null, gate: computed ? gate : null },
      contributions,
      missing,
    };
  });
}
