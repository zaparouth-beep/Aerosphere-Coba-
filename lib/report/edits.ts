import type { ReportDocEdits } from "@/lib/store/useAppStore";

/**
 * Rules for user edits of report text. Words can be changed freely; numbers
 * cannot be invented: every number in an edited block must already appear in
 * the engine text it replaces (CLAUDE.md rule 1). An edit written over an
 * older engine text (the results changed since) is not used.
 */

/** Numbers as written ("1.250,5", "7,39", "2026"); markup and list markers are ignored. */
export function numbersIn(text: string): string[] {
  return text.replace(/\*\*/g, "").match(/\d+(?:[.,]\d+)*/g) ?? [];
}

/** Numbers in `text` that do not appear in `base`. */
export function foreignNumbers(text: string, base: string): string[] {
  const allowed = new Set(numbersIn(base));
  return [...new Set(numbersIn(text).filter((x) => !allowed.has(x)))];
}

export type EditState = "none" | "edited" | "stale" | "invalid";

export function editState(doc: ReportDocEdits | undefined, id: string, original: string): EditState {
  const e = doc?.blocks[id];
  if (!e) return "none";
  if (e.base !== original) return "stale";
  return foreignNumbers(e.text, e.base).length ? "invalid" : "edited";
}

/** Text to show and export: the user's edit when it applies to the current engine text. */
export function resolveText(doc: ReportDocEdits | undefined, id: string, original: string): string {
  const e = doc?.blocks[id];
  return e && e.base === original ? e.text : original;
}

export const isHidden = (doc: ReportDocEdits | undefined, id: string) => Boolean(doc?.hidden.includes(id));

/** Edits that still apply but contain numbers not from the engine (they block printing and download). */
export function invalidBlocks(doc: ReportDocEdits | undefined, originals: Map<string, string>): string[] {
  if (!doc) return [];
  return [...originals].filter(([id, base]) => editState(doc, id, base) === "invalid").map(([id]) => id);
}
