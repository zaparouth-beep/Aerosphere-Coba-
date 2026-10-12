import type { Confidence, Project, StageId } from "@/lib/domain/types";
import { DEFAULT_STAGES } from "@/lib/domain/templates";
import type { Indicators, Results } from "@/lib/engine/calculate";
import { STAGE_IDS } from "@/lib/engine/lci";
import { pedigreeScore } from "@/lib/engine/quality";
import type { ScenarioOutcome } from "@/lib/engine/scenario";
import { pick as pickLang, tx } from "@/lib/i18n";

/**
 * Mode Ringkas view model (PRD v1.1 §3.0.3, §3.5): four headline numbers,
 * the worst stage, three recommended actions and a three-sentence
 * conclusion. Every number comes from the engine; this file only selects
 * and phrases.
 */

const PLAIN_STAGE: Record<StageId, { id: string; en: string }> = {
  A: { id: "Pembersihan awal", en: "Pre-treatment" },
  B: { id: "Lapisan pengikat", en: "Strike/underlayer" },
  C: { id: "Pelapisan utama", en: "Main plating" },
  D: { id: "Perlakuan akhir", en: "Post-treatment" },
  E: { id: "Utilitas (listrik & panas)", en: "Utilities (power & heat)" },
  F: { id: "Pengolahan air limbah", en: "Wastewater treatment" },
};

/** Default everyday name of a stage in the current language. */
export const defaultStageName = (id: StageId): string => pickLang(PLAIN_STAGE[id]);

/** Everyday stage name; a renamed stage keeps the user's own name. */
export function plainStage(project: Project, id: StageId): string {
  const name = project.stages.find((s) => s.id === id)?.name;
  const def = DEFAULT_STAGES.find((s) => s.id === id)?.name;
  return !name || name === def ? pickLang(PLAIN_STAGE[id]) : name;
}

export type HeadlineKey = "cc" | "water" | "waste" | "cost";

export interface Headline {
  key: HeadlineKey;
  label: string;
  glossary: string;
  value: number;
  unit: string;
  previous: number | null;
  changePct: number | null;
}

const per = (v: number, ref: number) => (ref > 0 ? v / ref : NaN);

export function headlines(ind: Indicators, ref: number, fu: string, prev: { indicators: Indicators; ref: number } | null): Headline[] {
  const make = (key: HeadlineKey, label: string, glossary: string, pick: (i: Indicators) => number, unit: string): Headline => {
    const value = per(pick(ind), ref);
    const previous = prev ? per(pick(prev.indicators), prev.ref) : null;
    const changePct = previous !== null && Number.isFinite(previous) && previous !== 0 ? ((value - previous) / Math.abs(previous)) * 100 : null;
    return { key, label, glossary, value, unit, previous, changePct };
  };
  return [
    make("cc", tx("Jejak karbon", "Carbon footprint"), "cc", (i) => i.ccKg, `kg CO₂e per ${fu}`),
    make("water", tx("Pemakaian air", "Water use"), "wu", (i) => i.waterL, tx(`liter per ${fu}`, `litres per ${fu}`)),
    make("waste", tx("Limbah berbahaya (B3)", "Hazardous (B3) waste"), "b3", (i) => i.wasteKg, `kg per ${fu}`),
    make("cost", tx("Biaya proses", "Process cost"), "costPerM2", (i) => i.costRp, `per ${fu}`),
  ];
}

/** Per-stage values of a headline indicator, per functional unit. */
export function stageValues(project: Project, r: Results, key: HeadlineKey): Array<{ stageId: StageId; name: string; value: number }> {
  const ref = r.lci.referenceFlow;
  const raw: Record<StageId, number> = Object.fromEntries(
    STAGE_IDS.map((s) => {
      const st = r.mfca.stages.find((x) => x.stageId === s);
      const v =
        key === "cc"
          ? r.lcia.byStage[s].cc
          : key === "water"
            ? r.lci.byStage.water[s]
            : key === "waste"
              ? r.lci.byStage.waste[s]
              : st
                ? Object.values(st.cost).reduce((a, c) => a + c.positive + c.negative, 0)
                : 0;
      return [s, v];
    }),
  ) as Record<StageId, number>;
  return STAGE_IDS.map((s) => ({ stageId: s, name: plainStage(project, s), value: per(raw[s], ref) }));
}

export interface WorstStage {
  key: HeadlineKey;
  indicator: string;
  stageId: StageId;
  stageName: string;
  sharePct: number;
}

/**
 * The indicator to show in "Di mana masalahnya": the one that worsened most
 * against the comparison, otherwise the one most concentrated in one stage.
 */
export function worstStage(project: Project, r: Results, heads: Headline[]): WorstStage | null {
  const t = r.lci.totals;
  if (t.energyKwh + t.waterL + t.chemicalKg + t.wasteKg <= 0) return null;
  const metric: Record<HeadlineKey, "cc" | "water" | "waste" | "costLoss"> = { cc: "cc", water: "water", waste: "waste", cost: "costLoss" };
  const shareOf = (key: HeadlineKey, s: StageId): number => {
    const a = r.analysis;
    if (!a) return r.hotspot.share[s][metric[key]] ?? 0;
    // New engine (§4.5–4.6): carbon from the screening GWP, cost from the wasted value.
    const values = (pick: (st: StageId) => number) => {
      const total = STAGE_IDS.reduce((t, x) => t + pick(x), 0);
      return total > 0 ? (pick(s) / total) * 100 : 0;
    };
    if (key === "cc") return a.impacts.find((i) => i.category === "gwp")?.share[s] ?? 0;
    if (key === "water") return values((x) => a.perStage[x].waterL);
    if (key === "waste") return values((x) => a.perStage[x].wasteB3Kg);
    return values((x) => a.waste.perStage[x]);
  };
  const candidates = heads
    .map((h) => {
      let best: StageId = STAGE_IDS[0]!;
      for (const s of STAGE_IDS) if (shareOf(h.key, s) > shareOf(h.key, best)) best = s;
      return { h, stageId: best, share: shareOf(h.key, best) };
    })
    .filter((c) => c.share > 0);
  if (!candidates.length) return null;
  const worsened = candidates.filter((c) => (c.h.changePct ?? 0) > 0).sort((a, b) => b.h.changePct! - a.h.changePct!);
  const pick = worsened[0] ?? [...candidates].sort((a, b) => b.share - a.share)[0]!;
  return {
    key: pick.h.key,
    indicator: pick.h.key === "cost" ? tx("nilai yang terbuang", "wasted value") : pick.h.label.toLowerCase(),
    stageId: pick.stageId,
    stageName: plainStage(project, pick.stageId),
    sharePct: pick.share,
  };
}

export interface Action {
  id: string;
  action: string;
  description: string;
  savingRpYear: number;
  ccPct: number;
  effort: "rendah" | "sedang" | "tinggi";
  timeline: string;
}

/** Top three actions by yearly saving (only ones that save money or carbon). */
export function topActions(outcomes: ScenarioOutcome[]): Action[] {
  return outcomes
    .filter((o) => o.lcc.annualSavingRp > 0 || o.delta.ccKg.abs < 0)
    .sort((a, b) => b.lcc.annualSavingRp - a.lcc.annualSavingRp)
    .slice(0, 3)
    .map((o) => ({
      id: o.scenario.id,
      action: o.scenario.name,
      description: o.scenario.description,
      savingRpYear: o.lcc.annualSavingRp,
      ccPct: o.delta.ccKg.pct,
      effort: o.scenario.effort ?? "sedang",
      timeline: o.scenario.timeline ?? "perlu dikaji",
    }));
}

/** Quantity-weighted confidence over every input and waste row. */
export function overallConfidence(project: Project): { level: Confidence; sentence: string; estimatedSharePct: number } {
  const rows = [
    ...project.inputs.filter((i) => i.quantity > 0).map((i) => ({ q: 1, s: pedigreeScore(i.meta.pedigree), src: i.meta.sourceType })),
    ...project.waste.filter((w) => w.quantityKg > 0).map((w) => ({ q: 1, s: pedigreeScore(w.meta.pedigree), src: w.meta.sourceType })),
  ];
  if (!rows.length) {
    return { level: "Low", sentence: tx("Belum ada angka pemakaian; isi data agar tingkat keyakinan bisa dinilai.", "No usage figures yet; fill in data so confidence can be assessed."), estimatedSharePct: 0 };
  }
  const n = rows.length;
  const score = rows.reduce((a, r) => a + r.q * r.s, 0) / n;
  const level: Confidence = score <= 2 ? "High" : score <= 3.5 ? "Medium" : "Low";
  const estimated = rows.filter((r) => r.src === "literature" || r.src === "calculated").length;
  const estimatedSharePct = (estimated / n) * 100;
  const sentence =
    level === "High"
      ? tx("Sebagian besar angka berasal dari meter dan catatan timbang, jadi hasil ini cukup kuat untuk keputusan.", "Most figures come from meters and weighing records, so this result is solid enough for decisions.")
      : level === "Medium"
        ? tx("Sebagian angka dari faktur atau perhitungan; arah kesimpulan dapat dipegang, besarnya angka masih bisa bergeser.", "Some figures come from invoices or calculations; the direction holds, but the size may still shift.")
        : tx("Banyak angka masih perkiraan; pakai hasil ini untuk menentukan prioritas, bukan untuk klaim ke pihak luar.", "Many figures are still estimates; use this result to set priorities, not for external claims.");
  return { level, sentence, estimatedSharePct };
}

export function conclusion(r: Results, worst: WorstStage | null, actions: Action[], fmtRp: (v: number) => string, fmtPct: (v: number) => string): string[] {
  const out: string[] = [];
  if (worst) out.push(tx(`Tahap ${worst.stageName} menjadi sumber terbesar: ${fmtPct(worst.sharePct)} dari ${worst.indicator} lini.`, `The ${worst.stageName} stage is the largest source: ${fmtPct(worst.sharePct)} of the line's ${worst.indicator}.`));
  if (r.analysis && r.analysis.totals.costRp > 0) {
    // §4.5: chemicals, water and B3 handling only; energy and labour are operating cost, not waste.
    out.push(tx(`Nilai bahan kimia, air, dan pengolahan limbah yang terbuang setara ${fmtPct(r.analysis.waste.pctOfCost)} biaya proses.`, `Wasted chemicals, water and waste treatment equal ${fmtPct(r.analysis.waste.pctOfCost)} of process cost.`));
  } else if (r.mfca.totalCostRp > 0) {
    out.push(tx(`Nilai bahan dan energi yang terbuang setara ${fmtPct((r.mfca.costLossRp / r.mfca.totalCostRp) * 100)} biaya proses.`, `Wasted materials and energy equal ${fmtPct((r.mfca.costLossRp / r.mfca.totalCostRp) * 100)} of process cost.`));
  }
  if (actions[0]) out.push(tx(`Perbaikan paling bermanfaat: ${actions[0].action.toLowerCase()}, perkiraan hemat ${fmtRp(actions[0].savingRpYear)} per tahun.`, `Most useful improvement: ${actions[0].action.toLowerCase()}, saving about ${fmtRp(actions[0].savingRpYear)} per year.`));
  else out.push(tx("Belum ada simulasi perbaikan yang menghemat biaya; susun simulasi di menu Simulasi Perbaikan.", "No cost-saving improvement simulation yet; build one under Improvement Simulation."));
  return out;
}

/** Effort level as shown (Action.effort stays the Indonesian key). */
export function effortWord(e: Action["effort"]): string {
  return e === "rendah" ? tx("rendah", "low") : e === "tinggi" ? tx("tinggi", "high") : tx("sedang", "medium");
}

/** Timeline as shown; scenario timelines are written in Indonesian ("1–3 bulan"). */
export function timelineWord(t: string): string {
  return tx(t, t.replace(/bulan/g, "months").replace(/minggu/g, "weeks").replace("perlu dikaji", "to be assessed"));
}
