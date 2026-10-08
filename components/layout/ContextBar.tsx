"use client";

import Link from "next/link";
import { Calculator, Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { Segmented } from "@/components/ui/Tabs";
import { FU_LABEL } from "@/lib/engine/lci";
import { useAppStore } from "@/lib/store/useAppStore";

/**
 * Global filter bar (PRD v1.1 §3.0.3). Mode Ringkas: period, "Bandingkan
 * dengan", and "Hitung hasil". Mode Ahli adds functional unit, method and the
 * dataset/scope state.
 */
export function ContextBar() {
  const project = useAppStore((s) => s.project);
  const runs = useAppStore((s) => s.runs);
  const ui = useAppStore((s) => s.ui);
  const setUi = useAppStore((s) => s.setUi);
  const runCalculation = useAppStore((s) => s.runCalculation);
  const expert = ui.expertMode;

  return (
    <div className="no-print sticky top-16 z-20 flex flex-wrap items-center gap-2 border-b border-sand-200 bg-sand-50/95 px-4 py-2 text-xs backdrop-blur md:px-8">
      <label className="flex items-center gap-1.5">
        <span className="text-navy-700/60">Periode</span>
        <select
          value={ui.activeRunId ?? ""}
          onChange={(e) => setUi({ activeRunId: e.target.value || null })}
          className="max-w-[300px] rounded-md border border-sand-300 bg-white px-2 py-1 text-xs"
          aria-label="Data yang ditampilkan"
        >
          <option value="">{project.periodLabel} · data terkini (belum disimpan)</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.snapshot.periodLabel} · Hasil #{r.id}
              {r.manifest.kind === "official" ? " (resmi)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-navy-700/60">Bandingkan dengan</span>
        <select
          value={ui.compareRunId ?? ""}
          onChange={(e) => setUi({ compareRunId: e.target.value || null })}
          className="max-w-[210px] rounded-md border border-sand-300 bg-white px-2 py-1 text-xs"
          aria-label="Bandingkan dengan"
        >
          <option value="">Hasil tersimpan sebelumnya</option>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.snapshot.periodLabel} · Hasil #{r.id}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => runCalculation("draft")}
        className="flex items-center gap-1 rounded-md bg-navy-900 px-2.5 py-1 font-medium text-white hover:bg-navy-800"
        title="Simpan perhitungan data terkini dengan nomor hasil agar bisa dibandingkan dan dirujuk di laporan"
      >
        <Calculator className="h-3.5 w-3.5" /> Hitung hasil
      </button>
      <InfoTip k="run" />
      {ui.activeRunId && (
        <Badge tone="navy">
          <Lock className="h-3 w-3" /> Hasil #{ui.activeRunId} (terkunci)
        </Badge>
      )}
      {expert && (
        <>
          <span className="hidden h-4 w-px bg-sand-300 md:block" />
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
          <Badge tone="blue" title={project.method.release}>
            Metode {project.method.primary}
          </Badge>
          <Link href="/data?view=studi">
            <Badge tone={project.scope.lockedAt ? "green" : "gold"}>
              {project.scope.lockedAt && <Lock className="h-3 w-3" />}Studi v{project.scope.version}
            </Badge>
          </Link>
          <Link href="/data?view=cek">
            <Badge tone={project.dataset.status === "approved" ? "green" : "gold"}>
              Data v{project.dataset.version} · {project.dataset.status === "approved" ? "disetujui" : "draf"}
            </Badge>
          </Link>
        </>
      )}
    </div>
  );
}
