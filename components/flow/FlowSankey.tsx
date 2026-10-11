"use client";

import { useMemo, useRef, useState } from "react";
import type { Flow, FlowLink, FlowNode } from "@/lib/engine/flow";
import { cn } from "@/lib/utils/cn";
import { SEVERITY_STYLE } from "@/lib/view/titikBoros";

/**
 * Flow diagram (Sankey) drawn in SVG: columns of nodes whose height is the
 * value, joined by bands. Hover shows the value, click selects a node.
 * Colours: stage nodes and their bands use the Titik Boros severity class.
 */

const W = 1000;
const NODE_W = 14;
const PAD = 10;
const LEFT = 230;
const RIGHT = 170;
const NAVY = "#0B1660";
const TEAL = "#0E7C86";
const SOFT = "#9DB3CC";

/** Long names are shortened in the diagram; the full name is in the tooltip and the panel. */
const short = (t: string, max = 30) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);

interface Placed {
  node: FlowNode;
  x: number;
  y: number;
  h: number;
}

export interface FlowSankeyProps {
  flow: Flow;
  label: (n: FlowNode) => string;
  format: (perFU: number) => string;
  selected?: string | null;
  highlightStage?: string | null;
  deltas?: Record<string, number>;
  linkNote?: (l: FlowLink) => string | null;
  onSelect?: (n: FlowNode) => void;
  onHoverStage?: (stage: string | null) => void;
  testId?: string;
}

export function FlowSankey({ flow, label, format, selected, highlightStage, deltas, linkNote, onSelect, onHoverStage, testId }: FlowSankeyProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ kind: "link" | "node"; id: string; x: number; y: number } | null>(null);

  const layout = useMemo(() => {
    const columns = [...new Set(flow.nodes.map((n) => n.column))].sort((a, b) => a - b);
    const byCol = columns.map((c) => flow.nodes.filter((n) => n.column === c));
    const maxCount = Math.max(1, ...byCol.map((c) => c.length));
    const H = Math.max(320, Math.min(820, maxCount * 34 + 40));
    const maxSum = Math.max(1e-12, ...byCol.map((c) => c.reduce((s, n) => s + n.value, 0)));
    const k = (H - PAD * (maxCount - 1)) / maxSum;
    const span = W - LEFT - RIGHT - NODE_W;
    const placed = new Map<string, Placed>();
    byCol.forEach((nodes, ci) => {
      const x = LEFT + (columns.length > 1 ? (span * ci) / (columns.length - 1) : 0);
      const used = nodes.reduce((s, n) => s + Math.max(n.value * k, 2), 0) + PAD * (nodes.length - 1);
      let y = Math.max(0, (H - used) / 2);
      for (const n of nodes) {
        const h = Math.max(n.value * k, 2);
        placed.set(n.id, { node: n, x, y, h });
        y += h + PAD;
      }
    });
    const outY = new Map<string, number>();
    const inY = new Map<string, number>();
    const index = (id: string) => flow.nodes.findIndex((n) => n.id === id);
    const links = [...flow.links]
      .sort((a, b) => index(a.source) - index(b.source) || index(a.target) - index(b.target))
      .map((l) => {
        const s = placed.get(l.source)!;
        const t = placed.get(l.target)!;
        const th = Math.max(l.value * k, 1);
        const y0 = s.y + (outY.get(l.source) ?? 0);
        const y1 = t.y + (inY.get(l.target) ?? 0);
        outY.set(l.source, (outY.get(l.source) ?? 0) + th);
        inY.set(l.target, (inY.get(l.target) ?? 0) + th);
        const x0 = s.x + NODE_W;
        const x1 = t.x;
        const xm = (x0 + x1) / 2;
        const d = `M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + th} C${xm},${y1 + th} ${xm},${y0 + th} ${x0},${y0 + th} Z`;
        return { l, d, mid: { x: xm, y: (y0 + y1) / 2 + th / 2 } };
      });
    return { H, placed, links, lastX: LEFT + span };
  }, [flow]);

  const fillOf = (n: FlowNode) => (n.type === "stage" && n.severity ? SEVERITY_STYLE[n.severity].bg : n.type === "total" ? TEAL : n.type === "kind" ? NAVY : SOFT);
  const linkColor = (l: FlowLink) => (l.severity ? SEVERITY_STYLE[l.severity].bg : SOFT);
  const touches = (l: FlowLink, id: string) => l.source === id || l.target === id;
  const stageOf = (id: string) => (id.startsWith("stage:") ? id.slice(6) : null);
  const activeStage = highlightStage ? `stage:${highlightStage}` : null;

  const move = (e: React.MouseEvent, kind: "link" | "node", id: string) => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setHover({ kind, id, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const hoveredLink = hover?.kind === "link" ? layout.links.find((x) => `${x.l.source}→${x.l.target}` === hover.id)?.l : undefined;
  const hoveredNode = hover?.kind === "node" ? layout.placed.get(hover.id)?.node : undefined;
  const focusId = hoveredNode?.id ?? selected ?? activeStage;

  if (!flow.links.length) return <p className="py-10 text-center text-xs text-navy-700/60">Belum ada aliran untuk indikator ini.</p>;

  return (
    <div ref={ref} className="relative w-full overflow-x-auto" data-testid={testId}>
      <svg viewBox={`0 0 ${W} ${layout.H}`} className="h-auto w-full min-w-[640px]" role="img" aria-label="Diagram alur">
        {layout.links.map(({ l, d }) => {
          const id = `${l.source}→${l.target}`;
          const lit = hover?.kind === "link" ? hover.id === id : focusId ? touches(l, focusId) : false;
          const dim = (hover || focusId) && !lit;
          return (
            <path
              key={id}
              d={d}
              data-link={id}
              fill={linkColor(l)}
              fillOpacity={lit ? 0.62 : dim ? 0.12 : 0.32}
              stroke="#ffffff"
              strokeWidth={0.6}
              onMouseMove={(e) => move(e, "link", id)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        {[...layout.placed.values()].map(({ node, x, y, h }) => {
          const last = x >= layout.lastX - 1;
          const first = node.column === 0;
          const tx = first ? x - 8 : last ? x + NODE_W + 8 : x + NODE_W + 6;
          const anchor = first ? "end" : "start";
          const delta = deltas?.[node.id];
          const isSel = selected === node.id || activeStage === node.id;
          return (
            <g
              key={node.id}
              data-node={node.id}
              role="button"
              tabIndex={0}
              aria-label={`${label(node)}: ${format(node.valuePerFU)}`}
              aria-pressed={selected === node.id}
              className="cursor-pointer focus:outline-none"
              onClick={() => onSelect?.(node)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(node);
                }
              }}
              onMouseMove={(e) => move(e, "node", node.id)}
              onMouseEnter={() => onHoverStage?.(stageOf(node.id))}
              onMouseLeave={() => {
                setHover(null);
                onHoverStage?.(null);
              }}
            >
              <rect x={x} y={y} width={NODE_W} height={h} rx={2} fill={fillOf(node)} stroke={isSel ? NAVY : node.severity === "red" ? "#3B0A0A" : "none"} strokeWidth={isSel ? 3 : 1.5} />
              <text x={tx} y={y + h / 2} dy={h >= 26 ? -2 : 4} fontSize={11.5} textAnchor={anchor} fill="#14213D" style={{ paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3 }} fontWeight={isSel ? 700 : 600}>
                {short(label(node))}
                {h >= 26 ? (
                  <tspan x={tx} dy={13} fill="#55607A" fontWeight={400}>
                    {format(node.valuePerFU)}
                    {delta !== undefined && Math.abs(delta) >= 0.05 && (
                      <tspan fill={delta < 0 ? "#1F7A3D" : "#A61B1B"} fontWeight={700}>
                        {" "}
                        {delta < 0 ? "▼" : "▲"} {Math.abs(delta).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
                      </tspan>
                    )}
                  </tspan>
                ) : first ? null : (
                  <tspan fill="#55607A" fontWeight={400}>
                    {" "}
                    · {format(node.valuePerFU)}
                    {delta !== undefined && Math.abs(delta) >= 0.05 && (
                      <tspan fill={delta < 0 ? "#1F7A3D" : "#A61B1B"} fontWeight={700}>
                        {" "}
                        {delta < 0 ? "▼" : "▲"} {Math.abs(delta).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
                      </tspan>
                    )}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && (hoveredLink || hoveredNode) && (
        <div
          role="tooltip"
          className={cn("pointer-events-none absolute z-30 max-w-xs rounded-lg bg-navy-950/95 px-3 py-2 text-xs text-white shadow-xl")}
          style={{ left: Math.min(hover.x + 14, (ref.current?.clientWidth ?? 600) - 240), top: hover.y + 14 }}
        >
          {hoveredLink ? (
            <>
              <p className="text-base font-semibold">{format(hoveredLink.valuePerFU)}</p>
              <p className="text-white/75">
                {label(layout.placed.get(hoveredLink.source)!.node)} → {label(layout.placed.get(hoveredLink.target)!.node)}
              </p>
              {linkNote?.(hoveredLink) && <p className="mt-1 text-white/90">{linkNote(hoveredLink)}</p>}
            </>
          ) : hoveredNode ? (
            <>
              <p className="text-base font-semibold">{format(hoveredNode.valuePerFU)}</p>
              <p className="text-white/75">{label(hoveredNode)}</p>
              {hoveredNode.severity && <p className="mt-1">Kelas: {SEVERITY_STYLE[hoveredNode.severity].label}</p>}
              <p className="mt-1 text-white/60">Klik untuk melihat saran</p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
