"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { GroupedBarChart } from "@/components/charts/GroupedBarChart";
import { CATEGORICAL_PALETTE, CHART_CHROME } from "@/components/charts/palette";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { compareScenario } from "@/lib/lca/whatif";
import { formatNumber, formatPercent, formatRupiah } from "@/lib/utils/format";

export default function WhatIfPage() {
  const project = useProjectStore((s) => s.project);
  const activeLeverIds = useProjectStore((s) => s.activeLeverIds);
  const toggleLever = useProjectStore((s) => s.toggleLever);
  const updateLeverReductionPct = useProjectStore((s) => s.updateLeverReductionPct);

  const activeLevers = project.whatIfLevers.filter((l) => activeLeverIds.includes(l.id));
  const comparison = compareScenario(project, activeLevers);

  const chartData = [
    {
      metric: "Energi",
      Sebelum: Number((comparison.before.intensities.energyIntensity * project.functionalUnit.value).toFixed(1)),
      Sesudah: Number((comparison.after.intensities.energyIntensity * project.functionalUnit.value).toFixed(1)),
    },
    {
      metric: "Air",
      Sebelum: Number((comparison.before.intensities.waterIntensity * project.functionalUnit.value).toFixed(0)),
      Sesudah: Number((comparison.after.intensities.waterIntensity * project.functionalUnit.value).toFixed(0)),
    },
    {
      metric: "Kimia",
      Sebelum: Number((comparison.before.intensities.chemicalIntensity * project.functionalUnit.value).toFixed(1)),
      Sesudah: Number((comparison.after.intensities.chemicalIntensity * project.functionalUnit.value).toFixed(1)),
    },
    {
      metric: "Limbah B3",
      Sebelum: Number((comparison.before.intensities.wasteIntensity * project.functionalUnit.value).toFixed(1)),
      Sesudah: Number((comparison.after.intensities.wasteIntensity * project.functionalUnit.value).toFixed(1)),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Skenario What-if"
          subtitle="Aktifkan satu atau beberapa lever untuk mensimulasikan dampaknya terhadap proses"
        />
        <CardBody className="space-y-3">
          {project.whatIfLevers.map((lever) => {
            const active = activeLeverIds.includes(lever.id);
            return (
              <div
                key={lever.id}
                className={`rounded-xl border p-4 transition-colors ${
                  active ? "border-navy-700 bg-navy-900/5" : "border-sand-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-navy-900">{lever.label}</p>
                      {active && <Badge tone="green">Aktif</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-navy-700/60">{lever.description}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={0.6}
                        step={0.05}
                        value={lever.reductionPct}
                        onChange={(e) => updateLeverReductionPct(lever.id, Number(e.target.value))}
                        className="w-48 accent-navy-900"
                      />
                      <span className="text-xs font-medium text-navy-900">
                        Target reduksi: {formatPercent(lever.reductionPct * 100, 0)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    onClick={() => toggleLever(lever.id)}
                    className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
                      active ? "bg-navy-900" : "bg-sand-200"
                    }`}
                  >
                    <span
                      className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                        active ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sebelum vs Sesudah" subtitle="Total flow per proses pada functional unit saat ini" />
          <CardBody>
            <GroupedBarChart
              data={chartData}
              categoryKey="metric"
              series={[
                { key: "Sebelum", label: "Sebelum", color: CHART_CHROME.axis },
                { key: "Sesudah", label: "Sesudah", color: CATEGORICAL_PALETTE[0] },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Proyeksi Penghematan" />
          <CardBody className="space-y-3">
            <SavingRow label="Water saving" value={comparison.savings.waterL} pct={comparison.savings.waterPct} unit="L" />
            <SavingRow label="Energy saving" value={comparison.savings.energyKwh} pct={comparison.savings.energyPct} unit="kWh" />
            <SavingRow
              label="Chemical loss reduction"
              value={comparison.savings.chemicalKg}
              pct={comparison.savings.chemicalPct}
              unit="kg"
            />
            <SavingRow
              label="Sludge / B3 waste reduction"
              value={comparison.savings.wasteKgB3}
              pct={comparison.savings.wastePct}
              unit="kg"
            />
            <SavingRow
              label="Estimasi CO2e reduction"
              value={comparison.savings.ghgKgCO2e}
              pct={comparison.savings.ghgPct}
              unit="kg CO2e"
            />
            <div className="mt-2 rounded-xl bg-navy-900 p-4 text-white">
              <p className="text-xs text-white/60">Operating cost reduction</p>
              <p className="mt-1 text-xl font-semibold">{formatRupiah(comparison.savings.costRp)}</p>
              <p className="text-xs text-white/60">
                ({formatPercent(comparison.savings.costPct)} dari biaya aliran sumber daya saat ini)
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="text-xs leading-relaxed text-navy-700/60">
          <strong>Rantai hubungan AeroSphere:</strong> material/chemical efficiency → water → wastewater
          → B3 sludge → cost → environmental impact. AeroSphere tidak berhenti pada satu angka
          ringkasan (mis. &quot;WWTP menghasilkan 60% waste&quot;) — setiap lever di atas ditelusuri
          hingga estimasi penghematan biaya dan emisi.
        </CardBody>
      </Card>
    </div>
  );
}

function SavingRow({
  label,
  value,
  pct,
  unit,
}: {
  label: string;
  value: number;
  pct: number;
  unit: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-sand-100 pb-2 text-sm">
      <span className="text-navy-700/70">{label}</span>
      <span className="font-medium text-navy-900">
        {formatNumber(value, 1)} {unit}{" "}
        <span className="text-xs text-accent-green">({formatPercent(pct)})</span>
      </span>
    </div>
  );
}
