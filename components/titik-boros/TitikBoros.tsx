"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowRight, ChevronDown, ChevronUp, ChevronsUp, Copy, FileSpreadsheet, Minus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Tabs";
import type { Project } from "@/lib/domain/types";
import type { ScenarioOutcome } from "@/lib/engine/scenario";
import type { IndicatorKey, Severity, TitikBorosModel, TitikBorosRow, TitikBorosStage } from "@/lib/engine/titikBoros";
import { SEVERITIES } from "@/lib/engine/titikBoros";
import { STAGE_CODES, type StageCode } from "@/lib/engine/types";
import { cn } from "@/lib/utils/cn";
import { fmtRp } from "@/lib/utils/format";
import {
  BADGE,
  driverText,
  fmt3,
  fmtPct,
  fmtValue,
  fullStage,
  GROUP_LABEL,
  INDICATOR,
  leversFor,
  NO_REASON_TEXT,
  perFuText,
  reasonsFor,
  SEVERITY_STYLE,
  STAGE_SHORT,
  stageName,
  summarySentence,
  unitOf,
} from "@/lib/view/titikBoros";

export interface Focus {
  stage: StageCode | null;
  key: IndicatorKey | null;
  source: "chart" | "table" | "box" | null;
}
export const NO_FOCUS: Focus = { stage: null, key: null, source: null };

const ICON: Record<Severity, typeof AlertTriangle> = { red: AlertTriangle, orange: ChevronsUp, yellow: ChevronUp, green: ChevronDown, grey: Minus };
const HATCH = "repeating-linear-gradient(135deg, rgba(0,0,0,0.07) 0 4px, transparent 4px 8px)";

export function SeverityIcon({ s, className }: { s: Severity; className?: string }) {
  const I = ICON[s];
  return <I className={cn("h-3 w-3 shrink-0", className)} aria-hidden />;
}

const cellStyle = (s: Severity): React.CSSProperties => ({
  background: SEVERITY_STYLE[s].bg,
  color: SEVERITY_STYLE[s].fg,
  backgroundImage: s === "grey" ? HATCH : undefined,
});

/* --------------------------------- Legend --------------------------------- */

export function Legend({ thresholdPct }: { thresholdPct: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" aria-label="Legenda warna">
      <span className="font-medium text-navy-900">Warna = porsi tahap dalam satu indikator:</span>
      {SEVERITIES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5" data-severity={s}>
          <span className="inline-flex h-5 items-center gap-1 rounded px-1.5 text-[11px] font-semibold" style={cellStyle(s)}>
            <SeverityIcon s={s} />
            {SEVERITY_STYLE[s].label}
          </span>
          <span className="text-navy-700/70">{SEVERITY_STYLE[s].range(thresholdPct)}</span>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------ Area A: chart ------------------------------ */

export function StackedChart({
  project,
  model,
  focus,
  pinned,
  onFocus,
  expert,
}: {
  project: Project;
  model: TitikBorosModel;
  focus: Focus;
  pinned: StageCode | null;
  onFocus: (f: Focus) => void;
  expert: boolean;
}) {
  return (
    <div className="space-y-5">
      {(["impact", "use"] as const).map((group) => (
        <div key={group} role="group" aria-label={GROUP_LABEL[group]}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-navy-700/60">{GROUP_LABEL[group]}</p>
          <div className="space-y-4">
            {model.rows
              .filter((r) => r.group === group)
              .map((r) => (
                <ChartRow key={r.key} project={project} row={r} focus={focus} pinned={pinned} onFocus={onFocus} expert={expert} />
              ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-navy-700/70" data-testid="not-computed-note">
        {model.notComputedCount} kategori dampak lain belum dihitung (faktor belum tersedia).
      </p>
    </div>
  );
}

function ChartRow({ project, row, focus, pinned, onFocus, expert }: { project: Project; row: TitikBorosRow; focus: Focus; pinned: StageCode | null; onFocus: (f: Focus) => void; expert: boolean }) {
  const visible = STAGE_CODES.filter((s) => row.share[s] > 0);
  const tipStage = focus.source === "chart" && focus.key === row.key ? focus.stage : null;
  return (
    <div className="grid gap-x-3 gap-y-1 lg:grid-cols-[230px_1fr_190px] lg:items-center" data-testid={`bar-${row.key}`}>
      <div className="flex items-baseline justify-between gap-2 lg:block">
        <p className="text-sm font-medium text-navy-900" title={expert ? INDICATOR[row.key].expert : undefined}>
          {INDICATOR[row.key].label}
        </p>
        <p className="num text-xs font-semibold text-navy-900 lg:hidden">{perFuText(row.totalPerFU, row)}</p>
      </div>
      <div className="relative">
        <div className="flex h-9 w-full overflow-visible rounded-md bg-sand-100">
          {visible.map((s, i) => {
            const sev = row.severity[s];
            const active = (focus.stage === s && (focus.key === row.key || focus.source === "box")) || pinned === s;
            const dim = (focus.stage || pinned) && !active;
            return (
              <button
                key={s}
                type="button"
                data-testid={`seg-${row.key}-${s}`}
                data-severity={sev}
                aria-label={`${INDICATOR[row.key].label}, ${fullStage(s)}: ${fmtPct(row.share[s])}, ${SEVERITY_STYLE[sev].label}`}
                onMouseEnter={() => onFocus({ stage: s, key: row.key, source: "chart" })}
                onMouseLeave={() => onFocus({ stage: null, key: null, source: null })}
                onFocus={() => onFocus({ stage: s, key: row.key, source: "chart" })}
                onBlur={() => onFocus({ stage: null, key: null, source: null })}
                className={cn(
                  "relative flex h-full min-w-0 items-center justify-center gap-1 overflow-hidden text-[11px] font-semibold transition-opacity focus:outline-none",
                  i > 0 && "border-l border-white",
                  i === 0 && "rounded-l-md",
                  i === visible.length - 1 && "rounded-r-md",
                  dim && "opacity-45",
                )}
                style={{
                  width: `${row.share[s]}%`,
                  ...cellStyle(sev),
                  outline: sev === "red" ? "3px solid #3B0A0A" : active ? "2px solid #0B1660" : undefined,
                  outlineOffset: sev === "red" ? "-3px" : "-2px",
                }}
              >
                {row.share[s] >= 8 && (
                  <>
                    <SeverityIcon s={sev} className="hidden sm:block" />
                    <span className="truncate">
                      {s}
                      <span className="hidden sm:inline"> {fmtPct(row.share[s])}</span>
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        {/* "TITIK BOROS" label under every red segment. */}
        <div className="relative h-4">
          {(() => {
            let left = 0;
            return STAGE_CODES.map((s) => {
              const start = left;
              left += row.share[s];
              if (row.severity[s] !== "red") return null;
              return (
                <span key={s} className="absolute top-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-[#A61B1B]" style={{ left: `${start}%`, width: `${Math.max(row.share[s], 14)}%` }}>
                  ▲ Titik boros
                </span>
              );
            });
          })()}
        </div>
        {tipStage && <SegmentTip project={project} row={row} stage={tipStage} />}
      </div>
      <p className="num hidden text-right text-sm font-semibold text-navy-900 lg:block" data-testid={`total-${row.key}`}>
        {perFuText(row.totalPerFU, row)}
      </p>
    </div>
  );
}

function SegmentTip({ project, row, stage }: { project: Project; row: TitikBorosRow; stage: StageCode }) {
  let left = 0;
  for (const s of STAGE_CODES) {
    if (s === stage) break;
    left += row.share[s];
  }
  const center = Math.min(Math.max(left + row.share[stage] / 2, 15), 85);
  const sev = row.severity[stage];
  return (
    <div role="tooltip" className="pointer-events-none absolute top-11 z-30 w-64 -translate-x-1/2 rounded-lg border border-sand-300 bg-white p-3 text-xs shadow-xl" style={{ left: `${center}%` }}>
      <p className="font-semibold text-navy-900">
        {stage}. {stageName(project, stage)}
      </p>
      <p className="mt-1 text-navy-900">
        {perFuText(row.perStage[stage], row)} · <b>{fmtPct(row.share[stage])}</b>
      </p>
      <p className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold" style={cellStyle(sev)}>
        <SeverityIcon s={sev} /> {SEVERITY_STYLE[sev].label}
      </p>
      {row.drivers[stage].length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-navy-800">
          {row.drivers[stage].slice(0, 2).map((d, i) => (
            <li key={i}>• {driverText(d, row, project)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------ Area B: table ------------------------------ */

export function HeatTable({
  project,
  model,
  focus,
  pinned,
  onFocus,
  expert,
  onExcel,
  onCopy,
}: {
  project: Project;
  model: TitikBorosModel;
  focus: Focus;
  pinned: StageCode | null;
  onFocus: (f: Focus) => void;
  expert: boolean;
  onExcel: () => void;
  onCopy: () => void;
}) {
  const [view, setView] = useState<"pct" | "value">("pct");
  const showValues = expert && view === "value";
  return (
    <Card className="h-full">
      <CardHeader
        title="Tabel titik boros"
        subtitle={showValues ? "Nilai per 1 m² permukaan dilapisi; warna = kelas porsi tahap." : "Porsi tiap tahap dalam satu indikator; setiap baris berjumlah 100%."}
        action={
          expert ? (
            <Segmented<"pct" | "value">
              size="xs"
              ariaLabel="Isi sel"
              value={view}
              onChange={setView}
              options={[
                { id: "pct", label: "%" },
                { id: "value", label: "nilai" },
              ]}
            />
          ) : undefined
        }
      />
      <CardBody className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-xs" data-testid="heat-table">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold text-navy-900">Indikator</th>
                <th className="px-2 py-1.5 text-left font-semibold text-navy-900">Satuan</th>
                {STAGE_CODES.map((s) => (
                  <th
                    key={s}
                    title={`${fullStage(s)}${stageName(project, s) !== STAGE_SHORT[s] ? ` (${stageName(project, s)})` : ""}`}
                    className={cn("px-1 py-1.5 text-center font-semibold text-navy-900", (pinned === s || focus.stage === s) && "bg-navy-900/10")}
                  >
                    <span className="block">{s}</span>
                    <span className="block text-[10px] font-normal text-navy-700/70">{STAGE_SHORT[s]}</span>
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right font-semibold text-navy-900">Total</th>
              </tr>
            </thead>
            <tbody>
              {(["impact", "use"] as const).map((group) => (
                <TableGroup key={group} group={group} project={project} model={model} focus={focus} pinned={pinned} onFocus={onFocus} expert={expert} showValues={showValues} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onExcel}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Unduh tabel (Excel)
          </Button>
          <Button size="sm" variant="secondary" onClick={onCopy}>
            <Copy className="h-3.5 w-3.5" /> Salin
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function TableGroup({
  group,
  project,
  model,
  focus,
  pinned,
  onFocus,
  expert,
  showValues,
}: {
  group: "impact" | "use";
  project: Project;
  model: TitikBorosModel;
  focus: Focus;
  pinned: StageCode | null;
  onFocus: (f: Focus) => void;
  expert: boolean;
  showValues: boolean;
}) {
  const rows = model.rows.filter((r) => r.group === group);
  return (
    <>
      <tr>
        <td colSpan={9} className="bg-sand-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-navy-700/70">
          {GROUP_LABEL[group]}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.key} className="border-b border-sand-200" data-testid={`row-${r.key}`}>
          <td className="px-2 py-1.5 text-navy-900" title={expert ? INDICATOR[r.key].expert : undefined}>
            {INDICATOR[r.key].label}
          </td>
          <td className="whitespace-nowrap px-2 py-1.5 text-navy-700/70">{showValues ? `${r.unit === "Rp" ? "Rp" : unitOf(r)}/m²` : "%"}</td>
          {STAGE_CODES.map((s) => {
            const sev = r.severity[s];
            const hit = focus.stage === s && focus.key === r.key;
            const col = pinned === s || (focus.stage === s && focus.source === "box");
            return (
              <td
                key={s}
                data-testid={`cell-${r.key}-${s}`}
                data-severity={sev}
                data-highlight={hit || col ? "true" : undefined}
                title={`${fullStage(s)} · ${perFuText(r.perStage[s], r)} · ${fmtPct(r.share[s])} · ${SEVERITY_STYLE[sev].label}`}
                onMouseEnter={() => onFocus({ stage: s, key: r.key, source: "table" })}
                onMouseLeave={() => onFocus({ stage: null, key: null, source: null })}
                className={cn("num border border-white px-1 py-1.5 text-center", r.topStage === s && "font-bold", hit && "ring-2 ring-inset ring-navy-900", col && !hit && "ring-2 ring-inset ring-navy-900/60")}
                style={cellStyle(sev)}
              >
                <span className="inline-flex items-center justify-center gap-0.5">
                  <SeverityIcon s={sev} className="h-2.5 w-2.5" />
                  {showValues ? fmt3(r.perStage[s]) : fmtPct(r.share[s])}
                </span>
                <span className="sr-only"> {SEVERITY_STYLE[sev].label}</span>
              </td>
            );
          })}
          <td className="num whitespace-nowrap px-2 py-1.5 text-right font-medium text-navy-900">{fmtValue(r.totalPerFU, r)}</td>
        </tr>
      ))}
    </>
  );
}

/* ------------------------------ Area C: boxes ------------------------------ */

export function StageBoxes({
  project,
  model,
  outcomes,
  focus,
  pinned,
  onFocus,
  onPin,
}: {
  project: Project;
  model: TitikBorosModel;
  outcomes: ScenarioOutcome[];
  focus: Focus;
  pinned: StageCode | null;
  onFocus: (f: Focus) => void;
  onPin: (s: StageCode | null) => void;
}) {
  const sentence = summarySentence(project, model);
  const open = model.stages.filter((b) => b.status !== "green" && b.status !== "grey");
  const closed = model.stages.filter((b) => b.status === "green" || b.status === "grey");
  const box = (b: TitikBorosStage) => (
    <StageBox key={b.stage} project={project} model={model} box={b} outcomes={outcomes} focus={focus} pinned={pinned} onFocus={onFocus} onPin={onPin} />
  );
  return (
    <div className="space-y-3" data-testid="stage-boxes">
      {sentence && <p className="text-sm font-medium text-navy-900" data-testid="summary-sentence">{sentence}</p>}
      {open.map(box)}
      {closed.length > 0 && (
        <details className="rounded-xl border border-sand-200 bg-white p-3">
          <summary className="cursor-pointer text-xs font-medium text-brand-blue">Lihat tahap lain ({closed.length})</summary>
          <div className="mt-3 space-y-3">{closed.map(box)}</div>
        </details>
      )}
    </div>
  );
}

function StageBox({
  project,
  model,
  box,
  outcomes,
  focus,
  pinned,
  onFocus,
  onPin,
}: {
  project: Project;
  model: TitikBorosModel;
  box: TitikBorosStage;
  outcomes: ScenarioOutcome[];
  focus: Focus;
  pinned: StageCode | null;
  onFocus: (f: Focus) => void;
  onPin: (s: StageCode | null) => void;
}) {
  const st = SEVERITY_STYLE[box.status];
  const main = model.rows.find((r) => r.key === box.mainIndicator);
  const reasons = reasonsFor(project, model, box);
  const levers = leversFor(box.stage, outcomes);
  const active = pinned === box.stage || focus.stage === box.stage;
  const toggle = () => onPin(pinned === box.stage ? null : box.stage);
  return (
    <article
      data-testid={`box-${box.stage}`}
      data-severity={box.status}
      data-highlight={active ? "true" : undefined}
      onClick={toggle}
      onMouseEnter={() => onFocus({ stage: box.stage, key: null, source: "box" })}
      onMouseLeave={() => onFocus({ stage: null, key: null, source: null })}
      className={cn("cursor-pointer rounded-xl border-l-[6px] border bg-white p-4 shadow-card transition-shadow", active && "ring-2 ring-navy-900")}
      style={{ borderColor: st.bg, borderLeftColor: st.bg }}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-pressed={pinned === box.stage}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="text-left text-sm font-semibold text-navy-900 hover:underline"
          title="Sorot tahap ini di grafik dan tabel"
        >
          {stageName(project, box.stage)}
        </button>
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide" style={cellStyle(box.status)}>
          <SeverityIcon s={box.status} /> {BADGE[box.status]}
        </span>
      </header>
      <ul className="mt-2 space-y-2 text-xs leading-relaxed text-navy-800">
        <li>
          <b className="text-navy-900">Di mana boros: </b>
          {box.hot.length ? (
            box.hot.map((h, i) => (
              <span key={h.key}>
                {i > 0 && "; "}
                {INDICATOR[h.key].label} <b>{fmtPct(h.share)}</b> ({SEVERITY_STYLE[h.severity].label.toLowerCase()})
              </span>
            ))
          ) : (
            <span>tidak ada indikator di kelas merah atau oranye.</span>
          )}
        </li>
        {main && main.drivers[box.stage].length > 0 && (
          <li>
            <b className="text-navy-900">Pemicunya ({INDICATOR[main.key].label.toLowerCase()}): </b>
            {main.drivers[box.stage]
              .slice(0, 3)
              .map((d) => driverText(d, main, project))
              .join("; ")}
          </li>
        )}
        <li>
          <b className="text-navy-900">Kenapa bisa boros: </b>
          {reasons.length ? (
            reasons.map((r, i) => (
              <span key={i} className="block">
                {r.text}{" "}
                {r.refs.map((ref) =>
                  ref.url ? (
                    <a key={ref.code} href={ref.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-brand-blue underline" title={ref.title}>
                      [{ref.code}]
                    </a>
                  ) : (
                    <span key={ref.code} title={ref.title} className="text-navy-700/70">
                      [{ref.code}]
                    </span>
                  ),
                )}
              </span>
            ))
          ) : (
            <span>{NO_REASON_TEXT}</span>
          )}
        </li>
        <li>
          <b className="text-navy-900">Yang bisa dicoba: </b>
          {levers.length ? (
            <span className="mt-1 block space-y-1.5">
              {levers.map((o) => (
                <span key={o.scenario.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sand-50 px-2 py-1.5">
                  <span>
                    {o.scenario.name} — hemat <b>{fmtRp(o.lcc.annualSavingRp)}</b> per tahun
                  </span>
                  <Link
                    href={`/simulasi?skenario=${encodeURIComponent(o.scenario.id)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 font-medium text-brand-blue hover:underline"
                  >
                    Lihat perhitungannya <ArrowRight className="h-3 w-3" />
                  </Link>
                </span>
              ))}
            </span>
          ) : (
            <span>belum ada simulasi perbaikan yang menghemat biaya untuk tahap ini.</span>
          )}
        </li>
      </ul>
    </article>
  );
}
