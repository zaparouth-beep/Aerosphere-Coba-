"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";
import { term } from "@/lib/content/glossary";
import { cn } from "@/lib/utils/cn";

/**
 * "Apa ini?" icon (PRD v1.1 §3.0.5): a 3-line popover — what it means, why it
 * matters, what you can do. Either a glossary key or custom text.
 */
export function InfoTip({
  k,
  what,
  why,
  action,
  title,
  className,
}: {
  k?: string;
  what?: string;
  why?: string;
  action?: string;
  title?: string;
  className?: string;
}) {
  const g = k ? term(k) : undefined;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const heading = title ?? g?.label;
  const lines = [what ?? g?.explain, why ?? g?.why, action ?? g?.action].filter(Boolean) as string[];
  if (!lines.length) return null;
  return (
    <span ref={ref} className={cn("relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label={`Apa ini? ${heading ?? ""}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-navy-700/45 hover:text-brand-blue"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-6 z-40 w-[260px] -translate-x-1/2 rounded-lg border border-sand-300 bg-white p-3 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-navy-800 shadow-xl"
        >
          {heading && <span className="mb-1 block text-xs font-semibold text-navy-900">{heading}</span>}
          {lines.map((l, i) => (
            <span key={i} className="mb-1 block last:mb-0">
              <span className="font-medium text-navy-700/60">{["Artinya", "Kenapa penting", "Yang bisa dilakukan"][i]}: </span>
              {l}
            </span>
          ))}
          {g && g.term !== g.label && <span className="mt-1 block text-[10px] text-navy-700/50">Istilah teknis: {g.term}</span>}
        </span>
      )}
    </span>
  );
}
