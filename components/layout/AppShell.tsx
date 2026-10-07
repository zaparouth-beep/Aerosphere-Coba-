"use client";

import { useEffect, useState } from "react";
import { Notices } from "@/components/ui/Feedback";
import { ContextBar } from "./ContextBar";
import { CopilotDrawer } from "./CopilotDrawer";
import { Onboarding } from "./Onboarding";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * Client shell. The store hydrates from localStorage, so the shell waits for
 * mount before rendering data-driven pages to avoid hydration mismatches.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="flex min-h-screen bg-sand-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Lewati ke konten
      </a>
      <Sidebar mobileOpen={mobileNav} onClose={() => setMobileNav(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileNav(true)} />
        {mounted && <ContextBar />}
        <main id="main" className="flex-1 px-4 py-6 md:px-8">
          {mounted ? (
            children
          ) : (
            <div className="space-y-4" aria-busy="true">
              <div className="h-24 animate-pulse rounded-xl bg-sand-100" />
              <div className="h-64 animate-pulse rounded-xl bg-sand-100" />
            </div>
          )}
        </main>
        <footer className="no-print border-t border-sand-200 px-4 py-3 text-[11px] text-navy-700/50 md:px-8">
          AeroSphere LCA · ISO 14040/14044-aligned (belum melalui critical review) · Data tersimpan di browser ini
        </footer>
      </div>
      {mounted && <CopilotDrawer />}
      {mounted && <Onboarding />}
      <Notices />
    </div>
  );
}
