"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, Cloud, CloudRain, Coins, Droplet, Flame, Lightbulb, RotateCcw, Skull, Waves, ZoomIn } from "lucide-react";
import { FlowSankey } from "@/components/flow/FlowSankey";
import { SeverityIcon } from "@/components/titik-boros/TitikBoros";
import type { Project } from "@/lib/domain/types";
import { buildFlow, compareFlows, type FlowFocus, type FlowLink, type FlowNode } from "@/lib/engine/flow";
import type { ScenarioOutcome } from "@/lib/engine/scenario";
import { buildTitikBoros, type IndicatorKey } from "@/lib/engine/titikBoros";
import type { RunResult, StageCode } from "@/lib/engine/types";
import { cn } from "@/lib/utils/cn";
import { fmtRp } from "@/lib/utils/format";
import { nodeDeltas, nodeLabel, trail } from "@/lib/view/flow";
import { BADGE, driverText, fmtPct, fmtValue, INDICATOR, leversFor, NO_REASON_TEXT, perFuText, reasonsFor, SEVERITY_STYLE } from "@/lib/view/titikBoros";

const ICON: Record<IndicatorKey, typeof Cloud> = { gwp: Cloud, ap: CloudRain, ep: Waves, adp_fossil: Flame, water: Droplet, waste_b3: Skull, waste_value: Coins };

/** Indicator picker as icon tiles, grouped like the rest of the app. */
export function IndicatorTiles({
  rows,
  value,
  onChange,
  compact,
}: {
  rows: Array<{ key: IndicatorKey; group: "impact" | "use"; totalPerFU: number; unit: string }>;
  value: IndicatorKey;
  onChange: (k: IndicatorKey) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Pilih indikator">
      {(["impact", "use"] as const).map((g) => (
        <div key={g} className="flex flex-wrap items-stretch gap-2">
          <span className="w-full text-[10px] font-semibold uppercase tracking-[0.12em] text-navy-700/55 sm:w-auto sm:self-center sm:pr-1">{g === "impact" ? "Dampak lingkungan" : "Pemakaian & buangan"}</span>
          {rows
            .filter((r) => r.group === g)
            .map((r) => {
              const I = ICON[r.key];
              const on = r.key === value;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-testid={`tile-${r.key}`}
                  onClick={() => onChange(r.key)}
                  className={cn(
                    "flex min-w-[118px] flex-1 flex-col items-start rounded-lg border px-2.5 py-2 text-left transition-colors sm:flex-none",
                    on ? "border-navy-900 bg-navy-900 text-white" : "border-sand-200 bg-white text-navy-900 hover:border-navy-900/40",
                    compact && "min-w-[100px] py-1.5",
                  )}
                >
                  <I className={cn("h-4 w-4", on ? "text-brand-gold" : "text-brand-blue")} aria-hidden />
                  <span className="mt-1 text-[11px] font-semibold leading-tight">{INDICATOR[r.key].label}</span>
                  <span className={cn("num text-[10px]", on ? "text-white/75" : "text-navy-700/60")}>{fmtValue(r.totalPerFU, r)}/m²</span>
                </button>
              );
            })}
        </div>
      ))}
    </div>
  );
}

export interface FlowExplorerProps {
  project: Project;
  run: RunResult;
  outcomes: ScenarioOutcome[];
  thresholdPct?: number;
  /** Simulation result: the diagram shows "after" with Δ% against `run`. */
  compare?: { run: RunResult; label: string };
  initialKey?: IndicatorKey;
  tiles?: boolean;
  panel?: boolean;
  highlightStage?: StageCode | null;
  onHoverStage?: (s: StageCode | null) => void;
  testId?: string;
}

export function FlowExplorer({ project, run, outcomes, thresholdPct, compare, initialKey = "gwp", tiles = true, panel = true, highlightStage, onHoverStage, testId = "flow" }: FlowExplorerProps) {
  const [key, setKey] = useState<IndicatorKey>(initialKey);
  const [focus, setFocus] = useState<FlowFocus>({});
  const [selected, setSelected] = useState<FlowNode | null>(null);
  const [showBefore, setShowBefore] = useState(false);

  const model = useMemo(() => buildTitikBoros(run, { thresholdPct }), [run, thresholdPct]);
  const before = useMemo(() => buildFlow(run, key, focus, thresholdPct), [run, key, focus, thresholdPct]);
  const after = useMemo(() => (compare ? buildFlow(compare.run, key, focus, thresholdPct) : null), [compare, key, focus, thresholdPct]);
  const changes = useMemo(() => (after ? compareFlows(before, after) : null), [before, after]);
  const flow = after && !showBefore ? after : before;
  const row = model.rows.find((r) => r.key === key) ?? model.rows[0]!;
  const unitRow = { unit: flow.unit || row.unit };
  const format = (v: number) => perFuText(v, unitRow);
  const label = (n: FlowNode) => nodeLabel(n, project, key);

  const linkNote = (l: FlowLink) => {
    const c = changes?.find((x) => x.source === l.source && x.target === l.target);
    if (!c || Math.abs(c.deltaPct) < 0.05) return null;
    const area = run.areaPlatedM2 || NaN;
    return `Sebelum ${fmtValue(c.before / area, unitRow)} → sesudah ${fmtValue(c.after / area, unitRow)} (${c.deltaPct < 0 ? "−" : "+"}${Math.abs(c.deltaPct).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%)`;
  };

  const drill = (n: FlowNode) => {
    if (n.type === "stage") setFocus({ stage: n.key as StageCode });
    else if (n.type === "kind") setFocus({ kind: n.key });
    setSelected(null);
  };
  const reset = () => {
    setFocus({});
    setSelected(null);
  };
  const crumbs = trail(flow, project);

  return (
    <div className="space-y-3" data-testid={testId}>
      {tiles && (
        <IndicatorTiles
          rows={model.rows}
          value={key}
          onChange={(k) => {
            setKey(k);
            setSelected(null);
          }}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Posisi di diagram" className="flex flex-wrap items-center gap-1 text-xs">
          {crumbs.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-navy-700/40" aria-hidden />}
              {i === 0 && crumbs.length > 1 ? (
                <button type="button" className="font-medium text-brand-blue hover:underline" onClick={reset}>
                  {c}
                </button>
              ) : (
                <span className={cn(i === crumbs.length - 1 && "font-semibold text-navy-900")}>{c}</span>
              )}
            </span>
          ))}
          {crumbs.length > 1 && (
            <button type="button" onClick={reset} className="ml-2 inline-flex items-center gap-1 text-navy-700/70 hover:text-navy-900" data-testid={`${testId}-reset`}>
              <RotateCcw className="h-3 w-3" /> Kembali ke tampilan awal
            </button>
          )}
        </nav>
        {compare && (
          <div className="inline-flex rounded-lg border border-sand-200 p-0.5 text-xs" role="radiogroup" aria-label="Sebelum atau sesudah">
            {[
              { id: false, l: `Sesudah: ${compare.label}` },
              { id: true, l: "Sebelum (kondisi sekarang)" },
            ].map((o) => (
              <button
                key={String(o.id)}
                type="button"
                role="radio"
                aria-checked={showBefore === o.id}
                onClick={() => setShowBefore(o.id)}
                className={cn("rounded-md px-2 py-1", showBefore === o.id ? "bg-navy-900 text-white" : "text-navy-800")}
              >
                {o.l}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={cn("grid gap-4", panel && "xl:grid-cols-[1fr_300px]")}>
        <div className="min-w-0 rounded-xl border border-sand-200 bg-white p-3">
          <FlowSankey
            flow={flow}
            label={label}
            format={format}
            selected={selected?.id ?? null}
            highlightStage={highlightStage}
            deltas={changes && !showBefore ? nodeDeltas(changes) : undefined}
            linkNote={changes ? linkNote : undefined}
            onSelect={(n) => setSelected(selected?.id === n.id ? null : n)}
            onHoverStage={(s) => onHoverStage?.(s as StageCode | null)}
            testId={`${testId}-sankey`}
          />
          <p className="mt-2 text-[11px] text-navy-700/60">
            Lebar pita = besar {INDICATOR[key].label.toLowerCase()} per 1 m² permukaan dilapisi. Warna tahap = kelas porsi seperti di Titik Boros. Arahkan kursor untuk angka, klik kotak untuk saran.
          </p>
        </div>
        {panel && (
          <SuggestionPanel project={project} model={model} outcomes={outcomes} indicator={key} node={selected} flowTotal={flow.total} onDrill={drill} format={format} testId={`${testId}-panel`} />
        )}
      </div>
    </div>
  );
}

function SuggestionPanel({
  project,
  model,
  outcomes,
  indicator,
  node,
  flowTotal,
  onDrill,
  format,
  testId,
}: {
  project: Project;
  model: ReturnType<typeof buildTitikBoros>;
  outcomes: ScenarioOutcome[];
  indicator: IndicatorKey;
  node: FlowNode | null;
  flowTotal: number;
  onDrill: (n: FlowNode) => void;
  format: (v: number) => string;
  testId: string;
}) {
  const row = model.rows.find((r) => r.key === indicator)!;
  const label = node ? nodeLabel(node, project, indicator) : "";
  const share = node && flowTotal > 0 ? (node.value / flowTotal) * 100 : 0;
  return (
    <aside className="rounded-xl border border-sand-200 bg-white p-4 text-xs text-navy-800" data-testid={testId} aria-label="Saran dan alat">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-navy-700/55">Saran & alat</p>
      {!node ? (
        <div className="mt-3 flex gap-2 text-navy-700/75">
          <Lightbulb className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden />
          <p>Klik kotak tahap atau sumber di diagram untuk melihat angkanya, pemicunya, alasan teknis, dan perbaikan yang bisa dicoba.</p>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-navy-900">{label}</p>
            {node.severity && (
              <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: SEVERITY_STYLE[node.severity].bg, color: SEVERITY_STYLE[node.severity].fg }}>
                <SeverityIcon s={node.severity} /> {BADGE[node.severity]}
              </span>
            )}
          </div>
          <p>
            <b className="text-navy-900">{format(node.valuePerFU)}</b> · {fmtPct(share)} dari yang tampil
          </p>
          {node.type === "stage" && <StageAdvice project={project} model={model} outcomes={outcomes} stage={node.key as StageCode} indicator={indicator} row={row} />}
          {node.type === "component" && <p className="text-navy-700/75">Angka ini dari data Anda. Ubah atau perbarui di Data Saya bila sudah ada angka meter atau faktur yang lebih baru.</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {(node.type === "stage" || node.type === "kind") && (
              <button type="button" onClick={() => onDrill(node)} className="inline-flex items-center gap-1 rounded-lg border border-navy-900 px-2 py-1 font-medium text-navy-900 hover:bg-navy-900 hover:text-white" data-testid={`${testId}-drill`}>
                <ZoomIn className="h-3.5 w-3.5" /> Telusuri lebih dalam
              </button>
            )}
            {node.type === "component" && (
              <Link href="/data" className="inline-flex items-center gap-1 font-medium text-brand-blue hover:underline">
                Buka Data Saya <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function StageAdvice({
  project,
  model,
  outcomes,
  stage,
  indicator,
  row,
}: {
  project: Project;
  model: ReturnType<typeof buildTitikBoros>;
  outcomes: ScenarioOutcome[];
  stage: StageCode;
  indicator: IndicatorKey;
  row: ReturnType<typeof buildTitikBoros>["rows"][number];
}) {
  const box = model.stages.find((b) => b.stage === stage)!;
  const reasons = reasonsFor(project, model, box);
  const levers = leversFor(stage, outcomes);
  return (
    <>
      {row.drivers[stage].length > 0 && (
        <div>
          <p className="font-semibold text-navy-900">Pemicunya</p>
          <ul className="mt-0.5 space-y-0.5">
            {row.drivers[stage].slice(0, 3).map((d, i) => (
              <li key={i}>• {driverText(d, row, project)}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="font-semibold text-navy-900">Kenapa bisa boros</p>
        {reasons.length ? reasons.map((r, i) => <p key={i} className="mt-0.5">{r.text}</p>) : <p className="mt-0.5">{NO_REASON_TEXT}</p>}
      </div>
      <div>
        <p className="font-semibold text-navy-900">Yang bisa dicoba</p>
        {levers.length ? (
          <ul className="mt-1 space-y-1.5">
            {levers.map((o) => (
              <li key={o.scenario.id} className="rounded-lg bg-sand-50 px-2 py-1.5">
                <p>
                  {o.scenario.name} — hemat <b>{fmtRp(o.lcc.annualSavingRp)}</b> per tahun
                  {indicator === "gwp" && o.delta.ccKg.pct !== 0 && <> · jejak karbon {o.delta.ccKg.pct < 0 ? "−" : "+"}{Math.abs(o.delta.ccKg.pct).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</>}
                </p>
                <Link href={`/simulasi?skenario=${encodeURIComponent(o.scenario.id)}`} className="inline-flex items-center gap-1 font-medium text-brand-blue hover:underline">
                  Lihat perhitungannya <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-0.5">Belum ada simulasi yang menghemat biaya untuk tahap ini.</p>
        )}
      </div>
    </>
  );
}
