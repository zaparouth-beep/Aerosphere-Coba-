import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hardChromeDemo } from "@/lib/domain/templates";
import { calculate } from "@/lib/engine/calculate";
import { extractXlsx, parseCsv, pdfItemsToRows, type ExtractedDoc } from "@/lib/io/docExtract";
import { buildImport } from "@/lib/io/readerApply";
import { normaliseUnit, parseNumber, readDocument, summarise } from "@/lib/io/smartReader";

/** Free-form document import: rule-based reader (no AI). */

const doc = (rows: string[][], name = "Tabel 1"): ExtractedDoc => ({ fileName: "uji", kind: "docx", tables: [{ name, rows }], text: rows.map((r) => r.join(" | ")).join("\n") });

// Same content as tests/fixtures/import/lci.docx / lci.pdf (Indonesian plant report).
const PLANT: string[][] = [
  ["No", "Uraian", "Tahap", "Jumlah", "Satuan", "Sumber"],
  ["", "INPUT", "", "", "", ""],
  ["1", "Degreaser alkali", "A", "30", "kg", "Faktur"],
  ["2", "Asam kromat (CrO3)", "C", "150", "kg", "Faktur"],
  ["3", "Listrik penyearah arus", "C", "1.250,5", "kWh", "Meter"],
  ["4", "Air bilas", "A", "3,5", "m3", "Meter"],
  ["5", "Kapur (IPAL)", "F", "40", "kg", "Faktur"],
  ["", "OUTPUT", "", "", "", ""],
  ["6", "Luas permukaan dilapisi", "", "250", "m2", "Catatan produksi"],
  ["7", "Kabut asam kromat", "C", "0,15", "kg", "Uji lab"],
  ["8", "Lumpur IPAL (limbah B3)", "F", "100", "kg", "Timbang"],
  ["9", "COD air buangan", "F", "85", "mg/L", "Uji lab"],
  ["10", "Volume air limbah", "F", "5,85", "m3", "Meter"],
];
const IMPACTS: string[][] = [
  ["Kategori dampak", "Nilai", "Satuan"],
  ["Global warming potential", "1.850,2", "kg CO2 eq"],
  ["Acidification potential", "10,4", "kg SO2 eq"],
];

describe("numbers and units", () => {
  it("Indonesian and English formats", () => {
    expect(parseNumber("1.250,5", "id")).toBe(1250.5);
    expect(parseNumber("1,250.5", "en")).toBe(1250.5);
    expect(parseNumber("3,5", "id")).toBe(3.5);
    expect(parseNumber("1.234", "id")).toBe(1234);
    expect(parseNumber("1.234", "en")).toBe(1.234);
    expect(parseNumber("1,85E+03", "id")).toBe(1850);
    expect(parseNumber("30 kg", "id")).toBe(30);
    expect(parseNumber("-", "id")).toBeNull();
    expect(parseNumber("Faktur", "id")).toBeNull();
  });
  it("unit aliases", () => {
    expect(normaliseUnit("Liter")).toBe("L");
    expect(normaliseUnit("m³")).toBe("m3");
    expect(normaliseUnit("KWH")).toBe("kWh");
    expect(normaliseUnit("mg/l")).toBe("mg/L");
    expect(normaliseUnit("kg/bulan")).toBe("kg");
  });
});

describe("plant report (Word/PDF table)", () => {
  const rows = readDocument({ ...doc(PLANT), tables: [{ name: "Tabel 1", rows: PLANT }, { name: "Tabel 2", rows: IMPACTS }] });
  const find = (name: string) => rows.find((r) => r.name.startsWith(name))!;

  it("classifies every row", () => {
    expect(find("Degreaser alkali")).toMatchObject({ kind: "input", category: "Chemical", stage: "A", quantity: 30, unit: "kg", sourceType: "supplier", confidence: "high" });
    expect(find("Asam kromat (CrO3)")).toMatchObject({ kind: "input", category: "Chemical", stage: "C" });
    expect(find("Listrik")).toMatchObject({ kind: "input", category: "Energy", quantity: 1250.5, unit: "kWh", sourceType: "measured" });
    expect(find("Air bilas")).toMatchObject({ kind: "input", category: "Water", quantity: 3.5, unit: "m3" });
    expect(find("Kapur (IPAL)")).toMatchObject({ kind: "input", category: "WWTPChemical", stage: "F" });
    expect(find("Luas permukaan")).toMatchObject({ kind: "production", productionField: "areaM2", quantity: 250 });
    expect(find("Kabut asam")).toMatchObject({ kind: "air", quantity: 0.15 });
    expect(find("Lumpur IPAL")).toMatchObject({ kind: "waste", quantity: 100, stage: "F" });
    expect(find("COD")).toMatchObject({ kind: "effluent", quantity: 85, unit: "mg/L" });
    expect(find("Volume air limbah")).toMatchObject({ kind: "production", productionField: "effluentVolumeM3", quantity: 5.85 });
    expect(find("Global warming")).toMatchObject({ kind: "impact", impactKey: "gwp", quantity: 1850.2 });
    expect(find("Acidification")).toMatchObject({ kind: "impact", impactKey: "ap" });
  });

  it("summary: inputs and outputs present, area found, can apply", () => {
    const s = summarise(rows);
    expect(s).toMatchObject({ inputs: 5, outputs: 3, impacts: 2, hasArea: true, canApply: true });
  });

  it("builds project data the engine can calculate", () => {
    const { data, skipped } = buildImport(rows, hardChromeDemo(), "lci.docx");
    expect(skipped).toEqual([]);
    expect(data.inputs).toHaveLength(5);
    expect(data.airEmissions[0]!.quantityKg).toBe(0.15);
    expect(data.waste[0]!.quantityKg).toBe(100);
    expect(data.production.areaM2).toBe(250);
    expect(data.production.effluentVolumeM3).toBe(5.85);
    expect(data.externalImpacts).toEqual([
      { key: "gwp", label: "Global warming potential", value: 1850.2, unit: "kg CO2 eq", source: "lci.docx" },
      { key: "ap", label: "Acidification potential", value: 10.4, unit: "kg SO2 eq", source: "lci.docx" },
    ]);
    const project = { ...hardChromeDemo(), ...data };
    const r = calculate(project);
    // Electricity 1,250.5 kWh × 0.613 + chemicals (30 + 150 + 40) kg × 2.5 + water 3,500 L × 0.0003.
    expect(r.analysis!.impacts.find((i) => i.category === "gwp")!.total).toBeCloseTo(1250.5 * 0.613 + 220 * 2.5 + 3500 * 0.0003, 6);
  });
});

describe("validation: input and output are both required", () => {
  it("only inputs → cannot apply, with a clear problem", () => {
    const s = summarise(readDocument(doc(PLANT.slice(0, 7))));
    expect(s.canApply).toBe(false);
    expect(s.problems.join(" ")).toMatch(/output/);
  });
});

describe("CSV (semicolon, Indonesian, no stage column)", () => {
  const csv = "Nama bahan;Pemakaian (kg);Keterangan\nNikel sulfat;120,5;faktur\nAsam borat;12;faktur\nLumpur nikel (limbah B3);45;timbang\n";
  it("reads the unit from the header and guesses stages", () => {
    const rows = readDocument({ fileName: "a.csv", kind: "csv", tables: [{ name: "a.csv", rows: parseCsv(csv) }], text: csv });
    expect(rows.find((r) => r.name === "Nikel sulfat")).toMatchObject({ kind: "input", category: "Chemical", quantity: 120.5, unit: "kg", stage: "C" });
    expect(rows.find((r) => r.name.startsWith("Lumpur"))).toMatchObject({ kind: "waste", quantity: 45 });
    expect(rows.find((r) => r.name === "Asam borat")!.notes.join()).toMatch(/Tahap ditebak/);
  });
});

describe("Excel (English, sections, monthly)", () => {
  it("sections set the kind; a header with 'per month' marks monthly basis", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("LCI");
    ws.addRows([
      ["Life cycle inventory – plating line"],
      ["Item", "Process", "Amount per month", "Unit"],
      ["Inputs"],
      ["Chromic acid", "Main plating", 12.5, "kg"],
      ["Electricity", "Utilities", 80, "kWh"],
      ["Emissions to air"],
      ["Chromic acid mist", "Main plating", 0.012, "kg"],
      ["Waste"],
      ["Spent filter cartridges", "Post-treatment", 2, "kg"],
    ]);
    const tables = await extractXlsx((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const rows = readDocument({ fileName: "b.xlsx", kind: "xlsx", tables, text: "" });
    expect(rows.find((r) => r.name === "Chromic acid")).toMatchObject({ kind: "input", stage: "C", basis: "month", quantity: 12.5 });
    expect(rows.find((r) => r.name === "Electricity")).toMatchObject({ kind: "input", category: "Energy", stage: "E" });
    expect(rows.find((r) => r.name === "Chromic acid mist")).toMatchObject({ kind: "air", stage: "C" });
    expect(rows.find((r) => r.name === "Spent filter cartridges")).toMatchObject({ kind: "waste", stage: "D" });
    expect(summarise(rows).canApply).toBe(true);
  });
});

describe("PDF text layout", () => {
  it("groups text items into rows and cells by position", () => {
    const rows = pdfItemsToRows([
      { str: "Listrik", x: 50, y: 700, w: 30 },
      { str: "penyearah", x: 83, y: 700, w: 45 },
      { str: "1.250,5", x: 250, y: 700, w: 30 },
      { str: "kWh", x: 300, y: 700, w: 20 },
      { str: "Air bilas", x: 50, y: 680, w: 40 },
      { str: "3,5", x: 250, y: 680, w: 12 },
      { str: "m3", x: 300, y: 680, w: 12 },
    ]);
    expect(rows).toEqual([
      ["Listrik penyearah", "1.250,5", "kWh"],
      ["Air bilas", "3,5", "m3"],
    ]);
  });
});

describe("irregular rows (PDF)", () => {
  it("handles dropped cells, a stage merged into the name, and a second table header", () => {
    const rows = readDocument(
      doc([
        ["No", "Uraian", "Tahap", "Jumlah", "Satuan", "Sumber"],
        ["INPUT"],
        ["1", "Degreaser alkali", "A", "30", "kg", "Faktur"],
        ["OUTPUT"],
        ["6", "Luas permukaan dilapisi", "250", "m2", "Catatan produksi"],
        ["8", "Lumpur IPAL (limbah B3) F", "100", "kg", "Timbang"],
        ["Hasil penilaian dampak (dari software lain)"],
        ["Kategori dampak", "Nilai", "Satuan"],
        ["Global warming potential", "1.850,2", "kg CO2 eq"],
      ]),
    );
    expect(rows.find((r) => r.name === "Luas permukaan dilapisi")).toMatchObject({ kind: "production", productionField: "areaM2", quantity: 250, unit: "m2" });
    expect(rows.find((r) => r.name === "Lumpur IPAL (limbah B3)")).toMatchObject({ kind: "waste", stage: "F", quantity: 100, unit: "kg" });
    expect(rows.find((r) => r.name === "Global warming potential")).toMatchObject({ kind: "impact", quantity: 1850.2, unit: "kg CO2 eq" });
  });
});

describe("Excel files exceljs cannot open", () => {
  it("reads a workbook with prefixed XML (ERP / OpenXML SDK) through the fallback reader", async () => {
    const buf = readFileSync("tests/fixtures/import/erp-prefix.xlsx");
    const tables = await extractXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    expect(tables[0]!.name).toBe("LCI Plating");
    const rows = readDocument({ fileName: "erp.xlsx", kind: "xlsx", tables, text: "" });
    expect(rows.find((r) => r.name === "Listrik penyearah arus")).toMatchObject({ kind: "input", quantity: 1250.5, unit: "kWh", stage: "C" });
    expect(rows.find((r) => r.name === "Lumpur IPAL (limbah B3)")).toMatchObject({ kind: "waste", quantity: 100 });
    expect(summarise(rows).canApply).toBe(true);
  });
});
