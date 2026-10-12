"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Lock, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { AirTable, EffluentTable, InputTable, MappingTable, PriceForm, ProductionForm, WasteTable } from "@/components/data/Tables";
import { StageDot } from "@/components/data/common";
import { STAGE_COLOR } from "@/components/charts/palette";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout, Modal, ReasonDialog } from "@/components/ui/Feedback";
import { Tabs } from "@/components/ui/Tabs";
import { LockedFeature } from "@/components/ui/Locked";
import { can } from "@/lib/domain/permissions";
import { hasFeature, planLimits } from "@/lib/domain/plans";
import { plainStage } from "@/lib/view/summary";
import type { StageId } from "@/lib/domain/types";
import type { IssueTab } from "@/lib/engine/quality";
import { DocumentImport } from "@/components/data/DocumentImport";
import { ACCEPT } from "@/lib/io/docExtract";
import { buildTemplate, isTemplateWorkbook, parseTemplate, type DatasetPatch, type ImportReport } from "@/lib/io/excel";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults } from "@/lib/store/useResults";
import { cn } from "@/lib/utils/cn";
import { downloadBlob, fileStamp } from "@/lib/utils/export";
import { fmt } from "@/lib/utils/format";
import { locale, pick, T, tx } from "@/lib/i18n";

type Tab = "input" | "energy" | "air" | "effluent" | "waste" | "production" | "prices" | "mapping";

const TABS: Array<{ id: Tab; label: { id: string; en: string }; expertLabel: { id: string; en: string }; issueTab?: IssueTab; expertOnly?: boolean }> = [
  { id: "input", label: { id: "Bahan kimia & air", en: "Chemicals & water" }, expertLabel: { id: "LCI Input", en: "LCI Inputs" }, issueTab: "input" },
  { id: "energy", label: { id: "Listrik & energi", en: "Electricity & energy" }, expertLabel: { id: "Energi & Utilitas", en: "Energy & Utilities" } },
  { id: "air", label: { id: "Udara buangan", en: "Exhaust air" }, expertLabel: { id: "Output — Emisi udara", en: "Output — Air emissions" }, issueTab: "air" },
  { id: "effluent", label: { id: "Air buangan", en: "Wastewater" }, expertLabel: { id: "Output — Efluen", en: "Output — Effluent" }, issueTab: "effluent" },
  { id: "waste", label: { id: "Limbah B3", en: "Hazardous (B3) waste" }, expertLabel: { id: "Output — Limbah B3", en: "Output — Hazardous (B3) waste" }, issueTab: "waste" },
  { id: "production", label: { id: "Produksi", en: "Production" }, expertLabel: { id: "Produksi & neraca", en: "Production & balance" }, issueTab: "production" },
  { id: "prices", label: { id: "Harga", en: "Prices" }, expertLabel: { id: "Harga satuan", en: "Unit prices" }, issueTab: "prices" },
  { id: "mapping", label: { id: "Pemetaan database", en: "Database mapping" }, expertLabel: { id: "Mapping background", en: "Background mapping" }, issueTab: "mapping", expertOnly: true },
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
  const expert = useAppStore((s) => s.ui.expertMode);
  const subscription = useAppStore((s) => s.subscription);
  const manual = hasFeature(subscription, "manualInput");
  const canUpload = hasFeature(subscription, "uploadData") && (subscription?.uploadsUsed ?? 0) < planLimits(subscription).uploads;
  const { results } = useActiveResults();
  const [tab, setTab] = useState<Tab>(((search.get("tab") as Tab) || "input") as Tab);
  const [stage, setStage] = useState<StageId | null>(null);
  const [reopen, setReopen] = useState(false);
  const [pending, setPending] = useState<{ patch: DatasetPatch; report: ImportReport; file: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const backups = useAppStore((s) => s.importBackups);
  const restoreImportBackup = useAppStore((s) => s.restoreImportBackup);

  const approved = project.dataset.status === "approved";
  const readOnly = approved || !can(role, "editData") || !manual;
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
          {tx(
            `Anda sedang melihat hasil tersimpan #${activeRunId} di menu lain. Data di sini adalah data terkini.`,
            `You are viewing saved result #${activeRunId} in other menus. The data here is the current data.`,
          )}{" "}
          <button type="button" className="font-medium text-brand-blue underline" onClick={() => setUi({ activeRunId: null })}>
            {tx("Tampilkan hasil data terkini", "Show results for current data")}
          </button>
        </Callout>
      )}
      <div className="grid gap-6 2xl:grid-cols-[300px_1fr]">
        <Card className="h-fit 2xl:sticky 2xl:top-[124px]">
          <CardHeader
            eyebrow={expert ? tx("M02 · Peta proses", "M02 · Process map") : undefined}
            title={tx("Tahap proses", "Process stages")}
            subtitle={tx("Klik tahap untuk menyaring tabel. Lingkaran menunjukkan berapa baris yang sudah terisi.", "Click a stage to filter the tables. The ring shows how many rows are filled in.")}
          />
          <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-1">
            <button
              type="button"
              onClick={() => setStage(null)}
              className={cn("w-full rounded-lg border px-3 py-2 text-left text-xs", stage === null ? "border-navy-900 bg-navy-900 text-white" : "border-sand-300 hover:border-navy-600")}
            >
              {tx("Semua tahap", "All stages")}
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
                  <span className="block truncate text-xs font-semibold text-navy-900">{expert ? s.name : plainStage(project, s.id)}</span>
                  <span className="block truncate text-[11px] text-navy-700/60">{s.subprocesses.join(", ")}</span>
                  <span className="num block text-[10px] text-navy-700/55">
                    {tx(`${s.filled}/${s.rows} baris terisi`, `${s.filled}/${s.rows} rows filled`)}
                    {!s.inBoundary && tx(" · tidak dihitung", " · not calculated")}
                  </span>
                </span>
              </button>
            ))}
          </CardBody>
        </Card>

        <Card className="min-w-0">
          <CardHeader
            eyebrow={expert ? "M03 · Data ingestion" : undefined}
            title={expert ? "Life Cycle Inventory" : tx("Pemakaian & buangan", "Usage & discharges")}
            info="lci"
            subtitle={tx(
              `Data versi ${project.dataset.version} · ${approved ? "disetujui (hanya baca)" : "draf"} · ${fmt(results.validation.completenessPct, 0)}% terisi`,
              `Data version ${project.dataset.version} · ${approved ? "approved (read-only)" : "draft"} · ${fmt(results.validation.completenessPct, 0)}% filled in`,
            )}
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
                  <Download className="h-3.5 w-3.5" /> {tx("Unduh template", "Download template")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={approved || !canUpload}
                  title={
                    approved
                      ? tx("Data sudah disetujui; buka versi baru dulu", "Data is already approved; open a new version first")
                      : canUpload
                        ? tx("Excel, CSV, PDF, atau Word berisi data input dan output", "Excel, CSV, PDF or Word containing input and output data")
                        : tx("Kuota unggahan paket sudah terpakai", "Your plan's upload quota is used up")
                  }
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" /> {tx("Unggah dokumen", "Upload document")}
                </Button>
                {backups.length > 0 && (
                  <Button variant="ghost" size="sm" disabled={approved} onClick={() => setConfirmRestore(true)} title={tx(`Cadangan sebelum impor ${backups[0]!.source}`, `Backup from before importing ${backups[0]!.source}`)}>
                    <RotateCcw className="h-3.5 w-3.5" /> {tx("Kembalikan data sebelum unggah", "Restore data from before upload")}
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  data-testid="document-upload"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      // The official template keeps its exact importer; any other document goes to the smart reader.
                      if (await isTemplateWorkbook(file)) {
                        const parsed = await parseTemplate(file, project);
                        setPending({ ...parsed, file: file.name });
                      } else setDocFile(file);
                    } catch (err) {
                      notify("error", tx(`Impor gagal: ${(err as Error).message}`, `Import failed: ${(err as Error).message}`));
                    }
                  }}
                />
                <Button size="sm" onClick={() => router.push("/data?view=cek")}>
                  <ShieldCheck className="h-3.5 w-3.5" /> {tx("Cek data", "Check data")}
                </Button>
              </>
            }
          />
          {approved && (
            <div className="flex flex-wrap items-center gap-2 border-b border-sand-200 bg-status-ok/5 px-5 py-2.5 text-xs text-navy-800">
              <Lock className="h-3.5 w-3.5 text-status-ok" />{" "}
              {tx(
                `Data disetujui oleh ${project.dataset.approvedBy}. Perubahan membuka versi baru dan tercatat di jejak audit.`,
                `Data approved by ${project.dataset.approvedBy}. Changes open a new version and are recorded in the audit trail.`,
              )}
              <Button size="sm" variant="secondary" onClick={() => setReopen(true)}>
                {tx(`Buka versi ${project.dataset.version + 1}`, `Open version ${project.dataset.version + 1}`)}
              </Button>
            </div>
          )}
          {!approved && readOnly && manual && <div className="border-b border-sand-200 bg-sand-50 px-5 py-2.5 text-xs text-navy-700/70">{tx("Peran Anda hanya dapat melihat data.", "Your role can only view data.")}</div>}
          {!manual && (
            <div className="border-b border-sand-200 px-5 py-3">
              <LockedFeature feature="manualInput" compact title={tx("Isi dan koreksi langsung di tabel", "Fill in and correct directly in the table")} />
            </div>
          )}
          <Tabs tabs={TABS.filter((t) => expert || !t.expertOnly).map((t) => ({ id: t.id, label: pick(expert ? t.expertLabel : t.label), count: issueCount(t.issueTab) }))} value={tab} onChange={setTab} />
          <CardBody>
            {stage && (
              <p className="mb-3 flex items-center gap-2 text-xs text-navy-800">
                <StageDot id={stage} /> {tx(`Hanya tahap ${plainStage(project, stage)}`, `Only stage ${plainStage(project, stage)}`)}
                <button type="button" className="text-brand-blue underline" onClick={() => setStage(null)}>
                  {tx("hapus filter", "clear filter")}
                </button>
              </p>
            )}
            {tab === "input" && <InputTable project={project} categories={["Chemical", "Anode", "Water", "WWTPChemical", "Consumable"]} stage={stage} readOnly={readOnly} issues={issueMap} />}
            {tab === "energy" && <InputTable project={project} categories={["Energy"]} stage={stage} readOnly={readOnly} issues={issueMap} />}
            {tab === "air" && <AirTable project={project} readOnly={readOnly} stage={stage} />}
            {tab === "effluent" && <EffluentTable project={project} readOnly={readOnly} issues={issueMap} />}
            {tab === "waste" && <WasteTable project={project} readOnly={readOnly} stage={stage} />}
            {tab === "production" && <ProductionForm project={project} readOnly={readOnly} />}
            {tab === "prices" && (manual ? <PriceForm project={project} /> : <LockedFeature feature="manualInput" title={tx("Harga riil per item", "Actual price per item")} />)}
            {tab === "mapping" && expert && <MappingTable project={project} readOnly={!can(role, "editData") && !can(role, "editMethod")} />}
          </CardBody>
        </Card>
      </div>

      {docFile && <DocumentImport file={docFile} project={project} onClose={() => setDocFile(null)} />}
      <Modal
        open={confirmRestore}
        title={tx("Kembalikan data sebelum unggah", "Restore data from before upload")}
        onClose={() => setConfirmRestore(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRestore(false)}>
              {tx("Batal", "Cancel")}
            </Button>
            <Button
              onClick={() => {
                if (restoreImportBackup()) notify("success", tx("Data sebelum unggah dikembalikan sebagai versi data baru.", "Data from before the upload was restored as a new data version."));
                setConfirmRestore(false);
              }}
            >
              <RotateCcw className="h-4 w-4" /> {tx("Kembalikan", "Restore")}
            </Button>
          </>
        }
      >
        {backups[0] && (
          <p>
            <T
              id={
                <>
                  Data saat ini diganti dengan data sebelum dokumen <b>{backups[0].source}</b> diunggah ({new Date(backups[0].at).toLocaleString(locale())}). Perubahan dicatat di jejak audit.
                </>
              }
              en={
                <>
                  The current data will be replaced with the data from before <b>{backups[0].source}</b> was uploaded ({new Date(backups[0].at).toLocaleString(locale())}). The change is recorded in the audit trail.
                </>
              }
            />
          </p>
        )}
      </Modal>
      <ReasonDialog
        open={reopen}
        title={tx(`Buka data versi ${project.dataset.version + 1}`, `Open data version ${project.dataset.version + 1}`)}
        description={tx("Versi yang sudah disetujui tetap utuh dan hasil tersimpan lama tidak berubah. Versi baru kembali ke status draf.", "The approved version stays intact and older saved results do not change. The new version goes back to draft status.")}
        confirmLabel={tx("Buka versi baru", "Open new version")}
        onCancel={() => setReopen(false)}
        onConfirm={(r) => {
          reopenDataset(r);
          setReopen(false);
        }}
      />

      <Modal
        open={!!pending}
        title={tx(`Hasil membaca file — ${pending?.file ?? ""}`, `File read result — ${pending?.file ?? ""}`)}
        onClose={() => setPending(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              {tx("Batal", "Cancel")}
            </Button>
            <Button
              disabled={!pending || pending.report.accepted === 0}
              onClick={() => {
                if (pending && applyDatasetPatch(pending.patch, pending.file)) notify("success", tx(`${pending.report.accepted} baris diterapkan dari ${pending.file}.`, `${pending.report.accepted} rows applied from ${pending.file}.`));
                setPending(null);
              }}
            >
              <FileSpreadsheet className="h-4 w-4" /> {tx(`Terapkan ${pending?.report.accepted ?? 0} baris`, `Apply ${pending?.report.accepted ?? 0} rows`)}
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">{tx(`${pending.report.accepted} diterima`, `${pending.report.accepted} accepted`)}</Badge>
              <Badge tone="red">{tx(`${pending.report.rejected.length} ditolak`, `${pending.report.rejected.length} rejected`)}</Badge>
              <Badge tone="gold">{tx(`${pending.report.warnings.length} peringatan`, `${pending.report.warnings.length} warnings`)}</Badge>
            </div>
            {[...pending.report.rejected.map((r) => ({ ...r, kind: tx("Ditolak", "Rejected") })), ...pending.report.warnings.map((r) => ({ ...r, kind: tx("Peringatan", "Warning") }))].slice(0, 40).map((r, i) => (
              <p key={i} className="text-navy-800">
                <b>{r.kind}</b> · {r.sheet} {tx("baris", "row")} {r.row}: {r.reason}
              </p>
            ))}
            <p className="text-navy-700/60">
              {tx(
                "Hanya nilai sel yang dibaca; rumus dan makro diabaikan. Baris yang ditolak tidak dipakai dan tetap dilaporkan di sini.",
                "Only cell values are read; formulas and macros are ignored. Rejected rows are not used and are still reported here.",
              )}
            </p>
            <Link href="/pengaturan?tab=keamanan" className="text-brand-blue underline">
              {tx("Unggahan dicatat di jejak audit", "Uploads are recorded in the audit trail")}
            </Link>
          </div>
        )}
      </Modal>
    </div>
  );
}
