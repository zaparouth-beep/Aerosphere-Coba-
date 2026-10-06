"use client";

import Link from "next/link";
import {
  Beaker,
  Droplets,
  Factory,
  Gauge,
  Recycle,
  Zap,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { useProjectStore } from "@/lib/store/useProjectStore";
import {
  buyToFlyRatio,
  computeCostBreakdown,
  computeEnvironmentalImpact,
  computeIntensities,
  scrapMassKg,
} from "@/lib/lca/calculations";
import { formatNumber, formatRupiah } from "@/lib/utils/format";
import { NAV_ITEMS } from "@/components/layout/nav";

const FU_LABEL: Record<string, string> = {
  m2_plated: "m² ter-plating",
  part: "part",
  kg_metal_deposited: "kg logam terdeposit",
};

export default function OverviewPage() {
  const project = useProjectStore((s) => s.project);
  const intensities = computeIntensities(project);
  const impact = computeEnvironmentalImpact(project);
  const cost = computeCostBreakdown(project);
  const fuLabel = FU_LABEL[project.functionalUnit.type];

  const quickLinks = NAV_ITEMS.filter((n) =>
    ["/data-proses", "/hotspot", "/what-if", "/laporan"].includes(n.href),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-accent-gold">
              Life Cycle Assessment — Proses Plating
            </p>
            <h2 className="mt-1 text-xl font-semibold text-navy-900">{project.name}</h2>
            <p className="mt-1 max-w-2xl text-sm text-navy-700/70">
              Analisis LCI/LCIA untuk proses electroplating pada {project.part.partName} (
              {project.part.material}) di {project.facility}, mengikuti standar ISO 14040 & ISO
              14044. Fungsional unit: {formatNumber(project.functionalUnit.value)} {fuLabel}.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-navy-700/70 md:text-right">
            <div>
              <p className="text-navy-700/50">Klien</p>
              <p className="font-medium text-navy-900">{project.client}</p>
            </div>
            <div>
              <p className="text-navy-700/50">Periode</p>
              <p className="font-medium text-navy-900">{project.period}</p>
            </div>
            <div>
              <p className="text-navy-700/50">Volume tahunan</p>
              <p className="font-medium text-navy-900">
                {formatNumber(project.part.annualVolumeParts, 0)} part
              </p>
            </div>
            <div>
              <p className="text-navy-700/50">Buy-to-fly ratio</p>
              <p className="font-medium text-navy-900">{formatNumber(buyToFlyRatio(project), 2)}:1</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Energy Intensity"
          value={formatNumber(intensities.energyIntensity, 2)}
          unit={`kWh/${fuLabel}`}
          icon={Zap}
        />
        <StatTile
          label="Water Intensity"
          value={formatNumber(intensities.waterIntensity, 1)}
          unit={`L/${fuLabel}`}
          icon={Droplets}
        />
        <StatTile
          label="Chemical Intensity"
          value={formatNumber(intensities.chemicalIntensity, 2)}
          unit={`kg/${fuLabel}`}
          icon={Beaker}
        />
        <StatTile
          label="Waste Intensity"
          value={formatNumber(intensities.wasteIntensity, 2)}
          unit={`kg B3/${fuLabel}`}
          icon={Recycle}
          tone="warning"
        />
        <StatTile
          label="Estimasi GHG"
          value={formatNumber(impact.ghgPerFunctionalUnit, 2)}
          unit={`kg CO2e/${fuLabel}`}
          icon={Gauge}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Neraca Massa & Biaya" subtitle="Ringkasan proses berjalan" />
          <CardBody className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <SummaryStat label="Massa stok awal" value={`${formatNumber(project.part.initialStockMassKg)} kg`} />
            <SummaryStat label="Massa produk jadi" value={`${formatNumber(project.part.finishedMassKg)} kg`} />
            <SummaryStat label="Scrap" value={`${formatNumber(scrapMassKg(project))} kg`} />
            <SummaryStat label="Total biaya proses" value={formatRupiah(cost.totalRp)} />
            <SummaryStat
              label={`Biaya / ${fuLabel}`}
              value={formatRupiah(cost.costPerFunctionalUnit)}
            />
            <SummaryStat
              label="Total limbah B3"
              value={`${formatNumber(impact.totalWasteKgB3)} kg/proses`}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Navigasi Cepat" />
          <CardBody className="space-y-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-lg border border-sand-200 px-3 py-2.5 text-sm text-navy-900 transition-colors hover:border-navy-700 hover:bg-sand-50"
              >
                <link.icon className="h-4 w-4 text-navy-700/60" />
                {link.label}
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Tentang AeroSphere LCA"
          subtitle="Cakupan modul saat ini: proses plating (electroplating)"
        />
        <CardBody className="space-y-2 text-sm text-navy-700/80">
          <p className="flex items-start gap-2">
            <Factory className="mt-0.5 h-4 w-4 shrink-0 text-navy-700/50" />
            Peta proses plating terdiri dari 6 tahap: Pre-treatment → Aktivasi/Strike → Plating
            Utama → Pasca-treatment → Utilitas Lini → IPAL (WWTP). Setiap tahap memiliki data
            pedigree (sumber, tipe data, ketidakpastian, tingkat kepercayaan) untuk setiap input LCI.
          </p>
          <p>
            Gunakan menu <strong>Data Proses</strong> untuk mengisi/mengubah inventori (LCI),
            <strong> Hotspot</strong> untuk melihat tahap mana yang paling berkontribusi terhadap
            energi/air/kimia/limbah B3, dan <strong>What-if</strong> untuk mensimulasikan skenario
            perbaikan sebelum dituangkan ke <strong>Laporan</strong>.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-navy-700/50">{label}</p>
      <p className="mt-0.5 font-semibold text-navy-900">{value}</p>
    </div>
  );
}
