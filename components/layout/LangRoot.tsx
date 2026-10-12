"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { setCurrentLang, type Lang } from "@/lib/i18n";
import { useAppStore } from "@/lib/store/useAppStore";

/**
 * Root wrapper: Indonesian until the stored settings are loaded (matches the
 * static HTML), then the chosen language. A language change remounts the tree.
 */
export function LangRoot({ children }: { children: ReactNode }) {
  const stored = useAppStore((s) => s.ui.lang);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const lang: Lang = mounted && stored === "en" ? "en" : "id";
  setCurrentLang(lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <Fragment key={lang}>{children}</Fragment>;
}
