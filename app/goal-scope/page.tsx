"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, History, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { STAGE_COLOR } from "@/components/charts/palette";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout, ReasonDialog } from "@/components/ui/Feedback";
import { Field, Input, NumberInput, Select, TextInput } from "@/components/ui/Input";
import type { AllocationKey, BoundaryType, FuType, Scope } from "@/lib/domain/types";
import { FU_LABEL } from "@/lib/engine/lci";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults } from "@/lib/store/useResults";
import { cn } from "@/lib/utils/cn";
import { fmt, fmtDate } from "@/lib/utils/format";

const STEPS = ["Tujuan", "FU & reference flow", "Boundary", "Cut-off & alokasi", "Metode & database"] as const;

const BOUNDARY_LABEL: Record<BoundaryType, { label: string; desc: string }> = {
  "gate-to-gate": { label: "Gate-to-gate", desc: "Hanya emisi langsung lini (tanpa produksi hulu input)." },
  "gate-to-gate+upstream": { label: "Gate-to-gate + upstream", desc: "Lini A–F + produksi hulu input lewat dataset background (default)." },
  "cradle-to-gate": { label: "Cradle-to-gate", desc: "Ditambah pengolahan limbah B3 di vendor (Scope 3 kat. 5)." },
};

export default function GoalScopePage() {
  const project = useAppStore((s) => s.project);
  const updateScope = useAppStore((s) => s.updateScope);
  const lockScope = useAppStore((s) => s.lockScope);
  const newScopeVersion = useAppStore((s) => s.newScopeVersion);
  const toggleStage = useAppStore((s) => s.toggleStageBoundary);
  const updateProduction = useAppStore((s) => s.updateProduction);
  const { results } = useActiveResults();
  const [step, setStep] = useState(0);
  const [reasonOpen, setReasonOpen] = useState(false);
  const scope = project.scope;
  const locked = !!scope.lockedAt;
  const set = (patch: Partial<Scope>) => updateScope(patch);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          eyebrow="M01 · ISO 14044 §4.2"
          title={`Goal & Scope — versi ${scope.version}`}
          subtitle={locked ? `Dikunci ${fmtDate(scope.lockedAt)} oleh ${scope.lockedBy}. Run baru merujuk versi ini.` : "Draf: lengkapi lima langkah lalu kunci. Setiap perubahan setelah dikunci membuat versi baru."}
          action={
            locked ? (
              <Button variant="secondary" onClick={() => setReasonOpen(true)}>
                <Unlock className="h-4 w-4" /> Buat versi baru
              </Button>
            ) : (
              <Button variant="brand" onClick={lockScope}>
                <Lock className="h-4 w-4" /> Kunci Scope v{scope.version}
              </Button>
            )
          }
        />
        <ol className="flex flex-wrap gap-1 border-b border-sand-200 px-4 py-3" aria-label="Langkah wizard">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={step === i ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  step === i ? "border-navy-900 bg-navy-900 text-white" : "border-sand-300 bg-white text-navy-700 hover:border-navy-600",
                )}
              >
                <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[10px]", step === i ? "bg-white text-navy-900" : "bg-sand-200")}>{i + 1}</span>
                {s}
              </button>
            </li>
          ))}
        </ol>
        <CardBody>
          <fieldset disabled={locked} className="space-y-4 disabled:opacity-80">
            {step === 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tujuan studi" hint="Apa yang ingin dijawab dan untuk keputusan apa.">
                  <TextInput multiline rows={4} value={scope.goal} onCommit={(v) => set({ goal: v })} />
                </Field>
                <Field label="Audiens & penggunaan" hint="Klaim komparatif publik butuh critical review independen (ISO 14044 §6).">
                  <TextInput multiline rows={4} value={scope.intendedAudience} onCommit={(v) => set({ intendedAudience: v })} />
                </Field>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Satuan fungsi (FU)">
                    <Select value={scope.fuType} onChange={(e) => set({ fuType: e.target.value as FuType })}>
                      <option value="m2">1 m² permukaan ter-plating (primer)</option>
                      <option value="part">1 part (pendukung)</option>
                      <option value="kg">1 kg komponen ter-plating (pendukung)</option>
                    </Select>
                  </Field>
                  <Field label="Luas ter-plating per periode (m²)">
                    <NumberInput value={project.production.areaM2} min={0} onCommit={(v) => updateProduction({ areaM2: v ?? 0 })} />
                  </Field>
                  <Field label="Jumlah part per periode">
                    <NumberInput value={project.production.parts} min={0} onCommit={(v) => updateProduction({ parts: v ?? 0 })} />
                  </Field>
                  <Field label="Massa komponen per periode (kg)">
                    <NumberInput value={project.production.componentMassKg} min={0} onCommit={(v) => updateProduction({ componentMassKg: v ?? 0 })} />
                  </Field>
                </div>
                <p className="text-xs text-navy-800">
                  Reference flow saat ini: <b className="num">{fmt(results.lci.referenceFlow)} {FU_LABEL[scope.fuType]}</b> per {project.periodLabel}
                  {project.production.reworkPct > 0 && <> (sudah dikurangi rework {fmt(project.production.reworkPct)}%)</>}.
                </p>
                {scope.fuType === "kg" && (
                  <Callout tone="warn">
                    FU per kg kurang tepat bila luas permukaan antar-part sangat bervariasi: Takuma et al. (2018) mencatat fluktuasi bulanan karena bentuk dan
                    luas part berbeda. Pertahankan 1 m² sebagai FU primer (FR-01.4).
                  </Callout>
                )}
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-navy-800">Klik tahap untuk memasukkan/mengeluarkan dari boundary (tahap di luar boundary tampil abu-abu).</p>
                  <div className="flex flex-wrap items-stretch gap-2">
                    {project.stages.map((st, i) => (
                      <div key={st.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStage(st.id)}
                          aria-pressed={st.inBoundary}
                          className={cn(
                            "w-[150px] rounded-lg border-2 p-3 text-left transition-colors",
                            st.inBoundary ? "border-transparent bg-white shadow-card" : "border-dashed border-sand-300 bg-sand-50 opacity-60",
                          )}
                          style={st.inBoundary ? { borderColor: STAGE_COLOR[st.id] } : undefined}
                        >
                          <span className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: st.inBoundary ? STAGE_COLOR[st.id] : "#9aa0ad" }}>
                              {st.id}
                            </span>
                            <span className="text-xs font-semibold text-navy-900">{st.name}</span>
                          </span>
                          <span className="mt-1 block text-[11px] text-navy-700/65">{st.subprocesses.join(", ")}</span>
                          <span className="mt-1.5 block text-[10px] font-medium uppercase tracking-wide text-navy-700/55">{st.inBoundary ? "Dalam boundary" : "Di luar boundary"}</span>
                        </button>
                        {i < project.stages.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-navy-700/30" aria-hidden />}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {(Object.keys(BOUNDARY_LABEL) as BoundaryType[]).map((b) => (
                    <label key={b} className={cn("cursor-pointer rounded-lg border p-3 text-xs", scope.boundary === b ? "border-brand-blue bg-brand-blue/5" : "border-sand-300")}>
                      <input type="radio" name="boundary" className="mr-2" checked={scope.boundary === b} onChange={() => set({ boundary: b })} />
                      <span className="font-semibold text-navy-900">{BOUNDARY_LABEL[b].label}</span>
                      <span className="mt-1 block text-navy-700/70">{BOUNDARY_LABEL[b].desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Aturan cut-off (% massa & energi)" hint="Aliran di bawah ambang boleh dikecualikan bila dicatat di daftar asumsi.">
                  <NumberInput value={scope.cutoffPct} min={0} onCommit={(v) => set({ cutoffPct: v ?? 0 })} disabled={locked} />
                </Field>
                <Field label="Kunci alokasi utilitas & IPAL">
                  <Select value={scope.allocation} onChange={(e) => set({ allocation: e.target.value as AllocationKey })}>
                    <option value="m2">Per m² ter-plating</option>
                    <option value="mass">Per massa</option>
                    <option value="hours">Per jam proses</option>
                  </Select>
                </Field>
                <Field label="Periode data">
                  <Input value={project.periodLabel} disabled />
                </Field>
              </div>
            )}
            {step === 4 && (
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Metode LCIA primer" hint="EF 3.1; ReCiPe 2016 hanya uji sensitivitas, tidak digabung (P6).">
                  <Input value={`${project.method.primary} · ${project.method.release}`} disabled />
                </Field>
                <Field label="Pelaporan GHG">
                  <Input value="IPCC AR6 GWP100" disabled />
                </Field>
                <Field label="Database background">
                  <TextInput value={scope.backgroundDb} onCommit={(v) => set({ backgroundDb: v })} />
                </Field>
              </div>
            )}
          </fieldset>
          <div className="mt-5 flex justify-between">
            <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
              Kembali
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>
                Lanjut <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              !locked && (
                <Button variant="brand" onClick={lockScope}>
                  <Lock className="h-4 w-4" /> Kunci Scope v{scope.version}
                </Button>
              )
            )}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Kartu Goal & Scope" subtitle="Siap masuk laporan ISO 14044" />
          <CardBody>
            <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
              <Item term="Tujuan" detail={scope.goal} />
              <Item term="Audiens" detail={scope.intendedAudience} />
              <Item term="Satuan fungsi" detail={`1 ${FU_LABEL[scope.fuType]}; reference flow ${fmt(results.lci.referenceFlow)} ${FU_LABEL[scope.fuType]} per ${project.periodLabel}`} />
              <Item term="Boundary" detail={`${BOUNDARY_LABEL[scope.boundary].label}; tahap: ${project.stages.filter((s) => s.inBoundary).map((s) => s.id).join(", ")}`} />
              <Item term="Cut-off & alokasi" detail={`< ${fmt(scope.cutoffPct)}% massa/energi; alokasi per ${scope.allocation === "m2" ? "m²" : scope.allocation === "mass" ? "massa" : "jam proses"}`} />
              <Item term="Metode & database" detail={`${project.method.primary} (${project.method.release}); ${scope.backgroundDb}`} />
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Daftar asumsi bernomor" />
          <CardBody>
            <ol className="space-y-2">
              {scope.assumptions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="num mt-1.5 w-5 shrink-0 text-navy-700/50">A{i + 1}</span>
                  <TextInput
                    multiline
                    rows={2}
                    disabled={locked}
                    value={a}
                    ariaLabel={`Asumsi ${i + 1}`}
                    onCommit={(v) => set({ assumptions: scope.assumptions.map((x, j) => (j === i ? v : x)) })}
                  />
                  {!locked && (
                    <button type="button" aria-label="Hapus asumsi" className="mt-1.5 text-navy-700/40 hover:text-status-danger" onClick={() => set({ assumptions: scope.assumptions.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ol>
            {!locked && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => set({ assumptions: [...scope.assumptions, "Asumsi baru"] })}>
                <Plus className="h-3.5 w-3.5" /> Tambah asumsi
              </Button>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Riwayat versi scope" subtitle="Run lama tetap merujuk versinya (FR-01.3)" action={<History className="h-4 w-4 text-navy-700/40" />} />
        <CardBody>
          <ul className="space-y-1.5 text-xs">
            {[...project.scopeHistory, scope].reverse().map((s) => (
              <li key={s.version} className="flex flex-wrap items-center gap-2">
                <Badge tone={s.version === scope.version ? "blue" : "neutral"}>v{s.version}</Badge>
                {s.lockedAt ? (
                  <span className="flex items-center gap-1 text-navy-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-status-ok" /> dikunci {fmtDate(s.lockedAt)} oleh {s.lockedBy}
                  </span>
                ) : (
                  <span className="text-navy-700/60">draf</span>
                )}
                <span className="text-navy-700/55">· FU {FU_LABEL[s.fuType]} · {BOUNDARY_LABEL[s.boundary].label}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <ReasonDialog
        open={reasonOpen}
        title={`Buat Scope v${scope.version + 1}`}
        description="Versi terkunci tidak diubah; versi baru dibuat sebagai draf dan run berikutnya merujuk versi baru."
        confirmLabel="Buat versi baru"
        onCancel={() => setReasonOpen(false)}
        onConfirm={(reason) => {
          newScopeVersion(reason);
          setReasonOpen(false);
        }}
      />
    </div>
  );
}

function Item({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="font-semibold text-navy-900">{term}</dt>
      <dd className="mt-0.5 leading-relaxed text-navy-700/80">{detail}</dd>
    </div>
  );
}
