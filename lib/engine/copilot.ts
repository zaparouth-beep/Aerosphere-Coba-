import type { LeverSettings, Project } from "@/lib/domain/types";
import type { Results } from "./calculate";
import { STAGE_IDS } from "./lci";
import { SOURCE_LABEL, type SourceKey } from "./lcia";
import type { ScenarioOutcome } from "./scenario";

/**
 * Copilot layer (M10). Principle P1: numbers come from the engine only.
 * Narratives are templates whose numbers are placeholders resolved from the
 * results payload; the guardrail rejects any template with free digits
 * (AC-05). This MVP runs rule-based in the browser; an LLM can later fill the
 * same templates server-side without changing the guardrail.
 */

export type Values = Record<string, string>;

/** Domain terms that contain digits but are not numbers from results. */
const ALLOWED_LITERALS = ["ISO 14040", "ISO 14044", "ISO 14051", "EF 3.1", "Scope 1", "Scope 2", "Scope 3", "B3", "CO₂", "Cr(VI)", "S0", "S1", "S2", "S3"];

export class GuardrailError extends Error {}

export function render(template: string, values: Values): string {
  let free = template.replace(/\{\{[\w.]+\}\}/g, "");
  for (const lit of ALLOWED_LITERALS) free = free.split(lit).join("");
  if (/\d/.test(free)) throw new GuardrailError(`Angka bebas di narasi ditolak: "${template}"`);
  return template.replace(/\{\{([\w.]+)\}\}/g, (_, key: string) => {
    const v = values[key];
    if (v === undefined) throw new GuardrailError(`Placeholder tanpa nilai hasil: ${key}`);
    return v;
  });
}

export interface Insight {
  id: string;
  kind: "hotspot" | "cost" | "quality" | "recommendation" | "impact";
  title: string;
  text: string;
  refs: string[];
}

const n = (v: number, d = 1) => (Number.isFinite(v) ? v.toLocaleString("id-ID", { maximumFractionDigits: d }) : "–");
const rp = (v: number) => (Number.isFinite(v) ? `Rp${Math.round(v).toLocaleString("id-ID")}` : "–");

export function buildInsights(project: Project, r: Results, outcomes: ScenarioOutcome[] = []): Insight[] & { rejected: string[] } {
  const stageName = (id: string) => project.stages.find((s) => s.id === id)?.name ?? id;
  const insights: Insight[] = [];
  const values: Values = {};
  const rejected: string[] = [];
  /** Each insight is checked on its own; a rejected one is dropped and reported, not shown. */
  const tryPush = (make: () => Insight) => {
    try {
      insights.push(make());
    } catch (e) {
      if (e instanceof GuardrailError) rejected.push(e.message);
      else throw e;
    }
  };

  const top = (metric: "energy" | "water" | "chemical" | "waste" | "costLoss" | "cc") => {
    let best = STAGE_IDS[0]!;
    for (const s of STAGE_IDS) if ((r.hotspot.share[s][metric] ?? 0) > (r.hotspot.share[best][metric] ?? 0)) best = s;
    return { stage: best, share: r.hotspot.share[best][metric] ?? 0 };
  };

  const energy = top("energy");
  const waste = top("waste");
  values["hot.energy.stage"] = `${energy.stage}. ${stageName(energy.stage)}`;
  values["hot.energy.share"] = `${n(energy.share)}%`;
  values["hot.waste.stage"] = `${waste.stage}. ${stageName(waste.stage)}`;
  values["hot.waste.share"] = `${n(waste.share)}%`;
  values["lci.energy.perFu"] = `${n(r.lci.intensity.energy, 2)} kWh/${r.lci.fuLabel}`;
  if (energy.share > 0) {
    tryPush(() => ({
      id: "hot-energy",
      kind: "hotspot",
      title: "Hotspot energi",
      text: render("Tahap {{hot.energy.stage}} menyumbang {{hot.energy.share}} konsumsi energi lini (intensitas total {{lci.energy.perFu}}).", values),
      refs: ["run.lci.byStage.energy", "run.lci.intensity.energy"],
    }));
  }
  if (waste.share > 0) {
    tryPush(() => ({
      id: "hot-waste",
      kind: "hotspot",
      title: "Hotspot limbah B3",
      text: render("Tahap {{hot.waste.stage}} menghasilkan {{hot.waste.share}} limbah B3 per periode.", values),
      refs: ["run.lci.byStage.waste"],
    }));
  }

  if (r.lcia.totals.cc > 0) {
    const sources = (Object.keys(r.lcia.bySource) as SourceKey[]).sort((a, b) => r.lcia.bySource[b].cc - r.lcia.bySource[a].cc);
    const s0 = sources[0]!;
    values["cc.perFu"] = `${n(r.lcia.perFu.cc, 2)} kg CO₂-eq/${r.lci.fuLabel}`;
    values["cc.topSource"] = SOURCE_LABEL[s0];
    values["cc.topShare"] = `${n((r.lcia.bySource[s0].cc / r.lcia.totals.cc) * 100)}%`;
    tryPush(() => ({
      id: "impact-cc",
      kind: "impact",
      title: "Climate change",
      text: render("Climate change {{cc.perFu}}; kontributor terbesar {{cc.topSource}} ({{cc.topShare}}).", values),
      refs: ["run.lcia.perFu.cc", "run.lcia.bySource"],
    }));
  }

  const lossStage = [...r.mfca.stages].sort((a, b) => b.costLossRp - a.costLossRp)[0];
  if (lossStage && r.mfca.costLossRp > 0) {
    values["mfca.loss"] = rp(r.mfca.costLossRp);
    values["mfca.lossShare"] = `${n((r.mfca.costLossRp / r.mfca.totalCostRp) * 100)}%`;
    values["mfca.topStage"] = `${lossStage.stageId}. ${stageName(lossStage.stageId)}`;
    values["mfca.topLoss"] = rp(lossStage.costLossRp);
    values["mfca.materialLoss"] = `${n(r.mfca.materialLossKg)} kg`;
    tryPush(() => ({
      id: "cost-loss",
      kind: "cost",
      title: "Kerugian material (MFCA)",
      text: render(
        "Negative product bernilai {{mfca.loss}} ({{mfca.lossShare}} biaya); terbesar di {{mfca.topStage}} sebesar {{mfca.topLoss}}. Material yang tidak menjadi produk: {{mfca.materialLoss}}.",
        values,
      ),
      refs: ["run.mfca.costLossRp", "run.mfca.stages"],
    }));
  }

  const v = r.validation;
  values["dq.errors"] = n(v.errors, 0);
  values["dq.unmapped"] = n(r.lcia.unmapped.length, 0);
  values["dq.completeness"] = `${n(v.completenessPct, 0)}%`;
  tryPush(() => ({
    id: "quality",
    kind: "quality",
    title: "Kesiapan data",
    text: render(
      "Kelengkapan input {{dq.completeness}}, {{dq.errors}} error, dan {{dq.unmapped}} aliran belum dipetakan ke background. Hasil LCIA hanya sah untuk aliran yang sudah dipetakan.",
      values,
    ),
    refs: ["run.validation", "run.lcia.unmapped"],
  }));

  const best = [...outcomes].sort(
    (a, b) => a.delta.ccKg.pct + a.delta.costRp.pct - (b.delta.ccKg.pct + b.delta.costRp.pct),
  )[0];
  if (best && (best.delta.ccKg.abs < 0 || best.delta.costRp.abs < 0)) {
    values["rec.name"] = `${best.scenario.code} ${best.scenario.name}`;
    values["rec.cc"] = `${n(best.delta.ccKg.pct)}%`;
    values["rec.cost"] = rp(-best.delta.costRp.abs);
    values["rec.water"] = `${n(best.delta.waterL.pct)}%`;
    tryPush(() => ({
      id: "recommendation",
      kind: "recommendation",
      title: "Rekomendasi skenario",
      text: render("{{rec.name}} memberi kombinasi terbaik: climate change {{rec.cc}}, air {{rec.water}}, hemat biaya {{rec.cost}} per periode.", values),
      refs: ["scenario.compare"],
    }));
  }
  return Object.assign(insights, { rejected });
}

/** Natural-language what-if (FR-10.1d): text → draft lever settings, user confirms. */
export function parseWhatIf(text: string): { levers: LeverSettings; summary: string[] } | null {
  const t = text.toLowerCase().replace(",", ".");
  const levers: LeverSettings = {};
  const summary: string[] = [];
  const num = (re: RegExp) => {
    const m = t.match(re);
    return m ? Number(m[1]) : null;
  };
  const drag = num(/drag[\s-]?out[^\d]*(\d+(?:\.\d+)?)\s*%/);
  if (drag !== null) {
    levers.dragout = { reductionPct: drag };
    summary.push(`Kurangi drag-out ${drag}%`);
  }
  const rinse = num(/(?:bilas|rinse)[^\d]*(\d+)\s*(?:tingkat|tahap|stage)/);
  if (rinse !== null) {
    levers.countercurrent = { stagesOld: 2, stagesNew: rinse, ratio: 1000 };
    summary.push(`Bilas counter-flow 2 → ${rinse} tingkat`);
  }
  const rect = t.match(/rectifier[^\d]*(\d+(?:\.\d+)?)\s*%?[^\d]+(\d+(?:\.\d+)?)\s*%/);
  if (rect) {
    levers.rectifier = { etaOld: Number(rect[1]), etaNew: Number(rect[2]) };
    summary.push(`Efisiensi rectifier ${rect[1]}% → ${rect[2]}%`);
  }
  const grid = num(/(?:grid|listrik)[^\d]*(0\.\d+)/);
  if (grid !== null) {
    levers.gridFactor = { kgCO2ePerKwh: grid };
    summary.push(`Faktor grid ${grid} kg CO₂e/kWh`);
  }
  const mist = num(/(?:mist|kabut)[^\d]*(\d+(?:\.\d+)?)\s*%/);
  if (mist !== null) {
    levers.mistSuppressant = { reductionPct: mist };
    summary.push(`Mist suppressant ${mist}%`);
  }
  const heat = num(/(?:heater|pemanas|tutup tangki)[^\d]*(\d+(?:\.\d+)?)\s*%/);
  if (heat !== null) {
    levers.tankCover = { heatReductionPct: heat, mistReductionPct: 0 };
    summary.push(`Tutup tangki: panas −${heat}%`);
  }
  return summary.length ? { levers, summary } : null;
}
