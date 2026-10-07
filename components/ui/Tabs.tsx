"use client";

import { cn } from "@/lib/utils/cn";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ id: T; label: React.ReactNode; count?: number }>;
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-sand-200 px-4", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
            value === t.id ? "border-brand-blue text-navy-900" : "border-transparent text-navy-700/55 hover:text-navy-900",
          )}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="rounded-full bg-status-danger px-1.5 text-[10px] font-semibold text-white">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  ariaLabel,
}: {
  options: Array<{ id: T; label: React.ReactNode }>;
  value: T;
  onChange: (id: T) => void;
  size?: "sm" | "xs";
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg border border-sand-300 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
            value === o.id ? "bg-navy-900 text-white" : "text-navy-700/70 hover:text-navy-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
