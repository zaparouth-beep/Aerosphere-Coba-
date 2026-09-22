/** Fixed categorical order from the design system's validated default palette.
 * Never reassigned per filter/interaction — index is stable per entity. */
export const CATEGORICAL_PALETTE = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

export const CHART_CHROME = {
  gridline: "#e1e0d9",
  axis: "#c3c2b7",
  mutedText: "#898781",
  primaryText: "#0b0b0b",
  secondaryText: "#52514e",
  surface: "#fcfcfb",
};

export const STAGE_COLORS: Record<string, string> = {
  pretreatment: CATEGORICAL_PALETTE[0],
  strike: CATEGORICAL_PALETTE[1],
  main_plating: CATEGORICAL_PALETTE[2],
  post_treatment: CATEGORICAL_PALETTE[3],
  utility: CATEGORICAL_PALETTE[4],
  wwtp: CATEGORICAL_PALETTE[5],
};

export const METRIC_COLORS = {
  energy: CATEGORICAL_PALETTE[0],
  water: CATEGORICAL_PALETTE[1],
  chemical: CATEGORICAL_PALETTE[2],
  waste: CATEGORICAL_PALETTE[7], // red — hazardous waste
};
