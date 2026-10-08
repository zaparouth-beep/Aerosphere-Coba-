"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FlaskConical, Upload } from "lucide-react";
import { HeadlineCards } from "@/components/summary/Summary";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Feedback";
import { Input, NumberInput, Select } from "@/components/ui/Input";
import { effectiveStatus, hasFeature, planLimits } from "@/lib/domain/plans";
import { hardChromeDemo, TEMPLATES } from "@/lib/domain/templates";
import type { Project } from "@/lib/domain/types";
import { calculate, indicatorsOf } from "@/lib/engine/calculate";
import { useAppStore } from "@/lib/store/useAppStore";
import { downloadBlob } from "@/lib/utils/export";
import { cn } from "@/lib/utils/cn";
import { fmt } from "@/lib/utils/format";
import { headlines } from "@/lib/view/summary";

const COATINGS = [
  { id: "hard-chrome", label: "Hard chrome" },
  { id: "ni-watts", label: "Nikel (Watts)" },
  { id: "anodize", label: "Anodize asam kromat" },
  { id: "cd-znni", label: "Kadmium / Seng-Nikel" },
  { id: "empty", label: "Lainnya" },
] as const;

/** Three-step onboarding (PRD v1.1 §1.3): line profile → data → first result. Goal & Scope uses defaults. */
export default function Page() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const account = useAppStore((s) => s.account);
  const subscription = useAppStore((s) => s.subscription);
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  const project = useAppStore((s) => s.project);
  const setupProject = useAppStore((s) => s.setupProject);
  const applyDatasetPatch = useAppStore((s) => s.applyDatasetPatch);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({ facility: "", coating: "hard-chrome" as (typeof COATINGS)[number]["id"], areaPerMonth: 20 });
  const [uploadMsg, setUploadMsg] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setMounted(true), []);

  const status = effectiveStatus(subscription);
  useEffect(() => {
    if (!mounted) return;
    if (!account) router.replace("/masuk?lanjut=/mulai");
    else if (!subscription || status === "pending") router.replace("/paket");
    else if (onboardingDone) router.replace("/beranda");
  }, [mounted, account, subscription, status, onboardingDone, router]);

  /** Project built from the profile: chosen template, 1-month period, area per month. */
  const profileProject = (): Project => {
    const tpl = TEMPLATES.find((t) => t.id === profile.coating) ?? TEMPLATES[0]!;
    const p = tpl.build();
    return {
      ...p,
      name: `${profile.facility || account?.company || "Lini saya"} — ${COATINGS.find((c) => c.id === profile.coating)?.label}`,
      facility: profile.facility || account?.company || p.facility,
      client: account?.company ?? p.client,
      periodLabel: "1 bulan",
      periodMonths: 1,
      // Quantities start empty: the user fills last month's numbers in the template.
      inputs: p.inputs.map((i) => ({ ...i, quantity: 0 })),
      waste: p.waste.map((w) => ({ ...w, quantityKg: 0 })),
      production: { ...p.production, areaM2: profile.areaPerMonth, parts: 0, batches: 0, componentMassKg: 0, effluentVolumeM3: 0, waterEvaporatedM3: 0 },
    };
  };

  const useSample = () => {
    const p = hardChromeDemo();
    if (setupProject(p, "proyek contoh")) setStep(2);
  };

  const downloadTemplate = async () => {
    const { buildTemplate } = await import("@/lib/io/excel");
    const blob = await buildTemplate(profileProject());
    downloadBlob(blob, "template-data-aerosphere.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };

  const upload = async (file: File) => {
    setBusy(true);
    setUploadMsg(null);
    try {
      const base = profileProject();
      const { parseTemplate } = await import("@/lib/io/excel");
      const { patch, report } = await parseTemplate(file, base);
      if (!setupProject(base, `profil lini + unggahan ${file.name}`)) return;
      if (!applyDatasetPatch(patch, file.name)) return;
      setUploadMsg({
        tone: report.rejected.length ? "danger" : "ok",
        text: `${report.accepted} baris diterima${report.rejected.length ? `, ${report.rejected.length} baris ditolak (lihat Data Saya → Cek data)` : ""}.`,
      });
      setStep(2);
    } catch (e) {
      setUploadMsg({ tone: "danger", text: e instanceof Error ? e.message : "File tidak bisa dibaca." });
    } finally {
      setBusy(false);
    }
  };

  const first = useMemo(() => {
    const r = calculate(project);
    return { heads: headlines(indicatorsOf(r), r.lci.referenceFlow, r.lci.fuLabel, null), r };
  }, [project]);

  if (!mounted || !account || !subscription) return <div className="mx-auto h-96 max-w-3xl px-4 py-12" aria-busy="true" />;
  const canUpload = hasFeature(subscription, "uploadData") && subscription.uploadsUsed < planLimits(subscription).uploads;
  const labels = ["Profil lini", "Data", "Hasil pertama"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal">Langkah 3 · Mulai</p>
      <h1 className="mt-1 text-2xl font-semibold text-navy-900">Siapkan lini Anda</h1>
      <ol className="mt-6 flex gap-2" aria-label="Langkah onboarding">
        {labels.map((l, i) => (
          <li key={l} className={cn("flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs", i === step ? "border-navy-900 bg-white font-semibold text-navy-900" : i < step ? "border-status-ok/30 bg-status-ok/5 text-status-ok" : "border-sand-200 text-navy-700/55")} aria-current={i === step ? "step" : undefined}>
            {i < step ? <CheckCircle2 className="h-4 w-4" /> : <span className="num">{i + 1}</span>}
            {l}
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-2xl border border-sand-200 bg-white p-6 shadow-card">
        {step === 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep(1);
            }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-navy-900">Profil lini</h2>
            <label className="block text-xs font-medium text-navy-800">
              Nama fasilitas / lini
              <Input className="mt-1" value={profile.facility} placeholder={account.company} onChange={(e) => setProfile({ ...profile, facility: e.target.value })} />
            </label>
            <label className="block text-xs font-medium text-navy-800">
              Jenis lapisan
              <Select className="mt-1" value={profile.coating} onChange={(e) => setProfile({ ...profile, coating: e.target.value as typeof profile.coating })}>
                {COATINGS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-xs font-medium text-navy-800">
              Luas permukaan yang dilapisi per bulan (m²)
              <NumberInput className="mt-1" value={profile.areaPerMonth} min={0} onCommit={(v) => setProfile({ ...profile, areaPerMonth: v ?? 0 })} ariaLabel="Luas per bulan" />
            </label>
            <p className="text-[11px] text-navy-700/60">
              Tujuan studi dan tahap yang dihitung memakai pengaturan bawaan (per 1 m², tahap pembersihan sampai pengolahan air limbah). Bisa diubah nanti di
              Mode Ahli.
            </p>
            <div className="flex justify-end">
              <Button type="submit" variant="brand">
                Lanjut
              </Button>
            </div>
          </form>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-navy-900">Data</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-sand-200 p-4">
                <Upload className="h-5 w-5 text-brand-teal" />
                <p className="mt-2 text-sm font-semibold text-navy-900">Unggah data lini saya</p>
                <p className="mt-1 text-xs text-navy-700/70">
                  Unduh template Excel (sudah berisi luas {fmt(profile.areaPerMonth)} m² per bulan), isi pemakaian bulan lalu, lalu unggah.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={downloadTemplate}>
                    <Download className="h-3.5 w-3.5" /> Unduh template
                  </Button>
                  <Button size="sm" disabled={!canUpload || busy} onClick={() => fileRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" /> {busy ? "Membaca…" : "Unggah file .xlsx"}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void upload(f);
                    }}
                  />
                </div>
                {!canUpload && <p className="mt-2 text-[11px] text-status-warn">Kuota unggahan paket Anda sudah terpakai.</p>}
              </div>
              <div className="rounded-xl border border-brand-teal/40 bg-brand-teal/5 p-4">
                <FlaskConical className="h-5 w-5 text-brand-teal" />
                <p className="mt-2 text-sm font-semibold text-navy-900">Pakai proyek contoh</p>
                <p className="mt-1 text-xs text-navy-700/70">
                  Lini hard chrome contoh (250 m² per tahun) dengan data lengkap. Cocok untuk melihat cara kerja sebelum menyiapkan data sendiri.
                </p>
                <Button size="sm" variant="brand" className="mt-3" onClick={useSample}>
                  Pakai proyek contoh
                </Button>
              </div>
            </div>
            {uploadMsg && <Callout tone={uploadMsg.tone === "ok" ? "ok" : "danger"}>{uploadMsg.text}</Callout>}
            <div className="flex justify-start">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Kembali
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-navy-900">Hasil pertama: {project.name}</h2>
            <HeadlineCards heads={first.heads} />
            {first.r.validation.errors > 0 && (
              <Callout tone="warn">Ada {first.r.validation.errors} hal di data yang perlu diperbaiki. Buka Data Saya → Cek data setelah ini.</Callout>
            )}
            <p className="text-xs text-navy-700/70">Selanjutnya tur singkat 5 langkah akan menunjukkan setiap menu. Tur bisa dilewati dan diulang dari Bantuan.</p>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Kembali
              </Button>
              <Button
                variant="brand"
                onClick={() => {
                  completeOnboarding();
                  router.push("/beranda");
                }}
              >
                Buka Beranda
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
