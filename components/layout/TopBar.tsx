"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Menu, Search, Sparkles, UserRound } from "lucide-react";
import { ROLE_LABEL, ROLES } from "@/lib/domain/permissions";
import type { Role } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "./nav";

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((i) => pathname?.startsWith(i.href));
  const [mounted, setMounted] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setUi = useAppStore((s) => s.setUi);
  const projectName = useAppStore((s) => s.project.name);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-sand-200 bg-white/90 px-4 backdrop-blur md:px-8">
      <button type="button" onClick={onMenu} className="text-navy-800 md:hidden" aria-label="Buka menu">
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] text-navy-700/55">
          {mounted ? projectName : "AeroSphere LCA"} <span aria-hidden>›</span> {current?.group ?? ""}
        </p>
        <h1 className="truncate text-base font-semibold text-navy-900">{current?.label ?? "AeroSphere LCA"}</h1>
      </div>
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="hidden items-center gap-2 rounded-lg border border-sand-300 bg-sand-50 px-3 py-1.5 text-xs text-navy-700/60 hover:text-navy-900 lg:flex"
      >
        <Search className="h-3.5 w-3.5" /> Cari menu
        <kbd className="rounded border border-sand-300 bg-white px-1 text-[10px]">Ctrl K</kbd>
      </button>
      {mounted && (
        <label className="flex items-center gap-1.5 rounded-lg border border-sand-300 bg-white px-2 py-1 text-xs text-navy-800" title="Peran aktif (simulasi RBAC di sisi klien)">
          <UserRound className="h-3.5 w-3.5 text-brand-teal" />
          <span className="sr-only">Peran</span>
          <select
            value={user.role}
            onChange={(e) => setUser(user.name, e.target.value as Role)}
            className="max-w-[150px] bg-transparent text-xs font-medium outline-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        onClick={() => setUi({ copilotOpen: true })}
        className="flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-95"
      >
        <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Copilot</span>
      </button>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </header>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(
    () => NAV_ITEMS.filter((i) => `${i.label} ${i.description}`.toLowerCase().includes(q.toLowerCase())),
    [q],
  );
  useEffect(() => inputRef.current?.focus(), []);
  const go = (href: string) => {
    router.push(href);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-navy-950/40 p-4 pt-24" onMouseDown={onClose} role="dialog" aria-label="Pencarian menu">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-sand-200 px-4">
          <Search className="h-4 w-4 text-navy-700/50" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setIdx((i) => Math.min(i + 1, results.length - 1));
              if (e.key === "ArrowUp") setIdx((i) => Math.max(i - 1, 0));
              if (e.key === "Enter" && results[idx]) go(results[idx]!.href);
            }}
            placeholder="Cari modul, mis. 'hotspot' atau 'audit'…"
            className="h-12 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <li key={r.href}>
                <button
                  type="button"
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => go(r.href)}
                  className={cn("flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left", i === idx ? "bg-sand-100" : "")}
                >
                  <Icon className="mt-0.5 h-4 w-4 text-brand-teal" />
                  <span>
                    <span className="block text-sm font-medium text-navy-900">{r.label}</span>
                    <span className="block text-xs text-navy-700/60">{r.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {!results.length && <li className="px-3 py-6 text-center text-xs text-navy-700/55">Tidak ada yang cocok.</li>}
        </ul>
      </div>
    </div>
  );
}
