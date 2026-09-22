"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { METRIC_COLORS } from "@/components/charts/palette";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { STAGE_BY_ID } from "@/lib/lca/constants";
import { computeHotspotTable, computeIntensities, findHotspotStage } from "@/lib/lca/calculations";
import { formatNumber, formatPercent } from "@/lib/utils/format";

const FORMULAS = [
  { key: "energyPct" as const, label: "Energy Intensity (EI)", formula: "Energy Consumption / m² plated", unit: "kWh/m²" },
  { key: "waterPct" as const, label: "Water Intensity (WI)", formula: "Water Consumption / m² plated", unit: "L/m²" },
  { key: "chemicalPct" as const, label: "Chemical Intensity (CI)", formula: "Chemical Input / m² plated", unit: "kg/m²" },
  { key: "wastePct" as const, label: "Waste Intensity (WIwaste)", formula: "Hazardous Waste / m² plated", unit: "kg B3/m²" },
];

const INTENSITY_KEY: Record<(typeof FORMULAS)[number]["key"], keyof ReturnType<typeof computeIntensities>> = {
  energyPct: "energyIntensity",
  waterPct: "waterIntensity",
  chemicalPct: "chemicalIntensity",
  wastePct: "wasteIntensity",
};

export default function HotspotPage() {
  const project = useProjectStore((s) => s.project);
  const rows = computeHotspotTable(project);
  const intensities = computeIntensities(project);

  const chartData = rows.map((row) => ({
    stage: `${STAGE_BY_ID.get(row.stageId)?.code}`,
    Energy: Number(row.energyPct.toFixed(1)),
    Water: Number(row.waterPct.toFixed(1)),
    Chemical: Number(row.chemicalPct.toFixed(1)),
    "B3 Waste": Number(row.wastePct.toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {FORMULAS.map((f) => (
          <Card key={f.key}>
            <CardBody>
              <p className="text-xs font-semibold text-navy-900">{f.label}</p>
              <p className="mt-1 font-mono text-[11px] text-navy-700/60">{f.formula}</p>
              <p className="mt-3 text-2xl font-semibold text-navy-900">
                {formatNumber(intensities[INTENSITY_KEY[f.key]], 2)}
                <span className="ml-1 text-sm font-normal text-navy-700/50">{f.unit}</span>
              </p>
              <p className="mt-1 text-[11px] text-navy-700/50">
                Hotspot:{" "}
                <span className="font-medium text-accent-red">
                  {STAGE_BY_ID.get(findHotspotStage(rows, f.key) ?? "main_plating")?.name ?? "-"}
                </span>
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Peringkat Hotspot per Tahap"
          subtitle="Kontribusi % tiap tahap terhadap total Energy / Water / Chemical / B3 Waste"
        />
        <CardBody>
          <GroupedBarChart
            data={chartData}
            categoryKey="stage"
            valueSuffix="%"
            series={[
              { key: "Energy", label: "Energy", color: METRIC_COLORS.energy },
              { key: "Water", label: "Water", color: METRIC_COLORS.water },
              { key: "Chemical", label: "Chemical", color: METRIC_COLORS.chemical },
              { key: "B3 Waste", label: "B3 Waste", color: METRIC_COLORS.waste },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tabel Hotspot" />
        <CardBody>
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
              {rows.map((row) => {
                const stage = STAGE_BY_ID.get(row.stageId)!;
                return (
                  <Tr key={row.stageId}>
                    <Td className="font-medium">
                      {stage.code}. {stage.name}
                    </Td>
                    <Td highlight={findHotspotStage(rows, "energyPct") === row.stageId}>
                      {formatPercent(row.energyPct)}
                    </Td>
                    <Td highlight={findHotspotStage(rows, "waterPct") === row.stageId}>
                      {formatPercent(row.waterPct)}
                    </Td>
                    <Td highlight={findHotspotStage(rows, "chemicalPct") === row.stageId}>
                      {formatPercent(row.chemicalPct)}
                    </Td>
                    <Td highlight={findHotspotStage(rows, "wastePct") === row.stageId}>
                      {formatPercent(row.wastePct)}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <div className="mt-4 space-y-1 text-xs text-navy-700/70">
            {FORMULAS.map((f) => {
              const stageId = findHotspotStage(rows, f.key);
              if (!stageId) return null;
              return (
                <p key={f.key}>
                  🔴 <strong>{f.label.split(" ")[0]} hotspot</strong> →{" "}
                  {STAGE_BY_ID.get(stageId)?.name}
                </p>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
