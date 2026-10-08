"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Printer } from "lucide-react";
import { SummaryReport } from "@/components/report/SummaryReport";
import { Button } from "@/components/ui/Button";
import { hardChromeDemo } from "@/lib/domain/templates";
import { calculate, indicatorsOf } from "@/lib/engine/calculate";
import { evaluateScenario } from "@/lib/engine/scenario";

/** Public sample of the Laporan Ringkas Manajemen, computed from the sample line. */
export default function Page() {
  const data = useMemo(() => {
    const project = hardChromeDemo();
    const results = calculate(project);
    const indicators = indicatorsOf(results);
    return { project, results, indicators, outcomes: project.scenarios.map((s) => evaluateScenario(project, s, indicators)) };
  }, []);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal">Contoh laporan</p>
          <h1 className="text-2xl font-semibold text-navy-900">Laporan Ringkas Manajemen</h1>
          <p className="text-sm text-navy-700/70">Dari lini contoh hard chrome. Laporan Anda memakai data dan nomor hasil Anda sendiri.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Cetak / PDF
          </Button>
          <Link href="/masuk?daftar=1" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3.5 text-sm font-medium text-white">
            Coba dengan data saya <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <SummaryReport {...data} comparison={null} resultLabel="data contoh (belum disimpan)" nextSteps={[]} watermark company="Contoh" />
    </div>
  );
}
