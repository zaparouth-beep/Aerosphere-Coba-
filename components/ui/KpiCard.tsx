import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { Confidence } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { ConfidenceBadge } from "./Badge";

export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  delta,
  deltaGoodWhenNegative = true,
  confidence,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: LucideIcon;
  delta?: { text: string; value: number } | null;
  deltaGoodWhenNegative?: boolean;
  confidence?: Confidence;
  hint?: React.ReactNode;
  href?: string;
  tone?: "default" | "warn";
}) {
  const good = delta ? (deltaGoodWhenNegative ? delta.value < 0 : delta.value > 0) : false;
  const body = (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border bg-white p-4 shadow-card transition-colors",
        tone === "warn" ? "border-status-warn/35" : "border-sand-200",
        href && "hover:border-brand-blue/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-navy-700/60">{label}</span>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-brand-teal" aria-hidden />}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-1">
        <span className="num text-2xl font-semibold tracking-tight text-navy-900">{value}</span>
        {unit && <span className="text-xs text-navy-700/60">{unit}</span>}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
        {confidence && <ConfidenceBadge value={confidence} />}
        {delta && delta.value !== 0 && (
          <span className={cn("num text-[11px] font-medium", good ? "text-status-ok" : "text-status-danger")}>{delta.text}</span>
        )}
        {hint && <span className="text-[11px] text-navy-700/55">{hint}</span>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
