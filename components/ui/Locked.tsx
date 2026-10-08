"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { FEATURE_BENEFIT, minimumPlanFor, type Feature } from "@/lib/domain/plans";
import { cn } from "@/lib/utils/cn";

/** Locked feature card: padlock, one-sentence benefit, "Lihat paket" (PRD v1.1 §3.0.2). */
export function LockedFeature({ feature, title, className, compact }: { feature: Feature; title?: string; className?: string; compact?: boolean }) {
  const plan = minimumPlanFor(feature);
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border border-dashed border-sand-300 bg-sand-50/70 p-4", compact && "p-3", className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-900 text-brand-gold">
        <Lock className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold text-navy-900">{title}</p>}
        <p className="text-xs leading-relaxed text-navy-800">{FEATURE_BENEFIT[feature]}</p>
        <p className="mt-1 text-[11px] text-navy-700/60">Tersedia mulai paket {plan.name}.</p>
      </div>
      <Link href="/pengaturan?tab=paket" className="shrink-0 rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-xs font-medium text-navy-900 hover:bg-sand-100">
        Lihat paket
      </Link>
    </div>
  );
}
