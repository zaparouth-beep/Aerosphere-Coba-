"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { CheckCircle2, Database, Download, FileJson, Link2, RefreshCw, ShieldCheck, Trash2, Upload, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout, Modal } from "@/components/ui/Feedback";
import { Field, NumberInput, Textarea, TextInput } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { can, PERMISSION_LABEL, PERMISSIONS, ROLE_LABEL, ROLES } from "@/lib/domain/permissions";
import { TEMPLATES } from "@/lib/domain/templates";
import type { Role } from "@/lib/domain/types";
import { ENGINE_VERSION } from "@/lib/engine/calculate";
import { IMPACT_CATEGORIES } from "@/lib/engine/method";
import { rerunCheck, verifyChain } from "@/lib/engine/run";
import { BACKGROUND_TEMPLATE, CF_TEMPLATE, parseBackgroundCsv, parseCfCsv } from "@/lib/io/csvImport";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults } from "@/lib/store/useResults";
import { downloadBlob, downloadCSV, downloadJSON, fileStamp } from "@/lib/utils/export";
import { fmtDate, fmtSig } from "@/lib/utils/format";
import { stageLabel } from "@/lib/view/helpers";

type Tab = "project" | "method" | "runs" | "access" | "audit";

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}

function Settings() {
  const search = useSearchParams();
  const [tab, setTab] = useState<Tab>((search.get("tab") as Tab) || "project");
  return (
    <Card>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "project", label: "Proyek & target" },
          { id: "method", label: "Metode & database" },
          { id: "runs", label: "Run & manifest" },
          { id: "access", label: "Akses & peran" },
          { id: "audit", label: "Audit log" },
        ]}
      />
      <CardBody>
        {tab === "project" && <ProjectTab />}
        {tab === "method" && <MethodTab />}
        {tab === "runs" && <RunsTab />}
        {tab === "access" && <AccessTab />}
        {tab === "audit" && <AuditTab />}
      </CardBody>
    </Card>
  );
}

/* --------------------------------- Project -------------------------------- */

function ProjectTab() {
  const project = useAppStore((s) => s.project);
  const updateProjectMeta = useAppStore((s) => s.updateProjectMeta);
  const updateTargets = useAppStore((s) => s.updateTargets);
  const updateStageScores = useAppStore((s) => s.updateStageScores);
  const loadTemplate = useAppStore((s) => s.loadTemplate);
  const importProject = useAppStore((s) => s.importProject);
  const notify = useAppStore((s) => s.notify);
  const [confirmTpl, setConfirmTpl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const t = project.targets;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-navy-900">Metadata proyek</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nama proyek">
            <TextInput value={project.name} onCommit={(v) => updateProjectMeta({ name: v })} />
          </Field>
          <Field label="Fasilitas">
            <TextInput value={project.facility} onCommit={(v) => updateProjectMeta({ facility: v })} />
          </Field>
          <Field label="Klien">
            <TextInput value={project.client} onCommit={(v) => updateProjectMeta({ client: v })} />
          </Field>
          <Field label="Periode (label)">
            <TextInput value={project.periodLabel} onCommit={(v) => updateProjectMeta({ periodLabel: v })} />
          </Field>
          <Field label="Jumlah bulan dalam periode" hint="Dipakai untuk data per bulan.">
            <NumberInput value={project.periodMonths} min={1} onCommit={(v) => updateProjectMeta({ periodMonths: v ?? 12 })} />
          </Field>
          <Field label="Part">
            <TextInput value={project.partName} onCommit={(v) => updateProjectMeta({ partName: v })} />
          </Field>
          <Field label="Material substrat">
            <TextInput value={project.substrate} onCommit={(v) => updateProjectMeta({ substrate: v })} />
          </Field>
          <Field label="Jenis lapisan">
            <TextInput value={project.coatingType} onCommit={(v) => updateProjectMeta({ coatingType: v })} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-navy-900">Target perusahaan (M12)</h3>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Baseline">
            <TextInput value={t.baselineLabel} onCommit={(v) => updateTargets({ baselineLabel: v })} />
          </Field>
          <Field label="Target tahun">
            <NumberInput value={t.targetYear} min={2000} onCommit={(v) => updateTargets({ targetYear: v ?? t.targetYear })} />
          </Field>
          <Field label="GWP turun (%)">
            <NumberInput value={t.gwpReductionPct} min={0} onCommit={(v) => updateTargets({ gwpReductionPct: v ?? 0 })} />
          </Field>
          <Field label="Limbah B3 turun (%)">
            <NumberInput value={t.wasteReductionPct} min={0} onCommit={(v) => updateTargets({ wasteReductionPct: v ?? 0 })} />
          </Field>
          <Field label="Air turun (%)">
            <NumberInput value={t.waterReductionPct} min={0} onCommit={(v) => updateTargets({ waterReductionPct: v ?? 0 })} />
          </Field>
          <Field label="Discount rate NPV (%)">
            <NumberInput value={t.discountRatePct} min={0} onCommit={(v) => updateTargets({ discountRatePct: v ?? 0 })} />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-navy-900">Jam kerja per tahap (kunci alokasi system cost)</h3>
        <p className="mb-3 text-xs text-navy-700/65">Bila kosong, tenaga kerja & depresiasi dibagi rata ke tahap dalam boundary.</p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {project.stages.map((s) => (
            <Field key={s.id} label={`${stageLabel(project, s.id)} (jam/periode)`}>
              <NumberInput value={project.laborHoursByStage[s.id]} min={0} onCommit={(v) => updateStageScores("laborHoursByStage", s.id, v ?? 0)} />
            </Field>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-navy-900">Proyek baru dari template (FR-01.5)</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TEMPLATES.map((tpl) => (
            <button key={tpl.id} type="button" onClick={() => setConfirmTpl(tpl.id)} className="rounded-lg border border-sand-200 p-3 text-left hover:border-brand-blue/40">
              <p className="text-xs font-semibold text-navy-900">{tpl.label}</p>
              <p className="mt-1 text-[11px] text-navy-700/65">{tpl.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => downloadJSON(project, `AeroSphere-proyek-${fileStamp()}.json`)}>
          <FileJson className="h-4 w-4" /> Ekspor proyek (JSON)
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Impor proyek (JSON)
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > 25 * 1024 * 1024) return notify("error", "File melebihi 25 MB.");
            try {
              importProject(JSON.parse(await f.text()));
            } catch {
              notify("error", "File bukan JSON yang valid.");
            }
          }}
        />
      </section>

      <Modal
        open={!!confirmTpl}
        title="Buat proyek dari template?"
        onClose={() => setConfirmTpl(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmTpl(null)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                if (confirmTpl) loadTemplate(confirmTpl);
                setConfirmTpl(null);
              }}
            >
              Buat proyek
            </Button>
          </>
        }
      >
        Proyek aktif akan diganti. Ekspor proyek ke JSON lebih dulu bila ingin menyimpannya. Run terkunci dan audit log tetap tersimpan.
      </Modal>
    </div>
  );
}

/* ---------------------------------- Method -------------------------------- */

function MethodTab() {
  const project = useAppStore((s) => s.project);
  const upsertBackground = useAppStore((s) => s.upsertBackground);
  const removeBackground = useAppStore((s) => s.removeBackground);
  const upsertFlowCF = useAppStore((s) => s.upsertFlowCF);
  const notify = useAppStore((s) => s.notify);
  const [bgText, setBgText] = useState("");
  const [cfText, setCfText] = useState("");

  return (
    <div className="space-y-6">
      <Callout tone="info">
        Engine ini database-agnostic (P3). Faktor background (dampak cradle-to-gate per kg/L/kWh) dan faktor karakterisasi dihitung di openLCA dengan USLCI/LCA Commons, ecoinvent
        (bila berlisensi), atau database lain, lalu diimpor di sini. Hanya nilai yang bersumber yang disertakan bawaan; sel kosong berarti belum tersedia, bukan nol.
      </Callout>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <Database className="h-4 w-4 text-brand-teal" /> Dataset background ({project.backgrounds.length})
          </h3>
          <Button size="sm" variant="secondary" onClick={() => downloadBlob(BACKGROUND_TEMPLATE, "template-dataset-background.csv", "text/csv")}>
            <Download className="h-3.5 w-3.5" /> Template CSV
          </Button>
        </div>
        <Table caption="Dataset background">
          <THead>
            <tr>
              <Th>Dataset</Th>
              <Th>Provider · versi</Th>
              <Th>Geografi</Th>
              <Th>Unit</Th>
              {IMPACT_CATEGORIES.slice(0, 4).map((c) => (
                <Th key={c.id} align="right">
                  {c.short}
                </Th>
              ))}
              <Th align="right">Kategori lain</Th>
              <Th />
            </tr>
          </THead>
          <tbody>
            {project.backgrounds.map((b) => (
              <Tr key={b.id}>
                <Td className="text-xs font-medium">{b.name}</Td>
                <Td className="text-xs">
                  {b.provider} · {b.version}
                </Td>
                <Td className="text-xs">{b.geography}</Td>
                <Td className="text-xs">{b.refUnit}</Td>
                {IMPACT_CATEGORIES.slice(0, 4).map((c) => (
                  <Td key={c.id} num>
                    {b.factors[c.id] !== undefined ? fmtSig(b.factors[c.id]!) : "–"}
                  </Td>
                ))}
                <Td num>{IMPACT_CATEGORIES.slice(4).filter((c) => b.factors[c.id] !== undefined).length}/7</Td>
                <Td>
                  <IconButton label={`Hapus ${b.name}`} onClick={() => removeBackground(b.id)} className="hover:text-status-danger">
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <Field label="Impor dataset background (CSV; kolom id;name;provider;version;geography;ref_unit;cc;ac;euf;pof;pm;rum;ruf;htc;htnc;etf;wu)" className="mt-3">
          <Textarea rows={4} value={bgText} onChange={(e) => setBgText(e.target.value)} className="num text-xs" placeholder={BACKGROUND_TEMPLATE} />
        </Field>
        <Button
          size="sm"
          className="mt-2"
          disabled={!bgText.trim()}
          onClick={() => {
            const { datasets, errors } = parseBackgroundCsv(bgText, new Date().toISOString());
            datasets.forEach((d) => upsertBackground(d));
            notify(errors.length ? "error" : "success", `${datasets.length} dataset diimpor${errors.length ? `; ${errors.length} baris ditolak: ${errors.slice(0, 3).join("; ")}` : ""}.`);
            if (!errors.length) setBgText("");
          }}
        >
          <Upload className="h-3.5 w-3.5" /> Terapkan
        </Button>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-navy-900">Faktor karakterisasi emisi langsung — {project.method.release}</h3>
          <Button size="sm" variant="secondary" onClick={() => downloadBlob(CF_TEMPLATE, "template-cf.csv", "text/csv")}>
            <Download className="h-3.5 w-3.5" /> Template CSV
          </Button>
        </div>
        <Table caption="Faktor karakterisasi">
          <THead>
            <tr>
              <Th>Aliran</Th>
              <Th>Media</Th>
              <Th>Faktor (per kg)</Th>
              <Th>Sumber</Th>
            </tr>
          </THead>
          <tbody>
            {project.method.flows.map((f) => {
              const entries = Object.entries(f.factors);
              return (
                <Tr key={f.key}>
                  <Td className="text-xs font-medium">{f.label}</Td>
                  <Td className="text-xs">{f.compartment === "air" ? "udara" : "air"}</Td>
                  <Td className="text-xs">{entries.length ? entries.map(([k, v]) => `${IMPACT_CATEGORIES.find((c) => c.id === k)?.short}: ${fmtSig(v)}`).join(" · ") : <Badge tone="gold">belum ada CF</Badge>}</Td>
                  <Td className="text-[11px] text-navy-700/65">{f.source}</Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
        <Field label="Impor CF (CSV; kolom key;label;compartment;cc;ac;…)" className="mt-3">
          <Textarea rows={3} value={cfText} onChange={(e) => setCfText(e.target.value)} className="num text-xs" placeholder={CF_TEMPLATE} />
        </Field>
        <Button
          size="sm"
          className="mt-2"
          disabled={!cfText.trim()}
          onClick={() => {
            const { flows, errors } = parseCfCsv(cfText);
            if (flows.length) upsertFlowCF(flows, `${project.method.release.replace(/ \+ impor.*$/, "")} + impor ${new Date().toISOString().slice(0, 10)}`);
            notify(errors.length ? "error" : "success", `${flows.length} CF diimpor${errors.length ? `; ${errors.length} ditolak` : ""}.`);
            if (!errors.length) setCfText("");
          }}
        >
          <Upload className="h-3.5 w-3.5" /> Terapkan
        </Button>
      </section>
    </div>
  );
}

/* ----------------------------------- Runs --------------------------------- */

function RunsTab() {
  const runs = useAppStore((s) => s.runs);
  const runCalculation = useAppStore((s) => s.runCalculation);
  const deleteRun = useAppStore((s) => s.deleteRun);
  const setUi = useAppStore((s) => s.setUi);
  const log = useAppStore((s) => s.log);
  const { results } = useActiveResults();
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [manifest, setManifest] = useState<string | null>(null);
  const v = results.validation;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => runCalculation("draft")}>Run draf</Button>
        <Button variant="brand" disabled={!v.readyForOfficialRun} onClick={() => runCalculation("official")}>
          <ShieldCheck className="h-4 w-4" /> Run resmi
        </Button>
        {!v.readyForOfficialRun && <span className="text-xs text-navy-700/65">Run resmi butuh scope terkunci, dataset approved, tanpa error, dan semua aliran dipetakan.</span>}
      </div>
      <Table caption="Run terkunci">
        <THead>
          <tr>
            <Th>Run</Th>
            <Th>Jenis</Th>
            <Th>Dibuat</Th>
            <Th>Scope · dataset</Th>
            <Th>Hash hasil</Th>
            <Th>Reproduksi</Th>
            <Th />
          </tr>
        </THead>
        <tbody>
          {runs.map((r) => (
            <Tr key={r.id}>
              <Td className="num text-xs font-medium">{r.label}</Td>
              <Td>
                <Badge tone={r.manifest.kind === "official" ? "green" : "neutral"}>{r.manifest.kind === "official" ? "resmi" : "draf"}</Badge>
              </Td>
              <Td className="text-xs">
                {fmtDate(r.manifest.createdAt)} · {r.manifest.createdBy}
              </Td>
              <Td className="text-xs">
                v{r.manifest.scopeVersion}
                {r.manifest.scopeLocked ? " (terkunci)" : ""} · v{r.manifest.datasetVersion} {r.manifest.datasetStatus}
              </Td>
              <Td className="num text-[11px]">{r.resultHash.slice(0, 16)}…</Td>
              <Td>
                {checks[r.id] === undefined ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const res = rerunCheck(r);
                      setChecks((c) => ({ ...c, [r.id]: res.ok }));
                      log("run", r.id, "rerun-check", { newValue: res });
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Re-run dari manifest
                  </Button>
                ) : checks[r.id] ? (
                  <Badge tone="green">
                    <CheckCircle2 className="h-3 w-3" /> hash identik
                  </Badge>
                ) : (
                  <Badge tone="red">
                    <XCircle className="h-3 w-3" /> berbeda
                  </Badge>
                )}
              </Td>
              <Td>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setUi({ activeRunId: r.id })}>
                    Tampilkan
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setManifest(JSON.stringify(r.manifest, null, 2))}>
                    Manifest
                  </Button>
                  {r.manifest.kind !== "official" && (
                    <IconButton label={`Hapus ${r.id}`} onClick={() => deleteRun(r.id)} className="hover:text-status-danger">
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
          {!runs.length && (
            <Tr>
              <Td colSpan={7} className="py-6 text-center text-xs text-navy-700/60">
                Belum ada run. Run mengunci snapshot data, versi metode, versi engine ({ENGINE_VERSION}), dan hash hasil.
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
      <Modal open={!!manifest} title="Run manifest" onClose={() => setManifest(null)}>
        <pre className="num max-h-[60vh] overflow-auto rounded bg-sand-50 p-3 text-[11px]">{manifest}</pre>
      </Modal>
    </div>
  );
}

/* ---------------------------------- Access -------------------------------- */

function AccessTab() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  return (
    <div className="space-y-5">
      <Callout tone="warn">
        Versi browser ini mensimulasikan RBAC di sisi klien untuk demo dan uji alur (FR-13.1). Autentikasi SSO/MFA, Row-Level Security, dan tautan auditor berbatas waktu
        membutuhkan backend (Keycloak + PostgreSQL, PRD 2.6–2.7) sebelum dipasang di pabrik.
      </Callout>
      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <Field label="Nama pengguna (tercatat di audit log)">
          <TextInput value={user.name} onCommit={(v) => setUser(v, user.role)} />
        </Field>
        <Field label="Peran aktif">
          <select className="w-full rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-sm" value={user.role} onChange={(e) => setUser(user.name, e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Table caption="Matriks izin">
        <THead>
          <tr>
            <Th>Izin</Th>
            {ROLES.map((r) => (
              <Th key={r} align="center">
                {ROLE_LABEL[r]}
              </Th>
            ))}
          </tr>
        </THead>
        <tbody>
          {PERMISSIONS.map((p) => (
            <Tr key={p}>
              <Td className="text-xs">{PERMISSION_LABEL[p]}</Td>
              {ROLES.map((r) => (
                <Td key={r} align="center">
                  {can(r, p) ? <CheckCircle2 className="mx-auto h-4 w-4 text-status-ok" aria-label="boleh" /> : <span className="text-navy-700/30" aria-label="tidak">–</span>}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </Table>
      <div className="flex items-start gap-2 rounded-lg border border-sand-200 p-3 text-xs">
        <Link2 className="mt-0.5 h-4 w-4 text-brand-teal" />
        <div>
          <p className="font-semibold text-navy-900">Mode auditor</p>
          <p className="text-navy-700/70">Ganti peran ke “Auditor (read-only)” untuk melihat Goal & Scope, LCI, mapping, metode, hasil, dan log perubahan tanpa bisa mengubah data.</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => setUser(user.name, "Auditor")}>
            Masuk mode auditor
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- Audit -------------------------------- */

function AuditTab() {
  const events = useAppStore((s) => s.events);
  const [filter, setFilter] = useState("");
  const broken = verifyChain(events);
  const rows = [...events].reverse().filter((e) => !filter || `${e.entity} ${e.action} ${e.actor} ${e.entityId}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {broken === null ? (
          <Badge tone="green">
            <ShieldCheck className="h-3.5 w-3.5" /> Hash chain utuh ({events.length} event)
          </Badge>
        ) : (
          <Badge tone="red">
            <XCircle className="h-3.5 w-3.5" /> Hash chain rusak mulai event #{broken}
          </Badge>
        )}
        <TextInput value={filter} onCommit={setFilter} placeholder="Filter entitas/aksi/aktor…" className="max-w-xs" ariaLabel="Filter audit log" />
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            downloadCSV(
              events.map((e) => ({ seq: e.seq, ts: e.ts, actor: e.actor, role: e.role, entity: e.entity, entity_id: e.entityId, action: e.action, old: JSON.stringify(e.oldValue ?? ""), new: JSON.stringify(e.newValue ?? ""), reason: e.reason ?? "", prev_hash: e.prevHash, hash: e.hash })),
              `AeroSphere-audit-log-${fileStamp()}.csv`,
            )
          }
        >
          <Download className="h-3.5 w-3.5" /> Ekspor CSV
        </Button>
      </div>
      <p className="text-xs text-navy-700/65">Append-only: setiap event menyimpan hash event sebelumnya sehingga perubahan pada riwayat terdeteksi (PRD 2.4).</p>
      <Table caption="Audit log">
        <THead>
          <tr>
            <Th>#</Th>
            <Th>Waktu</Th>
            <Th>Aktor</Th>
            <Th>Entitas</Th>
            <Th>Aksi</Th>
            <Th className="min-w-[260px]">Perubahan / alasan</Th>
            <Th>Hash</Th>
          </tr>
        </THead>
        <tbody>
          {rows.slice(0, 300).map((e) => (
            <Tr key={e.seq}>
              <Td num>{e.seq}</Td>
              <Td className="whitespace-nowrap text-[11px]">{fmtDate(e.ts)}</Td>
              <Td className="text-[11px]">
                {e.actor} <span className="text-navy-700/55">({e.role})</span>
              </Td>
              <Td className="text-[11px]">
                {e.entity} <span className="num text-navy-700/55">{e.entityId.slice(0, 18)}</span>
              </Td>
              <Td>
                <Badge tone={e.action === "denied" ? "red" : e.action.startsWith("approve") || e.action === "lock" ? "green" : "neutral"}>{e.action}</Badge>
              </Td>
              <Td className="max-w-[420px] text-[11px] text-navy-800">
                {e.reason && <p className="font-medium">Alasan: {e.reason}</p>}
                {e.oldValue !== undefined && <p className="truncate text-navy-700/60">lama: {JSON.stringify(e.oldValue)}</p>}
                {e.newValue !== undefined && <p className="truncate">baru: {JSON.stringify(e.newValue)}</p>}
              </Td>
              <Td className="num text-[10px] text-navy-700/55">{e.hash.slice(0, 10)}…</Td>
            </Tr>
          ))}
          {!rows.length && (
            <Tr>
              <Td colSpan={7} className="py-6 text-center text-xs text-navy-700/60">
                Belum ada event.
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
