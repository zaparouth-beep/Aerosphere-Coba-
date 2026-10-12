"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { tx } from "@/lib/i18n";
import { useAppStore } from "@/lib/store/useAppStore";

const makeStep = (href: string, title: [string, string], text: [string, string]) => ({
  href,
  get title() {
    return tx(title[0], title[1]);
  },
  get text() {
    return tx(text[0], text[1]);
  },
});

export const TOUR_STEPS = [
  makeStep(
    "/beranda",
    ["Beranda", "Home"],
    [
      "Ringkasan kondisi lini Anda: empat angka utama, tahap paling boros, dan perbaikan yang disarankan.",
      "A summary of your line: four key figures, the most wasteful stage, and suggested improvements.",
    ],
  ),
  makeStep(
    "/data",
    ["Data Saya", "My Data"],
    [
      "Unggah template Excel atau lihat data proyek contoh. Tekan “Cek data” untuk memeriksa angka yang janggal.",
      "Upload the Excel template or look at the sample project data. Press “Check data” to spot odd figures.",
    ],
  ),
  makeStep(
    "/hasil",
    ["Hasil", "Results"],
    [
      "Jejak karbon, air, limbah berbahaya, dan biaya per m². Ikon tanda tanya menjelaskan setiap angka.",
      "Carbon footprint, water, hazardous waste and cost per m². The question-mark icon explains every figure.",
    ],
  ),
  makeStep(
    "/titik-boros",
    ["Titik Boros", "Waste Hotspots"],
    [
      "Tahap mana yang paling banyak memakai sumber daya, kenapa, dan apa yang bisa dicoba.",
      "Which stage uses the most resources, why, and what you can try.",
    ],
  ),
  makeStep(
    "/laporan",
    ["Laporan", "Reports"],
    ["Laporan ringkas 2 halaman untuk atasan. Bisa diunduh atau dicetak.", "A 2-page summary report for your manager. Download or print it."],
  ),
] as const;

/** First-run tour (PRD v1.1 §3.0.5): 5 steps, skippable, repeatable from Bantuan. */
export function Tour() {
  const step = useAppStore((s) => s.ui.tourStep);
  const setUi = useAppStore((s) => s.setUi);
  const router = useRouter();
  const pathname = usePathname();
  const current = step !== null ? TOUR_STEPS[step] : undefined;

  useEffect(() => {
    if (current && !pathname?.startsWith(current.href)) router.push(current.href);
  }, [current, pathname, router]);

  if (step === null || !current) return null;
  const last = step === TOUR_STEPS.length - 1;
  return (
    <div
      className="no-print fixed bottom-4 left-1/2 z-[55] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-navy-900 bg-navy-950 p-4 text-white shadow-2xl md:bottom-auto md:left-auto md:right-6 md:top-[120px] md:translate-x-0"
      role="dialog"
      aria-label={tx("Tur pengenalan", "Intro tour")}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
        <Compass className="h-3.5 w-3.5" /> {tx(`Tur · langkah ${step + 1} dari ${TOUR_STEPS.length}`, `Tour · step ${step + 1} of ${TOUR_STEPS.length}`)}
      </p>
      <p className="mt-1 text-base font-semibold">{current.title}</p>
      <p className="mt-1 text-sm leading-relaxed text-white/80">{current.text}</p>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" className="text-xs text-white/60 hover:text-white" onClick={() => setUi({ tourStep: null })}>
          {tx("Lewati tur", "Skip tour")}
        </button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setUi({ tourStep: step - 1 })}>
              {tx("Kembali", "Back")}
            </Button>
          )}
          <Button size="sm" variant="brand" onClick={() => setUi({ tourStep: last ? null : step + 1 })}>
            {last ? tx("Selesai", "Done") : tx("Lanjut", "Next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
