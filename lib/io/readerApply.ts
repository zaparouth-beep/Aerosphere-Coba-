import { meta, newId, screeningMapping } from "@/lib/domain/templates";
import type { AirEmission, EffluentParam, ExternalImpact, HazardousWaste, InputFlow, Project } from "@/lib/domain/types";
import { CATEGORY_DIMENSION, parseUnit } from "@/lib/engine/units";
import { tx } from "@/lib/i18n";
import type { ReadRow } from "./smartReader";

/**
 * Turns the reviewed rows into project data that replaces the current
 * inventory (the old data is backed up by the store). Quantities stay in the
 * unit of the document; the engine converts to canonical units.
 */

const MASS_TO_KG: Record<string, number> = { kg: 1, g: 1e-3, mg: 1e-6, ton: 1000 };
const VOL_TO_M3: Record<string, number> = { m3: 1, L: 1e-3, ml: 1e-6 };

export interface ApplyResult {
  data: Pick<Project, "inputs" | "airEmissions" | "effluent" | "waste" | "production"> & { externalImpacts?: ExternalImpact[] };
  skipped: Array<{ row: ReadRow; reason: string }>;
}

export function buildImport(rows: ReadRow[], project: Project, source: string): ApplyResult {
  const used = rows.filter((r) => r.include && r.quantity !== null);
  const skipped: ApplyResult["skipped"] = [];
  const gridMapping = project.inputs.find((i) => i.category === "Energy")?.mapping;
  const inputs: InputFlow[] = [];
  const airEmissions: AirEmission[] = [];
  const effluent: EffluentParam[] = [];
  const waste: HazardousWaste[] = [];
  const externalImpacts: ExternalImpact[] = [];
  const production = { ...project.production };
  const note = `Diimpor dari ${source}`;

  for (const r of used) {
    const q = r.quantity as number;
    const stage = r.stage ?? "C";
    switch (r.kind) {
      case "input": {
        const category = r.category ?? "Chemical";
        const parsed = parseUnit(r.unit);
        if (!parsed || parsed.dim !== CATEGORY_DIMENSION[category]) {
          skipped.push({ row: r, reason: tx(`Satuan “${r.unit}” tidak cocok untuk ${category}`, `Unit “${r.unit}” doesn't fit ${category}`) });
          continue;
        }
        inputs.push({
          id: newId("in"),
          no: inputs.length + 1,
          category,
          name: r.name,
          stageId: stage,
          quantity: q,
          unit: r.unit,
          basis: r.basis,
          meta: meta(r.sourceType, source, "Dibaca dari dokumen", 10, note),
          mapping: category === "Energy" && gridMapping ? gridMapping : screeningMapping(category),
        });
        break;
      }
      case "air": {
        const k = MASS_TO_KG[r.unit];
        if (k === undefined) {
          skipped.push({ row: r, reason: tx(`Emisi udara perlu satuan massa (kg), bukan “${r.unit}”`, `Air emissions need a mass unit (kg), not “${r.unit}”`) });
          continue;
        }
        airEmissions.push({ id: newId("air"), parameter: r.name, relevance: note, applicable: true, stageId: stage, quantityKg: q * k, basis: r.basis, meta: meta(r.sourceType, source, "Dibaca dari dokumen") });
        break;
      }
      case "effluent":
        effluent.push({ id: newId("eff"), parameter: r.name, unit: r.unit || "mg/L", value: q });
        break;
      case "waste": {
        const k = MASS_TO_KG[r.unit];
        if (k === undefined) {
          skipped.push({ row: r, reason: tx(`Limbah B3 perlu satuan massa (kg), bukan “${r.unit}”`, `B3 waste needs a mass unit (kg), not “${r.unit}”`) });
          continue;
        }
        waste.push({
          id: newId("waste"),
          wasteType: r.name,
          stageId: stage,
          quantityKg: q * k,
          basis: r.basis,
          moisturePct: 0,
          metalContentPct: 0,
          treatment: "",
          destination: "",
          transportKm: 0,
          recovery: false,
          meta: meta(r.sourceType === "measured" ? "measured" : r.sourceType, source, "Dibaca dari dokumen"),
          mapping: { status: "unmapped" },
        });
        break;
      }
      case "production":
        if (r.productionField === "areaM2") production.areaM2 = q;
        else if (r.productionField === "parts") production.parts = q;
        else if (r.productionField === "effluentVolumeM3") production.effluentVolumeM3 = q * (VOL_TO_M3[r.unit] ?? 1);
        break;
      case "impact":
        externalImpacts.push({ key: r.impactKey, label: r.name, value: q, unit: r.unit, source });
        break;
      default:
        skipped.push({ row: r, reason: tx("Jenis baris belum ditentukan", "Row type not set yet") });
    }
  }

  return {
    data: { inputs, airEmissions, effluent, waste, production, externalImpacts: externalImpacts.length ? externalImpacts : undefined },
    skipped,
  };
}
