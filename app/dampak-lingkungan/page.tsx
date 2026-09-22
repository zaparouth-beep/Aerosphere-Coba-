"use client";

import { AlertTriangle, Cloud, Droplets, Recycle, Zap } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { computeEnvironmentalImpact, EMISSION_FACTORS } from "@/lib/lca/calculations";
import { formatNumber } from "@/lib/utils/format";

export default function DampakLingkunganPage() {
  const project = useProjectStore((s) => s.project);
  const impact = computeEnvironmentalImpact(project);

  const ghgChartData = [
    { label: "Energi (listrik)", value: impact.ghgFromEnergyKgCO2e },
    { label: "Bahan kimia", value: impact.ghgFromChemicalKgCO2e },
    { label: "Air proses", value: impact.ghgFromWaterKgCO2e },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Total energi" value={formatNumber(impact.totalEnergyKwh)} unit="kWh" icon={Zap} />
        <StatTile label="Total air" value={formatNumber(impact.totalWaterL)} unit="L" icon={Droplets} />
        <StatTile label="Total limbah B3" value={formatNumber(impact.totalWasteKgB3)} unit="kg" icon={Recycle} tone="warning" />
        <StatTile label="Emisi udara" value={formatNumber(impact.totalAirEmissionKg)} unit="kg" icon={Cloud} />
        <StatTile label="Estimasi GHG" value={formatNumber(impact.totalGhgKgCO2e)} unit="kg CO2e" icon={AlertTriangle} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Estimasi GHG per Sumber"
            subtitle="Perkiraan kasar — bukan hasil LCIA penuh"
          />
          <CardBody>
            <HorizontalBarChart
              data={ghgChartData}
              categoryKey="label"
              valueKey="value"
              valueFormatter={(v) => `${formatNumber(v)} kg CO2e`}
            />
            <p className="mt-3 rounded-lg bg-sand-100 p-3 text-[11px] leading-relaxed text-navy-700/60">
              Faktor emisi yang digunakan: listrik grid {EMISSION_FACTORS.gridElectricityKgCO2ePerKwh}{" "}
              kg CO2e/kWh, bahan kimia generik {EMISSION_FACTORS.chemicalGenericKgCO2ePerKg} kg
              CO2e/kg, pengolahan air {EMISSION_FACTORS.waterTreatmentKgCO2ePerL} kg CO2e/L. Ganti
              dengan database LCIA terverifikasi (mis. ecoinvent) sebelum digunakan untuk pelaporan resmi.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Emisi Udara" subtitle="Parameter yang relevan untuk proses plating" />
          <CardBody>
            <Table>
              <THead>
                <tr>
                  <Th>Parameter</Th>
                  <Th>Berlaku</Th>
                  <Th className="w-32">kg/periode</Th>
                </tr>
              </THead>
              <tbody>
                {project.airEmissions.map((e) => (
                  <Tr key={e.id}>
                    <Td>{e.parameter}</Td>
                    <Td>
                      <Badge tone={e.applicable ? "green" : "neutral"}>
                        {e.applicable ? "Ya" : "Tidak"}
                      </Badge>
                    </Td>
                    <Td>{e.applicable ? formatNumber(e.valueKgPerPeriod, 2) : "-"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Efluen Air (WWTP outlet)" subtitle="Parameter kualitas air limbah hasil olahan" />
        <CardBody>
          <Table>
            <THead>
              <tr>
                <Th>Parameter</Th>
                <Th className="w-24">Unit</Th>
                <Th className="w-32">Nilai</Th>
              </tr>
            </THead>
            <tbody>
              {project.waterEffluent.map((e) => (
                <Tr key={e.id}>
                  <Td>{e.parameter}</Td>
                  <Td className="text-xs text-navy-700/60">{e.unit}</Td>
                  <Td>{formatNumber(e.value, 2)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
