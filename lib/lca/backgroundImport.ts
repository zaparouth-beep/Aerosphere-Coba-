import { CATEGORY_BASE_UNIT } from "./calculations";
import { IMPACT_IDS } from "./lcia";
import type { ImpactFactors, ImpactId, Project } from "./types";

/** Background factors are the cradle-to-gate impact per unit of an input, normally
 * calculated in openLCA (product system of an ecoinvent process → LCIA) and pasted back
 * here as CSV. */
export interface BackgroundRow {
  type: "lci" | "waste";
  name: string;
  process?: string;
  factors: ImpactFactors;
}

const COLUMN_TO_IMPACT: Record<string, ImpactId> = {
  gwp: "gwp",
  ap: "ap",
  ep: "ep",
  adp_fossil: "adpFossil",
  adpfossil: "adpFossil",
  adp_elements: "adpElements",
  adpelements: "adpElements",
};

export const TEMPLATE_HEADERS = [
  "type",
  "name",
  "base_unit",
  "process",
  "gwp",
  "ap",
  "ep",
  "adp_fossil",
  "adp_elements",
];

/** One template row per LCI input and hazardous waste, to be filled from openLCA results. */
export function buildBackgroundTemplate(
  project: Project,
): Array<Record<string, string | number>> {
  const row = (
    type: string,
    name: string,
    unit: string,
    f?: ImpactFactors,
    process?: string,
  ) => ({
    type,
    name,
    base_unit: unit,
    process: process ?? "",
    gwp: f?.gwp ?? "",
    ap: f?.ap ?? "",
    ep: f?.ep ?? "",
    adp_fossil: f?.adpFossil ?? "",
    adp_elements: f?.adpElements ?? "",
  });
  return [
    ...project.lciInputs.map((e) =>
      row(
        "lci",
        e.name,
        CATEGORY_BASE_UNIT[e.category],
        e.bgFactors,
        e.bgProcess,
      ),
    ),
    ...project.hazardousWaste.map((w) =>
      row("waste", w.wasteType, "kg", w.bgFactors, w.bgProcess),
    ),
  ];
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      cells.push(current);
      current = "";
    } else current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

export function parseBackgroundCSV(text: string): {
  rows: BackgroundRow[];
  errors: string[];
} {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const errors: string[] = [];
  const header = lines[0];
  if (!header) return { rows: [], errors: ["Data kosong."] };
  const delimiter = header.includes(";")
    ? ";"
    : header.includes("\t")
      ? "\t"
      : ",";
  const columns = splitLine(header, delimiter).map((c) =>
    c.toLowerCase().replace(/[\s-]+/g, "_"),
  );
  const idx = (name: string) => columns.indexOf(name);
  if (idx("name") < 0) errors.push('Kolom "name" tidak ditemukan pada header.');
  const impactColumns = columns
    .map((c, i) => ({ id: COLUMN_TO_IMPACT[c], i }))
    .filter((c): c is { id: ImpactId; i: number } => c.id !== undefined);
  if (impactColumns.length === 0)
    errors.push(
      "Tidak ada kolom dampak (gwp, ap, ep, adp_fossil, adp_elements).",
    );
  if (errors.length > 0) return { rows: [], errors };

  const rows: BackgroundRow[] = [];
  lines.slice(1).forEach((line, n) => {
    const cells = splitLine(line, delimiter);
    const name = cells[idx("name")] ?? "";
    if (!name) return;
    const typeCell = (cells[idx("type")] ?? "lci").toLowerCase();
    const factors: ImpactFactors = {};
    for (const { id, i } of impactColumns) {
      const raw = (cells[i] ?? "").trim();
      if (raw === "") continue;
      const value = Number(delimiter === ";" ? raw.replace(",", ".") : raw);
      if (Number.isFinite(value)) factors[id] = value;
      else
        errors.push(
          `Baris ${n + 2} ("${name}"): nilai ${id} "${raw}" bukan angka.`,
        );
    }
    const process = idx("process") >= 0 ? cells[idx("process")] : undefined;
    rows.push({
      type: typeCell === "waste" ? "waste" : "lci",
      name,
      process: process || undefined,
      factors,
    });
  });
  return { rows, errors };
}

export interface ApplyResult {
  applied: number;
  unmatched: string[];
}

/** Match rows to inventory entries by name (case-insensitive) and store the factors. */
export function applyBackgroundRows(
  project: Project,
  rows: BackgroundRow[],
): { project: Project; result: ApplyResult } {
  const norm = (s: string) => s.trim().toLowerCase();
  let applied = 0;
  const unmatched: string[] = [];
  let lciInputs = project.lciInputs;
  let hazardousWaste = project.hazardousWaste;
  for (const row of rows) {
    const key = norm(row.name);
    if (row.type === "lci" && lciInputs.some((e) => norm(e.name) === key)) {
      lciInputs = lciInputs.map((e) =>
        norm(e.name) === key
          ? {
              ...e,
              bgFactors: { ...e.bgFactors, ...row.factors },
              bgProcess: row.process ?? e.bgProcess,
            }
          : e,
      );
      applied += 1;
    } else if (
      row.type === "waste" &&
      hazardousWaste.some((w) => norm(w.wasteType) === key)
    ) {
      hazardousWaste = hazardousWaste.map((w) =>
        norm(w.wasteType) === key
          ? {
              ...w,
              bgFactors: { ...w.bgFactors, ...row.factors },
              bgProcess: row.process ?? w.bgProcess,
            }
          : w,
      );
      applied += 1;
    } else unmatched.push(row.name);
  }
  return {
    project: { ...project, lciInputs, hazardousWaste },
    result: { applied, unmatched },
  };
}

export { IMPACT_IDS };
