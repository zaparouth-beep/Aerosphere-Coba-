import { tx } from "@/lib/i18n";
import type { ExtractedDoc } from "./docExtract";
import { guessLocale, normaliseUnit, parseNumber, type ReadRow } from "./smartReader";

/**
 * Client for the AI document reader (Netlify Function /api/ai-import). The
 * document is sent in small chunks (each request stays short) and every number
 * the AI returns is checked against the numbers written in the document; a
 * number that cannot be found is never applied automatically.
 */

export const AI_ENDPOINT = "/api/ai-import";
const CHUNK_CHARS = 12_000;
const PARALLEL = 3;

export interface AiRow {
  kind: ReadRow["kind"];
  category: ReadRow["category"] | null;
  name: string;
  quantity: number;
  unit: string;
  stage: NonNullable<ReadRow["stage"]> | null;
  production_field: ReadRow["productionField"] | null;
  impact_key: string | null;
  source_text: string;
  confidence: ReadRow["confidence"];
}

/** Set in netlify.toml; other hosts (GitHub Pages, local static server) have no function to call. */
export const AI_ENABLED_BUILD = process.env.NEXT_PUBLIC_AI_IMPORT === "1";

export async function aiAvailable(): Promise<boolean> {
  if (!AI_ENABLED_BUILD) return false;
  try {
    const res = await fetch(AI_ENDPOINT, { method: "GET" });
    if (!res.ok) return false;
    const body = (await res.json()) as { available?: boolean };
    return body.available === true;
  } catch {
    return false;
  }
}

/** Splits the document into chunks of whole rows (tables stay together when they fit). */
export function chunkDocument(doc: ExtractedDoc, max = CHUNK_CHARS): Array<{ name: string; text: string }> {
  const chunks: Array<{ name: string; text: string }> = [];
  let cur = { name: "", text: "" };
  const flush = () => {
    if (cur.text) chunks.push(cur);
    cur = { name: "", text: "" };
  };
  for (const t of doc.tables) {
    const lines = [`# ${t.name}`, ...t.rows.map((r) => r.join(" | "))];
    for (const line of lines) {
      if (cur.text.length + line.length + 1 > max) flush();
      if (!cur.name) cur.name = t.name;
      cur.text += `${line}\n`;
    }
  }
  flush();
  return chunks;
}

/** Every number written in the document, parsed with the document's locale. */
export function documentNumbers(doc: Pick<ExtractedDoc, "text">): number[] {
  const locale = guessLocale(doc);
  const out: number[] = [];
  for (const m of doc.text.matchAll(/[-+]?\d[\d.,]*(?:[eE][-+]?\d+)?/g)) {
    const n = parseNumber(m[0], locale);
    if (n !== null) out.push(n);
    const alt = parseNumber(m[0], locale === "id" ? "en" : "id");
    if (alt !== null && alt !== n) out.push(alt);
  }
  return out;
}

const same = (a: number, b: number) => a === b || Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));

/** Turns AI rows into review rows; numbers not found in the document are marked and left out. */
export function fromAi(rows: AiRow[], doc: ExtractedDoc, chunkName: string, startId: number): ReadRow[] {
  const numbers = documentNumbers(doc);
  return rows
    .filter((r) => r.kind !== "ignore")
    .map((r, i) => {
      const found = numbers.some((n) => same(n, r.quantity));
      const notes = [tx("Dibaca AI", "Read by AI")];
      if (!found) notes.push(tx("Angka tidak ditemukan di dokumen — periksa sebelum dipakai", "Number not found in the document — check before using"));
      const confidence: ReadRow["confidence"] = !found ? "low" : r.confidence;
      return {
        id: `ai${startId + i}`,
        table: chunkName,
        rowIndex: 0,
        raw: [r.source_text],
        kind: r.kind,
        category: r.category ?? undefined,
        productionField: r.production_field ?? undefined,
        impactKey: r.impact_key ?? undefined,
        name: r.name,
        quantity: r.quantity,
        unit: r.kind === "impact" ? r.unit : normaliseUnit(r.unit),
        stage: r.stage ?? (r.kind === "effluent" ? "F" : null),
        basis: "period",
        sourceType: "calculated",
        confidence,
        notes,
        include: found && confidence !== "low",
        origin: "ai",
      } satisfies ReadRow;
    });
}

export interface AiProgress {
  done: number;
  total: number;
}

/** Runs the AI reader over the whole document. Throws with a readable message when the service fails. */
export async function readWithAi(doc: ExtractedDoc, onProgress?: (p: AiProgress) => void): Promise<ReadRow[]> {
  const chunks = chunkDocument(doc);
  const results: ReadRow[][] = new Array(chunks.length);
  let next = 0;
  let done = 0;
  onProgress?.({ done, total: chunks.length });
  const worker = async () => {
    while (next < chunks.length) {
      const i = next++;
      const c = chunks[i]!;
      const res = await fetch(AI_ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileName: doc.fileName, name: c.name, text: c.text }) });
      const body = (await res.json().catch(() => ({}))) as { rows?: AiRow[]; error?: string };
      if (!res.ok || !body.rows) throw new Error(body.error ?? tx(`Layanan AI tidak menjawab (${res.status}).`, `The AI service did not respond (${res.status}).`));
      results[i] = fromAi(body.rows, doc, c.name, i * 1000);
      onProgress?.({ done: ++done, total: chunks.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, chunks.length) }, worker));
  return results.flat();
}
