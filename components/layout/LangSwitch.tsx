"use client";

import { Languages } from "lucide-react";
import { getLang, type Lang } from "@/lib/i18n";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils/cn";

/** ID | EN switch. The choice is saved in this browser and applies to the whole app. */
export function LangSwitch({ className }: { className?: string }) {
  const setUi = useAppStore((s) => s.setUi);
  const lang = getLang();
  const options: Array<{ id: Lang; label: string; name: string }> = [
    { id: "id", label: "ID", name: "Bahasa Indonesia" },
    { id: "en", label: "EN", name: "English" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={lang === "en" ? "Language" : "Bahasa"}
      data-testid="lang-switch"
      className={cn("inline-flex items-center rounded-lg border border-sand-300 bg-white p-0.5 text-[11px] font-medium", className)}
    >
      <Languages className="mx-1 h-3.5 w-3.5 text-navy-700/60" aria-hidden />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={lang === o.id}
          aria-label={o.name}
          title={o.name}
          onClick={() => setUi({ lang: o.id })}
          className={cn("rounded-md px-2 py-1", lang === o.id ? "bg-navy-900 text-white" : "text-navy-700/70 hover:text-navy-900")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
