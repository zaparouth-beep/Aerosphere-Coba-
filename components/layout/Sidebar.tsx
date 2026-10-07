"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, Lock, X } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils/cn";
import { fmtDate } from "@/lib/utils/format";
import { NAV_ITEMS } from "./nav";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const runs = useAppStore((s) => s.runs);
  useEffect(() => setMounted(true), []);
  useEffect(() => onClose(), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastRun = mounted ? runs[0] : undefined;
  const groups = [...new Set(NAV_ITEMS.map((i) => i.group))];

  return (
    <>
      {mobileOpen && <div className="no-print fixed inset-0 z-40 bg-navy-950/40 md:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex flex-col bg-navy-950 text-white transition-[width,transform] md:sticky md:top-0 md:h-screen md:translate-x-0",
          collapsed ? "md:w-16" : "md:w-60",
          mobileOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full",
        )}
        aria-label="Navigasi utama"
      >
        <div className={cn("flex items-center gap-2.5 border-b border-white/10 px-4 py-4", collapsed && "md:justify-center md:px-2")}>
          <Image src={`${BASE}/brand/mark-white.png`} alt="" width={36} height={36} className="h-9 w-9 shrink-0" unoptimized />
          <div className={cn("min-w-0", collapsed && "md:hidden")}>
            <p className="text-[15px] font-semibold tracking-wide">
              AeroSphere <span className="bg-brand-gradient bg-clip-text text-transparent">LCA</span>
            </p>
            <p className="truncate text-[10px] uppercase tracking-[0.14em] text-white/45">LCA + MFCA</p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto text-white/60 md:hidden" aria-label="Tutup menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          {groups.map((g) => (
            <div key={g} className="mb-3">
              <p className={cn("px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35", collapsed && "md:hidden")}>{g}</p>
              {NAV_ITEMS.filter((i) => i.group === g).map((item) => {
                const active = pathname?.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative mb-0.5 flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                      active ? "bg-white/10 font-medium text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
                      collapsed && "md:justify-center",
                    )}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand-gold" aria-hidden />}
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className={cn("truncate", collapsed && "md:hidden")}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className={cn("border-t border-white/10 px-4 py-3 text-[11px] text-white/55", collapsed && "md:hidden")}>
          <p className="flex items-center gap-1.5 font-medium text-white/80">
            <Lock className="h-3 w-3" /> Run terakhir
          </p>
          <p className="num mt-0.5 truncate">{lastRun ? lastRun.id : "Belum ada run terkunci"}</p>
          {lastRun && <p className="truncate text-white/40">{fmtDate(lastRun.manifest.createdAt)}</p>}
          <p className="mt-2 text-white/35">Mengikuti ISO 14040 & 14044</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="hidden items-center justify-center gap-2 border-t border-white/10 py-2.5 text-[11px] text-white/45 hover:text-white md:flex"
          aria-label={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Ciutkan</>}
        </button>
      </aside>
    </>
  );
}
