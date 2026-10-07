import type { StageId } from "@/lib/domain/types";

/**
 * Okabe-Ito categorical order (PRD 3.1), re-ordered so adjacent slots pass the
 * CVD check (worst adjacent ΔE 9,6 deutan). Three slots sit below 3:1 contrast,
 * so every chart ships direct labels or a table view.
 */
export const CATEGORICAL = ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#56B4E9", "#CC79A7", "#5b6475", "#9a7229"] as const;

export const STAGE_COLOR: Record<StageId, string> = {
  A: CATEGORICAL[0],
  B: CATEGORICAL[1],
  C: CATEGORICAL[2],
  D: CATEGORICAL[3],
  E: CATEGORICAL[4],
  F: CATEGORICAL[5],
};

/** Sequential single-hue ramp (brand blue) for heatmaps, light → dark. */
export const SEQUENTIAL = ["#eef4fa", "#cfe0ef", "#a3c4e0", "#6fa1cb", "#3b7db3", "#1c6aa2", "#11497a"] as const;

export function sequentialColor(t: number): string {
  const idx = Math.min(SEQUENTIAL.length - 1, Math.max(0, Math.floor(t * (SEQUENTIAL.length - 1) + 0.0001)));
  return SEQUENTIAL[idx]!;
}

export const CHROME = {
  grid: "#e3dccb",
  axis: "#cfc6ae",
  muted: "#6a7ab6",
  text: "#0b1660",
  surface: "#ffffff",
  positive: "#1f8a8a",
  negative: "#b42318",
};
