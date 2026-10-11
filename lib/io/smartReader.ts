import type { InputCategory, StageId } from "@/lib/domain/types";
import type { ExtractedDoc, ExtractedTable } from "./docExtract";

/**
 * Rule-based reader for free-form inventory documents. It recognises header
 * columns, section headings (input / output / emissions / waste / impact
 * results), stages, units and Indonesian or English number formats, and
 * proposes one row per flow with a confidence level. Nothing is applied
 * until the user confirms the review (spec: "tinjau dulu, lalu ganti").
 */

export type RowKind = "input" | "air" | "effluent" | "waste" | "production" | "impact" | "ignore";
export type Confidence = "high" | "medium" | "low";
export type ProductionField = "areaM2" | "parts" | "effluentVolumeM3";

export interface ReadRow {
  id: string;
  table: string;
  rowIndex: number;
  raw: string[];
  kind: RowKind;
  category?: InputCategory;
  productionField?: ProductionField;
  /** Impact category key for external results (gwp, ap, ep, …). */
  impactKey?: string;
  name: string;
  quantity: number | null;
  unit: string;
  stage: StageId | null;
  basis: "period" | "month";
  sourceType: "measured" | "supplier" | "calculated" | "literature";
  confidence: Confidence;
  notes: string[];
  include: boolean;
  origin: "rule" | "ai";
}

export interface ReadSummary {
  inputs: number;
  outputs: number;
  impacts: number;
  production: number;
  unknown: number;
  low: number;
  hasArea: boolean;
  /** The document must contain both inputs and outputs before it can be applied. */
  canApply: boolean;
  problems: string[];
}

/* --------------------------------- numbers -------------------------------- */

export type NumberLocale = "id" | "en";

/** Guess whether the document writes decimals with a comma (id) or a point (en). */
export function guessLocale(doc: Pick<ExtractedDoc, "text">): NumberLocale {
  const id = (doc.text.match(/\d,\d{1,2}(?!\d)/g) ?? []).length + (doc.text.match(/\d{1,3}(\.\d{3})+,\d/g) ?? []).length * 2;
  const en = (doc.text.match(/\d\.\d{1,2}(?!\d)/g) ?? []).length + (doc.text.match(/\d{1,3}(,\d{3})+\.\d/g) ?? []).length * 2;
  return id >= en ? "id" : "en";
}

/** Parses "1.234,5", "1,234.5", "1,85E+03", "30 kg" (number part), "-" → null. */
export function parseNumber(raw: string, locale: NumberLocale = "id"): number | null {
  const m = raw.replace(/\s/g, "").match(/^[-+]?[\d.,]+(?:[eE][-+]?\d+)?/);
  if (!m) return null;
  let s = m[0];
  const exp = s.match(/[eE][-+]?\d+$/)?.[0] ?? "";
  if (exp) s = s.slice(0, -exp.length);
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (hasComma) {
    s = /^[-+]?\d{1,3}(,\d{3})+$/.test(s) && locale === "en" ? s.replace(/,/g, "") : s.replace(/,/g, (c, i) => (i === s.lastIndexOf(",") ? "." : ""));
  } else if (hasDot) {
    if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(s) && locale === "id") s = s.replace(/\./g, "");
  }
  const n = Number(s + exp);
  return Number.isFinite(n) ? n : null;
}

/* ---------------------------------- units --------------------------------- */

const UNIT_ALIASES: Array<[RegExp, string]> = [
  [/^(kg|kilogram|kgs)$/i, "kg"],
  [/^(g|gr|gram)$/i, "g"],
  [/^(mg|miligram)$/i, "mg"],
  [/^(t|ton|tonne|tons)$/i, "ton"],
  [/^(l|lt|ltr|liter|litre)$/i, "L"],
  [/^(ml|mililiter)$/i, "ml"],
  [/^(m3|m³|kubik|m\^3)$/i, "m3"],
  [/^(kwh|kw\.h|kw-h)$/i, "kWh"],
  [/^mwh$/i, "MWh"],
  [/^wh$/i, "Wh"],
  [/^mj$/i, "MJ"],
  [/^gj$/i, "GJ"],
  [/^(nm3|nm³)$/i, "Nm3"],
  [/^(mg\/l|mg\/liter|ppm)$/i, "mg/L"],
  [/^(µg\/l|ug\/l)$/i, "µg/L"],
  [/^(m2|m²|meter persegi|sqm)$/i, "m2"],
  [/^(pcs|pc|buah|unit|part|parts|ea)$/i, "pcs"],
];

export function normaliseUnit(u: string): string {
  const t = u.trim().replace(/^\(|\)$/g, "").replace(/\s*\/\s*(periode|tahun|bulan|year|month|yr|thn|bln)$/i, "");
  for (const [re, canon] of UNIT_ALIASES) if (re.test(t)) return canon;
  return t;
}

export function isKnownUnit(u: string): boolean {
  const t = u.trim();
  return UNIT_ALIASES.some(([re]) => re.test(t.replace(/^\(|\)$/g, ""))) || IMPACT_UNIT.test(t);
}

const IMPACT_UNIT = /(co2|co₂|so2|so₂|po4|po₄|cfc|1,4-?d[cb]*b?|sb\s*eq|n\s*eq|p\s*eq|nmvoc|c2h4|c₂h₄|m2a|m²a|\beq\b|\beq\.|-eq)/i;

/* ----------------------------- classification ----------------------------- */

const IMPACT_NAMES: Array<[RegExp, string]> = [
  [/(global warming|gwp|climate change|perubahan iklim|pemanasan global|jejak karbon|carbon footprint)/i, "gwp"],
  [/(ozone|ozon)/i, "odp"],
  [/(acidification|asidifikasi|hujan asam)/i, "ap"],
  [/(eutroph|eutrofikasi|nutrien)/i, "ep"],
  [/(photochemical|fotokimia|smog)/i, "pocp"],
  [/(abiotic.*fossil|abiotik.*fosil|adp.?f|fossil depletion|fossil resource)/i, "adp_fossil"],
  [/(abiotic|abiotik|adp|mineral resource)/i, "adp_nonfossil"],
  [/(terrestrial ecotox|ekotoksisitas darat)/i, "eco_terrestrial"],
  [/(freshwater ecotox|ekotoksisitas air tawar)/i, "eco_freshwater"],
  [/(marine ecotox|ekotoksisitas laut)/i, "eco_marine"],
  [/(carcinogen|karsinogen)/i, "carcinogenic"],
  [/(human tox|toxicity|toksisitas)/i, "toxicity"],
  [/(water footprint|water consumption|jejak air|water use)/i, "water_footprint"],
  [/(land use|penggunaan lahan)/i, "land_use"],
  [/(cumulative energy|ced).*(non|tak).?renew/i, "ced_nonrenewable"],
  [/(cumulative energy|ced).*renew/i, "ced_renewable"],
  [/(cumulative energy|\bced\b)/i, "ced_nonrenewable"],
];

const STAGE_WORDS: Array<[RegExp, StageId]> = [
  [/(pre.?treat|pembersihan|degreas|pickling|cleaning|etch|ultrasonic|alkaline clean)/i, "A"],
  [/(strike|aktivasi|activation|pengikat)/i, "B"],
  [/(main plating|pelapisan utama|electroplat|plating bath|hard chrome|krom keras|chrome bath|nickel bath|nikel|cadmium|kadmium|anodiz|anodis|plating)/i, "C"],
  [/(post.?treat|pasca|perlakuan akhir|seal|chromate|kromat|passivat|bake|grind|gerinda|drying|pengering)/i, "D"],
  [/(utilit|boiler|compressor|kompresor|chiller|ventilasi|ventilation|scrubber|di.?\/?ro|ro plant|cooling tower)/i, "E"],
  [/(ipal|wwtp|waste ?water treatment|pengolahan air limbah|effluent treatment)/i, "F"],
];

function stageOf(text: string): StageId | null {
  const t = text.trim();
  const code = t.match(/^(?:tahap\s*|stage\s*)?([A-F])(?:[\s.:)\-–]|$)/i);
  if (code) return code[1]!.toUpperCase() as StageId;
  for (const [re, s] of STAGE_WORDS) if (re.test(t)) return s;
  return null;
}

type Section = Exclude<RowKind, "ignore"> | "output";

const SECTION_WORDS: Array<[RegExp, Section]> = [
  [/(hasil (penilaian )?dampak|lcia|impact assessment|karakterisasi|characteri[sz]ation|kategori dampak|impact categor)/i, "impact"],
  [/(emisi udara|air emission|emission(s)? to air|stack|cerobong)/i, "air"],
  [/(air limbah|air buangan|effluent|wastewater|emission(s)? to water|baku mutu air)/i, "effluent"],
  [/(limbah b3|hazardous waste|limbah padat|solid waste|\bwaste\b|limbah)/i, "waste"],
  [/(produksi|production|produk|product output)/i, "production"],
  [/(^|\b)(input|masukan|bahan baku|raw material|konsumsi|consumption|energi|energy)(\b|$)/i, "input"],
  [/(^|\b)(output|keluaran)(\b|$)/i, "output"],
];

const HEADER = {
  name: /^(no\.? ?)?(nama|name|item|bahan|material|parameter|aliran|flow|deskripsi|description|uraian|komponen|zat|substance|kategori dampak|impact categor|dampak|impact|indikator|indicator)/i,
  qty: /(jumlah|kuantitas|quantity|amount|qty|nilai|value|total|konsumsi|consumption|volume|massa|berat|pemakaian|usage|hasil|result|per periode|per tahun|per bulan)/i,
  unit: /^(satuan|unit|uom|units)$/i,
  stage: /(tahap|stage|proses|process|step|lokasi|area)/i,
  category: /^(kategori|category|jenis|type|kelompok|group|arah|direction|i\/o|input\/output)$/i,
  source: /^(sumber|source|asal data|data source|metode ukur|method)$/i,
};

const SKIP_ROW = /^(total|jumlah total|sub ?total|grand total|catatan|note|keterangan|sumber:)/i;

interface Columns {
  name: number;
  qty: number;
  unit: number;
  stage: number;
  category: number;
  source: number;
  headerUnit?: string;
  monthly: boolean;
}

/** Column positions when `r` is a header row ("Nama | Jumlah | Satuan …"), else null. */
function headerCols(r: string[]): Columns | null {
  const idx = (re: RegExp) => r.findIndex((c) => re.test(c));
  const name = idx(HEADER.name);
  const qty = r.findIndex((c, j) => j !== name && HEADER.qty.test(c));
  if (name < 0 || qty < 0) return null;
  // A header has no numbers in it.
  if (r.some((c) => /^[-+]?\d[\d.,]*$/.test(c))) return null;
  const headerUnit = r[qty]!.match(/\(([^)]+)\)|\[([^\]]+)\]/);
  return {
    name,
    qty,
    unit: idx(HEADER.unit),
    stage: r.findIndex((c, j) => j !== name && HEADER.stage.test(c)),
    category: r.findIndex((c, j) => j !== name && HEADER.category.test(c)),
    source: idx(HEADER.source),
    headerUnit: headerUnit ? normaliseUnit(headerUnit[1] ?? headerUnit[2] ?? "") : undefined,
    monthly: /bulan|month/i.test(r[qty]!),
  };
}

function findHeader(rows: string[][]): { index: number; cols: Columns } | null {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cols = headerCols(rows[i]!);
    if (cols) return { index: i, cols };
  }
  return null;
}

/** Without a header: name = first mostly-text column, qty = most numeric column, unit = most unit-like column. */
function guessColumns(rows: string[][], locale: NumberLocale): Columns {
  const width = Math.max(...rows.map((r) => r.length));
  const score = (j: number, f: (c: string) => boolean) => rows.filter((r) => r[j] !== undefined && r[j] !== "" && f(r[j]!)).length;
  let qty = -1;
  let best = 0;
  for (let j = 0; j < width; j++) {
    const s = score(j, (c) => parseNumber(c, locale) !== null);
    if (s > best) [best, qty] = [s, j];
  }
  let name = -1;
  for (let j = 0; j < width; j++) if (j !== qty && score(j, (c) => /[a-zA-Z]{3,}/.test(c)) > 0) {
    name = j;
    break;
  }
  let unit = -1;
  best = 0;
  for (let j = 0; j < width; j++) {
    if (j === qty || j === name) continue;
    const s = score(j, (c) => normaliseUnit(c) !== c.trim() || IMPACT_UNIT.test(c));
    if (s > best) [best, unit] = [s, j];
  }
  return { name, qty, unit, stage: -1, category: -1, source: -1, monthly: false };
}

function sectionOf(text: string): Section | null {
  for (const [re, s] of SECTION_WORDS) if (re.test(text)) return s;
  return null;
}

function sourceTypeOf(text: string): ReadRow["sourceType"] {
  if (/meter|ukur|measur|timbang|weigh|lab/i.test(text)) return "measured";
  if (/faktur|invoice|supplier|pembelian|purchase|nota/i.test(text)) return "supplier";
  if (/literatur|literature|database|ecoinvent|default/i.test(text)) return "literature";
  return "calculated";
}

const MASS = new Set(["kg", "g", "mg", "ton"]);
const VOLUME = new Set(["L", "ml", "m3"]);
const ENERGY = new Set(["kWh", "MWh", "Wh", "GJ"]);
const CONC = new Set(["mg/L", "µg/L"]);

/** Decide kind, category and production field for one row. */
export function classify(
  name: string,
  unit: string,
  section: Section | null,
  categoryCell = "",
): { kind: RowKind; category?: InputCategory; productionField?: ProductionField; impactKey?: string; explicit: boolean } {
  const n = `${name} ${categoryCell}`;
  const impactName = IMPACT_NAMES.find(([re]) => re.test(name))?.[1];
  if (IMPACT_UNIT.test(unit) || (section === "impact" && impactName)) return { kind: "impact", impactKey: impactName, explicit: true };
  if (impactName && (unit === "MJ" || section === "impact")) return { kind: "impact", impactKey: impactName, explicit: true };

  if (/luas|area|permukaan dilapisi|surface|m2 dilapisi/i.test(n) && unit === "m2") return { kind: "production", productionField: "areaM2", explicit: true };
  if (/(part|produk|product|unit diproduksi|jumlah produksi)/i.test(n) && unit === "pcs") return { kind: "production", productionField: "parts", explicit: true };
  if (/(volume|debit|flow).*(air limbah|air buangan|effluent|wastewater)|(air limbah|effluent|wastewater).*(volume|debit)/i.test(n) && (VOLUME.has(unit) || unit === "m3"))
    return { kind: "production", productionField: "effluentVolumeM3", explicit: true };

  if (CONC.has(unit)) return { kind: "effluent", explicit: true };
  if (section === "effluent" && /(cod|bod|tss|ph|nikel|nickel|\bni\b|krom|chrom|\bcr\b|cd|zn|cu|pb|sianida|cyanide|minyak|oil|nitrat|amonia|ammonia|fosfat)/i.test(name))
    return { kind: "effluent", explicit: false };

  const air = /(emisi|emission|mist|kabut|fume|uap asam|acid mist|nox|sox|partikulat|particulate|\bpm\b|voc|cr\s*\(?vi\)?|cr6|hexavalent|krom heksavalen)/i;
  if ((section === "air" || air.test(name)) && MASS.has(unit)) return { kind: "air", explicit: section === "air" };

  const waste = /(limbah|waste|sludge|lumpur|\bb3\b|spent|residu|residue|dross|filter bekas|cartridge bekas|kemasan bekas|bekas pakai)/i;
  if ((section === "waste" || waste.test(name)) && MASS.has(unit)) return { kind: "waste", explicit: section === "waste" || /b3|limbah|waste|sludge|lumpur/i.test(name) };

  // Inputs.
  const explicitInput = section === "input" || /input|masukan/i.test(categoryCell);
  if (ENERGY.has(unit) || /listrik|electric|power|daya/i.test(name)) return { kind: "input", category: "Energy", explicit: ENERGY.has(unit) };
  if (VOLUME.has(unit) && /(air|water|aquades|demin|\bdi\b|\bro\b|bilas|rinse)/i.test(name)) return { kind: "input", category: "Water", explicit: true };
  if (MASS.has(unit)) {
    if (/(anoda|anode)/i.test(name)) return { kind: "input", category: "Anode", explicit: true };
    if (/(ipal|wwtp|koagulan|flokulan|coagul|floccul|kapur|lime|naoh|caustic|metabisulfit|bisulfite|ferro|reduct|pereduksi|polimer|polymer)/i.test(n))
      return { kind: "input", category: "WWTPChemical", explicit: explicitInput || /ipal|wwtp/i.test(n) };
    if (/(filter|cartridge|consumable|habis pakai|masking|tape|sarung|glove|kain|lap)/i.test(name)) return { kind: "input", category: "Consumable", explicit: explicitInput };
    if (section === "output") return { kind: "waste", explicit: false };
    return { kind: "input", category: "Chemical", explicit: explicitInput };
  }
  if (VOLUME.has(unit)) return { kind: "input", category: "Water", explicit: false };
  return { kind: "ignore", explicit: false };
}

const DEFAULT_STAGE: Partial<Record<RowKind | InputCategory, StageId>> = {
  Chemical: "C",
  Anode: "C",
  Water: "A",
  Energy: "E",
  WWTPChemical: "F",
  Consumable: "D",
  air: "C",
  waste: "F",
};

let seq = 0;

function readTable(t: ExtractedTable, locale: NumberLocale): ReadRow[] {
  const header = findHeader(t.rows);
  let cols = header?.cols ?? guessColumns(t.rows, locale);
  const start = header ? header.index + 1 : 0;
  let section: Section | null = sectionOf(t.name);
  // Table/file names only count with an explicit "Tahap X" / "Stage X" or a process name (not "a.csv").
  let stageCtx: StageId | null = /^(tahap|stage)\s*[A-F]\b/i.test(t.name) || STAGE_WORDS.some(([re]) => re.test(t.name)) ? stageOf(t.name.replace(/^(tahap|stage)\s*/i, "")) : null;
  const out: ReadRow[] = [];

  for (let i = start; i < t.rows.length; i++) {
    const r = t.rows[i]!;
    // A second table on the same page/sheet starts with its own header row.
    const again = i > start ? headerCols(r) : null;
    if (again) {
      cols = again;
      continue;
    }
    const filled = r.filter((c) => c !== "");
    let nameCell = r[cols.name] ?? filled.find((c) => /[a-zA-Z]{2,}/.test(c)) ?? "";
    let qtyIndex = cols.qty;
    let qtyCell = cols.qty >= 0 ? (r[cols.qty] ?? "") : "";
    if (cols.qty < 0 || parseNumber(qtyCell, locale) === null) {
      const isQty = (c: string, j: number) => j !== cols.name && c !== "" && c !== nameCell && parseNumber(c, locale) !== null;
      // Prefer numbers right of the name: a leading number is usually the row number ("No").
      qtyIndex = r.findIndex((c, j) => j > cols.name && isQty(c, j));
      if (qtyIndex < 0) qtyIndex = r.findIndex(isQty);
      qtyCell = qtyIndex >= 0 ? r[qtyIndex]! : qtyCell;
    }
    const quantity = parseNumber(qtyCell, locale);
    // Rows with fewer cells than the header (an empty cell dropped, e.g. in PDFs) shift the columns.
    const shifted = qtyIndex !== cols.qty;

    // Heading rows (no number): update section / stage context.
    if (quantity === null) {
      const text = filled.join(" ");
      const s = sectionOf(text);
      if (s) section = s;
      const st = stageOf(text);
      if (st && filled.length <= 2) stageCtx = st;
      continue;
    }
    if (!nameCell || SKIP_ROW.test(nameCell) || /^\d+([.,]\d+)?$/.test(nameCell)) continue;

    let unitFromCell = cols.unit >= 0 ? (r[cols.unit] ?? "") : "";
    if ((shifted || !isKnownUnit(unitFromCell)) && qtyIndex >= 0 && isKnownUnit(r[qtyIndex + 1] ?? "")) unitFromCell = r[qtyIndex + 1]!;
    // A stage letter merged into the name cell ("Lumpur IPAL F") when the stage column is empty.
    let mergedStage: StageId | null = null;
    const tail = nameCell.match(/\s([A-F])$/);
    if (tail && cols.stage >= 0 && !stageOf(r[cols.stage] ?? "")) {
      mergedStage = tail[1] as StageId;
      nameCell = nameCell.slice(0, tail.index).trim();
    }
    const unitInQty = qtyCell.replace(/^[-+]?[\d.,\s]+(?:[eE][-+]?\d+)?/, "").trim();
    // "(kg)" at the end of a name is a unit; "(CrO3)" or "(IPAL)" is part of the name.
    const bracket = nameCell.match(/\s*[([]([^)\]]+)[)\]]\s*$/);
    const bracketUnit = bracket && isKnownUnit(bracket[1]!) ? normaliseUnit(bracket[1]!) : "";
    const unit = normaliseUnit(unitFromCell || unitInQty || cols.headerUnit || bracketUnit);
    const name = (bracketUnit ? nameCell.slice(0, bracket!.index).trim() : nameCell) || nameCell;
    const categoryCell = cols.category >= 0 && !shifted ? (r[cols.category] ?? "") : "";
    const c = classify(name, unit, section, categoryCell);

    const stageCell = cols.stage >= 0 && !shifted ? (r[cols.stage] ?? "") : "";
    let stage = mergedStage ?? stageOf(stageCell) ?? stageCtx;
    const notes: string[] = [];
    let stageGuessed = false;
    if (!stage && c.kind !== "impact" && c.kind !== "production" && c.kind !== "effluent") {
      stage = stageOf(name) ?? DEFAULT_STAGE[c.category ?? c.kind] ?? null;
      stageGuessed = true;
      if (stage) notes.push(`Tahap ditebak: ${stage}`);
    }
    if (c.kind === "effluent") stage = "F";

    let confidence: Confidence = c.explicit && !stageGuessed ? "high" : "medium";
    if (c.kind === "ignore") {
      confidence = "low";
      notes.push(unit ? `Satuan “${unit}” belum dikenali` : "Satuan tidak ditemukan");
    }
    if (!unit) {
      confidence = "low";
      if (c.kind !== "ignore") notes.push("Satuan tidak ditemukan");
    }
    if (c.kind === "impact" && !c.impactKey) {
      confidence = "medium";
      notes.push("Kategori dampak belum dikenali");
    }
    if (quantity < 0) {
      confidence = "low";
      notes.push("Nilai negatif");
    }

    out.push({
      id: `r${++seq}`,
      table: t.name,
      rowIndex: i + 1,
      raw: r,
      kind: c.kind,
      category: c.category,
      productionField: c.productionField,
      impactKey: c.impactKey,
      name,
      quantity,
      unit,
      stage,
      basis: cols.monthly ? "month" : "period",
      sourceType: sourceTypeOf(cols.source >= 0 ? (r[cols.source] ?? r[r.length - 1] ?? "") : ""),
      confidence,
      notes,
      include: c.kind !== "ignore" && confidence !== "low",
      origin: "rule",
    });
  }
  return out;
}

export function readDocument(doc: ExtractedDoc): ReadRow[] {
  const locale = guessLocale(doc);
  return doc.tables.flatMap((t) => readTable(t, locale));
}

const OUTPUT_KINDS: RowKind[] = ["air", "effluent", "waste"];

export function summarise(rows: ReadRow[]): ReadSummary {
  const used = rows.filter((r) => r.include);
  const inputs = used.filter((r) => r.kind === "input").length;
  const outputs = used.filter((r) => OUTPUT_KINDS.includes(r.kind)).length;
  const hasArea = used.some((r) => r.kind === "production" && r.productionField === "areaM2");
  const problems: string[] = [];
  if (!inputs) problems.push("Belum ada data input (bahan kimia, listrik, air, …). Dokumen harus berisi input dan output.");
  if (!outputs) problems.push("Belum ada data output (emisi udara, air buangan, limbah B3). Dokumen harus berisi input dan output.");
  return {
    inputs,
    outputs,
    impacts: used.filter((r) => r.kind === "impact").length,
    production: used.filter((r) => r.kind === "production").length,
    unknown: rows.filter((r) => r.kind === "ignore").length,
    low: rows.filter((r) => r.confidence === "low").length,
    hasArea,
    canApply: inputs > 0 && outputs > 0,
    problems,
  };
}
