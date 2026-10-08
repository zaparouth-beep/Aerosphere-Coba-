"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Lock, LogOut, Menu, Search, Sparkles, UserRound } from "lucide-react";
import { hasFeature, PLAN_BY_ID } from "@/lib/domain/plans";
import { ROLE_LABEL, ROLES } from "@/lib/domain/permissions";
import type { Role } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "./nav";

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = NAV_ITEMS.find((i) => pathname?.startsWith(i.href));
  const [mounted, setMounted] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const user = useAppStore((s) => s.user);
  const account = useAppStore((s) => s.account);
  const subscription = useAppStore((s) => s.subscription);
  const expertMode = useAppStore((s) => s.ui.expertMode);
  const setUser = useAppStore((s) => s.setUser);
  const setUi = useAppStore((s) => s.setUi);
  const setExpertMode = useAppStore((s) => s.setExpertMode);
  const signOut = useAppStore((s) => s.signOut);
  useEffect(() => setMounted(true), []);
  const expertAllowed = mounted && hasFeature(subscription, "expertMode");

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
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-sand-200 bg-white/90 px-4 backdrop-blur md:gap-3 md:px-8">
      <button type="button" onClick={onMenu} className="text-navy-800 md:hidden" aria-label="Buka menu">
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-navy-900">{current?.label ?? "AeroSphere LCA"}</h1>
        <p className="hidden truncate text-[11px] text-navy-700/60 sm:block">{current?.question ?? ""}</p>
      </div>
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="hidden items-center gap-2 rounded-lg border border-sand-300 bg-sand-50 px-3 py-1.5 text-xs text-navy-700/60 hover:text-navy-900 lg:flex"
      >
        <Search className="h-3.5 w-3.5" /> Cari
        <kbd className="rounded border border-sand-300 bg-white px-1 text-[10px]">Ctrl K</kbd>
      </button>
      {mounted && (
        <div
          role="radiogroup"
          aria-label="Mode tampilan"
          data-tour="mode"
          className="inline-flex rounded-lg border border-sand-300 bg-white p-0.5 text-[11px] font-medium"
          title="Mode Ringkas menampilkan yang penting saja. Mode Ahli membuka semua angka teknis."
        >
          <button
            type="button"
            role="radio"
            aria-checked={!expertMode}
            onClick={() => setExpertMode(false)}
            className={cn("rounded-md px-2 py-1", !expertMode ? "bg-navy-900 text-white" : "text-navy-700/70")}
          >
            Ringkas
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={expertMode}
            onClick={() => (expertAllowed ? setExpertMode(true) : router.push("/pengaturan?tab=paket"))}
            className={cn("flex items-center gap-1 rounded-md px-2 py-1", expertMode ? "bg-navy-900 text-white" : "text-navy-700/70")}
            title={expertAllowed ? "Mode Ahli" : "Mode Ahli tersedia mulai paket Profesional"}
          >
            {!expertAllowed && <Lock className="h-3 w-3" aria-label="terkunci" />}Ahli
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setUi({ copilotOpen: true })}
        className="flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:opacity-95"
      >
        <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Tanya AeroSphere</span>
      </button>
      {mounted && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((o) => !o)}
            aria-expanded={profileOpen}
            aria-label="Profil dan pengaturan"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white"
          >
            {(account?.name || "?").slice(0, 1).toUpperCase()}
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-10 z-40 w-64 rounded-xl border border-sand-200 bg-white p-2 text-xs shadow-xl" onMouseLeave={() => setProfileOpen(false)}>
              <div className="border-b border-sand-200 px-2 pb-2">
                <p className="font-semibold text-navy-900">{account?.name}</p>
                <p className="truncate text-navy-700/60">{account?.email}</p>
                <p className="text-navy-700/60">Paket {subscription ? PLAN_BY_ID.get(subscription.plan)?.name : "—"}</p>
              </div>
              {[
                ["paket", "Paket & tagihan"],
                ["users", "Pengguna & peran"],
                ["proyek", "Proyek"],
                ["keamanan", "Keamanan & jejak audit"],
              ].map(([tab, label]) => (
                <Link key={tab} href={`/pengaturan?tab=${tab}`} onClick={() => setProfileOpen(false)} className="block rounded-md px-2 py-1.5 text-navy-800 hover:bg-sand-100">
                  {label}
                </Link>
              ))}
              <label className="mt-1 flex items-center gap-2 border-t border-sand-200 px-2 pt-2 text-navy-700/70" title="Simulasi peran untuk demo (RBAC di sisi klien)">
                <UserRound className="h-3.5 w-3.5 text-brand-teal" />
                Peran
                <select value={user.role} onChange={(e) => setUser(user.name, e.target.value as Role)} className="ml-auto max-w-[130px] bg-transparent font-medium text-navy-900 outline-none">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  signOut();
                  // Full navigation so the app gate does not redirect to /masuk first.
                  window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`);
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-status-danger hover:bg-status-danger/5"
              >
                <LogOut className="h-3.5 w-3.5" /> Keluar
              </button>
            </div>
          )}
        </div>
      )}
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
    () => NAV_ITEMS.filter((i) => `${i.label} ${i.question}`.toLowerCase().includes(q.toLowerCase())),
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
            placeholder="Cari menu, mis. 'boros' atau 'laporan'…"
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
                    <span className="block text-xs text-navy-700/60">{r.question}</span>
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
