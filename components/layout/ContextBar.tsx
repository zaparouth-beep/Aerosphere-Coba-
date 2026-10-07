"use client";

import Link from "next/link";
import { Lock, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Segmented } from "@/components/ui/Tabs";
import { FU_LABEL } from "@/lib/engine/lci";
import { useAppStore } from "@/lib/store/useAppStore";

/** Global context (PRD 3.1): period, FU view, run, comparison scenario, method. */
export function ContextBar() {
  const project = useAppStore((s) => s.project);
  const runs = useAppStore((s) => s.runs);
  const ui = useAppStore((s) => s.ui);
  const setUi = useAppStore((s) => s.setUi);
  const runCalculation = useAppStore((s) => s.runCalculation);

  return (
    <div className="no-print sticky top-16 z-20 flex flex-wrap items-center gap-2 border-b border-sand-200 bg-sand-50/95 px-4 py-2 text-xs backdrop-blur md:px-8">
      <Badge tone="neutral">{project.periodLabel}</Badge>
      <Segmented
        ariaLabel="Tampilan satuan"
        size="xs"
        value={ui.fuView}
        onChange={(v) => setUi({ fuView: v })}
        options={[
          { id: "perFu", label: `per ${FU_LABEL[project.scope.fuType]}` },
          { id: "total", label: "total periode" },
        ]}
      />
      <label className="flex items-center gap-1.5">
        <span className="text-navy-700/60">Run</span>
        <select
          value={ui.activeRunId ?? ""}
          onChange={(e) => setUi({ activeRunId: e.target.value || null })}
          className="num max-w-[210px] rounded-md border border-sand-300 bg-white px-2 py-1 text-xs"
        >
          <option value="">Draf langsung (belum terkunci)</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => runCalculation("draft")}
        className="flex items-center gap-1 rounded-md border border-sand-300 bg-white px-2 py-1 font-medium text-navy-900 hover:bg-sand-100"
        title="Kunci hasil saat ini sebagai run (immutable, dengan hash)"
      >
        <PlayCircle className="h-3.5 w-3.5 text-brand-teal" /> Run kalkulasi
      </button>
      <span className="hidden h-4 w-px bg-sand-300 md:block" />
      <Badge tone="blue" title={project.method.release}>
        {project.method.primary}
      </Badge>
      <Link href="/goal-scope">
        <Badge tone={project.scope.lockedAt ? "green" : "gold"}>
          {project.scope.lockedAt && <Lock className="h-3 w-3" />}Scope v{project.scope.version}
        </Badge>
      </Link>
      <Link href="/kualitas-data">
        <Badge tone={project.dataset.status === "approved" ? "green" : "gold"}>
          Dataset v{project.dataset.version} · {project.dataset.status === "approved" ? "approved" : "draf"}
        </Badge>
      </Link>
      {ui.activeRunId && (
        <Badge tone="navy">
          <Lock className="h-3 w-3" /> Menampilkan run terkunci
        </Badge>
      )}
    </div>
  );
}
