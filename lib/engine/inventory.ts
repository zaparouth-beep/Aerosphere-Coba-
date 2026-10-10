import type { InputCategory, Project, SourceType } from "@/lib/domain/types";
import { computeLci, type LciResult } from "./lci";
import { resolveFlowKey } from "./method";
import { wasteTransportRp } from "./mfca";
import type { ComponentCategory, DataSource, DeviceRole, InventoryComponent, ProjectInput } from "./types";
import { concentrationFactor } from "./units";

/**
 * Adapter from the app's Project model to the engine's ProjectInput (§3.1),
 * decision Q2-b in docs/AUDIT.md. Quantities come from the LCI step, so units
 * and basis (per period / month / batch) are already canonical, and stages
 * outside the system boundary are left out.
 */

const CATEGORY: Record<InputCategory, ComponentCategory> = {
  Chemical: "chemical",
  Anode: "anode",
  WWTPChemical: "wwtp_chemical",
  Consumable: "consumable",
  Water: "water",
  Energy: "electricity",
};

const FLOW_KEY: Record<InputCategory, string> = {
  Chemical: "chem.generic",
  Anode: "chem.generic",
  Consumable: "chem.generic",
  WWTPChemical: "chem.wwtp",
  Water: "water.process",
  Energy: "elec.grid_id",
};

/** Pending confirmation (docs/AUDIT.md Q6). */
export const SOURCE_MAP: Record<SourceType, DataSource> = {
  measured: "meter",
  supplier: "invoice",
  calculated: "estimate",
  database: "literature",
  literature: "literature",
};

const DEVICE_ROLES: Array<[RegExp, DeviceRole]> = [
  [/rectifier|penyearah/i, "rectifier"],
  [/heater|pemanas/i, "heater"],
  [/chiller/i, "chiller"],
  [/oven/i, "oven"],
  [/ventil|scrubber/i, "ventilation"],
  [/pump|pompa|agitat/i, "pump"],
  [/compress|udara tekan/i, "compressed_air"],
  [/di\s*\/?\s*ro/i, "di_ro"],
  [/wwtp|ipal/i, "wwtp"],
];

export function deviceRoleOf(name: string): DeviceRole | undefined {
  return DEVICE_ROLES.find(([re]) => re.test(name))?.[1];
}

/** WWTP chemicals that scale with the drag-out load or with the effluent volume (§6 L1, L2). */
export function scalesWithOf(category: ComponentCategory, name: string, stage: string): InventoryComponent["scalesWith"] {
  if (category === "wwtp_chemical") {
    if (/cr\s*\(?vi\)?\s*reduc|pereduksi|naoh|lime|kapur/i.test(name)) return "dragout_load";
    if (/coagul|floc|koagulan|flokulan/i.test(name)) return "effluent_volume";
    return "none";
  }
  if (category === "waste_b3" && stage === "F") return "dragout_load";
  return undefined;
}

const AIR_KEY: Record<string, string> = { acid_mist: "air.acid_mist", crvi_air: "air.cr6" };

function coatingType(text: string): ProjectInput["coatingType"] {
  if (/hard\s*chrom/i.test(text)) return "hard_chrome";
  if (/anodi/i.test(text)) return "anodize_chromic";
  if (/zn\s*-?\s*ni|zinc.?nickel/i.test(text)) return "zinc_nickel";
  if (/cadmium|\bcd\b/i.test(text)) return "cadmium";
  if (/nickel|nikel|\bni\b/i.test(text)) return "nickel";
  return "other";
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function toProjectInput(project: Project, lci: LciResult = computeLci(project)): ProjectInput {
  const inputs = new Map(project.inputs.map((i) => [i.id, i]));
  const air = new Map(project.airEmissions.map((a) => [a.id, a]));
  const waste = new Map(project.waste.map((w) => [w.id, w]));
  const components: InventoryComponent[] = [];

  for (const f of lci.flows) {
    if (!f.inBoundary || f.error) continue;
    if (f.kind === "input") {
      const i = inputs.get(f.id);
      if (!i) continue;
      const category = CATEGORY[i.category];
      components.push({
        id: i.id,
        stage: i.stageId,
        category,
        name: i.name,
        flowKey: FLOW_KEY[i.category],
        quantity: f.quantity,
        unit: f.unit,
        source: SOURCE_MAP[i.meta.sourceType],
        deviceRole: category === "electricity" ? deviceRoleOf(i.name) : undefined,
        scalesWith: scalesWithOf(category, i.name, i.stageId),
        unitPriceRp: i.unitPriceRp,
      });
    } else if (f.kind === "waste") {
      const w = waste.get(f.id);
      if (!w) continue;
      components.push({
        id: w.id,
        stage: w.stageId,
        category: "waste_b3",
        name: w.wasteType,
        flowKey: "waste.b3",
        quantity: f.quantity,
        unit: "kg",
        source: w.meta.sourceType === "measured" ? "weighing" : SOURCE_MAP[w.meta.sourceType],
        scalesWith: scalesWithOf("waste_b3", w.wasteType, w.stageId),
      });
    } else if (f.kind === "air") {
      const a = air.get(f.id);
      if (!a) continue;
      const key = resolveFlowKey(a.parameter, a.flowKey, "air");
      components.push({
        id: a.id,
        stage: a.stageId,
        category: "air_emission",
        name: a.parameter,
        flowKey: key ? (AIR_KEY[key] ?? `air.${key}`) : `air.${slug(a.parameter)}`,
        quantity: f.quantity,
        unit: "kg",
        source: SOURCE_MAP[a.meta.sourceType],
      });
    }
  }

  // Effluent parameters as concentrations in mg/L; loads are computed by the engine (§4.4).
  if (project.stages.find((s) => s.id === "F")?.inBoundary !== false) {
    for (const e of project.effluent) {
      const kgPerM3 = concentrationFactor(e.unit);
      if (kgPerM3 === null) continue;
      components.push({
        id: e.id,
        stage: "F",
        category: "effluent_param",
        name: e.parameter,
        flowKey: `effluent.${slug(e.parameter)}`,
        quantity: e.value * kgPerM3 * 1000,
        unit: "mg/L",
        source: "lab",
      });
    }
  }

  const p = project.prices;
  return {
    projectId: project.id,
    name: project.name,
    facility: project.facility,
    periodStart: "",
    periodEnd: "",
    periodLabel: project.periodLabel,
    coatingType: coatingType(`${project.coatingType} ${project.template}`),
    areaPlatedM2: lci.referenceFlow,
    components,
    prices: {
      electricityRpPerKWh: p.energyRpPerKwh,
      waterRpPerL: p.waterRpPerL,
      chemicalRpPerKg: p.chemicalRpPerKg,
      wwtpChemicalRpPerKg: p.wwtpChemicalRpPerKg,
      consumableRpPerKg: p.consumableRpPerKg,
      b3TreatmentRpPerKg: p.wasteTreatmentRpPerKg,
      b3TransportRpPerPeriod: wasteTransportRp(project),
      laborRpPerPeriod: p.laborRpPerPeriod,
      otherFixedRpPerPeriod: p.depreciationRpPerPeriod,
    },
    methodProfile: "screening_v1",
    effluentMeasuredM3: project.production.effluentVolumeM3 > 0 ? project.production.effluentVolumeM3 : undefined,
  };
}
