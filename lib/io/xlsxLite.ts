/**
 * Minimal .xlsx reader (cell values only) for workbooks exceljs cannot open:
 * files written by ERPs, the OpenXML SDK or "Strict Open XML" use namespace
 * prefixes (`<x:workbook>`) or other variations that exceljs rejects with
 * "Cannot read properties of undefined (reading 'sheets')". Tags are matched
 * by local name, so any prefix works. Formulas are never evaluated: only the
 * cached value is read.
 */

import type JSZipType from "jszip";
import { tx } from "@/lib/i18n";

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

const P = "(?:[\\w.-]+:)?";
/** All elements `<prefix:tag ...>...</prefix:tag>` (or self-closing) with their attributes and inner XML. */
function elements(xml: string, tag: string): Array<{ attrs: Record<string, string>; inner: string }> {
  const re = new RegExp(`<${P}${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${P}${tag}>)`, "g");
  const out: Array<{ attrs: Record<string, string>; inner: string }> = [];
  for (const m of xml.matchAll(re)) {
    const attrs: Record<string, string> = {};
    for (const a of (m[1] ?? "").matchAll(/([\w.:-]+)\s*=\s*"([^"]*)"/g)) {
      const key = a[1]!;
      attrs[key] = decode(a[2]!);
      attrs[key.replace(/^[\w.-]+:/, "")] ??= attrs[key]!;
    }
    out.push({ attrs, inner: m[2] ?? "" });
  }
  return out;
}

/** Text of all <t> elements (rich text runs joined); phonetic runs (<rPh>) are skipped. */
const textOf = (xml: string) =>
  elements(xml.replace(new RegExp(`<${P}rPh\\b[\\s\\S]*?</${P}rPh>`, "g"), ""), "t")
    .map((t) => decode(t.inner))
    .join("");

const colIndex = (ref: string) => {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const resolve = (base: string, target: string) => {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
};

export async function readXlsxLite(buf: ArrayBuffer): Promise<Array<{ name: string; rows: string[][] }>> {
  const mod = await import("jszip");
  const JSZip = ((mod as unknown as { default?: typeof JSZipType }).default ?? mod) as typeof JSZipType;
  const zip = await JSZip.loadAsync(buf);
  const files = new Map(Object.keys(zip.files).map((k) => [k.replace(/^\//, "").toLowerCase(), k]));
  const read = async (path: string) => {
    const key = files.get(path.toLowerCase());
    return key ? zip.file(key)!.async("string") : null;
  };

  const rootRels = (await read("_rels/.rels")) ?? "";
  const wbTarget = elements(rootRels, "Relationship").find((r) => /officeDocument$/.test(r.attrs.Type ?? ""))?.attrs.Target;
  const wbPath = wbTarget ? resolve("", wbTarget) : "xl/workbook.xml";
  const wbXml = await read(wbPath);
  if (!wbXml) throw new Error(tx("File ini bukan workbook Excel yang valid.", "This file is not a valid Excel workbook."));
  const relsPath = resolve(wbPath, `_rels/${wbPath.split("/").pop()}.rels`);
  const rels = new Map(elements((await read(relsPath)) ?? "", "Relationship").map((r) => [r.attrs.Id, r.attrs]));

  const sharedTarget = [...rels.values()].find((r) => /sharedStrings$/.test(r?.Type ?? ""))?.Target;
  const sharedXml = (await read(sharedTarget ? resolve(wbPath, sharedTarget) : "xl/sharedStrings.xml")) ?? "";
  const shared = elements(sharedXml, "si").map((si) => textOf(si.inner));

  const sheets: Array<{ name: string; rows: string[][] }> = [];
  for (const [i, s] of elements(wbXml, "sheet").entries()) {
    const target = rels.get(s.attrs.id ?? "")?.Target;
    const xml = await read(target ? resolve(wbPath, target) : `xl/worksheets/sheet${i + 1}.xml`);
    if (!xml) continue;
    const rows: string[][] = [];
    for (const row of elements(xml, "row")) {
      const cells: string[] = [];
      let next = 0;
      for (const c of elements(row.inner, "c")) {
        const j = c.attrs.r ? colIndex(c.attrs.r) : next;
        next = j + 1;
        const v = elements(c.inner, "v")[0]?.inner;
        const type = c.attrs.t;
        let text = "";
        if (type === "s") text = shared[Number(v)] ?? "";
        else if (type === "inlineStr") text = textOf(c.inner);
        else if (type === "b") text = v === "1" ? "TRUE" : v === "0" ? "FALSE" : "";
        else if (type === "e") text = "";
        else if (v !== undefined) text = decode(v);
        while (cells.length < j) cells.push("");
        cells[j] = text.replace(/\s+/g, " ").trim();
      }
      if (cells.some((c) => c !== "")) rows.push(cells);
    }
    sheets.push({ name: s.attrs.name ?? `Sheet${i + 1}`, rows });
  }
  return sheets;
}
