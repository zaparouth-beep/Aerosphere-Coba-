import type {
  AirEmissionEntry,
  CostConfig,
  HazardousWasteEntry,
  LCICategory,
  LCIInputEntry,
  Project,
  ProcessStage,
  ProcessStageId,
  WaterEffluentEntry,
  WhatIfLever,
} from "./types";

export const PROCESS_STAGES: ProcessStage[] = [
  {
    id: "pretreatment",
    code: "A",
    name: "Pre-treatment",
    functionDesc: "Bersihkan & siapkan permukaan (degreasing, rinsing, pickling)",
  },
  {
    id: "strike",
    code: "B",
    name: "Aktivasi / Strike",
    functionDesc: "Lapisan pengikat awal (strike coat Ni/Cu)",
  },
  {
    id: "main_plating",
    code: "C",
    name: "Plating Utama",
    functionDesc: "Elektrolisis utama — hard chrome, Cd, EN, anodize",
  },
  {
    id: "post_treatment",
    code: "D",
    name: "Pasca-treatment",
    functionDesc: "Konversi kimia & seal (chromate, sealing, HE-bake)",
  },
  {
    id: "utility",
    code: "E",
    name: "Utilitas Lini",
    functionDesc: "Listrik, panas, ventilasi (rectifier, heater, chiller)",
  },
  {
    id: "wwtp",
    code: "F",
    name: "IPAL Lini (WWTP)",
    functionDesc: "Olah limbah B3 (reduksi Cr(VI), netralisasi)",
  },
];

export const STAGE_BY_ID = new Map(PROCESS_STAGES.map((s) => [s.id, s]));

/** Catalog definition for the 30 candidate LCI input parameters (fixed reference,
 * independent from any one project's entered quantities). */
export interface LCIParamDef {
  no: number;
  category: LCICategory;
  name: string;
  unit: string;
  tahap: string;
  defaultStageId: ProcessStageId;
}

export const LCI_INPUT_CATALOG: LCIParamDef[] = [
  { no: 1, category: "Chemical", name: "Degreaser alkali", unit: "kg/period", tahap: "Pre-treatment", defaultStageId: "pretreatment" },
  { no: 2, category: "Chemical", name: "H2SO4", unit: "kg/period", tahap: "Pickling", defaultStageId: "pretreatment" },
  { no: 3, category: "Chemical", name: "HCl", unit: "kg/period", tahap: "Pickling", defaultStageId: "pretreatment" },
  { no: 4, category: "Chemical", name: "Ni/Cu strike chemical", unit: "kg/period", tahap: "Strike", defaultStageId: "strike" },
  { no: 5, category: "Chemical", name: "CrO3 / chromic acid", unit: "kg/period", tahap: "Hard chrome", defaultStageId: "main_plating" },
  { no: 6, category: "Chemical", name: "Nickel salt", unit: "kg/period", tahap: "Ni/EN", defaultStageId: "main_plating" },
  { no: 7, category: "Chemical", name: "Cadmium chemical", unit: "kg/period", tahap: "Cd plating", defaultStageId: "main_plating" },
  { no: 8, category: "Chemical", name: "Sodium hypophosphite", unit: "kg/period", tahap: "EN", defaultStageId: "main_plating" },
  { no: 9, category: "Chemical", name: "Anodizing electrolyte", unit: "kg/period", tahap: "Anodizing", defaultStageId: "main_plating" },
  { no: 10, category: "Chemical", name: "Brightener/additive", unit: "kg/period", tahap: "Plating", defaultStageId: "main_plating" },
  { no: 11, category: "Chemical", name: "Chromate/passivation", unit: "kg/period", tahap: "Post-treatment", defaultStageId: "post_treatment" },
  { no: 12, category: "Anode", name: "Ni/Cd/Pb/Zn anode", unit: "kg/period", tahap: "Main plating", defaultStageId: "main_plating" },
  { no: 13, category: "Water", name: "Process/rinse water", unit: "L/period", tahap: "Rinsing", defaultStageId: "pretreatment" },
  { no: 14, category: "Water", name: "DI/RO water", unit: "L/period", tahap: "Rinsing/sealing", defaultStageId: "post_treatment" },
  { no: 15, category: "Energy", name: "Rectifier electricity", unit: "kWh/period", tahap: "Plating", defaultStageId: "main_plating" },
  { no: 16, category: "Energy", name: "Bath heater", unit: "kWh/period", tahap: "Plating", defaultStageId: "main_plating" },
  { no: 17, category: "Energy", name: "Chiller", unit: "kWh/period", tahap: "Anodizing", defaultStageId: "main_plating" },
  { no: 18, category: "Energy", name: "HE-relief oven", unit: "kWh/period", tahap: "Post-treatment", defaultStageId: "post_treatment" },
  { no: 19, category: "Energy", name: "Ventilation/scrubber", unit: "kWh/period", tahap: "Utility", defaultStageId: "utility" },
  { no: 20, category: "Energy", name: "Pump/agitator", unit: "kWh/period", tahap: "Utility", defaultStageId: "utility" },
  { no: 21, category: "Energy", name: "Compressed air", unit: "kWh or Nm3/period", tahap: "Utility", defaultStageId: "utility" },
  { no: 22, category: "Energy", name: "DI/RO", unit: "kWh/period", tahap: "Utility", defaultStageId: "utility" },
  { no: 23, category: "Energy", name: "WWTP", unit: "kWh/period", tahap: "WWTP", defaultStageId: "wwtp" },
  { no: 24, category: "WWTPChemical", name: "Cr(VI) reducing agent", unit: "kg/period", tahap: "WWTP", defaultStageId: "wwtp" },
  { no: 25, category: "WWTPChemical", name: "NaOCl/oxidant", unit: "kg/period", tahap: "WWTP", defaultStageId: "wwtp" },
  { no: 26, category: "WWTPChemical", name: "NaOH/lime", unit: "kg/period", tahap: "WWTP", defaultStageId: "wwtp" },
  { no: 27, category: "WWTPChemical", name: "Coagulant/flocculant", unit: "kg/period", tahap: "WWTP", defaultStageId: "wwtp" },
  { no: 28, category: "Consumable", name: "Masking material", unit: "kg/period", tahap: "Masking", defaultStageId: "pretreatment" },
  { no: 29, category: "Consumable", name: "Filter/cartridge", unit: "kg or pcs/period", tahap: "Filtration", defaultStageId: "utility" },
  { no: 30, category: "Consumable", name: "Other process consumables", unit: "kg/period", tahap: "As applicable", defaultStageId: "utility" },
];

export const AIR_EMISSION_CATALOG: Array<Pick<AirEmissionEntry, "parameter" | "relevance">> = [
  { parameter: "Cr(VI) mist", relevance: "Sangat penting untuk hard chrome" },
  { parameter: "Acid mist H2SO4/HCl", relevance: "Pickling/plating" },
  { parameter: "H2", relevance: "Electrolysis" },
  { parameter: "Cyanide compound", relevance: "Hanya jika bath cyanide digunakan" },
  { parameter: "VOC", relevance: "Jika solvent cleaning digunakan" },
];

export const WATER_EFFLUENT_CATALOG: Array<Pick<WaterEffluentEntry, "parameter" | "unit">> = [
  { parameter: "Effluent volume", unit: "m3" },
  { parameter: "pH", unit: "-" },
  { parameter: "TSS", unit: "mg/L" },
  { parameter: "COD", unit: "mg/L" },
  { parameter: "Cr total", unit: "mg/L" },
  { parameter: "Cr(VI)", unit: "mg/L" },
  { parameter: "Cd", unit: "mg/L" },
  { parameter: "Ni", unit: "mg/L" },
  { parameter: "Zn", unit: "mg/L" },
  { parameter: "Cu", unit: "mg/L" },
  { parameter: "Cyanide", unit: "mg/L" },
];

export const DEFAULT_WHATIF_LEVERS: WhatIfLever[] = [
  {
    id: "reduce-rinse-water",
    label: "Kurangi rinse water",
    description:
      "Optimasi cascade rinsing / counterflow untuk mengurangi konsumsi air bilas dan beban WWTP.",
    reductionPct: 0.2,
    affects: { rinseWaterPct: 1 },
  },
  {
    id: "optimize-rectifier",
    label: "Optimasi operasi rectifier",
    description:
      "Tuning arus/waktu plating dan jadwal produksi untuk menurunkan konsumsi energi rectifier & heater.",
    reductionPct: 0.15,
    affects: { rectifierEnergyPct: 1 },
  },
  {
    id: "reduce-dragout",
    label: "Kurangi drag-out",
    description:
      "Perbaikan waktu tiris (drain time), drag-out tank, atau tegangan permukaan bath untuk mengurangi kehilangan bahan kimia yang terbawa ke rinse.",
    reductionPct: 0.25,
    affects: { dragOutChemicalPct: 1 },
  },
];

export const DEFAULT_COST_CONFIG: CostConfig = {
  energyPriceRpPerKwh: 1500,
  waterPriceRpPerL: 15,
  chemicalPriceRpPerKg: 45000,
  wwtpChemicalPriceRpPerKg: 20000,
  consumablePriceRpPerKg: 30000,
  laborCostRpPerPeriod: 25000000,
  wasteDisposalPriceRpPerKg: 8000,
  wasteTransportPriceRpPerKm: 12000,
  periodMonths: 1,
};

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** quantity seed values keyed by catalog "no", chosen so aggregated-by-stage totals
 * demonstrate the hotspots called out in the deck: main plating = energy & chemical
 * hotspot, WWTP = hazardous-waste hotspot, pre-treatment = water hotspot. */
const SEED_QUANTITY: Record<number, number> = {
  1: 30, // Degreaser alkali
  2: 25, // H2SO4
  3: 15, // HCl
  4: 60, // Ni/Cu strike chemical
  5: 40, // CrO3
  6: 25, // Nickel salt
  7: 20, // Cadmium chemical
  8: 15, // Sodium hypophosphite
  9: 20, // Anodizing electrolyte
  10: 10, // Brightener/additive
  11: 90, // Chromate/passivation
  12: 20, // Anode
  13: 3500, // Process/rinse water
  14: 3000, // DI/RO water
  15: 300, // Rectifier electricity
  16: 150, // Bath heater
  17: 100, // Chiller
  18: 150, // HE-relief oven
  19: 80, // Ventilation/scrubber
  20: 40, // Pump/agitator
  21: 25, // Compressed air
  22: 40, // DI/RO
  23: 80, // WWTP energy
  24: 35, // Cr(VI) reducing agent
  25: 30, // NaOCl/oxidant
  26: 35, // NaOH/lime
  27: 25, // Coagulant/flocculant
  28: 5, // Masking material
  29: 1, // Filter/cartridge
  30: 1, // Other consumables
};

function seedLCIInputs(): LCIInputEntry[] {
  return LCI_INPUT_CATALOG.map((def) => ({
    id: nextId("lci"),
    no: def.no,
    category: def.category,
    name: def.name,
    unit: def.unit,
    stageId: def.defaultStageId,
    quantity: SEED_QUANTITY[def.no] ?? 0,
    source: "Purchasing record",
    dataType: "Measured" as const,
    measurementMethod: "Flowmeter / invoice / weighing",
    uncertaintyPct: 5,
    period: "Jan-Des 2026",
    confidence: "Medium" as const,
  }));
}

function seedAirEmissions(): AirEmissionEntry[] {
  const values: Record<string, { applicable: boolean; value: number }> = {
    "Cr(VI) mist": { applicable: true, value: 0.15 },
    "Acid mist H2SO4/HCl": { applicable: true, value: 0.8 },
    H2: { applicable: true, value: 12 },
    "Cyanide compound": { applicable: false, value: 0 },
    VOC: { applicable: true, value: 0.5 },
  };
  return AIR_EMISSION_CATALOG.map((def) => ({
    id: nextId("air"),
    parameter: def.parameter,
    relevance: def.relevance,
    applicable: values[def.parameter]?.applicable ?? true,
    valueKgPerPeriod: values[def.parameter]?.value ?? 0,
  }));
}

function seedWaterEffluent(): WaterEffluentEntry[] {
  const values: Record<string, number> = {
    "Effluent volume": 100,
    pH: 7.2,
    TSS: 25,
    COD: 40,
    "Cr total": 0.8,
    "Cr(VI)": 0.5,
    Cd: 0.02,
    Ni: 0.3,
    Zn: 0.15,
    Cu: 0.1,
    Cyanide: 0,
  };
  return WATER_EFFLUENT_CATALOG.map((def) => ({
    id: nextId("weff"),
    parameter: def.parameter,
    unit: def.unit,
    value: values[def.parameter] ?? 0,
  }));
}

function seedHazardousWaste(): HazardousWasteEntry[] {
  const rows: Array<[string, ProcessStageId, number]> = [
    ["Sludge bilas pre-treatment", "pretreatment", 20],
    ["Residu bath strike", "strike", 16],
    ["Sludge anode / spent bath plating", "main_plating", 30],
    ["Sludge chromate post-treatment", "post_treatment", 24],
    ["Filter/cartridge bekas", "utility", 10],
    ["Metal hydroxide sludge (WWTP)", "wwtp", 100],
  ];
  return rows.map(([wasteType, sourceStageId, quantityKgMonth]) => ({
    id: nextId("waste"),
    wasteType,
    sourceStageId,
    quantityKgMonth,
    hazardClass: "B3",
    moisturePct: 60,
    metalContentPct: 15,
    treatment: "Stabilization/dewatering",
    disposal: "Licensed treatment",
    destination: "Vendor pengolah limbah B3 bersertifikat",
    transportKm: 35,
    recovery: false,
  }));
}

export function createSeedProject(): Project {
  return {
    id: nextId("project"),
    name: "AeroSphere LCA — Proses Plating",
    facility: "Aerospace Bandung Facility",
    client: "Internal / Demo",
    period: "Januari - Desember 2026",
    part: {
      partName: "Fitting bracket, 5-axis machined",
      material: "Ti-6Al-4V",
      initialStockMassKg: 200,
      finishedMassKg: 80,
      annualVolumeParts: 120,
    },
    functionalUnit: {
      type: "m2_plated",
      value: 250,
    },
    lciInputs: seedLCIInputs(),
    airEmissions: seedAirEmissions(),
    waterEffluent: seedWaterEffluent(),
    hazardousWaste: seedHazardousWaste(),
    costConfig: { ...DEFAULT_COST_CONFIG },
    whatIfLevers: DEFAULT_WHATIF_LEVERS.map((l) => ({ ...l })),
  };
}

export function generateId(prefix: string): string {
  return nextId(prefix);
}
