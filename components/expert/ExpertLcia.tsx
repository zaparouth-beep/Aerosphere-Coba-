"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Droplet, FlaskRound, Recycle } from "lucide-react";
import { BarList, Share100 } from "@/components/charts/Charts";
import { CATEGORICAL, STAGE_COLOR } from "@/components/charts/palette";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Feedback";
import { Field, NumberInput } from "@/components/ui/Input";
import { KpiCard } from "@/components/ui/KpiCard";
import { Segmented } from "@/components/ui/Tabs";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import type { ImpactId } from "@/lib/domain/types";
import { STAGE_IDS } from "@/lib/engine/lci";
import { SCOPE_LABEL, SOURCE_LABEL, type GhgScope, type SourceKey, lciaErrorsText, uncharacterisedText } from "@/lib/engine/lcia";
import { IMPACT_CATEGORIES } from "@/lib/engine/method";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults } from "@/lib/store/useResults";
import { inView, stageLabel } from "@/lib/view/helpers";
import { fmt, fmtPct, fmtSig } from "@/lib/utils/format";
import { T, tx } from "@/lib/i18n";

/** Class II water quality limit for Cr(VI) used for the grey-water indicator (PRD 2.2.4). */
const CR6_CLASS_II_MG_L = 0.05;

export default function LciaPage() {
  const { project, results } = useActiveResults();
  const fuView = useAppStore((s) => s.ui.fuView);
  const [selected, setSelected] = useState<ImpactId>("cc");
  const [basis, setBasis] = useState<"location" | "market">("location");
  const [marketFactor, setMarketFactor] = useState<number | undefined>(undefined);
  const l = results.lcia;
  const ref = results.lci.referenceFlow;
  const fu = results.lci.fuLabel;
  const suffix = fuView === "perFu" ? `/${fu}` : tx("/periode", "/period");
  const cat = IMPACT_CATEGORIES.find((c) => c.id === selected)!;

  const withData = IMPACT_CATEGORIES.filter((c) => l.totals[c.id] !== 0);
  const shareRows = withData.map((c) => {
    const total = STAGE_IDS.reduce((s, id) => s + Math.max(l.byStage[id][c.id], 0), 0);
    return { label: c.short, shares: Object.fromEntries(STAGE_IDS.map((id) => [id, total > 0 ? (Math.max(l.byStage[id][c.id], 0) / total) * 100 : 0])) };
  });

  const contributions = useMemo(
    () =>
      l.contributions
        .filter((c) => c.values[selected] !== 0)
        .sort((a, b) => b.values[selected] - a.values[selected])
        .slice(0, 12)
        .map((c) => ({ label: `${c.name} (${c.stageId})`, value: inView(c.values[selected], ref, fuView), color: STAGE_COLOR[c.stageId], note: l.totals[selected] ? fmtPct((c.values[selected] / l.totals[selected]) * 100, 0) : undefined })),
    [l, selected, ref, fuView],
  );

  const electricityKwh = results.lci.flows.filter((f) => f.kind === "input" && f.category === "Energy" && f.inBoundary).reduce((s, f) => s + f.quantity, 0);
  const scopes: Record<GhgScope, number> = { ...l.ghgScopes };
  if (basis === "market" && marketFactor !== undefined) scopes.scope2 = electricityKwh * marketFactor;

  // Operational & compliance indicators (shown apart from LCIA, P5 / FR-06.5).
  const cr6 = project.effluent.find((e) => /^cr\s*\(?vi\)?$/i.test(e.parameter.trim()));
  const cr6LoadKg = cr6 && cr6.unit.toLowerCase() === "mg/l" ? (cr6.value * project.production.effluentVolumeM3) / 1000 : 0;
  const greyWaterM3 = cr6LoadKg > 0 ? (cr6LoadKg * 1e6) / CR6_CLASS_II_MG_L / 1000 : 0;
  const cr6AirKg = results.lci.flows.filter((f) => f.kind === "air" && /cr\s*\(?vi\)?/i.test(f.name)).reduce((s, f) => s + f.quantity, 0);
  const overLimit = project.effluent.filter((e) => e.limit !== undefined && e.value > e.limit).length;

  const ranking = STAGE_IDS.map((s) => ({ s, v: l.byStage[s][selected] })).sort((a, b) => b.v - a.v);

  return (
    <div className="space-y-6">
      {(l.unmapped.length > 0 || l.errors.length > 0) && (
        <Callout tone="warn">
          <T
            id={
              <>
                Hasil LCIA hanya mencakup aliran yang sudah dipetakan ke dataset background. {l.unmapped.length} aliran belum dipetakan (dilaporkan, tidak dianggap nol).{" "}
                <Link className="underline" href="/data?tab=mapping">
                  Petakan aliran
                </Link>{" "}
                atau{" "}
                <Link className="underline" href="/pengaturan?tab=method">
                  impor faktor dari openLCA
                </Link>
                .
              </>
            }
            en={
              <>
                LCIA results only cover flows already mapped to a background dataset. {l.unmapped.length} flow(s) not yet mapped (reported, not treated as zero).{" "}
                <Link className="underline" href="/data?tab=mapping">
                  Map flows
                </Link>{" "}
                or{" "}
                <Link className="underline" href="/pengaturan?tab=method">
                  import factors from openLCA
                </Link>
                .
              </>
            }
          />
          {lciaErrorsText(l).map((e) => ` ${e}`)}
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {IMPACT_CATEGORIES.map((c) => {
          const cov = l.coverage.find((x) => x.impact === c.id)!;
          const v = inView(l.totals[c.id], ref, fuView);
          return (
            <button key={c.id} type="button" onClick={() => setSelected(c.id)} className={`text-left ${selected === c.id ? "rounded-xl ring-2 ring-brand-blue" : ""}`} aria-pressed={selected === c.id}>
              <KpiCard
                label={`${c.label}${c.legacy ? ` (${c.legacy})` : ""}`}
                value={l.totals[c.id] === 0 ? "–" : fmtSig(v)}
                unit={l.totals[c.id] === 0 ? "" : `${c.unit}${suffix}`}
                hint={cov.total ? tx(`${cov.covered}/${cov.total} aliran berfaktor`, `${cov.covered}/${cov.total} flows with factors`) : tx("butuh CF/background", "needs CF/background")}
              />
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title={tx("Kontribusi tahap A–F per kategori", "Stage A–F contribution per category")} subtitle={tx("Stacked 100%; hanya kategori yang punya nilai", "Stacked 100%; only categories with values")} />
          <CardBody>
            {shareRows.length ? (
              <Share100 rows={shareRows} segments={STAGE_IDS.map((id) => ({ id, label: stageLabel(project, id), color: STAGE_COLOR[id] }))} />
            ) : (
              <p className="py-6 text-center text-xs text-navy-700/60">{tx("Belum ada kategori dengan nilai. Petakan aliran ke dataset background.", "No category has values yet. Map flows to background datasets.")}</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={`${tx("Kontributor terbesar", "Largest contributors")} — ${cat.label}`} subtitle={`${cat.unit}${suffix}; ${tx("pilih kategori dari kartu di atas", "pick a category from the cards above")}`} />
          <CardBody>
            <BarList items={contributions} format={(n) => fmtSig(n)} emptyText={tx("Tidak ada kontribusi untuk kategori ini.", "No contributions for this category.")} />
            {l.uncharacterised.length > 0 && (
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-navy-700/65">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warn" />
                {tx("Aliran tanpa faktor karakterisasi (dilaporkan, bukan nol)", "Flows without characterisation factors (reported, not zero)")}: {uncharacterisedText(l).join(", ")}.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow="GHG Protocol"
            title="Scope 1, 2, 3 (climate change)"
            subtitle={tx("Dipetakan dari aliran LCI, bukan dihitung ulang (PRD 2.2.7)", "Mapped from LCI flows, not recalculated (PRD 2.2.7)")}
            action={<Segmented size="xs" ariaLabel={tx("Basis Scope 2", "Scope 2 basis")} value={basis} onChange={setBasis} options={[{ id: "location", label: "Location-based" }, { id: "market", label: "Market-based" }]} />}
          />
          <CardBody className="space-y-3">
            {basis === "market" && (
              <Field label={tx("Faktor emisi market-based (kg CO₂e/kWh, dari PPA/REC)", "Market-based emission factor (kg CO₂e/kWh, from PPA/REC)")} hint={tx("Kosong = sama dengan location-based.", "Empty = same as location-based.")} className="max-w-xs">
                <NumberInput value={marketFactor} allowEmpty min={0} onCommit={setMarketFactor} />
              </Field>
            )}
            <BarList
              format={(n) => `${fmtSig(n)} kg CO₂e`}
              items={(Object.keys(scopes) as GhgScope[]).map((k, i) => ({ label: SCOPE_LABEL[k], value: inView(scopes[k], ref, fuView), color: CATEGORICAL[i] }))}
              emptyText={tx("Belum ada emisi climate change yang terpetakan.", "No climate change emissions mapped yet.")}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={tx("Per sumber", "By source")} subtitle={`${cat.label}, ${cat.unit}${suffix}`} />
          <CardBody>
            <BarList
              format={(n) => fmtSig(n)}
              items={(Object.keys(SOURCE_LABEL) as SourceKey[]).map((k, i) => ({ label: SOURCE_LABEL[k], value: inView(l.bySource[k][selected], ref, fuView), color: CATEGORICAL[i % CATEGORICAL.length] })).filter((x) => x.value !== 0).sort((a, b) => b.value - a.value)}
              emptyText={tx("Tidak ada kontribusi.", "No contributions.")}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader eyebrow={tx("Terpisah dari LCIA (P5)", "Separate from LCIA (P5)")} title={tx("Indikator operasional & kepatuhan", "Operational & compliance indicators")} subtitle={tx("Tidak dijumlahkan dengan skor dampak", "Not added to impact scores")} />
        <CardBody>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Grey water Cr(VI)" icon={Droplet} value={greyWaterM3 ? fmt(inView(greyWaterM3, ref, fuView), 1) : "–"} unit={greyWaterM3 ? `m³${suffix}` : ""} hint={tx(`beban Cr(VI) ÷ ${CR6_CLASS_II_MG_L} mg/L (kelas II)`, `Cr(VI) load ÷ ${CR6_CLASS_II_MG_L} mg/L (class II)`)} />
            <KpiCard label={tx("Emisi Cr(VI)", "Cr(VI) emissions")} icon={FlaskRound} value={fmt(inView((cr6LoadKg + cr6AirKg) * 1000, ref, fuView), 2)} unit={`g${suffix}`} hint={tx(`air ${fmt(cr6LoadKg * 1000, 1)} g + udara ${fmt(cr6AirKg * 1000, 1)} g / periode`, `water ${fmt(cr6LoadKg * 1000, 1)} g + air ${fmt(cr6AirKg * 1000, 1)} g / period`)} />
            <KpiCard label={tx("Limbah B3", "Hazardous (B3) waste")} icon={Recycle} value={fmt(inView(results.lci.totals.wasteKg, ref, fuView), 2)} unit={`kg${suffix}`} />
            <KpiCard label={tx("Baku mutu efluen", "Effluent standards")} value={`${overLimit}`} unit={tx("parameter melebihi", "parameters exceeded")} tone={overLimit ? "warn" : "default"} hint={<Link className="underline" href="/data?view=cek">{tx("lihat detail", "see details")}</Link>} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={tx("Method check — peringkat hotspot", "Method check — hotspot ranking")} subtitle={tx("FR-06.4: EF 3.1 vs ReCiPe 2016 hanya untuk melihat apakah peringkat konsisten, tidak digabung menjadi satu skor", "FR-06.4: EF 3.1 vs ReCiPe 2016 only to see whether the ranking is consistent, not combined into a single score")} />
        <CardBody>
          <Table caption={tx("Peringkat tahap per metode", "Stage ranking per method")}>
            <THead>
              <tr>
                <Th>{tx("Peringkat", "Rank")}</Th>
                <Th>EF 3.1 — {cat.short}</Th>
                <Th align="right">{tx("Nilai", "Value")}</Th>
                <Th>ReCiPe 2016 Midpoint (H)</Th>
              </tr>
            </THead>
            <tbody>
              {ranking.map((r, i) => (
                <Tr key={r.s}>
                  <Td num>{i + 1}</Td>
                  <Td>{stageLabel(project, r.s)}</Td>
                  <Td num>{r.v ? fmtSig(r.v) : "–"}</Td>
                  <Td className="text-xs text-navy-700/60">{i === 0 ? <Badge>{tx("butuh CF ReCiPe dari method package", "needs ReCiPe CFs from a method package")}</Badge> : ""}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
