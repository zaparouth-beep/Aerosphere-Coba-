"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Sankey,
  Layer,
  Rectangle,
} from "recharts";
import { cn } from "@/lib/utils/cn";
import { CATEGORICAL, CHROME, sequentialColor } from "./palette";

const AXIS_TICK = { fontSize: 11, fill: CHROME.muted };

function TooltipBox({ title, rows }: { title?: string; rows: Array<{ label: string; value: string; color?: string }> }) {
  return (
    <div className="rounded-lg border border-sand-300 bg-white px-3 py-2 text-xs shadow-lg">
      {title && <p className="mb-1 font-semibold text-navy-900">{title}</p>}
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-navy-800">
          {r.color && <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />}
          <span className="text-navy-700/70">{r.label}</span>
          <span className="num ml-auto font-medium">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* BarList — horizontal magnitude bars in HTML (always labelled, accessible) */
/* ------------------------------------------------------------------------ */
export function BarList({
  items,
  format,
  emptyText = "Belum ada data.",
}: {
  items: Array<{ label: string; value: number; color?: string; note?: string }>;
  format: (v: number) => string;
  emptyText?: string;
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 0);
  if (!items.length || max === 0) return <p className="py-6 text-center text-xs text-navy-700/55">{emptyText}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label} title={`${i.label}: ${format(i.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-navy-800">{i.label}</span>
            <span className="num shrink-0 font-medium text-navy-900">
              {format(i.value)}
              {i.note && <span className="ml-1 font-normal text-navy-700/55">{i.note}</span>}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-sand-100">
            <div className="h-2 rounded-full" style={{ width: `${(Math.abs(i.value) / max) * 100}%`, background: i.color ?? CATEGORICAL[0] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------ */
/* Share100 — 100% stacked bar per row (stage contribution per category)     */
/* ------------------------------------------------------------------------ */
export function Share100({
  rows,
  segments,
}: {
  rows: Array<{ label: string; shares: Record<string, number> }>;
  segments: Array<{ id: string; label: string; color: string }>;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1" aria-label="Legenda">
        {segments.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 text-[11px] text-navy-800">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(110px,180px)_1fr] items-center gap-3">
            <span className="truncate text-xs text-navy-800" title={r.label}>
              {r.label}
            </span>
            <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded">
              {segments.map((s) => {
                const v = r.shares[s.id] ?? 0;
                if (v <= 0) return null;
                return (
                  <div
                    key={s.id}
                    title={`${r.label} · ${s.label}: ${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`}
                    className="flex h-full items-center justify-center text-[10px] font-semibold text-white"
                    style={{ width: `${v}%`, background: s.color }}
                  >
                    {v >= 12 ? `${s.id}` : ""}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Heatmap — stage × metric, sequential single hue, threshold outlined       */
/* ------------------------------------------------------------------------ */
export function Heatmap({
  rows,
  columns,
  value,
  threshold,
  onCellClick,
  selected,
}: {
  rows: Array<{ id: string; label: string }>;
  columns: Array<{ id: string; label: string }>;
  value: (row: string, col: string) => number | undefined;
  threshold: number;
  onCellClick?: (row: string, col: string) => void;
  selected?: { row: string; col: string } | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-white px-2 py-1 text-left font-medium text-navy-700/70">Tahap</th>
            {columns.map((c) => (
              <th key={c.id} scope="col" className="min-w-[78px] px-1 py-1 text-center text-[11px] font-medium leading-tight text-navy-700/80">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" className="sticky left-0 whitespace-nowrap bg-white px-2 py-1 text-left font-medium text-navy-900">
                {r.label}
              </th>
              {columns.map((c) => {
                const v = value(r.id, c.id);
                const t = v === undefined ? 0 : Math.min(v / 100, 1);
                const hot = v !== undefined && v >= threshold;
                const isSel = selected?.row === r.id && selected?.col === c.id;
                return (
                  <td key={c.id} className="p-0">
                    <button
                      type="button"
                      disabled={v === undefined}
                      onClick={() => onCellClick?.(r.id, c.id)}
                      title={v === undefined ? "Tidak ada data" : `${r.label} · ${c.label}: ${v.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%${hot ? " (hotspot)" : ""}`}
                      className={cn(
                        "num flex h-9 w-full items-center justify-center rounded-md text-[11px] font-medium transition-shadow",
                        hot && "ring-2 ring-navy-900",
                        isSel && "outline outline-2 outline-offset-1 outline-brand-gold",
                        v === undefined && "bg-sand-50 text-navy-700/30",
                      )}
                      style={v === undefined ? undefined : { background: sequentialColor(t), color: t > 0.5 ? "#fff" : CHROME.text }}
                    >
                      {v === undefined ? "–" : `${v.toLocaleString("id-ID", { maximumFractionDigits: 0 })}%`}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Pareto — share bars + cumulative share line (both in %, one axis)         */
/* ------------------------------------------------------------------------ */
export function ParetoChart({ data, height = 280 }: { data: Array<{ name: string; sharePct: number; cumulativePct: number; top20: boolean }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 48, left: 0 }}>
        <CartesianGrid vertical={false} stroke={CHROME.grid} />
        <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={60} axisLine={{ stroke: CHROME.axis }} tickLine={false} />
        <YAxis domain={[0, 100]} unit="%" tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
        <ReferenceLine y={80} stroke={CHROME.muted} strokeDasharray="4 4" label={{ value: "80%", fontSize: 10, fill: CHROME.muted, position: "right" }} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]!.payload as (typeof data)[number];
            return <TooltipBox title={d.name} rows={[{ label: "Kontribusi", value: `${d.sharePct.toFixed(1)}%` }, { label: "Kumulatif", value: `${d.cumulativePct.toFixed(1)}%` }]} />;
          }}
        />
        <Bar dataKey="sharePct" name="Kontribusi" radius={[4, 4, 0, 0]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.top20 ? CATEGORICAL[0] : "#a3c4e0"} />
          ))}
        </Bar>
        <Line type="monotone" dataKey="cumulativePct" name="Kumulatif" stroke={CATEGORICAL[3]} strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------------ */
/* Waterfall — baseline → per-lever delta → scenario                         */
/* ------------------------------------------------------------------------ */
export function Waterfall({ steps, format, height = 260 }: { steps: Array<{ label: string; value: number; delta: number }>; format: (v: number) => string; height?: number }) {
  const last = steps[steps.length - 1];
  const data = [
    ...steps.map((s, idx) =>
      idx === 0
        ? { label: s.label, base: 0, size: s.value, kind: "total", raw: s.value }
        : { label: s.label, base: Math.min(s.value, s.value - s.delta), size: Math.abs(s.delta), kind: s.delta <= 0 ? "down" : "up", raw: s.delta },
    ),
    ...(last && steps.length > 1 ? [{ label: "Skenario", base: 0, size: last.value, kind: "total", raw: last.value }] : []),
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid vertical={false} stroke={CHROME.grid} />
        <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={{ stroke: CHROME.axis }} tickLine={false} interval={0} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => format(v)} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]!.payload as (typeof data)[number];
            return <TooltipBox title={d.label} rows={[{ label: d.kind === "total" ? "Nilai" : "Δ", value: format(d.raw) }]} />;
          }}
        />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="size" stackId="w" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.kind === "total" ? CATEGORICAL[0] : d.kind === "down" ? CHROME.positive : CHROME.negative} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------------ */
/* Tornado — ±10% one-at-a-time sensitivity around the base value            */
/* ------------------------------------------------------------------------ */
export function Tornado({ rows, base, format, height }: { rows: Array<{ parameter: string; low: number; high: number; lowLabel: string; highLabel: string }>; base: number; format: (v: number) => string; height?: number }) {
  const data = rows.map((r) => ({ name: r.parameter, low: r.low - base, high: r.high - base, raw: r }));
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(160, rows.length * 44 + 40)}>
      <BarChart data={data} layout="vertical" stackOffset="sign" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={CHROME.grid} />
        <XAxis type="number" tick={AXIS_TICK} axisLine={{ stroke: CHROME.axis }} tickLine={false} tickFormatter={(v: number) => format(v)} />
        <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fill: CHROME.text }} width={150} axisLine={false} tickLine={false} />
        <ReferenceLine x={0} stroke={CHROME.text} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]!.payload as (typeof data)[number];
            return (
              <TooltipBox
                title={d.name}
                rows={[
                  { label: `${d.raw.lowLabel}`, value: `${format(d.raw.low)} (Δ ${format(d.low)})`, color: CATEGORICAL[4] },
                  { label: `${d.raw.highLabel}`, value: `${format(d.raw.high)} (Δ ${format(d.high)})`, color: CATEGORICAL[3] },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="low" stackId="t" fill={CATEGORICAL[4]} radius={[4, 0, 0, 4]} maxBarSize={22} />
        <Bar dataKey="high" stackId="t" fill={CATEGORICAL[3]} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------------ */
/* Decision bubble — Δ cost × Δ climate change, size = |Δ water|             */
/* ------------------------------------------------------------------------ */
export function DecisionBubble({ points, height = 260 }: { points: Array<{ code: string; name: string; dCostPct: number; dCcPct: number; dWaterPct: number; color: string }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 8 }}>
        <CartesianGrid stroke={CHROME.grid} />
        <XAxis type="number" dataKey="dCostPct" name="Δ biaya" unit="%" tick={AXIS_TICK} axisLine={{ stroke: CHROME.axis }} label={{ value: "Δ biaya (%)", position: "insideBottom", offset: -12, fontSize: 11, fill: CHROME.muted }} />
        <YAxis type="number" dataKey="dCcPct" name="Δ climate change" unit="%" tick={AXIS_TICK} axisLine={false} width={48} label={{ value: "Δ GWP (%)", angle: -90, position: "insideLeft", fontSize: 11, fill: CHROME.muted }} />
        <ZAxis type="number" dataKey="size" range={[80, 600]} />
        <ReferenceLine x={0} stroke={CHROME.axis} />
        <ReferenceLine y={0} stroke={CHROME.axis} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]!.payload as (typeof points)[number];
            return (
              <TooltipBox
                title={`${d.code} ${d.name}`}
                rows={[
                  { label: "Δ biaya", value: `${d.dCostPct.toFixed(1)}%` },
                  { label: "Δ GWP", value: `${d.dCcPct.toFixed(1)}%` },
                  { label: "Δ air", value: `${d.dWaterPct.toFixed(1)}%` },
                ]}
              />
            );
          }}
        />
        <Scatter
          data={points.map((p) => ({ ...p, size: Math.abs(p.dWaterPct) + 1 }))}
          shape={(props: { cx?: number; cy?: number; payload?: (typeof points)[number] & { size: number }; r?: number }) => {
            const { cx = 0, cy = 0, payload } = props;
            const r = Math.min(26, 7 + Math.sqrt(payload?.size ?? 1) * 2.4);
            return (
              <g>
                <circle cx={cx} cy={cy} r={r} fill={payload?.color} fillOpacity={0.85} stroke="#fff" strokeWidth={2} />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff">
                  {payload?.code}
                </text>
              </g>
            );
          }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------------ */
/* Trend line across locked runs                                             */
/* ------------------------------------------------------------------------ */
export function TrendLine({ data, format, height = 220, target }: { data: Array<{ label: string; value: number }>; format: (v: number) => string; height?: number; target?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid vertical={false} stroke={CHROME.grid} />
        <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={{ stroke: CHROME.axis }} tickLine={false} />
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => format(v)} />
        {target !== undefined && <ReferenceLine y={target} stroke={CATEGORICAL[2]} strokeDasharray="5 4" label={{ value: "Target", fontSize: 10, fill: CATEGORICAL[2], position: "right" }} />}
        <Tooltip content={({ active, payload, label }) => (active && payload?.length ? <TooltipBox title={String(label)} rows={[{ label: "Nilai", value: format(Number(payload[0]!.value)) }]} /> : null)} />
        <Line type="monotone" dataKey="value" stroke={CATEGORICAL[0]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------------ */
/* Bullet — actual vs target vs baseline (progress to target)                */
/* ------------------------------------------------------------------------ */
export function Bullet({ label, achievedPct, targetPct, note }: { label: string; achievedPct: number; targetPct: number; note?: string }) {
  const max = Math.max(targetPct * 1.25, achievedPct, 1);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-navy-800">{label}</span>
        <span className="num text-navy-900">
          {achievedPct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% <span className="text-navy-700/55">/ target {targetPct}%</span>
        </span>
      </div>
      <div className="relative h-3 w-full rounded bg-sand-100">
        <div className="absolute inset-y-0 left-0 rounded bg-sand-200" style={{ width: `${(targetPct / max) * 100}%` }} />
        <div className="absolute inset-y-[3px] left-0 rounded bg-brand-teal" style={{ width: `${(Math.max(achievedPct, 0) / max) * 100}%` }} />
        <div className="absolute -inset-y-0.5 w-0.5 bg-navy-900" style={{ left: `${(targetPct / max) * 100}%` }} title={`Target ${targetPct}%`} />
      </div>
      {note && <p className="mt-1 text-[11px] text-navy-700/55">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Sankey — material or cost: inputs → stages → positive / negative product  */
/* ------------------------------------------------------------------------ */
export interface SankeyData {
  nodes: Array<{ name: string; color: string }>;
  links: Array<{ source: number; target: number; value: number }>;
}

export function SankeyChart({ data, format, height = 340 }: { data: SankeyData; format: (v: number) => string; height?: number }) {
  if (!data.links.length) return <p className="py-10 text-center text-xs text-navy-700/55">Belum ada aliran untuk digambar.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={data}
        nodePadding={18}
        nodeWidth={10}
        margin={{ top: 8, right: 210, bottom: 8, left: 8 }}
        link={{ stroke: "#a3c4e0", strokeOpacity: 0.45 }}
        node={(props: { x: number; y: number; width: number; height: number; index: number; payload: { name: string; value: number; color?: string } }) => {
          const { x, y, width, height: h, payload } = props;
          return (
            <Layer>
              <Rectangle x={x} y={y} width={width} height={h} fill={payload.color ?? CATEGORICAL[0]} fillOpacity={1} radius={2} />
              <text x={x + width + 6} y={y + h / 2} dy={4} fontSize={11} fill={CHROME.text}>
                {payload.name} · {format(payload.value)}
              </text>
            </Layer>
          );
        }}
      >
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0]!.payload as { source?: { name: string }; target?: { name: string }; value: number; name?: string; payload?: { source?: { name: string }; target?: { name: string }; value: number } };
            const inner = p.payload ?? p;
            const title = inner.source && inner.target ? `${inner.source.name} → ${inner.target.name}` : (p.name ?? "");
            return <TooltipBox title={title} rows={[{ label: "Nilai", value: format(inner.value) }]} />;
          }}
        />
      </Sankey>
    </ResponsiveContainer>
  );
}
