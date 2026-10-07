export function downloadBlob(content: BlobPart, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJSON(data: unknown, filename: string) {
  downloadBlob(JSON.stringify(data, null, 2), filename, "application/json");
}

/** Cells starting with = + - @ are prefixed so spreadsheets never run them (PRD 2.1.3 step 6). */
export function sanitizeCell(value: unknown): string | number {
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  const str = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
}

export function toCSV(rows: Array<Record<string, unknown>>): string {
  const first = rows[0];
  if (!first) return "";
  const headers = Object.keys(first);
  const esc = (v: unknown) => {
    const s = String(sanitizeCell(v));
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function downloadCSV(rows: Array<Record<string, unknown>>, filename: string) {
  downloadBlob("﻿" + toCSV(rows), filename, "text/csv;charset=utf-8");
}

export function fileStamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
}
