"use client";

import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import { DirectionsList } from "@/components/report/Directions";
import { EditableText } from "@/components/report/Editable";
import { ActionsTable, formatHeadline, WorstStageBars } from "@/components/summary/Summary";
import { CONFIDENCE_LABEL } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusPill, statusFromChange } from "@/components/ui/Status";
import { term } from "@/lib/content/glossary";
import type { Project } from "@/lib/domain/types";
import type { Indicators, Results } from "@/lib/engine/calculate";
import type { ScenarioOutcome } from "@/lib/engine/scenario";
import type { Direction } from "@/lib/report/directions";
import type { NextStep } from "@/lib/store/useAppStore";
import { getLang, locale, T, tx } from "@/lib/i18n";
import { fmt, fmtDelta, fmtRp } from "@/lib/utils/format";
import { conclusion, headlines, overallConfidence, topActions, worstStage } from "@/lib/view/summary";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const MINI_GLOSSARY = ["fu", "cc", "hotspot", "mfca", "confidence"];

export function defaultNextSteps(actions: Array<{ action: string }>, today = new Date()): NextStep[] {
  const due = (days: number) => new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const steps: NextStep[] = [];
  if (actions[0]) steps.push({ action: tx(`Uji coba “${actions[0].action}” di satu tangki`, `Trial “${actions[0].action}” on one tank`), owner: tx("Kepala produksi", "Production head"), due: due(30) });
  steps.push({ action: tx("Ganti angka perkiraan dengan data meter atau faktur", "Replace estimated figures with meter or invoice data"), owner: tx("Staf EHS / data", "EHS / data staff"), due: due(14) });
  steps.push({ action: tx("Hitung dan simpan hasil bulan berikutnya sebagai pembanding", "Calculate and save next month's result as a comparison"), owner: tx("Staf EHS", "EHS staff"), due: due(45) });
  return steps.slice(0, 3);
}

/**
 * Laporan Ringkas Manajemen (PRD v1.1 §3.5): page 1 with six sections, page 2
 * with "how to read" and a five-term mini glossary. Plain words, stage names
 * instead of codes, every number from the engine.
 */
export function SummaryReport({
  project,
  results,
  indicators,
  outcomes,
  comparison,
  resultLabel,
  nextSteps,
  onNextSteps,
  watermark,
  company,
  directions = [],
}: {
  project: Project;
  results: Results;
  indicators: Indicators;
  outcomes: ScenarioOutcome[];
  comparison: { label: string; indicators: Indicators; ref: number } | null;
  resultLabel: string;
  nextSteps: NextStep[];
  onNextSteps?: (steps: NextStep[]) => void;
  watermark?: boolean;
  company?: string;
  /** Detailed improvement directions (engine scenarios); editable in the report. */
  directions?: Direction[];
}) {
  const ref = results.lci.referenceFlow;
  const heads = headlines(indicators, ref, results.lci.fuLabel, comparison);
  const worst = worstStage(project, results, heads);
  const actions = topActions(outcomes);
  const sentences = conclusion(results, worst, actions, fmtRp, (v) => `${fmt(v, 0)}%`);
  const conf = overallConfidence(project);
  const steps = nextSteps.length ? nextSteps : defaultNextSteps(actions);

  const editStep = (i: number, patch: Partial<NextStep>) => onNextSteps?.(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-6">
      <article className="report-page relative overflow-hidden rounded-xl border border-sand-200 bg-white p-6 shadow-card print:rounded-none print:border-0 print:shadow-none md:p-8">
        {watermark && <Watermark />}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-sand-200 pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-teal">{tx("Laporan Ringkas Manajemen", "Management Summary Report")}</p>
            <h1 className="mt-1 text-xl font-semibold text-navy-900">{project.name}</h1>
            <p className="text-xs text-navy-700/65">
              {company ? `${company} · ` : ""}
              {project.facility} · {tx("periode", "period")} {project.periodLabel} · {resultLabel}
            </p>
          </div>
          <Image src={`${BASE}/brand/logo-color.png`} alt="AeroSphere LCA" width={80} height={79} className="h-14 w-auto" unoptimized />
        </header>

        <Section n={1} title={tx("Kesimpulan", "Conclusion")}>
          <ul className="space-y-1 text-sm leading-relaxed text-navy-900">
            {sentences.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden>•</span>
                <EditableText id={`kesimpulan:${i}`} text={s} as="span" className="flex-1" label={`${tx("Kesimpulan", "Conclusion")} ${i + 1}`} />
              </li>
            ))}
          </ul>
        </Section>

        <Section n={2} title={tx("Angka utama", "Key figures")}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {heads.map((h) => (
              <div key={h.key} className="rounded-lg border border-sand-200 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-navy-700/60">{h.label}</p>
                <p className="num mt-1 text-xl font-semibold text-navy-900">{formatHeadline(h)}</p>
                <p className="text-[11px] text-navy-700/60">{h.unit}</p>
                {h.changePct !== null && (
                  <div className="mt-2">
                    <StatusPill status={statusFromChange(h.changePct)} />
                  </div>
                )}
                <p className="mt-1 text-[11px] text-navy-700/65">
                  {h.changePct !== null && comparison ? `${fmtDelta(h.changePct)} ${tx("dibanding", "vs")} ${comparison.label}` : tx("Belum ada hasil tersimpan untuk dibandingkan", "No saved result to compare with yet")}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section n={3} title={tx("Di mana masalahnya", "Where the problem is")}>
          {worst ? (
            <>
              <EditableText
                id="masalah"
                text={tx(
                  `Tahap **${worst.stageName}** menyumbang ${fmt(worst.sharePct, 0)}% dari ${worst.indicator} lini, sehingga menjadi prioritas pertama untuk diperbaiki.`,
                  `Stage **${worst.stageName}** contributes ${fmt(worst.sharePct, 0)}% of the line's ${worst.indicator}, making it the first priority for improvement.`,
                )}
                className="mb-3 text-sm text-navy-900"
                label={tx("Di mana masalahnya", "Where the problem is")}
              />
              <WorstStageBars project={project} results={results} worst={worst} />
            </>
          ) : (
            <p className="text-sm text-navy-700/65">{tx("Belum ada data pemakaian untuk ditampilkan.", "No usage data to show yet.")}</p>
          )}
        </Section>

        <Section n={4} title={tx("Apa yang disarankan", "What we recommend")}>
          <ActionsTable actions={actions} />
        </Section>

        {directions.length > 0 && (
          <Section n={5} title={tx("Arahan perbaikan", "Improvement directions")} wide>
            <EditableText
              id="arahan:intro"
              text={tx(
                "Arahan berikut dipilih dari hasil hitung data terkini: setiap perbaikan di pustaka dicoba oleh mesin hitung pada data lini ini, lalu yang dampaknya paling besar dijabarkan beserta alasan, langkah kerja, penanggung jawab, target, dan cara mengukurnya.",
                "The directions below were chosen from the calculation on current data: every improvement in the library is tested by the calculation engine on this line's data, and those with the largest impact are described with their reason, work steps, owner, target, and how to measure them.",
              )}
              className="mb-3 text-sm text-navy-800"
              label={tx("Pengantar arahan perbaikan", "Introduction to improvement directions")}
            />
            <DirectionsList byLang={{ [getLang()]: directions }} langs={[getLang()]} className="text-[13px] leading-relaxed text-navy-900" />
          </Section>
        )}

        <Section n={directions.length ? 6 : 5} title={tx("Seberapa yakin", "How confident")}>
          <EditableText id="yakin" text={`${tx("Tingkat keyakinan data", "Data confidence level")}: **${CONFIDENCE_LABEL[conf.level]}**. ${conf.sentence}`} className="text-sm text-navy-900" label={tx("Seberapa yakin", "How confident")} />
        </Section>

        <Section n={directions.length ? 7 : 6} title={tx("Langkah berikutnya", "Next steps")}>
          <ul className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm text-navy-900">
                <span aria-hidden>•</span>
                {onNextSteps ? (
                  <>
                    <Input className="min-w-[220px] flex-1" value={s.action} onChange={(e) => editStep(i, { action: e.target.value })} aria-label={`${tx("Langkah", "Step")} ${i + 1}`} />
                    <Input className="w-40" value={s.owner} onChange={(e) => editStep(i, { owner: e.target.value })} aria-label={tx(`Penanggung jawab langkah ${i + 1}`, `Owner of step ${i + 1}`)} />
                    <Input className="w-36" type="date" value={s.due} onChange={(e) => editStep(i, { due: e.target.value })} aria-label={tx(`Tenggat langkah ${i + 1}`, `Due date of step ${i + 1}`)} />
                    <IconButton label={tx("Hapus langkah", "Delete step")} onClick={() => onNextSteps(steps.filter((_, j) => j !== i))} className="no-print">
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </>
                ) : (
                  <span>
                    {s.action} — <b>{s.owner}</b>, {tx("paling lambat", "due by")} {new Date(s.due).toLocaleDateString(locale(), { dateStyle: "medium" })}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {onNextSteps && steps.length < 3 && (
            <button type="button" className="no-print mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-blue" onClick={() => onNextSteps([...steps, { action: "", owner: "", due: "" }])}>
              <Plus className="h-3 w-3" /> {tx("Tambah langkah", "Add step")}
            </button>
          )}
        </Section>
        <p className="mt-6 border-t border-sand-200 pt-3 text-[10px] text-navy-700/55">
          {tx(
            "Dihitung oleh mesin hitung AeroSphere, selaras ISO 14040/14044 dan ISO 14051; belum melalui critical review pihak ketiga. Hasil untuk keputusan internal, bukan klaim perbandingan publik.",
            "Calculated by the AeroSphere calculation engine, in line with ISO 14040/14044 and ISO 14051; not yet through third-party critical review. Results are for internal decisions, not public comparative claims.",
          )}
        </p>
      </article>

      <article className="report-page relative overflow-hidden rounded-xl border border-sand-200 bg-white p-6 shadow-card print:break-before-page print:rounded-none print:border-0 print:shadow-none md:p-8">
        {watermark && <Watermark />}
        <h2 className="text-base font-semibold text-navy-900">{tx("Cara membaca laporan ini", "How to read this report")}</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-navy-800">
          <T
            id={
              <>
                <li>
                  <b>Semua angka per 1 m²</b> permukaan yang dilapisi, supaya bulan dengan produksi besar tidak otomatis terlihat lebih boros.
                </li>
                <li>
                  <b>Status</b> membandingkan dengan hasil tersimpan sebelumnya: <i>Baik</i> = sama atau membaik, <i>Perlu perhatian</i> = naik sampai 10%,{" "}
                  <i>Kritis</i> = naik lebih dari 10%.
                </li>
                <li>
                  <b>Hemat per tahun</b> adalah selisih biaya proses sebelum dan sesudah perbaikan, dihitung ulang oleh mesin hitung, belum dikurangi biaya
                  investasi.
                </li>
                <li>
                  <b>Nomor hasil</b> ({resultLabel}) mengunci data dan angka, sehingga laporan bisa dicek ulang kapan saja.
                </li>
              </>
            }
            en={
              <>
                <li>
                  <b>All figures are per 1 m²</b> of plated surface, so months with high production do not automatically look more wasteful.
                </li>
                <li>
                  <b>Status</b> compares with the previous saved result: <i>Good</i> = same or better, <i>Needs attention</i> = up to 10% higher,{" "}
                  <i>Critical</i> = more than 10% higher.
                </li>
                <li>
                  <b>Saves per year</b> is the difference in process cost before and after the improvement, recalculated by the calculation engine, before
                  subtracting investment cost.
                </li>
                <li>
                  <b>Result number</b> ({resultLabel}) locks the data and figures, so the report can be re-checked at any time.
                </li>
              </>
            }
          />
        </ul>
        <h2 className="mt-6 text-base font-semibold text-navy-900">{tx("Kamus singkat", "Mini glossary")}</h2>
        <dl className="mt-3 grid gap-3 md:grid-cols-2">
          {MINI_GLOSSARY.map((k) => {
            const g = term(k)!;
            return (
              <div key={k} className="rounded-lg bg-sand-50 p-3">
                <dt className="text-sm font-semibold text-navy-900">{g.label}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-navy-800">{g.explain}</dd>
                <dd className="mt-0.5 text-[10px] text-navy-700/50">{tx("Istilah teknis", "Technical term")}: {g.term}</dd>
              </div>
            );
          })}
        </dl>
      </article>
    </div>
  );
}

function Section({ n, title, children, wide }: { n: number; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={wide ? "mt-5" : "mt-5 break-inside-avoid"}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-navy-900">
        <span className="num flex h-5 w-5 items-center justify-center rounded-full bg-navy-900 text-[10px] text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Watermark() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center" aria-hidden>
      <span className="-rotate-[28deg] select-none text-[120px] font-black uppercase tracking-widest text-navy-900/[0.06]">{tx("Contoh", "Sample")}</span>
    </div>
  );
}
