import type { Workbook, Worksheet } from "exceljs";
import { SCREENING_V1 } from "@/lib/engine/factors";
import { toProjectInput } from "@/lib/engine/inventory";
import { STAGE_CODES } from "@/lib/engine/types";
import { categoryLabel, editDirections, editStudyText, INFO_CLASS, INVENTORY_LABEL, L, SOURCE_NAME, stageName, studyText, type Lang, type ReportLang, type StudyContext } from "@/lib/report/lcaStudy";
import { sanitizeCell } from "@/lib/utils/export";

/** Excel export of the LCA study report (spec §8.3). Values are the engine's, unrounded except the % table (2 decimals). */
export const STUDY_SHEETS = ["Laporan", "Tabel_Dampak_%", "Nilai_Absolut", "Kesimpulan", "Data_Input", "Faktor"] as const;

const langs = (lang: ReportLang): Lang[] => (lang === "both" ? ["id", "en"] : [lang]);
const tx = (o: { id: string; en: string }, lang: ReportLang) => (lang === "both" ? `${o.id} / ${o.en}` : o[lang]);

function sheet(wb: Workbook, name: string, header: unknown[], widths: number[]): Worksheet {
  const ws = wb.addWorksheet(name);
  ws.addRow(header.map(sanitizeCell));
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1660" } };
  h.alignment = { vertical: "middle", wrapText: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  return ws;
}

const add = (ws: Worksheet, row: unknown[]) => ws.addRow(row.map(sanitizeCell));

export function studyFileName(ctx: StudyContext, ext: "xlsx" | "pdf", lang: ReportLang): string {
  const slug = ctx.project.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return `Kajian-LCA_${slug}_${ctx.resultId}_${lang.toUpperCase()}_Rahasia-Tenant.${ext}`;
}

export interface StudyEdits {
  /** Text to use for a block (the user's edit or the original). */
  text: (id: string, original: string) => string;
  hidden: (id: string) => boolean;
}

const NO_EDITS: StudyEdits = { text: (_id, original) => original, hidden: () => false };

export async function buildStudyWorkbook(ctx: StudyContext, lang: ReportLang, edits: StudyEdits = NO_EDITS): Promise<Blob> {
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "AeroSphere LCA";
  const ls = langs(lang);
  const texts = ls.map((l) => editStudyText(studyText(ctx, l), l, edits.text));
  const dirs = ls.map((l) => editDirections(ctx.directions?.[l] ?? [], l, edits.text, edits.hidden));
  const { model, project } = ctx;
  const stageHeads = STAGE_CODES.map((s) => (lang === "both" ? `${s}. ${stageName(project, s, "id")} / ${stageName(project, s, "en")}` : `${s}. ${stageName(project, s, lang)}`));

  // Laporan: the report text, one column per language.
  const rep = sheet(wb, STUDY_SHEETS[0], [tx({ id: "Bagian", en: "Section" }, lang), ...ls.map((l) => (l === "id" ? "Bahasa Indonesia" : "English"))], [28, ...ls.map(() => 100)]);
  const line = (section: { id: string; en: string }, pick: (t: (typeof texts)[number]) => string) => {
    const r = add(rep, [tx(section, lang), ...texts.map(pick)]);
    r.alignment = { wrapText: true, vertical: "top" };
  };
  line({ id: "Judul", en: "Title" }, (t) => t.title);
  line({ id: "Lini · fasilitas", en: "Line · facility" }, (t) => t.subtitle);
  line({ id: "Pembuka", en: "Opening" }, (t) => t.opening);
  line({ id: "Standar", en: "Standards" }, (t) => t.standards.map((s) => `• ${s}`).join("\n"));
  line(L.objective, (t) => t.objective);
  line(L.scope, (t) => t.scope);
  line(L.conclusion, (t) => t.conclusionIntro);
  line({ id: `a. ${L.cradle.id}`, en: `a. ${L.cradle.en}` }, (t) => t.cradleItems.map((s) => `• ${s}`).join("\n"));
  line({ id: `b. ${L.gate.id}`, en: `b. ${L.gate.en}` }, (t) => t.gateItems.map((s) => `• ${s}`).join("\n"));
  line({ id: `c. ${L.grave.id}`, en: `c. ${L.grave.en}` }, (t) => t.grave);
  line({ id: "Penutup", en: "Closing" }, (t) => t.closing);
  line({ id: "Catatan kaki", en: "Footnotes" }, (t) => [t.notComputedNote, t.screeningNote, t.partialNote].filter(Boolean).join("\n"));
  add(rep, [tx({ id: "Kelas informasi", en: "Information class" }, lang), ...ls.map((l) => INFO_CLASS[l])]);
  line({ id: "Kaki halaman", en: "Footer" }, (t) => t.footer);

  // Tabel_Dampak_%: same layout as the report table.
  const pct = sheet(
    wb,
    STUDY_SHEETS[1],
    [tx(L.no, lang), tx(L.category, lang), tx(L.unit, lang), tx(L.method, lang), ...stageHeads, "Status"],
    [6, 40, 9, 30, ...STAGE_CODES.map(() => 16), 22],
  );
  const groups = [
    ["primary", L.primary],
    ["secondary", L.secondary],
    ["energy", L.energy],
  ] as const;
  for (const [g, title] of groups) {
    const gr = add(pct, ["", tx(title, lang)]);
    gr.font = { bold: true };
    for (const r of model.rows.filter((x) => x.group === g)) {
      const label = lang === "both" ? `${categoryLabel(r, "id")} / ${categoryLabel(r, "en")}` : categoryLabel(r, lang);
      const cells =
        r.status === "not_computed" ? STAGE_CODES.map(() => tx(L.notComputed, lang)) : STAGE_CODES.map((s) => Math.round((r.share[s] ?? 0) * 100) / 100);
      const status = r.status === "not_computed" ? tx(L.notComputed, lang) : tx({ id: "skrining", en: "screening" }, lang);
      const row = add(pct, [r.no, label, "%", r.method, ...cells, status]);
      STAGE_CODES.forEach((s, i) => {
        const c = row.getCell(5 + i);
        if (typeof c.value === "number") c.numFmt = "0.00";
        if (r.topStage === s) c.font = { bold: true };
      });
    }
  }

  // Nilai_Absolut: per 1 m² (cradle / gate / total) and per period, plus the main inventory.
  const abs = sheet(
    wb,
    STUDY_SHEETS[2],
    [
      tx(L.no, lang),
      tx(L.category, lang),
      tx(L.unit, lang),
      `${tx(L.upstream, lang)} — m²`,
      `${tx(L.core, lang)} — m²`,
      `${tx(L.total, lang)} — m²`,
      `${tx(L.total, lang)} — ${tx(L.perPeriod, lang)} (${project.periodLabel})`,
      "Status",
    ],
    [6, 40, 14, 18, 18, 18, 22, 22],
  );
  for (const r of model.rows) {
    const label = lang === "both" ? `${categoryLabel(r, "id")} / ${categoryLabel(r, "en")}` : categoryLabel(r, lang);
    const v = (x: number | null) => (x === null ? tx(L.notComputed, lang) : x);
    add(abs, [r.no, label, r.unit, v(r.cradlePerFU), v(r.gatePerFU), v(r.perFU), v(r.total), r.status === "not_computed" ? tx(L.notComputed, lang) : tx({ id: "skrining", en: "screening" }, lang)]);
  }
  add(abs, []);
  add(abs, ["", tx(L.inventory, lang), tx(L.unit, lang), "", "", `${tx(L.total, lang)} — m²`, `${tx(L.total, lang)} — ${tx(L.perPeriod, lang)}`]).font = { bold: true };
  for (const i of model.inventory) {
    add(abs, ["", tx(INVENTORY_LABEL[i.key], lang), i.unit, "", "", i.perFU, i.total]);
  }

  // Kesimpulan: points, per-category findings, cross-category sentence, recommendations.
  const con = sheet(wb, STUDY_SHEETS[3], [tx({ id: "Bagian", en: "Section" }, lang), ...ls.map((l) => (l === "id" ? "Bahasa Indonesia" : "English"))], [28, ...ls.map(() => 100)]);
  const cline = (section: string, values: string[]) => {
    const r = add(con, [section, ...values]);
    r.alignment = { wrapText: true, vertical: "top" };
  };
  cline(tx(L.cradle, lang), texts.map((t) => t.cradleItems.join("; ")));
  cline(tx(L.gate, lang), texts.map((t) => t.gateItems.join("; ")));
  cline(tx(L.grave, lang), texts.map((t) => t.grave));
  texts[0]!.findings.forEach((f, i) => cline(`${tx(L.perCategory, lang)} — ${f.key}`, texts.map((t) => t.findings[i]!.text)));
  cline(tx(L.acrossCategories, lang), texts.map((t) => t.crossCategory));
  if (dirs[0]!.length) {
    // Arahan perbaikan: one row per field so the work plan reads top to bottom.
    dirs[0]!.forEach((d, i) => {
      const head = `${tx(L.directions, lang)} ${i + 1}`;
      const at = (pick: (x: (typeof dirs)[number][number]) => string) => dirs.map((ds) => pick(ds[i]!));
      cline(head, at((x) => x.title));
      cline(`${head} — ${tx({ id: "Mengapa", en: "Why" }, lang)}`, at((x) => x.why));
      cline(`${head} — ${tx({ id: "Langkah kerja", en: "Work steps" }, lang)}`, at((x) => x.steps.map((st, j) => `${j + 1}. ${st}`).join("\n")));
      cline(`${head} — ${tx({ id: "Penanggung jawab", en: "Responsible" }, lang)}`, at((x) => x.owner));
      cline(`${head} — ${tx({ id: "Target", en: "Target" }, lang)}`, at((x) => x.target));
      cline(`${head} — ${tx({ id: "Cara mengukur", en: "How measured" }, lang)}`, at((x) => x.measure));
      cline(`${head} — ${tx({ id: "Waktu", en: "Timing" }, lang)}`, at((x) => x.schedule));
      if (d.basis.length) cline(`${head} — ${tx({ id: "Dasar perhitungan", en: "Calculation basis" }, lang)}`, at((x) => x.basis.join("\n")));
      if (dirs.some((ds) => ds[i]!.note)) cline(`${head} — ${tx({ id: "Catatan", en: "Note" }, lang)}`, at((x) => x.note));
    });
  } else texts[0]!.recommendations.forEach((_, i) => cline(`${tx(L.recommendations, lang)} ${i + 1}`, texts.map((t) => t.recommendations[i]!)));
  const notes = ls.map((l) => edits.text(`${l}:authorNote`, ""));
  if (notes.some(Boolean)) cline(tx(L.authorNote, lang), notes);
  cline(tx(L.dataQuality, lang), texts.map((t) => t.dataQuality));

  // Data_Input: the inventory the engine read.
  const input = toProjectInput(project);
  const di = sheet(wb, STUDY_SHEETS[4], ["ID", tx({ id: "Tahap", en: "Stage" }, lang), tx({ id: "Kategori", en: "Category" }, lang), tx({ id: "Nama", en: "Name" }, lang), "flowKey", tx(L.quantity, lang), tx(L.unit, lang), tx(L.source, lang)], [14, 10, 16, 36, 18, 14, 10, 24]);
  for (const c of input.components) add(di, [c.id, c.stage, c.category, c.name, c.flowKey, c.quantity, c.unit, tx(SOURCE_NAME[c.source]!, lang)]);
  add(di, []);
  add(di, ["", "", "", tx({ id: "Luas dilapisi (m²)", en: "Plated area (m²)" }, lang), "", input.areaPlatedM2, "m²"]);

  // Faktor: factor profile used for the values, and the profile of the table.
  const fa = sheet(wb, STUDY_SHEETS[5], ["flowKey", tx(L.unit, lang), ...SCREENING_V1.categories.map((c) => `${c.key} (${c.unit})`), "Dataset", "Status"], [18, 8, 14, 14, 14, 14, 50, 12]);
  add(fa, [tx({ id: "Versi nilai", en: "Values version" }, lang), model.valuesVersion]).font = { bold: true };
  if (model.valuesVersion !== SCREENING_V1.version) add(fa, [tx({ id: "Catatan", en: "Note" }, lang), tx({ id: "Faktor GWP listrik diganti faktor grid proyek (lihat akhiran +grid).", en: "Electricity GWP factor replaced by the project grid factor (see the +grid suffix)." }, lang)]);
  for (const [key, f] of Object.entries(SCREENING_V1.flows)) {
    add(fa, [key, f.unit, ...SCREENING_V1.categories.map((c) => f.factors[c.key] ?? tx(L.notComputed, lang)), f.dataset, f.status]);
  }
  add(fa, []);
  add(fa, [tx({ id: "Profil tabel", en: "Table profile" }, lang), `${model.profileLabel} (${model.profileVersion.split("@")[1] ?? ""})`]).font = { bold: true };
  for (const r of model.rows) add(fa, [r.no, r.unit, r.labelId, r.labelEn, r.method, "", "", r.status === "not_computed" ? tx(L.notComputed, lang) : tx({ id: "skrining", en: "screening" }, lang)]);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
