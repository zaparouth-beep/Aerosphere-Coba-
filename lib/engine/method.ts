import type { BackgroundDataset, ImpactId, ImpactVector, MethodPackage } from "@/lib/domain/types";

export interface ImpactCategory {
  id: ImpactId;
  label: string;
  short: string;
  /** Legacy label shown as an alias only (FR-06.3). */
  legacy?: string;
  unit: string;
}

/** EF 3.1 core categories for the MVP (FR-06.2), units per EF 3.1. */
export const IMPACT_CATEGORIES: ImpactCategory[] = [
  { id: "cc", label: "Climate change", short: "Climate change", legacy: "GWP", unit: "kg CO₂-eq" },
  { id: "ac", label: "Acidification", short: "Acidification", legacy: "AP", unit: "mol H⁺-eq" },
  { id: "euf", label: "Eutrophication, freshwater", short: "Eutroph. freshwater", legacy: "EP", unit: "kg P-eq" },
  { id: "pof", label: "Photochemical ozone formation", short: "Ozone formation", legacy: "POCP", unit: "kg NMVOC-eq" },
  { id: "pm", label: "Particulate matter", short: "Particulate matter", unit: "disease inc." },
  { id: "rum", label: "Resource use, minerals & metals", short: "Resource minerals", legacy: "ADP elements", unit: "kg Sb-eq" },
  { id: "ruf", label: "Resource use, fossils", short: "Resource fossils", legacy: "ADP fossil", unit: "MJ" },
  { id: "htc", label: "Human toxicity, cancer", short: "Human tox. cancer", unit: "CTUh" },
  { id: "htnc", label: "Human toxicity, non-cancer", short: "Human tox. non-cancer", unit: "CTUh" },
  { id: "etf", label: "Ecotoxicity, freshwater", short: "Ecotox. freshwater", unit: "CTUe" },
  { id: "wu", label: "Water use", short: "Water use", unit: "m³ world-eq" },
];

export const IMPACT_IDS: ImpactId[] = IMPACT_CATEGORIES.map((c) => c.id);

export const CATEGORY_BY_ID = new Map(IMPACT_CATEGORIES.map((c) => [c.id, c]));

export function zeroVector(): ImpactVector {
  return { cc: 0, ac: 0, euf: 0, pof: 0, pm: 0, rum: 0, ruf: 0, htc: 0, htnc: 0, etf: 0, wu: 0 };
}

/**
 * Built-in characterisation factors for direct emissions. Only values whose
 * source is stated are included; every other flow/category needs factors
 * imported from the openLCA LCIA Method Package (P3: no invented numbers).
 */
export function defaultMethodPackage(): MethodPackage {
  return {
    release: "EF 3.1 — subset bawaan v1",
    primary: "EF 3.1",
    secondary: "ReCiPe 2016 Midpoint (H)",
    flows: [
      { key: "co2", label: "Carbon dioxide, fossil", compartment: "air", factors: { cc: 1 }, source: "IPCC AR6 GWP100" },
      { key: "ch4", label: "Methane, fossil", compartment: "air", factors: { cc: 29.8 }, source: "IPCC AR6 GWP100" },
      { key: "n2o", label: "Dinitrogen monoxide", compartment: "air", factors: { cc: 273 }, source: "IPCC AR6 GWP100" },
      { key: "so2", label: "Sulfur dioxide", compartment: "air", factors: { ac: 1.31 }, source: "EF 3.1 (accumulated exceedance) — verifikasi" },
      { key: "nox", label: "Nitrogen oxides", compartment: "air", factors: { ac: 0.74 }, source: "EF 3.1 (accumulated exceedance) — verifikasi" },
      { key: "nh3", label: "Ammonia", compartment: "air", factors: { ac: 3.02 }, source: "EF 3.1 (accumulated exceedance) — verifikasi" },
      { key: "p", label: "Phosphorus", compartment: "water", factors: { euf: 1 }, source: "EF 3.1 (EUTREND)" },
      { key: "po4", label: "Phosphate", compartment: "water", factors: { euf: 0.33 }, source: "EF 3.1 (fraksi P 30,97/94,97)" },
      { key: "crvi_air", label: "Chromium VI (udara)", compartment: "air", factors: {}, source: "Butuh CF USEtox dari method package" },
      { key: "acid_mist", label: "Acid mist (HCl/H₂SO₄)", compartment: "air", factors: {}, source: "Butuh CF dari method package" },
      { key: "ni_water", label: "Nickel, ion (air)", compartment: "water", factors: {}, source: "Butuh CF USEtox dari method package" },
      { key: "crvi_water", label: "Chromium VI (air)", compartment: "water", factors: {}, source: "Butuh CF USEtox dari method package" },
      { key: "cr_water", label: "Chromium III/total (air)", compartment: "water", factors: {}, source: "Butuh CF USEtox dari method package" },
      { key: "cd_water", label: "Cadmium, ion (air)", compartment: "water", factors: {}, source: "Butuh CF USEtox dari method package" },
      { key: "zn_water", label: "Zinc, ion (air)", compartment: "water", factors: {}, source: "Butuh CF USEtox dari method package" },
      { key: "cu_water", label: "Copper, ion (air)", compartment: "water", factors: {}, source: "Butuh CF USEtox dari method package" },
    ],
  };
}

/** Name-based matching so common parameters link to a flow without extra input. */
const AUTO_MATCH: Array<{ test: RegExp; key: string; compartment: "air" | "water" }> = [
  { test: /^(co2|carbon dioxide)/i, key: "co2", compartment: "air" },
  { test: /^(ch4|methane)/i, key: "ch4", compartment: "air" },
  { test: /^(n2o)/i, key: "n2o", compartment: "air" },
  { test: /^(so2|sulfur dioxide)/i, key: "so2", compartment: "air" },
  { test: /^(nox|nitrogen oxide)/i, key: "nox", compartment: "air" },
  { test: /^(nh3|ammonia)/i, key: "nh3", compartment: "air" },
  { test: /cr\s*\(?vi\)?\s*mist/i, key: "crvi_air", compartment: "air" },
  { test: /acid mist/i, key: "acid_mist", compartment: "air" },
  { test: /^ni$|^nickel/i, key: "ni_water", compartment: "water" },
  { test: /^cr\s*\(?vi\)?$/i, key: "crvi_water", compartment: "water" },
  { test: /^cr total$/i, key: "cr_water", compartment: "water" },
  { test: /^cd$|^cadmium/i, key: "cd_water", compartment: "water" },
  { test: /^zn$|^zinc/i, key: "zn_water", compartment: "water" },
  { test: /^cu$|^copper/i, key: "cu_water", compartment: "water" },
  { test: /^(p total|total p|phosphorus)/i, key: "p", compartment: "water" },
  { test: /phosphate|fosfat/i, key: "po4", compartment: "water" },
];

export function resolveFlowKey(parameter: string, flowKey: string | undefined, compartment: "air" | "water"): string | null {
  if (flowKey === "none") return null;
  if (flowKey) return flowKey;
  const hit = AUTO_MATCH.find((m) => m.compartment === compartment && m.test.test(parameter.trim()));
  return hit?.key ?? null;
}

/** Background datasets shipped with the MVP. Only sourced values are filled. */
export function defaultBackgrounds(): BackgroundDataset[] {
  return [
    {
      id: "bg-grid-jamali",
      name: "Listrik grid JAMALI (Jawa-Madura-Bali)",
      provider: "GEC/JCM (faktor grid Indonesia)",
      version: "0.613 tCO₂/MWh",
      geography: "ID-JAMALI",
      refUnit: "kWh",
      factors: { cc: 0.613 },
      licenseScope: "Publik",
      importedAt: "2026-10-07",
    },
  ];
}

export const GRID_SENSITIVITY_RANGE = { low: 0.61, high: 0.87 } as const;
