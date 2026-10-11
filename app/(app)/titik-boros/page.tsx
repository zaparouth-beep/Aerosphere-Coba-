"use client";

import { useEffect, useMemo, useState } from "react";
import { HeatTable, Legend, NO_FOCUS, StackedChart, StageBoxes, type Focus } from "@/components/titik-boros/TitikBoros";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Feedback";
import { buildTitikBoros } from "@/lib/engine/titikBoros";
import type { StageCode } from "@/lib/engine/types";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults, useScenarioOutcomes } from "@/lib/store/useResults";
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
  useEffect(() => {
    if (!seen) setUi({ seenHotspot: true });
  }, [seen, setUi]);

  const model = useMemo(() => (results.analysis ? buildTitikBoros(results.analysis, { thresholdPct: project.hotspotThresholdPct }) : null), [results, project.hotspotThresholdPct]);

  if (!model) {
    return (
      <Callout tone="warn">
        Hasil ini dibuat dengan mesin hitung versi lama, jadi titik boros per tahap belum bisa ditampilkan. Tekan “Hitung hasil” di bar atas untuk membuat hasil baru.
      </Callout>
    );
  }

  const resultLabel = run ? `Hasil #${run.id}` : "data terkini (belum disimpan)";
  const onExcel = async () => {
    const { buildTitikBorosWorkbook } = await import("@/lib/io/titikBorosExport");
    const blob = await buildTitikBorosWorkbook(project, model, resultLabel);
    downloadBlob(blob, `Titik-boros_${run?.id ?? "DRAF"}_Rahasia-Tenant.xlsx`, blob.type);
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(tableTsv(project, model));
      notify("success", "Tabel titik boros disalin. Tempel di Excel atau dokumen.");
    } catch {
      notify("error", "Browser tidak mengizinkan menyalin. Pakai tombol Unduh tabel (Excel).");
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
          title="Porsi tiap tahap per indikator"
          subtitle={`Satu batang = 100% satu indikator (${resultLabel}). Angka di kanan = total per 1 m² permukaan dilapisi.`}
        />
        <CardBody>
          <StackedChart project={project} model={model} focus={focus} pinned={pinned} onFocus={setFocus} expert={expert} />
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
