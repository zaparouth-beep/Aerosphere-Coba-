"use client";

import Image from "next/image";
import { Plus, Trash2 } from "lucide-react";
import { ActionsTable, formatHeadline, WorstStageBars } from "@/components/summary/Summary";
import { CONFIDENCE_LABEL } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusPill, statusFromChange } from "@/components/ui/Status";
import { term } from "@/lib/content/glossary";
import type { Project } from "@/lib/domain/types";
import type { Indicators, Results } from "@/lib/engine/calculate";
import type { ScenarioOutcome } from "@/lib/engine/scenario";
import type { NextStep } from "@/lib/store/useAppStore";
import { fmt, fmtDelta, fmtRp } from "@/lib/utils/format";
import { conclusion, headlines, overallConfidence, topActions, worstStage } from "@/lib/view/summary";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const MINI_GLOSSARY = ["fu", "cc", "hotspot", "mfca", "confidence"];

export function defaultNextSteps(actions: Array<{ action: string }>, today = new Date()): NextStep[] {
  const due = (days: number) => new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10);
  const steps: NextStep[] = [];
  if (actions[0]) steps.push({ action: `Uji coba “${actions[0].action}” di satu tangki`, owner: "Kepala produksi", due: due(30) });
  steps.push({ action: "Ganti angka perkiraan dengan data meter atau faktur", owner: "Staf EHS / data", due: due(14) });
  steps.push({ action: "Hitung dan simpan hasil bulan berikutnya sebagai pembanding", owner: "Staf EHS", due: due(45) });
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-teal">Laporan Ringkas Manajemen</p>
            <h1 className="mt-1 text-xl font-semibold text-navy-900">{project.name}</h1>
            <p className="text-xs text-navy-700/65">
              {company ? `${company} · ` : ""}
              {project.facility} · periode {project.periodLabel} · {resultLabel}
            </p>
          </div>
          <Image src={`${BASE}/brand/logo-color.png`} alt="AeroSphere LCA" width={80} height={79} className="h-14 w-auto" unoptimized />
        </header>

        <Section n={1} title="Kesimpulan">
          <ul className="space-y-1 text-sm leading-relaxed text-navy-900">
            {sentences.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>

        <Section n={2} title="Angka utama">
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
                  {h.changePct !== null && comparison ? `${fmtDelta(h.changePct)} dibanding ${comparison.label}` : "Belum ada hasil tersimpan untuk dibandingkan"}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section n={3} title="Di mana masalahnya">
          {worst ? (
            <>
              <p className="mb-3 text-sm text-navy-900">
                Tahap <b>{worst.stageName}</b> menyumbang {fmt(worst.sharePct, 0)}% dari {worst.indicator} lini.
              </p>
              <WorstStageBars project={project} results={results} worst={worst} />
            </>
          ) : (
            <p className="text-sm text-navy-700/65">Belum ada data pemakaian untuk ditampilkan.</p>
          )}
        </Section>

        <Section n={4} title="Apa yang disarankan">
          <ActionsTable actions={actions} />
        </Section>

        <Section n={5} title="Seberapa yakin">
          <p className="text-sm text-navy-900">
            Tingkat keyakinan data: <b>{CONFIDENCE_LABEL[conf.level]}</b>. {conf.sentence}
          </p>
        </Section>

        <Section n={6} title="Langkah berikutnya">
          <ul className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm text-navy-900">
                <span aria-hidden>•</span>
                {onNextSteps ? (
                  <>
                    <Input className="min-w-[220px] flex-1" value={s.action} onChange={(e) => editStep(i, { action: e.target.value })} aria-label={`Langkah ${i + 1}`} />
                    <Input className="w-40" value={s.owner} onChange={(e) => editStep(i, { owner: e.target.value })} aria-label={`Penanggung jawab langkah ${i + 1}`} />
                    <Input className="w-36" type="date" value={s.due} onChange={(e) => editStep(i, { due: e.target.value })} aria-label={`Tenggat langkah ${i + 1}`} />
                    <IconButton label="Hapus langkah" onClick={() => onNextSteps(steps.filter((_, j) => j !== i))} className="no-print">
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </>
                ) : (
                  <span>
                    {s.action} — <b>{s.owner}</b>, paling lambat {new Date(s.due).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {onNextSteps && steps.length < 3 && (
            <button type="button" className="no-print mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-blue" onClick={() => onNextSteps([...steps, { action: "", owner: "", due: "" }])}>
              <Plus className="h-3 w-3" /> Tambah langkah
            </button>
          )}
        </Section>
        <p className="mt-6 border-t border-sand-200 pt-3 text-[10px] text-navy-700/55">
          Dihitung oleh mesin hitung AeroSphere, selaras ISO 14040/14044 dan ISO 14051; belum melalui critical review pihak ketiga. Hasil untuk keputusan internal,
          bukan klaim perbandingan publik.
        </p>
      </article>

      <article className="report-page relative overflow-hidden rounded-xl border border-sand-200 bg-white p-6 shadow-card print:break-before-page print:rounded-none print:border-0 print:shadow-none md:p-8">
        {watermark && <Watermark />}
        <h2 className="text-base font-semibold text-navy-900">Cara membaca laporan ini</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-navy-800">
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
        </ul>
        <h2 className="mt-6 text-base font-semibold text-navy-900">Kamus singkat</h2>
        <dl className="mt-3 grid gap-3 md:grid-cols-2">
          {MINI_GLOSSARY.map((k) => {
            const g = term(k)!;
            return (
              <div key={k} className="rounded-lg bg-sand-50 p-3">
                <dt className="text-sm font-semibold text-navy-900">{g.label}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-navy-800">{g.explain}</dd>
                <dd className="mt-0.5 text-[10px] text-navy-700/50">Istilah teknis: {g.term}</dd>
              </div>
            );
          })}
        </dl>
      </article>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
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
      <span className="-rotate-[28deg] select-none text-[120px] font-black uppercase tracking-widest text-navy-900/[0.06]">Contoh</span>
    </div>
  );
}
