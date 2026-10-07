import type { Basis, Dimension, InputCategory, Production } from "@/lib/domain/types";

/** Canonical units (PRD 2.1.3 step 3): kg, L, kWh, pcs. */
export const CANONICAL: Record<Dimension, string> = {
  mass: "kg",
  volume: "L",
  energy: "kWh",
  air: "Nm3",
  count: "pcs",
};

const UNITS: Record<string, { dim: Dimension; factor: number }> = {
  mg: { dim: "mass", factor: 1e-6 },
  g: { dim: "mass", factor: 1e-3 },
  kg: { dim: "mass", factor: 1 },
  t: { dim: "mass", factor: 1000 },
  ton: { dim: "mass", factor: 1000 },
  ml: { dim: "volume", factor: 1e-3 },
  l: { dim: "volume", factor: 1 },
  m3: { dim: "volume", factor: 1000 },
  "m³": { dim: "volume", factor: 1000 },
  wh: { dim: "energy", factor: 1e-3 },
  kwh: { dim: "energy", factor: 1 },
  mwh: { dim: "energy", factor: 1000 },
  mj: { dim: "energy", factor: 1 / 3.6 },
  gj: { dim: "energy", factor: 1000 / 3.6 },
  nm3: { dim: "air", factor: 1 },
  "nm³": { dim: "air", factor: 1 },
  pcs: { dim: "count", factor: 1 },
};

/** Units offered per category so free-text units cannot creep in. */
export const UNIT_OPTIONS: Record<InputCategory, string[]> = {
  Chemical: ["kg", "g", "ton"],
  Anode: ["kg", "g"],
  Water: ["L", "m3"],
  Energy: ["kWh", "MWh", "Wh", "MJ", "Nm3"],
  WWTPChemical: ["kg", "g", "ton"],
  Consumable: ["kg", "g"],
};

export const CATEGORY_DIMENSION: Record<InputCategory, Dimension> = {
  Chemical: "mass",
  Anode: "mass",
  Water: "volume",
  Energy: "energy",
  WWTPChemical: "mass",
  Consumable: "mass",
};

export function parseUnit(unit: string): { dim: Dimension; factor: number } | null {
  const head = (unit.split("/")[0] ?? "").trim().toLowerCase().replace(/\s+/g, "");
  return UNITS[head] ?? null;
}

export type ConversionResult =
  | { ok: true; value: number; unit: string; note?: string }
  | { ok: false; error: string };

/**
 * Convert a quantity to the canonical unit of a category. Compressed air in
 * Nm³ becomes kWh only through the compressor factor the user entered (FR-03.3).
 */
export function toCanonical(
  quantity: number,
  unit: string,
  category: InputCategory,
  production: Pick<Production, "compressorKwhPerNm3">,
): ConversionResult {
  const parsed = parseUnit(unit);
  const expected = CATEGORY_DIMENSION[category];
  if (!parsed) return { ok: false, error: `Satuan "${unit}" tidak dikenal` };
  if (parsed.dim === "air" && expected === "energy") {
    const f = production.compressorKwhPerNm3;
    if (!f || f <= 0) {
      return { ok: false, error: "Nm³ udara tekan butuh faktor kWh/Nm³ kompresor (isi di tab Produksi)" };
    }
    return { ok: true, value: quantity * f, unit: "kWh", note: `${f} kWh/Nm³` };
  }
  if (parsed.dim !== expected) {
    return { ok: false, error: `Satuan "${unit}" tidak cocok untuk kategori ${category} (butuh ${CANONICAL[expected]})` };
  }
  return { ok: true, value: quantity * parsed.factor, unit: CANONICAL[expected] };
}

/** Multiplier from an entry's basis to the reporting period (FR-03.4). */
export function basisFactor(basis: Basis, periodMonths: number, batches: number): number {
  if (basis === "month") return periodMonths > 0 ? periodMonths : 1;
  if (basis === "batch") return batches > 0 ? batches : 0;
  return 1;
}

export const BASIS_LABEL: Record<Basis, string> = {
  period: "per periode",
  month: "per bulan",
  batch: "per batch",
};

/** Effluent concentration unit → kg of substance per m³ effluent. */
export const CONCENTRATION_KG_PER_M3: Record<string, number> = {
  "mg/l": 1e-3,
  "µg/l": 1e-6,
  "ug/l": 1e-6,
  "g/l": 1,
  "kg/m3": 1,
  "g/m3": 1e-3,
};

export function concentrationFactor(unit: string): number | null {
  const f = CONCENTRATION_KG_PER_M3[unit.trim().toLowerCase()];
  return f === undefined ? null : f;
}
