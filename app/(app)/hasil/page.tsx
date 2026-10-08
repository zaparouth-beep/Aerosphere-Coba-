"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BarList } from "@/components/charts/Charts";
import { STAGE_COLOR } from "@/components/charts/palette";
import ExpertLcia from "@/components/expert/ExpertLcia";
import ExpertMfca from "@/components/expert/ExpertMfca";
import { HeadlineCards } from "@/components/summary/Summary";
import { ConfidenceBadge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Feedback";
import { LockedFeature } from "@/components/ui/Locked";
import { Segmented, Tabs } from "@/components/ui/Tabs";
import { hasFeature } from "@/lib/domain/plans";
import type { MfcaCostKey } from "@/lib/engine/mfca";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults, useComparison } from "@/lib/store/useResults";
import { fmt, fmtRpShort } from "@/lib/utils/format";
import { confidenceFor } from "@/lib/view/helpers";
import { headlines, stageValues, type HeadlineKey } from "@/lib/view/summary";

const COST_LABEL: Record<MfcaCostKey, string> = {
  material: "Bahan kimia & air",
  energy: "Listrik & energi",
  system: "Tenaga kerja & penyusutan",
  waste: "Pengolahan limbah",
};

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
  const { project, results, indicators } = useActiveResults();
  const comparison = useComparison();
  const [metric, setMetric] = useState<HeadlineKey>("cc");
  const heads = headlines(indicators, results.lci.referenceFlow, results.lci.fuLabel, comparison);
  const fu = results.lci.fuLabel;
  const stages = stageValues(project, results, metric);
  const unit = metric === "cc" ? ` kg CO₂e/${fu}` : metric === "water" ? ` L/${fu}` : metric === "waste" ? ` kg/${fu}` : `/${fu}`;

  const ref = results.lci.referenceFlow || NaN;
  const costs = (Object.keys(COST_LABEL) as MfcaCostKey[]).map((k) => ({
    key: k,
    used: results.mfca.totals[k].positive / ref,
    lost: results.mfca.totals[k].negative / ref,
  }));
  const lossPct = results.mfca.totalCostRp > 0 ? (results.mfca.costLossRp / results.mfca.totalCostRp) * 100 : 0;

  const confByMetric: Record<HeadlineKey, ReturnType<typeof confidenceFor>> = {
    cc: confidenceFor(project, ["Energy", "Chemical", "Anode"]),
    water: confidenceFor(project, ["Water"]),
    waste: confidenceFor(project, "waste"),
    cost: confidenceFor(project, ["Chemical", "Anode", "Water", "Energy", "WWTPChemical", "Consumable"]),
  };

  return (
    <>
      <HeadlineCards heads={heads} compareLabel={comparison?.label} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
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
        <Card>
          <CardHeader
            title="Biaya bahan yang terbuang"
            info="mfca"
            subtitle={`${fmt(lossPct, 0)}% dari biaya proses tidak menjadi produk (per ${fu}).`}
          />
          <CardBody>
            <BarList
              items={costs.map((c) => ({ label: `${COST_LABEL[c.key]} — terbuang`, value: c.lost, color: "#D55E00", note: `dari ${fmtRpShort(c.used + c.lost)}` }))}
              format={(v) => fmtRpShort(v)}
            />
            <p className="mt-3 text-[11px] text-navy-700/60">
              Terbuang = bagian bahan, energi, dan biaya lain yang menjadi limbah, larutan terbawa, atau air buangan, bukan lapisan di produk.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
