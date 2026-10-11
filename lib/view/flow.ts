import type { Project } from "@/lib/domain/types";
import type { Flow, FlowChange, FlowNode } from "@/lib/engine/flow";
import type { StageCode } from "@/lib/engine/types";
import { KIND, ROLE, stageName } from "@/lib/view/titikBoros";

/** Words for the flow diagram; numbers come from lib/engine/flow.ts. */

const CATEGORY: Record<string, string> = {
  chemical: "Bahan kimia proses",
  anode: "Anoda",
  wwtp_chemical: "Bahan kimia pengolahan air limbah",
  consumable: "Bahan habis pakai",
  water: "Air",
  electricity: "Listrik",
  waste_b3: "Pengolahan & transport limbah B3",
};

export function nodeLabel(node: FlowNode, project: Project, key: string): string {
  if (node.type === "total") return "Total lini";
  if (node.type === "stage") return `${node.key}. ${stageName(project, node.key as StageCode)}`;
  if (node.type === "component") return node.name;
  if (key === "waste_value") return CATEGORY[node.key] ?? node.key;
  const base = KIND[node.key] ?? CATEGORY[node.key] ?? node.key;
  return node.key === "electricity" && node.roles?.length && node.roles.length <= 3 ? `${base} (${node.roles.map((r) => ROLE[r]).join(", ")})` : base;
}

/** Breadcrumb trail for the current focus. */
export function trail(flow: Flow, project: Project): string[] {
  const out = ["Semua tahap"];
  if (flow.focus.stage) out.push(`${flow.focus.stage}. ${stageName(project, flow.focus.stage)}`);
  if (flow.focus.kind) out.push(flow.key === "waste_value" ? (CATEGORY[flow.focus.kind] ?? flow.focus.kind) : (KIND[flow.focus.kind] ?? flow.focus.kind));
  return out;
}

/** Δ% per node id (stage nodes from stage→total links, sources from their outgoing sum). */
export function nodeDeltas(changes: FlowChange[]): Record<string, number> {
  const sum = new Map<string, { b: number; a: number }>();
  for (const c of changes) {
    if (c.source === "total") {
      sum.set("total", { b: c.before, a: c.after });
      continue;
    }
    const s = sum.get(c.source) ?? { b: 0, a: 0 };
    s.b += c.before;
    s.a += c.after;
    sum.set(c.source, s);
  }
  return Object.fromEntries([...sum].map(([id, { b, a }]) => [id, b !== 0 ? ((a - b) / b) * 100 : 0]));
}
