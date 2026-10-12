/**
 * App language (Bahasa Indonesia / English). Text is written in place as a
 * pair — `tx("Hitung hasil", "Calculate results")` — so both languages stay
 * next to each other in the code. The current language is a module-level
 * value: <LangRoot> (components/layout/LangRoot) sets it and remounts the page when it changes, so every
 * component and lib helper reads the new language on the next render without
 * subscribing. Indonesian is the default (and is what the static HTML holds).
 */

import type { ReactNode } from "react";

export type Lang = "id" | "en";

let current: Lang = "id";

export const getLang = (): Lang => current;
export const setCurrentLang = (l: Lang) => {
  current = l;
};

/** Pick the text for the current language. */
export const tx = (id: string, en: string): string => (current === "en" ? en : id);

/** Pick from a `{ id, en }` object (labels kept as pairs in data tables). */
export const pick = <T,>(o: { id: T; en: T }): T => (current === "en" ? o.en : o.id);

/** Rich text (JSX with <b>, links) in both languages. */
export function T({ id, en }: { id: ReactNode; en: ReactNode }) {
  return <>{current === "en" ? en : id}</>;
}

/** Intl locale for numbers and dates: 1.234,5 (id) or 1,234.5 (en). */
export const locale = (): string => (current === "en" ? "en-GB" : "id-ID");
