"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, GitFork } from "lucide-react";
import { FlowExplorer } from "@/components/flow/FlowExplorer";
import { HeatTable, Legend, NO_FOCUS, StackedChart, StageBoxes, type Focus } from "@/components/titik-boros/TitikBoros";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Feedback";
import { buildTitikBoros } from "@/lib/engine/titikBoros";
import type { StageCode } from "@/lib/engine/types";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults, useScenarioOutcomes } from "@/lib/store/useResults";
import { tx } from "@/lib/i18n";
import { downloadBlob } from "@/lib/utils/export";
import { tableTsv } from "@/lib/view/titikBoros";

/**
 * Titik Boros: A = 100 % stacked bars per indicator, B = heatmap table,
 * C = coloured explanation boxes per stage. One colour system (severity of a
 * stage's share in an indicator) across all three; numbers from the run.
 */
export default function Page() {
  const { project, results, run } = useActiveResults();
  const { outcomes } = useScenarioOutcomes();
  const expert = useAppStore((s) => s.ui.expertMode);
  const seen = useAppStore((s) => s.ui.seenHotspot);
  const setUi = useAppStore((s) => s.setUi);
  const notify = useAppStore((s) => s.notify);
  const [focus, setFocus] = useState<Focus>(NO_FOCUS);
  const [pinned, setPinned] = useState<StageCode | null>(null);
  const [view, setView] = useState<"batang" | "alur">("batang");
  useEffect(() => {
    if (!seen) setUi({ seenHotspot: true });
  }, [seen, setUi]);

  const model = useMemo(() => (results.analysis ? buildTitikBoros(results.analysis, { thresholdPct: project.hotspotThresholdPct }) : null), [results, project.hotspotThresholdPct]);

  if (!model) {
    return (
      <Callout tone="warn">
        {tx(
          "Hasil ini dibuat dengan mesin hitung versi lama, jadi titik boros per tahap belum bisa ditampilkan. Tekan “Hitung hasil” di bar atas untuk membuat hasil baru.",
          "This result was made with an older version of the calculation engine, so waste hotspots per stage cannot be shown yet. Press “Calculate results” in the top bar to make a new one.",
        )}
      </Callout>
    );
  }

  const resultLabel = run ? `${tx("Hasil", "Result")} #${run.id}` : tx("data terkini (belum disimpan)", "current data (not saved)");
  const onExcel = async () => {
    const { buildTitikBorosWorkbook } = await import("@/lib/io/titikBorosExport");
    const blob = await buildTitikBorosWorkbook(project, model, resultLabel);
    downloadBlob(blob, `Titik-boros_${run?.id ?? "DRAF"}_Rahasia-Tenant.xlsx`, blob.type);
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(tableTsv(project, model));
      notify("success", tx("Tabel titik boros disalin. Tempel di Excel atau dokumen.", "Waste hotspot table copied. Paste it into Excel or a document."));
    } catch {
      notify("error", tx("Browser tidak mengizinkan menyalin. Pakai tombol Unduh tabel (Excel).", "The browser does not allow copying. Use the Download table (Excel) button."));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="py-3">
          <Legend thresholdPct={model.thresholdPct} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={view === "batang" ? tx("Porsi tiap tahap per indikator", "Share of each stage per indicator") : tx("Alur: dari sumber ke tahap ke total lini", "Flow: from source to stage to line total")}
          subtitle={
            view === "batang"
              ? tx(
                  `Satu batang = 100% satu indikator (${resultLabel}). Angka di kanan = total per 1 m² permukaan dilapisi.`,
                  `One bar = 100% of one indicator (${resultLabel}). Number on the right = total per 1 m² of plated surface.`,
                )
              : tx(
                  `Pilih indikator, arahkan kursor ke pita untuk angka, klik kotak untuk saran dan telusuri lebih dalam (${resultLabel}).`,
                  `Choose an indicator, hover over a band for numbers, click a box for suggestions and drill down (${resultLabel}).`,
                )
          }
          action={
            <div className="inline-flex rounded-lg border border-sand-200 p-0.5 text-xs" role="radiogroup" aria-label={tx("Tampilan grafik", "Chart view")}>
              {(
                [
                  ["batang", tx("Batang 100%", "100% bars"), BarChart3],
                  ["alur", tx("Alur", "Flow"), GitFork],
                ] as const
              ).map(([id, l, I]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={view === id}
                  onClick={() => setView(id)}
                  className={view === id ? "inline-flex items-center gap-1 rounded-md bg-navy-900 px-2 py-1 text-white" : "inline-flex items-center gap-1 rounded-md px-2 py-1 text-navy-800"}
                >
                  <I className="h-3.5 w-3.5" /> {l}
                </button>
              ))}
            </div>
          }
        />
        <CardBody>
          {view === "batang" ? (
            <StackedChart project={project} model={model} focus={focus} pinned={pinned} onFocus={setFocus} expert={expert} />
          ) : (
            <FlowExplorer
              project={project}
              run={results.analysis!}
              outcomes={outcomes}
              thresholdPct={project.hotspotThresholdPct}
              highlightStage={pinned ?? (focus.source !== "chart" ? focus.stage : null)}
              onHoverStage={(st) => setFocus(st ? { stage: st, key: null, source: "box" } : NO_FOCUS)}
              testId="tb-flow"
            />
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <HeatTable project={project} model={model} focus={focus} pinned={pinned} onFocus={setFocus} expert={expert} onExcel={onExcel} onCopy={onCopy} />
        </div>
        <div className="xl:col-span-5">
          <StageBoxes project={project} model={model} outcomes={outcomes} focus={focus} pinned={pinned} onFocus={setFocus} onPin={setPinned} />
        </div>
      </div>
    </div>
  );
}
