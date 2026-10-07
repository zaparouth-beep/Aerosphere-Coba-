"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfidenceBadge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store/useAppStore";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Three-screen onboarding for new users (PRD 1.3 step 1). */
export function Onboarding() {
  const onboarded = useAppStore((s) => s.ui.onboarded);
  const setUi = useAppStore((s) => s.setUi);
  const [step, setStep] = useState(0);
  if (onboarded) return null;

  const screens = [
    {
      title: "Satuan fungsi (FU)",
      body: (
        <>
          Semua hasil dinyatakan per <b>1 m² permukaan ter-plating</b>. Total periode dibagi reference flow (mis. 965 kWh ÷ 250 m² = 3,86 kWh/m²),
          sehingga lini dan periode berbeda bisa dibandingkan.
        </>
      ),
    },
    {
      title: "Apa itu hotspot?",
      body: (
        <>
          Tahap yang menyumbang ≥ 30% dari satu indikator (energi, air, kimia, limbah B3, cost loss, atau kategori dampak) diberi tanda hotspot.
          Dari sana Anda menelusuri <b>WHY → WHERE → WHAT IF</b> dan menguji skenario.
        </>
      ),
    },
    {
      title: "Membaca kualitas data",
      body: (
        <>
          Setiap angka utama membawa badge kualitas dari pedigree matrix: <ConfidenceBadge value="High" /> <ConfidenceBadge value="Medium" />{" "}
          <ConfidenceBadge value="Low" />. Angka dihitung engine, bukan AI, dan setiap run dikunci dengan hash agar bisa diaudit.
        </>
      ),
    },
  ];
  const s = screens[step]!;
  return (
    <div className="no-print fixed inset-0 z-[55] flex items-center justify-center bg-navy-950/50 p-4" role="dialog" aria-modal="true" aria-label="Pengenalan">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-center bg-sand-50 py-6">
          <Image src={`${BASE}/brand/logo-color.png`} alt="AeroSphere LCA" width={170} height={168} className="h-auto w-[150px]" unoptimized priority />
        </div>
        <div className="px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-teal">Langkah {step + 1} dari 3</p>
          <h2 className="mt-1 text-lg font-semibold text-navy-900">{s.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-navy-800">{s.body}</p>
        </div>
        <div className="flex items-center justify-between border-t border-sand-200 px-6 py-3">
          <button type="button" className="text-xs text-navy-700/60 hover:text-navy-900" onClick={() => setUi({ onboarded: true })}>
            Lewati
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                Kembali
              </Button>
            )}
            <Button variant="brand" onClick={() => (step < 2 ? setStep(step + 1) : setUi({ onboarded: true }))}>
              {step < 2 ? "Lanjut" : "Mulai"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
