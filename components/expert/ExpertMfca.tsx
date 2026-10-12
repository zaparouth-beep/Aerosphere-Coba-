"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Coins, PackageCheck, PackageX, Scale } from "lucide-react";
import { BarList, SankeyChart } from "@/components/charts/Charts";
import { STAGE_COLOR } from "@/components/charts/palette";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Feedback";
import { KpiCard } from "@/components/ui/KpiCard";
import { Segmented } from "@/components/ui/Tabs";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { MFCA_COST_LABEL, type MfcaCostKey } from "@/lib/engine/mfca";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults } from "@/lib/store/useResults";
import { inView, mfcaSankey, stageLabel } from "@/lib/view/helpers";
import { fmt, fmtPct, fmtRp, fmtRpShort } from "@/lib/utils/format";
import { T, tx } from "@/lib/i18n";

const KEYS: MfcaCostKey[] = ["material", "energy", "system", "waste"];

export default function MfcaPage() {
  const { project, results } = useActiveResults();
  const fuView = useAppStore((s) => s.ui.fuView);
  const [mode, setMode] = useState<"rp" | "kg">("rp");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const m = results.mfca;
  const ref = results.lci.referenceFlow;
  const fu = results.lci.fuLabel;
  const view = (v: number) => inView(v, ref, fuView);
  const suffix = fuView === "perFu" ? `/${fu}` : tx("/periode", "/period");
  const sankey = useMemo(() => mfcaSankey(project, results, mode), [project, results, mode]);
  const lines = m.lines.filter((l) => stageFilter === "all" || l.stageId === stageFilter).sort((a, b) => b.costRp - a.costRp);
  const missingPrices = m.lines.filter((l) => l.costRp === 0 && l.quantity > 0);

  return (
    <div className="space-y-6">
      {project.prices.isDemo && <Callout tone="warn">{tx("Harga satuan masih harga dataset demo. Isi harga riil di Data Proses → Harga satuan atau per item.", "Unit prices are still the demo dataset prices. Enter real prices in Process Data → Unit prices or per item.")}</Callout>}
      {missingPrices.length > 0 && (
        <Callout tone="warn">
          {tx(`${missingPrices.length} aliran belum punya harga sehingga biayanya Rp0`, `${missingPrices.length} flow(s) have no price yet, so their cost is Rp0`)}: {missingPrices.slice(0, 6).map((l) => l.name).join(", ")}
          {missingPrices.length > 6 ? ", …" : ""}.{" "}
          <Link className="underline" href="/data?tab=prices">
            {tx("Isi harga", "Enter prices")}
          </Link>
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label={tx("Total biaya proses", "Total process cost")} icon={Coins} value={fmtRpShort(view(m.totalCostRp))} unit={suffix} />
        <KpiCard label="Positive product" icon={PackageCheck} value={fmtRpShort(view(m.positiveCostRp))} unit={suffix} hint={m.totalCostRp ? fmtPct((m.positiveCostRp / m.totalCostRp) * 100) : undefined} />
        <KpiCard label="Negative product (cost loss)" icon={PackageX} value={fmtRpShort(view(m.costLossRp))} unit={suffix} tone="warn" hint={m.totalCostRp ? fmtPct((m.costLossRp / m.totalCostRp) * 100) : undefined} />
        <KpiCard label="Material loss" icon={Scale} value={fmt(view(m.materialLossKg), 2)} unit={`kg${suffix}`} hint={m.materialInKg ? `${fmtPct((m.materialLossKg / m.materialInKg) * 100)} ${tx("dari input", "of input")}` : undefined} />
        <KpiCard label={tx("Biaya karbon internal", "Internal carbon cost")} value={m.internalCarbonCostRp ? fmtRpShort(view(m.internalCarbonCostRp)) : "–"} unit={m.internalCarbonCostRp ? suffix : ""} hint={project.prices.carbonPriceRpPerKgCO2e ? `${fmtRp(project.prices.carbonPriceRpPerKgCO2e)}/kg CO₂e` : tx("harga karbon belum diisi", "carbon price not set")} />
      </div>

      <Card>
        <CardHeader
          eyebrow="ISO 14051"
          title={tx("Aliran material & biaya", "Material & cost flows")}
          subtitle={mode === "rp" ? tx("Kategori biaya → tahap → positive / negative product", "Cost category → stage → positive / negative product") : tx("Input material (kimia, anoda, consumable) → tahap → lapisan / loss", "Material input (chemicals, anodes, consumables) → stage → coating / loss")}
          action={<Segmented ariaLabel={tx("Satuan Sankey", "Sankey unit")} value={mode} onChange={setMode} options={[{ id: "rp", label: "Rp" }, { id: "kg", label: "kg" }]} />}
        />
        <CardBody>
          <SankeyChart data={sankey} format={mode === "rp" ? fmtRpShort : (n) => `${fmt(n, 1)} kg`} height={360} />
          <p className="mt-2 text-[11px] text-navy-700/60">
            <T
              id={
                <>
                  Material input = positive product + negative product. Positive product adalah lapisan terdeposit (ρ × A × t = {fmt(results.lci.coatingMassKg, 2)} kg) di tahap C; energi dan biaya
                  sistem dibagi menurut rasio distribusi material tiap tahap; biaya pengelolaan limbah seluruhnya negative product.
                </>
              }
              en={
                <>
                  Material input = positive product + negative product. The positive product is the deposited coating (ρ × A × t = {fmt(results.lci.coatingMassKg, 2)} kg) in stage C; energy and
                  system costs are split by each stage&apos;s material distribution ratio; waste management costs are entirely negative product.
                </>
              }
            />
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title={tx("Matriks biaya MFCA", "MFCA cost matrix")} subtitle={`${tx("Empat kategori × positive/negative product", "Four categories × positive/negative product")} (${fuView === "perFu" ? `Rp per ${fu}` : tx("Rp per periode", "Rp per period")})`} />
          <CardBody>
            <Table caption={tx("Matriks biaya MFCA", "MFCA cost matrix")}>
              <THead>
                <tr>
                  <Th>{tx("Kategori", "Category")}</Th>
                  <Th align="right">Positive</Th>
                  <Th align="right">Negative (loss)</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">% loss</Th>
                </tr>
              </THead>
              <tbody>
                {KEYS.map((k) => {
                  const c = m.totals[k];
                  const t = c.positive + c.negative;
                  return (
                    <Tr key={k}>
                      <Td className="font-medium">{MFCA_COST_LABEL[k]}</Td>
                      <Td num>{fmtRp(view(c.positive))}</Td>
                      <Td num className="text-status-danger">
                        {fmtRp(view(c.negative))}
                      </Td>
                      <Td num>{fmtRp(view(t))}</Td>
                      <Td num>{t ? fmtPct((c.negative / t) * 100) : "–"}</Td>
                    </Tr>
                  );
                })}
                <Tr className="font-semibold">
                  <Td>Total</Td>
                  <Td num>{fmtRp(view(m.positiveCostRp))}</Td>
                  <Td num className="text-status-danger">
                    {fmtRp(view(m.costLossRp))}
                  </Td>
                  <Td num>{fmtRp(view(m.totalCostRp))}</Td>
                  <Td num>{m.totalCostRp ? fmtPct((m.costLossRp / m.totalCostRp) * 100) : "–"}</Td>
                </Tr>
              </tbody>
            </Table>
            <p className="mt-2 text-[11px] text-navy-700/60">{tx("System cost = tenaga kerja + depresiasi, dialokasikan ke tahap per jam kerja (atau rata bila jam belum diisi).", "System cost = labour + depreciation, allocated to stages by working hours (or evenly if hours are not filled in).")}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={tx("Cost loss per tahap", "Cost loss per stage")} subtitle={tx("Dasar kolom cost loss di Hotspot", "Basis for the cost loss column in Hotspots")} />
          <CardBody>
            <BarList
              format={(n) => fmtRpShort(n)}
              items={[...m.stages]
                .sort((a, b) => b.costLossRp - a.costLossRp)
                .map((s) => ({ label: stageLabel(project, s.stageId), value: view(s.costLossRp), color: STAGE_COLOR[s.stageId], note: m.costLossRp ? fmtPct((s.costLossRp / m.costLossRp) * 100, 0) : undefined }))}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={tx("Rincian biaya per aliran", "Cost breakdown per flow")}
          subtitle={tx("Kuantitas canonical × harga satuan; dapat ditelusuri ke baris input", "Canonical quantity × unit price; traceable to the input row")}
          action={
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} aria-label={tx("Filter tahap", "Stage filter")} className="rounded-md border border-sand-300 bg-white px-2 py-1 text-xs">
              <option value="all">{tx("Semua tahap", "All stages")}</option>
              {project.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {stageLabel(project, s.id)}
                </option>
              ))}
            </select>
          }
        />
        <CardBody>
          <Table caption={tx("Rincian biaya", "Cost breakdown")}>
            <THead>
              <tr>
                <Th>{tx("Aliran", "Flow")}</Th>
                <Th>{tx("Tahap", "Stage")}</Th>
                <Th>{tx("Kategori", "Category")}</Th>
                <Th align="right">{tx("Kuantitas", "Quantity")}</Th>
                <Th align="right">{tx("Harga", "Price")}</Th>
                <Th>{tx("Sumber harga", "Price source")}</Th>
                <Th align="right">{tx("Biaya / periode", "Cost / period")}</Th>
              </tr>
            </THead>
            <tbody>
              {lines.map((l) => (
                <Tr key={l.id}>
                  <Td className="text-xs font-medium">{l.name}</Td>
                  <Td className="text-xs">{l.stageId}</Td>
                  <Td className="text-xs">{MFCA_COST_LABEL[l.key]}</Td>
                  <Td num>
                    {fmt(l.quantity, 2)} {l.unit}
                  </Td>
                  <Td num>{l.unitPriceRp ? fmtRp(l.unitPriceRp) : "–"}</Td>
                  <Td>
                    <Badge tone={l.priceSource === "item" ? "green" : l.unitPriceRp ? "neutral" : "red"}>{l.unitPriceRp ? (l.priceSource === "item" ? tx("harga item", "item price") : tx("harga kategori", "category price")) : tx("belum diisi", "not filled in")}</Badge>
                  </Td>
                  <Td num>{fmtRp(l.costRp)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
