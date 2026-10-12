"use client";

import Image from "next/image";
import { Fragment } from "react";
import { DirectionsList } from "@/components/report/Directions";
import { EditableText, useReportEdits } from "@/components/report/Editable";
import { REFERENCES } from "@/lib/content/reasons";
import type { StudyRow } from "@/lib/engine/study";
import { STAGE_CODES } from "@/lib/engine/types";
import { categoryLabel, formatShareRow, INVENTORY_LABEL, L, sci, SOURCE_NAME, stageName, studyText, type Lang, type ReportLang, type StudyContext, type StudyText } from "@/lib/report/lcaStudy";
import { cn } from "@/lib/utils/cn";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Parent rows for sub-categories, as in the PROPER-style table ("terdiri dari:"). */
const PARENT: Record<string, { id: string; en: string }> = {
  "6": { id: "Potensi penurunan abiotik (fosil dan non-fosil), terdiri dari:", en: "Abiotic depletion potential (fossil and non-fossil), consisting of:" },
  "7": { id: "Potensi penurunan biotik, terdiri dari:", en: "Biotic depletion potential, consisting of:" },
  "12": { id: "Cumulative Energy Demand, terdiri dari:", en: "Cumulative Energy Demand, consisting of:" },
};

/**
 * Laporan Kajian LCA (spec §8). Section order, the two-column conclusion list
 * and the core-process impact table follow the PROPER-style study report; the
 * absolute-value table and data-quality indicator follow the style of a
 * fertiliser LCA report. Rendered as one table so that the logo header and the
 * footer repeat on every printed A4 page.
 */
export function LcaStudyReport({ ctx, lang, watermark }: { ctx: StudyContext; lang: ReportLang; watermark?: boolean }) {
  const langs: Lang[] = lang === "both" ? ["id", "en"] : [lang];
  const t = Object.fromEntries(langs.map((l) => [l, studyText(ctx, l)])) as Partial<Record<Lang, StudyText>>;
  const first = t[langs[0]!]!;
  const { model, project } = ctx;
  const edits = useReportEdits();
  const directions = ctx.directions?.[langs[0]!] ?? [];

  /** One editable text block per language (id `${lang}:${field}`); English is set in italics under Indonesian in Dwibahasa. */
  const Txt = ({ field, pick, as = "p", className }: { field: string; pick: (x: StudyText) => string; as?: "p" | "span" | "h1"; className?: string }) => (
    <>
      {langs.map((l, i) => (
        <EditableText key={l} id={`${l}:${field}`} text={pick(t[l]!)} as={as} lang={l} className={cn(className, i > 0 && "mt-1 italic text-navy-700/80")} label={field} />
      ))}
    </>
  );
  /** Fixed text (footer: result number and classification are not editable). */
  const Fixed = ({ pick }: { pick: (x: StudyText) => string }) => (
    <>
      {langs.map((l, i) => (
        <p key={l} className={cn(i > 0 && "mt-1 italic text-navy-700/80")} lang={l}>
          {pick(t[l]!)}
        </p>
      ))}
    </>
  );
  const Lbl = ({ o }: { o: { id: string; en: string } }) => (
    <>
      {langs.map((l, i) => (
        <span key={l} lang={l} className={cn(i > 0 && "block font-normal italic text-navy-700/75")}>
          {o[l]}
        </span>
      ))}
    </>
  );
  const H2 = ({ o, n }: { o: { id: string; en: string }; n?: string }) => (
    <h2 className="mb-1.5 mt-4 text-[13px] font-semibold text-navy-900">
      {n && <span className="mr-1">{n}</span>}
      <Lbl o={o} />
    </h2>
  );
  const catLabel = (r: StudyRow) => (
    <>
      {langs.map((l, i) => (
        <span key={l} lang={l} className={cn(i > 0 && "block italic text-navy-700/75")}>
          {categoryLabel(r, l)}
          {i === 0 && r.status === "screening" && <sup>2</sup>}
          {i === 0 && r.missing.length > 0 && <sup>,3</sup>}
          {i === 0 && r.status === "not_computed" && <sup>1</sup>}
        </span>
      ))}
    </>
  );
  const stageHead = (s: (typeof STAGE_CODES)[number]) => (
    <>
      {langs.map((l, i) => (
        <span key={l} lang={l} className={cn("block", i > 0 && "font-normal italic text-navy-700/75")}>
          {stageName(project, s, l)}
        </span>
      ))}
    </>
  );
  const notComputed = (span: number) => (
    <td colSpan={span} className="border border-sand-300 px-1.5 py-1 text-center italic text-navy-700/70">
      <Lbl o={L.notComputed} />
      <sup>1</sup>
    </td>
  );
  const groups = [
    ["primary", L.primary],
    ["secondary", L.secondary],
    ["energy", L.energy],
  ] as const;

  const th = "border border-sand-300 bg-navy-900 px-1.5 py-1 text-left align-bottom text-[9.5px] font-semibold text-white [&_.italic]:!text-white/75";
  const td = "border border-sand-300 px-1.5 py-0.5 align-top";

  return (
    <article className="study-report relative overflow-hidden rounded-xl border border-sand-200 bg-white text-[11px] leading-relaxed text-navy-900 shadow-card print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
      {watermark && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center print:fixed" aria-hidden>
          <span className="-rotate-[28deg] select-none text-[120px] font-black uppercase tracking-widest text-navy-900/[0.06]">{langs[0] === "en" ? "Sample" : "Contoh"}</span>
        </div>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <td className="px-6 pt-5 md:px-10 print:px-0 print:pt-0">
              <div className="flex items-center justify-between border-b border-sand-300 pb-2">
                <Image src={`${BASE}/brand/logo-color.png`} alt="AeroSphere LCA" width={80} height={79} className="h-9 w-auto" unoptimized />
                <span className="text-right text-[9px] uppercase tracking-[0.14em] text-navy-700/60">
                  <Lbl o={{ id: "Laporan Kajian LCA", en: "LCA Study Report" }} />
                </span>
              </div>
            </td>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td className="px-6 pb-5 md:px-10 print:px-0 print:pb-0">
              <div className="mt-4 border-t border-sand-300 pt-2 text-[8.5px] leading-snug text-navy-700/70">
                <Fixed pick={(x) => x.footer} />
              </div>
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td className="px-6 md:px-10 print:px-0">
              {/* ---------------------------- Halaman 1 ---------------------------- */}
              <section className="pt-3 text-center">
                {Txt({ field: "title", pick: (x) => x.title, as: "h1", className: "text-lg font-bold text-navy-900" })}
                <p className="mt-1 text-[11px] text-navy-700/70">{first.subtitle}</p>
              </section>

              <section className="mt-3">
                {Txt({ field: "opening", pick: (x) => x.opening })}
                <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
                  {first.standards.map((s, i) => (
                    <li key={s}>
                      {langs.map((l, j) => (
                        <span key={l} lang={l} className={cn(j > 0 && "block italic text-navy-700/80")}>
                          {t[l]!.standards[i]}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="break-inside-avoid">
                <H2 o={L.objective} />
                {Txt({ field: "objective", pick: (x) => x.objective, className: "text-justify" })}
              </section>

              <section className="break-inside-avoid">
                <H2 o={L.scope} />
                {Txt({ field: "scope", pick: (x) => x.scope, className: "text-justify" })}
              </section>

              <section>
                <H2 o={L.conclusion} />
                {Txt({ field: "conclusionIntro", pick: (x) => x.conclusionIntro, className: "text-justify" })}
                {(
                  [
                    ["a.", L.cradle, (x: StudyText) => x.cradleItems],
                    ["b.", L.gate, (x: StudyText) => x.gateItems],
                  ] as const
                ).map(([n, o, items]) => (
                  <div key={n} className="mt-2 break-inside-avoid pl-4">
                    <p className="font-semibold">
                      {n} <Lbl o={o} />
                    </p>
                    {items(first).length ? (
                      <ul className="mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5 pl-4">
                        {items(first).map((_, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span aria-hidden>•</span>
                            <span>
                              {langs.map((l, j) => (
                                <span key={l} lang={l} className={cn(j > 0 && "block italic text-navy-700/75")}>
                                  {items(t[l]!)[i]}
                                </span>
                              ))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="pl-4 italic text-navy-700/70">
                        <Lbl o={{ id: "Tidak ada kategori yang memenuhi syarat.", en: "No category meets the criteria." }} />
                      </p>
                    )}
                  </div>
                ))}
                <div className="mt-2 break-inside-avoid pl-4">
                  <p className="font-semibold">
                    c. <Lbl o={L.grave} />
                  </p>
                  <ul className="mt-1 pl-4">
                    <li className="flex gap-1.5">
                      <span aria-hidden>•</span>
                      <span>
                        {Txt({ field: "grave", pick: (x) => x.grave, as: "span", className: "block" })}
                      </span>
                    </li>
                  </ul>
                </div>
                <p className="mt-2 pl-4 text-[10px] text-navy-700/70">
                  <Lbl
                    o={{
                      id: `Daftar di atas hanya memuat kategori yang sudah dihitung; ${model.rows.filter((r) => r.status === "not_computed").length} kategori lain belum dihitung (lihat catatan tabel).`,
                      en: `The lists above only include calculated categories; ${model.rows.filter((r) => r.status === "not_computed").length} other categories are not calculated yet (see table notes).`,
                    }}
                  />
                </p>
                {Txt({ field: "closing", pick: (x) => x.closing, className: "mt-3 text-justify" })}
              </section>

              {/* ---------------------------- Halaman 2 ---------------------------- */}
              <section className="print:break-before-page">
                <H2 o={L.table} />
                <div className="overflow-x-auto">
                  <table className="study-table w-full min-w-[640px] table-fixed border-collapse text-[9px]">
                    <colgroup>
                      <col style={{ width: "4%" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "5.5%" }} />
                      <col style={{ width: "14%" }} />
                      {STAGE_CODES.map((s) => (
                        <col key={s} style={{ width: "9.08%" }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className={th}>
                          <Lbl o={L.no} />
                        </th>
                        <th className={th}>
                          <Lbl o={L.category} />
                        </th>
                        <th className={th}>
                          <Lbl o={L.unit} />
                        </th>
                        <th className={th}>
                          <Lbl o={L.method} />
                        </th>
                        {STAGE_CODES.map((s) => (
                          <th key={s} className={cn(th, "text-right text-[8px] leading-tight")} lang={langs[0]}>
                            {stageHead(s)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map(([g, title]) => (
                        <Fragment key={g}>
                          <tr className="break-inside-avoid bg-sand-100">
                            <td className={td} />
                            <td className={cn(td, "font-semibold")} colSpan={9}>
                              <Lbl o={title} />
                            </td>
                          </tr>
                          {model.rows
                            .filter((r) => r.group === g)
                            .map((r) => {
                              const cells = formatShareRow(r, langs[0]!);
                              const parent = PARENT[r.no.replace(/[a-z]$/, "")];
                              const sub = /[a-z]$/.test(r.no) ? r.no.slice(-1) : null;
                              return (
                                <Fragment key={r.key}>
                                  {parent && sub === "a" && (
                                    <tr className="break-inside-avoid">
                                      <td className={cn(td, "text-center")}>{r.no.slice(0, -1)}</td>
                                      <td className={cn(td, "italic")} colSpan={9}>
                                        <Lbl o={parent} />
                                      </td>
                                    </tr>
                                  )}
                                <tr className="break-inside-avoid">
                                  <td className={cn(td, "text-center")}>{sub ? "" : r.no}</td>
                                  <td className={cn(td, sub && "pl-3")}>
                                    {sub && <span className="mr-1">{sub}.</span>}
                                    {catLabel(r)}
                                  </td>
                                  <td className={cn(td, "text-center")}>%</td>
                                  <td className={cn(td, "text-[8.5px]")}>{r.method}</td>
                                  {r.status === "not_computed"
                                    ? notComputed(6)
                                    : STAGE_CODES.map((s, i) => (
                                        <td key={s} className={cn(td, "num text-right", r.topStage === s && "font-bold")}>
                                          {cells[i]}
                                        </td>
                                      ))}
                                </tr>
                                </Fragment>
                              );
                            })}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 space-y-0.5 text-[9px] leading-snug text-navy-700/80">
                  <p>
                    <Lbl
                      o={{
                        id: "Angka = persen kontribusi tiap tahap terhadap total kategori; setiap baris berjumlah 100%. Sel terbesar di setiap baris ditebalkan.",
                        en: "Figures = percentage contribution of each stage to the category total; each row adds up to 100%. The largest cell in each row is in bold.",
                      }}
                    />
                  </p>
                  {Txt({ field: "notComputedNote", pick: (x) => x.notComputedNote })}
                  {Txt({ field: "screeningNote", pick: (x) => x.screeningNote })}
                  {first.partialNote && Txt({ field: "partialNote", pick: (x) => x.partialNote ?? "" })}
                </div>
              </section>

              {/* ---------------------------- Halaman 3 ---------------------------- */}
              <section className="print:break-before-page">
                <H2 o={L.absolute} />
                <div className="overflow-x-auto">
                  <table className="study-table w-full min-w-[600px] border-collapse text-[9.5px]">
                    <thead>
                      <tr>
                        <th rowSpan={2} className={cn(th, "w-7")}>
                          <Lbl o={L.no} />
                        </th>
                        <th rowSpan={2} className={th}>
                          <Lbl o={L.category} />
                        </th>
                        <th rowSpan={2} className={th}>
                          <Lbl o={L.unit} />
                        </th>
                        <th colSpan={3} className={cn(th, "text-center")}>
                          <Lbl o={L.perM2} />
                        </th>
                        <th className={cn(th, "text-center")}>
                          <Lbl o={L.perPeriod} />
                        </th>
                      </tr>
                      <tr>
                        <th className={cn(th, "text-right")}>
                          <Lbl o={L.upstream} />
                        </th>
                        <th className={cn(th, "text-right")}>
                          <Lbl o={L.core} />
                        </th>
                        <th className={cn(th, "text-right")}>
                          <Lbl o={L.total} />
                        </th>
                        <th className={cn(th, "text-right")}>{project.periodLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.rows.map((r) => (
                        <tr key={r.key} className="break-inside-avoid">
                          <td className={cn(td, "text-center")}>{r.no}</td>
                          <td className={td}>{catLabel(r)}</td>
                          <td className={cn(td, "whitespace-nowrap")}>{r.unit}</td>
                          {r.status === "not_computed" ? (
                            notComputed(4)
                          ) : (
                            <>
                              <td className={cn(td, "num text-right")}>{sci(r.cradlePerFU, langs[0]!)}</td>
                              <td className={cn(td, "num text-right")}>{sci(r.gatePerFU, langs[0]!)}</td>
                              <td className={cn(td, "num text-right font-semibold")}>{sci(r.perFU, langs[0]!)}</td>
                              <td className={cn(td, "num text-right")}>{sci(r.total, langs[0]!)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-[9px] leading-snug text-navy-700/80">
                  {Txt({ field: "absoluteNote", pick: (x) => x.absoluteNote })}
                </div>

                <h3 className="mb-1.5 mt-4 text-[11.5px] font-semibold">
                  <Lbl o={L.inventory} />
                </h3>
                <table className="study-table w-full border-collapse text-[9.5px] md:w-2/3">
                  <thead>
                    <tr>
                      <th className={th}>
                        <Lbl o={L.quantity} />
                      </th>
                      <th className={th}>
                        <Lbl o={L.unit} />
                      </th>
                      <th className={cn(th, "text-right")}>
                        <Lbl o={L.perM2} />
                      </th>
                      <th className={cn(th, "text-right")}>
                        <Lbl o={L.perPeriod} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.inventory.map((i) => (
                      <tr key={i.key} className="break-inside-avoid">
                        <td className={td}>
                          <Lbl o={INVENTORY_LABEL[i.key]} />
                        </td>
                        <td className={td}>{i.unit}</td>
                        <td className={cn(td, "num text-right")}>{sci(i.perFU, langs[0]!)}</td>
                        <td className={cn(td, "num text-right")}>{sci(i.total, langs[0]!)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section>
                <H2 o={L.dataQuality} />
                {Txt({ field: "dataQuality", pick: (x) => x.dataQuality, className: "text-justify" })}
                <table className="study-table mt-2 border-collapse text-[9px]">
                  <thead>
                    <tr>
                      <th className={th}>
                        <Lbl o={L.source} />
                      </th>
                      {Object.keys(model.dataQuality.bySource).map((k) => (
                        <th key={k} className={cn(th, "text-right")}>
                          <Lbl o={SOURCE_NAME[k]!} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={td}>
                        <Lbl o={L.rows} />
                      </td>
                      {Object.entries(model.dataQuality.bySource).map(([k, n]) => (
                        <td key={k} className={cn(td, "num text-right")}>
                          {n}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </section>

              {/* ---------------------------- Halaman 4 ---------------------------- */}
              <section className="print:break-before-page">
                <H2 o={L.highest} />
                <h3 className="mb-1 text-[11.5px] font-semibold">
                  <Lbl o={L.perCategory} />
                </h3>
                <ol className="list-decimal space-y-2 pl-5">
                  {first.findings.map((f, i) => (
                    <li key={f.key} className="break-inside-avoid text-justify">
                      {langs.map((l, j) => (
                        <div key={l}>
                          <EditableText id={`${l}:finding:${f.key}`} text={t[l]!.findings[i]!.text} lang={l} className={cn(j > 0 && "mt-1 italic text-navy-700/80")} label={`Temuan ${i + 1}`} />
                          {j === langs.length - 1 && f.refs.length > 0 && <p className="text-[9px] text-navy-700/60">[{f.refs.join(", ")}]</p>}
                        </div>
                      ))}
                    </li>
                  ))}
                </ol>
                <h3 className="mb-1 mt-4 text-[11.5px] font-semibold">
                  <Lbl o={L.acrossCategories} />
                </h3>
                {Txt({ field: "crossCategory", pick: (x) => x.crossCategory })}

                <h3 className="mb-1 mt-4 text-[11.5px] font-semibold">
                  <Lbl o={directions.length ? L.directions : L.recommendations} />
                </h3>
                {directions.length ? (
                  <DirectionsList byLang={ctx.directions!} langs={langs} />
                ) : first.recommendations.length ? (
                  <ol className="list-decimal space-y-2 pl-5">
                    {first.recommendations.map((_, i) => (
                      <li key={i} className="break-inside-avoid text-justify">
                        {langs.map((l, j) => (
                          <EditableText key={l} id={`${l}:rec:${i}`} text={t[l]!.recommendations[i]!} lang={l} className={cn(j > 0 && "mt-1 italic text-navy-700/80")} label={`Rekomendasi ${i + 1}`} />
                        ))}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="italic text-navy-700/70">
                    <Lbl o={{ id: "Belum ada simulasi perbaikan yang menghemat biaya atau menurunkan dampak.", en: "No improvement simulation saves cost or reduces impact yet." }} />
                  </p>
                )}

                {(edits.editing || langs.some((l) => edits.text(`${l}:authorNote`, ""))) && (
                  <div className="mt-4 break-inside-avoid">
                    <h3 className="mb-1 text-[11.5px] font-semibold">
                      <Lbl o={L.authorNote} />
                    </h3>
                    {langs.map((l, j) => (
                      <EditableText key={l} id={`${l}:authorNote`} text="" lang={l} placeholder={`${L.authorNote[l]} — ${l === "en" ? "optional" : "opsional"}`} className={cn("text-justify", j > 0 && "mt-1 italic text-navy-700/80")} label={L.authorNote[l]} />
                    ))}
                  </div>
                )}

                {first.findings.some((f) => f.refs.length) && (
                  <div className="mt-4 break-inside-avoid text-[9px] leading-snug text-navy-700/80">
                    <p className="font-semibold">
                      <Lbl o={L.references} />
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                      {[...new Set(first.findings.flatMap((f) => f.refs))].sort().map((r) => (
                        <li key={r}>
                          [{r}] {REFERENCES[r]?.title}
                          {REFERENCES[r]?.url && <> — {REFERENCES[r]!.url}</>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}
