"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleHelp, FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Callout, Modal } from "@/components/ui/Feedback";
import type { InputCategory, Project, StageId } from "@/lib/domain/types";
import { aiAvailable, readWithAi, type AiProgress } from "@/lib/io/aiReader";
import { extractDocument, type ExtractedDoc } from "@/lib/io/docExtract";
import { buildImport } from "@/lib/io/readerApply";
import { readDocument, summarise, type ReadRow, type RowKind } from "@/lib/io/smartReader";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils/cn";

/**
 * Upload any inventory document (Excel, CSV, PDF, Word), let the smart reader
 * (and optionally the AI reader) propose rows, review and correct them, then
 * replace the project inventory. Nothing changes until "Ganti data proyek".
 */

const KIND_LABEL: Record<RowKind, string> = {
  input: "Input",
  air: "Emisi udara",
  effluent: "Air buangan",
  waste: "Limbah B3",
  production: "Produksi",
  impact: "Hasil dampak (pembanding)",
  ignore: "Abaikan",
};
const KIND_ORDER: RowKind[] = ["input", "production", "air", "effluent", "waste", "impact", "ignore"];
const CATEGORY_LABEL: Record<InputCategory, string> = {
  Chemical: "Bahan kimia",
  Anode: "Anoda",
  Water: "Air",
  Energy: "Listrik/energi",
  WWTPChemical: "Kimia IPAL",
  Consumable: "Habis pakai",
};
const STAGES: StageId[] = ["A", "B", "C", "D", "E", "F"];
const CONF = { high: { label: "Yakin", tone: "green" }, medium: { label: "Ragu", tone: "gold" }, low: { label: "Tidak dikenali", tone: "red" } } as const;

type Phase = { step: "reading" } | { step: "review" } | { step: "error"; message: string };

export function DocumentImport({ file, project, onClose }: { file: File; project: Project; onClose: () => void }) {
  const importDocumentData = useAppStore((s) => s.importDocumentData);
  const notify = useAppStore((s) => s.notify);
  const [phase, setPhase] = useState<Phase>({ step: "reading" });
  const [doc, setDoc] = useState<ExtractedDoc | null>(null);
  const [ruleRows, setRuleRows] = useState<ReadRow[]>([]);
  const [rows, setRows] = useState<ReadRow[]>([]);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [ai, setAi] = useState<{ available: boolean | null; consent: boolean; running: AiProgress | null; error: string | null; used: boolean }>({
    available: null,
    consent: false,
    running: null,
    error: null,
    used: false,
  });

  useEffect(() => {
    let alive = true;
    extractDocument(file)
      .then((d) => {
        if (!alive) return;
        const read = readDocument(d);
        setDoc(d);
        setRuleRows(read);
        setRows(read);
        setPhase({ step: "review" });
      })
      .catch((e: Error) => alive && setPhase({ step: "error", message: e.message }));
    aiAvailable().then((available) => alive && setAi((a) => ({ ...a, available })));
    return () => {
      alive = false;
    };
  }, [file]);

  const summary = useMemo(() => summarise(rows), [rows]);
  const shown = useMemo(
    () => [...rows].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)).filter((r) => !onlyIssues || r.confidence !== "high" || !r.include),
    [rows, onlyIssues],
  );
  const update = (id: string, patch: Partial<ReadRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch, confidence: patch.confidence ?? (patch.kind || patch.category || patch.stage || patch.quantity !== undefined ? "high" : r.confidence) } : r)));

  const runAi = async () => {
    if (!doc) return;
    setAi((a) => ({ ...a, error: null, running: { done: 0, total: 1 } }));
    try {
      const aiRows = await readWithAi(doc, (p) => setAi((a) => ({ ...a, running: p })));
      setRows(aiRows);
      setAi((a) => ({ ...a, running: null, used: true }));
    } catch (e) {
      setAi((a) => ({ ...a, running: null, error: (e as Error).message }));
    }
  };

  const apply = () => {
    const { data, skipped } = buildImport(rows, project, file.name);
    if (!importDocumentData(data, file.name)) return;
    const n = data.inputs.length + data.airEmissions.length + data.effluent.length + data.waste.length;
    notify("success", `Data proyek diganti dari ${file.name}: ${n} baris inventori${data.externalImpacts ? `, ${data.externalImpacts.length} hasil dampak pembanding` : ""}. Data lama disimpan sebagai cadangan.`);
    if (skipped.length) notify("error", `${skipped.length} baris dilewati: ${skipped.map((s) => `${s.row.name} (${s.reason})`).join("; ")}`);
    onClose();
  };

  const used = rows.filter((r) => r.include).length;

  return (
    <Modal
      open
      size="xl"
      title={`Baca dokumen — ${file.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={phase.step !== "review" || !summary.canApply} onClick={apply} title={summary.canApply ? undefined : "Dokumen harus berisi input dan output"} data-testid="import-apply">
            <CheckCircle2 className="h-4 w-4" /> Ganti data proyek ({used} baris)
          </Button>
        </>
      }
    >
      {phase.step === "reading" && (
        <p className="flex items-center gap-2 py-10 text-sm text-navy-800">
          <Loader2 className="h-4 w-4 animate-spin" /> Membaca dokumen…
        </p>
      )}
      {phase.step === "error" && <Callout tone="danger">{phase.message}</Callout>}
      {phase.step === "review" && doc && (
        <div className="space-y-4" data-testid="import-review">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <FileText className="h-4 w-4 text-brand-blue" aria-hidden />
            <span className="text-navy-700/75">
              {doc.tables.length} tabel/halaman · dibaca oleh {ai.used ? "AI (Claude)" : "pembaca otomatis"}
            </span>
            <Badge tone="blue">{summary.inputs} input</Badge>
            <Badge tone="blue">{summary.outputs} output</Badge>
            <Badge tone="neutral">{summary.production} produksi</Badge>
            <Badge tone="neutral">{summary.impacts} hasil dampak</Badge>
            {summary.low > 0 && <Badge tone="red">{summary.low} tidak dikenali</Badge>}
          </div>

          {summary.problems.length > 0 ? (
            <Callout tone="danger">
              <span data-testid="import-problems">{summary.problems.join(" ")}</span> Perbaiki jenis baris di tabel, atau coba analisis dengan AI.
            </Callout>
          ) : (
            <Callout tone="ok">Input dan output lengkap. Periksa baris bertanda “Ragu” atau “Tidak dikenali”, lalu tekan “Ganti data proyek”.</Callout>
          )}
          {!summary.hasArea && <Callout tone="warn">Luas permukaan dilapisi tidak ditemukan; nilai sekarang ({project.production.areaM2} m²) tetap dipakai.</Callout>}

          <div className="rounded-xl border border-brand-teal/40 bg-brand-teal/5 p-3 text-xs text-navy-800" data-testid="ai-panel">
            <p className="flex items-center gap-1.5 font-semibold text-navy-900">
              <Sparkles className="h-4 w-4 text-brand-teal" aria-hidden /> Analisis dengan AI
            </p>
            {ai.used ? (
              <p className="mt-1">
                Baris di bawah dibaca AI. Angka yang tidak ditemukan di dokumen ditandai dan tidak dipakai.{" "}
                <button type="button" className="font-medium text-brand-blue underline" onClick={() => (setRows(ruleRows), setAi((a) => ({ ...a, used: false })))}>
                  <ArrowLeft className="mr-0.5 inline h-3 w-3" />
                  Kembali ke hasil pembaca otomatis
                </button>
              </p>
            ) : (
              <>
                <p className="mt-1">
                  Bila banyak baris tidak dikenali, AI (Claude) bisa membaca dokumen yang tidak beraturan. Teks dokumen dikirim ke layanan AI Anthropic; angka yang tidak ditemukan di dokumen tidak dipakai.
                </p>
                <label className="mt-2 flex items-center gap-2">
                  <input type="checkbox" checked={ai.consent} onChange={(e) => setAi((a) => ({ ...a, consent: e.target.checked }))} />
                  Saya setuju isi dokumen ini dikirim ke layanan AI.
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="brand"
                    disabled={!ai.available || !ai.consent || !!ai.running}
                    title={ai.available === false ? "Analisis AI belum aktif di situs ini: kunci API Anthropic belum dipasang di pengaturan Netlify." : !ai.consent ? "Centang persetujuan dulu" : undefined}
                    onClick={runAi}
                    data-testid="ai-run"
                  >
                    {ai.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {ai.running ? `Membaca… ${ai.running.done}/${ai.running.total}` : "Analisis dengan AI"}
                  </Button>
                  {ai.available === false && <span className="text-navy-700/70" data-testid="ai-unavailable">Belum aktif di situs ini (kunci API belum dipasang di Netlify).</span>}
                </div>
              </>
            )}
            {ai.error && (
              <p className="mt-2 flex items-center gap-1 text-status-danger">
                <AlertTriangle className="h-3.5 w-3.5" /> {ai.error}{" "}
                <button type="button" className="inline-flex items-center gap-0.5 underline" onClick={runAi}>
                  <RefreshCw className="h-3 w-3" /> Coba lagi
                </button>
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <p className="font-semibold text-navy-900">Tinjau baris ({rows.length})</p>
            <label className="flex items-center gap-1.5 text-navy-800">
              <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} /> Tampilkan yang perlu diperiksa saja
            </label>
          </div>
          <div className="overflow-x-auto rounded-lg border border-sand-200">
            <table className="w-full min-w-[900px] text-xs" data-testid="import-table">
              <thead className="bg-sand-50 text-left text-[11px] text-navy-700/70">
                <tr>
                  <th className="px-2 py-1.5">Pakai</th>
                  <th className="px-2 py-1.5">Jenis</th>
                  <th className="px-2 py-1.5">Kategori</th>
                  <th className="px-2 py-1.5">Nama</th>
                  <th className="px-2 py-1.5 text-right">Jumlah</th>
                  <th className="px-2 py-1.5">Satuan</th>
                  <th className="px-2 py-1.5">Tahap</th>
                  <th className="px-2 py-1.5">Keyakinan</th>
                  <th className="px-2 py-1.5">Asal</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className={cn("border-t border-sand-100", !r.include && "bg-sand-50/70 text-navy-700/60")} data-testid={`import-row`} data-kind={r.kind}>
                    <td className="px-2 py-1">
                      <input type="checkbox" aria-label={`Pakai ${r.name}`} checked={r.include} onChange={(e) => update(r.id, { include: e.target.checked })} />
                    </td>
                    <td className="px-2 py-1">
                      <select aria-label={`Jenis ${r.name}`} className="rounded border border-sand-200 bg-white px-1 py-0.5" value={r.kind} onChange={(e) => update(r.id, { kind: e.target.value as RowKind, include: e.target.value !== "ignore" })}>
                        {KIND_ORDER.map((k) => (
                          <option key={k} value={k}>
                            {KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      {r.kind === "input" ? (
                        <select aria-label={`Kategori ${r.name}`} className="rounded border border-sand-200 bg-white px-1 py-0.5" value={r.category ?? "Chemical"} onChange={(e) => update(r.id, { category: e.target.value as InputCategory })}>
                          {(Object.keys(CATEGORY_LABEL) as InputCategory[]).map((c) => (
                            <option key={c} value={c}>
                              {CATEGORY_LABEL[c]}
                            </option>
                          ))}
                        </select>
                      ) : r.kind === "production" ? (
                        <select aria-label={`Data produksi ${r.name}`} className="rounded border border-sand-200 bg-white px-1 py-0.5" value={r.productionField ?? "areaM2"} onChange={(e) => update(r.id, { productionField: e.target.value as ReadRow["productionField"] })}>
                          <option value="areaM2">Luas dilapisi (m²)</option>
                          <option value="parts">Jumlah part</option>
                          <option value="effluentVolumeM3">Volume air limbah</option>
                        </select>
                      ) : (
                        <span className="text-navy-700/50">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      <input aria-label={`Nama baris ${r.id}`} className="w-48 rounded border border-sand-200 px-1 py-0.5" value={r.name} onChange={(e) => update(r.id, { name: e.target.value, confidence: r.confidence })} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input
                        aria-label={`Jumlah ${r.name}`}
                        className="num w-24 rounded border border-sand-200 px-1 py-0.5 text-right"
                        inputMode="decimal"
                        value={r.quantity ?? ""}
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(",", "."));
                          update(r.id, { quantity: Number.isFinite(n) ? n : null });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input aria-label={`Satuan ${r.name}`} className="w-20 rounded border border-sand-200 px-1 py-0.5" value={r.unit} onChange={(e) => update(r.id, { unit: e.target.value, confidence: r.confidence })} />
                    </td>
                    <td className="px-2 py-1">
                      {r.kind === "impact" || r.kind === "production" ? (
                        <span className="text-navy-700/50">—</span>
                      ) : (
                        <select aria-label={`Tahap ${r.name}`} className="rounded border border-sand-200 bg-white px-1 py-0.5" value={r.stage ?? ""} onChange={(e) => update(r.id, { stage: (e.target.value || null) as StageId | null })}>
                          <option value="">—</option>
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      <span className="inline-flex items-center gap-1" title={r.notes.join(" · ") || undefined}>
                        <Badge tone={CONF[r.confidence].tone}>{CONF[r.confidence].label}</Badge>
                        {r.notes.length > 0 && <CircleHelp className="h-3.5 w-3.5 text-navy-700/50" aria-label={r.notes.join(" · ")} />}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-2 py-1 text-navy-700/60" title={r.raw.join(" | ")}>
                      {r.origin === "ai" ? "AI · " : ""}
                      {r.table}
                      {r.rowIndex ? ` baris ${r.rowIndex}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-navy-700/60">
            “Hasil dampak (pembanding)” hanya ditampilkan berdampingan dengan hitungan AeroSphere di halaman Hasil; angkanya tidak dipakai dalam perhitungan. Data proyek yang lama disimpan sebagai cadangan dan bisa dikembalikan dari Data Saya.
          </p>
        </div>
      )}
    </Modal>
  );
}
