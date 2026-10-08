"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { effectiveStatus, PLAN_BY_ID } from "@/lib/domain/plans";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS, type NavItem } from "./nav";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Five core menus + Beranda; Bantuan and Pengaturan at the bottom (PRD v1.1 §3.0.3). */
export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const subscription = useAppStore((s) => s.subscription);
  const account = useAppStore((s) => s.account);
  useEffect(() => setMounted(true), []);
  useEffect(() => onClose(), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = mounted && subscription ? PLAN_BY_ID.get(subscription.plan) : undefined;
  const status = mounted ? effectiveStatus(subscription) : "none";

  const link = (item: NavItem) => {
    const active = pathname?.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : item.question}
        aria-current={active ? "page" : undefined}
        data-tour={item.href.slice(1)}
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
  };

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
            <p className="truncate text-[10px] uppercase tracking-[0.14em] text-white/45">Lini pelapisan logam</p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto text-white/60 md:hidden" aria-label="Tutup menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col overflow-y-auto px-2.5 py-3">
          <div>{NAV_ITEMS.filter((i) => i.group === "main").map(link)}</div>
          <div className="mt-auto border-t border-white/10 pt-3">{NAV_ITEMS.filter((i) => i.group === "bottom").map(link)}</div>
        </nav>
        <Link
          href="/pengaturan?tab=paket"
          className={cn("block border-t border-white/10 px-4 py-3 text-[11px] text-white/55 hover:bg-white/5", collapsed && "md:hidden")}
        >
          <p className="truncate font-medium text-white/85">{account?.company || account?.name || "Akun demo"}</p>
          <p className="mt-0.5 flex items-center gap-1.5">
            Paket <span className="font-semibold text-brand-gold">{plan?.name ?? "—"}</span>
            {status === "trial" && <span className="text-white/45">· uji coba</span>}
            {status === "expired" && <span className="text-status-danger">· berakhir</span>}
          </p>
        </Link>
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
