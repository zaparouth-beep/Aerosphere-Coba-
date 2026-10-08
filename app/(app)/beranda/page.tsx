"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Flame, Sparkles } from "lucide-react";
import ExpertOverview from "@/components/expert/ExpertOverview";
import { HeadlineCards, WorstStageBars } from "@/components/summary/Summary";
import { ConfidenceBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout, ProgressBar } from "@/components/ui/Feedback";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults, useComparison, useScenarioOutcomes } from "@/lib/store/useResults";
import { fmt, fmtDelta, fmtRp } from "@/lib/utils/format";
import { headlines, overallConfidence, topActions, worstStage } from "@/lib/view/summary";

export default function Page() {
  const { project, results, indicators, run } = useActiveResults();
  const { outcomes } = useScenarioOutcomes();
  const comparison = useComparison();
  const runs = useAppStore((s) => s.runs);
  const ui = useAppStore((s) => s.ui);
  const account = useAppStore((s) => s.account);

  const heads = headlines(indicators, results.lci.referenceFlow, results.lci.fuLabel, comparison);
  const worst = worstStage(project, results, heads);
  const action = topActions(outcomes)[0];
  const conf = overallConfidence(project);
  const v = results.validation;

  const checklist = [
    { label: "Isi data", done: v.completenessPct >= 80, href: "/data" },
    { label: "Cek data", done: v.errors === 0 && (project.dataset.status === "approved" || v.warnings === 0), href: "/data?view=cek" },
    { label: "Hitung hasil", done: runs.length > 0, href: "/hasil" },
    { label: "Lihat titik boros", done: ui.seenHotspot, href: "/titik-boros" },
    { label: "Unduh laporan", done: ui.reportDownloaded, href: "/laporan" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-navy-700/70">Halo, {account?.name?.split(" ")[0] ?? "selamat datang"}</p>
          <h2 className="text-xl font-semibold text-navy-900">{project.name}</h2>
          <p className="text-xs text-navy-700/60">
            {project.facility} · periode {project.periodLabel} · {run ? `Hasil #${run.id}` : "data terkini (belum disimpan)"}
          </p>
        </div>
      </div>

      {project.prices.isDemo && (
        <Callout tone="warn">
          Data atau harga di proyek ini masih <b>contoh</b>. Ganti dengan data dan harga riil lini Anda di{" "}
          <Link href="/data" className="font-medium underline">Data Saya</Link> sebelum dipakai untuk keputusan.
        </Callout>
      )}

      <Card>
        <CardHeader title="Langkah Anda" subtitle={`${doneCount} dari ${checklist.length} selesai`} />
        <CardBody>
          <ProgressBar value={(doneCount / checklist.length) * 100} tone="green" label="Kemajuan langkah" />
          <ol className="mt-3 grid gap-2 sm:grid-cols-5">
            {checklist.map((c, i) => (
              <li key={c.label}>
                <Link href={c.href} className="flex items-center gap-2 rounded-lg border border-sand-200 px-3 py-2 text-xs text-navy-800 hover:border-brand-blue/40">
                  {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-status-ok" /> : <Circle className="h-4 w-4 shrink-0 text-navy-700/35" />}
                  <span className={c.done ? "" : "font-medium"}>
                    {i + 1}. {c.label}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <HeadlineCards heads={heads} compareLabel={comparison?.label} hrefs={{ cc: "/hasil", water: "/hasil", waste: "/hasil", cost: "/hasil" }} />
      {!comparison && <p className="-mt-3 text-[11px] text-navy-700/55">Status muncul setelah ada hasil tersimpan untuk dibandingkan. Tekan “Hitung hasil” tiap bulan.</p>}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-status-danger" /> Titik paling boros
              </span>
            }
            info="hotspot"
            subtitle={worst ? `Tahap ${worst.stageName} menyumbang ${fmt(worst.sharePct, 0)}% dari ${worst.indicator}.` : "Belum ada data pemakaian listrik, air, bahan kimia, atau limbah."}
            action={
              <Link href="/titik-boros" className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline">
                Kenapa? <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <CardBody>
            {worst ? (
              <WorstStageBars project={project} results={results} worst={worst} />
            ) : (
              <p className="py-6 text-center text-xs text-navy-700/65">
                Titik boros muncul setelah pemakaian bulan lalu diisi. Mulai dari{" "}
                <Link href="/data" className="font-medium text-brand-blue underline">
                  Data Saya
                </Link>
                : unggah template Excel atau isi tabelnya.
              </p>
            )}
          </CardBody>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Perbaikan yang disarankan" info="whatif" />
            <CardBody>
              {action ? (
                <div className="space-y-2">
                  <p className="flex items-start gap-2 text-sm font-semibold text-navy-900">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" /> {action.action}
                  </p>
                  <p className="text-xs text-navy-700/70">{action.description}</p>
                  <p className="text-sm text-navy-900">
                    Hemat sekitar <b className="num">{fmtRp(action.savingRpYear)}</b> per tahun · jejak karbon <span className="num">{fmtDelta(action.ccPct)}</span> · usaha {action.effort}
                  </p>
                  <Link href="/simulasi" className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline">
                    Coba di Simulasi Perbaikan <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-navy-700/60">Belum ada perbaikan yang menghemat. Buka Simulasi Perbaikan untuk mencoba.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Seberapa yakin" info="confidence" action={<ConfidenceBadge value={conf.level} />} />
            <CardBody>
              <p className="text-xs leading-relaxed text-navy-800">{conf.sentence}</p>
              <Link href="/data?view=cek" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline">
                Cek data <ArrowRight className="h-3 w-3" />
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>

      {ui.expertMode && (
        <section className="space-y-3 border-t border-sand-300 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-navy-700/60">Detail Mode Ahli</h2>
          <ExpertOverview />
        </section>
      )}
    </div>
  );
}
