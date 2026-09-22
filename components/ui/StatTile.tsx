import { cn } from "@/lib/utils/cn";
import type { LucideIcon } from "lucide-react";

export function StatTile({
  label,
  value,
  unit,
  icon: Icon,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "warning";
  hint?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm",
        tone === "warning" ? "border-accent-red/30" : "border-sand-200",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-navy-700/60">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-navy-700/50" />}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-navy-900">{value}</span>
        {unit && <span className="text-sm text-navy-700/60">{unit}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-navy-700/50">{hint}</p>}
    </div>
  );
}
