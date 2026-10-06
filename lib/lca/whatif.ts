import {
  computeCostBreakdown,
  computeIntensities,
  type CostSummary,
} from "./calculations";
import { computeEnvironmentalImpact, type EnvironmentalImpactSummary } from "./lcia";
import type { IntensityMetrics, Project, WhatIfLever } from "./types";

function cloneProject(project: Project): Project {
  return structuredClone(project);
}

/** Applies each selected lever's reduction to the relevant flows in a cloned
 * project. Levers are cumulative and applied independently on the original
 * quantities (not compounded on each other) so the effect of combining levers
 * stays easy to reason about. */
export function applyWhatIfLevers(project: Project, activeLevers: WhatIfLever[]): Project {
  const scenario = cloneProject(project);

  for (const lever of activeLevers) {
    const r = lever.reductionPct;

    if (lever.affects.rinseWaterPct) {
      for (const input of scenario.lciInputs) {
        if (input.category === "Water") {
          input.quantity *= 1 - r;
        }
      }
      // Cascading effect: less water to treat means less WWTP chemical dosing
      // and less sludge generated, at a damped rate versus the water saving itself.
      const cascade = r * 0.5;
      for (const input of scenario.lciInputs) {
        if (input.category === "WWTPChemical") {
          input.quantity *= 1 - cascade;
        }
      }
      for (const waste of scenario.hazardousWaste) {
        if (waste.sourceStageId === "wwtp") {
          waste.quantityKgMonth *= 1 - cascade;
        }
      }
      // Less rinse water leaves the same drag-out mass in a smaller volume, so effluent
      // concentrations rise by 1/(1-r) and pollutant loads stay constant.
      for (const effluent of scenario.waterEffluent) {
        if (effluent.parameter === "Effluent volume") {
          effluent.value *= 1 - r;
        } else if (/\/l$|\/m3$/i.test(effluent.unit.trim()) && r < 1) {
          effluent.value /= 1 - r;
        }
      }
    }

    if (lever.affects.rectifierEnergyPct) {
      for (const input of scenario.lciInputs) {
        if (input.category === "Energy" && input.stageId === "main_plating") {
          input.quantity *= 1 - r;
        }
      }
    }

    if (lever.affects.dragOutChemicalPct) {
      for (const input of scenario.lciInputs) {
        if (
          (input.category === "Chemical" || input.category === "Anode") &&
          input.stageId === "main_plating"
        ) {
          input.quantity *= 1 - r;
        }
      }
      // Less drag-out means less contamination reaching the rinse/WWTP stream.
      const cascade = r * 0.3;
      for (const input of scenario.lciInputs) {
        if (input.category === "WWTPChemical") {
          input.quantity *= 1 - cascade;
        }
      }
    }
  }

  return scenario;
}

export interface ScenarioSnapshot {
  intensities: IntensityMetrics;
  impact: EnvironmentalImpactSummary;
  cost: CostSummary;
}

function snapshot(project: Project): ScenarioSnapshot {
  return {
    intensities: computeIntensities(project),
    impact: computeEnvironmentalImpact(project),
    cost: computeCostBreakdown(project),
  };
}

export interface ScenarioComparison {
  before: ScenarioSnapshot;
  after: ScenarioSnapshot;
  savings: {
    energyKwh: number;
    energyPct: number;
    waterL: number;
    waterPct: number;
    chemicalKg: number;
    chemicalPct: number;
    wasteKgB3: number;
    wastePct: number;
    ghgKgCO2e: number;
    ghgPct: number;
    costRp: number;
    costPct: number;
  };
}

function safePct(before: number, after: number): number {
  if (before <= 0) return 0;
  return ((before - after) / before) * 100;
}

export function compareScenario(
  project: Project,
  activeLevers: WhatIfLever[],
): ScenarioComparison {
  const before = snapshot(project);
  const scenarioProject = applyWhatIfLevers(project, activeLevers);
  const after = snapshot(scenarioProject);

  const fu = project.functionalUnit.value > 0 ? project.functionalUnit.value : 1;
  const beforeEnergy = before.intensities.energyIntensity * fu;
  const afterEnergy = after.intensities.energyIntensity * fu;
  const beforeWater = before.intensities.waterIntensity * fu;
  const afterWater = after.intensities.waterIntensity * fu;
  const beforeChemical = before.intensities.chemicalIntensity * fu;
  const afterChemical = after.intensities.chemicalIntensity * fu;
  const beforeWaste = before.intensities.wasteIntensity * fu;
  const afterWaste = after.intensities.wasteIntensity * fu;

  return {
    before,
    after,
    savings: {
      energyKwh: beforeEnergy - afterEnergy,
      energyPct: safePct(beforeEnergy, afterEnergy),
      waterL: beforeWater - afterWater,
      waterPct: safePct(beforeWater, afterWater),
      chemicalKg: beforeChemical - afterChemical,
      chemicalPct: safePct(beforeChemical, afterChemical),
      wasteKgB3: beforeWaste - afterWaste,
      wastePct: safePct(beforeWaste, afterWaste),
      ghgKgCO2e: before.impact.totalGhgKgCO2e - after.impact.totalGhgKgCO2e,
      ghgPct: safePct(before.impact.totalGhgKgCO2e, after.impact.totalGhgKgCO2e),
      costRp: before.cost.flowTotalRp - after.cost.flowTotalRp,
      costPct: safePct(before.cost.flowTotalRp, after.cost.flowTotalRp),
    },
  };
}
