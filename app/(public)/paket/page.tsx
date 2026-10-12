"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlanCards, PlanComparison, SubscriptionSummary } from "@/components/plans/PlanPicker";
import { Button } from "@/components/ui/Button";
import { effectiveStatus } from "@/lib/domain/plans";
import { useAppStore } from "@/lib/store/useAppStore";
import { tx } from "@/lib/i18n";

export default function Page() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const account = useAppStore((s) => s.account);
  const subscription = useAppStore((s) => s.subscription);
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !account) router.replace("/masuk?lanjut=/paket");
  }, [mounted, account, router]);

  const status = effectiveStatus(subscription);
  const ready = status === "trial" || status === "active";
  const next = () => router.push(onboardingDone ? "/beranda" : "/mulai");

  if (!mounted || !account) return <div className="mx-auto h-96 max-w-6xl animate-pulse px-4 py-12" aria-busy="true" />;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal">{tx("Langkah 2 · Pilih paket", "Step 2 · Choose a plan")}</p>
      <h1 className="mt-1 text-2xl font-semibold text-navy-900">{tx(`Pilih paket untuk ${account.company}`, `Choose a plan for ${account.company}`)}</h1>
      <p className="mt-2 max-w-2xl text-sm text-navy-700/75">
        {tx(
          "Paket Coba langsung aktif selama 14 hari. Paket berbayar aktif setelah pembayaran dikonfirmasi admin; di versi demo ini aktivasi bisa disimulasikan.",
          "The Trial plan is active right away for 14 days. Paid plans activate once an admin confirms payment; in this demo, activation can be simulated.",
        )}
      </p>
      {subscription && (
        <div className="mt-6">
          <SubscriptionSummary />
        </div>
      )}
      {ready && (
        <div className="mt-4 flex justify-end">
          <Button variant="brand" onClick={next}>
            {onboardingDone ? tx("Lanjut ke Beranda", "Continue to Home") : tx("Lanjut ke profil lini", "Continue to line profile")}
          </Button>
        </div>
      )}
      <div className="mt-6">
        <PlanCards onChosen={(plan) => plan === "coba" && router.push(onboardingDone ? "/beranda" : "/mulai")} />
      </div>
      <details className="mt-8 rounded-xl border border-sand-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-navy-900">{tx("Bandingkan semua fitur", "Compare all features")}</summary>
        <div className="mt-4 overflow-x-auto">
          <PlanComparison />
        </div>
      </details>
    </div>
  );
}
