"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ArrowRight, Flame, Lightbulb, MapPin, Search } from "lucide-react";
import { BarList, Heatmap, ParetoChart } from "@/components/charts/Charts";
import { STAGE_COLOR } from "@/components/charts/palette";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Select } from "@/components/ui/Input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import type { LeverSettings, StageId } from "@/lib/domain/types";
import { OPERATIONAL_METRICS, pareto, type HotspotMetric, type HotspotWeights } from "@/lib/engine/hotspot";
import { STAGE_IDS } from "@/lib/engine/lci";
import { CATEGORY_BY_ID } from "@/lib/engine/method";
import { LEVERS } from "@/lib/engine/scenario";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults } from "@/lib/store/useResults";
import { stageLabel } from "@/lib/view/helpers";
import { fmt, fmtRp, fmtSig } from "@/lib/utils/format";

/** Levers relevant to a hotspot metric, with sensible starting parameters. */
const LEVER_FOR: Record<string, Array<{ label: string; levers: LeverSettings }>> = {
  energy: [
    { label: "Optimasi rectifier 75% → 88%", levers: { rectifier: { etaOld: 75, etaNew: 88 } } },
    { label: "Tutup & insulasi tangki (−20% panas)", levers: { tankCover: { heatReductionPct: 20, mistReductionPct: 10 } } },
  ],
  water: [{ label: "Bilas counter-flow 2 → 3 tingkat", levers: { countercurrent: { stagesOld: 2, stagesNew: 3, ratio: 1000 } } }],
  chemical: [
    { label: "Kurangi drag-out 20%", levers: { dragout: { reductionPct: 20 } } },
    { label: "Turunkan konsentrasi bath 55 → 47,5 g/L", levers: { bathConcentration: { cOld: 55, cNew: 47.5 } } },
  ],
  waste: [{ label: "Kurangi drag-out 20% (lumpur IPAL turun)", levers: { dragout: { reductionPct: 20 } } }],
  costLoss: [{ label: "Kurangi drag-out 20%", levers: { dragout: { reductionPct: 20 } } }],
  cc: [
    { label: "Grid lebih bersih (0,5 kg CO₂e/kWh)", levers: { gridFactor: { kgCO2ePerKwh: 0.5 } } },
    { label: "Optimasi rectifier 75% → 88%", levers: { rectifier: { etaOld: 75, etaNew: 88 } } },
  ],
};

export default function HotspotPage() {
  return (
    <Suspense>
      <Hotspot />
    </Suspense>
  );
}

function Hotspot() {
  const search = useSearchParams();
  const router = useRouter();
  const { project, results } = useActiveResults();
  const ui = useAppStore((s) => s.ui);
  const setUi = useAppStore((s) => s.setUi);
  const updateStageScores = useAppStore((s) => s.updateStageScores);
  const createScenarioFrom = useAppStore((s) => s.createScenarioFrom);
  const h = results.hotspot;

  const metricLabel = (m: HotspotMetric) => OPERATIONAL_METRICS.find((o) => o.id === m)?.label ?? CATEGORY_BY_ID.get(m as never)?.short ?? m;
  const [sel, setSel] = useState<{ row: string; col: string } | null>(() => {
    const m = search.get("metric");
    const s = search.get("stage");
    return m && s ? { row: s, col: m } : { row: h.priority[0]?.stageId ?? "C", col: "energy" };
  });
  const metric = (sel?.col ?? "energy") as HotspotMetric;
  const stage = (sel?.row ?? "C") as StageId;

  const paretoItems = useMemo(() => {
    if (metric === "costLoss") return results.mfca.lines.map((l) => ({ name: l.name, stageId: l.stageId, value: l.costRp }));
    if (["energy", "water", "chemical", "waste"].includes(metric)) {
      const match = (cat: string, kind: string) =>
        metric === "energy" ? cat === "Energy" : metric === "water" ? cat === "Water" : metric === "waste" ? kind === "waste" : ["Chemical", "Anode", "WWTPChemical", "Consumable"].includes(cat) && kind === "input";
      return results.lci.flows.filter((f) => f.inBoundary && match(f.category, f.kind)).map((f) => ({ name: f.name, stageId: f.stageId, value: f.quantity }));
    }
    return results.lcia.contributions.map((c) => ({ name: c.name, stageId: c.stageId, value: c.values[metric as keyof typeof c.values] }));
  }, [metric, results]);
  const paretoRows = pareto(paretoItems).slice(0, 15);
  const why = pareto(paretoItems.filter((i) => i.stageId === stage)).slice(0, 5);
  const levers = LEVER_FOR[metric] ?? LEVER_FOR.cc!;
  const weights = ui.hotspotWeights;
  const setWeight = (k: keyof HotspotWeights, v: number) => setUi({ hotspotWeights: { ...weights, [k]: v } });
  const costLoss = (s: StageId) => results.mfca.stages.find((x) => x.stageId === s)?.costLossRp ?? 0;
  const stageInfo = project.stages.find((s) => s.id === stage);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          eyebrow="M08 · FR-08.1–08.2"
          title="Peta hotspot — tahap × indikator"
          subtitle={`Sel = % kontribusi tahap; garis tebal = hotspot (≥ ${ui.hotspotThreshold}%). Klik sel untuk drill-down.`}
          action={
            <label className="flex items-center gap-2 text-xs text-navy-800">
              Ambang
              <input type="range" min={10} max={60} step={5} value={ui.hotspotThreshold} onChange={(e) => setUi({ hotspotThreshold: Number(e.target.value) })} aria-label="Ambang hotspot" />
              <span className="num w-8 font-medium">{ui.hotspotThreshold}%</span>
            </label>
          }
        />
        <CardBody>
          <Heatmap
            rows={STAGE_IDS.map((s) => ({ id: s, label: stageLabel(project, s) }))}
            columns={h.metrics.map((m) => ({ id: m, label: metricLabel(m) }))}
            value={(r, c) => h.share[r as StageId][c as HotspotMetric]}
            threshold={ui.hotspotThreshold}
            selected={sel}
            onCellClick={(row, col) => setSel({ row, col })}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader eyebrow="Drill-down" title={`${stageLabel(project, stage)} · ${metricLabel(metric)}`} subtitle={`Kontribusi ${fmt(h.share[stage][metric] ?? 0, 1)}% · WHY → WHERE → WHAT IF`} />
        <CardBody className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-sand-200 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-navy-900">
              <Search className="h-3.5 w-3.5 text-brand-teal" /> WHY — kontributor
            </p>
            <BarList items={why.map((w) => ({ label: w.name, value: w.value, color: STAGE_COLOR[w.stageId], note: `${fmt(w.sharePct, 0)}%` }))} format={(n) => (metric === "costLoss" ? fmtRp(n) : fmtSig(n))} emptyText="Tidak ada aliran pada tahap ini." />
          </div>
          <div className="rounded-lg border border-sand-200 p-4 text-xs">
            <p className="mb-2 flex items-center gap-1.5 font-semibold text-navy-900">
              <MapPin className="h-3.5 w-3.5 text-brand-teal" /> WHERE — tahap & sub-proses
            </p>
            <p className="text-navy-800">{stageInfo?.functionDesc}</p>
            <ul className="mt-2 flex flex-wrap gap-1">
              {stageInfo?.subprocesses.map((sp) => (
                <li key={sp}>
                  <Badge>{sp}</Badge>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1">
              {OPERATIONAL_METRICS.filter((m) => m.id !== "costLoss").map((m) => (
                <div key={m.id} className="flex justify-between">
                  <dt className="text-navy-700/70">{m.label}</dt>
                  <dd className="num">{fmt(h.share[stage][m.id] ?? 0, 1)}%</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-sand-200 pt-1">
                <dt className="text-navy-700/70">Cost loss</dt>
                <dd className="num font-medium">{fmtRp(costLoss(stage))}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-lg border border-brand-teal/30 bg-brand-teal/5 p-4 text-xs">
            <p className="mb-2 flex items-center gap-1.5 font-semibold text-navy-900">
              <Lightbulb className="h-3.5 w-3.5 text-brand-gold" /> WHAT IF — lever relevan
            </p>
            <ul className="space-y-2">
              {levers.map((lv) => (
                <li key={lv.label} className="rounded-md bg-white p-2.5">
                  <p className="font-medium text-navy-900">{lv.label}</p>
                  <p className="text-[11px] text-navy-700/65">{LEVERS.find((x) => x.id === Object.keys(lv.levers)[0])?.affects}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => {
                      if (createScenarioFrom(lv.label, lv.levers, `Dari hotspot ${stageLabel(project, stage)} · ${metricLabel(metric)}`)) router.push("/simulasi");
                    }}
                  >
                    Buat skenario <ArrowRight className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title={`Pareto aliran — ${metricLabel(metric)}`} subtitle="Batang biru tua = 20% aliran teratas; garis = kumulatif" />
          <CardBody>{paretoRows.length ? <ParetoChart data={paretoRows} /> : <p className="py-10 text-center text-xs text-navy-700/60">Tidak ada data untuk indikator ini.</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Bobot skor prioritas" subtitle="FR-08.3 — default 40/25/20/15" />
          <CardBody className="space-y-3">
            {(
              [
                ["environment", "Dampak lingkungan"],
                ["costLoss", "Cost loss"],
                ["ease", "Kemudahan intervensi"],
                ["compliance", "Risiko kepatuhan"],
              ] as Array<[keyof HotspotWeights, string]>
            ).map(([k, label]) => (
              <label key={k} className="block text-xs">
                <span className="flex justify-between text-navy-800">
                  {label} <span className="num font-medium">{weights[k]}</span>
                </span>
                <input type="range" min={0} max={100} step={5} value={weights[k]} onChange={(e) => setWeight(k, Number(e.target.value))} className="w-full" />
              </label>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Tabel hotspot & skor prioritas" subtitle="Kemudahan intervensi dan risiko kepatuhan diisi engineer/EHS (1–5)" />
        <CardBody>
          <Table caption="Skor prioritas per tahap">
            <THead>
              <tr>
                <Th>Peringkat</Th>
                <Th>Tahap</Th>
                <Th align="right">Energi</Th>
                <Th align="right">Air</Th>
                <Th align="right">Kimia</Th>
                <Th align="right">Limbah B3</Th>
                <Th align="right">Cost loss (Rp)</Th>
                <Th>Kemudahan</Th>
                <Th>Risiko kepatuhan</Th>
                <Th align="right">Skor</Th>
              </tr>
            </THead>
            <tbody>
              {h.priority.map((p, i) => (
                <Tr key={p.stageId}>
                  <Td num>{i + 1}</Td>
                  <Td className="whitespace-nowrap font-medium">
                    {i === 0 && <Flame className="mr-1 inline h-3.5 w-3.5 text-status-danger" />}
                    {stageLabel(project, p.stageId)}
                  </Td>
                  {(["energy", "water", "chemical", "waste"] as const).map((m) => {
                    const v = h.share[p.stageId][m] ?? 0;
                    return (
                      <Td key={m} num className={v >= ui.hotspotThreshold ? "font-semibold text-status-danger" : ""}>
                        {fmt(v, 1)}%
                      </Td>
                    );
                  })}
                  <Td num>{fmtRp(costLoss(p.stageId))}</Td>
                  <Td>
                    <ScoreSelect value={project.stageEase[p.stageId]} onChange={(v) => updateStageScores("stageEase", p.stageId, v)} label="Kemudahan intervensi" />
                  </Td>
                  <Td>
                    <ScoreSelect value={project.stageComplianceRisk[p.stageId]} onChange={(v) => updateStageScores("stageComplianceRisk", p.stageId, v)} label="Risiko kepatuhan" />
                  </Td>
                  <Td num className="font-semibold">
                    {fmt(p.score, 1)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

function ScoreSelect({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <Field label={<span className="sr-only">{label}</span>}>
      <Select value={value} aria-label={label} className="w-[64px]" onChange={(e) => onChange(Number(e.target.value))}>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>
    </Field>
  );
}
