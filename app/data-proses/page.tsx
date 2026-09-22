"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { ProcessStageMap } from "@/components/data-proses/ProcessStageMap";
import { LCIInputTable } from "@/components/data-proses/LCIInputTable";
import { AirEmissionTable } from "@/components/data-proses/AirEmissionTable";
import { WaterEffluentTable } from "@/components/data-proses/WaterEffluentTable";
import { HazardousWasteTable } from "@/components/data-proses/HazardousWasteTable";

const TABS = [
  { id: "input", label: "LCI Input (30 parameter)" },
  { id: "air", label: "Output — Emisi Udara" },
  { id: "water", label: "Output — Efluen Air" },
  { id: "waste", label: "Output — Limbah B3" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DataProsesPage() {
  const [tab, setTab] = useState<TabId>("input");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Peta Proses Plating"
          subtitle="Urutan proses dari penerimaan part s/d part finishing (keluar line)"
        />
        <CardBody>
          <ProcessStageMap />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Life Cycle Inventory (LCI)"
          subtitle="Goal & Scope → Peta Proses → LCI Input → LCI Output → Energi & Utilitas → Neraca & Kualitas"
        />
        <div className="flex flex-wrap gap-1 border-b border-sand-200 px-5 pt-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-t-lg px-3 py-2 text-xs font-medium transition-colors",
                tab === t.id
                  ? "border-b-2 border-navy-900 text-navy-900"
                  : "text-navy-700/50 hover:text-navy-900",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <CardBody>
          {tab === "input" && <LCIInputTable />}
          {tab === "air" && <AirEmissionTable />}
          {tab === "water" && <WaterEffluentTable />}
          {tab === "waste" && <HazardousWasteTable />}
        </CardBody>
      </Card>
    </div>
  );
}
