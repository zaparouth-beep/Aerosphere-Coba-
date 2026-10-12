import { NO_REASON, reasonFor } from "@/lib/content/reasons";
import type { Project, StageId } from "@/lib/domain/types";
import { coatingTypeOf } from "@/lib/engine/inventory";
import type { StudyDriver, StudyModel, StudyRow } from "@/lib/engine/study";
import type { Direction } from "@/lib/report/directions";
import { STAGE_CODES, STAGES, type DeviceRole, type StageCode } from "@/lib/engine/types";
import { plainStage, type Action } from "@/lib/view/summary";

/**
 * Text of the LCA study report (spec §8) in Indonesian or English. Every
 * number comes from the study model (engine); this file only formats and
 * phrases. Dwibahasa = both languages rendered side by side by the caller.
 */

export type Lang = "id" | "en";
export type ReportLang = Lang | "both";

export interface StudyContext {
  project: Project;
  model: StudyModel;
  actions: Action[];
  resultId: string;
  /** ISO date of the result (or today for unsaved data). */
  date: string;
  /** Detailed improvement directions per language (engine scenario outcomes). */
  directions?: Partial<Record<Lang, Direction[]>>;
}

export const INFO_CLASS = { id: "Rahasia – Tenant", en: "Confidential – Tenant" } as const;

/** Report vocabulary (§8.2). */
export const L = {
  title: { id: "Laporan Kajian Life Cycle Assessment (LCA)", en: "Life Cycle Assessment (LCA) Study Report" },
  year: { id: "Tahun", en: "" },
  objective: { id: "Tujuan Kajian LCA", en: "Objectives of the LCA Study" },
  scope: { id: "Ruang Lingkup LCA", en: "Scope of the LCA" },
  conclusion: { id: "Kesimpulan", en: "Conclusion" },
  cradle: { id: "Titik Cradle", en: "Cradle point" },
  gate: { id: "Titik Gate", en: "Gate point" },
  grave: { id: "Titik Grave", en: "Grave point" },
  table: { id: "Tabel Ringkasan Evaluasi Dampak Proses Inti", en: "Summary of Core Process Impact Evaluation" },
  primary: { id: "Dampak Primer", en: "Primary Impact" },
  secondary: { id: "Dampak Sekunder", en: "Secondary Impact" },
  energy: { id: "Dampak Pemakaian Energi", en: "Energy Use Impact" },
  no: { id: "No", en: "No" },
  category: { id: "Kategori Dampak", en: "Impact Category" },
  unit: { id: "Satuan", en: "Unit" },
  method: { id: "Metode", en: "Method" },
  absolute: { id: "Nilai Absolut Dampak per 1 m² dan per Periode", en: "Absolute Impact Values per 1 m² and per Period" },
  upstream: { id: "Hulu (cradle)", en: "Upstream (cradle)" },
  core: { id: "Proses inti (gate)", en: "Core process (gate)" },
  total: { id: "Total", en: "Total" },
  perM2: { id: "Per 1 m² permukaan dilapisi", en: "Per 1 m² of plated surface" },
  perPeriod: { id: "Per periode", en: "Per period" },
  inventory: { id: "Inventori utama", en: "Main inventory" },
  quantity: { id: "Besaran", en: "Quantity" },
  dataQuality: { id: "Indikator Kualitas Data", en: "Data Quality Indicator" },
  source: { id: "Asal data", en: "Data source" },
  rows: { id: "Jumlah data", en: "Number of data points" },
  highest: { id: "Kesimpulan Dampak Tertinggi dan Kemungkinan Alasannya", en: "Highest Impacts and Their Likely Causes" },
  perCategory: { id: "Per kategori dampak", en: "Per impact category" },
  acrossCategories: { id: "Antar kategori dampak", en: "Across impact categories" },
  recommendations: { id: "Rekomendasi", en: "Recommendations" },
  directions: { id: "Arahan Perbaikan", en: "Improvement Directions" },
  authorNote: { id: "Catatan penyusun", en: "Author's note" },
  references: { id: "Sumber alasan teknis", en: "Sources of the technical reasons" },
  notComputed: { id: "belum dihitung", en: "not calculated" },
  notAssessed: { id: "tidak dikaji", en: "not assessed" },
} as const;

export const INVENTORY_LABEL: Record<StudyModel["inventory"][number]["key"], { id: string; en: string }> = {
  electricityKWh: { id: "Listrik", en: "Electricity" },
  waterL: { id: "Air", en: "Water" },
  chemicalKg: { id: "Bahan kimia (proses, anoda, IPAL, habis pakai)", en: "Chemicals (process, anodes, WWTP, consumables)" },
  wasteB3Kg: { id: "Limbah B3", en: "Hazardous waste (B3)" },
  effluentM3: { id: "Efluen", en: "Effluent" },
};

export const SOURCE_NAME: Record<string, { id: string; en: string }> = {
  meter: { id: "Meter", en: "Meter" },
  weighing: { id: "Penimbangan", en: "Weighing" },
  lab: { id: "Uji laboratorium", en: "Laboratory test" },
  invoice: { id: "Faktur / pembelian", en: "Invoice / purchase" },
  estimate: { id: "Perhitungan perusahaan", en: "Company calculation" },
  literature: { id: "Literatur / basis data", en: "Literature / database" },
};

const ROLE: Record<DeviceRole, { id: string; en: string }> = {
  rectifier: { id: "penyearah arus", en: "rectifier" },
  heater: { id: "pemanas", en: "heater" },
  chiller: { id: "chiller", en: "chiller" },
  oven: { id: "oven", en: "oven" },
  ventilation: { id: "ventilasi", en: "ventilation" },
  pump: { id: "pompa", en: "pumps" },
  compressed_air: { id: "udara tekan", en: "compressed air" },
  di_ro: { id: "unit DI/RO", en: "DI/RO unit" },
  wwtp: { id: "IPAL", en: "WWTP" },
};

const EFFORT_EN: Record<Action["effort"], string> = { rendah: "low", sedang: "medium", tinggi: "high" };

/* -------------------------------- formatting ------------------------------- */

const locale = (lang: Lang) => (lang === "id" ? "id-ID" : "en-GB");

export function num(v: number, decimals: number, lang: Lang, fixed = false): string {
  if (!Number.isFinite(v)) return "–";
  return new Intl.NumberFormat(locale(lang), { minimumFractionDigits: fixed ? decimals : 0, maximumFractionDigits: decimals }).format(v);
}

/** Pusri-style scientific notation, e.g. 7,39E+00. */
export function sci(v: number | null, lang: Lang): string {
  if (v === null || !Number.isFinite(v)) return L.notComputed[lang];
  const [m, e] = v.toExponential(2).split("e");
  const exp = Number(e);
  const mant = lang === "id" ? m!.replace(".", ",") : m!;
  return `${mant}E${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
}

/** An amount in running text: whole numbers above 100, otherwise up to 3 significant digits. */
function amount(v: number, lang: Lang): string {
  const abs = Math.abs(v);
  if (abs >= 100) return num(v, 0, lang);
  if (abs >= 1) return num(v, 2, lang);
  return new Intl.NumberFormat(locale(lang), { maximumSignificantDigits: 3 }).format(v);
}

/** Share cells of a table row, two fixed decimals; empty for a row that is not calculated. */
export function formatShareRow(row: StudyRow, lang: Lang): string[] {
  if (row.status === "not_computed") return [];
  return STAGE_CODES.map((s) => num(row.share[s] ?? 0, 2, lang, true));
}

/** Stage with the largest share (bold cell); ties keep the first stage. */
export function boldStage(row: StudyRow): StageCode | null {
  return row.topStage;
}

function list(items: string[], lang: Lang): string {
  if (items.length <= 1) return items.join("");
  const and = lang === "id" ? "dan" : "and";
  if (items.length === 2) return `${items[0]} ${and} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${and} ${items[items.length - 1]}`;
}

export function stageName(project: Project, s: StageCode, lang: Lang): string {
  if (lang === "id") return plainStage(project, s as StageId);
  const own = project.stages.find((x) => x.id === s)?.name;
  const renamed = own && plainStage(project, s as StageId) === own && own !== STAGES[s].nameId;
  return renamed ? own : STAGES[s].nameEn;
}

export const categoryLabel = (row: Pick<StudyRow, "key" | "labelId" | "labelEn">, lang: Lang) => {
  const base = lang === "id" ? row.labelId : row.labelEn;
  return row.key === "gwp" ? `${base} (GWP)` : base;
};

function driverLabel(d: StudyDriver, stage: StageCode, lang: Lang): string {
  const roles = d.roles.map((r) => ROLE[r][lang]);
  switch (d.source) {
    case "electricity":
      return roles.length ? (lang === "id" ? `listrik ${list(roles, lang)}` : `electricity for the ${list(roles, lang)}`) : lang === "id" ? "listrik" : "electricity";
    case "chemical":
      return stage === "B" || stage === "C" ? (lang === "id" ? "bahan kimia bath" : "bath chemicals") : lang === "id" ? "bahan kimia proses" : "process chemicals";
    case "wwtp_chemical":
      return lang === "id" ? "bahan kimia IPAL" : "WWTP chemicals";
    case "water":
      return lang === "id" ? "air proses" : "process water";
    case "fuel":
      return lang === "id" ? "bahan bakar" : "fuel";
    case "waste_b3":
      return lang === "id" ? "pengolahan limbah B3" : "hazardous waste treatment";
    case "direct_air":
      return lang === "id" ? `emisi udara langsung (${d.names.join(", ")})` : `direct air emissions (${d.names.join(", ")})`;
    case "direct_water":
      return lang === "id" ? `beban efluen (${d.names.join(", ")})` : `effluent load (${d.names.join(", ")})`;
  }
}

const year = (ctx: StudyContext) => ctx.project.periodLabel.match(/\b(19|20)\d{2}\b/g)?.pop() ?? ctx.date.slice(0, 4);

const boundaryText = (ctx: StudyContext) =>
  ({ "cradle-to-gate": "cradle to gate", "gate-to-gate+upstream": "cradle to gate", "gate-to-gate": "gate to gate" })[ctx.project.scope.boundary];

const profileText = (m: StudyModel) => `${m.profileLabel} (${m.profileVersion.split("@")[1] ?? m.profileVersion})`;

function longDate(iso: string, lang: Lang): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

/* ---------------------------------- text ---------------------------------- */

export interface StudyText {
  title: string;
  subtitle: string;
  opening: string;
  standards: string[];
  objective: string;
  scope: string;
  conclusionIntro: string;
  cradleItems: string[];
  gateItems: string[];
  grave: string;
  closing: string;
  screeningNote: string;
  notComputedNote: string;
  partialNote: string | null;
  absoluteNote: string;
  dataQuality: string;
  findings: Array<{ key: string; text: string; refs: string[] }>;
  crossCategory: string;
  recommendations: string[];
  footer: string;
}

export function studyText(ctx: StudyContext, lang: Lang): StudyText {
  const { project, model } = ctx;
  const id = lang === "id";
  const lini = project.name;
  const facility = project.facility;
  const computed = model.rows.filter((r) => r.status !== "not_computed");
  const notComputed = model.rows.filter((r) => r.status === "not_computed");
  const label = (k: string) => categoryLabel(model.rows.find((r) => r.key === k)!, lang);
  const stages = STAGE_CODES.map((s) => `${s}. ${stageName(project, s, lang)}`).join(", ");
  const area = num(model.areaM2, 2, lang);
  const parts = project.production.parts > 0 ? num(project.production.parts, 0, lang) : null;

  const standards = id
    ? [
        "SNI ISO 14040:2016",
        "SNI ISO 14044:2017",
        "IAEG Aerospace LCA Framework v01 (2025) — sebagai pengganti PCR, karena PCR khusus pelapisan logam belum tersedia",
        "Peraturan Menteri Lingkungan Hidup/Badan Pengendalian Lingkungan Hidup Nomor 7 Tahun 2025 tentang Program Penilaian Peringkat Kinerja Perusahaan dalam Pengelolaan Lingkungan Hidup (PROPER)",
        "Pedoman Penyusunan Laporan Penilaian Daur Hidup (Direktorat Jenderal Pengendalian Pencemaran dan Kerusakan Lingkungan)",
      ]
    : [
        "SNI ISO 14040:2016",
        "SNI ISO 14044:2017",
        "IAEG Aerospace LCA Framework v01 (2025) — used in place of a PCR, because no PCR for metal plating is available yet",
        "Regulation of the Minister of Environment/Environmental Control Agency Number 7 of 2025 concerning the Company Performance Rating Assessment Program in Environmental Management (PROPER)",
        "Guidelines for Preparing Life Cycle Assessment Reports (Directorate General of Pollution and Environmental Damage Control)",
      ];

  const findings = computed
    .filter((r) => r.topStage)
    .map((r) => {
      const s = r.topStage!;
      const share = num(r.share[s] ?? 0, 2, lang, true);
      const top = r.drivers.slice(0, 2);
      const drivers = list(top.map((d) => `${driverLabel(d, s, lang)} (${amount(d.value, lang)} ${r.unit})`), lang);
      const coating = coatingTypeOf(project);
      const reasons = [...new Set(top.map((d) => reasonFor(coating, s, d.source, d.roles)).filter((x) => x !== null))];
      const reasonText = reasons.length ? reasons.map((x) => x[lang]).join(" ") : NO_REASON[lang];
      const head = id
        ? `${r.labelId} tertinggi di ${stageName(project, s, lang)} (${share}%).`
        : `${r.labelEn} is highest in ${stageName(project, s, lang)} (${share}%).`;
      const why = top.length ? (id ? ` Pemicunya ${drivers}.` : ` It is driven by ${drivers}.`) : "";
      return { key: r.key, text: `${head}${why} ${reasonText}`, refs: [...new Set(reasons.flatMap((x) => x.refs))] };
    });

  const recommendations = ctx.actions.slice(0, 3).map((a) => {
    const rp = `Rp${num(a.savingRpYear, 0, lang)}`;
    const cc = `${a.ccPct > 0 ? "+" : a.ccPct < 0 ? "−" : ""}${num(Math.abs(a.ccPct), 1, lang)}%`;
    return id
      ? `${a.action}. ${a.description} Perkiraan hemat ${rp} per tahun; jejak karbon ${cc}. Usaha ${a.effort}, waktu ${a.timeline}.`
      : `${a.action}. ${a.description} Estimated saving ${rp} per year; carbon footprint ${cc}. Effort: ${EFFORT_EN[a.effort]}; timeline: ${a.timeline.replace(/bulan/g, "months").replace(/minggu/g, "weeks").replace("perlu dikaji", "to be assessed")}.`;
  });

  const partial = computed.filter((r) => r.missing.length);
  const q = model.dataQuality;
  const conf = { high: { id: "tinggi", en: "high" }, medium: { id: "sedang", en: "medium" }, low: { id: "rendah", en: "low" } }[model.dataConfidence][lang];

  return {
    title: id ? `${L.title.id} Tahun ${year(ctx)}` : `${L.title.en} ${year(ctx)}`,
    subtitle: `${lini} · ${facility}`,
    opening: id
      ? `Laporan Kajian Life Cycle Assessment ${lini} di ${facility} dengan lingkup ${boundaryText(ctx)} disusun sesuai standar:`
      : `The Life Cycle Assessment Report of ${lini} at ${facility} with a scope of ${boundaryText(ctx)} was prepared in accordance with the following standards:`,
    standards,
    objective: id
      ? `Menilai dampak lingkungan (environmental footprint) lini ${lini} untuk menyusun program perbaikan ke depan dan mengidentifikasi peluang meningkatkan kinerja lingkungan agar dampak lingkungan berkurang secara konsisten.`
      : `To assess the environmental footprint of the ${lini} line in order to develop a future improvement program and identify opportunities to improve environmental performance so that environmental impacts are reduced consistently.`,
    scope: id
      ? `${lini} merupakan lini industri pelapisan logam di ${facility}. Produksi periode ${project.periodLabel} sebesar ${area} m² permukaan dilapisi${parts ? ` (${parts} part)` : ""}. Bahan baku dan input utama (cradle) berupa bahan kimia, anoda, listrik, dan air, yang diproses di lini (gate) melalui tahap ${stages}. Keluaran berupa part terlapisi, limbah B3, efluen, dan emisi udara. Tahap grave (pemakaian dan akhir masa pakai part) berada di luar lingkup kajian ini. Satuan fungsi: 1 m² permukaan dilapisi.`
      : `${lini} is a metal plating line at ${facility}. Production in the period ${project.periodLabel} was ${area} m² of plated surface${parts ? ` (${parts} parts)` : ""}. The main raw materials and inputs (cradle) are chemicals, anodes, electricity and water, processed on the line (gate) through stages ${stages}. Outputs are plated parts, hazardous waste (B3), effluent and air emissions. The grave stage (use and end of life of the parts) is outside the scope of this study. Functional unit: 1 m² of plated surface.`,
    conclusionIntro: id
      ? `Hasil kajian LCA dapat menunjukkan titik kritis penyebab dampak lingkungan, baik dari bahan yang dibeli maupun dari proses di lini, sehingga perbaikan dapat diarahkan tepat sasaran. Berdasarkan kajian LCA ${lini}, kategori dampak yang signifikan adalah sebagai berikut:`
      : `The results of the LCA identify the critical points that cause environmental impacts, both from purchased materials and from the processes on the line, so that improvements can be targeted. Based on the LCA study of ${lini}, the significant impact categories are as follows:`,
    cradleItems: model.points.cradle.map(label),
    gateItems: model.points.gate.map(label),
    grave: id ? "Tidak dikaji (di luar lingkup)" : "Not assessed (outside the scope)",
    closing: id
      ? "Kajian LCA ini dapat digunakan sebagai tahap awal menuju kajian LCA yang lebih lengkap sesuai ketentuan, untuk kemudian melakukan deklarasi produk ramah lingkungan (Environmental Product Declaration, EPD)."
      : "This LCA study can be used as a first step towards a more comprehensive LCA study in line with the applicable requirements, leading to an Environmental Product Declaration (EPD).",
    screeningNote: id
      ? `² Diisi sementara dari faktor skrining ${model.valuesVersion}; bukan hasil LCA formal dan akan diganti hasil profil ${model.profileLabel}.`
      : `² Filled provisionally from screening factors ${model.valuesVersion}; not a formal LCA result and will be replaced by the ${model.profileLabel} profile.`,
    notComputedNote: id
      ? `¹ Belum dihitung: faktor karakterisasi untuk ${notComputed.length} kategori ini belum tersedia di profil faktor ${profileText(model)}. Nilainya tidak diisi 0 atau angka perkiraan.`
      : `¹ Not calculated: characterisation factors for these ${notComputed.length} categories are not yet available in factor profile ${profileText(model)}. They are not filled with 0 or estimates.`,
    partialNote: partial.length
      ? id
        ? `³ Sebagian komponen belum punya faktor dan belum ikut dihitung (bukan 0): ${partial.map((r) => `${r.labelId} ${r.missing.length} komponen`).join("; ")}. Komponen: ${[...new Set(partial.flatMap((r) => r.missing))].join(", ")}.`
        : `³ Some components have no factor yet and are not included (not 0): ${partial.map((r) => `${r.labelEn} ${r.missing.length} components`).join("; ")}. Components: ${[...new Set(partial.flatMap((r) => r.missing))].join(", ")}.`
      : null,
    absoluteNote: id
      ? `Nilai per 1 m² dan per periode ${project.periodLabel} (${area} m²). Hulu (cradle) = produksi bahan dan energi yang dibeli; proses inti (gate) = emisi langsung di lini. Tahap grave tidak dikaji.`
      : `Values per 1 m² and per period ${project.periodLabel} (${area} m²). Upstream (cradle) = production of purchased materials and energy; core process (gate) = direct emissions at the line. The grave stage is not assessed.`,
    dataQuality: id
      ? `Data yang dikumpulkan pada tahap proses inti (gate to gate) terdiri dari ${num(q.count, 0, lang)} data; ${num(q.primaryPct, 2, lang, true)}% merupakan data primer dan ${num(q.secondaryPct, 2, lang, true)}% data sekunder. Data primer adalah data spesifik lini dari meter, penimbangan, uji laboratorium, faktur, atau perhitungan perusahaan; data sekunder berasal dari literatur atau basis data. Faktor dampak: ${model.valuesVersion} (skrining). Tingkat keyakinan data: ${conf}.`
      : `The data collected for the core process (gate to gate) comprise ${num(q.count, 0, lang)} data points; ${num(q.primaryPct, 2, lang, true)}% are primary data and ${num(q.secondaryPct, 2, lang, true)}% secondary data. Primary data are line-specific data from meters, weighing, laboratory tests, invoices or company calculations; secondary data come from literature or databases. Impact factors: ${model.valuesVersion} (screening). Data confidence: ${conf}.`,
    findings,
    crossCategory:
      model.normalization === null
        ? id
          ? "Perbandingan antar kategori belum dilakukan karena memerlukan normalisasi; peringkat di atas berlaku per kategori."
          : "Categories have not been compared with each other because this requires normalisation; the rankings above apply per category."
        : "",
    recommendations,
    footer: id
      ? `Hasil #${ctx.resultId} · Profil faktor ${profileText(model)}; nilai ${model.valuesVersion} · ${longDate(ctx.date, lang)} · ${INFO_CLASS.id} · Belum melalui tinjauan kritis pihak ketiga`
      : `Result #${ctx.resultId} · Factor profile ${profileText(model)}; values ${model.valuesVersion} · ${longDate(ctx.date, lang)} · ${INFO_CLASS.en} · Not yet critically reviewed by a third party`,
  };
}

/** Editable single-text fields of the study report; the block id is `${lang}:${field}`. */
export const STUDY_EDITABLE = [
  "title",
  "opening",
  "objective",
  "scope",
  "conclusionIntro",
  "grave",
  "closing",
  "notComputedNote",
  "screeningNote",
  "partialNote",
  "absoluteNote",
  "dataQuality",
  "crossCategory",
] as const;

/** Applies user edits (resolved per block) to the generated text, for exports. */
export function editStudyText(t: StudyText, lang: Lang, text: (id: string, original: string) => string): StudyText {
  const out: StudyText = { ...t };
  for (const f of STUDY_EDITABLE) {
    const v = t[f];
    if (typeof v === "string") (out as unknown as Record<string, string>)[f] = text(`${lang}:${f}`, v);
  }
  out.findings = t.findings.map((f) => ({ ...f, text: text(`${lang}:finding:${f.key}`, f.text) }));
  out.recommendations = t.recommendations.map((r, i) => text(`${lang}:rec:${i}`, r));
  return out;
}

/** Directions with user edits applied and left-out ones removed, for exports. */
export function editDirections(ds: Direction[], lang: Lang, text: (id: string, original: string) => string, hidden: (id: string) => boolean): Array<Direction & { note: string }> {
  return ds
    .filter((d) => !hidden(`dir:${d.id}`))
    .map((d) => {
      const f = (k: string, v: string) => text(`${lang}:dir:${d.id}:${k}`, v);
      return {
        ...d,
        title: f("title", d.title),
        why: f("why", d.why),
        steps: d.steps.map((x, j) => f(`step${j}`, x)),
        owner: f("owner", d.owner),
        target: f("target", d.target),
        measure: f("measure", d.measure),
        schedule: f("schedule", d.schedule),
        note: f("note", ""),
      };
    });
}
