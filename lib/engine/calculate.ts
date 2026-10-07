import type { Project } from "@/lib/domain/types";
import { computeHotspots, DEFAULT_WEIGHTS, type HotspotResult, type HotspotWeights } from "./hotspot";
import { computeLci, type LciResult } from "./lci";
import { computeLcia, type LciaResult } from "./lcia";
import { computeMfca, type MfcaResult } from "./mfca";
import { validate, type ValidationResult } from "./quality";

export const ENGINE_VERSION = "aerosphere-engine 2.0.0";

export interface Results {
  lci: LciResult;
  lcia: LciaResult;
  mfca: MfcaResult;
  hotspot: HotspotResult;
  validation: ValidationResult;
}

/** Single entry point: LCI → LCIA → MFCA → hotspot, plus validation. Pure. */
export function calculate(project: Project, weights: HotspotWeights = DEFAULT_WEIGHTS): Results {
  const lci = computeLci(project);
  const lcia = computeLcia(project, lci);
  const mfca = computeMfca(project, lci, lcia.totals.cc);
  const hotspot = computeHotspots(project, lci, lcia, mfca, weights);
  const validation = validate(project, lci, lcia.unmapped);
  return { lci, lcia, mfca, hotspot, validation };
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
  costLossRp: number;
  perFu: { energy: number; water: number; chemical: number; waste: number; cc: number; cost: number };
}

export function indicatorsOf(r: Results): Indicators {
  const ref = r.lci.referenceFlow > 0 ? r.lci.referenceFlow : NaN;
  return {
    energyKwh: r.lci.totals.energyKwh,
    waterL: r.lci.totals.waterL,
    chemicalKg: r.lci.totals.chemicalKg,
    wasteKg: r.lci.totals.wasteKg,
    effluentM3: r.lci.totals.effluentM3,
    ccKg: r.lcia.totals.cc,
    costRp: r.mfca.totalCostRp,
    costLossRp: r.mfca.costLossRp,
    perFu: {
      energy: r.lci.intensity.energy,
      water: r.lci.intensity.water,
      chemical: r.lci.intensity.chemical,
      waste: r.lci.intensity.waste,
      cc: r.lcia.perFu.cc,
      cost: r.mfca.totalCostRp / ref,
    },
  };
}
