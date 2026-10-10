import properInalum from "@/data/factors/proper_inalum_v1.json";
import screening from "@/data/factors/screening_v1.json";
import type { FactorSet } from "./types";

/**
 * Versioned factor tables (§4.2). The engine reads factors only from here;
 * a null factor means "belum dihitung" and is never treated as 0.
 */
export const SCREENING_V1 = screening as unknown as FactorSet;
export const PROPER_INALUM_V1 = properInalum as unknown as FactorSet;

export const FACTOR_SETS: Record<FactorSet["profile"], FactorSet> = {
  screening_v1: SCREENING_V1,
  proper_inalum_v1: PROPER_INALUM_V1,
};

/** Factor for a flow and category: number, null (known flow, no factor yet) or undefined (unknown flow). */
export function flowFactor(set: FactorSet, flowKey: string, category: string): number | null | undefined {
  const flow = set.flows[flowKey];
  if (!flow) return undefined;
  const f = flow.factors[category];
  return typeof f === "number" && Number.isFinite(f) ? f : null;
}
