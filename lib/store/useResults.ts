"use client";

import { useMemo } from "react";
import type { Project } from "@/lib/domain/types";
import { calculate, indicatorsOf, type Indicators, type Results } from "@/lib/engine/calculate";
import type { Run } from "@/lib/engine/run";
import { evaluateScenario, type ScenarioOutcome } from "@/lib/engine/scenario";
import { useAppStore } from "./useAppStore";

export interface ActiveResults {
  /** Project the results belong to: the live draft or the run snapshot. */
  project: Project;
  results: Results;
  indicators: Indicators;
  run: Run | null;
  isLive: boolean;
}

/**
 * Results shown on every page: the selected locked run, or the live draft
 * when none is selected. The engine is pure, so memoising on the project
 * object is enough.
 */
export function useActiveResults(): ActiveResults {
  const project = useAppStore((s) => s.project);
  const runs = useAppStore((s) => s.runs);
  const activeRunId = useAppStore((s) => s.ui.activeRunId);
  const weights = useAppStore((s) => s.ui.hotspotWeights);
  const run = activeRunId ? (runs.find((r) => r.id === activeRunId) ?? null) : null;

  return useMemo(() => {
    if (run) return { project: run.snapshot, results: run.results, indicators: indicatorsOf(run.results), run, isLive: false };
    const results = calculate(project, weights);
    return { project, results, indicators: indicatorsOf(results), run: null, isLive: true };
  }, [project, run, weights]);
}

export function useScenarioOutcomes(): { base: Indicators; outcomes: ScenarioOutcome[] } {
  const { project, indicators } = useActiveResults();
  return useMemo(
    () => ({ base: indicators, outcomes: project.scenarios.map((s) => evaluateScenario(project, s, indicators)) }),
    [project, indicators],
  );
}

export interface Comparison {
  label: string;
  indicators: Indicators;
  ref: number;
}

/**
 * "Bandingkan dengan" (PRD v1.1 §3.0.3): the chosen saved result, or the saved
 * result before the one shown. Null when there is nothing to compare with.
 */
export function useComparison(): Comparison | null {
  const runs = useAppStore((s) => s.runs);
  const activeRunId = useAppStore((s) => s.ui.activeRunId);
  const compareRunId = useAppStore((s) => s.ui.compareRunId);
  return useMemo(() => {
    let target: Run | undefined;
    if (compareRunId) target = runs.find((r) => r.id === compareRunId);
    else {
      const idx = activeRunId ? runs.findIndex((r) => r.id === activeRunId) + 1 : 0;
      target = runs[idx];
    }
    if (!target || target.id === activeRunId) return null;
    return { label: `Hasil #${target.id}`, indicators: indicatorsOf(target.results), ref: target.results.lci.referenceFlow };
  }, [runs, activeRunId, compareRunId]);
}
