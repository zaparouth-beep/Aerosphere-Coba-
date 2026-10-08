"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Flame } from "lucide-react";
import { STAGE_COLOR } from "@/components/charts/palette";
import ExpertHotspot from "@/components/expert/ExpertHotspot";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { LockedFeature } from "@/components/ui/Locked";
import { hasFeature } from "@/lib/domain/plans";
import type { StageId } from "@/lib/domain/types";
import { LEVERS, type LeverDef } from "@/lib/engine/scenario";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults } from "@/lib/store/useResults";
import { cn } from "@/lib/utils/cn";
import { fmt, fmtRpShort } from "@/lib/utils/format";
import { plainStage } from "@/lib/view/summary";

const STAGE_LEVERS: Record<StageId, Array<LeverDef["id"]>> = {
  A: ["countercurrent", "dragout"],
  B: ["dragout", "countercurrent"],
  C: ["dragout", "bathConcentration", "mistSuppressant", "tankCover"],
  D: ["dragout", "countercurrent"],
  E: ["rectifier", "tankCover", "gridFactor"],
  F: ["effluentTarget"],
};

const METRIC_LABEL: Record<string, string> = {
  energy: "listrik",
  water: "air",
  chemical: "bahan kimia",
  waste: "limbah B3",
  costLoss: "biaya terbuang",
  cc: "jejak karbon",
};

export default function Page() {
  const { project, results } = useActiveResults();
  const expert = useAppStore((s) => s.ui.expertMode);
  const seen = useAppStore((s) => s.ui.seenHotspot);
  const setUi = useAppStore((s) => s.setUi);
  const subscription = useAppStore((s) => s.subscription);
  useEffect(() => {
    if (!seen) setUi({ seenHotspot: true });
  }, [seen, setUi]);

  const ranking = results.hotspot.priority;
  const [selected, setSelected] = useState<StageId>(ranking[0]?.stageId ?? "A");
  const ref = results.lci.referenceFlow || NaN;

  const why = (["energy", "water", "chemical", "waste", "costLoss", "cc"] as const)
    .map((m) => ({ m, share: results.hotspot.share[selected][m] ?? 0 }))
    .filter((x) => x.share > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, 3);
  const items = results.mfca.lines
    .filter((l) => l.stageId === selected && l.costRp > 0)
    .sort((a, b) => b.costRp - a.costRp)
    .slice(0, 4);
  const levers = STAGE_LEVERS[selected].map((id) => LEVERS.find((l) => l.id === id)!).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader
            title="Urutan tahap paling bermasalah"
            info={{
              what: "Skor gabungan dari dampak lingkungan, biaya terbuang, kemudahan perbaikan, dan risiko kepatuhan.",
              why: "Tahap teratas memberi hasil terbesar bila diperbaiki.",
              action: "Klik tahap untuk melihat penyebab dan perbaikan yang bisa dicoba.",
            }}
          />
          <CardBody className="space-y-2">
            {ranking.map((r, i) => (
              <button
                key={r.stageId}
                type="button"
                onClick={() => setSelected(r.stageId)}
                aria-pressed={selected === r.stageId}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  selected === r.stageId ? "border-navy-900 bg-sand-50" : "border-sand-200 hover:border-sand-300",
                )}
              >
                <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: STAGE_COLOR[r.stageId] }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-navy-900">{plainStage(project, r.stageId)}</span>
                  <span className="block h-1.5 rounded-full bg-sand-100">
                    <span className="block h-1.5 rounded-full bg-status-danger/70" style={{ width: `${Math.min(r.score, 100)}%` }} />
                  </span>
                </span>
                <span className="num text-sm font-semibold text-navy-900">{fmt(r.score, 0)}</span>
                {i === 0 && <Flame className="h-4 w-4 text-status-danger" aria-label="Paling bermasalah" />}
              </button>
            ))}
            <p className="text-[11px] text-navy-700/55">Skor 0–100; makin tinggi makin layak diperbaiki lebih dulu.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={`Kenapa ${plainStage(project, selected)}?`} subtitle="Bagian tahap ini dari total lini" />
          <CardBody className="space-y-5">
            <ul className="space-y-2">
              {why.map((w) => (
                <li key={w.m} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-navy-800">Bagian dari seluruh {METRIC_LABEL[w.m]} lini</span>
                  <span className="num font-semibold text-navy-900">{fmt(w.share, 0)}%</span>
                </li>
              ))}
              {!why.length && <li className="text-xs text-navy-700/60">Tahap ini belum punya data pemakaian.</li>}
            </ul>
            {items.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-navy-900">
                  Pengeluaran terbesar di tahap ini <InfoTip k="costPerM2" />
                </p>
                <ul className="space-y-1 text-xs">
                  {items.map((it) => (
                    <li key={it.id} className="flex justify-between gap-3 rounded-md bg-sand-50 px-2 py-1.5">
                      <span className="truncate text-navy-800">{it.name}</span>
                      <span className="num shrink-0 font-medium text-navy-900">{fmtRpShort(it.costRp / ref)} per {results.lci.fuLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold text-navy-900">Yang bisa dicoba</p>
              <ul className="space-y-2">
                {levers.map((l) => (
                  <li key={l.id} className="rounded-lg border border-sand-200 p-2.5 text-xs">
                    <p className="font-medium text-navy-900">{l.label}</p>
                    <p className="text-navy-700/65">Berpengaruh ke: {l.affects}</p>
                  </li>
                ))}
              </ul>
              <Link href="/simulasi" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline">
                Hitung di Simulasi Perbaikan <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>

      {expert ? (
        <section className="space-y-3 border-t border-sand-300 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-navy-700/60">Detail Mode Ahli</h2>
          <ExpertHotspot />
        </section>
      ) : (
        !hasFeature(subscription, "expertMode") && <LockedFeature feature="expertMode" title="Heatmap, Pareto, dan pengaturan bobot prioritas" />
      )}
    </div>
  );
}
