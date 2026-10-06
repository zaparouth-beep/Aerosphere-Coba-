"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Input, Label } from "@/components/ui/Input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { useProjectStore } from "@/lib/store/useProjectStore";
import {
  computeCostBreakdown,
  COST_KEY_LABEL,
  type CostKey,
} from "@/lib/lca/calculations";
import { PROCESS_STAGES } from "@/lib/lca/constants";
import { formatNumber, formatRupiah } from "@/lib/utils/format";
import type { CostConfig } from "@/lib/lca/types";
import { AlertTriangle, Coins, Users } from "lucide-react";

const PRICE_FIELDS: Array<{ key: keyof CostConfig; label: string; unit: string }> = [
  { key: "energyPriceRpPerKwh", label: "Harga energi", unit: "Rp/kWh" },
  { key: "waterPriceRpPerL", label: "Harga air proses", unit: "Rp/L" },
  { key: "chemicalPriceRpPerKg", label: "Harga kimia & anoda", unit: "Rp/kg" },
  { key: "wwtpChemicalPriceRpPerKg", label: "Harga kimia WWTP", unit: "Rp/kg" },
  { key: "consumablePriceRpPerKg", label: "Harga consumable", unit: "Rp/kg" },
  { key: "wasteDisposalPriceRpPerKg", label: "Biaya olah limbah B3", unit: "Rp/kg" },
  { key: "wasteTransportPriceRpPerKm", label: "Biaya transport limbah", unit: "Rp/km" },
  { key: "laborCostRpPerPeriod", label: "Biaya tenaga kerja", unit: "Rp/proses" },
  { key: "processesPerMonth", label: "Jumlah proses per bulan", unit: "proses/bulan" },
];

const FU_LABEL = { m2_plated: "m²", part: "part", kg_metal_deposited: "kg logam" } as const;
const STAGE_COST_COLUMNS: CostKey[] = [
  "energy",
  "water",
  "chemical",
  "wwtp_chemical",
  "consumable",
  "waste_disposal",
  "waste_transport",
];

export default function AliranBiayaPage() {
  const project = useProjectStore((s) => s.project);
  const updateCostConfig = useProjectStore((s) => s.updateCostConfig);
  const cost = computeCostBreakdown(project);

  const fuDivisor = project.functionalUnit.value > 0 ? project.functionalUnit.value : 1;
  const stageRows = [...cost.byStage].sort((a, b) => b.totalRp - a.totalRp);
  const topStageId = stageRows[0]?.totalRp ? stageRows[0].stageId : null;

  const chartData = cost.items
    .filter((i) => i.totalRp > 0)
    .sort((a, b) => b.totalRp - a.totalRp)
    .map((i) => ({ label: i.label, value: i.totalRp }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Biaya aliran sumber daya" value={formatRupiah(cost.flowTotalRp)} icon={Coins} />
        <StatTile label="Tenaga kerja (di luar aliran)" value={formatRupiah(cost.laborRp)} icon={Users} />
        <StatTile label="Total biaya proses" value={formatRupiah(cost.totalRp)} />
        <StatTile
          label={`Total biaya / ${FU_LABEL[project.functionalUnit.type]}`}
          value={formatRupiah(cost.costPerFunctionalUnit)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Rincian Biaya Aliran per Kategori"
            subtitle="Kuantitas LCI × harga satuan, tanpa tenaga kerja"
          />
          <CardBody>
            <HorizontalBarChart
              data={chartData}
              categoryKey="label"
              valueKey="value"
              valueFormatter={(v) => formatRupiah(v)}
            />
            <p className="mt-3 text-xs leading-relaxed text-navy-700/60">
              Kategori = jenis aliran sumber daya yang dibiayai: energi, air, bahan kimia &amp; anoda, bahan kimia
              WWTP, consumable (dari LCI Input), serta pengolahan dan transport limbah B3 (dari Limbah B3).
              Tenaga kerja sengaja dipisah karena bukan aliran LCI dan tidak mengikuti tahap proses.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Tabel Biaya" subtitle="Biaya aliran dipisahkan dari tenaga kerja" />
          <CardBody>
            <Table>
              <THead>
                <tr>
                  <Th>Kategori</Th>
                  <Th className="w-32">Total (Rp)</Th>
                  <Th className="w-20">% Aliran</Th>
                  <Th className="w-32">Rp / {FU_LABEL[project.functionalUnit.type]}</Th>
                </tr>
              </THead>
              <tbody>
                {cost.items.map((item) => (
                  <Tr key={item.key}>
                    <Td>{item.label}</Td>
                    <Td>{formatRupiah(item.totalRp)}</Td>
                    <Td>{cost.flowTotalRp > 0 ? formatNumber((item.totalRp / cost.flowTotalRp) * 100) : 0}%</Td>
                    <Td>{formatRupiah(item.totalRp / fuDivisor)}</Td>
                  </Tr>
                ))}
                <Tr className="font-semibold">
                  <Td>Subtotal biaya aliran</Td>
                  <Td>{formatRupiah(cost.flowTotalRp)}</Td>
                  <Td>100%</Td>
                  <Td>{formatRupiah(cost.flowCostPerFunctionalUnit)}</Td>
                </Tr>
                <Tr>
                  <Td>Tenaga kerja (di luar aliran)</Td>
                  <Td>{formatRupiah(cost.laborRp)}</Td>
                  <Td>-</Td>
                  <Td>{formatRupiah(cost.laborRp / fuDivisor)}</Td>
                </Tr>
                <Tr className="font-semibold">
                  <Td>Total biaya proses</Td>
                  <Td>{formatRupiah(cost.totalRp)}</Td>
                  <Td>-</Td>
                  <Td>{formatRupiah(cost.costPerFunctionalUnit)}</Td>
                </Tr>
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Aliran Biaya per Tahap Proses"
          subtitle="Biaya input LCI (kuantitas × harga) + limbah B3 dialokasikan ke tahap sumbernya. Tenaga kerja tidak dialokasikan."
        />
        <CardBody>
          <Table>
            <THead>
              <tr>
                <Th>Tahap</Th>
                {STAGE_COST_COLUMNS.map((k) => (
                  <Th key={k}>{COST_KEY_LABEL[k]}</Th>
                ))}
                <Th>Total (Rp)</Th>
                <Th className="w-20">% Alokasi</Th>
                <Th>Rp / {FU_LABEL[project.functionalUnit.type]}</Th>
              </tr>
            </THead>
            <tbody>
              {stageRows.map((row) => {
                const stage = PROCESS_STAGES.find((st) => st.id === row.stageId);
                return (
                  <Tr key={row.stageId}>
                    <Td className="whitespace-nowrap font-medium" highlight={row.stageId === topStageId}>
                      {stage?.code}. {stage?.name}
                    </Td>
                    {STAGE_COST_COLUMNS.map((k) => (
                      <Td key={k} className="whitespace-nowrap text-xs">
                        {row.byKey[k] > 0 ? formatRupiah(row.byKey[k]) : "-"}
                      </Td>
                    ))}
                    <Td className="whitespace-nowrap font-semibold">{formatRupiah(row.totalRp)}</Td>
                    <Td>{formatNumber(row.pctOfAllocated)}%</Td>
                    <Td className="whitespace-nowrap">{formatRupiah(row.totalRp / fuDivisor)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-navy-700/60">
            Tenaga kerja {formatRupiah(cost.laborRp)} tidak dialokasikan ke tahap mana pun, jadi tidak ada di tabel ini
            maupun di grafik; ia hanya masuk Total biaya proses.
          </p>
        </CardBody>
      </Card>

      {cost.warnings.length > 0 && (
        <Card>
          <CardHeader title="Catatan Kualitas Data" subtitle="Perlu diperbaiki di Data Proses agar biaya akurat" />
          <CardBody>
            <ul className="space-y-1.5 text-xs text-navy-700">
              {cost.warnings.map((w) => (
                <li key={w} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-red" />
                  {w}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Konfigurasi Harga Satuan" subtitle="Isi dengan harga riil. Harga per item (Data Proses) diutamakan; harga kategori dipakai bila harga item kosong." />
        <CardBody className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {PRICE_FIELDS.map((field) => (
            <div key={field.key}>
              <Label>
                {field.label} ({field.unit})
              </Label>
              <Input
                type="number"
                min={0}
                value={project.costConfig[field.key] ?? (field.key === "processesPerMonth" ? 1 : 0)}
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
