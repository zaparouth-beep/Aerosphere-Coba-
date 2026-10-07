import type { Confidence, InputCategory, Project, StageId } from "@/lib/domain/types";
import type { Results } from "@/lib/engine/calculate";
import { STAGE_IDS } from "@/lib/engine/lci";
import { pedigreeScore } from "@/lib/engine/quality";
import { STAGE_COLOR } from "@/components/charts/palette";
import type { SankeyData } from "@/components/charts/Charts";

export function stageLabel(project: Project, id: StageId): string {
  return `${id}. ${project.stages.find((s) => s.id === id)?.name ?? id}`;
}

/** Quantity-weighted pedigree of the inputs behind a KPI → High/Medium/Low (P7). */
export function confidenceFor(project: Project, categories: InputCategory[] | "waste"): Confidence | undefined {
  const rows =
    categories === "waste"
      ? project.waste.filter((w) => w.quantityKg > 0).map((w) => ({ q: w.quantityKg, s: pedigreeScore(w.meta.pedigree) }))
      : project.inputs.filter((i) => categories.includes(i.category) && i.quantity > 0).map((i) => ({ q: i.quantity, s: pedigreeScore(i.meta.pedigree) }));
  const total = rows.reduce((a, r) => a + r.q, 0);
  if (!total) return undefined;
  const score = rows.reduce((a, r) => a + r.q * r.s, 0) / total;
  return score <= 2 ? "High" : score <= 3.5 ? "Medium" : "Low";
}

/** Value in the context bar's unit: per functional unit or per period total. */
export function inView(total: number, ref: number, view: "perFu" | "total"): number {
  if (view === "total") return total;
  return ref > 0 ? total / ref : NaN;
}

export function deltaPct(current: number, previous: number | undefined): { text: string; value: number } | null {
  if (previous === undefined || !Number.isFinite(previous) || previous === 0) return null;
  const v = ((current - previous) / Math.abs(previous)) * 100;
  if (!Number.isFinite(v)) return null;
  return { value: v, text: `${v > 0 ? "▲ +" : v < 0 ? "▼ −" : ""}${Math.abs(v).toLocaleString("id-ID", { maximumFractionDigits: 1 })}% vs run sebelumnya` };
}

/**
 * MFCA Sankey (ISO 14051): cost categories (or material inputs) → stages →
 * positive / negative product.
 */
export function mfcaSankey(project: Project, r: Results, mode: "rp" | "kg"): SankeyData {
  const nodes: SankeyData["nodes"] = [];
  const links: SankeyData["links"] = [];
  const add = (name: string, color: string) => {
    nodes.push({ name, color });
    return nodes.length - 1;
  };
  const stageIdx = new Map<StageId, number>();
  if (mode === "rp") {
    const cats = [
      { key: "material", label: "Material", color: "#0072B2" },
      { key: "energy", label: "Energi", color: "#E69F00" },
      { key: "system", label: "Sistem", color: "#5b6475" },
      { key: "waste", label: "Pengelolaan limbah", color: "#CC79A7" },
    ] as const;
    const catIdx = cats.map((c) => add(c.label, c.color));
    for (const s of STAGE_IDS) {
      const st = r.mfca.stages.find((x) => x.stageId === s)!;
      const total = Object.values(st.cost).reduce((a, c) => a + c.positive + c.negative, 0);
      if (total <= 0) continue;
      stageIdx.set(s, add(stageLabel(project, s), STAGE_COLOR[s]));
    }
    const pos = add("Positive product", "#009E73");
    const neg = add("Negative product", "#D55E00");
    for (const st of r.mfca.stages) {
      const si = stageIdx.get(st.stageId);
      if (si === undefined) continue;
      cats.forEach((c, i) => {
        const v = st.cost[c.key].positive + st.cost[c.key].negative;
        if (v > 0) links.push({ source: catIdx[i]!, target: si, value: v });
      });
      const p = Object.values(st.cost).reduce((a, c) => a + c.positive, 0);
      const n = Object.values(st.cost).reduce((a, c) => a + c.negative, 0);
      if (p > 0) links.push({ source: si, target: pos, value: p });
      if (n > 0) links.push({ source: si, target: neg, value: n });
    }
  } else {
    const input = add("Input material", "#0072B2");
    for (const st of r.mfca.stages) {
      if (st.materialInKg <= 0) continue;
      stageIdx.set(st.stageId, add(stageLabel(project, st.stageId), STAGE_COLOR[st.stageId]));
    }
    const pos = add("Positive product (lapisan)", "#009E73");
    const neg = add("Negative product", "#D55E00");
    for (const st of r.mfca.stages) {
      const si = stageIdx.get(st.stageId);
      if (si === undefined) continue;
      links.push({ source: input, target: si, value: st.materialInKg });
      if (st.positiveKg > 0) links.push({ source: si, target: pos, value: st.positiveKg });
      if (st.negativeKg > 0) links.push({ source: si, target: neg, value: st.negativeKg });
    }
  }
  // Drop nodes that ended up without links (keeps recharts happy).
  const used = new Set(links.flatMap((l) => [l.source, l.target]));
  const remap = new Map<number, number>();
  const kept = nodes.filter((_, i) => used.has(i));
  nodes.forEach((_, i) => {
    if (used.has(i)) remap.set(i, remap.size);
  });
  return { nodes: kept, links: links.map((l) => ({ ...l, source: remap.get(l.source)!, target: remap.get(l.target)! })) };
}
