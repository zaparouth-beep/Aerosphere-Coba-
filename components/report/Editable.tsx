"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, Eye, EyeOff, PencilLine, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Callout, Modal } from "@/components/ui/Feedback";
import {
  editState,
  foreignNumbers,
  invalidBlocks,
  isHidden,
  resolveText,
} from "@/lib/report/edits";
import { useAppStore, type ReportDocEdits } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils/cn";
import { T, tx } from "@/lib/i18n";

/**
 * Report text the user can adjust before printing or downloading. Wrap a
 * report (toolbar + preview) in <ReportEditor>; mark text with <EditableText>.
 * Tables and numbers stay locked: an edit may reword, shorten or add text,
 * but every number in it must come from the engine text it replaces.
 */

interface Ctx {
  doc: string;
  edits: ReportDocEdits | undefined;
  editing: boolean;
  setEditing: (on: boolean) => void;
  register: (id: string, original: string) => () => void;
  originals: Map<string, string>;
  version: number;
}

const EditCtx = createContext<Ctx | null>(null);

export function ReportEditor({
  doc,
  children,
}: {
  doc: string;
  children: React.ReactNode;
}) {
  const edits = useAppStore((s) => s.reportEdits[doc]);
  const [editing, setEditing] = useState(false);
  const originals = useRef(new Map<string, string>()).current;
  const [version, setVersion] = useState(0);
  const register = useCallback(
    (id: string, original: string) => {
      if (originals.get(id) !== original) {
        originals.set(id, original);
        setVersion((v) => v + 1);
      }
      return () => {
        if (originals.get(id) === original) {
          originals.delete(id);
          setVersion((v) => v + 1);
        }
      };
    },
    [originals],
  );
  // A different report/result starts in reading mode.
  useEffect(() => setEditing(false), [doc]);
  const value = useMemo(
    () => ({ doc, edits, editing, setEditing, register, originals, version }),
    [doc, edits, editing, register, originals, version],
  );
  return <EditCtx.Provider value={value}>{children}</EditCtx.Provider>;
}

/** Outside <ReportEditor> (e.g. the public sample report) text is shown as written, without editing. */
const READ_ONLY: Ctx = { doc: "", edits: undefined, editing: false, setEditing: () => undefined, register: () => () => undefined, originals: new Map(), version: 0 };

function useEditCtx(): Ctx {
  return useContext(EditCtx) ?? READ_ONLY;
}

/** State for print/download buttons: blocked while an edit contains numbers not from the engine. */
export function useReportEdits() {
  const { doc, edits, originals, version, editing } = useEditCtx();
  return useMemo(() => {
    void version;
    const live = [...originals].filter(
      ([id, base]) => editState(edits, id, base) !== "none",
    );
    const invalid = invalidBlocks(edits, originals);
    return {
      doc,
      editing,
      edited: live.filter(
        ([id, base]) => editState(edits, id, base) !== "stale",
      ).length,
      stale: live.filter(([id, base]) => editState(edits, id, base) === "stale")
        .length,
      hidden: edits?.hidden.length ?? 0,
      invalid: invalid.length,
      blocked: invalid.length > 0,
      blockedReason: invalid.length
        ? tx(
            "Ada teks berisi angka yang tidak berasal dari hasil hitung. Perbaiki atau kembalikan teks aslinya dulu.",
            "Some text contains numbers that do not come from the calculation results. Fix it or restore the original text first.",
          )
        : undefined,
      /** Resolved text for exports (Excel): the user's edit when it applies. */
      text: (id: string, original: string) => resolveText(edits, id, original),
      isHidden: (id: string) => isHidden(edits, id),
    };
  }, [doc, edits, originals, version, editing]);
}

/** "Ubah teks" toggle, edit counts, and reset — placed in the report toolbar. */
export function ReportEditBar() {
  const { setEditing } = useEditCtx();
  const s = useReportEdits();
  const resetDoc = useAppStore((x) => x.resetReportDoc);
  const [confirm, setConfirm] = useState(false);
  const any = s.edited + s.stale + s.hidden > 0;
  return (
    <>
      <Button
        variant={s.editing ? "primary" : "secondary"}
        onClick={() => setEditing(!s.editing)}
        data-testid="report-edit-toggle"
      >
        {s.editing ? (
          <Check className="h-4 w-4" />
        ) : (
          <PencilLine className="h-4 w-4" />
        )}
        {s.editing ? tx("Selesai mengubah", "Done editing") : tx("Ubah teks laporan", "Edit report text")}
      </Button>
      {any && (
        <Button variant="ghost" onClick={() => setConfirm(true)}>
          <RotateCcw className="h-4 w-4" /> {tx("Kembalikan semua teks asli", "Restore all original text")}
        </Button>
      )}
      {(s.edited > 0 || s.hidden > 0) && (
        <span
          className="text-xs text-navy-700/70"
          data-testid="report-edit-count"
        >
          {s.edited > 0 && tx(`${s.edited} bagian diubah`, `${s.edited} ${s.edited === 1 ? "section" : "sections"} edited`)}
          {s.edited > 0 && s.hidden > 0 && " · "}
          {s.hidden > 0 && tx(`${s.hidden} bagian tidak disertakan`, `${s.hidden} ${s.hidden === 1 ? "section" : "sections"} left out`)}
        </span>
      )}
      <Modal
        open={confirm}
        title={tx("Kembalikan semua teks asli?", "Restore all original text?")}
        onClose={() => setConfirm(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {tx("Batal", "Cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDoc(s.doc);
                setConfirm(false);
              }}
            >
              {tx("Kembalikan", "Restore")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-800">
          {tx(
            "Semua perubahan teks di laporan ini dihapus dan bagian yang disembunyikan ditampilkan lagi. Angka dan tabel tidak berubah.",
            "All text changes in this report are removed and hidden sections are shown again. Numbers and tables do not change.",
          )}
        </p>
      </Modal>
    </>
  );
}

/** Notices shown above the report while editing (how it works, stale and invalid edits). */
export function ReportEditNotice() {
  const s = useReportEdits();
  return (
    <>
      {s.editing && (
        <div className="no-print" data-testid="report-edit-help">
          <Callout>
            <T
              id={
                <>
                  Klik teks bergaris putus-putus untuk mengubahnya. Kata-kata boleh
                  diubah, dipersingkat, atau ditambah;{" "}
                  <b>angka hanya boleh yang sudah ada di teks asli</b> karena berasal
                  dari mesin hitung. Tabel tidak bisa diubah. Teks di antara ** dan **
                  dicetak tebal. Perubahan tersimpan otomatis di browser ini.
                </>
              }
              en={
                <>
                  Click text with a dashed border to change it. Words may be changed,
                  shortened, or added;{" "}
                  <b>only numbers already in the original text are allowed</b> because
                  they come from the calculation engine. Tables cannot be changed. Text
                  between ** and ** is printed in bold. Changes are saved automatically
                  in this browser.
                </>
              }
            />
          </Callout>
        </div>
      )}
      {s.invalid > 0 && (
        <div className="no-print" data-testid="report-edit-invalid">
          <Callout tone="danger">
            {tx(
              `${s.invalid} bagian berisi angka yang tidak ada di hasil hitung. Cetak dan unduh dinonaktifkan sampai angkanya diperbaiki atau teks aslinya dikembalikan.`,
              `${s.invalid} ${s.invalid === 1 ? "section contains" : "sections contain"} numbers that are not in the calculation results. Printing and downloading are disabled until the numbers are fixed or the original text is restored.`,
            )}
          </Callout>
        </div>
      )}
      {s.stale > 0 && (
        <Callout tone="warn" className="no-print">
          {tx(
            `${s.stale} perubahan teks tidak dipakai karena hasil hitung berubah sejak teks itu diubah. Teks asli yang baru ditampilkan; ubah lagi bila perlu.`,
            `${s.stale} text ${s.stale === 1 ? "change is" : "changes are"} not used because the calculation results changed since the text was edited. The new original text is shown; edit again if needed.`,
          )}
        </Callout>
      )}
    </>
  );
}

/** **bold** markup → <b>; newlines kept. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\*\*[^*]+\*\*$/.test(p) ? (
          <b key={i}>{p.slice(2, -2)}</b>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

type As = "p" | "span" | "div" | "h1" | "h2" | "h3";

export function EditableText({
  id,
  text,
  as: Tag = "p",
  className,
  lang,
  placeholder,
  label,
}: {
  id: string;
  /** Engine-generated text (may contain **bold**). */
  text: string;
  as?: As;
  className?: string;
  lang?: string;
  /** For an optional block that is empty by default (e.g. "Catatan tambahan"). */
  placeholder?: string;
  /** Accessible name of the text box. */
  label?: string;
}) {
  const { doc, edits, editing, register } = useEditCtx();
  const setBlock = useAppStore((s) => s.setReportBlock);
  const resetBlock = useAppStore((s) => s.resetReportBlock);
  useEffect(() => register(id, text), [id, text, register]);

  const state = editState(edits, id, text);
  const shown = resolveText(edits, id, text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [shown, editing]);

  if (!editing) {
    if (!shown) return null;
    return (
      <Tag
        className={cn(
          "whitespace-pre-line",
          className,
          state === "invalid" && "rounded bg-status-danger/10",
        )}
        lang={lang}
        data-edited={state === "edited" || undefined}
      >
        <Rich text={shown} />
      </Tag>
    );
  }

  const foreign = state === "invalid" ? foreignNumbers(shown, text) : [];
  const Wrap = Tag === "span" ? "span" : "div";
  return (
    <Wrap
      className={cn(
        "group relative",
        Tag === "span" ? "inline-block w-full align-top" : "block",
      )}
    >
      <textarea
        ref={ref}
        rows={1}
        lang={lang}
        aria-label={label ?? tx("Teks laporan", "Report text")}
        data-testid="report-editable"
        data-block={id}
        placeholder={placeholder}
        value={shown}
        onChange={(e) => setBlock(doc, id, text, e.target.value)}
        className={cn(
          "no-print block w-full resize-none overflow-hidden rounded-md border border-dashed bg-brand-blue/[0.03] px-1.5 py-1 font-[inherit] text-[length:inherit] leading-[inherit] text-[color:inherit] outline-none focus:border-solid focus:border-brand-blue focus:bg-white",
          state === "invalid"
            ? "border-status-danger"
            : state === "edited"
              ? "border-brand-teal"
              : "border-sand-300",
          className,
        )}
      />
      {/* Printed while the editor is open. */}
      {shown && (
        <Tag
          className={cn("hidden whitespace-pre-line print:block", className)}
          lang={lang}
        >
          <Rich text={shown} />
        </Tag>
      )}
      {(state !== "none" || foreign.length > 0) && (
        <span className="no-print mt-0.5 flex flex-wrap items-center gap-2 text-[10px] not-italic">
          {state === "edited" && (
            <span className="text-brand-teal">{tx("Diubah", "Edited")}</span>
          )}
          {state === "stale" && (
            <span className="text-status-warn">
              {tx("Hasil hitung berubah; teks asli dipakai", "Results changed; original text used")}
            </span>
          )}
          {foreign.length > 0 && (
            <span className="text-status-danger" role="alert">
              {tx(
                `Angka ${foreign.join(", ")} tidak ada di hasil hitung. Hapus, tulis dengan huruf, atau pakai angka asli.`,
                `Number ${foreign.join(", ")} is not in the calculation results. Remove it, write it in words, or use the original number.`,
              )}
            </span>
          )}
          {state !== "none" && (
            <button
              type="button"
              className="font-medium text-brand-blue hover:underline"
              onClick={() => resetBlock(doc, id)}
            >
              {tx("Kembalikan teks asli", "Restore original text")}
            </button>
          )}
        </span>
      )}
    </Wrap>
  );
}

/** Include/leave out an optional block (e.g. one direction). Shown only while editing. */
export function IncludeToggle({ id, label }: { id: string; label: string }) {
  const { doc, edits, editing } = useEditCtx();
  const setHidden = useAppStore((s) => s.setReportHidden);
  if (!editing) return null;
  const hidden = isHidden(edits, id);
  return (
    <button
      type="button"
      className="no-print inline-flex items-center gap-1 rounded-md border border-sand-300 px-2 py-0.5 text-[10px] font-medium text-navy-800 hover:bg-sand-50"
      onClick={() => setHidden(doc, id, !hidden)}
      aria-pressed={!hidden}
      data-testid="report-include"
    >
      {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      {hidden
        ? tx(`Tidak disertakan — sertakan lagi ${label}`, `Left out — include ${label} again`)
        : tx(`Disertakan — keluarkan ${label}`, `Included — leave out ${label}`)}
    </button>
  );
}

/** Children hidden from the report (and print) when the block is left out; dimmed while editing. */
export function Optional({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { edits, editing } = useEditCtx();
  const hidden = isHidden(edits, id);
  if (hidden && !editing) return null;
  return (
    <div className={cn(className, hidden && "no-print opacity-40")}>
      {children}
    </div>
  );
}
