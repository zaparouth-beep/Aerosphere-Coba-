"use client";

import { useState } from "react";
import { Lock, Printer, Save } from "lucide-react";
import ExpertReports from "@/components/expert/ExpertReports";
import { defaultNextSteps, SummaryReport } from "@/components/report/SummaryReport";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Feedback";
import { LockedFeature } from "@/components/ui/Locked";
import { Tabs } from "@/components/ui/Tabs";
import { can } from "@/lib/domain/permissions";
import { hasFeature } from "@/lib/domain/plans";
import { useAppStore, type NextStep } from "@/lib/store/useAppStore";
import { useActiveResults, useComparison, useScenarioOutcomes } from "@/lib/store/useResults";
import { topActions } from "@/lib/view/summary";

type Layer = "ringkas" | "teknis" | "kepatuhan";

export default function Page() {
  const subscription = useAppStore((s) => s.subscription);
  const [layer, setLayer] = useState<Layer>("ringkas");
  const lock = (ok: boolean, label: string) => (
    <span className="inline-flex items-center gap-1">
      {!ok && <Lock className="h-3 w-3" aria-label="terkunci" />}
      {label}
    </span>
  );
  return (
    <div className="space-y-4">
      <Card className="no-print">
        <Tabs<Layer>
          value={layer}
          onChange={setLayer}
          tabs={[
            { id: "ringkas", label: "Ringkas Manajemen" },
            { id: "teknis", label: lock(hasFeature(subscription, "reportTechnical"), "Teknis (ISO 14044 & MFCA)") },
            { id: "kepatuhan", label: lock(hasFeature(subscription, "reportCompliance"), "Kepatuhan (GRI, GHG, PROPER)") },
          ]}
        />
        <CardBody className="py-2.5 text-xs text-navy-700/70">
          {layer === "ringkas" && "2 halaman untuk atasan: kesimpulan, angka utama, masalah, saran, keyakinan, dan langkah berikutnya."}
          {layer === "teknis" && "Untuk engineer dan reviewer LCA: metode, inventori lengkap, semua kategori dampak, dan aliran biaya."}
          {layer === "kepatuhan" && "Untuk EHS dan auditor: GRI 302/303/305/306, jejak karbon produk (GHG Protocol/ISO 14067), dan PROPER."}
        </CardBody>
      </Card>
      {layer === "ringkas" && <Ringkas />}
      {layer === "teknis" && (hasFeature(subscription, "reportTechnical") ? <ExpertReports layer="teknis" /> : <LockedFeature feature="reportTechnical" title="Laporan Teknis" />)}
      {layer === "kepatuhan" && (hasFeature(subscription, "reportCompliance") ? <ExpertReports layer="kepatuhan" /> : <LockedFeature feature="reportCompliance" title="Laporan Kepatuhan" />)}
    </div>
  );
}

function Ringkas() {
  const { project, results, indicators, run } = useActiveResults();
  const { outcomes } = useScenarioOutcomes();
  const comparison = useComparison();
  const subscription = useAppStore((s) => s.subscription);
  const account = useAppStore((s) => s.account);
  const user = useAppStore((s) => s.user);
  const stored = useAppStore((s) => s.nextSteps);
  const setNextSteps = useAppStore((s) => s.setNextSteps);
  const setUi = useAppStore((s) => s.setUi);
  const log = useAppStore((s) => s.log);
  const [steps, setSteps] = useState<NextStep[]>(() => (stored.length ? stored : defaultNextSteps(topActions(outcomes))));
  const dirty = JSON.stringify(steps) !== JSON.stringify(stored);
  const sample = subscription?.plan === "coba";
  const allowed = can(user.role, "generateReport") || user.role === "Auditor";

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button
          variant="brand"
          disabled={!allowed}
          onClick={() => {
            setUi({ reportDownloaded: true });
            log("report", "ringkas", "generate-report", { newValue: { template: "Laporan Ringkas Manajemen", format: "pdf", run: run?.id ?? "DRAFT" } });
            window.print();
          }}
        >
          <Printer className="h-4 w-4" /> Cetak / simpan PDF
        </Button>
        <Button variant="secondary" disabled={!dirty} onClick={() => setNextSteps(steps)}>
          <Save className="h-4 w-4" /> Simpan langkah berikutnya
        </Button>
        {!allowed && <span className="text-xs text-navy-700/60">Peran Anda tidak bisa membuat laporan.</span>}
      </div>
      {!run && (
        <Callout tone="warn" className="no-print">
          Laporan ini memakai data terkini yang belum disimpan. Tekan “Hitung hasil” di bar atas agar laporan merujuk nomor hasil yang bisa dicek ulang.
        </Callout>
      )}
      {sample && <Callout className="no-print">Paket Coba: laporan diberi tanda “Contoh”. Pilih paket Esensial atau lebih tinggi untuk laporan tanpa tanda.</Callout>}
      <SummaryReport
        project={project}
        results={results}
        indicators={indicators}
        outcomes={outcomes}
        comparison={comparison}
        resultLabel={run ? `Hasil #${run.id}` : "data terkini (belum disimpan)"}
        nextSteps={steps}
        onNextSteps={setSteps}
        watermark={sample}
        company={account?.company}
      />
    </div>
  );
}
