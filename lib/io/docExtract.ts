/**
 * Turns an uploaded document (Excel, CSV, text PDF, Word) into plain tables of
 * text cells, entirely in the browser. Only cell values and text are read:
 * no formulas, macros or embedded objects are executed. Scanned PDFs (images)
 * have no text layer and come back empty.
 */

import { tx } from "@/lib/i18n";

export type DocKind = "xlsx" | "csv" | "pdf" | "docx";

export interface ExtractedTable {
  /** Sheet, page or table name shown in the review. */
  name: string;
  rows: string[][];
}

export interface ExtractedDoc {
  fileName: string;
  kind: DocKind;
  tables: ExtractedTable[];
  /** All text in reading order (used by the AI reader and to verify its numbers). */
  text: string;
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ACCEPT = ".xlsx,.csv,.pdf,.docx";

export function kindOf(fileName: string): DocKind | null {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "xlsx") return "xlsx";
  if (ext === "csv" || ext === "txt") return "csv";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  return null;
}

const clean = (s: unknown) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();

const tableText = (tables: ExtractedTable[]) => tables.map((t) => [`# ${t.name}`, ...t.rows.map((r) => r.join(" | "))].join("\n")).join("\n\n");

/* ----------------------------------- CSV ---------------------------------- */

/** RFC 4180-ish CSV with auto-detected separator (`,` `;` or tab). */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const sep = counts.sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(clean(cell));
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(clean(cell));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(clean(cell));
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

/* ---------------------------------- Excel --------------------------------- */

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: Array<{ text: string }>; hyperlink?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    // Formula cells: only the cached result is used, never the formula.
    if (o.result !== undefined) return cellText(o.result);
    return "";
  }
  return String(v);
}

export async function extractXlsx(buf: ArrayBuffer): Promise<ExtractedTable[]> {
  try {
    return await extractWithExcelJs(buf.slice(0));
  } catch {
    // Workbooks from ERPs / OpenXML SDK (prefixed XML) that exceljs cannot open.
    const { readXlsxLite } = await import("./xlsxLite");
    try {
      return await readXlsxLite(buf);
    } catch {
      throw new Error(
        tx(
          "File Excel ini tidak bisa dibaca. Buka di Excel lalu simpan ulang sebagai .xlsx, atau ekspor ke CSV.",
          "This Excel file can't be read. Open it in Excel and save it again as .xlsx, or export it to CSV.",
        ),
      );
    }
  }
}

async function extractWithExcelJs(buf: ArrayBuffer): Promise<ExtractedTable[]> {
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb.worksheets.map((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const values = (r.values as unknown[]).slice(1).map((v) => clean(cellText(v)));
      if (values.some((c) => c !== "")) rows.push(values);
    });
    return { name: ws.name, rows };
  });
}

/* ----------------------------------- PDF ---------------------------------- */

interface PdfItem {
  str: string;
  x: number;
  y: number;
  w: number;
}

/** Groups text items into lines by y, then splits a line into cells where the horizontal gap is wide. */
export function pdfItemsToRows(items: PdfItem[]): string[][] {
  const lines: PdfItem[][] = [];
  for (const it of [...items].filter((i) => i.str.trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((l) => Math.abs(l[0]!.y - it.y) < 3);
    if (line) line.push(it);
    else lines.push([it]);
  }
  return lines.map((line) => {
    const sorted = line.sort((a, b) => a.x - b.x);
    const cells: string[] = [];
    let cur = "";
    let lastEnd = -Infinity;
    for (const it of sorted) {
      // Space-only items carry no text; their width would hide the gap between columns.
      if (it.str.trim() === "") continue;
      const gap = it.x - lastEnd;
      // A word space is ~3 pt; anything wider separates two cells.
      if (cur && gap > 3.5) {
        cells.push(clean(cur));
        cur = it.str;
      } else cur = cur ? `${cur}${gap > 1 ? " " : ""}${it.str}` : it.str;
      lastEnd = it.x + it.w;
    }
    if (cur) cells.push(clean(cur));
    return cells;
  });
}

export async function extractPdf(buf: ArrayBuffer): Promise<ExtractedTable[]> {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    // Served from public/ (copied at build time by scripts/copy-pdf-worker.mjs).
    pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/pdf.worker.min.mjs`;
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true }).promise;
  const tables: ExtractedTable[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const it of content.items) {
      if (!("str" in it)) continue;
      items.push({ str: it.str, x: it.transform[4] as number, y: it.transform[5] as number, w: it.width });
    }
    const rows = pdfItemsToRows(items);
    if (rows.length) tables.push({ name: tx(`Halaman ${p}`, `Page ${p}`), rows });
  }
  await doc.destroy();
  return tables;
}

/* ---------------------------------- Word ---------------------------------- */

/** Tables from Word HTML (mammoth); paragraphs outside tables become one-cell rows. */
export function htmlToTables(html: string, parse: (html: string) => Document): ExtractedTable[] {
  const dom = parse(html);
  const tables: ExtractedTable[] = [];
  dom.querySelectorAll("table").forEach((t, i) => {
    const rows = [...t.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th,td")].map((c) => clean(c.textContent))).filter((r) => r.some((c) => c));
    if (rows.length) tables.push({ name: tx(`Tabel ${i + 1}`, `Table ${i + 1}`), rows });
    t.remove();
  });
  const paras = [...dom.querySelectorAll("p,li,h1,h2,h3,h4")].map((p) => clean(p.textContent)).filter(Boolean);
  if (paras.length) tables.push({ name: tx("Teks", "Text"), rows: paras.map((p) => [p]) });
  return tables;
}

export async function extractDocx(buf: ArrayBuffer): Promise<ExtractedTable[]> {
  const mammoth = (await import("mammoth")).default ?? (await import("mammoth"));
  const { value } = await (mammoth as { convertToHtml: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }).convertToHtml({ arrayBuffer: buf });
  return htmlToTables(value, (h) => new DOMParser().parseFromString(h, "text/html"));
}

/* --------------------------------- Entry --------------------------------- */

export async function extractDocument(file: File): Promise<ExtractedDoc> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(tx("File melebihi 25 MB.", "The file is larger than 25 MB."));
  const kind = kindOf(file.name);
  if (!kind) throw new Error(
      tx(
        "Jenis file belum didukung. Gunakan .xlsx, .csv, .pdf, atau .docx (file .xls lama: simpan ulang sebagai .xlsx).",
        "This file type isn't supported yet. Use .xlsx, .csv, .pdf or .docx (old .xls files: save again as .xlsx).",
      ),
    );
  const buf = await file.arrayBuffer();
  const tables =
    kind === "xlsx"
      ? await extractXlsx(buf)
      : kind === "csv"
        ? [{ name: file.name, rows: parseCsv(new TextDecoder().decode(buf).replace(/^﻿/, "")) }]
        : kind === "pdf"
          ? await extractPdf(buf)
          : await extractDocx(buf);
  if (!tables.some((t) => t.rows.length)) {
    throw new Error(
      kind === "pdf"
        ? tx("PDF ini tidak berisi teks (kemungkinan hasil scan). Gunakan PDF berteks, Excel, atau Word.", "This PDF contains no text (probably a scan). Use a text PDF, Excel or Word.")
        : tx("Dokumen kosong atau tidak berisi tabel/teks.", "The document is empty or contains no tables/text."),
    );
  }
  return { fileName: file.name, kind, tables, text: tableText(tables) };
}
