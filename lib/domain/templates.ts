import { defaultBackgrounds, defaultMethodPackage } from "@/lib/engine/method";
import { defaultPedigree } from "@/lib/engine/quality";
import type {
  AirEmission,
  Basis,
  DataMeta,
  EffluentParam,
  HazardousWaste,
  InputCategory,
  InputFlow,
  PriceBook,
  Project,
  Scenario,
  SourceType,
  Stage,
  StageId,
} from "./types";

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function meta(sourceType: SourceType, source = "", method = "", uncertaintyPct = 10, note?: string): DataMeta {
  return { sourceType, source, method, uncertaintyPct, pedigree: defaultPedigree(sourceType), note };
}

export const DEFAULT_STAGES: Stage[] = [
  { id: "A", name: "Pre-treatment", functionDesc: "Bersihkan & siapkan permukaan", subprocesses: ["Degreasing", "Rinsing", "Pickling"], inBoundary: true },
  { id: "B", name: "Aktivasi / Strike", functionDesc: "Lapisan pengikat awal", subprocesses: ["Strike coat Ni/Cu"], inBoundary: true },
  { id: "C", name: "Plating Utama", functionDesc: "Elektrolisis utama", subprocesses: ["Hard chrome", "Cd", "Electroless Ni", "Anodize"], inBoundary: true },
  { id: "D", name: "Pasca-treatment", functionDesc: "Konversi kimia & seal", subprocesses: ["Chromate", "Sealing", "HE-bake"], inBoundary: true },
  { id: "E", name: "Utilitas Lini", functionDesc: "Listrik, panas, ventilasi", subprocesses: ["Rectifier", "Heater", "Chiller"], inBoundary: true },
  { id: "F", name: "IPAL Lini", functionDesc: "Olah air limbah & limbah B3", subprocesses: ["Reduksi Cr(VI)", "Netralisasi"], inBoundary: true },
];

/** The 30 candidate LCI inputs from the deck ("Candidate LCI Input"). */
const CATALOG: Array<[InputCategory, string, string, StageId]> = [
  ["Chemical", "Degreaser alkali", "kg", "A"],
  ["Chemical", "H₂SO₄", "kg", "A"],
  ["Chemical", "HCl", "kg", "A"],
  ["Chemical", "Ni/Cu strike chemical", "kg", "B"],
  ["Chemical", "CrO₃ / chromic acid", "kg", "C"],
  ["Chemical", "Nickel salt", "kg", "C"],
  ["Chemical", "Cadmium chemical", "kg", "C"],
  ["Chemical", "Sodium hypophosphite", "kg", "C"],
  ["Chemical", "Anodizing electrolyte", "kg", "C"],
  ["Chemical", "Brightener/additive", "kg", "C"],
  ["Chemical", "Chromate/passivation", "kg", "D"],
  ["Anode", "Ni/Cd/Pb/Zn anode", "kg", "C"],
  ["Water", "Process/rinse water", "L", "A"],
  ["Water", "DI/RO water", "L", "D"],
  ["Energy", "Rectifier electricity", "kWh", "C"],
  ["Energy", "Bath heater", "kWh", "C"],
  ["Energy", "Chiller", "kWh", "C"],
  ["Energy", "HE-relief oven", "kWh", "D"],
  ["Energy", "Ventilation/scrubber", "kWh", "E"],
  ["Energy", "Pump/agitator", "kWh", "E"],
  ["Energy", "Compressed air", "kWh", "E"],
  ["Energy", "DI/RO", "kWh", "E"],
  ["Energy", "WWTP", "kWh", "F"],
  ["WWTPChemical", "Cr(VI) reducing agent", "kg", "F"],
  ["WWTPChemical", "NaOCl/oxidant", "kg", "F"],
  ["WWTPChemical", "NaOH/lime", "kg", "F"],
  ["WWTPChemical", "Coagulant/flocculant", "kg", "F"],
  ["Consumable", "Masking material", "kg", "A"],
  ["Consumable", "Filter/cartridge", "kg", "E"],
  ["Consumable", "Other process consumables", "kg", "E"],
];

function input(
  no: number,
  category: InputCategory,
  name: string,
  unit: string,
  stageId: StageId,
  quantity: number,
  m: DataMeta,
  gridMapped = false,
  basis: Basis = "period",
): InputFlow {
  return {
    id: newId("in"),
    no,
    category,
    name,
    stageId,
    quantity,
    unit,
    basis,
    meta: m,
    mapping: gridMapped
      ? { status: "proxy", datasetId: "bg-grid-jamali", rationale: "Listrik dibeli dari grid JAMALI; faktor hanya climate change." }
      : { status: "unmapped" },
  };
}

function catalogInputs(quantities: Record<number, number>, m: (no: number) => DataMeta): InputFlow[] {
  return CATALOG.map(([cat, name, unit, stage], idx) => input(idx + 1, cat, name, unit, stage, quantities[idx + 1] ?? 0, m(idx + 1), cat === "Energy"));
}

const AIR_CATALOG: Array<[string, string, StageId]> = [
  ["Cr(VI) mist", "Sangat penting untuk hard chrome", "C"],
  ["Acid mist H₂SO₄/HCl", "Pickling/plating", "A"],
  ["H₂", "Elektrolisis", "C"],
  ["Cyanide compound", "Hanya jika bath sianida digunakan", "C"],
  ["VOC", "Jika solvent cleaning digunakan", "A"],
];

function airEmissions(values: Record<string, number | null>, m: DataMeta): AirEmission[] {
  return AIR_CATALOG.map(([parameter, relevance, stageId]) => ({
    id: newId("air"),
    parameter,
    relevance,
    stageId,
    applicable: values[parameter] !== null && values[parameter] !== undefined,
    quantityKg: values[parameter] ?? 0,
    basis: "period" as Basis,
    meta: { ...m },
  }));
}

const EFFLUENT_CATALOG: Array<[string, string]> = [
  ["pH", "-"],
  ["TSS", "mg/L"],
  ["COD", "mg/L"],
  ["Cr total", "mg/L"],
  ["Cr(VI)", "mg/L"],
  ["Cd", "mg/L"],
  ["Ni", "mg/L"],
  ["Zn", "mg/L"],
  ["Cu", "mg/L"],
  ["Cyanide", "mg/L"],
];

function effluent(values: Record<string, number>): EffluentParam[] {
  return EFFLUENT_CATALOG.map(([parameter, unit]) => ({ id: newId("eff"), parameter, unit, value: values[parameter] ?? 0 }));
}

function waste(
  wasteType: string,
  stageId: StageId,
  quantityKg: number,
  m: DataMeta,
  extra: Partial<HazardousWaste> = {},
): HazardousWaste {
  return {
    id: newId("waste"),
    wasteType,
    stageId,
    quantityKg,
    basis: "period",
    moisturePct: 60,
    metalContentPct: 15,
    treatment: "Stabilization/dewatering",
    destination: "Vendor pengolah limbah B3 berizin",
    transportKm: 35,
    recovery: false,
    meta: m,
    mapping: { status: "unmapped" },
    ...extra,
  };
}

function emptyPrices(): PriceBook {
  return {
    validFrom: "2026-01-01",
    isDemo: false,
    energyRpPerKwh: 0,
    waterRpPerL: 0,
    chemicalRpPerKg: 0,
    wwtpChemicalRpPerKg: 0,
    consumableRpPerKg: 0,
    wasteTreatmentRpPerKg: 0,
    wasteTransportRpPerKm: 0,
    wasteTripsPerPeriod: 0,
    laborRpPerPeriod: 0,
    depreciationRpPerPeriod: 0,
    carbonPriceRpPerKgCO2e: 0,
  };
}

export function presetScenarios(): Scenario[] {
  const base = { capexRp: 0, extraOpexRpPerPeriod: 0, lifetimeYears: 5, status: "draft" as const };
  return [
    { id: "S1", code: "S1", name: "Kurangi larutan terbawa part 20%", description: "Waktu tiris lebih lama dan tangki penampung sehingga larutan yang ikut terangkat part berkurang 20%.", levers: { dragout: { reductionPct: 20 } }, effort: "rendah", timeline: "1–3 bulan", ...base },
    { id: "S2", code: "S2", name: "Pasang bilasan bertingkat", description: "Air bilas dipakai ulang dari tangki bersih ke tangki kotor, dari 2 menjadi 3 tingkat.", levers: { countercurrent: { stagesOld: 2, stagesNew: 3, ratio: 1000 } }, effort: "sedang", timeline: "3–6 bulan", ...base },
    { id: "S3", code: "S3", name: "Perbaiki penyearah arus", description: "Ganti penyearah arus ke tipe switch-mode, efisiensi 75% menjadi 88%.", levers: { rectifier: { etaOld: 75, etaNew: 88 } }, effort: "sedang", timeline: "3–6 bulan", ...base },
  ];
}

function baseProject(overrides: Partial<Project> & Pick<Project, "name" | "template">): Project {
  const scope = {
    version: 1,
    goal: "Mengkuantifikasi dampak lingkungan dan kerugian material/biaya proses plating untuk menemukan hotspot dan menguji skenario perbaikan.",
    intendedAudience: "Engineering, EHS, manajemen fasilitas (internal; bukan klaim komparatif publik)",
    fuType: "m2" as const,
    boundary: "gate-to-gate+upstream" as const,
    cutoffPct: 1,
    allocation: "m2" as const,
    backgroundDb: "USLCI / LCA Commons + faktor grid Indonesia",
    assumptions: [
      "Transport limbah B3 ke vendor berada di luar boundary LCA (cut-off), tetapi biayanya tetap dihitung di MFCA.",
      "Utilitas bersama dialokasikan per m² kecuali dinyatakan lain.",
    ],
  };
  return {
    schemaVersion: 2,
    id: newId("proj"),
    facility: "Aerospace Bandung Facility",
    client: "Internal",
    periodLabel: "Jan–Des 2026",
    periodMonths: 12,
    partName: "Actuator piston rod",
    substrate: "Baja paduan 4340",
    coatingType: "Hard chrome",
    scope,
    scopeHistory: [],
    stages: structuredClone(DEFAULT_STAGES),
    inputs: catalogInputs({}, () => meta("measured")),
    airEmissions: airEmissions({}, meta("measured")),
    effluent: effluent({}),
    waste: [],
    production: {
      areaM2: 0,
      parts: 0,
      componentMassKg: 0,
      batches: 0,
      reworkPct: 0,
      coatingMetal: "Cr",
      coatingThicknessUm: 0,
      coatingDensityKgM3: 7190,
      effluentVolumeM3: 0,
      waterEvaporatedM3: 0,
    },
    prices: emptyPrices(),
    backgrounds: defaultBackgrounds(),
    method: defaultMethodPackage(),
    scenarios: presetScenarios(),
    targets: { baselineLabel: "2026", gwpReductionPct: 30, wasteReductionPct: 20, waterReductionPct: 15, targetYear: 2030, discountRatePct: 10 },
    stageEase: { A: 4, B: 3, C: 3, D: 3, E: 4, F: 3 },
    stageComplianceRisk: { A: 2, B: 2, C: 5, D: 4, E: 1, F: 4 },
    laborHoursByStage: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 },
    dataset: { version: 1, status: "draft", acceptedWarnings: {} },
    ...overrides,
  };
}

/** Demo dataset (deck, PRD): 250 m²/year, 965 kWh, 6,5 m³ water, 502 kg chemicals, 200 kg B3. */
export function hardChromeDemo(): Project {
  const q: Record<number, number> = {
    1: 30, 2: 25, 3: 15, 4: 60, 5: 40, 6: 25, 7: 20, 8: 15, 9: 20, 10: 10, 11: 90, 12: 20,
    13: 3500, 14: 3000, 15: 300, 16: 150, 17: 100, 18: 150, 19: 80, 20: 40, 21: 25, 22: 40, 23: 80,
    24: 35, 25: 30, 26: 35, 27: 25, 28: 5, 29: 1, 30: 1,
  };
  const demoMeta = (no: number) =>
    no >= 15 && no <= 23
      ? meta("measured", "Meter kWh panel (demo)", "Sub-meter / estimasi daya × jam", 5)
      : no === 13 || no === 14
        ? meta("measured", "Flowmeter (demo)", "Flowmeter", 5)
        : meta("supplier", "Purchasing record (demo)", "Invoice / penimbangan", 10);
  return baseProject({
    name: "AeroSphere — Plating Hard Chrome (demo)",
    template: "Plating – Hard Chrome",
    client: "Dataset demo BUILD 2026",
    inputs: catalogInputs(q, demoMeta),
    airEmissions: airEmissions(
      { "Cr(VI) mist": 0.15, "Acid mist H₂SO₄/HCl": 0.8, "H₂": 12, "Cyanide compound": null, VOC: 0.5 },
      meta("calculated", "Estimasi faktor emisi (demo)", "Perhitungan", 30),
    ),
    effluent: effluent({ pH: 7.2, TSS: 25, COD: 40, "Cr total": 0.8, "Cr(VI)": 0.5, Cd: 0.02, Ni: 0.3, Zn: 0.15, Cu: 0.1, Cyanide: 0 }),
    waste: [
      waste("Sludge bilas pre-treatment", "A", 20, meta("measured", "Manifest B3 (demo)", "Penimbangan", 5)),
      waste("Residu bath strike", "B", 16, meta("measured", "Manifest B3 (demo)", "Penimbangan", 5)),
      waste("Spent bath / sludge anoda", "C", 30, meta("measured", "Manifest B3 (demo)", "Penimbangan", 5)),
      waste("Sludge chromate post-treatment", "D", 24, meta("measured", "Manifest B3 (demo)", "Penimbangan", 5)),
      waste("Filter/cartridge bekas", "E", 10, meta("measured", "Manifest B3 (demo)", "Penimbangan", 5)),
      waste("Metal hydroxide sludge (IPAL)", "F", 100, meta("measured", "Manifest B3 (demo)", "Penimbangan", 5)),
    ],
    production: {
      areaM2: 250,
      parts: 1200,
      componentMassKg: 3600,
      batches: 240,
      reworkPct: 0,
      coatingMetal: "Cr",
      coatingThicknessUm: 10,
      coatingDensityKgM3: 7190,
      // Gap A3: effluent ≈ 90% of water in (5,85 m³) instead of the inconsistent 100 m³.
      effluentVolumeM3: 5.85,
      waterEvaporatedM3: 0.65,
      compressorKwhPerNm3: 0.12,
    },
    prices: {
      validFrom: "2026-01-01",
      isDemo: true,
      energyRpPerKwh: 1500,
      waterRpPerL: 15,
      chemicalRpPerKg: 45000,
      wwtpChemicalRpPerKg: 20000,
      consumableRpPerKg: 30000,
      wasteTreatmentRpPerKg: 8000,
      wasteTransportRpPerKm: 12000,
      wasteTripsPerPeriod: 6,
      laborRpPerPeriod: 25_000_000,
      depreciationRpPerPeriod: 0,
      carbonPriceRpPerKgCO2e: 0,
    },
  });
}

/** Ni Watts bath per Takuma et al. (2018) inventory (PRD 5.3.2), Tier 5, 250 m². */
export function niWattsTemplate(): Project {
  const area = 250;
  const lit = (note: string, u = 30) => meta("literature", "Takuma et al. 2018 / PRD 5.3.2", "Perhitungan dari aturan jurnal", u, note);
  const inputs: InputFlow[] = [
    input(1, "Chemical", "H₂SO₄ (pretreatment)", "kg", "A", 0.0184 * area, lit("18,4 g/m² (benchmark deck)")),
    input(2, "Chemical", "Alkaline degreaser", "kg", "A", 0, meta("measured")),
    input(3, "Chemical", "NiSO₄·6H₂O make-up", "kg", "C", 0.048 * area, lit("0,2 L/m² × 240 g/L", 50)),
    input(4, "Chemical", "NiCl₂·6H₂O make-up", "kg", "C", 0.011 * area, lit("0,2 L/m² × 55 g/L (stoikiometri NiO + HCl)", 50)),
    input(5, "Chemical", "Asam borat make-up", "kg", "C", 0.008 * area, lit("0,2 L/m² × 40 g/L (asumsi)", 50)),
    input(6, "Anode", "Ni anode (logam)", "kg", "C", 1.336 * area, lit("Logam anoda ≈ logam terdeposit", 15)),
    input(7, "Water", "Air bilas", "L", "C", 10 * area, lit("Titik tengah benchmark 8–13 L/m²", 25)),
    input(8, "Energy", "Rectifier electricity", "kWh", "C", 6.4 * area, lit("Faraday 1.220 Ah ÷ 95% × 5–6 V", 20), true),
    input(9, "Energy", "Bath heater", "kWh", "C", 0, meta("measured", "", "", 10, "Hitung per tangki: heat-up + holding"), true),
    input(10, "WWTPChemical", "NaOH (pH adjustment)", "kg", "F", 0, meta("measured")),
    input(11, "WWTPChemical", "Coagulant/flocculant", "kg", "F", 0, meta("measured")),
  ];
  const stages = structuredClone(DEFAULT_STAGES).map((s) =>
    s.id === "B" ? { ...s, inBoundary: false, subprocesses: ["(tidak ada strike pada Watts bath)"] } : s.id === "C" ? { ...s, subprocesses: ["Nickel electroplating (Watts)", "Recovery", "Rinsing"] } : s,
  );
  return baseProject({
    name: "Plating — Ni Watts Bath (Takuma 2018)",
    template: "Plating – Ni Watts Bath",
    coatingType: "Nickel 150 µm",
    stages,
    inputs,
    airEmissions: airEmissions({}, lit("")),
    effluent: [
      { id: newId("eff"), parameter: "pH", unit: "-", value: 7 },
      { id: newId("eff"), parameter: "Ni", unit: "mg/L", value: 5 },
      { id: newId("eff"), parameter: "Boron", unit: "mg/L", value: 140 },
    ],
    waste: [waste("Ni(OH)₂ sludge (cake 25%)", "F", 0.17 * area, lit("21,1 g Ni(OH)₂, 50% padatan, cake 25%", 60), { metalContentPct: 7.9 })],
    production: {
      areaM2: area,
      parts: 0,
      componentMassKg: 0,
      batches: 0,
      reworkPct: 0,
      coatingMetal: "Ni",
      coatingThicknessUm: 150,
      coatingDensityKgM3: 8908,
      effluentVolumeM3: 0.01 * area,
      waterEvaporatedM3: 0,
    },
  });
}

/** Chromic acid anodize line (SCM, anonymised; PRD 5.2) — structure, quantities to be filled. */
export function anodizeTemplate(): Project {
  const scm = (note: string) => meta("calculated", "SCM (dianonimkan)", "Turunan volume & setpoint", 30, note);
  const inputs: InputFlow[] = [
    input(1, "Chemical", "SB degreaser alkali (AC)", "kg", "A", 0, meta("measured", "", "", 10, "AC 945 L, target 17,5%")),
    input(2, "Chemical", "BD-6 / BD-16 deoxidizer (DO)", "kg", "A", 0, meta("measured", "", "", 10, "DO 840 L, target 6,5 g/L")),
    input(3, "Chemical", "Asam nitrat (DO)", "kg", "A", 0, meta("measured", "", "", 10, "Target 96 g/L")),
    input(4, "Chemical", "CrO₃ (CAA)", "kg", "C", 0, meta("measured", "", "", 10, "Inventori bath 46,2 kg CrO₃ bebas; drag-out 5,5 g/m² bila V_d 0,1 L/m²")),
    input(5, "Chemical", "Kalium/natrium dikromat (DDS/DS)", "kg", "D", 0, meta("measured")),
    input(6, "Chemical", "Nikel asetat sealant (NAS)", "kg", "D", 0, meta("measured")),
    input(7, "Water", "DI water (bilas RN-1…RN-4)", "L", "A", 0, meta("measured")),
    input(8, "Energy", "Heater AC (heat-up)", "kWh", "A", 0, scm("36,3 kWh per heat-up (945 L ke 58 °C)"), true),
    input(9, "Energy", "Heater CAA (heat-up)", "kWh", "C", 0, scm("14,7 kWh per heat-up (840 L ke 40 °C)"), true),
    input(10, "Energy", "Heater HWS (heat-up)", "kWh", "D", 0, scm("79,7 kWh per heat-up (945 L ke 97,5 °C)"), true),
    input(11, "Energy", "Rectifier anodizing", "kWh", "C", 0, meta("measured", "", "", 10, "Data arus & waktu belum ada"), true),
  ];
  const stages = structuredClone(DEFAULT_STAGES).map((s) =>
    s.id === "B"
      ? { ...s, inBoundary: false, subprocesses: ["(tidak ada strike pada anodize)"] }
      : s.id === "A"
        ? { ...s, subprocesses: ["AC alkaline cleaning", "RN-1 rinse", "WB water break", "DO deoxidizing", "RN-2 rinse"] }
        : s.id === "C"
          ? { ...s, subprocesses: ["CAA chromic acid anodize Type I/IB", "RN-3 rinse"] }
          : s.id === "D"
            ? { ...s, subprocesses: ["DCS / HWS / DDS / DS / NAS sealing", "RN-4 rinse", "HAD hot air drying"] }
            : s,
  );
  return baseProject({
    name: "Anodize — Chromic Acid Type I/IB (SCM)",
    template: "Anodize – Chromic Acid",
    coatingType: "Chromic acid anodize",
    substrate: "Aluminium",
    stages,
    inputs,
    production: { ...baseProject({ name: "", template: "" }).production, coatingMetal: "Al₂O₃", coatingDensityKgM3: 0 },
  });
}

export function cdZnNiTemplate(): Project {
  return baseProject({ name: "Plating — Cd / Zn-Ni", template: "Plating – Cd/Zn-Ni", coatingType: "Cadmium / Zinc-nickel", production: { ...baseProject({ name: "", template: "" }).production, coatingMetal: "Zn-Ni", coatingDensityKgM3: 7100 } });
}

export function emptyTemplate(): Project {
  return baseProject({ name: "Proyek baru", template: "Kosong" });
}

export const TEMPLATES: Array<{ id: string; label: string; description: string; build: () => Project }> = [
  { id: "hard-chrome", label: "Plating – Hard Chrome (demo)", description: "Dataset demo BUILD 2026: 250 m²/tahun, 30 input, 6 tahap A–F.", build: hardChromeDemo },
  { id: "ni-watts", label: "Plating – Ni Watts Bath", description: "Inventori Takuma et al. 2018 per m² (Tier 5) × 250 m².", build: niWattsTemplate },
  { id: "anodize", label: "Anodize – Chromic Acid Type I/IB", description: "14 stasiun SCM (dianonimkan); kuantitas diisi pabrik.", build: anodizeTemplate },
  { id: "cd-znni", label: "Plating – Cd/Zn-Ni", description: "Struktur 30 input, kuantitas kosong.", build: cdZnNiTemplate },
  { id: "empty", label: "Kosong", description: "Struktur tahap A–F dan 30 input tanpa data.", build: emptyTemplate },
];
