import type { Project } from "@/lib/domain/types";
import { computeHotspots, DEFAULT_WEIGHTS, type HotspotResult, type HotspotWeights } from "./hotspot";
import { computeLci, type LciResult } from "./lci";
import { computeLcia, type LciaResult } from "./lcia";
import { computeMfca, type MfcaResult } from "./mfca";
import { validate, type ValidationResult } from "./quality";
import { SCREENING_V1 } from "./factors";
import type { FactorSet } from "./types";
import { runAnalysis } from "./index";
import { toProjectInput } from "./inventory";
import type { RunResult } from "./types";

export const ENGINE_VERSION = "aerosphere-engine 2.2.0";

export interface Results {
  lci: LciResult;
  lcia: LciaResult;
  mfca: MfcaResult;
  hotspot: HotspotResult;
  validation: ValidationResult;
  /**
   * Engine result per spec §4 (factor profile screening_v1). Optional only
   * because runs saved before engine 2.2.0 do not have it.
   */
  analysis?: RunResult;
}

/** Single entry point: LCI → LCIA → MFCA → hotspot, plus validation. Pure. */
export function calculate(project: Project, weights: HotspotWeights = DEFAULT_WEIGHTS): Results {
  const lci = computeLci(project);
  const lcia = computeLcia(project, lci);
  const mfca = computeMfca(project, lci, lcia.totals.cc);
  const hotspot = computeHotspots(project, lci, lcia, mfca, weights);
  const validation = validate(project, lci, lcia.unmapped);
  const analysis = runAnalysis(toProjectInput(project, lci), factorSetFor(project));
  return { lci, lcia, mfca, hotspot, validation, analysis };
}

/** Headline indicators used for scenario comparison and KPI cards. */
export interface Indicators {
  energyKwh: number;
  waterL: number;
  chemicalKg: number;
  wasteKg: number;
  effluentM3: number;
  ccKg: number;
  costRp: number;
  /** MFCA negative product (ISO 14051) — Mode Ahli only. */
  costLossRp: number;
  /** Wasted value per §4.5 (chemicals, WWTP chemicals, consumables, B3, water). NaN for pre-2.2 runs. */
  wasteValueRp: number;
  perFu: { energy: number; water: number; chemical: number; waste: number; cc: number; cost: number };
}

export function indicatorsOf(r: Results): Indicators {
  const ref = r.lci.referenceFlow > 0 ? r.lci.referenceFlow : NaN;
  // Carbon comes from the engine (§4); runs saved before 2.2.0 fall back to their stored EF 3.1 value.
  const gwp = r.analysis?.impacts.find((i) => i.category === "gwp");
  const ccKg = gwp?.total ?? r.lcia.totals.cc;
  return {
    energyKwh: r.lci.totals.energyKwh,
    waterL: r.lci.totals.waterL,
    chemicalKg: r.lci.totals.chemicalKg,
    wasteKg: r.lci.totals.wasteKg,
    effluentM3: r.lci.totals.effluentM3,
    ccKg,
    costRp: r.mfca.totalCostRp,
    costLossRp: r.mfca.costLossRp,
    wasteValueRp: r.analysis ? r.analysis.waste.totalRp : NaN,
    perFu: {
      energy: r.lci.intensity.energy,
      water: r.lci.intensity.water,
      chemical: r.lci.intensity.chemical,
      waste: r.lci.intensity.waste,
      cc: ccKg / ref,
      cost: r.mfca.totalCostRp / ref,
    },
  };
}

/**
 * The screening factor set, with the electricity GWP taken from the grid
 * dataset the project maps its electricity to when that differs (e.g. a PPA/REC
 * factor entered by the user or the "Pakai listrik lebih bersih" lever). The
 * override is visible in the factor version string of the run.
 */
export function factorSetFor(project: Project): FactorSet {
  const ids = new Set(project.inputs.filter((i) => i.category === "Energy" && i.mapping.datasetId).map((i) => i.mapping.datasetId!));
  const grid = project.backgrounds.find((d) => ids.has(d.id) && typeof d.factors.cc === "number");
  const base = SCREENING_V1.flows["elec.grid_id"]!;
  const cc = grid?.factors.cc;
  if (typeof cc !== "number" || cc === base.factors.gwp) return SCREENING_V1;
  return {
    ...SCREENING_V1,
    version: `${SCREENING_V1.version}+grid=${cc}`,
    flows: { ...SCREENING_V1.flows, "elec.grid_id": { ...base, source: `${grid!.name} (faktor proyek)`, factors: { ...base.factors, gwp: cc } } },
  };
}
