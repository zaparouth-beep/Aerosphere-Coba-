"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Lightbulb } from "lucide-react";
import { CATEGORICAL, STAGE_COLOR } from "@/components/charts/palette";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { Project } from "@/lib/domain/types";
import type { LifeCycleRow, WasteItemShare } from "@/lib/engine/flow";
import type { TitikBorosRow } from "@/lib/engine/titikBoros";
import type { RunResult } from "@/lib/engine/types";
import { STAGE_CODES } from "@/lib/engine/types";
import { cn } from "@/lib/utils/cn";
import { fmt3, fmtPct, fmtValue, INDICATOR, stageName } from "@/lib/view/titikBoros";

/**
 * Hasil overview: one card per topic (information, carbon, wasted value, flow,
 * life cycle, stages) with a total in the middle of each donut, a hint at the
 * bottom of each card, and a contents list on the right.
 */

export function Donut({ parts, center, sub, size = 168 }: { parts: Array<{ label: string; value: number; color: string }>; center: string; sub?: string; size?: number }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const r = 15.9155;
  let offset = 25;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 42 42" className="h-full w-full -rotate-0" role="img" aria-label={`${center}${sub ? ` ${sub}` : ""}`}>
        <circle cx="21" cy="21" r={r} fill="none" stroke="#EEE9DD" strokeWidth="6" />
        {total > 0 &&
          parts.map((p) => {
            const pct = (p.value / total) * 100;
            const el = <circle key={p.label} cx="21" cy="21" r={r} fill="none" stroke={p.color} strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />;
            offset -= pct;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="num text-base font-semibold leading-tight text-navy-900">{center}</span>
        {sub && <span className="max-w-[90px] text-[10px] leading-tight text-navy-700/65">{sub}</span>}
      </div>
    </div>
  );
}

export function Tip({ children, href, cta }: { children: React.ReactNode; href: string; cta: string }) {
  return (
    <div className="mt-4 flex gap-2 rounded-lg bg-sand-50 p-2.5 text-xs text-navy-800">
      <Lightbulb className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden />
      <p>
        {children}{" "}
        <Link href={href} className="inline-flex items-center gap-0.5 font-medium text-brand-blue hover:underline">
          {cta} <ArrowRight className="h-3 w-3" />
        </Link>
      </p>
    </div>
  );
}

export function InfoCard({ project, run, resultLabel }: { project: Project; run: RunResult; resultLabel: string }) {
  const conf = { high: "Tinggi", medium: "Sedang", low: "Rendah" }[run.dataConfidence];
  const rows: Array<[string, string]> = [
    ["Lini", project.name],
    ["Fasilitas", project.facility],
    ["Periode", project.periodLabel],
    ["Permukaan dilapisi", `${fmt3(run.areaPlatedM2)} m²${project.production.parts > 0 ? ` (${project.production.parts.toLocaleString("id-ID")} part)` : ""}`],
    ["Nomor hasil", resultLabel],
    ["Faktor dampak", `skrining (${run.factorVersion})`],
    ["Keyakinan data", conf],
  ];
  return (
    <Card id="informasi" className="scroll-mt-36">
      <CardHeader title="Informasi" />
      <CardBody>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-sand-100 pb-1.5">
              <dt className="text-navy-700/65">{k}</dt>
              <dd className="text-right font-medium text-navy-900">{v}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

export function CarbonCard({ project, row }: { project: Project; row: TitikBorosRow }) {
  const parts = STAGE_CODES.filter((s) => row.perStage[s] > 0).map((s) => ({ s, label: stageName(project, s), value: row.perStage[s], color: STAGE_COLOR[s] }));
  return (
    <Card id="jejak-karbon" className="h-full scroll-mt-36">
      <CardHeader title="Jejak karbon" subtitle="Per 1 m² permukaan dilapisi, dibagi per tahap proses" />
      <CardBody>
        <div className="flex flex-col items-center gap-4">
          <Donut parts={parts} center={fmt3(row.totalPerFU)} sub={`${row.unit.replace(/ eq$/, "e")} per m²`} />
          <Legend items={parts.map((p) => ({ label: p.label, color: p.color, value: fmtValue(p.value, row), pct: row.share[p.s] }))} />
        </div>
        <Tip href="/titik-boros" cta="Cara menurunkan jejak karbon">
          {row.topStage ? `${stageName(project, row.topStage)} menyumbang ${fmtPct(row.share[row.topStage])}.` : ""}
        </Tip>
      </CardBody>
    </Card>
  );
}

const WASTE_LABEL: Record<WasteItemShare["key"], string> = {
  processChemicalRp: "Bahan kimia proses",
  wwtpChemicalRp: "Bahan kimia IPAL",
  consumableRp: "Bahan habis pakai",
  b3TreatmentRp: "Pengolahan limbah B3",
  b3TransportRp: "Transport limbah B3",
  waterRp: "Air",
};

export function WasteCard({ run, items, totalPerFU }: { run: RunResult; items: WasteItemShare[]; totalPerFU: number }) {
  const parts = items.map((it, i) => ({ label: WASTE_LABEL[it.key], value: it.valuePerFU, color: CATEGORICAL[i % CATEGORICAL.length]! }));
  return (
    <Card id="nilai-terbuang" className="h-full scroll-mt-36">
      <CardHeader title="Nilai yang terbuang" subtitle={`${fmtPct(run.waste.pctOfCost)} dari biaya proses, per 1 m²`} />
      <CardBody>
        <div className="flex flex-col items-center gap-4">
          <Donut parts={parts} center={`Rp${fmt3(totalPerFU)}`} sub="terbuang per m²" />
          <Legend items={items.map((it, i) => ({ label: WASTE_LABEL[it.key], color: parts[i]!.color, value: `Rp${fmt3(it.valuePerFU)}`, pct: it.sharePct }))} />
        </div>
        <Tip href="/simulasi" cta="Kurangi biaya">
          Bahan kimia, air, dan limbah yang terbuang bisa ditekan lewat perbaikan proses.
        </Tip>
        <p className="mt-2 text-[11px] text-navy-700/60">Listrik dan tenaga kerja dihitung sebagai biaya operasi, bukan nilai terbuang.</p>
      </CardBody>
    </Card>
  );
}

function Legend({ items }: { items: Array<{ label: string; color: string; value: string; pct: number }> }) {
  return (
    <ul className="w-full min-w-0 flex-1 space-y-1.5 text-xs">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: it.color }} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-navy-800">{it.label}</span>
          <span className="num shrink-0 font-medium text-navy-900">{it.value}</span>
          <span className="num w-12 shrink-0 text-right text-navy-700/60">{fmtPct(it.pct)}</span>
        </li>
      ))}
    </ul>
  );
}

export function LifeCycleCard({ rows }: { rows: LifeCycleRow[] }) {
  const label = (k: string) => (k in INDICATOR ? INDICATOR[k as keyof typeof INDICATOR].label : k);
  return (
    <Card id="siklus-hidup" className="scroll-mt-36">
      <CardHeader title="Siklus hidup" subtitle="Dari mana dampaknya datang: bahan dan listrik yang dibeli, atau proses di lini Anda" />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-4 text-[11px] text-navy-700/75">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#5B7DB1]" /> Produksi bahan & listrik yang dibeli
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#E8731A]" /> Langsung di lini (asap, air buangan)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-navy-700/40 bg-white" /> Pemakaian & akhir masa pakai part: tidak dikaji
          </span>
        </div>
        {rows.map((r) => (
          <div key={r.key} data-testid={`lifecycle-${r.key}`}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-medium text-navy-900">{label(r.key)}</span>
              <span className="num text-navy-700/70">
                {fmtPct(r.upstreamPct)} dibeli · {fmtPct(r.linePct)} di lini
              </span>
            </div>
            <div className="flex h-4 overflow-hidden rounded bg-sand-100">
              <span className="h-full bg-[#5B7DB1]" style={{ width: `${r.upstreamPct}%` }} />
              <span className="h-full bg-[#E8731A]" style={{ width: `${r.linePct}%` }} />
            </div>
          </div>
        ))}
        <Tip href="/laporan" cta="Lihat laporan lengkap">
          Kajian ini dihitung sampai part keluar dari pabrik; pemakaian part oleh pelanggan belum dihitung.
        </Tip>
      </CardBody>
    </Card>
  );
}

export const SECTIONS: Array<{ id: string; label: string }> = [
  { id: "informasi", label: "Informasi" },
  { id: "angka-utama", label: "Angka utama" },
  { id: "jejak-karbon", label: "Jejak karbon" },
  { id: "nilai-terbuang", label: "Nilai terbuang" },
  { id: "alur", label: "Alur bahan & energi" },
  { id: "siklus-hidup", label: "Siklus hidup" },
  { id: "per-tahap", label: "Per tahap proses" },
];

/** Sticky contents list; the section in view is highlighted. */
export function Contents() {
  const [active, setActive] = useState(SECTIONS[0]!.id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-120px 0px -55% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);
  return (
    <nav aria-label="Isi halaman" className="no-print sticky top-36 hidden h-fit rounded-xl border border-sand-200 bg-white p-3 xl:block">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-navy-700/55">Isi</p>
      <ul className="space-y-0.5 text-xs">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className={cn("block rounded-md px-2 py-1.5 hover:bg-sand-50", active === s.id ? "bg-sand-100 font-semibold text-navy-900" : "text-navy-700/80")} aria-current={active === s.id ? "true" : undefined}>
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
