"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { effectiveStatus, daysLeft, PLAN_BY_ID } from "@/lib/domain/plans";
import { useAppStore } from "@/lib/store/useAppStore";
import { ContextBar } from "./ContextBar";
import { CopilotDrawer } from "./CopilotDrawer";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Tour } from "./Tour";

/**
 * App shell with the v1.1 entry gate (PRD §1.3): signed in → plan chosen and
 * active → onboarding done → app. The store hydrates from localStorage, so
 * nothing data-driven renders before mount.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const account = useAppStore((s) => s.account);
  const subscription = useAppStore((s) => s.subscription);
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  useEffect(() => setMounted(true), []);

  const status = effectiveStatus(subscription);
  const target = !account ? "/masuk" : !subscription || status === "pending" ? "/paket" : !onboardingDone ? "/mulai" : null;
  useEffect(() => {
    if (mounted && target) router.replace(`${target}?lanjut=${encodeURIComponent(pathname ?? "/beranda")}`);
  }, [mounted, target, router, pathname]);

  const ready = mounted && !target;
  const left = daysLeft(subscription);

  return (
    <div className="flex min-h-screen bg-sand-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Lewati ke konten
      </a>
      <Sidebar mobileOpen={mobileNav} onClose={() => setMobileNav(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileNav(true)} />
        {ready && status === "expired" && (
          <div className="no-print border-b border-status-danger/30 bg-status-danger/5 px-4 py-2 text-xs text-navy-900 md:px-8">
            Masa paket {PLAN_BY_ID.get(subscription!.plan)?.name} sudah berakhir. Data tetap bisa dibaca selama 30 hari.{" "}
            <Link href="/pengaturan?tab=paket" className="font-medium text-brand-blue underline">
              Pilih paket
            </Link>
          </div>
        )}
        {ready && status === "trial" && left !== null && (
          <div className="no-print border-b border-brand-gold/30 bg-brand-gold/10 px-4 py-1.5 text-[11px] text-navy-900 md:px-8">
            Paket Coba: sisa {left} hari · proyek contoh · laporan bertanda “Contoh”.{" "}
            <Link href="/pengaturan?tab=paket" className="font-medium text-brand-blue underline">
              Lihat paket
            </Link>
          </div>
        )}
        {ready && <ContextBar />}
        <main id="main" className="flex-1 px-4 py-6 md:px-8">
          {ready ? (
            children
          ) : (
            <div className="space-y-4" aria-busy="true">
              <div className="h-24 animate-pulse rounded-xl bg-sand-100" />
              <div className="h-64 animate-pulse rounded-xl bg-sand-100" />
            </div>
          )}
        </main>
        <footer className="no-print border-t border-sand-200 px-4 py-3 text-[11px] text-navy-700/50 md:px-8">
          AeroSphere LCA · selaras ISO 14040/14044 (belum melalui critical review) · versi demo: data tersimpan di browser ini
        </footer>
      </div>
      {ready && <CopilotDrawer />}
      {ready && <Tour />}
    </div>
  );
}
