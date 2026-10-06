"use client";

import { Download, FileJson, Printer, Table2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { STAGE_BY_ID } from "@/lib/lca/constants";
import {
  buyToFlyRatio,
  computeCostBreakdown,
  computeEnvironmentalImpact,
  computeHotspotTable,
  computeIntensities,
  findHotspotStage,
  scrapMassKg,
} from "@/lib/lca/calculations";
import { compareScenario } from "@/lib/lca/whatif";
import { downloadCSV, downloadJSON } from "@/lib/utils/export";
import { formatNumber, formatPercent, formatRupiah } from "@/lib/utils/format";

export default function LaporanPage() {
  const project = useProjectStore((s) => s.project);
  const activeLeverIds = useProjectStore((s) => s.activeLeverIds);

  const intensities = computeIntensities(project);
  const impact = computeEnvironmentalImpact(project);
  const cost = computeCostBreakdown(project);
  const hotspotRows = computeHotspotTable(project);
  const activeLevers = project.whatIfLevers.filter((l) => activeLeverIds.includes(l.id));
  const scenario = compareScenario(project, activeLevers);

  const energyHotspot = STAGE_BY_ID.get(findHotspotStage(hotspotRows, "energyPct") ?? "main_plating");
  const waterHotspot = STAGE_BY_ID.get(findHotspotStage(hotspotRows, "waterPct") ?? "pretreatment");
  const chemicalHotspot = STAGE_BY_ID.get(findHotspotStage(hotspotRows, "chemicalPct") ?? "main_plating");
  const wasteHotspot = STAGE_BY_ID.get(findHotspotStage(hotspotRows, "wastePct") ?? "wwtp");

  const handleExportCSVProcess = () => {
    downloadCSV(
      project.lciInputs.map((e) => ({
        No: e.no,
        Kategori: e.category,
        Input: e.name,
        Tahap: STAGE_BY_ID.get(e.stageId)?.name ?? e.stageId,
        Kuantitas: e.quantity,
        Unit: e.unit,
        Confidence: e.confidence,
      })),
      "aerosphere-lca-proses.csv",
    );
  };

  const handleExportCSVScenario = () => {
    downloadCSV(
      [
        { Metrik: "Energi (kWh)", Sebelum: (intensities.energyIntensity * project.functionalUnit.value).toFixed(2), Sesudah: (scenario.after.intensities.energyIntensity * project.functionalUnit.value).toFixed(2) },
        { Metrik: "Air (L)", Sebelum: (intensities.waterIntensity * project.functionalUnit.value).toFixed(2), Sesudah: (scenario.after.intensities.waterIntensity * project.functionalUnit.value).toFixed(2) },
        { Metrik: "Kimia (kg)", Sebelum: (intensities.chemicalIntensity * project.functionalUnit.value).toFixed(2), Sesudah: (scenario.after.intensities.chemicalIntensity * project.functionalUnit.value).toFixed(2) },
        { Metrik: "Limbah B3 (kg)", Sebelum: (intensities.wasteIntensity * project.functionalUnit.value).toFixed(2), Sesudah: (scenario.after.intensities.wasteIntensity * project.functionalUnit.value).toFixed(2) },
        { Metrik: "Biaya aliran sumber daya (Rp)", Sebelum: cost.flowTotalRp.toFixed(0), Sesudah: scenario.after.cost.flowTotalRp.toFixed(0) },
      ],
      "aerosphere-lca-skenario.csv",
    );
  };

  const handleExportJSON = () => {
    downloadJSON(
      { project, intensities, impact, cost, hotspotRows, activeLevers, scenario },
      "aerosphere-lca-proyek.json",
    );
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Cetak / Simpan PDF
        </Button>
        <Button variant="secondary" onClick={handleExportCSVProcess}>
          <Table2 className="h-4 w-4" /> CSV hasil proses
        </Button>
        <Button variant="secondary" onClick={handleExportCSVScenario}>
          <Download className="h-4 w-4" /> CSV skenario
        </Button>
        <Button variant="secondary" onClick={handleExportJSON}>
          <FileJson className="h-4 w-4" /> Proyek JSON
        </Button>
      </div>

      <Card>
        <CardHeader title="LAPORAN" subtitle="Ringkasan siap cetak untuk kasus proses ini" />
        <CardBody className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-700/50">
              Ringkasan eksekutif
            </p>
            <p className="mt-2 text-sm leading-relaxed text-navy-900">
              {project.name} — {project.part.partName} ({project.part.material}), dibutuhkan{" "}
              {formatNumber(project.part.initialStockMassKg)} kg stok untuk menghasilkan{" "}
              {formatNumber(project.part.finishedMassKg)} kg part jadi (buy-to-fly{" "}
              {formatNumber(buyToFlyRatio(project), 2)}:1). Proses plating menghasilkan biaya total{" "}
              {formatRupiah(cost.costPerFunctionalUnit)} per{" "}
              {project.functionalUnit.type === "m2_plated" ? "m² ter-plating" : "unit"}, dengan{" "}
              {formatNumber(impact.totalWasteKgB3)} kg limbah B3 per proses. Hotspot utama:{" "}
              <strong>{energyHotspot?.name}</strong> untuk energi, <strong>{chemicalHotspot?.name}</strong>{" "}
              untuk bahan kimia, dan <strong>{wasteHotspot?.name}</strong> untuk limbah B3.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-700/50">
              Indikator utama
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
              <Indicator label="Massa stok awal" value={`${formatNumber(project.part.initialStockMassKg)} kg`} />
              <Indicator label="Massa produk" value={`${formatNumber(project.part.finishedMassKg)} kg`} />
              <Indicator label="Scrap total" value={`${formatNumber(scrapMassKg(project))} kg`} />
              <Indicator label="Energi proses" value={`${formatNumber(impact.totalEnergyKwh)} kWh`} />
              <Indicator label="Biaya aliran sumber daya" value={formatRupiah(cost.flowTotalRp)} />
              <Indicator label="Biaya total (+ tenaga kerja)" value={formatRupiah(cost.totalRp)} />
              <Indicator label={`Biaya total / ${project.functionalUnit.type === "m2_plated" ? "m²" : "unit"}`} value={formatRupiah(cost.costPerFunctionalUnit)} />
              <Indicator label="Estimasi CO2e" value={`${formatNumber(impact.totalGhgKgCO2e)} kg`} />
              <Indicator label="CO2e / unit fungsional" value={`${formatNumber(impact.ghgPerFunctionalUnit, 2)} kg`} />
              <Indicator label="Volume tahunan" value={`${formatNumber(project.part.annualVolumeParts, 0)} part`} />
              <Indicator label="Buy-to-fly ratio" value={`${formatNumber(buyToFlyRatio(project), 2)}:1`} />
              <Indicator label="Waste intensity" value={`${formatNumber(intensities.wasteIntensity, 2)} kg B3/unit`} />
              <Indicator label="Water intensity" value={`${formatNumber(intensities.waterIntensity, 1)} L/unit`} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-700/50">
              Peringkat hotspot
            </p>
            <div className="mt-2">
              <Table>
                <THead>
                  <tr>
                    <Th>Proses</Th>
                    <Th className="w-28">Energy</Th>
                    <Th className="w-28">Water</Th>
                    <Th className="w-28">Chemical</Th>
                    <Th className="w-28">B3 Waste</Th>
                  </tr>
                </THead>
                <tbody>
                  {hotspotRows
                    .slice()
                    .sort((a, b) => b.energyPct + b.wastePct - (a.energyPct + a.wastePct))
                    .map((row) => (
                      <Tr key={row.stageId}>
                        <Td className="font-medium">{STAGE_BY_ID.get(row.stageId)?.name}</Td>
                        <Td>{formatPercent(row.energyPct)}</Td>
                        <Td>{formatPercent(row.waterPct)}</Td>
                        <Td>{formatPercent(row.chemicalPct)}</Td>
                        <Td>{formatPercent(row.wastePct)}</Td>
                      </Tr>
                    ))}
                </tbody>
              </Table>
            </div>
          </div>

          {activeLevers.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-700/50">
                Rekomendasi skenario terpilih
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-navy-900">
                {activeLevers.map((l) => (
                  <li key={l.id}>
                    {l.label} — target reduksi {formatPercent(l.reductionPct * 100, 0)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-navy-700/70">
                Estimasi penghematan biaya {formatRupiah(scenario.savings.costRp)} (
                {formatPercent(scenario.savings.costPct)}) dan pengurangan emisi{" "}
                {formatNumber(scenario.savings.ghgKgCO2e)} kg CO2e (
                {formatPercent(scenario.savings.ghgPct)}) per proses.
              </p>
            </div>
          )}

          <p className="text-[11px] text-navy-700/40">
            Water hotspot: {waterHotspot?.name} · Dibuat otomatis oleh AeroSphere LCA — Jan-Des 2026.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function Indicator({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-sand-200 bg-sand-50/60 p-3">
      <p className="text-[11px] text-navy-700/50">{label}</p>
      <p className="mt-0.5 font-semibold text-navy-900">{value}</p>
    </div>
  );
}
