import { buildTitikBoros, type IndicatorKey, type Severity } from "./titikBoros";
import type { DeviceRole, RunResult, StageCode } from "./types";
import { STAGE_CODES } from "./types";

/**
 * Flow diagrams (inspired by supply-chain Sankey views): what goes into each
 * stage and how the stages add up to the line total, for one indicator, with
 * drill-in on a stage or a source. Values per period; per-m² alongside.
 */

export interface FlowNode {
  id: string;
  column: number;
  /** "kind" = source group (electricity, chemical, …), "component", "stage" or "total". */
  type: "kind" | "component" | "stage" | "total";
  /** Source group, component category, stage code or "total"; the view turns it into words. */
  key: string;
  /** Component name for component nodes. */
  name: string;
  value: number;
  valuePerFU: number;
  severity?: Severity;
  roles?: DeviceRole[];
}

export interface FlowLink {
  source: string;
  target: string;
  value: number;
  valuePerFU: number;
  /** Severity of the stage the link belongs to (colours the band). */
  severity?: Severity;
}

export interface FlowFocus {
  stage?: StageCode;
  kind?: string;
}

export interface Flow {
  key: IndicatorKey;
  unit: string;
  focus: FlowFocus;
  nodes: FlowNode[];
  links: FlowLink[];
  total: number;
  totalPerFU: number;
}

interface Part {
  id: string;
  name: string;
  stage: StageCode;
  kind: string;
  value: number;
  roles: DeviceRole[];
}

/** Every positive contribution of an indicator, with its source group. */
function partsOf(run: RunResult, key: IndicatorKey): { unit: string; parts: Part[] } {
  if (key === "water" || key === "waste_b3" || key === "waste_value") {
    const unit = key === "water" ? "L" : key === "waste_b3" ? "kg" : "Rp";
    const kindOf = (c: { category: string }) => (key === "waste_value" ? c.category : key === "water" ? "water" : "waste_b3");
    return { unit, parts: run.useContributions[key].filter((c) => c.value > 0).map((c) => ({ id: c.componentId, name: c.name, stage: c.stage, kind: kindOf(c), value: c.value, roles: [] })) };
  }
  const impact = run.impacts.find((i) => i.category === key);
  return {
    unit: impact?.unit ?? "",
    parts: (impact?.contributions ?? []).filter((c) => c.value > 0).map((c) => ({ id: c.componentId, name: c.name, stage: c.stage, kind: c.source, value: c.value, roles: c.deviceRole ? [c.deviceRole] : [] })),
  };
}

export function buildFlow(run: RunResult, key: IndicatorKey, focus: FlowFocus = {}, thresholdPct?: number): Flow {
  const area = run.areaPlatedM2 > 0 ? run.areaPlatedM2 : NaN;
  const per = (v: number) => v / area;
  const { unit, parts } = partsOf(run, key);
  const severity = buildTitikBoros(run, { thresholdPct }).rows.find((r) => r.key === key)?.severity;
  const sev = (s: StageCode) => severity?.[s];

  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, FlowLink>();
  const node = (n: Omit<FlowNode, "value" | "valuePerFU">, v: number) => {
    const cur = nodes.get(n.id) ?? { ...n, value: 0, valuePerFU: 0 };
    cur.value += v;
    cur.valuePerFU = per(cur.value);
    if (n.roles) cur.roles = [...new Set([...(cur.roles ?? []), ...n.roles])];
    nodes.set(n.id, cur);
  };
  const link = (source: string, target: string, v: number, s?: Severity) => {
    const id = `${source}→${target}`;
    const cur = links.get(id) ?? { source, target, value: 0, valuePerFU: 0, severity: s };
    cur.value += v;
    cur.valuePerFU = per(cur.value);
    links.set(id, cur);
  };

  const selected = parts.filter((p) => (focus.stage ? p.stage === focus.stage : true) && (focus.kind ? p.kind === focus.kind : true));
  for (const p of selected) {
    const stageId = `stage:${p.stage}`;
    if (focus.stage || focus.kind) {
      // Drill-in: components → stage.
      const compId = `component:${p.id}`;
      node({ id: compId, column: 0, type: "component", key: p.kind, name: p.name, roles: p.roles }, p.value);
      node({ id: stageId, column: 1, type: "stage", key: p.stage, name: "", severity: sev(p.stage) }, p.value);
      link(compId, stageId, p.value, sev(p.stage));
    } else {
      const kindId = `kind:${p.kind}`;
      node({ id: kindId, column: 0, type: "kind", key: p.kind, name: "", roles: p.roles }, p.value);
      node({ id: stageId, column: 1, type: "stage", key: p.stage, name: "", severity: sev(p.stage) }, p.value);
      node({ id: "total", column: 2, type: "total", key: "total", name: "" }, p.value);
      link(kindId, stageId, p.value, sev(p.stage));
      link(stageId, "total", p.value, sev(p.stage));
    }
  }

  const order = (n: FlowNode) => (n.type === "stage" ? STAGE_CODES.indexOf(n.key as StageCode) : -n.value);
  const sortedNodes = [...nodes.values()].sort((a, b) => a.column - b.column || order(a) - order(b));
  const total = selected.reduce((s, p) => s + p.value, 0);
  return { key, unit, focus, nodes: sortedNodes, links: [...links.values()].sort((a, b) => b.value - a.value), total, totalPerFU: per(total) };
}

export interface FlowChange {
  source: string;
  target: string;
  before: number;
  after: number;
  deltaPct: number;
}

/** Link-by-link comparison of two flows of the same indicator (before / after a simulation); last row = line total. */
export function compareFlows(before: Flow, after: Flow): FlowChange[] {
  const ids = new Set([...before.links, ...after.links].map((l) => `${l.source}→${l.target}`));
  const val = (f: Flow, id: string) => f.links.find((l) => `${l.source}→${l.target}` === id)?.value ?? 0;
  const pct = (b: number, a: number) => (b !== 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0);
  const rows = [...ids].map((id) => {
    const [source, target] = id.split("→") as [string, string];
    const b = val(before, id);
    const a = val(after, id);
    return { source, target, before: b, after: a, deltaPct: pct(b, a) };
  });
  rows.push({ source: "total", target: "", before: before.total, after: after.total, deltaPct: pct(before.total, after.total) });
  return rows;
}

export interface LifeCycleRow {
  key: string;
  unit: string;
  total: number;
  /** Production of purchased materials and energy (cradle). */
  upstreamPct: number;
  /** Direct emissions at the line (gate). */
  linePct: number;
}

/** Share of each computed impact that comes from upstream vs. the line itself; use and end of life are not assessed. */
export function lifeCycleSplit(run: RunResult): LifeCycleRow[] {
  return run.impacts
    .filter((i) => i.total !== null && i.total > 0)
    .map((i) => ({
      key: i.category,
      unit: i.unit,
      total: i.total as number,
      upstreamPct: ((i.byPoint.cradle ?? 0) / (i.total as number)) * 100,
      linePct: ((i.byPoint.gate ?? 0) / (i.total as number)) * 100,
    }));
}

export interface WasteItemShare {
  key: keyof RunResult["waste"]["items"];
  value: number;
  valuePerFU: number;
  sharePct: number;
}

/** Wasted-value items (§4.5) per m² and as share of the wasted value, largest first. */
export function wasteItems(run: RunResult): WasteItemShare[] {
  const area = run.areaPlatedM2 > 0 ? run.areaPlatedM2 : NaN;
  const total = run.waste.totalRp;
  return (Object.entries(run.waste.items) as Array<[WasteItemShare["key"], number]>)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ key, value, valuePerFU: value / area, sharePct: total > 0 ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}
