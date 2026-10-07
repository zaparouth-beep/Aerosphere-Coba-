import type { Workbook } from "exceljs";
import type { AuditEvent, Project } from "@/lib/domain/types";
import { ENGINE_VERSION, indicatorsOf, type Results } from "@/lib/engine/calculate";
import { hashOf } from "@/lib/engine/hash";
import { SCOPE_LABEL, SOURCE_LABEL } from "@/lib/engine/lcia";
import { STAGE_IDS } from "@/lib/engine/lci";
import { IMPACT_CATEGORIES } from "@/lib/engine/method";
import { MFCA_COST_LABEL } from "@/lib/engine/mfca";
import { confidenceOf } from "@/lib/engine/quality";
import type { Run } from "@/lib/engine/run";
import type { ScenarioOutcome } from "@/lib/engine/scenario";
import { verifyChain } from "@/lib/engine/run";
import { sanitizeCell } from "@/lib/utils/export";

export const REPORT_TEMPLATES = [
  { id: "iso14044", label: "ISO 14044 LCA Study Report", audience: "Sustainability team, auditor", formats: "PDF + Excel" },
  { id: "pcf", label: "GHG Protocol / ISO 14067 Product Carbon Footprint", audience: "Pelanggan OEM, ESG", formats: "PDF + Excel" },
  { id: "gri", label: "GRI Disclosure Pack (302/303/305/306)", audience: "ESG reporting", formats: "Excel + PDF ringkas" },
  { id: "proper", label: "PROPER KPI", audience: "EHS, regulator", formats: "Excel + PDF" },
  { id: "mfca", label: "MFCA Report (ISO 14051)", audience: "Operations, finance", formats: "PDF + Excel" },
  { id: "decision", label: "Scenario Decision Brief", audience: "C-level", formats: "PDF 2–4 halaman" },
  { id: "onepager", label: "Executive One-pager", audience: "C-level, pitching", formats: "PDF 1 halaman" },
] as const;

export type ReportTemplateId = (typeof REPORT_TEMPLATES)[number]["id"];

export interface ReportContext {
  project: Project;
  results: Results;
  run: Run | null;
  outcomes: ScenarioOutcome[];
  events: AuditEvent[];
  generatedAt: string;
  generatedBy: string;
}

/** Audit evidence pack (PRD 3.4): manifest, data, results, related events, hashes. */
export function evidencePack(ctx: ReportContext) {
  const body = {
    kind: "aerosphere-audit-evidence",
    generatedAt: ctx.generatedAt,
    generatedBy: ctx.generatedBy,
    classification: "Confidential – Tenant",
    engineVersion: ENGINE_VERSION,
    manifest: ctx.run?.manifest ?? { runId: "DRAFT", note: "Bukan run terkunci" },
    resultHash: ctx.run?.resultHash ?? hashOf(ctx.results),
    snapshot: ctx.run?.snapshot ?? ctx.project,
    results: ctx.results,
    auditLog: ctx.events,
    auditChainBrokenAt: verifyChain(ctx.events),
  };
  return { ...body, packHash: hashOf(body) };
}

export function lciRows(ctx: ReportContext) {
  return ctx.results.lci.flows.map((f) => {
    const input = ctx.project.inputs.find((i) => i.id === f.id);
    return {
      id: f.id,
      jenis: f.kind,
      kategori: f.category,
      nama: f.name,
      tahap: f.stageId,
      kuantitas_periode: f.quantity,
      unit: f.unit,
      per_fu: ctx.results.lci.referenceFlow > 0 ? f.quantity / ctx.results.lci.referenceFlow : "",
      dalam_boundary: f.inBoundary ? "ya" : "tidak",
      sumber: input?.meta.source ?? "",
      tipe_sumber: input?.meta.sourceType ?? "",
      confidence: input ? confidenceOf(input.meta) : "",
      ketidakpastian_pct: f.uncertaintyPct,
      mapping: input?.mapping.status ?? "",
      error: f.error ?? "",
    };
  });
}

/** Multi-sheet results workbook (PRD 3.4 step 2). */
export async function buildResultsWorkbook(ctx: ReportContext): Promise<Blob> {
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "AeroSphere LCA";
  const { project: p, results: r } = ctx;
  const ind = indicatorsOf(r);
  const ref = r.lci.referenceFlow;
  const add = (name: string, header: string[], rows: unknown[][]) => {
    const ws = wb.addWorksheet(name);
    ws.addRow(header);
    rows.forEach((row) => ws.addRow(row.map(sanitizeCell)));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1660" } };
    ws.columns.forEach((c) => (c.width = 22));
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  add("README", ["Field", "Nilai"], [
    ["Proyek", p.name],
    ["Run", ctx.run?.id ?? "DRAF (belum terkunci)"],
    ["Hash hasil", ctx.run?.resultHash ?? "-"],
    ["Metode", `${p.method.primary} · ${p.method.release}`],
    ["Engine", ENGINE_VERSION],
    ["Dibuat", ctx.generatedAt],
    ["Klasifikasi", "Confidential – Tenant"],
    ["Pernyataan", "ISO 14040/14044-aligned; belum melalui critical review independen."],
  ]);
  add("Scope", ["Field", "Nilai"], [
    ["Tujuan", p.scope.goal],
    ["Satuan fungsi", `1 ${r.lci.fuLabel}`],
    ["Reference flow", `${ref} ${r.lci.fuLabel} / ${p.periodLabel}`],
    ["Boundary", p.scope.boundary],
    ["Tahap dalam boundary", p.stages.filter((s) => s.inBoundary).map((s) => s.id).join(", ")],
    ["Cut-off", `${p.scope.cutoffPct}%`],
    ["Alokasi", p.scope.allocation],
    ["Database", p.scope.backgroundDb],
    ...p.scope.assumptions.map((a, i) => [`Asumsi A${i + 1}`, a]),
  ]);
  const lci = lciRows(ctx);
  add("LCI", Object.keys(lci[0] ?? { id: "" }), lci.map((row) => Object.values(row)));
  add(
    "LCIA",
    ["Kategori", "Satuan", "Total periode", "Per FU", "± ketidakpastian", "Aliran berfaktor", "Total aliran"],
    IMPACT_CATEGORIES.map((c) => {
      const cov = r.lcia.coverage.find((x) => x.impact === c.id)!;
      return [c.label, c.unit, r.lcia.totals[c.id], r.lcia.perFu[c.id], r.lcia.uncertainty[c.id], cov.covered, cov.total];
    }),
  );
  add(
    "Hotspot",
    ["Tahap", ...r.hotspot.metrics, "Skor prioritas"],
    STAGE_IDS.map((s) => [s, ...r.hotspot.metrics.map((m) => r.hotspot.share[s][m] ?? 0), r.hotspot.priority.find((x) => x.stageId === s)?.score ?? 0]),
  );
  add(
    "MFCA",
    ["Tahap", "Material in (kg)", "Positive (kg)", ...Object.keys(MFCA_COST_LABEL).flatMap((k) => [`${k} +`, `${k} −`]), "Cost loss"],
    r.mfca.stages.map((s) => [s.stageId, s.materialInKg, s.positiveKg, ...Object.values(s.cost).flatMap((c) => [c.positive, c.negative]), s.costLossRp]),
  );
  add(
    "Scenarios",
    ["Kode", "Nama", "Status", "Energi kWh", "Air L", "Kimia kg", "B3 kg", "GWP kg", "Biaya Rp", "Δ GWP %", "Δ biaya %", "Payback th", "NPV Rp", "Asumsi"],
    [
      ["S0", "Baseline", "-", ind.energyKwh, ind.waterL, ind.chemicalKg, ind.wasteKg, ind.ccKg, ind.costRp, 0, 0, "", "", ""],
      ...ctx.outcomes.map((o) => [
        o.scenario.code,
        o.scenario.name,
        o.scenario.status,
        o.indicators.energyKwh,
        o.indicators.waterL,
        o.indicators.chemicalKg,
        o.indicators.wasteKg,
        o.indicators.ccKg,
        o.indicators.costRp,
        o.delta.ccKg.pct,
        o.delta.costRp.pct,
        o.lcc.paybackYears ?? "",
        o.lcc.npvRp,
        o.assumptions.join(" | "),
      ]),
    ],
  );
  add("Data_Quality", ["Tingkat", "Aturan", "Pesan", "Diterima dengan alasan"], r.validation.issues.map((i) => [i.severity, i.code, i.message, p.dataset.acceptedWarnings[i.key] ?? ""]));
  add("GRI", ["Disclosure", "Indikator", "Nilai", "Satuan"], griRows(ctx));
  add("PROPER", ["KPI", "Nilai", "Satuan"], properRows(ctx));
  add("Audit", ["Seq", "Waktu", "Aktor", "Peran", "Entitas", "ID", "Aksi", "Alasan", "Hash"], ctx.events.map((e) => [e.seq, e.ts, e.actor, e.role, e.entity, e.entityId, e.action, e.reason ?? "", e.hash]));

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function griRows(ctx: ReportContext): Array<[string, string, number | string, string]> {
  const r = ctx.results;
  const ref = r.lci.referenceFlow;
  return [
    ["GRI 302-1", "Konsumsi energi dalam organisasi (lini)", r.lci.totals.energyKwh * 3.6, "MJ"],
    ["GRI 302-3", "Intensitas energi", r.lci.intensity.energy, `kWh/${r.lci.fuLabel}`],
    ["GRI 303-3", "Pengambilan air", r.lci.totals.waterL / 1000, "m³"],
    ["GRI 303-4", "Pembuangan air (efluen)", r.lci.totals.effluentM3, "m³"],
    ["GRI 303-5", "Konsumsi air (masuk − buang)", r.lci.totals.waterL / 1000 - r.lci.totals.effluentM3, "m³"],
    ["GRI 305-1", "Emisi GHG langsung (Scope 1)", r.lcia.ghgScopes.scope1, "kg CO₂e"],
    ["GRI 305-2", "Emisi GHG energi tidak langsung (Scope 2)", r.lcia.ghgScopes.scope2, "kg CO₂e"],
    ["GRI 305-3", "Emisi GHG lain (Scope 3)", r.lcia.ghgScopes.scope3cat1 + r.lcia.ghgScopes.scope3cat5, "kg CO₂e"],
    ["GRI 305-4", "Intensitas emisi GHG", ref > 0 ? r.lcia.totals.cc / ref : "", `kg CO₂e/${r.lci.fuLabel}`],
    ["GRI 306-3", "Limbah dihasilkan (B3)", r.lci.totals.wasteKg, "kg"],
    ["GRI 306-4", "Limbah dialihkan dari pembuangan (recovery)", ctx.project.waste.filter((w) => w.recovery).reduce((s, w) => s + w.quantityKg, 0), "kg"],
    ["GRI 306-5", "Limbah ke pengolahan/pembuangan", ctx.project.waste.filter((w) => !w.recovery).reduce((s, w) => s + w.quantityKg, 0), "kg"],
  ];
}

export function properRows(ctx: ReportContext): Array<[string, number | string, string]> {
  const r = ctx.results;
  const cr6 = ctx.project.effluent.find((e) => /^cr\s*\(?vi\)?$/i.test(e.parameter.trim()));
  return [
    ["Efisiensi energi — intensitas", r.lci.intensity.energy, `kWh/${r.lci.fuLabel}`],
    ["Emisi GHG — intensitas", r.lcia.perFu.cc, `kg CO₂e/${r.lci.fuLabel}`],
    ["Efisiensi air — intensitas", r.lci.intensity.water, `L/${r.lci.fuLabel}`],
    ["Beban pencemar air — Cr(VI)", cr6 && cr6.unit.toLowerCase() === "mg/l" ? (cr6.value * r.lci.totals.effluentM3) / 1000 : "", "kg/periode"],
    ["Limbah B3 dihasilkan", r.lci.totals.wasteKg, "kg/periode"],
    ["3R limbah B3 (recovery)", ctx.project.waste.filter((w) => w.recovery).reduce((s, w) => s + w.quantityKg, 0), "kg/periode"],
  ];
}

export { SCOPE_LABEL, SOURCE_LABEL };
