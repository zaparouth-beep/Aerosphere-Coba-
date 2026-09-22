"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "./nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="no-print flex h-screen w-60 shrink-0 flex-col border-r border-navy-800 bg-navy-950 text-white">
      <div className="flex items-center gap-2 border-b border-navy-800 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gold/90 text-sm font-bold text-navy-950">
          AS
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">AeroSphere LCA</p>
          <p className="text-[11px] text-white/50">Proses Material & Energy Intelligence</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-white/10 font-medium text-white"
                  : "text-white/65 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-navy-800 px-5 py-4 text-[11px] text-white/40">
        Mengikuti ISO 14040 &amp; ISO 14044
      </div>
    </aside>
  );
}
