import type { Workbook, Worksheet } from "exceljs";
import { meta, newId } from "@/lib/domain/templates";
import type { AirEmission, Basis, EffluentParam, HazardousWaste, InputCategory, InputFlow, Production, Project, SourceType, StageId } from "@/lib/domain/types";
import { parseUnit } from "@/lib/engine/units";
import { sanitizeCell } from "@/lib/utils/export";

/**
 * Official template "Form LCI Proses Plating" (FR-03.1) with six sheets.
 * Only cell values are read (no formulas/macros), every row is checked and
 * the import report lists accepted, rejected and warning rows (PRD 2.1.3).
 */

export const SHEETS = ["Goal & Scope", "Peta Proses", "LCI Input", "LCI Output", "Energi & Utilitas", "Neraca & Kualitas"] as const;

const INPUT_HEADERS = ["ID", "No", "Kategori", "Nama", "Tahap", "Kuantitas", "Unit", "Basis", "Tipe sumber", "Sumber", "Metode ukur", "Ketidakpastian %", "Harga Rp/unit"];
const OUTPUT_HEADERS = ["ID", "Jenis", "Parameter", "Tahap", "Nilai", "Unit", "Basis", "Berlaku", "Baku mutu", "Pengolahan", "Tujuan", "Transport km", "Kadar air %", "Kadar logam %"];

const CATEGORIES: InputCategory[] = ["Chemical", "Anode", "Water", "Energy", "WWTPChemical", "Consumable"];
const STAGES: StageId[] = ["A", "B", "C", "D", "E", "F"];
const BASES: Basis[] = ["period", "month", "batch"];
const SOURCES: SourceType[] = ["measured", "calculated", "supplier", "database", "literature"];
const MAX_BYTES = 25 * 1024 * 1024;

async function loadExcel() {
  const mod = await import("exceljs");
  return (mod as unknown as { default?: typeof mod }).default ?? mod;
}

function styleHeader(ws: Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1660" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.columns.forEach((c) => {
    c.width = 18;
  });
}

function inputRow(i: InputFlow) {
  return [i.id, i.no, i.category, i.name, i.stageId, i.quantity, i.unit, i.basis, i.meta.sourceType, i.meta.source, i.meta.method, i.meta.uncertaintyPct, i.unitPriceRp ?? ""].map(sanitizeCell);
}

export async function buildTemplate(project: Project): Promise<Blob> {
  const ExcelJS = await loadExcel();
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "AeroSphere LCA";
  wb.created = new Date();

  const gs = wb.addWorksheet(SHEETS[0]);
  gs.addRow(["Field", "Nilai"]);
  [
    ["Proyek", project.name],
    ["Fasilitas", project.facility],
    ["Periode", project.periodLabel],
    ["Bulan dalam periode", project.periodMonths],
    ["Satuan fungsi", project.scope.fuType],
    ["Boundary", project.scope.boundary],
    ["Tujuan", project.scope.goal],
    ["Petunjuk", "Isi sheet LCI Input, LCI Output, Energi & Utilitas, dan Neraca & Kualitas. Jangan ubah kolom ID agar baris dicocokkan."],
  ].forEach((r) => gs.addRow(r.map(sanitizeCell)));
  styleHeader(gs);
  gs.getColumn(2).width = 80;

  const pm = wb.addWorksheet(SHEETS[1]);
  pm.addRow(["Tahap", "Nama", "Fungsi", "Sub-proses", "Dalam boundary"]);
  project.stages.forEach((s) => pm.addRow([s.id, s.name, s.functionDesc, s.subprocesses.join("; "), s.inBoundary ? "Ya" : "Tidak"].map(sanitizeCell)));
  styleHeader(pm);

  const li = wb.addWorksheet(SHEETS[2]);
  li.addRow(INPUT_HEADERS);
  project.inputs.filter((i) => i.category !== "Energy").forEach((i) => li.addRow(inputRow(i)));
  styleHeader(li);

  const lo = wb.addWorksheet(SHEETS[3]);
  lo.addRow(OUTPUT_HEADERS);
  project.airEmissions.forEach((a) => lo.addRow([a.id, "Emisi udara", a.parameter, a.stageId, a.quantityKg, "kg", a.basis, a.applicable ? "Ya" : "Tidak", "", "", "", "", "", ""].map(sanitizeCell)));
  project.effluent.forEach((e) => lo.addRow([e.id, "Efluen", e.parameter, "F", e.value, e.unit, "", "Ya", e.limit ?? "", "", "", "", "", ""].map(sanitizeCell)));
  project.waste.forEach((w) =>
    lo.addRow([w.id, "Limbah B3", w.wasteType, w.stageId, w.quantityKg, "kg", w.basis, "Ya", "", w.treatment, w.destination, w.transportKm, w.moisturePct, w.metalContentPct].map(sanitizeCell)),
  );
  styleHeader(lo);

  const en = wb.addWorksheet(SHEETS[4]);
  en.addRow(INPUT_HEADERS);
  project.inputs.filter((i) => i.category === "Energy").forEach((i) => en.addRow(inputRow(i)));
  styleHeader(en);

  const nk = wb.addWorksheet(SHEETS[5]);
  nk.addRow(["Field", "Nilai", "Satuan"]);
  const p = project.production;
  (
    [
      ["areaM2", p.areaM2, "m² per periode"],
      ["parts", p.parts, "part per periode"],
      ["componentMassKg", p.componentMassKg, "kg per periode"],
      ["batches", p.batches, "batch per periode"],
      ["reworkPct", p.reworkPct, "%"],
      ["coatingMetal", p.coatingMetal, "-"],
      ["coatingThicknessUm", p.coatingThicknessUm, "µm"],
      ["coatingDensityKgM3", p.coatingDensityKgM3, "kg/m³"],
      ["effluentVolumeM3", p.effluentVolumeM3, "m³ per periode"],
      ["waterEvaporatedM3", p.waterEvaporatedM3, "m³ per periode"],
      ["compressorKwhPerNm3", p.compressorKwhPerNm3 ?? "", "kWh/Nm³"],
    ] as Array<[string, string | number, string]>
  ).forEach((r) => nk.addRow(r.map(sanitizeCell)));
  styleHeader(nk);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* --------------------------------- Import -------------------------------- */

export interface ImportReport {
  accepted: number;
  rejected: Array<{ sheet: string; row: number; reason: string }>;
  warnings: Array<{ sheet: string; row: number; reason: string }>;
}

export interface DatasetPatch {
  inputs: InputFlow[];
  airEmissions: AirEmission[];
  effluent: EffluentParam[];
  waste: HazardousWaste[];
  production: Production;
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    // Formula cells: only the cached result is used, never the formula.
    if (o.result !== undefined) return cellText(o.result);
    return "";
  }
  return String(v).normalize("NFC").trim().replace(/^'(?=[=+\-@])/, "");
}

function cellNumber(v: unknown): number | null {
  const t = cellText(v);
  if (t === "") return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
}

function rowsOf(ws: Worksheet | undefined): Array<{ row: number; get: (h: string) => unknown }> {
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell((c, col) => {
    headers[col] = cellText(c.value).toLowerCase();
  });
  const out: Array<{ row: number; get: (h: string) => unknown }> = [];
  ws.eachRow((r, idx) => {
    if (idx === 1) return;
    const values = r.values as unknown[];
    if (values.every((v) => cellText(v) === "")) return;
    out.push({ row: idx, get: (h) => values[headers.indexOf(h.toLowerCase())] });
  });
  return out;
}

export async function parseTemplate(file: File, project: Project): Promise<{ patch: DatasetPatch; report: ImportReport }> {
  if (file.size > MAX_BYTES) throw new Error("File melebihi 25 MB.");
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Hanya file .xlsx yang diterima (makro .xlsm ditolak).");
  const ExcelJS = await loadExcel();
  const wb: Workbook = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  const report: ImportReport = { accepted: 0, rejected: [], warnings: [] };
  const reject = (sheet: string, row: number, reason: string) => report.rejected.push({ sheet, row, reason });
  const warn = (sheet: string, row: number, reason: string) => report.warnings.push({ sheet, row, reason });

  const byId = new Map(project.inputs.map((i) => [i.id, i]));
  const byName = new Map(project.inputs.map((i) => [`${i.category}|${i.name.toLowerCase()}`, i]));
  const inputs: InputFlow[] = [];
  const seen = new Set<string>();

  for (const sheetName of [SHEETS[2], SHEETS[4]]) {
    for (const r of rowsOf(wb.getWorksheet(sheetName))) {
      const category = cellText(r.get("Kategori")) as InputCategory;
      const name = cellText(r.get("Nama"));
      const stageId = cellText(r.get("Tahap")).toUpperCase() as StageId;
      const quantity = cellNumber(r.get("Kuantitas"));
      const unit = cellText(r.get("Unit"));
      const basis = (cellText(r.get("Basis")) || "period") as Basis;
      const source = (cellText(r.get("Tipe sumber")) || "measured") as SourceType;
      const unc = cellNumber(r.get("Ketidakpastian %"));
      const price = cellNumber(r.get("Harga Rp/unit"));
      if (!CATEGORIES.includes(category)) {
        reject(sheetName, r.row, `Kategori "${category}" tidak dikenal`);
        continue;
      }
      if (!name) {
        reject(sheetName, r.row, "Nama kosong");
        continue;
      }
      if (!STAGES.includes(stageId)) {
        reject(sheetName, r.row, `Tahap "${stageId}" harus A–F`);
        continue;
      }
      if (quantity === null || Number.isNaN(quantity) || quantity < 0) {
        reject(sheetName, r.row, "Kuantitas harus angka ≥ 0");
        continue;
      }
      if (!parseUnit(unit)) {
        reject(sheetName, r.row, `Satuan "${unit}" tidak dikenal`);
        continue;
      }
      if (!BASES.includes(basis)) warn(sheetName, r.row, `Basis "${basis}" diganti "period"`);
      if (!SOURCES.includes(source)) warn(sheetName, r.row, `Tipe sumber "${source}" diganti "measured"`);
      const existing = byId.get(cellText(r.get("ID"))) ?? byName.get(`${category}|${name.toLowerCase()}`);
      const key = existing?.id ?? `${category}|${name.toLowerCase()}`;
      if (seen.has(key)) {
        warn(sheetName, r.row, "Baris duplikat diabaikan (idempoten)");
        continue;
      }
      seen.add(key);
      const m = existing ? { ...existing.meta } : meta(SOURCES.includes(source) ? source : "measured");
      inputs.push({
        id: existing?.id ?? newId("in"),
        no: cellNumber(r.get("No")) ?? existing?.no ?? inputs.length + 1,
        category,
        name,
        stageId,
        quantity,
        unit,
        basis: BASES.includes(basis) ? basis : "period",
        meta: { ...m, sourceType: SOURCES.includes(source) ? source : m.sourceType, source: cellText(r.get("Sumber")) || m.source, method: cellText(r.get("Metode ukur")) || m.method, uncertaintyPct: unc !== null && !Number.isNaN(unc) ? unc : m.uncertaintyPct },
        unitPriceRp: price !== null && !Number.isNaN(price) && price > 0 ? price : undefined,
        mapping: existing?.mapping ?? { status: "unmapped" },
      });
      report.accepted += 1;
    }
  }

  const airEmissions: AirEmission[] = [];
  const effluent: EffluentParam[] = [];
  const waste: HazardousWaste[] = [];
  for (const r of rowsOf(wb.getWorksheet(SHEETS[3]))) {
    const kind = cellText(r.get("Jenis")).toLowerCase();
    const param = cellText(r.get("Parameter"));
    const value = cellNumber(r.get("Nilai"));
    const stageId = (cellText(r.get("Tahap")).toUpperCase() || "F") as StageId;
    const id = cellText(r.get("ID"));
    if (!param || value === null || Number.isNaN(value) || value < 0) {
      reject(SHEETS[3], r.row, "Parameter kosong atau nilai bukan angka ≥ 0");
      continue;
    }
    if (!STAGES.includes(stageId)) {
      reject(SHEETS[3], r.row, `Tahap "${stageId}" harus A–F`);
      continue;
    }
    const basis = (cellText(r.get("Basis")) || "period") as Basis;
    if (kind.startsWith("emisi")) {
      const old = project.airEmissions.find((a) => a.id === id || a.parameter.toLowerCase() === param.toLowerCase());
      airEmissions.push({ ...(old ?? { relevance: "", meta: meta("measured") }), id: old?.id ?? newId("air"), parameter: param, stageId, quantityKg: value, basis: BASES.includes(basis) ? basis : "period", applicable: cellText(r.get("Berlaku")).toLowerCase() !== "tidak" } as AirEmission);
    } else if (kind.startsWith("efluen")) {
      const old = project.effluent.find((e) => e.id === id || e.parameter.toLowerCase() === param.toLowerCase());
      const limit = cellNumber(r.get("Baku mutu"));
      effluent.push({ ...(old ?? {}), id: old?.id ?? newId("eff"), parameter: param, unit: cellText(r.get("Unit")) || "mg/L", value, limit: limit !== null && !Number.isNaN(limit) ? limit : undefined });
    } else if (kind.startsWith("limbah")) {
      const old = project.waste.find((w) => w.id === id || w.wasteType.toLowerCase() === param.toLowerCase());
      waste.push({
        ...(old ?? { recovery: false, meta: meta("measured"), mapping: { status: "unmapped" as const } }),
        id: old?.id ?? newId("waste"),
        wasteType: param,
        stageId,
        quantityKg: value,
        basis: BASES.includes(basis) ? basis : "period",
        treatment: cellText(r.get("Pengolahan")) || old?.treatment || "",
        destination: cellText(r.get("Tujuan")) || old?.destination || "",
        transportKm: cellNumber(r.get("Transport km")) ?? old?.transportKm ?? 0,
        moisturePct: cellNumber(r.get("Kadar air %")) ?? old?.moisturePct ?? 0,
        metalContentPct: cellNumber(r.get("Kadar logam %")) ?? old?.metalContentPct ?? 0,
      } as HazardousWaste);
    } else {
      reject(SHEETS[3], r.row, `Jenis "${kind}" harus Emisi udara / Efluen / Limbah B3`);
      continue;
    }
    report.accepted += 1;
  }

  const production: Production = { ...project.production };
  for (const r of rowsOf(wb.getWorksheet(SHEETS[5]))) {
    const field = cellText(r.get("Field")) as keyof Production;
    if (!(field in production) && field !== "compressorKwhPerNm3") {
      warn(SHEETS[5], r.row, `Field "${field}" diabaikan`);
      continue;
    }
    if (field === "coatingMetal") {
      production.coatingMetal = cellText(r.get("Nilai"));
    } else {
      const n = cellNumber(r.get("Nilai"));
      if (n === null) continue;
      if (Number.isNaN(n) || n < 0) {
        reject(SHEETS[5], r.row, `${field} harus angka ≥ 0`);
        continue;
      }
      (production as unknown as Record<string, number>)[field] = n;
    }
    report.accepted += 1;
  }

  if (!wb.getWorksheet(SHEETS[2]) && !wb.getWorksheet(SHEETS[4])) {
    throw new Error(`Sheet "${SHEETS[2]}" / "${SHEETS[4]}" tidak ditemukan. Gunakan template resmi.`);
  }

  return {
    patch: {
      inputs: inputs.length ? inputs : project.inputs,
      airEmissions: wb.getWorksheet(SHEETS[3]) ? airEmissions : project.airEmissions,
      effluent: wb.getWorksheet(SHEETS[3]) ? effluent : project.effluent,
      waste: wb.getWorksheet(SHEETS[3]) ? waste : project.waste,
      production,
    },
    report,
  };
}
