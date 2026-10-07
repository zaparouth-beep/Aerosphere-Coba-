"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Lock, ShieldCheck, Upload } from "lucide-react";
import { AirTable, EffluentTable, InputTable, MappingTable, PriceForm, ProductionForm, WasteTable } from "@/components/data/Tables";
import { StageDot } from "@/components/data/common";
import { STAGE_COLOR } from "@/components/charts/palette";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout, Modal, ReasonDialog } from "@/components/ui/Feedback";
import { Tabs } from "@/components/ui/Tabs";
import { can } from "@/lib/domain/permissions";
import type { StageId } from "@/lib/domain/types";
import type { IssueTab } from "@/lib/engine/quality";
import { buildTemplate, parseTemplate, type DatasetPatch, type ImportReport } from "@/lib/io/excel";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults } from "@/lib/store/useResults";
import { cn } from "@/lib/utils/cn";
import { downloadBlob, fileStamp } from "@/lib/utils/export";
import { fmt } from "@/lib/utils/format";

type Tab = "input" | "energy" | "air" | "effluent" | "waste" | "production" | "prices" | "mapping";

const TABS: Array<{ id: Tab; label: string; issueTab?: IssueTab }> = [
  { id: "input", label: "LCI Input", issueTab: "input" },
  { id: "energy", label: "Energi & Utilitas" },
  { id: "air", label: "Output — Emisi udara", issueTab: "air" },
  { id: "effluent", label: "Output — Efluen", issueTab: "effluent" },
  { id: "waste", label: "Output — Limbah B3", issueTab: "waste" },
  { id: "production", label: "Produksi & neraca", issueTab: "production" },
  { id: "prices", label: "Harga satuan", issueTab: "prices" },
  { id: "mapping", label: "Mapping background", issueTab: "mapping" },
];

export default function DataProsesPage() {
  return (
    <Suspense>
      <DataProses />
    </Suspense>
  );
}

function DataProses() {
  const search = useSearchParams();
  const router = useRouter();
  const project = useAppStore((s) => s.project);
  const role = useAppStore((s) => s.user.role);
  const reopenDataset = useAppStore((s) => s.reopenDataset);
  const applyDatasetPatch = useAppStore((s) => s.applyDatasetPatch);
  const notify = useAppStore((s) => s.notify);
  const activeRunId = useAppStore((s) => s.ui.activeRunId);
  const setUi = useAppStore((s) => s.setUi);
  const { results } = useActiveResults();
  const [tab, setTab] = useState<Tab>(((search.get("tab") as Tab) || "input") as Tab);
  const [stage, setStage] = useState<StageId | null>(null);
  const [reopen, setReopen] = useState(false);
  const [pending, setPending] = useState<{ patch: DatasetPatch; report: ImportReport; file: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const approved = project.dataset.status === "approved";
  const readOnly = approved || !can(role, "editData");
  const issueMap = useMemo(() => new Map(results.validation.issues.filter((i) => i.entityId).map((i) => [i.entityId!, i.severity])), [results]);
  const issueCount = (t?: IssueTab) => (t ? results.validation.issues.filter((i) => i.tab === t && i.severity !== "info").length : 0);

  const stageStats = project.stages.map((s) => {
    const rows = project.inputs.filter((i) => i.stageId === s.id);
    const filled = rows.filter((i) => i.quantity > 0).length;
    return { ...s, rows: rows.length, filled, pct: rows.length ? (filled / rows.length) * 100 : 0 };
  });

  return (
    <div className="space-y-6">
      {activeRunId && (
        <Callout tone="info">
          Anda sedang melihat run terkunci di halaman lain. Data di sini adalah draf langsung.{" "}
          <button type="button" className="font-medium text-brand-blue underline" onClick={() => setUi({ activeRunId: null })}>
            Tampilkan hasil draf
          </button>
        </Callout>
      )}
      <div className="grid gap-6 2xl:grid-cols-[300px_1fr]">
        <Card className="h-fit 2xl:sticky 2xl:top-[124px]">
          <CardHeader eyebrow="M02 · Peta proses" title="Lini plating A–F" subtitle="Klik tahap untuk memfilter tabel. Warna cincin = % aliran terisi." />
          <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-1">
            <button
              type="button"
              onClick={() => setStage(null)}
              className={cn("w-full rounded-lg border px-3 py-2 text-left text-xs", stage === null ? "border-navy-900 bg-navy-900 text-white" : "border-sand-300 hover:border-navy-600")}
            >
              Semua tahap
            </button>
            {stageStats.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStage(stage === s.id ? null : s.id)}
                aria-pressed={stage === s.id}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                  stage === s.id ? "border-brand-blue bg-brand-blue/5" : "border-sand-200 hover:border-sand-300",
                  !s.inBoundary && "opacity-50",
                )}
              >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                  <svg viewBox="0 0 36 36" className="absolute inset-0 h-10 w-10 -rotate-90" aria-hidden>
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#e3dccb" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke={STAGE_COLOR[s.id]} strokeWidth="3" strokeDasharray={`${(s.pct / 100) * 94.2} 94.2`} strokeLinecap="round" />
                  </svg>
                  <span className="text-xs font-bold text-navy-900">{s.id}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-navy-900">{s.name}</span>
                  <span className="block truncate text-[11px] text-navy-700/60">{s.subprocesses.join(", ")}</span>
                  <span className="num block text-[10px] text-navy-700/55">
                    {s.filled}/{s.rows} aliran terisi{!s.inBoundary && " · di luar boundary"}
                  </span>
                </span>
              </button>
            ))}
          </CardBody>
        </Card>

        <Card className="min-w-0">
          <CardHeader
            eyebrow="M03 · Data ingestion"
            title="Life Cycle Inventory"
            subtitle={`Dataset v${project.dataset.version} · ${approved ? "approved (read-only)" : "draf"} · ${fmt(results.validation.completenessPct, 0)}% input terisi`}
            action={
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const blob = await buildTemplate(project);
                    downloadBlob(blob, `Form-LCI-Proses-Plating-${fileStamp()}.xlsx`, blob.type);
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Unduh template
                </Button>
                <Button variant="secondary" size="sm" disabled={readOnly} onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Unggah .xlsx
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      const parsed = await parseTemplate(file, project);
                      setPending({ ...parsed, file: file.name });
                    } catch (err) {
                      notify("error", `Impor gagal: ${(err as Error).message}`);
                    }
                  }}
                />
                <Button size="sm" onClick={() => router.push("/kualitas-data")}>
                  <ShieldCheck className="h-3.5 w-3.5" /> Validasi
                </Button>
              </>
            }
          />
          {approved && (
            <div className="flex flex-wrap items-center gap-2 border-b border-sand-200 bg-status-ok/5 px-5 py-2.5 text-xs text-navy-800">
              <Lock className="h-3.5 w-3.5 text-status-ok" /> Dataset di-approve oleh {project.dataset.approvedBy}. Perubahan membuat versi baru dan tercatat di audit trail.
              <Button size="sm" variant="secondary" onClick={() => setReopen(true)}>
                Buka versi v{project.dataset.version + 1}
              </Button>
            </div>
          )}
          {!approved && readOnly && <div className="border-b border-sand-200 bg-sand-50 px-5 py-2.5 text-xs text-navy-700/70">Peran Anda hanya dapat melihat data.</div>}
          <Tabs tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: issueCount(t.issueTab) }))} value={tab} onChange={setTab} />
          <CardBody>
            {stage && (
              <p className="mb-3 flex items-center gap-2 text-xs text-navy-800">
                <StageDot id={stage} /> Filter tahap {stage} aktif
                <button type="button" className="text-brand-blue underline" onClick={() => setStage(null)}>
                  hapus filter
                </button>
              </p>
            )}
            {tab === "input" && <InputTable project={project} categories={["Chemical", "Anode", "Water", "WWTPChemical", "Consumable"]} stage={stage} readOnly={readOnly} issues={issueMap} />}
            {tab === "energy" && <InputTable project={project} categories={["Energy"]} stage={stage} readOnly={readOnly} issues={issueMap} />}
            {tab === "air" && <AirTable project={project} readOnly={readOnly} stage={stage} />}
            {tab === "effluent" && <EffluentTable project={project} readOnly={readOnly} issues={issueMap} />}
            {tab === "waste" && <WasteTable project={project} readOnly={readOnly} stage={stage} />}
            {tab === "production" && <ProductionForm project={project} readOnly={readOnly} />}
            {tab === "prices" && <PriceForm project={project} />}
            {tab === "mapping" && <MappingTable project={project} readOnly={!can(role, "editData") && !can(role, "editMethod")} />}
          </CardBody>
        </Card>
      </div>

      <ReasonDialog
        open={reopen}
        title={`Buka dataset v${project.dataset.version + 1}`}
        description="Versi yang sudah di-approve tetap utuh dan run lama tidak berubah (AC-04). Versi baru kembali ke status draf."
        confirmLabel="Buka versi baru"
        onCancel={() => setReopen(false)}
        onConfirm={(r) => {
          reopenDataset(r);
          setReopen(false);
        }}
      />

      <Modal
        open={!!pending}
        title={`Laporan impor — ${pending?.file ?? ""}`}
        onClose={() => setPending(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Batal
            </Button>
            <Button
              disabled={!pending || pending.report.accepted === 0}
              onClick={() => {
                if (pending && applyDatasetPatch(pending.patch, pending.file)) notify("success", `${pending.report.accepted} baris diterapkan dari ${pending.file}.`);
                setPending(null);
              }}
            >
              <FileSpreadsheet className="h-4 w-4" /> Terapkan {pending?.report.accepted ?? 0} baris
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">{pending.report.accepted} diterima</Badge>
              <Badge tone="red">{pending.report.rejected.length} ditolak</Badge>
              <Badge tone="gold">{pending.report.warnings.length} peringatan</Badge>
            </div>
            {[...pending.report.rejected.map((r) => ({ ...r, kind: "Ditolak" })), ...pending.report.warnings.map((r) => ({ ...r, kind: "Peringatan" }))].slice(0, 40).map((r, i) => (
              <p key={i} className="text-navy-800">
                <b>{r.kind}</b> · {r.sheet} baris {r.row}: {r.reason}
              </p>
            ))}
            <p className="text-navy-700/60">Hanya nilai sel yang dibaca; formula dan makro diabaikan. Baris ditolak tidak diterapkan dan tidak dibuang diam-diam.</p>
            <Link href="/pengaturan?tab=audit" className="text-brand-blue underline">
              Impor dicatat di audit trail
            </Link>
          </div>
        )}
      </Modal>
    </div>
  );
}
