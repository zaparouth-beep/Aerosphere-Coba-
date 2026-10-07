import type { BackgroundDataset, ElementaryFlowCF, ImpactFactors, ImpactId } from "@/lib/domain/types";
import { IMPACT_IDS } from "@/lib/engine/method";

/**
 * CSV adapters for factors computed in openLCA (P3: database-agnostic).
 * Accepts comma, semicolon or tab separators and Indonesian decimal commas.
 * Empty cells mean "not provided", never zero.
 */

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function parseTable(text: string): { header: string[]; rows: string[][]; delimiter: string } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const first = lines[0] ?? "";
  const delimiter = first.includes(";") ? ";" : first.includes("\t") ? "\t" : ",";
  return { header: splitLine(first, delimiter).map((h) => h.toLowerCase()), rows: lines.slice(1).map((l) => splitLine(l, delimiter)), delimiter };
}

function num(raw: string | undefined, delimiter: string): number | undefined | null {
  const t = (raw ?? "").trim();
  if (!t) return undefined;
  const n = Number(delimiter === ";" || /^\d+,\d+$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
}

function factorsFrom(header: string[], row: string[], delimiter: string, errors: string[], line: number): ImpactFactors {
  const f: ImpactFactors = {};
  for (const id of IMPACT_IDS) {
    const idx = header.indexOf(id);
    if (idx < 0) continue;
    const v = num(row[idx], delimiter);
    if (v === null) errors.push(`Baris ${line}: nilai ${id} bukan angka`);
    else if (v !== undefined) f[id as ImpactId] = v;
  }
  return f;
}

export const BACKGROUND_TEMPLATE = `id;name;provider;version;geography;ref_unit;${IMPACT_IDS.join(";")}\nbg-h2so4;Sulfuric acid production;USLCI;2024 Q4;US;kg;;;;;;;;;;;\n`;
export const CF_TEMPLATE = `key;label;compartment;${IMPACT_IDS.join(";")}\nni_water;Nickel, ion (air);water;;;;;;;;;;;\n`;

export function parseBackgroundCsv(text: string, now: string): { datasets: BackgroundDataset[]; errors: string[] } {
  const { header, rows, delimiter } = parseTable(text);
  const errors: string[] = [];
  const col = (r: string[], h: string) => r[header.indexOf(h)] ?? "";
  if (!header.includes("name") || !header.includes("ref_unit")) return { datasets: [], errors: ['Header wajib memuat "name" dan "ref_unit".'] };
  const datasets: BackgroundDataset[] = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    const name = col(r, "name");
    const refUnit = col(r, "ref_unit") as BackgroundDataset["refUnit"];
    if (!name) return errors.push(`Baris ${line}: name kosong`);
    if (!["kg", "L", "kWh"].includes(refUnit)) return errors.push(`Baris ${line}: ref_unit harus kg, L, atau kWh`);
    const factors = factorsFrom(header, r, delimiter, errors, line);
    datasets.push({
      id: col(r, "id") || `bg-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
      name,
      provider: col(r, "provider") || "openLCA",
      version: col(r, "version") || "-",
      geography: col(r, "geography") || "-",
      refUnit,
      factors,
      licenseScope: col(r, "license") || "Sesuai lisensi database sumber",
      importedAt: now,
    });
    return undefined;
  });
  return { datasets, errors };
}

export function parseCfCsv(text: string): { flows: ElementaryFlowCF[]; errors: string[] } {
  const { header, rows, delimiter } = parseTable(text);
  const errors: string[] = [];
  const col = (r: string[], h: string) => r[header.indexOf(h)] ?? "";
  if (!header.includes("key")) return { flows: [], errors: ['Header wajib memuat "key".'] };
  const flows: ElementaryFlowCF[] = [];
  rows.forEach((r, i) => {
    const key = col(r, "key");
    const compartment = (col(r, "compartment") || "water") as "air" | "water";
    if (!key) return errors.push(`Baris ${i + 2}: key kosong`);
    flows.push({ key, label: col(r, "label") || key, compartment: compartment === "air" ? "air" : "water", factors: factorsFrom(header, r, delimiter, errors, i + 2), source: "Impor CSV (openLCA method package)" });
    return undefined;
  });
  return { flows, errors };
}
