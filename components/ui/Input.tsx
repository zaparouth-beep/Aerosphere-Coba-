"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

const BASE =
  "w-full rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-sm text-navy-900 outline-none transition-colors placeholder:text-navy-700/35 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue disabled:bg-sand-50 disabled:text-navy-700/60";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(BASE, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(BASE, "min-h-[72px]", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(BASE, "pr-7", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, children, htmlFor }: { className?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1 block text-[11px] font-medium text-navy-700/75", className)}>
      {children}
    </label>
  );
}

export function Field({ label, hint, children, className }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-snug text-navy-700/55">{hint}</p>}
    </div>
  );
}

/**
 * Numeric input that keeps the user's text while typing (so "0," or "" do not
 * jump), commits a finite number on blur/enter, and treats empty as `undefined`
 * when `allowEmpty` is set — empty is "not provided", never silently zero.
 */
export function NumberInput({
  value,
  onCommit,
  allowEmpty = false,
  min,
  className,
  disabled,
  placeholder,
  ariaLabel,
}: {
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  allowEmpty?: boolean;
  min?: number;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value === undefined || Number.isNaN(value) ? "" : String(value).replace(".", ","));
  useEffect(() => {
    setText(value === undefined || Number.isNaN(value) ? "" : String(value).replace(".", ","));
  }, [value]);
  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === "") {
      if (allowEmpty) onCommit(undefined);
      else setText(value === undefined ? "" : String(value).replace(".", ","));
      return;
    }
    // "1.234,5" (Indonesian) and "1234.5" are both accepted.
    const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || (min !== undefined && parsed < min)) {
      setText(value === undefined ? "" : String(value).replace(".", ","));
      return;
    }
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <input
      inputMode="decimal"
      aria-label={ariaLabel}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(BASE, "num text-right", className)}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

/** Text input that commits on blur/enter, so the audit trail logs one event per edit, not per keystroke. */
export function TextInput({
  value,
  onCommit,
  multiline = false,
  rows,
  className,
  disabled,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const v = text.normalize("NFC").trim();
    if (v !== value) onCommit(v);
  };
  if (multiline) {
    return (
      <textarea
        aria-label={ariaLabel}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(BASE, "min-h-[56px]", className)}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
      />
    );
  }
  return (
    <input
      aria-label={ariaLabel}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(BASE, className)}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
