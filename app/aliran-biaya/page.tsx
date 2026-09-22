"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Input, Label } from "@/components/ui/Input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { computeCostBreakdown, CHEMICAL_LIKE_CATEGORIES, totalQuantity } from "@/lib/lca/calculations";
import { formatNumber, formatRupiah } from "@/lib/utils/format";
import type { CostConfig } from "@/lib/lca/types";
import { Coins } from "lucide-react";

const PRICE_FIELDS: Array<{ key: keyof CostConfig; label: string; unit: string }> = [
  { key: "energyPriceRpPerKwh", label: "Harga energi", unit: "Rp/kWh" },
  { key: "waterPriceRpPerL", label: "Harga air proses", unit: "Rp/L" },
  { key: "chemicalPriceRpPerKg", label: "Harga kimia & anoda", unit: "Rp/kg" },
  { key: "wwtpChemicalPriceRpPerKg", label: "Harga kimia WWTP", unit: "Rp/kg" },
  { key: "consumablePriceRpPerKg", label: "Harga consumable", unit: "Rp/kg" },
  { key: "wasteDisposalPriceRpPerKg", label: "Biaya olah limbah B3", unit: "Rp/kg" },
  { key: "wasteTransportPriceRpPerKm", label: "Biaya transport limbah", unit: "Rp/km" },
  { key: "laborCostRpPerPeriod", label: "Biaya tenaga kerja", unit: "Rp/periode" },
];

export default function AliranBiayaPage() {
  const project = useProjectStore((s) => s.project);
  const updateCostConfig = useProjectStore((s) => s.updateCostConfig);
  const cost = computeCostBreakdown(project);

  const totalEnergy = totalQuantity(project.lciInputs, ["Energy"]);
  const totalWater = totalQuantity(project.lciInputs, ["Water"]);
  const totalChemical = totalQuantity(project.lciInputs, CHEMICAL_LIKE_CATEGORIES);

  const chartData = cost.items
    .filter((i) => i.totalRp > 0)
    .sort((a, b) => b.totalRp - a.totalRp)
    .map((i) => ({ label: i.label, value: i.totalRp }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total biaya proses" value={formatRupiah(cost.totalRp)} icon={Coins} />
        <StatTile
          label={`Biaya / ${project.functionalUnit.type === "m2_plated" ? "m²" : "unit"}`}
          value={formatRupiah(cost.costPerFunctionalUnit)}
        />
        <StatTile label="Total energi" value={formatNumber(totalEnergy)} unit="kWh/periode" />
        <StatTile label="Total air" value={formatNumber(totalWater)} unit="L/periode" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Rincian Biaya per Kategori" subtitle="Dihitung dari kuantitas LCI × harga satuan" />
          <CardBody>
            <HorizontalBarChart
              data={chartData}
              categoryKey="label"
              valueKey="value"
              valueFormatter={(v) => formatRupiah(v)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tabel Biaya" />
          <CardBody>
            <Table>
              <THead>
                <tr>
                  <Th>Kategori</Th>
                  <Th className="w-32">Total (Rp)</Th>
                  <Th className="w-20">% Total</Th>
                </tr>
              </THead>
              <tbody>
                {cost.items.map((item) => (
                  <Tr key={item.key}>
                    <Td>{item.label}</Td>
                    <Td>{formatRupiah(item.totalRp)}</Td>
                    <Td>{cost.totalRp > 0 ? formatNumber((item.totalRp / cost.totalRp) * 100) : 0}%</Td>
                  </Tr>
                ))}
                <Tr className="font-semibold">
                  <Td>Total</Td>
                  <Td>{formatRupiah(cost.totalRp)}</Td>
                  <Td>100%</Td>
                </Tr>
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Konfigurasi Harga Satuan" subtitle="Ubah asumsi harga untuk menyesuaikan dengan kondisi aktual" />
        <CardBody className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {PRICE_FIELDS.map((field) => (
            <div key={field.key}>
              <Label>
                {field.label} ({field.unit})
              </Label>
              <Input
                type="number"
                min={0}
                value={project.costConfig[field.key]}
                onChange={(e) =>
                  updateCostConfig({ [field.key]: Number(e.target.value) } as Partial<CostConfig>)
                }
              />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
