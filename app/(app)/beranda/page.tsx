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
import { T, tx } from "@/lib/i18n";
import { fmt, fmtDelta, fmtRp } from "@/lib/utils/format";
import { effortWord, headlines, overallConfidence, topActions, worstStage } from "@/lib/view/summary";

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
    { label: tx("Isi data", "Fill in data"), done: v.completenessPct >= 80, href: "/data" },
    { label: tx("Cek data", "Check data"), done: v.errors === 0 && (project.dataset.status === "approved" || v.warnings === 0), href: "/data?view=cek" },
    { label: tx("Hitung hasil", "Calculate results"), done: runs.length > 0, href: "/hasil" },
    { label: tx("Lihat titik boros", "See waste hotspots"), done: ui.seenHotspot, href: "/titik-boros" },
    { label: tx("Unduh laporan", "Download report"), done: ui.reportDownloaded, href: "/laporan" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-navy-700/70">{tx("Halo", "Hello")}, {account?.name?.split(" ")[0] ?? tx("selamat datang", "welcome")}</p>
          <h2 className="text-xl font-semibold text-navy-900">{project.name}</h2>
          <p className="text-xs text-navy-700/60">
            {project.facility} · {tx("periode", "period")} {project.periodLabel} · {run ? `${tx("Hasil", "Result")} #${run.id}` : tx("data terkini (belum disimpan)", "current data (not saved)")}
          </p>
        </div>
      </div>

      {project.prices.isDemo && (
        <Callout tone="warn">
          <T
            id={
              <>
                Data atau harga di proyek ini masih <b>contoh</b>. Ganti dengan data dan harga riil lini Anda di{" "}
                <Link href="/data" className="font-medium underline">Data Saya</Link> sebelum dipakai untuk keputusan.
              </>
            }
            en={
              <>
                The data or prices in this project are still a <b>sample</b>. Replace them with your line&apos;s real data and prices in{" "}
                <Link href="/data" className="font-medium underline">My Data</Link> before using them for decisions.
              </>
            }
          />
        </Callout>
      )}

      <Card>
        <CardHeader title={tx("Langkah Anda", "Your steps")} subtitle={tx(`${doneCount} dari ${checklist.length} selesai`, `${doneCount} of ${checklist.length} done`)} />
        <CardBody>
          <ProgressBar value={(doneCount / checklist.length) * 100} tone="green" label={tx("Kemajuan langkah", "Step progress")} />
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
      {!comparison && <p className="-mt-3 text-[11px] text-navy-700/55">
          {tx("Status muncul setelah ada hasil tersimpan untuk dibandingkan. Tekan “Hitung hasil” tiap bulan.", "Status appears once there is a saved result to compare with. Press “Calculate results” every month.")}
        </p>}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-status-danger" /> {tx("Titik paling boros", "Biggest waste hotspot")}
              </span>
            }
            info="hotspot"
            subtitle={
              worst
                ? tx(`Tahap ${worst.stageName} menyumbang ${fmt(worst.sharePct, 0)}% dari ${worst.indicator}.`, `The ${worst.stageName} stage accounts for ${fmt(worst.sharePct, 0)}% of ${worst.indicator}.`)
                : tx("Belum ada data pemakaian listrik, air, bahan kimia, atau limbah.", "No electricity, water, chemical or waste usage data yet.")
            }
            action={
              <Link href="/titik-boros" className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline">
                {tx("Kenapa?", "Why?")} <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <CardBody>
            {worst ? (
              <WorstStageBars project={project} results={results} worst={worst} />
            ) : (
              <p className="py-6 text-center text-xs text-navy-700/65">
                <T
                  id={
                    <>
                      Titik boros muncul setelah pemakaian bulan lalu diisi. Mulai dari{" "}
                      <Link href="/data" className="font-medium text-brand-blue underline">
                        Data Saya
                      </Link>
                      : unggah template Excel atau isi tabelnya.
                    </>
                  }
                  en={
                    <>
                      Waste hotspots appear once last month&apos;s usage is filled in. Start from{" "}
                      <Link href="/data" className="font-medium text-brand-blue underline">
                        My Data
                      </Link>
                      : upload the Excel template or fill in the table.
                    </>
                  }
                />
              </p>
            )}
          </CardBody>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title={tx("Perbaikan yang disarankan", "Suggested improvement")} info="whatif" />
            <CardBody>
              {action ? (
                <div className="space-y-2">
                  <p className="flex items-start gap-2 text-sm font-semibold text-navy-900">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" /> {action.action}
                  </p>
                  <p className="text-xs text-navy-700/70">{action.description}</p>
                  <p className="text-sm text-navy-900">
                    <T
                      id={
                        <>
                          Hemat sekitar <b className="num">{fmtRp(action.savingRpYear)}</b> per tahun · jejak karbon <span className="num">{fmtDelta(action.ccPct)}</span> · usaha {effortWord(action.effort)}
                        </>
                      }
                      en={
                        <>
                          Saves about <b className="num">{fmtRp(action.savingRpYear)}</b> per year · carbon footprint <span className="num">{fmtDelta(action.ccPct)}</span> · effort {effortWord(action.effort)}
                        </>
                      }
                    />
                  </p>
                  <Link href="/simulasi" className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline">
                    {tx("Coba di Simulasi Perbaikan", "Try it in Improvement Simulation")} <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-navy-700/60">{tx("Belum ada perbaikan yang menghemat. Buka Simulasi Perbaikan untuk mencoba.", "No saving improvement yet. Open Improvement Simulation to try one.")}</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={tx("Seberapa yakin", "How confident")} info="confidence" action={<ConfidenceBadge value={conf.level} />} />
            <CardBody>
              <p className="text-xs leading-relaxed text-navy-800">{conf.sentence}</p>
              <Link href="/data?view=cek" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline">
                {tx("Cek data", "Check data")} <ArrowRight className="h-3 w-3" />
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>

      {ui.expertMode && (
        <section className="space-y-3 border-t border-sand-300 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-navy-700/60">{tx("Detail Mode Ahli", "Expert mode details")}</h2>
          <ExpertOverview />
        </section>
      )}
    </div>
  );
}
