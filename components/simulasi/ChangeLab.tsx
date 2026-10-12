"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, Pin, X } from "lucide-react";
import { FlowExplorer } from "@/components/flow/FlowExplorer";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { Project } from "@/lib/domain/types";
import type { Indicators } from "@/lib/engine/calculate";
import { isNothingNote, type ScenarioOutcome } from "@/lib/engine/scenario";
import type { RunResult } from "@/lib/engine/types";
import { cn } from "@/lib/utils/cn";
import { fmtRp, fmtSig } from "@/lib/utils/format";

/**
 * "Coba perubahan": apply a saved simulation to the flow diagram and see what
 * changes (before / after per band), then pin results side by side — the
 * substitute-and-compare pattern of product-model tools. All numbers come
 * from evaluateScenario (engine).
 */

export const OPEN_SCENARIO_EVENT = "aerosphere:open-scenario";

type MetricKey = keyof ScenarioOutcome["delta"];

/** Every effect a simulation can have; carbon and wasted value are always shown, the rest only when they change. */
const METRICS: Array<{ key: MetricKey; label: string; unit: string; always?: boolean; rp?: boolean }> = [
  { key: "ccKg", label: "Jejak karbon", unit: "kg CO₂e", always: true },
  { key: "wasteValueRp", label: "Nilai terbuang", unit: "", rp: true, always: true },
  { key: "costRp", label: "Biaya proses", unit: "", rp: true },
  { key: "energyKwh", label: "Listrik", unit: "kWh" },
  { key: "waterL", label: "Air", unit: "L" },
  { key: "chemicalKg", label: "Bahan kimia", unit: "kg" },
  { key: "wasteKg", label: "Limbah B3", unit: "kg" },
  { key: "airKg", label: "Emisi udara langsung", unit: "kg" },
  { key: "effluentMetalKg", label: "Logam di air buangan", unit: "kg" },
];

const changed = (o: ScenarioOutcome, k: MetricKey) => Math.abs(o.delta[k].pct) >= 0.05;
const metricsOf = (o: ScenarioOutcome) => METRICS.filter((m) => m.always || changed(o, m.key));

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

export function ChangeLab({ project, run, base, outcomes }: { project: Project; run: RunResult; base: Indicators; outcomes: ScenarioOutcome[] }) {
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
                  {metricsOf(active).map((m) => (
                    <DeltaChip key={m.key} label={m.label} pct={active.delta[m.key].pct} />
                  ))}
                </div>
                {/* Absolute values per period: changes in Data Saya show up here directly. */}
                <table className="mt-2 w-full text-[11px]" data-testid="change-values">
                  <thead>
                    <tr className="text-left text-navy-700/60">
                      <th className="py-0.5 font-medium">Per periode</th>
                      <th className="py-0.5 text-right font-medium">Sekarang</th>
                      <th className="py-0.5 text-right font-medium">Sesudah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metricsOf(active).map((m) => {
                      const v = (x: number) => (m.rp ? fmtRp(x) : `${fmtSig(x)} ${m.unit}`);
                      return (
                        <tr key={m.key} className="border-t border-sand-200">
                          <td className="py-0.5 text-navy-800">{m.label}</td>
                          <td className="num whitespace-nowrap py-0.5 pl-2 text-right text-navy-800">{v(base[m.key])}</td>
                          <td className="num whitespace-nowrap py-0.5 pl-2 text-right font-medium text-navy-900">{v(active.indicators[m.key])}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {active.assumptions.some((a) => isNothingNote(a)) && (
                  <p className="mt-2 rounded-md bg-status-warn/10 px-2 py-1 text-[11px] text-navy-900" role="status" data-testid="change-nothing">
                    {active.assumptions.filter((a) => isNothingNote(a)).join(" ")}
                  </p>
                )}
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
                      {metricsOf(o).map((m) => (
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
