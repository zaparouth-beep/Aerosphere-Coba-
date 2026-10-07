"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Braces, FileDown, FileSpreadsheet, Printer, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Feedback";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { can } from "@/lib/domain/permissions";
import { indicatorsOf } from "@/lib/engine/calculate";
import { hashOf } from "@/lib/engine/hash";
import { SCOPE_LABEL, type GhgScope } from "@/lib/engine/lcia";
import { STAGE_IDS } from "@/lib/engine/lci";
import { IMPACT_CATEGORIES } from "@/lib/engine/method";
import { MFCA_COST_LABEL, type MfcaCostKey } from "@/lib/engine/mfca";
import { buildResultsWorkbook, evidencePack, griRows, lciRows, properRows, REPORT_TEMPLATES, type ReportContext, type ReportTemplateId } from "@/lib/io/reports";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults, useScenarioOutcomes } from "@/lib/store/useResults";
import { cn } from "@/lib/utils/cn";
import { downloadBlob, downloadCSV, downloadJSON, fileStamp } from "@/lib/utils/export";
import { fmt, fmtDate, fmtDelta, fmtPct, fmtRp, fmtSig } from "@/lib/utils/format";
import { stageLabel } from "@/lib/view/helpers";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function LaporanPage() {
  const { project, results, run } = useActiveResults();
  const { outcomes } = useScenarioOutcomes();
  const events = useAppStore((s) => s.events);
  const user = useAppStore((s) => s.user);
  const log = useAppStore((s) => s.log);
  const [template, setTemplate] = useState<ReportTemplateId>("iso14044");
  const generatedAt = useMemo(() => new Date().toISOString(), []);
  const ctx: ReportContext = { project, results, run, outcomes, events, generatedAt, generatedBy: user.name };
  const allowed = can(user.role, "generateReport") || user.role === "Auditor";
  const history = events.filter((e) => e.action === "generate-report").slice(-10).reverse();
  const tpl = REPORT_TEMPLATES.find((t) => t.id === template)!;

  const record = (format: string, content: unknown) => log("report", template, "generate-report", { newValue: { template: tpl.label, format, run: run?.id ?? "DRAFT", fileHash: hashOf(content) } });

  return (
    <div className="space-y-6">
      <div className="no-print space-y-4">
        {!run && (
          <Callout tone="warn">
            Laporan final dibuat dari <b>run terkunci</b> agar angka identik dengan dashboard dan dapat diverifikasi lewat ID run. Saat ini yang dipakai adalah draf langsung, sehingga
            laporan diberi watermark DRAF. Pilih run di bar konteks atau tekan “Run kalkulasi”.
          </Callout>
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {REPORT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              aria-pressed={template === t.id}
              className={cn("rounded-xl border bg-white p-4 text-left shadow-card transition-colors", template === t.id ? "border-brand-blue ring-1 ring-brand-blue" : "border-sand-200 hover:border-sand-300")}
            >
              <p className="text-sm font-semibold text-navy-900">{t.label}</p>
              <p className="mt-1 text-[11px] text-navy-700/65">{t.audience}</p>
              <Badge className="mt-2">{t.formats}</Badge>
            </button>
          ))}
        </div>
        <Card>
          <CardHeader
            title="Ekspor"
            subtitle={`Sumber: ${run ? `${run.id} (hash ${run.resultHash.slice(0, 12)}…)` : "draf langsung"} · bahasa: Indonesia`}
            action={
              <>
                <Button
                  size="sm"
                  disabled={!allowed}
                  onClick={() => {
                    record("pdf", results);
                    window.print();
                  }}
                >
                  <Printer className="h-3.5 w-3.5" /> Cetak / PDF
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!allowed}
                  onClick={async () => {
                    const blob = await buildResultsWorkbook(ctx);
                    record("xlsx", results);
                    downloadBlob(blob, `AeroSphere-${template}-${run?.id ?? "DRAF"}-${fileStamp()}.xlsx`, blob.type);
                  }}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (README, Scope, LCI, LCIA, Hotspot, MFCA, Scenarios, Data_Quality, GRI, PROPER, Audit)
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!allowed}
                  onClick={() => {
                    const rows = lciRows(ctx);
                    record("csv", rows);
                    downloadCSV(rows, `AeroSphere-LCI-${run?.id ?? "DRAF"}-${fileStamp()}.csv`);
                  }}
                >
                  <FileDown className="h-3.5 w-3.5" /> CSV LCI
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const pack = evidencePack(ctx);
                    record("evidence-json", pack);
                    downloadJSON(pack, `AeroSphere-audit-evidence-${run?.id ?? "DRAF"}-${fileStamp()}.json`);
                  }}
                >
                  <Braces className="h-3.5 w-3.5" /> Paket bukti audit (JSON)
                </Button>
              </>
            }
          />
          <CardBody>
            <p className="text-[11px] text-navy-700/60">
              Setiap file yang dibuat dicatat di audit trail beserta hash isinya. Ekspor JSON-LD openLCA dan PDF server-side (WeasyPrint/Typst) membutuhkan backend
              (PRD 3.4); versi browser memakai cetak ke PDF.
            </p>
            {history.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-navy-900">Riwayat laporan</p>
                <ul className="space-y-0.5 text-[11px] text-navy-800">
                  {history.map((h) => {
                    const v = h.newValue as { template?: string; format?: string; run?: string; fileHash?: string } | undefined;
                    return (
                      <li key={h.seq} className="num">
                        {fmtDate(h.ts)} · {v?.template} · {v?.format} · {v?.run} · {h.actor} · {v?.fileHash?.slice(0, 12)}…
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <ReportPreview ctx={ctx} template={template} />
    </div>
  );
}

/* --------------------------------- Preview -------------------------------- */

function ReportPreview({ ctx, template }: { ctx: ReportContext; template: ReportTemplateId }) {
  const { project: p, results: r, run, outcomes } = ctx;
  const ind = indicatorsOf(r);
  const fu = r.lci.fuLabel;
  const tpl = REPORT_TEMPLATES.find((t) => t.id === template)!;
  const best = [...outcomes].sort((a, b) => a.delta.ccKg.pct + a.delta.costRp.pct - (b.delta.ccKg.pct + b.delta.costRp.pct))[0];
  const topStage = (metric: "energy" | "water" | "chemical" | "waste") => {
    let b = STAGE_IDS[0]!;
    for (const s of STAGE_IDS) if ((r.hotspot.share[s][metric] ?? 0) > (r.hotspot.share[b][metric] ?? 0)) b = s;
    return `${stageLabel(p, b)} (${fmt(r.hotspot.share[b][metric] ?? 0, 0)}%)`;
  };

  return (
    <article className="relative mx-auto max-w-[900px] rounded-xl border border-sand-200 bg-white p-8 shadow-card print:max-w-none print:border-0 print:p-0 print:shadow-none">
      {!run && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
          <span className="-rotate-[24deg] text-[110px] font-black tracking-widest text-status-danger/10">DRAF</span>
        </div>
      )}
      <header className="flex items-start justify-between gap-4 border-b-2 border-navy-900 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-teal">{tpl.label}</p>
          <h2 className="mt-1 text-xl font-semibold text-navy-900">{p.name}</h2>
          <p className="text-xs text-navy-700/70">
            {p.facility} · {p.partName} ({p.coatingType}) · {p.periodLabel}
          </p>
        </div>
        <Image src={`${BASE}/brand/logo-color.png`} alt="AeroSphere LCA" width={110} height={108} className="h-auto w-[96px]" unoptimized />
      </header>

      {(template === "iso14044" || template === "onepager" || template === "decision") && (
        <Section title="Ringkasan eksekutif">
          <p>
            Per {fu} permukaan ter-plating, lini menggunakan <b>{fmt(r.lci.intensity.energy, 2)} kWh</b> energi, <b>{fmt(r.lci.intensity.water, 1)} L</b> air,{" "}
            <b>{fmt(r.lci.intensity.chemical, 2)} kg</b> bahan kimia, dan menghasilkan <b>{fmt(r.lci.intensity.waste, 2)} kg</b> limbah B3. Climate change terpetakan{" "}
            <b>{fmtSig(r.lcia.perFu.cc)} kg CO₂-eq/{fu}</b> ({r.lcia.unmapped.length} aliran belum dipetakan). Biaya proses <b>{fmtRp(r.mfca.costPerFu)}/{fu}</b>, dengan
            negative product <b>{fmtPct(r.mfca.totalCostRp ? (r.mfca.costLossRp / r.mfca.totalCostRp) * 100 : 0)}</b> dari total biaya.
          </p>
          <p className="mt-2">
            Hotspot: energi di {topStage("energy")}, kimia di {topStage("chemical")}, air di {topStage("water")}, limbah B3 di {topStage("waste")}.
            {best && (best.delta.ccKg.abs < 0 || best.delta.costRp.abs < 0) && (
              <>
                {" "}
                Skenario terbaik: <b>{best.scenario.code} {best.scenario.name}</b> (GWP {fmtDelta(best.delta.ccKg.pct)}, biaya {fmtDelta(best.delta.costRp.pct)}).
              </>
            )}
          </p>
        </Section>
      )}

      {template === "iso14044" && (
        <>
          <Section title="1. Goal & scope">
            <Dl
              rows={[
                ["Tujuan", p.scope.goal],
                ["Audiens", p.scope.intendedAudience],
                ["Satuan fungsi & reference flow", `1 ${fu}; ${fmt(r.lci.referenceFlow)} ${fu} per ${p.periodLabel}`],
                ["Boundary", `${p.scope.boundary}; tahap ${p.stages.filter((s) => s.inBoundary).map((s) => s.id).join(", ")}`],
                ["Cut-off & alokasi", `< ${fmt(p.scope.cutoffPct)}% massa/energi; alokasi per ${p.scope.allocation}`],
                ["Metode & database", `${p.method.primary} (${p.method.release}); ${p.scope.backgroundDb}`],
                ["Versi scope", `v${p.scope.version}${p.scope.lockedAt ? ` (dikunci ${fmtDate(p.scope.lockedAt)})` : " (draf)"}`],
              ]}
            />
            <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs">
              {p.scope.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ol>
          </Section>
          <Section title="2. Inventori (LCI) per tahap">
            <StageTable ctx={ctx} />
          </Section>
          <Section title="3. Kualitas data">
            <p>
              Kelengkapan input {fmt(r.validation.completenessPct, 0)}%, {r.validation.errors} error, {r.validation.warnings} peringatan, neraca air {fmt(r.validation.water.closurePct, 1)}%, skor
              pedigree rata-rata {fmt(r.validation.avgPedigree, 2)}. Dataset v{p.dataset.version} {p.dataset.status === "approved" ? `di-approve oleh ${p.dataset.approvedBy}` : "belum di-approve"}.
            </p>
          </Section>
        </>
      )}

      {(template === "iso14044" || template === "pcf") && (
        <Section title={template === "pcf" ? "Jejak karbon produk" : "4. Hasil LCIA (EF 3.1)"}>
          {template === "iso14044" ? <LciaTable ctx={ctx} /> : null}
          {template === "pcf" && (
            <p className="mb-2">
              Jejak karbon: <b>{fmtSig(r.lcia.perFu.cc)} kg CO₂-eq per {fu}</b> (IPCC AR6 GWP100), location-based. Cakupan: {r.lcia.coverage.find((c) => c.impact === "cc")?.covered} dari{" "}
              {r.lcia.coverage.find((c) => c.impact === "cc")?.total} aliran background berfaktor; aliran tanpa faktor dicatat sebagai exclusion.
            </p>
          )}
          <Table caption="Scope 1, 2, 3">
            <THead>
              <tr>
                <Th>Scope (GHG Protocol)</Th>
                <Th align="right">kg CO₂e / periode</Th>
                <Th align="right">kg CO₂e / {fu}</Th>
              </tr>
            </THead>
            <tbody>
              {(Object.keys(r.lcia.ghgScopes) as GhgScope[]).map((k) => (
                <Tr key={k}>
                  <Td>{SCOPE_LABEL[k]}</Td>
                  <Td num>{fmtSig(r.lcia.ghgScopes[k])}</Td>
                  <Td num>{fmtSig(r.lci.referenceFlow ? r.lcia.ghgScopes[k] / r.lci.referenceFlow : NaN)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {r.lcia.unmapped.length > 0 && <p className="mt-2 text-xs">Exclusions (belum dipetakan): {r.lcia.unmapped.join(", ")}.</p>}
        </Section>
      )}

      {(template === "iso14044" || template === "mfca") && (
        <Section title={template === "mfca" ? "Matriks biaya MFCA (ISO 14051)" : "5. MFCA"}>
          <Table caption="MFCA">
            <THead>
              <tr>
                <Th>Kategori</Th>
                <Th align="right">Positive</Th>
                <Th align="right">Negative</Th>
              </tr>
            </THead>
            <tbody>
              {(Object.keys(MFCA_COST_LABEL) as MfcaCostKey[]).map((k) => (
                <Tr key={k}>
                  <Td>{MFCA_COST_LABEL[k]}</Td>
                  <Td num>{fmtRp(r.mfca.totals[k].positive)}</Td>
                  <Td num>{fmtRp(r.mfca.totals[k].negative)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2">
            Material masuk {fmt(r.mfca.materialInKg, 1)} kg; positive product (lapisan) {fmt(r.mfca.positiveKg, 2)} kg; material loss {fmt(r.mfca.materialLossKg, 1)} kg. Cost loss terbesar
            per tahap: {[...r.mfca.stages].sort((a, b) => b.costLossRp - a.costLossRp).slice(0, 3).map((s) => `${stageLabel(p, s.stageId)} ${fmtRp(s.costLossRp)}`).join("; ")}.
          </p>
        </Section>
      )}

      {(template === "iso14044" || template === "decision" || template === "onepager") && outcomes.length > 0 && (
        <Section title={template === "iso14044" ? "6. Interpretasi & skenario" : "Skenario S0–S3"}>
          <Table caption="Skenario">
            <THead>
              <tr>
                <Th>Skenario</Th>
                <Th align="right">Δ Energi</Th>
                <Th align="right">Δ Air</Th>
                <Th align="right">Δ GWP</Th>
                <Th align="right">Δ Biaya</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <tbody>
              {outcomes.map((o) => (
                <Tr key={o.scenario.id}>
                  <Td>
                    {o.scenario.code} · {o.scenario.name}
                  </Td>
                  <Td num>{fmtDelta(o.delta.energyKwh.pct)}</Td>
                  <Td num>{fmtDelta(o.delta.waterL.pct)}</Td>
                  <Td num>{fmtDelta(o.delta.ccKg.pct)}</Td>
                  <Td num>{fmtRp(o.delta.costRp.abs)}</Td>
                  <Td>{o.scenario.status}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {template !== "onepager" && (
            <div className="mt-2 text-xs">
              {outcomes.map((o) => (
                <p key={o.scenario.id} className="mt-1">
                  <b>{o.scenario.code} asumsi:</b> {o.assumptions.join(" ") || "–"}
                </p>
              ))}
            </div>
          )}
          {template === "iso14044" && (
            <p className="mt-2 text-xs">
              Keterbatasan: aliran tanpa dataset background dan kategori tanpa CF tidak dihitung (dilaporkan di atas); ketidakpastian dihitung dari pedigree (akar jumlah kuadrat),
              belum Monte Carlo.
            </p>
          )}
        </Section>
      )}

      {template === "gri" && (
        <Section title="GRI Disclosure">
          <Table caption="GRI">
            <THead>
              <tr>
                <Th>Disclosure</Th>
                <Th>Indikator</Th>
                <Th align="right">Nilai</Th>
                <Th>Satuan</Th>
              </tr>
            </THead>
            <tbody>
              {griRows(ctx).map(([code, label, v, u]) => (
                <Tr key={code}>
                  <Td className="num">{code}</Td>
                  <Td>{label}</Td>
                  <Td num>{typeof v === "number" ? fmtSig(v) : v}</Td>
                  <Td>{u}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Section>
      )}

      {template === "proper" && (
        <Section title="KPI PROPER">
          <Table caption="PROPER">
            <THead>
              <tr>
                <Th>KPI</Th>
                <Th align="right">Nilai</Th>
                <Th>Satuan</Th>
              </tr>
            </THead>
            <tbody>
              {properRows(ctx).map(([label, v, u]) => (
                <Tr key={label}>
                  <Td>{label}</Td>
                  <Td num>{typeof v === "number" ? fmtSig(v) : v || "–"}</Td>
                  <Td>{u}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Section>
      )}

      {template === "onepager" && (
        <Section title="Indikator utama">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ["Energi", `${fmt(r.lci.intensity.energy, 2)} kWh/${fu}`],
              ["Air", `${fmt(r.lci.intensity.water, 1)} L/${fu}`],
              ["Limbah B3", `${fmt(r.lci.intensity.waste, 2)} kg/${fu}`],
              ["Climate change", `${fmtSig(r.lcia.perFu.cc)} kg CO₂e/${fu}`],
              ["Biaya", `${fmtRp(r.mfca.costPerFu)}/${fu}`],
              ["Cost loss", fmtRp(ind.costLossRp)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-sand-50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-navy-700/60">{k}</p>
                <p className="num text-sm font-semibold text-navy-900">{v}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-sand-200 pt-3 text-[10px] text-navy-700/60">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> {run ? `Run ${run.id} · hash ${run.resultHash.slice(0, 16)}…` : "DRAF — bukan dari run terkunci"} · {p.method.primary} ({p.method.release})
        </span>
        <span>
          Dibuat {fmtDate(ctx.generatedAt)} oleh {ctx.generatedBy} · Confidential – Tenant · Belum melalui critical review (ISO 14044)
        </span>
      </footer>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid text-sm leading-relaxed text-navy-900">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-navy-900">{title}</h3>
      {children}
    </section>
  );
}

function Dl({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[180px_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold">{k}</dt>
          <dd className="text-navy-800">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function StageTable({ ctx }: { ctx: ReportContext }) {
  const r = ctx.results;
  return (
    <Table caption="LCI per tahap">
      <THead>
        <tr>
          <Th>Tahap</Th>
          <Th align="right">Energi kWh</Th>
          <Th align="right">Air L</Th>
          <Th align="right">Kimia kg</Th>
          <Th align="right">Limbah B3 kg</Th>
        </tr>
      </THead>
      <tbody>
        {STAGE_IDS.map((s) => (
          <Tr key={s}>
            <Td>{stageLabel(ctx.project, s)}</Td>
            <Td num>{fmt(r.lci.byStage.energy[s], 1)}</Td>
            <Td num>{fmt(r.lci.byStage.water[s], 0)}</Td>
            <Td num>{fmt(r.lci.byStage.chemical[s], 1)}</Td>
            <Td num>{fmt(r.lci.byStage.waste[s], 1)}</Td>
          </Tr>
        ))}
        <Tr className="font-semibold">
          <Td>Per {r.lci.fuLabel}</Td>
          <Td num>{fmt(r.lci.intensity.energy, 2)}</Td>
          <Td num>{fmt(r.lci.intensity.water, 1)}</Td>
          <Td num>{fmt(r.lci.intensity.chemical, 2)}</Td>
          <Td num>{fmt(r.lci.intensity.waste, 2)}</Td>
        </Tr>
      </tbody>
    </Table>
  );
}

function LciaTable({ ctx }: { ctx: ReportContext }) {
  const r = ctx.results;
  return (
    <Table caption="LCIA">
      <THead>
        <tr>
          <Th>Kategori</Th>
          <Th align="right">Per {r.lci.fuLabel}</Th>
          <Th>Satuan</Th>
          <Th align="right">Cakupan</Th>
        </tr>
      </THead>
      <tbody>
        {IMPACT_CATEGORIES.map((c) => {
          const cov = r.lcia.coverage.find((x) => x.impact === c.id)!;
          return (
            <Tr key={c.id}>
              <Td>{c.label}</Td>
              <Td num>{r.lcia.totals[c.id] ? fmtSig(r.lcia.perFu[c.id]) : "–"}</Td>
              <Td>{c.unit}</Td>
              <Td num>
                {cov.covered}/{cov.total}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
