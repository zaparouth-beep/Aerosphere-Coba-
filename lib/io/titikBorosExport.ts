import type { Workbook } from "exceljs";
import type { Project } from "@/lib/domain/types";
import type { TitikBorosModel } from "@/lib/engine/titikBoros";
import { STAGE_CODES } from "@/lib/engine/types";
import { tx } from "@/lib/i18n";
import { sanitizeCell } from "@/lib/utils/export";
import { GROUP_LABEL, INDICATOR, SEVERITY_STYLE, stageName, unitOf } from "@/lib/view/titikBoros";

const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

/** Titik boros table as Excel: one sheet with % per stage (coloured by class), one with values per m². */
export async function buildTitikBorosWorkbook(project: Project, model: TitikBorosModel, resultLabel: string): Promise<Blob> {
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "AeroSphere LCA";

  for (const mode of ["pct", "value"] as const) {
    const ws = wb.addWorksheet(mode === "pct" ? tx("Titik boros (%)", "Waste hotspots (%)") : tx("Nilai per m2", "Values per m2"));
    ws.addRow([`${project.name} · ${resultLabel} · ${tx("ambang titik boros", "hotspot threshold")} ${model.thresholdPct}%`].map(sanitizeCell)).font = { bold: true };
    const head = ws.addRow([tx("Indikator", "Indicator"), tx("Satuan", "Unit"), ...STAGE_CODES.map((s) => `${s}. ${stageName(project, s)}`), "Total per m²"].map(sanitizeCell));
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B1660" } };
    for (const group of ["impact", "use"] as const) {
      ws.addRow([GROUP_LABEL[group]]).font = { bold: true };
      for (const r of model.rows.filter((x) => x.group === group)) {
        const unit = `${r.unit === "Rp" ? "Rp" : unitOf(r)} per m²`;
        const cells = STAGE_CODES.map((s) => (mode === "pct" ? Math.round(r.share[s] * 10) / 10 : r.perStage[s]));
        const row = ws.addRow([INDICATOR[r.key].label, mode === "pct" ? "%" : unit, ...cells, r.totalPerFU].map(sanitizeCell));
        STAGE_CODES.forEach((s, i) => {
          const c = row.getCell(3 + i);
          const st = SEVERITY_STYLE[r.severity[s]];
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(st.bg) } };
          c.font = { color: { argb: argb(st.fg) }, bold: r.topStage === s };
          c.numFmt = mode === "pct" ? "0.0" : "0.000";
          c.note = `${st.label} · ${Math.round(r.share[s] * 10) / 10}%`;
        });
        row.getCell(3 + STAGE_CODES.length).numFmt = "0.000";
      }
    }
    ws.addRow([]);
    ws.addRow([
      tx(
        "Kelas: Merah = titik boros (≥ ambang) · Oranye = tinggi (20% – < ambang) · Kuning = sedang (10–<20%) · Hijau = rendah (>0–<10%) · Abu-abu = tidak ada / belum dihitung",
        "Classes: Red = waste hotspot (≥ threshold) · Orange = high (20% – < threshold) · Yellow = medium (10–<20%) · Green = low (>0–<10%) · Grey = none / not calculated",
      ),
    ]);
    ws.getColumn(1).width = 44;
    ws.getColumn(2).width = 18;
    STAGE_CODES.forEach((_, i) => (ws.getColumn(3 + i).width = 16));
    ws.getColumn(3 + STAGE_CODES.length).width = 16;
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
