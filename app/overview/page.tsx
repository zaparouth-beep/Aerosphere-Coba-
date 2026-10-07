"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Beaker, CheckCircle2, Circle, CloudFog, Coins, Droplets, Flame, Recycle, Sparkles, Zap } from "lucide-react";
import { Bullet, SankeyChart, TrendLine } from "@/components/charts/Charts";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout, ProgressBar } from "@/components/ui/Feedback";
import { KpiCard } from "@/components/ui/KpiCard";
import { Segmented } from "@/components/ui/Tabs";
import { indicatorsOf, type Indicators } from "@/lib/engine/calculate";
import { STAGE_IDS } from "@/lib/engine/lci";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults, useScenarioOutcomes } from "@/lib/store/useResults";
import { confidenceFor, deltaPct, inView, mfcaSankey, stageLabel } from "@/lib/view/helpers";
import { fmt, fmtDelta, fmtRp, fmtRpShort } from "@/lib/utils/format";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type TrendMetric = "cc" | "energy" | "water" | "waste" | "cost";

export default function OverviewPage() {
  const { project, results, indicators, run } = useActiveResults();
  const { outcomes } = useScenarioOutcomes();
  const runs = useAppStore((s) => s.runs);
  const fuView = useAppStore((s) => s.ui.fuView);
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("cc");
  const ref = results.lci.referenceFlow;
  const fu = results.lci.fuLabel;
  const unitSuffix = fuView === "perFu" ? `/${fu}` : "/periode";

  const previous = useMemo(() => {
    const idx = run ? runs.findIndex((r) => r.id === run.id) + 1 : 0;
    const prev = runs[idx];
    return prev ? { ind: indicatorsOf(prev.results), ref: prev.results.lci.referenceFlow } : undefined;
  }, [run, runs]);
  const prevView = (pick: (i: Indicators) => number) => (previous ? inView(pick(previous.ind), previous.ref, fuView) : undefined);

  const kpis = [
    { label: "Energi", icon: Zap, total: indicators.energyKwh, unit: "kWh", conf: confidenceFor(project, ["Energy"]), pick: (i: Indicators) => i.energyKwh, href: "/data-proses" },
    { label: "Air", icon: Droplets, total: indicators.waterL, unit: "L", conf: confidenceFor(project, ["Water"]), pick: (i: Indicators) => i.waterL, href: "/data-proses" },
    { label: "Kimia", icon: Beaker, total: indicators.chemicalKg, unit: "kg", conf: confidenceFor(project, ["Chemical", "Anode", "WWTPChemical", "Consumable"]), pick: (i: Indicators) => i.chemicalKg, href: "/data-proses" },
    { label: "Limbah B3", icon: Recycle, total: indicators.wasteKg, unit: "kg", conf: confidenceFor(project, "waste"), pick: (i: Indicators) => i.wasteKg, href: "/hotspot" },
    { label: "Climate change", icon: CloudFog, total: indicators.ccKg, unit: "kg CO₂-eq", conf: undefined, pick: (i: Indicators) => i.ccKg, href: "/dampak-lingkungan" },
    { label: "Biaya proses", icon: Coins, total: indicators.costRp, unit: "", conf: undefined, pick: (i: Indicators) => i.costRp, href: "/aliran-biaya", rp: true },
  ];

  // Workflow checklist (PRD 1.3: 9 steps, two control points).
  const v = results.validation;
  const steps = [
    { label: "Proyek dari template", done: true, href: "/pengaturan" },
    { label: "Goal & Scope dikunci", done: !!project.scope.lockedAt, href: "/goal-scope" },
    { label: `Data terisi ${fmt(v.completenessPct, 0)}%`, done: v.completenessPct >= 80, href: "/data-proses" },
    { label: v.errors ? `${v.errors} error validasi` : "Validasi tanpa error", done: v.errors === 0, href: "/kualitas-data" },
    { label: "Dataset di-approve", done: project.dataset.status === "approved", href: "/kualitas-data" },
    { label: results.lcia.unmapped.length ? `${results.lcia.unmapped.length} aliran belum dipetakan` : "Semua aliran dipetakan", done: results.lcia.unmapped.length === 0, href: "/pengaturan?tab=method" },
    { label: "Run resmi terkunci", done: runs.some((r) => r.manifest.kind === "official"), href: "/pengaturan?tab=runs" },
    { label: "Skenario disetujui", done: project.scenarios.some((s) => s.status === "approved"), href: "/what-if" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  // Hotspot cards: highest share per indicator.
  const metricLabel: Record<string, string> = { energy: "Energi", water: "Air", chemical: "Kimia", waste: "Limbah B3", costLoss: "Cost loss", cc: "Climate change" };
  const hotspots = (["energy", "water", "chemical", "waste", "costLoss", "cc"] as const)
    .map((m) => {
      let best = STAGE_IDS[0]!;
      for (const s of STAGE_IDS) if ((results.hotspot.share[s][m] ?? 0) > (results.hotspot.share[best][m] ?? 0)) best = s;
      return { metric: m, stage: best, share: results.hotspot.share[best][m] ?? 0 };
    })
    .filter((h) => h.share > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, 3);

  // Recommended scenario: flagged by the user, otherwise best combined Δ.
  const flagged = outcomes.find((o) => o.scenario.status === "approved") ?? outcomes.find((o) => o.scenario.status === "recommended");
  const best = flagged ?? [...outcomes].sort((a, b) => a.delta.ccKg.pct + a.delta.costRp.pct - (b.delta.ccKg.pct + b.delta.costRp.pct))[0];

  // Trend across locked runs (oldest → newest).
  const trendPick: Record<TrendMetric, (i: Indicators) => number> = {
    cc: (i) => i.ccKg,
    energy: (i) => i.energyKwh,
    water: (i) => i.waterL,
    waste: (i) => i.wasteKg,
    cost: (i) => i.costRp,
  };
  const trend = [...runs]
    .reverse()
    .map((r) => ({ label: r.id.replace(/^R-\d{4}-/, "R"), value: inView(trendPick[trendMetric](indicatorsOf(r.results)), r.results.lci.referenceFlow, fuView) }));

  // Targets: reduction vs the oldest locked run as baseline.
  const baselineRun = runs[runs.length - 1];
  const baseInd = baselineRun ? indicatorsOf(baselineRun.results) : undefined;
  const reduction = (pick: (i: Indicators) => number) => {
    if (!baseInd || !baselineRun) return 0;
    const b = pick(baseInd) / (baselineRun.results.lci.referenceFlow || 1);
    const c = pick(indicators) / (ref || 1);
    return b > 0 ? ((b - c) / b) * 100 : 0;
  };

  const sankey = useMemo(() => mfcaSankey(project, results, "rp"), [project, results]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1fr_auto]">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <Image src={`${BASE}/brand/mark-color.png`} alt="" width={44} height={44} className="h-11 w-11" unoptimized />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-teal">{project.template}</p>
                <h2 className="text-lg font-semibold text-navy-900">{project.name}</h2>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
              <Meta label="Fasilitas" value={project.facility} />
              <Meta label="Part" value={`${project.partName} · ${project.coatingType}`} />
              <Meta label="Reference flow" value={`${fmt(ref)} ${fu} / ${project.periodLabel}`} />
              <Meta label="Sumber angka" value={run ? `${run.id} · hash ${run.resultHash.slice(0, 10)}…` : "Draf langsung (belum terkunci)"} mono />
            </dl>
          </div>
          <div className="border-t border-sand-200 bg-sand-50 p-5 md:w-[340px] md:border-l md:border-t-0">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-navy-900">Alur studi ISO 14044</p>
              <span className="num text-xs text-navy-700/60">
                {doneCount}/{steps.length}
              </span>
            </div>
            <ProgressBar value={(doneCount / steps.length) * 100} tone="green" label="Kemajuan alur" />
            <ul className="mt-3 space-y-1">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="flex items-center gap-2 text-xs text-navy-800 hover:text-brand-blue">
                    {s.done ? <CheckCircle2 className="h-3.5 w-3.5 text-status-ok" /> : <Circle className="h-3.5 w-3.5 text-navy-700/35" />}
                    <span className={s.done ? "" : "font-medium"}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {project.prices.isDemo && (
        <Callout tone="warn">
          Proyek ini memakai <b>dataset demo</b> (harga satuan dan kuantitas contoh BUILD 2026). Ganti dengan data dan harga riil di Data Proses sebelum
          dipakai untuk keputusan.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const value = inView(k.total, ref, fuView);
          return (
            <KpiCard
              key={k.label}
              label={k.label}
              icon={k.icon}
              value={k.rp ? fmtRpShort(value) : fmt(value, value < 10 ? 2 : 1)}
              unit={k.rp ? unitSuffix : `${k.unit}${unitSuffix}`}
              confidence={k.conf}
              delta={deltaPct(value, prevView(k.pick))}
              href={k.href}
              hint={k.label === "Climate change" && results.lcia.unmapped.length ? `${results.lcia.unmapped.length} aliran belum dipetakan` : undefined}
            />
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Tren antar-run"
            subtitle="Setiap titik adalah run terkunci; data bulanan akan mengisi tren ini saat ingestion periodik aktif"
            action={
              <Segmented
                size="xs"
                ariaLabel="Indikator tren"
                value={trendMetric}
                onChange={setTrendMetric}
                options={[
                  { id: "cc", label: "GWP" },
                  { id: "energy", label: "Energi" },
                  { id: "water", label: "Air" },
                  { id: "waste", label: "B3" },
                  { id: "cost", label: "Biaya" },
                ]}
              />
            }
          />
          <CardBody>
            {trend.length >= 2 ? (
              <TrendLine data={trend} format={(n) => (trendMetric === "cost" ? fmtRpShort(n) : fmt(n, 2))} />
            ) : (
              <p className="py-10 text-center text-xs text-navy-700/60">
                Butuh minimal dua run terkunci. Tekan <b>Run kalkulasi</b> di bar konteks setelah data berubah.
              </p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Progress ke target" subtitle={`Penurunan intensitas per ${fu} vs run baseline ${baselineRun?.id ?? "(belum ada)"} · target ${project.targets.targetYear}`} />
          <CardBody className="space-y-4">
            <Bullet label="Climate change" achievedPct={reduction((i) => i.ccKg)} targetPct={project.targets.gwpReductionPct} />
            <Bullet label="Limbah B3" achievedPct={reduction((i) => i.wasteKg)} targetPct={project.targets.wasteReductionPct} />
            <Bullet label="Air" achievedPct={reduction((i) => i.waterL)} targetPct={project.targets.waterReductionPct} />
            {!baselineRun && <p className="text-[11px] text-navy-700/55">Kunci satu run sebagai baseline agar kemajuan bisa diukur.</p>}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="Top 3 hotspot" subtitle="Klik untuk menelusuri WHY → WHERE → WHAT IF" />
          <CardBody className="space-y-2">
            {hotspots.map((h) => (
              <Link
                key={h.metric}
                href={`/hotspot?metric=${h.metric}&stage=${h.stage}`}
                className="flex items-center gap-3 rounded-lg border border-sand-200 p-3 transition-colors hover:border-brand-blue/40"
              >
                <Flame className="h-5 w-5 shrink-0 text-status-danger" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-navy-900">{stageLabel(project, h.stage)}</p>
                  <p className="text-[11px] text-navy-700/65">{metricLabel[h.metric]}</p>
                </div>
                <span className="num text-lg font-semibold text-navy-900">{fmt(h.share, 0)}%</span>
              </Link>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Rekomendasi skenario"
            subtitle="Dihitung engine dari lever terdokumentasi"
            action={best && <Badge tone={best.scenario.status === "approved" ? "green" : best.scenario.status === "recommended" ? "blue" : "neutral"}>{best.scenario.status}</Badge>}
          />
          <CardBody>
            {best ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 text-brand-gold" />
                  <div>
                    <p className="text-sm font-semibold text-navy-900">
                      {best.scenario.code} · {best.scenario.name}
                    </p>
                    <p className="text-xs text-navy-700/65">{best.scenario.description}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <Delta label="GWP" pct={best.delta.ccKg.pct} />
                  <Delta label="Air" pct={best.delta.waterL.pct} />
                  <Delta label="Biaya" pct={best.delta.costRp.pct} />
                </dl>
                <p className="text-xs text-navy-800">
                  Hemat <b className="num">{fmtRp(-best.delta.costRp.abs)}</b> per periode
                  {best.lcc.paybackYears !== null && best.scenario.capexRp > 0 && <> · payback {fmt(best.lcc.paybackYears, 1)} tahun</>}.
                </p>
                <Link href="/what-if" className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline">
                  Bandingkan S0–S3 <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <p className="text-xs text-navy-700/60">Belum ada skenario.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Status data" subtitle="Titik kontrol 1 (validasi) dan 2 (run)" />
          <CardBody className="space-y-3 text-xs">
            <div>
              <div className="mb-1 flex justify-between">
                <span>Kelengkapan input</span>
                <span className="num font-medium">{fmt(v.completenessPct, 0)}%</span>
              </div>
              <ProgressBar value={v.completenessPct} tone={v.completenessPct >= 80 ? "green" : "gold"} label="Kelengkapan" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={v.errors ? "red" : "green"}>{v.errors} error</Badge>
              <Badge tone={v.warnings ? "gold" : "green"}>{v.warnings} warning</Badge>
              <Badge tone="blue">neraca air {fmt(v.water.closurePct, 0)}%</Badge>
              {v.metal && <Badge tone="blue">neraca logam {fmt(Math.min(v.metal.closurePct, 999), 0)}%</Badge>}
            </div>
            <Link href="/kualitas-data" className="inline-flex items-center gap-1 font-medium text-brand-blue hover:underline">
              Buka Kualitas Data <ArrowRight className="h-3 w-3" />
            </Link>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Aliran biaya ringkas (MFCA)" subtitle="Kategori biaya → tahap → positive / negative product" action={<Link href="/aliran-biaya" className="text-xs font-medium text-brand-blue hover:underline">Detail MFCA</Link>} />
        <CardBody>
          <SankeyChart data={sankey} format={fmtRpShort} height={300} />
        </CardBody>
      </Card>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-navy-700/55">{label}</dt>
      <dd className={`truncate font-medium text-navy-900 ${mono ? "num text-[11px]" : ""}`} title={value}>
        {value}
      </dd>
    </div>
  );
}

function Delta({ label, pct }: { label: string; pct: number }) {
  const good = pct < 0;
  return (
    <div className="rounded-lg bg-sand-50 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-navy-700/55">{label}</dt>
      <dd className={`num text-sm font-semibold ${pct === 0 ? "text-navy-700/60" : good ? "text-status-ok" : "text-status-danger"}`}>{fmtDelta(pct)}</dd>
    </div>
  );
}
