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
import { pick, tx } from "@/lib/i18n";

const STEPS = [
  { id: "Tujuan", en: "Goal" },
  { id: "FU & reference flow", en: "FU & reference flow" },
  { id: "Boundary", en: "Boundary" },
  { id: "Cut-off & alokasi", en: "Cut-off & allocation" },
  { id: "Metode & database", en: "Method & database" },
] as const;

const BOUNDARY_LABEL: Record<BoundaryType, { label: string; readonly desc: string }> = {
  "gate-to-gate": {
    label: "Gate-to-gate",
    get desc() {
      return tx("Hanya emisi langsung lini (tanpa produksi hulu input).", "Direct line emissions only (no upstream production of inputs).");
    },
  },
  "gate-to-gate+upstream": {
    label: "Gate-to-gate + upstream",
    get desc() {
      return tx("Lini A–F + produksi hulu input lewat dataset background (default).", "Line A–F + upstream production of inputs via background datasets (default).");
    },
  },
  "cradle-to-gate": {
    label: "Cradle-to-gate",
    get desc() {
      return tx("Ditambah pengolahan limbah B3 di vendor (Scope 3 kat. 5).", "Plus hazardous (B3) waste treatment at the vendor (Scope 3 cat. 5).");
    },
  },
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
          title={`Goal & Scope — ${tx("versi", "version")} ${scope.version}`}
          subtitle={
            locked
              ? tx(`Dikunci ${fmtDate(scope.lockedAt)} oleh ${scope.lockedBy}. Run baru merujuk versi ini.`, `Locked ${fmtDate(scope.lockedAt)} by ${scope.lockedBy}. New runs refer to this version.`)
              : tx("Draf: lengkapi lima langkah lalu kunci. Setiap perubahan setelah dikunci membuat versi baru.", "Draft: complete the five steps, then lock. Any change after locking creates a new version.")
          }
          action={
            locked ? (
              <Button variant="secondary" onClick={() => setReasonOpen(true)}>
                <Unlock className="h-4 w-4" /> {tx("Buat versi baru", "Create new version")}
              </Button>
            ) : (
              <Button variant="brand" onClick={lockScope}>
                <Lock className="h-4 w-4" /> {tx("Kunci Scope", "Lock Scope")} v{scope.version}
              </Button>
            )
          }
        />
        <ol className="flex flex-wrap gap-1 border-b border-sand-200 px-4 py-3" aria-label={tx("Langkah wizard", "Wizard steps")}>
          {STEPS.map((s, i) => (
            <li key={s.id}>
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
                {pick(s)}
              </button>
            </li>
          ))}
        </ol>
        <CardBody>
          <fieldset disabled={locked} className="space-y-4 disabled:opacity-80">
            {step === 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={tx("Tujuan studi", "Study goal")} hint={tx("Apa yang ingin dijawab dan untuk keputusan apa.", "What the study should answer and which decision it supports.")}>
                  <TextInput multiline rows={4} value={scope.goal} onCommit={(v) => set({ goal: v })} />
                </Field>
                <Field label={tx("Audiens & penggunaan", "Audience & intended use")} hint={tx("Klaim komparatif publik butuh critical review independen (ISO 14044 §6).", "Public comparative assertions need an independent critical review (ISO 14044 §6).")}>
                  <TextInput multiline rows={4} value={scope.intendedAudience} onCommit={(v) => set({ intendedAudience: v })} />
                </Field>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <Field label={tx("Satuan fungsi (FU)", "Functional unit (FU)")}>
                    <Select value={scope.fuType} onChange={(e) => set({ fuType: e.target.value as FuType })}>
                      <option value="m2">{tx("1 m² permukaan ter-plating (primer)", "1 m² of plated surface (primary)")}</option>
                      <option value="part">{tx("1 part (pendukung)", "1 part (supporting)")}</option>
                      <option value="kg">{tx("1 kg komponen ter-plating (pendukung)", "1 kg of plated component (supporting)")}</option>
                    </Select>
                  </Field>
                  <Field label={tx("Luas ter-plating per periode (m²)", "Plated area per period (m²)")}>
                    <NumberInput value={project.production.areaM2} min={0} onCommit={(v) => updateProduction({ areaM2: v ?? 0 })} />
                  </Field>
                  <Field label={tx("Jumlah part per periode", "Parts per period")}>
                    <NumberInput value={project.production.parts} min={0} onCommit={(v) => updateProduction({ parts: v ?? 0 })} />
                  </Field>
                  <Field label={tx("Massa komponen per periode (kg)", "Component mass per period (kg)")}>
                    <NumberInput value={project.production.componentMassKg} min={0} onCommit={(v) => updateProduction({ componentMassKg: v ?? 0 })} />
                  </Field>
                </div>
                <p className="text-xs text-navy-800">
                  {tx("Reference flow saat ini", "Current reference flow")}: <b className="num">{fmt(results.lci.referenceFlow)} {FU_LABEL[scope.fuType]}</b> per {project.periodLabel}
                  {project.production.reworkPct > 0 && <> {tx(`(sudah dikurangi rework ${fmt(project.production.reworkPct)}%)`, `(net of ${fmt(project.production.reworkPct)}% rework)`)}</>}.
                </p>
                {scope.fuType === "kg" && (
                  <Callout tone="warn">
                    {tx(
                      "FU per kg kurang tepat bila luas permukaan antar-part sangat bervariasi: Takuma et al. (2018) mencatat fluktuasi bulanan karena bentuk dan luas part berbeda. Pertahankan 1 m² sebagai FU primer (FR-01.4).",
                      "A per-kg FU is less suitable when surface area varies widely between parts: Takuma et al. (2018) report monthly fluctuations because part shapes and areas differ. Keep 1 m² as the primary FU (FR-01.4).",
                    )}
                  </Callout>
                )}
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-navy-800">{tx("Klik tahap untuk memasukkan/mengeluarkan dari boundary (tahap di luar boundary tampil abu-abu).", "Click a stage to include/exclude it from the boundary (stages outside the boundary are greyed out).")}</p>
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
                          <span className="mt-1.5 block text-[10px] font-medium uppercase tracking-wide text-navy-700/55">{st.inBoundary ? tx("Dalam boundary", "In boundary") : tx("Di luar boundary", "Outside boundary")}</span>
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
                <Field label={tx("Aturan cut-off (% massa & energi)", "Cut-off rule (% mass & energy)")} hint={tx("Aliran di bawah ambang boleh dikecualikan bila dicatat di daftar asumsi.", "Flows below the threshold may be excluded if recorded in the assumptions list.")}>
                  <NumberInput value={scope.cutoffPct} min={0} onCommit={(v) => set({ cutoffPct: v ?? 0 })} disabled={locked} />
                </Field>
                <Field label={tx("Kunci alokasi utilitas & IPAL", "Allocation key for utilities & WWTP")}>
                  <Select value={scope.allocation} onChange={(e) => set({ allocation: e.target.value as AllocationKey })}>
                    <option value="m2">{tx("Per m² ter-plating", "Per plated m²")}</option>
                    <option value="mass">{tx("Per massa", "Per mass")}</option>
                    <option value="hours">{tx("Per jam proses", "Per process hour")}</option>
                  </Select>
                </Field>
                <Field label={tx("Periode data", "Data period")}>
                  <Input value={project.periodLabel} disabled />
                </Field>
              </div>
            )}
            {step === 4 && (
              <div className="grid gap-4 md:grid-cols-3">
                <Field label={tx("Metode LCIA primer", "Primary LCIA method")} hint={tx("EF 3.1; ReCiPe 2016 hanya uji sensitivitas, tidak digabung (P6).", "EF 3.1; ReCiPe 2016 is for sensitivity checks only, not combined (P6).")}>
                  <Input value={`${project.method.primary} · ${project.method.release}`} disabled />
                </Field>
                <Field label={tx("Pelaporan GHG", "GHG reporting")}>
                  <Input value="IPCC AR6 GWP100" disabled />
                </Field>
                <Field label={tx("Database background", "Background database")}>
                  <TextInput value={scope.backgroundDb} onCommit={(v) => set({ backgroundDb: v })} />
                </Field>
              </div>
            )}
          </fieldset>
          <div className="mt-5 flex justify-between">
            <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
              {tx("Kembali", "Back")}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>
                {tx("Lanjut", "Next")} <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              !locked && (
                <Button variant="brand" onClick={lockScope}>
                  <Lock className="h-4 w-4" /> {tx("Kunci Scope", "Lock Scope")} v{scope.version}
                </Button>
              )
            )}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={tx("Kartu Goal & Scope", "Goal & Scope card")} subtitle={tx("Siap masuk laporan ISO 14044", "Ready for the ISO 14044 report")} />
          <CardBody>
            <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2">
              <Item term={tx("Tujuan", "Goal")} detail={scope.goal} />
              <Item term={tx("Audiens", "Audience")} detail={scope.intendedAudience} />
              <Item term={tx("Satuan fungsi", "Functional unit")} detail={`1 ${FU_LABEL[scope.fuType]}; reference flow ${fmt(results.lci.referenceFlow)} ${FU_LABEL[scope.fuType]} per ${project.periodLabel}`} />
              <Item term="Boundary" detail={`${BOUNDARY_LABEL[scope.boundary].label}; ${tx("tahap", "stages")}: ${project.stages.filter((s) => s.inBoundary).map((s) => s.id).join(", ")}`} />
              <Item
                term={tx("Cut-off & alokasi", "Cut-off & allocation")}
                detail={tx(
                  `< ${fmt(scope.cutoffPct)}% massa/energi; alokasi per ${scope.allocation === "m2" ? "m²" : scope.allocation === "mass" ? "massa" : "jam proses"}`,
                  `< ${fmt(scope.cutoffPct)}% mass/energy; allocation per ${scope.allocation === "m2" ? "m²" : scope.allocation === "mass" ? "mass" : "process hour"}`,
                )}
              />
              <Item term={tx("Metode & database", "Method & database")} detail={`${project.method.primary} (${project.method.release}); ${scope.backgroundDb}`} />
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={tx("Daftar asumsi bernomor", "Numbered assumptions list")} />
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
                    ariaLabel={`${tx("Asumsi", "Assumption")} ${i + 1}`}
                    onCommit={(v) => set({ assumptions: scope.assumptions.map((x, j) => (j === i ? v : x)) })}
                  />
                  {!locked && (
                    <button type="button" aria-label={tx("Hapus asumsi", "Delete assumption")} className="mt-1.5 text-navy-700/40 hover:text-status-danger" onClick={() => set({ assumptions: scope.assumptions.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ol>
            {!locked && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => set({ assumptions: [...scope.assumptions, tx("Asumsi baru", "New assumption")] })}>
                <Plus className="h-3.5 w-3.5" /> {tx("Tambah asumsi", "Add assumption")}
              </Button>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={tx("Riwayat versi scope", "Scope version history")} subtitle={tx("Run lama tetap merujuk versinya (FR-01.3)", "Older runs keep referring to their version (FR-01.3)")} action={<History className="h-4 w-4 text-navy-700/40" />} />
        <CardBody>
          <ul className="space-y-1.5 text-xs">
            {[...project.scopeHistory, scope].reverse().map((s) => (
              <li key={s.version} className="flex flex-wrap items-center gap-2">
                <Badge tone={s.version === scope.version ? "blue" : "neutral"}>v{s.version}</Badge>
                {s.lockedAt ? (
                  <span className="flex items-center gap-1 text-navy-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-status-ok" /> {tx(`dikunci ${fmtDate(s.lockedAt)} oleh ${s.lockedBy}`, `locked ${fmtDate(s.lockedAt)} by ${s.lockedBy}`)}
                  </span>
                ) : (
                  <span className="text-navy-700/60">{tx("draf", "draft")}</span>
                )}
                <span className="text-navy-700/55">· FU {FU_LABEL[s.fuType]} · {BOUNDARY_LABEL[s.boundary].label}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <ReasonDialog
        open={reasonOpen}
        title={`${tx("Buat Scope", "Create Scope")} v${scope.version + 1}`}
        description={tx("Versi terkunci tidak diubah; versi baru dibuat sebagai draf dan run berikutnya merujuk versi baru.", "The locked version is not changed; a new version is created as a draft and the next runs refer to it.")}
        confirmLabel={tx("Buat versi baru", "Create new version")}
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
