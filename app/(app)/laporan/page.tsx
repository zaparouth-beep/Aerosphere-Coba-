"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Lock, Printer, Save } from "lucide-react";
import ExpertReports from "@/components/expert/ExpertReports";
import { ReportEditBar, ReportEditNotice, ReportEditor, useReportEdits } from "@/components/report/Editable";
import { LcaStudyReport } from "@/components/report/LcaStudyReport";
import { defaultNextSteps, SummaryReport } from "@/components/report/SummaryReport";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Feedback";
import { LockedFeature } from "@/components/ui/Locked";
import { Segmented, Tabs } from "@/components/ui/Tabs";
import { can } from "@/lib/domain/permissions";
import { hasFeature } from "@/lib/domain/plans";
import { useAppStore, type NextStep } from "@/lib/store/useAppStore";
import { useActiveResults, useComparison, useScenarioOutcomes } from "@/lib/store/useResults";
import { buildStudyModel } from "@/lib/engine/study";
import { buildDirections } from "@/lib/report/directions";
import type { ReportLang, StudyContext } from "@/lib/report/lcaStudy";
import { downloadBlob } from "@/lib/utils/export";
import { topActions } from "@/lib/view/summary";

type Layer = "kajian" | "ringkas" | "teknis" | "kepatuhan";

export default function Page() {
  const subscription = useAppStore((s) => s.subscription);
  const [layer, setLayer] = useState<Layer>("kajian");
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
            { id: "kajian", label: "Laporan Kajian LCA" },
            { id: "ringkas", label: "Ringkasan untuk manajemen" },
            { id: "teknis", label: lock(hasFeature(subscription, "reportTechnical"), "Teknis (ISO 14044 & MFCA)") },
            { id: "kepatuhan", label: lock(hasFeature(subscription, "reportCompliance"), "Kepatuhan (GRI, GHG, PROPER)") },
          ]}
        />
        <CardBody className="py-2.5 text-xs text-navy-700/70">
          {layer === "kajian" && "Laporan utama: tujuan, ruang lingkup, kesimpulan per titik cradle/gate, tabel dampak per tahap, nilai per m², kualitas data, dan dampak tertinggi beserta alasannya."}
          {layer === "ringkas" && "2 halaman untuk atasan: kesimpulan, angka utama, masalah, saran, keyakinan, dan langkah berikutnya."}
          {layer === "teknis" && "Untuk engineer dan reviewer LCA: metode, inventori lengkap, semua kategori dampak, dan aliran biaya."}
          {layer === "kepatuhan" && "Untuk EHS dan auditor: GRI 302/303/305/306, jejak karbon produk (GHG Protocol/ISO 14067), dan PROPER."}
        </CardBody>
      </Card>
      {layer === "kajian" && <Kajian />}
      {layer === "ringkas" && <Ringkas />}
      {layer === "teknis" && (hasFeature(subscription, "reportTechnical") ? <ExpertReports layer="teknis" /> : <LockedFeature feature="reportTechnical" title="Laporan Teknis" />)}
      {layer === "kepatuhan" && (hasFeature(subscription, "reportCompliance") ? <ExpertReports layer="kepatuhan" /> : <LockedFeature feature="reportCompliance" title="Laporan Kepatuhan" />)}
    </div>
  );
}

function Ringkas() {
  const { run } = useActiveResults();
  return (
    <ReportEditor doc={`ringkas:${run?.id ?? "DRAF"}`}>
      <RingkasInner />
    </ReportEditor>
  );
}

function RingkasInner() {
  const { project, results, indicators, run } = useActiveResults();
  const edits = useReportEdits();
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
  const directions = useMemo(() => buildDirections(project, results, outcomes, "id"), [project, results, outcomes]);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button
          variant="brand"
          disabled={!allowed || edits.blocked}
          title={edits.blockedReason}
          onClick={() => {
            setUi({ reportDownloaded: true });
            log("report", "ringkas", "generate-report", { newValue: { template: "Laporan Ringkas Manajemen", format: "pdf", run: run?.id ?? "DRAFT", editedBlocks: edits.edited } });
            window.print();
          }}
        >
          <Printer className="h-4 w-4" /> Cetak / simpan PDF
        </Button>
        <Button variant="secondary" disabled={!dirty} title={dirty ? undefined : "Belum ada perubahan langkah berikutnya"} onClick={() => setNextSteps(steps)}>
          <Save className="h-4 w-4" /> Simpan langkah berikutnya
        </Button>
        <ReportEditBar />
        {!allowed && <span className="text-xs text-navy-700/60">Peran Anda tidak bisa membuat laporan.</span>}
      </div>
      <ReportEditNotice />
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
        directions={directions}
        watermark={sample}
        company={account?.company}
      />
    </div>
  );
}

const LANG_LABEL: Record<ReportLang, string> = { id: "Bahasa Indonesia", en: "English", both: "Dwibahasa" };

function Kajian() {
  const { project, results, run } = useActiveResults();
  const { outcomes } = useScenarioOutcomes();
  const ctx = useMemo<StudyContext | null>(() => {
    if (!results.analysis) return null;
    return {
      project,
      model: buildStudyModel(results.analysis),
      actions: topActions(outcomes),
      resultId: run?.id ?? "DRAF",
      date: (run?.manifest.createdAt ?? new Date().toISOString()).slice(0, 10),
      directions: { id: buildDirections(project, results, outcomes, "id"), en: buildDirections(project, results, outcomes, "en") },
    };
  }, [project, results, outcomes, run]);

  if (!ctx) {
    return (
      <Callout tone="warn">
        Hasil ini dibuat dengan mesin hitung versi lama, sehingga tabel dampak per tahap belum tersedia. Tekan “Hitung hasil” di bar atas untuk membuat hasil baru.
      </Callout>
    );
  }
  return (
    <ReportEditor doc={`kajian:${ctx.resultId}`}>
      <KajianInner ctx={ctx} hasRun={Boolean(run)} />
    </ReportEditor>
  );
}

function KajianInner({ ctx, hasRun }: { ctx: StudyContext; hasRun: boolean }) {
  const subscription = useAppStore((s) => s.subscription);
  const user = useAppStore((s) => s.user);
  const setUi = useAppStore((s) => s.setUi);
  const log = useAppStore((s) => s.log);
  const edits = useReportEdits();
  const [lang, setLang] = useState<ReportLang>("id");
  const [busy, setBusy] = useState(false);
  const allowed = can(user.role, "generateReport") || user.role === "Auditor";
  const sample = subscription?.plan === "coba";
  const off = !allowed || edits.blocked;
  const why = !allowed ? "Peran Anda tidak bisa membuat laporan." : edits.blockedReason;

  const exportExcel = async () => {
    setBusy(true);
    try {
      const { buildStudyWorkbook, studyFileName } = await import("@/lib/io/studyExport");
      const blob = await buildStudyWorkbook(ctx, lang, { text: edits.text, hidden: edits.isHidden });
      downloadBlob(blob, studyFileName(ctx, "xlsx", lang), blob.type);
      setUi({ reportDownloaded: true });
      log("report", "kajian", "generate-report", { newValue: { template: "Laporan Kajian LCA", format: "xlsx", lang, run: ctx.resultId, editedBlocks: edits.edited } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Segmented<ReportLang>
          ariaLabel="Bahasa laporan"
          value={lang}
          onChange={setLang}
          options={(["id", "en", "both"] as const).map((id) => ({ id, label: LANG_LABEL[id] }))}
        />
        <Button
          variant="brand"
          disabled={off}
          title={why}
          onClick={() => {
            setUi({ reportDownloaded: true });
            log("report", "kajian", "generate-report", { newValue: { template: "Laporan Kajian LCA", format: "pdf", lang, run: ctx.resultId, editedBlocks: edits.edited } });
            const title = document.title;
            import("@/lib/io/studyExport").then(({ studyFileName }) => {
              document.title = studyFileName(ctx, "pdf", lang).replace(/\.pdf$/, "");
              window.print();
              document.title = title;
            });
          }}
        >
          <Printer className="h-4 w-4" /> Cetak / simpan PDF (A4)
        </Button>
        <Button variant="secondary" disabled={off || busy} title={why} onClick={exportExcel}>
          <FileSpreadsheet className="h-4 w-4" /> {busy ? "Menyiapkan…" : "Unduh Excel"}
        </Button>
        <ReportEditBar />
        {!allowed && <span className="text-xs text-navy-700/60">Peran Anda tidak bisa membuat laporan.</span>}
      </div>
      <ReportEditNotice />
      {!hasRun && (
        <Callout tone="warn" className="no-print">
          Laporan ini memakai data terkini yang belum disimpan (nomor hasil “DRAF”). Tekan “Hitung hasil” di bar atas agar laporan merujuk nomor hasil yang bisa dicek ulang.
        </Callout>
      )}
      <Callout className="no-print">
        Nilai dampak masih memakai faktor skrining. Kategori yang faktornya belum tersedia ditulis “belum dihitung”, bukan 0. Laporan ini belum melalui tinjauan kritis pihak ketiga.
      </Callout>
      {sample && <Callout className="no-print">Paket Coba: laporan diberi tanda “Contoh”. Pilih paket Esensial atau lebih tinggi untuk laporan tanpa tanda.</Callout>}
      <LcaStudyReport ctx={ctx} lang={lang} watermark={sample} />
    </div>
  );
}
