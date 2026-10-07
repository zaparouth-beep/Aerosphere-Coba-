"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";
import { Textarea } from "./Input";

export function Notices() {
  const notices = useAppStore((s) => s.notices);
  const dismiss = useAppStore((s) => s.dismissNotice);
  return (
    <div aria-live="polite" className="no-print pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {notices.map((n) => {
        const Icon = n.tone === "success" ? CheckCircle2 : n.tone === "error" ? AlertTriangle : Info;
        return (
          <div
            key={n.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-lg border bg-white px-3 py-2.5 text-xs shadow-lg",
              n.tone === "error" ? "border-status-danger/30" : n.tone === "success" ? "border-status-ok/30" : "border-sand-300",
            )}
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", n.tone === "error" ? "text-status-danger" : n.tone === "success" ? "text-status-ok" : "text-brand-blue")} />
            <p className="flex-1 leading-relaxed text-navy-900">{n.text}</p>
            <button type="button" aria-label="Tutup" onClick={() => dismiss(n.id)} className="text-navy-700/50 hover:text-navy-900">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="no-print fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-sand-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-navy-900">{title}</h2>
          <button type="button" aria-label="Tutup" onClick={onClose} className="text-navy-700/50 hover:text-navy-900">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-navy-800">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-sand-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Asks for a written reason; used wherever the audit trail requires one. */
export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel = "Simpan",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Batal
          </Button>
          <Button
            disabled={reason.trim().length < 5}
            onClick={() => {
              onConfirm(reason.trim());
              setReason("");
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <div className="mb-3 text-xs leading-relaxed text-navy-700/80">{description}</div>}
      <label className="mb-1 block text-[11px] font-medium text-navy-700/75" htmlFor="reason">
        Alasan (tersimpan di audit trail, minimal 5 karakter)
      </label>
      <Textarea id="reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-sand-300 bg-sand-50/60 px-6 py-8 text-center">
      <p className="text-sm font-medium text-navy-900">{title}</p>
      {children && <div className="max-w-md text-xs leading-relaxed text-navy-700/70">{children}</div>}
      {action}
    </div>
  );
}

export function Callout({ tone = "info", children, className }: { tone?: "info" | "warn" | "danger" | "ok"; children: React.ReactNode; className?: string }) {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "info" ? Info : AlertTriangle;
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
        tone === "info" && "border-brand-blue/20 bg-brand-blue/5 text-navy-800",
        tone === "warn" && "border-status-warn/25 bg-status-warn/5 text-navy-800",
        tone === "danger" && "border-status-danger/25 bg-status-danger/5 text-navy-800",
        tone === "ok" && "border-status-ok/25 bg-status-ok/5 text-navy-800",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone === "info" ? "text-brand-blue" : tone === "ok" ? "text-status-ok" : tone === "warn" ? "text-status-warn" : "text-status-danger")} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, tone = "blue", label }: { value: number; tone?: "blue" | "green" | "gold" | "red"; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-1.5 w-full overflow-hidden rounded-full bg-sand-200">
      <div
        className={cn("h-full rounded-full", tone === "blue" && "bg-brand-blue", tone === "green" && "bg-status-ok", tone === "gold" && "bg-status-warn", tone === "red" && "bg-status-danger")}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
