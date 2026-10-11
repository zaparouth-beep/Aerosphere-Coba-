"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { BarList } from "@/components/charts/Charts";
import { STAGE_COLOR } from "@/components/charts/palette";
import ExpertLcia from "@/components/expert/ExpertLcia";
import ExpertMfca from "@/components/expert/ExpertMfca";
import { FlowExplorer } from "@/components/flow/FlowExplorer";
import { CarbonCard, Contents, ExternalImpactsCard, InfoCard, LifeCycleCard, Tip, WasteCard } from "@/components/hasil/Overview";
import { HeadlineCards } from "@/components/summary/Summary";
import { ConfidenceBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Feedback";
import { LockedFeature } from "@/components/ui/Locked";
import { Segmented, Tabs } from "@/components/ui/Tabs";
import { hasFeature } from "@/lib/domain/plans";
import { lifeCycleSplit, wasteItems } from "@/lib/engine/flow";
import { buildTitikBoros } from "@/lib/engine/titikBoros";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults, useComparison, useScenarioOutcomes } from "@/lib/store/useResults";
import { fmt, fmtRpShort } from "@/lib/utils/format";
import { confidenceFor } from "@/lib/view/helpers";
import { headlines, stageValues, type HeadlineKey } from "@/lib/view/summary";

export default function Page() {
  return (
    <Suspense>
      <Hasil />
    </Suspense>
  );
}

function Hasil() {
  const search = useSearchParams();
  const router = useRouter();
  const expert = useAppStore((s) => s.ui.expertMode);
  const view = search.get("view") === "biaya" ? "biaya" : "dampak";
  return (
    <div className="space-y-6">
      <Ringkas />
      {expert ? (
        <section className="space-y-3 border-t border-sand-300 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-navy-700/60">Detail Mode Ahli</h2>
          <Card>
            <Tabs
              value={view}
              onChange={(v) => router.replace(`/hasil?view=${v}`)}
              tabs={[
                { id: "dampak", label: "Dampak lingkungan (EF 3.1)" },
                { id: "biaya", label: "Aliran biaya (MFCA)" },
              ]}
            />
          </Card>
          {view === "dampak" ? <ExpertLcia /> : <ExpertMfca />}
        </section>
      ) : (
        <LockedOrHint />
      )}
    </div>
  );
}

function LockedOrHint() {
  const subscription = useAppStore((s) => s.subscription);
  const setExpertMode = useAppStore((s) => s.setExpertMode);
  const allowed = hasFeature(subscription, "expertMode");
  if (!allowed) return <LockedFeature feature="expertMode" title="Semua kategori dampak, emisi per Scope, dan diagram alir biaya" />;
  return (
    <Callout>
      Ingin melihat semua kategori dampak, emisi per Scope, dan diagram alir biaya?{" "}
      <button type="button" className="font-medium text-brand-blue underline" onClick={() => setExpertMode(true)}>
        Buka Mode Ahli
      </button>
    </Callout>
  );
}

function Ringkas() {
  const { project, results, indicators, run } = useActiveResults();
  const { outcomes } = useScenarioOutcomes();
  const comparison = useComparison();
  const [metric, setMetric] = useState<HeadlineKey>("cc");
  const heads = headlines(indicators, results.lci.referenceFlow, results.lci.fuLabel, comparison);
  const fu = results.lci.fuLabel;
  const stages = stageValues(project, results, metric);
  const unit = metric === "cc" ? ` kg CO₂e/${fu}` : metric === "water" ? ` L/${fu}` : metric === "waste" ? ` kg/${fu}` : `/${fu}`;
  const analysis = results.analysis;
  const model = useMemo(() => (analysis ? buildTitikBoros(analysis, { thresholdPct: project.hotspotThresholdPct }) : null), [analysis, project.hotspotThresholdPct]);

  const confByMetric: Record<HeadlineKey, ReturnType<typeof confidenceFor>> = {
    cc: confidenceFor(project, ["Energy", "Chemical", "Anode"]),
    water: confidenceFor(project, ["Water"]),
    waste: confidenceFor(project, "waste"),
    cost: confidenceFor(project, ["Chemical", "Anode", "Water", "Energy", "WWTPChemical", "Consumable"]),
  };

  if (!analysis || !model) {
    return (
      <Callout tone="warn">
        Hasil ini dibuat dengan mesin hitung versi lama. Tekan “Hitung hasil” di bar atas untuk membuat hasil baru.
      </Callout>
    );
  }
  const carbon = model.rows.find((r) => r.key === "gwp");
  const waste = model.rows.find((r) => r.key === "waste_value")!;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_200px]">
      <div className="min-w-0 space-y-4">
        <InfoCard project={project} run={analysis} resultLabel={run ? `#${run.id}` : "data terkini (belum disimpan)"} />
        <section id="angka-utama" className="scroll-mt-36">
          <HeadlineCards heads={heads} compareLabel={comparison?.label} />
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          {carbon && <CarbonCard project={project} row={carbon} />}
          <WasteCard run={analysis} items={wasteItems(analysis)} totalPerFU={waste.totalPerFU} />
        </div>
        <Card id="alur" className="scroll-mt-36">
          <CardHeader title="Alur bahan & energi" subtitle="Dari sumber (listrik, bahan kimia, air, …) ke tiap tahap, lalu ke total lini" />
          <CardBody>
            <FlowExplorer project={project} run={analysis} outcomes={outcomes} thresholdPct={project.hotspotThresholdPct} panel={false} testId="hasil-flow" />
            <Tip href="/titik-boros" cta="Telusuri di Titik Boros">
              Klik sebuah tahap di Titik Boros untuk melihat komponen pemicunya dan saran perbaikan.
            </Tip>
          </CardBody>
        </Card>
        <LifeCycleCard rows={lifeCycleSplit(analysis)} />
        <ExternalImpactsCard project={project} run={analysis} />
        <Card id="per-tahap" className="scroll-mt-36">
          <CardHeader
            title="Per tahap proses"
            info={{ what: "Besar indikator yang dipilih di setiap tahap, per 1 m² permukaan dilapisi.", why: "Tahap dengan batang terpanjang adalah tempat perbaikan paling berpengaruh.", action: "Buka Titik Boros untuk melihat penyebabnya." }}
            action={
              <Segmented
                size="xs"
                ariaLabel="Indikator"
                value={metric}
                onChange={setMetric}
                options={[
                  { id: "cc", label: "Karbon" },
                  { id: "water", label: "Air" },
                  { id: "waste", label: "Limbah B3" },
                  { id: "cost", label: "Biaya" },
                ]}
              />
            }
          />
          <CardBody>
            <BarList
              items={stages.map((s) => ({ label: s.name, value: s.value, color: STAGE_COLOR[s.stageId] }))}
              format={(v) => (metric === "cost" ? `${fmtRpShort(v)}${unit}` : `${fmt(v, 2)}${unit}`)}
            />
            {confByMetric[metric] && (
              <p className="mt-3 flex items-center gap-2 text-[11px] text-navy-700/60">
                <ConfidenceBadge value={confByMetric[metric]!} /> berdasarkan asal angka pemakaian
              </p>
            )}
          </CardBody>
        </Card>
      </div>
      <Contents />
    </div>
  );
}
