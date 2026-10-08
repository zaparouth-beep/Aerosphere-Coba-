"use client";

import { CloudFog, Coins, Droplets, Recycle } from "lucide-react";
import { BarList } from "@/components/charts/Charts";
import { STAGE_COLOR } from "@/components/charts/palette";
import { KpiCard } from "@/components/ui/KpiCard";
import { statusFromChange } from "@/components/ui/Status";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import type { Project } from "@/lib/domain/types";
import type { Results } from "@/lib/engine/calculate";
import { fmt, fmtDelta, fmtRp, fmtRpShort } from "@/lib/utils/format";
import { stageValues, type Action, type Headline, type WorstStage } from "@/lib/view/summary";

const ICON = { cc: CloudFog, water: Droplets, waste: Recycle, cost: Coins } as const;

export function formatHeadline(h: Headline): string {
  if (h.key === "cost") return fmtRpShort(h.value);
  return fmt(h.value, h.value < 10 ? 2 : 1);
}

/** Four headline numbers with status word, comparison and meaning (PRD v1.1 §3.0.4). */
export function HeadlineCards({ heads, compareLabel, hrefs }: { heads: Headline[]; compareLabel?: string; hrefs?: Partial<Record<Headline["key"], string>> }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {heads.map((h) => (
        <KpiCard
          key={h.key}
          label={h.label}
          icon={ICON[h.key]}
          value={formatHeadline(h)}
          unit={h.unit}
          info={h.glossary}
          status={h.changePct === null ? undefined : statusFromChange(h.changePct)}
          href={hrefs?.[h.key]}
          hint={
            h.changePct !== null ? (
              <>
                {fmtDelta(h.changePct)} vs {compareLabel ?? "pembanding"}
              </>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}

/** One bar per stage for the worst indicator, with stage names (not codes). */
export function WorstStageBars({ project, results, worst }: { project: Project; results: Results; worst: WorstStage }) {
  const items = stageValues(project, results, worst.key).map((s) => ({
    label: s.name,
    value: s.value,
    color: s.stageId === worst.stageId ? STAGE_COLOR[s.stageId] : "#c9ccd3",
  }));
  const unit = worst.key === "cc" ? " kg CO₂e" : worst.key === "water" ? " L" : worst.key === "waste" ? " kg" : "";
  return <BarList items={items} format={(v) => (worst.key === "cost" ? fmtRpShort(v) : `${fmt(v, 2)}${unit}`)} />;
}

export function ActionsTable({ actions }: { actions: Action[] }) {
  if (!actions.length) return <p className="py-4 text-xs text-navy-700/60">Belum ada perbaikan yang menghemat biaya atau jejak karbon. Coba di menu Simulasi Perbaikan.</p>;
  return (
    <>
    <Table caption="Perbaikan yang disarankan">
      <THead>
        <tr>
          <Th>Perbaikan</Th>
          <Th align="right">Hemat per tahun</Th>
          <Th align="right">Jejak karbon</Th>
          <Th>Usaha</Th>
          <Th>Waktu</Th>
        </tr>
      </THead>
      <tbody>
        {actions.map((a) => (
          <Tr key={a.id}>
            <Td>
              <span className="font-medium text-navy-900">{a.action}</span>
              <span className="block text-[11px] text-navy-700/60">{a.description}</span>
            </Td>
            <Td align="right" className="num">
              {fmtRp(a.savingRpYear)}
            </Td>
            <Td align="right" className="num">
              {fmtDelta(a.ccPct)}
            </Td>
            <Td className="capitalize">{a.effort}</Td>
            <Td>{a.timeline}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
    <p className="mt-2 text-[11px] text-navy-700/60">Hemat per tahun = selisih biaya proses sebelum dan sesudah perbaikan, belum dikurangi biaya investasi.</p>
    </>
  );
}
