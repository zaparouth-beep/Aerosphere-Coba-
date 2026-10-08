import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type StatusWord = "Baik" | "Perlu perhatian" | "Kritis" | "Belum ada pembanding";

/**
 * Status word for a "lower is better" indicator vs the previous saved result
 * (PRD v1.1 §3.0.4: colour always paired with a word). Rule: improved or flat =
 * Baik, up to +10% = Perlu perhatian, more than +10% = Kritis.
 */
export function statusFromChange(changePct: number | null): StatusWord {
  if (changePct === null || !Number.isFinite(changePct)) return "Belum ada pembanding";
  if (changePct <= 0) return "Baik";
  if (changePct <= 10) return "Perlu perhatian";
  return "Kritis";
}

export function StatusPill({ status, className }: { status: StatusWord; className?: string }) {
  const Icon = status === "Baik" ? CheckCircle2 : status === "Perlu perhatian" ? AlertTriangle : status === "Kritis" ? XCircle : MinusCircle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        status === "Baik" && "border-status-ok/25 bg-status-ok/10 text-status-ok",
        status === "Perlu perhatian" && "border-status-warn/25 bg-status-warn/10 text-status-warn",
        status === "Kritis" && "border-status-danger/25 bg-status-danger/10 text-status-danger",
        status === "Belum ada pembanding" && "border-sand-300 bg-sand-50 text-navy-700/70",
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {status}
    </span>
  );
}
