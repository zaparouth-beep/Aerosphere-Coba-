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
import { tx } from "@/lib/i18n";
import { sanitizeCell } from "@/lib/utils/export";

export const REPORT_TEMPLATES = [
  // Labels are getters so they follow the app language when read (docs/I18N.md rule 2).
  { id: "iso14044", label: "ISO 14044 LCA Study Report", audience: "Sustainability team, auditor", formats: "PDF + Excel" },
  { id: "pcf", label: "GHG Protocol / ISO 14067 Product Carbon Footprint", get audience() { return tx("Pelanggan OEM, ESG", "OEM customers, ESG"); }, formats: "PDF + Excel" },
  { id: "gri", label: "GRI Disclosure Pack (302/303/305/306)", audience: "ESG reporting", get formats() { return tx("Excel + PDF ringkas", "Excel + short PDF"); } },
  { id: "proper", label: "PROPER KPI", audience: "EHS, regulator", formats: "Excel + PDF" },
  { id: "mfca", label: "MFCA Report (ISO 14051)", audience: "Operations, finance", formats: "PDF + Excel" },
  { id: "decision", label: "Scenario Decision Brief", audience: "C-level", get formats() { return tx("PDF 2–4 halaman", "PDF 2–4 pages"); } },
  { id: "onepager", label: "Executive One-pager", audience: "C-level, pitching", get formats() { return tx("PDF 1 halaman", "PDF 1 page"); } },
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

  const value = tx("Nilai", "Value");
  add("README", ["Field", value], [
    [tx("Proyek", "Project"), p.name],
    ["Run", ctx.run?.id ?? tx("DRAF (belum terkunci)", "DRAF (not locked)")],
    [tx("Hash hasil", "Result hash"), ctx.run?.resultHash ?? "-"],
    [tx("Metode", "Method"), `${p.method.primary} · ${p.method.release}`],
    ["Engine", ENGINE_VERSION],
    [tx("Dibuat", "Created"), ctx.generatedAt],
    [tx("Klasifikasi", "Classification"), "Confidential – Tenant"],
    [tx("Pernyataan", "Statement"), tx("ISO 14040/14044-aligned; belum melalui critical review independen.", "ISO 14040/14044-aligned; not yet through independent critical review.")],
  ]);
  add("Scope", ["Field", value], [
    [tx("Tujuan", "Goal"), p.scope.goal],
    [tx("Satuan fungsi", "Functional unit"), `1 ${r.lci.fuLabel}`],
    ["Reference flow", `${ref} ${r.lci.fuLabel} / ${p.periodLabel}`],
    ["Boundary", p.scope.boundary],
    [tx("Tahap dalam boundary", "Stages in boundary"), p.stages.filter((s) => s.inBoundary).map((s) => s.id).join(", ")],
    ["Cut-off", `${p.scope.cutoffPct}%`],
    [tx("Alokasi", "Allocation"), p.scope.allocation],
    ["Database", p.scope.backgroundDb],
    ...p.scope.assumptions.map((a, i) => [`${tx("Asumsi", "Assumption")} A${i + 1}`, a]),
  ]);
  const lci = lciRows(ctx);
  add("LCI", Object.keys(lci[0] ?? { id: "" }).map(lciHeader), lci.map((row) => Object.values(row)));
  add(
    "LCIA",
    [tx("Kategori", "Category"), tx("Satuan", "Unit"), tx("Total periode", "Period total"), "Per FU", tx("± ketidakpastian", "± uncertainty"), tx("Aliran berfaktor", "Flows with factor"), tx("Total aliran", "Total flows")],
    IMPACT_CATEGORIES.map((c) => {
      const cov = r.lcia.coverage.find((x) => x.impact === c.id)!;
      return [c.label, c.unit, r.lcia.totals[c.id], r.lcia.perFu[c.id], r.lcia.uncertainty[c.id], cov.covered, cov.total];
    }),
  );
  add(
    "Hotspot",
    [tx("Tahap", "Stage"), ...r.hotspot.metrics, tx("Skor prioritas", "Priority score")],
    STAGE_IDS.map((s) => [s, ...r.hotspot.metrics.map((m) => r.hotspot.share[s][m] ?? 0), r.hotspot.priority.find((x) => x.stageId === s)?.score ?? 0]),
  );
  add(
    "MFCA",
    [tx("Tahap", "Stage"), "Material in (kg)", "Positive (kg)", ...Object.keys(MFCA_COST_LABEL).flatMap((k) => [`${k} +`, `${k} −`]), "Cost loss"],
    r.mfca.stages.map((s) => [s.stageId, s.materialInKg, s.positiveKg, ...Object.values(s.cost).flatMap((c) => [c.positive, c.negative]), s.costLossRp]),
  );
  add(
    "Scenarios",
    [
      tx("Kode", "Code"),
      tx("Nama", "Name"),
      "Status",
      tx("Energi kWh", "Energy kWh"),
      tx("Air L", "Water L"),
      tx("Kimia kg", "Chemicals kg"),
      "B3 kg",
      "GWP kg",
      tx("Biaya Rp", "Cost Rp"),
      "Δ GWP %",
      tx("Δ biaya %", "Δ cost %"),
      tx("Payback th", "Payback yr"),
      "NPV Rp",
      tx("Asumsi", "Assumptions"),
    ],
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
  add("Data_Quality", [tx("Tingkat", "Severity"), tx("Aturan", "Rule"), tx("Pesan", "Message"), tx("Diterima dengan alasan", "Accepted with reason")], r.validation.issues.map((i) => [i.severity, i.code, i.message, p.dataset.acceptedWarnings[i.key] ?? ""]));
  add("GRI", ["Disclosure", tx("Indikator", "Indicator"), value, tx("Satuan", "Unit")], griRows(ctx));
  add("PROPER", ["KPI", value, tx("Satuan", "Unit")], properRows(ctx));
  add("Audit", ["Seq", tx("Waktu", "Time"), tx("Aktor", "Actor"), tx("Peran", "Role"), tx("Entitas", "Entity"), "ID", tx("Aksi", "Action"), tx("Alasan", "Reason"), "Hash"], ctx.events.map((e) => [e.seq, e.ts, e.actor, e.role, e.entity, e.entityId, e.action, e.reason ?? "", e.hash]));

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function griRows(ctx: ReportContext): Array<[string, string, number | string, string]> {
  const r = ctx.results;
  const ref = r.lci.referenceFlow;
  return [
    ["GRI 302-1", tx("Konsumsi energi dalam organisasi (lini)", "Energy consumption within the organisation (line)"), r.lci.totals.energyKwh * 3.6, "MJ"],
    ["GRI 302-3", tx("Intensitas energi", "Energy intensity"), r.lci.intensity.energy, `kWh/${r.lci.fuLabel}`],
    ["GRI 303-3", tx("Pengambilan air", "Water withdrawal"), r.lci.totals.waterL / 1000, "m³"],
    ["GRI 303-4", tx("Pembuangan air (efluen)", "Water discharge (effluent)"), r.lci.totals.effluentM3, "m³"],
    ["GRI 303-5", tx("Konsumsi air (masuk − buang)", "Water consumption (in − out)"), r.lci.totals.waterL / 1000 - r.lci.totals.effluentM3, "m³"],
    ["GRI 305-1", tx("Emisi GHG langsung (Scope 1)", "Direct GHG emissions (Scope 1)"), r.lcia.ghgScopes.scope1, "kg CO₂e"],
    ["GRI 305-2", tx("Emisi GHG energi tidak langsung (Scope 2)", "Energy indirect GHG emissions (Scope 2)"), r.lcia.ghgScopes.scope2, "kg CO₂e"],
    ["GRI 305-3", tx("Emisi GHG lain (Scope 3)", "Other indirect GHG emissions (Scope 3)"), r.lcia.ghgScopes.scope3cat1 + r.lcia.ghgScopes.scope3cat5, "kg CO₂e"],
    ["GRI 305-4", tx("Intensitas emisi GHG", "GHG emissions intensity"), ref > 0 ? r.lcia.totals.cc / ref : "", `kg CO₂e/${r.lci.fuLabel}`],
    ["GRI 306-3", tx("Limbah dihasilkan (B3)", "Waste generated (hazardous/B3)"), r.lci.totals.wasteKg, "kg"],
    ["GRI 306-4", tx("Limbah dialihkan dari pembuangan (recovery)", "Waste diverted from disposal (recovery)"), ctx.project.waste.filter((w) => w.recovery).reduce((s, w) => s + w.quantityKg, 0), "kg"],
    ["GRI 306-5", tx("Limbah ke pengolahan/pembuangan", "Waste directed to treatment/disposal"), ctx.project.waste.filter((w) => !w.recovery).reduce((s, w) => s + w.quantityKg, 0), "kg"],
  ];
}

export function properRows(ctx: ReportContext): Array<[string, number | string, string]> {
  const r = ctx.results;
  const cr6 = ctx.project.effluent.find((e) => /^cr\s*\(?vi\)?$/i.test(e.parameter.trim()));
  return [
    [tx("Efisiensi energi — intensitas", "Energy efficiency — intensity"), r.lci.intensity.energy, `kWh/${r.lci.fuLabel}`],
    [tx("Emisi GHG — intensitas", "GHG emissions — intensity"), r.lcia.perFu.cc, `kg CO₂e/${r.lci.fuLabel}`],
    [tx("Efisiensi air — intensitas", "Water efficiency — intensity"), r.lci.intensity.water, `L/${r.lci.fuLabel}`],
    [tx("Beban pencemar air — Cr(VI)", "Water pollutant load — Cr(VI)"), cr6 && cr6.unit.toLowerCase() === "mg/l" ? (cr6.value * r.lci.totals.effluentM3) / 1000 : "", tx("kg/periode", "kg/period")],
    [tx("Limbah B3 dihasilkan", "Hazardous (B3) waste generated"), r.lci.totals.wasteKg, tx("kg/periode", "kg/period")],
    [tx("3R limbah B3 (recovery)", "3R of hazardous (B3) waste (recovery)"), ctx.project.waste.filter((w) => w.recovery).reduce((s, w) => s + w.quantityKg, 0), tx("kg/periode", "kg/period")],
  ];
}

/** English column names for the LCI sheet (the CSV keeps the original keys). */
const LCI_HEADER_EN: Record<string, string> = {
  jenis: "kind",
  kategori: "category",
  nama: "name",
  tahap: "stage",
  kuantitas_periode: "quantity_period",
  dalam_boundary: "in_boundary",
  sumber: "source",
  tipe_sumber: "source_type",
  ketidakpastian_pct: "uncertainty_pct",
};
const lciHeader = (k: string) => tx(k, LCI_HEADER_EN[k] ?? k);

export { SCOPE_LABEL, SOURCE_LABEL };
