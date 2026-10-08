import { AlertTriangle, CheckCircle2, CircleDot, Info, XCircle } from "lucide-react";
import type { Confidence } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "green" | "gold" | "red" | "blue" | "navy";

const TONE: Record<BadgeTone, string> = {
  neutral: "border-sand-300 bg-sand-50 text-navy-700",
  green: "border-status-ok/25 bg-status-ok/10 text-status-ok",
  gold: "border-status-warn/25 bg-status-warn/10 text-status-warn",
  red: "border-status-danger/25 bg-status-danger/10 text-status-danger",
  blue: "border-brand-blue/25 bg-brand-blue/10 text-brand-blue",
  navy: "border-navy-900 bg-navy-900 text-white",
};

export function Badge({ tone = "neutral", className, children, title }: { tone?: BadgeTone; className?: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", TONE[tone], className)}>
      {children}
    </span>
  );
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = { High: "Tinggi", Medium: "Sedang", Low: "Rendah" };

/** Confidence never relies on colour alone (PRD 3.1): icon + text. */
export function ConfidenceBadge({ value, title }: { value: Confidence; title?: string }) {
  const Icon = value === "High" ? CheckCircle2 : value === "Medium" ? CircleDot : AlertTriangle;
  return (
    <Badge tone={value === "High" ? "green" : value === "Medium" ? "gold" : "red"} title={title ?? `Tingkat keyakinan data: ${CONFIDENCE_LABEL[value]}`}>
      <Icon className="h-3 w-3" aria-hidden />
      Keyakinan {CONFIDENCE_LABEL[value]}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: "error" | "warning" | "info" }) {
  const Icon = severity === "error" ? XCircle : severity === "warning" ? AlertTriangle : Info;
  return (
    <Badge tone={severity === "error" ? "red" : severity === "warning" ? "gold" : "blue"}>
      <Icon className="h-3 w-3" aria-hidden />
      {severity === "error" ? "Error" : severity === "warning" ? "Warning" : "Info"}
    </Badge>
  );
}
