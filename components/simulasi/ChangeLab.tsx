"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, Pin, X } from "lucide-react";
import { FlowExplorer } from "@/components/flow/FlowExplorer";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { Project } from "@/lib/domain/types";
import type { ScenarioOutcome } from "@/lib/engine/scenario";
import type { RunResult } from "@/lib/engine/types";
import { cn } from "@/lib/utils/cn";
import { fmtRp } from "@/lib/utils/format";

/**
 * "Coba perubahan": apply a saved simulation to the flow diagram and see what
 * changes (before / after per band), then pin results side by side — the
 * substitute-and-compare pattern of product-model tools. All numbers come
 * from evaluateScenario (engine).
 */

export const OPEN_SCENARIO_EVENT = "aerosphere:open-scenario";

const METRICS: Array<{ key: keyof ScenarioOutcome["delta"]; label: string }> = [
  { key: "ccKg", label: "Jejak karbon" },
  { key: "wasteValueRp", label: "Nilai terbuang" },
  { key: "waterL", label: "Air" },
  { key: "wasteKg", label: "Limbah B3" },
];

function DeltaChip({ label, pct }: { label: string; pct: number }) {
  const flat = Math.abs(pct) < 0.05;
  const down = pct < 0;
  const I = flat ? Minus : down ? ArrowDownRight : ArrowUpRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        flat ? "bg-sand-100 text-navy-700" : down ? "bg-[#DDF1E3] text-[#14532D]" : "bg-[#FBE3E3] text-[#7F1D1D]",
      )}
    >
      <I className="h-3 w-3" aria-hidden />
      {label} {flat ? "tetap" : `${down ? "−" : "+"}${Math.abs(pct).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`}
    </span>
  );
}

export function ChangeLab({ project, run, outcomes }: { project: Project; run: RunResult; outcomes: ScenarioOutcome[] }) {
  const usable = outcomes.filter((o) => o.results.analysis);
  const [activeId, setActiveId] = useState<string | null>(usable[0]?.scenario.id ?? null);
  const [pins, setPins] = useState<string[]>([]);
  const active = usable.find((o) => o.scenario.id === activeId) ?? null;
  const pinned = pins.map((id) => usable.find((o) => o.scenario.id === id)).filter((o): o is ScenarioOutcome => !!o);
  const open = (id: string) => window.dispatchEvent(new CustomEvent(OPEN_SCENARIO_EVENT, { detail: id }));

  if (!usable.length) return null;

  return (
    <Card>
      <CardHeader title="Coba perubahan" subtitle="Pilih satu perbaikan, lihat pita mana yang menyusut di alur, lalu sematkan hasilnya untuk dibandingkan." />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Perbaikan yang diterapkan">
          <span className="text-xs font-medium text-navy-900">Terapkan:</span>
          {usable.map((o) => (
            <button
              key={o.scenario.id}
              type="button"
              role="radio"
              aria-checked={activeId === o.scenario.id}
              data-testid={`apply-${o.scenario.id}`}
              onClick={() => setActiveId(o.scenario.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-left text-xs",
                activeId === o.scenario.id ? "border-navy-900 bg-navy-900 text-white" : "border-sand-200 bg-white text-navy-900 hover:border-navy-900/40",
              )}
            >
              <span className="block font-semibold">{o.scenario.name || o.scenario.code}</span>
              <span className={cn("block text-[10px]", activeId === o.scenario.id ? "text-white/75" : "text-navy-700/60")}>
                hemat {fmtRp(o.lcc.annualSavingRp)}/tahun
              </span>
            </button>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {active && (
              <FlowExplorer
                key={active.scenario.id}
                project={project}
                run={run}
                outcomes={outcomes}
                thresholdPct={project.hotspotThresholdPct}
                compare={{ run: active.results.analysis!, label: active.scenario.name || active.scenario.code }}
                panel={false}
                testId="sim-flow"
              />
            )}
          </div>

          <aside className="space-y-3 rounded-xl border border-sand-200 bg-white p-4 text-xs" aria-label="Analitik perubahan" data-testid="change-panel">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-navy-700/55">Analitik perubahan</p>
              <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[10px] text-navy-800" data-testid="pin-count">
                {pins.length} pin aktif
              </span>
            </div>
            {active && (
              <div className="rounded-lg border border-navy-900/20 bg-sand-50 p-3">
                <p className="font-semibold text-navy-900">{active.scenario.name}</p>
                <p className="mt-0.5 text-navy-700/70">Hemat {fmtRp(active.lcc.annualSavingRp)} per tahun</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {METRICS.map((m) => (
                    <DeltaChip key={m.key} label={m.label} pct={active.delta[m.key].pct} />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={pins.includes(active.scenario.id)}
                    onClick={() => setPins((p) => [...p, active.scenario.id])}
                    className="inline-flex items-center gap-1 font-medium text-navy-900 hover:underline disabled:opacity-45"
                  >
                    <Pin className="h-3.5 w-3.5" /> {pins.includes(active.scenario.id) ? "Sudah disematkan" : "Sematkan"}
                  </button>
                  <button type="button" onClick={() => open(active.scenario.id)} className="inline-flex items-center gap-1 font-medium text-brand-blue hover:underline">
                    Lihat perhitungannya <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
            {pinned.length > 0 ? (
              <ul className="space-y-2" data-testid="pins">
                {pinned.map((o) => (
                  <li key={o.scenario.id} className="rounded-lg border border-sand-200 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-navy-900">
                        <Pin className="mr-1 inline h-3 w-3 text-brand-gold" aria-hidden />
                        {o.scenario.name}
                      </p>
                      <button type="button" aria-label={`Lepas pin ${o.scenario.name}`} onClick={() => setPins((p) => p.filter((x) => x !== o.scenario.id))} className="text-navy-700/60 hover:text-navy-900">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-navy-700/70">Hemat {fmtRp(o.lcc.annualSavingRp)}/tahun</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {METRICS.map((m) => (
                        <DeltaChip key={m.key} label={m.label} pct={o.delta[m.key].pct} />
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-navy-700/65">Sematkan beberapa perbaikan untuk membandingkan hasilnya berdampingan.</p>
            )}
          </aside>
        </div>
      </CardBody>
    </Card>
  );
}
