import type { LeverId, LeverSettings, Project, StageId } from "@/lib/domain/types";
import { indicatorsOf, type Indicators, type Results } from "@/lib/engine/calculate";
import type { HotspotMetric } from "@/lib/engine/hotspot";
import { STAGE_IDS } from "@/lib/engine/lci";
import { activeLevers, evaluateScenario, isNothingNote, LEVER_DEFAULTS, LEVERS as LEVER_DEFS, type ScenarioOutcome } from "@/lib/engine/scenario";
import { concentrationFactor } from "@/lib/engine/units";
import { overallConfidence, plainStage } from "@/lib/view/summary";

/**
 * "Arahan perbaikan": detailed work directions chosen from the current
 * results. Every improvement of the lever library (spec §6) is applied to the
 * live data by the engine (the user's own simulations first, otherwise the
 * default lever values); the ones with the largest effect on this data are
 * written out as a work plan. Hotspots that no lever covers, and data that
 * looks like placeholder values, get their own direction. Every number comes
 * from the engine or from the project data — nothing is estimated here.
 */

export type DirLang = "id" | "en";

export interface Direction {
  id: string;
  code: string;
  title: string;
  /** Why this matters for this line (hotspot from the engine). */
  why: string;
  steps: string[];
  owner: string;
  /** Expected effect (engine deltas) and the KPI to watch. */
  target: string;
  measure: string;
  schedule: string;
  /** Engine trace: formulas and values used by the scenario (rule 4). */
  basis: string[];
}

type T = { id: string; en: string };
const tr = (o: T, l: DirLang) => o[l];

const loc = (l: DirLang) => (l === "id" ? "id-ID" : "en-GB");
const n = (v: number, d: number, l: DirLang) => (Number.isFinite(v) ? new Intl.NumberFormat(loc(l), { maximumFractionDigits: d }).format(v) : "–");
const rp = (v: number, l: DirLang) => `Rp${n(Math.round(v), 0, l)}`;
const signed = (pct: number, l: DirLang) => `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${n(Math.abs(pct), 1, l)}%`;
const pctOf = (v: number, l: DirLang) => `${n(v, 1, l)}%`;

function list(items: string[], l: DirLang): string {
  if (items.length <= 1) return items.join("");
  const and = l === "id" ? "dan" : "and";
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/** Stage with the largest share of a metric, from the engine's hotspot table. */
function topStage(r: Results, metric: HotspotMetric): { id: StageId; pct: number } | null {
  let best: { id: StageId; pct: number } | null = null;
  for (const s of STAGE_IDS) {
    const v = r.hotspot.share[s]?.[metric] ?? 0;
    if (v > 0 && (!best || v > best.pct)) best = { id: s, pct: v };
  }
  return best;
}

const METRIC_NAME: Record<"energy" | "water" | "chemical" | "waste" | "cc", T> = {
  energy: { id: "pemakaian listrik", en: "electricity use" },
  water: { id: "pemakaian air", en: "water use" },
  chemical: { id: "pemakaian bahan kimia", en: "chemical use" },
  waste: { id: "limbah B3", en: "hazardous (B3) waste" },
  cc: { id: "jejak karbon", en: "carbon footprint" },
};

interface LeverText {
  metric: keyof typeof METRIC_NAME;
  owner: T;
  steps: (s: LeverSettings, l: DirLang, project: Project) => string[];
  measure: T;
}

const LEVERS: Record<LeverId, LeverText> = {
  dragout: {
    metric: "chemical",
    owner: { id: "Supervisor produksi lini plating, dibantu staf kimia proses", en: "Plating line production supervisor, supported by the process chemist" },
    steps: (s, l) =>
      l === "id"
        ? [
            "Tetapkan waktu tiris standar di atas tangki plating sebelum part dipindahkan ke bilasan, dan tuliskan di instruksi kerja per jenis part.",
            "Atur posisi part di rak/gantungan agar lubang dan cekungan menghadap ke bawah sehingga larutan mengalir kembali ke tangki.",
            "Pasang talang tiris (drip tray) di antara tangki plating dan tangki bilas, lalu alirkan tetesan kembali ke tangki plating.",
            "Gunakan tangki bilas diam (drag-out tank) setelah tangki plating; pakai isinya untuk menambah larutan proses yang menguap.",
            `Targetkan larutan terbawa turun ${pctOf(s.dragout?.reductionPct ?? 0, l)} sesuai skenario, latih operator, dan periksa kepatuhan setiap shift selama bulan pertama.`,
          ]
        : [
            "Set a standard drip time above the plating tank before parts move to the rinse, and write it into the work instruction for each part type.",
            "Rack parts so that holes and recesses face downwards and the solution drains back into the tank.",
            "Install a drip tray between the plating tank and the rinse tank and return the drips to the plating tank.",
            "Use a static drag-out tank after the plating tank; use its contents to top up process solution lost to evaporation.",
            `Aim for a ${pctOf(s.dragout?.reductionPct ?? 0, l)} reduction in drag-out as in the scenario, train the operators, and check compliance every shift during the first month.`,
          ],
    measure: {
      id: "Bandingkan pemakaian asam kromat per m² (faktur dan catatan timbang) serta beban krom di IPAL, sebelum dan satu periode sesudah perubahan.",
      en: "Compare chromic acid use per m² (invoices and weighing records) and the chromium load at the WWTP, before and one period after the change.",
    },
  },
  bathConcentration: {
    metric: "chemical",
    owner: { id: "Staf kimia proses dan QA", en: "Process chemist and QA" },
    steps: (s, l) => {
      const c = s.bathConcentration;
      const range = c ? `${n(c.cOld, 1, l)} → ${n(c.cNew, 1, l)} g/L` : "";
      return l === "id"
        ? [
            `Uji penurunan konsentrasi bath (${range}) di sel uji (Hull cell) dan pastikan masih dalam batas kendali proses.`,
            "Jalankan satu batch percobaan; periksa ketebalan, kekerasan, dan tampilan lapisan sesuai spesifikasi pelanggan.",
            "Perbarui batas kendali di lembar analisis bath dan jadwal penambahan bahan kimia.",
            "Pantau hasil analisis bath setiap minggu dengan grafik kendali (SPC) selama tiga bulan pertama.",
          ]
        : [
            `Test the lower bath concentration (${range}) in a Hull cell and confirm it stays within the process control limits.`,
            "Run one trial batch; check coating thickness, hardness and appearance against the customer specification.",
            "Update the control limits on the bath analysis sheet and the chemical addition schedule.",
            "Monitor the weekly bath analysis on a control (SPC) chart for the first three months.",
          ];
    },
    measure: {
      id: "Pantau konsentrasi bath mingguan, pemakaian bahan kimia per m², dan tingkat cacat lapisan.",
      en: "Monitor the weekly bath concentration, chemical use per m², and the coating reject rate.",
    },
  },
  countercurrent: {
    metric: "water",
    owner: { id: "Teknisi utilitas, dengan persetujuan QA", en: "Utilities technician, with QA approval" },
    steps: (s, l) => {
      const c = s.countercurrent;
      const st = c ? `${n(c.stagesOld, 0, l)} → ${n(c.stagesNew, 0, l)}` : "";
      return l === "id"
        ? [
            `Ubah susunan bilasan menjadi bilasan bertingkat berlawanan arah (${st} tahap): air bersih hanya masuk di tangki bilas terakhir dan mengalir ke tangki sebelumnya.`,
            "Pasang meter air di saluran masuk bilasan agar pemakaian bisa dicatat per shift.",
            "Tetapkan batas konduktivitas bilasan akhir sebagai syarat mutu dan ukur di setiap awal shift.",
            "Uji coba di satu lini terlebih dahulu, lalu terapkan ke lini lain setelah mutu terbukti stabil.",
          ]
        : [
            `Convert the rinses to a counter-current cascade (${st} stages): fresh water enters only the last rinse tank and flows back to the previous one.`,
            "Install a water meter on the rinse inlet so that use can be recorded per shift.",
            "Set a final-rinse conductivity limit as a quality requirement and measure it at the start of every shift.",
            "Pilot on one line first, then roll out to other lines once quality is shown to be stable.",
          ];
    },
    measure: {
      id: "Catat pemakaian air bilas (meter) per m² dan volume air limbah ke IPAL, sebelum dan sesudah perubahan.",
      en: "Record rinse water use (meter) per m² and the effluent volume to the WWTP, before and after the change.",
    },
  },
  rectifier: {
    metric: "energy",
    owner: { id: "Kepala pemeliharaan (maintenance), dengan bagian pengadaan", en: "Maintenance manager, with procurement" },
    steps: (s, l) => {
      const r = s.rectifier;
      const eta = r ? `${pctOf(r.etaOld, l)} → ${pctOf(r.etaNew, l)}` : "";
      return l === "id"
        ? [
            "Ukur pemakaian listrik setiap penyearah arus dengan kWh meter selama satu periode produksi untuk memastikan data dasar.",
            `Minta penawaran penyearah tipe switch-mode dari minimal dua pemasok dengan spesifikasi arus, tegangan, dan riak (ripple) yang sama; efisiensi pada skenario ${eta}.`,
            "Jadwalkan penggantian bersamaan dengan perawatan terencana agar produksi tidak terganggu.",
            "Periksa mutu lapisan (ketebalan dan kekerasan) pada batch pertama setelah penggantian.",
          ]
        : [
            "Meter the electricity use of each rectifier with a kWh meter for one production period to confirm the baseline.",
            `Request quotations for switch-mode rectifiers from at least two suppliers with the same current, voltage and ripple specification; scenario efficiency ${eta}.`,
            "Schedule the replacement together with planned maintenance so that production is not disrupted.",
            "Check coating quality (thickness and hardness) on the first batch after the replacement.",
          ];
    },
    measure: {
      id: "Bandingkan kWh penyearah per m² dari kWh meter, sebelum dan sesudah penggantian.",
      en: "Compare rectifier kWh per m² from the kWh meter, before and after the replacement.",
    },
  },
  tankCover: {
    metric: "energy",
    owner: { id: "Supervisor produksi dan staf EHS", en: "Production supervisor and EHS officer" },
    steps: (s, l) =>
      l === "id"
        ? [
            "Pasang penutup atau bola apung pada tangki yang dipanaskan, terutama saat lini tidak beroperasi.",
            "Tetapkan jadwal pemanas: matikan atau turunkan suhu di luar jam produksi dan saat akhir pekan.",
            `Pastikan sistem ventilasi tetap berfungsi; skenario memakai pengurangan panas ${pctOf(s.tankCover?.heatReductionPct ?? 0, l)} dan kabut ${pctOf(s.tankCover?.mistReductionPct ?? 0, l)}.`,
            "Masukkan pemeriksaan penutup tangki ke daftar periksa harian operator.",
          ]
        : [
            "Fit covers or floating balls on heated tanks, especially when the line is not running.",
            "Set a heater schedule: switch off or lower the temperature outside production hours and at weekends.",
            `Make sure ventilation keeps working; the scenario uses a ${pctOf(s.tankCover?.heatReductionPct ?? 0, l)} heat and ${pctOf(s.tankCover?.mistReductionPct ?? 0, l)} mist reduction.`,
            "Add the tank-cover check to the operators' daily checklist.",
          ],
    measure: {
      id: "Bandingkan kWh pemanas per m² dan hasil pengukuran kabut di area kerja, sebelum dan sesudah.",
      en: "Compare heater kWh per m² and workplace mist measurements, before and after.",
    },
  },
  mistSuppressant: {
    metric: "cc",
    owner: { id: "Staf EHS dan staf kimia proses", en: "EHS officer and process chemist" },
    steps: (s, l) =>
      l === "id"
        ? [
            "Pilih fume suppressant bebas PFOS yang disetujui untuk krom keras, lalu minta lembar data keselamatan (SDS) dari pemasok.",
            "Tambahkan sesuai dosis pemasok dan ukur tegangan permukaan larutan secara berkala untuk menjaga dosis.",
            `Ukur kabut krom di area kerja dan cerobong sebelum dan sesudah; skenario memakai pengurangan ${pctOf(s.mistSuppressant?.reductionPct ?? 0, l)}.`,
            "Pastikan mutu lapisan tidak berubah pada batch pertama.",
          ]
        : [
            "Select a PFOS-free fume suppressant approved for hard chrome and obtain the safety data sheet (SDS) from the supplier.",
            "Dose according to the supplier and measure the surface tension regularly to keep the dose right.",
            `Measure chromium mist at the workplace and the stack before and after; the scenario uses a ${pctOf(s.mistSuppressant?.reductionPct ?? 0, l)} reduction.`,
            "Confirm that coating quality is unchanged on the first batch.",
          ],
    measure: {
      id: "Hasil uji kabut Cr(VI) di area kerja dan cerobong oleh laboratorium terakreditasi.",
      en: "Cr(VI) mist test results at the workplace and the stack from an accredited laboratory.",
    },
  },
  effluentTarget: {
    metric: "waste",
    owner: { id: "Operator dan penanggung jawab IPAL", en: "WWTP operator and the person responsible for the WWTP" },
    steps: (s, l, project) => {
      const e = s.effluentTarget;
      const unit = project.effluent.find((x) => x.parameter.trim().toLowerCase() === e?.parameter.trim().toLowerCase())?.unit ?? "mg/L";
      return l === "id"
        ? [
            `Lakukan uji jar (jar test) untuk menurunkan ${e?.parameter ?? "parameter"} di air buangan ke ${n(e?.newValue ?? 0, 3, l)} ${unit}.`,
            `Sesuaikan dosis flokulan (naik ${pctOf(e?.flocculantIncreasePct ?? 0, l)} pada skenario) dan catat setiap perubahan dosis.`,
            "Ambil sampel air buangan setiap minggu dan uji di laboratorium terakreditasi.",
            "Catat jumlah lumpur IPAL yang dihasilkan, karena dosis flokulan yang naik dapat menambah limbah B3.",
          ]
        : [
            `Run a jar test to bring ${e?.parameter ?? "the parameter"} in the effluent down to ${n(e?.newValue ?? 0, 3, l)} ${unit}.`,
            `Adjust the flocculant dose (${pctOf(e?.flocculantIncreasePct ?? 0, l)} higher in the scenario) and record every dose change.`,
            "Sample the effluent weekly and have it tested by an accredited laboratory.",
            "Record the amount of WWTP sludge produced, because a higher flocculant dose can increase hazardous waste.",
          ];
    },
    measure: {
      id: "Hasil uji laboratorium air buangan dan berat lumpur IPAL per periode.",
      en: "Laboratory effluent results and WWTP sludge weight per period.",
    },
  },
  gridFactor: {
    metric: "cc",
    owner: { id: "Manajer energi dan bagian pengadaan", en: "Energy manager and procurement" },
    steps: (s, l) =>
      l === "id"
        ? [
            "Hitung kebutuhan listrik tahunan lini dari data meter.",
            "Bandingkan pilihan listrik rendah emisi: sertifikat energi terbarukan dari PLN atau PLTS atap.",
            `Skenario memakai faktor emisi listrik ${n(s.gridFactor?.kgCO2ePerKwh ?? 0, 3, l)} kg CO₂e/kWh; pastikan faktor ini tertulis di sertifikat atau kontrak.`,
            "Simpan sertifikat dan kontrak sebagai bukti untuk laporan jejak karbon (metode market-based).",
          ]
        : [
            "Calculate the line's annual electricity demand from meter data.",
            "Compare low-emission electricity options: renewable energy certificates from the utility or rooftop solar.",
            `The scenario uses an electricity emission factor of ${n(s.gridFactor?.kgCO2ePerKwh ?? 0, 3, l)} kg CO₂e/kWh; make sure this factor is stated in the certificate or contract.`,
            "Keep the certificates and contract as evidence for the carbon footprint report (market-based method).",
          ],
    measure: {
      id: "Sertifikat atau kontrak listrik rendah emisi dan kWh yang dicakup per periode.",
      en: "Low-emission electricity certificates or contract, and the kWh covered per period.",
    },
  },
};

const EFFORT: Record<string, T> = { rendah: { id: "rendah", en: "low" }, sedang: { id: "sedang", en: "medium" }, tinggi: { id: "tinggi", en: "high" } };

function timeline(t: string, l: DirLang): string {
  return l === "id" ? t : t.replace(/bulan/g, "months").replace(/minggu/g, "weeks").replace("perlu dikaji", "to be assessed");
}

/** Improvements worth doing (save money or carbon), largest yearly saving first — same order as the summary table. */
export function rankedOutcomes(outcomes: ScenarioOutcome[]): ScenarioOutcome[] {
  return outcomes.filter((o) => o.lcc.annualSavingRp > 0 || o.delta.ccKg.abs < 0).sort((a, b) => b.lcc.annualSavingRp - a.lcc.annualSavingRp);
}

/* ------------------------- reading the current data ------------------------ */

type Flow = Results["lci"]["flows"][number];
const flowsOf = (r: Results, cats: string[], stages?: string[]) =>
  r.lci.flows.filter((f) => cats.includes(f.category) && f.quantity > 0 && (!stages || stages.includes(f.stageId))).sort((a, b) => b.quantity - a.quantity);
const sum = (fs: Flow[]) => fs.reduce((a, f) => a + f.quantity, 0);
const named = (fs: Flow[], l: DirLang, k = 2) => list(fs.slice(0, k).map((f) => `${f.name} (${n(f.quantity, 2, l)} ${f.unit})`), l);
const share = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** Lever-specific reason built from the line's own components and the engine totals. */
function whyFor(id: string, project: Project, r: Results, l: DirLang): string {
  const ID = l === "id";
  switch (id) {
    case "dragout":
    case "bathConcentration": {
      const bath = flowsOf(r, ["Chemical"], id === "dragout" ? ["B", "C", "D"] : ["C"]);
      const all = sum(flowsOf(r, ["Chemical"]));
      return ID
        ? `Bahan kimia di tahap bath ${id === "dragout" ? "B–D" : "pelapisan utama"} berjumlah ${n(sum(bath), 2, l)} kg per periode (${pctOf(share(sum(bath), all), l)} dari seluruh bahan kimia proses). Yang terbesar: ${named(bath, l)}. Sebagian besar bahan ini habis karena terbawa part ke bilasan.`
        : `Chemicals in the ${id === "dragout" ? "B–D" : "main plating"} bath stages total ${n(sum(bath), 2, l)} kg per period (${pctOf(share(sum(bath), all), l)} of all process chemicals). Largest: ${named(bath, l)}. Most of this is lost as drag-out into the rinses.`;
    }
    case "countercurrent": {
      const w = flowsOf(r, ["Water"]);
      const hot = topStage(r, "water");
      return ID
        ? `Pemakaian air ${n(sum(w), 0, l)} L per periode${hot ? `, terbesar di tahap ${plainStage(project, hot.id)} (${pctOf(hot.pct, l)})` : ""}. Komponen: ${named(w, l)}.`
        : `Water use is ${n(sum(w), 0, l)} L per period${hot ? `, largest in ${plainStage(project, hot.id)} (${pctOf(hot.pct, l)})` : ""}. Components: ${named(w, l)}.`;
    }
    case "rectifier":
    case "tankCover":
    case "gridFactor": {
      const all = flowsOf(r, ["Energy"]);
      const re = id === "rectifier" ? /rectifier|penyearah/i : id === "tankCover" ? /heater|pemanas/i : /./;
      const dev = all.filter((f) => re.test(f.name));
      const what = id === "rectifier" ? (ID ? "Listrik penyearah arus" : "Rectifier electricity") : id === "tankCover" ? (ID ? "Listrik pemanas tangki" : "Tank heater electricity") : ID ? "Seluruh listrik lini" : "All line electricity";
      const gwp = r.analysis?.impacts.find((i) => i.category === "gwp");
      const elecCc = gwp?.contributions.filter((c) => c.source === "electricity").reduce((a, c) => a + c.value, 0) ?? 0;
      const tail =
        id === "gridFactor" && gwp?.total
          ? ID
            ? ` Listrik menyumbang ${pctOf(share(elecCc, gwp.total), l)} jejak karbon lini.`
            : ` Electricity accounts for ${pctOf(share(elecCc, gwp.total), l)} of the line's carbon footprint.`
          : "";
      if (id === "gridFactor")
        return ID
          ? `Listrik lini ${n(sum(all), 0, l)} kWh per periode; pemakai terbesar: ${named(all, l)}.${tail}`
          : `Line electricity is ${n(sum(all), 0, l)} kWh per period; largest users: ${named(all, l)}.${tail}`;
      return ID
        ? `${what} ${n(sum(dev), 0, l)} kWh per periode (${pctOf(share(sum(dev), sum(all)), l)} dari listrik lini); komponen: ${named(dev, l)}.${tail}`
        : `${what} is ${n(sum(dev), 0, l)} kWh per period (${pctOf(share(sum(dev), sum(all)), l)} of line electricity); components: ${named(dev, l)}.${tail}`;
    }
    case "mistSuppressant": {
      const mist = flowsOf(r, ["AirEmission"]).filter((f) => /mist|kabut|fume/i.test(f.name));
      const all = sum(flowsOf(r, ["AirEmission"]));
      return ID
        ? `Kabut dari tangki ${n(sum(mist), 3, l)} kg per periode (${pctOf(share(sum(mist), all), l)} dari emisi udara langsung): ${named(mist, l)}. Kabut krom heksavalen berbahaya bagi pekerja.`
        : `Tank mist is ${n(sum(mist), 3, l)} kg per period (${pctOf(share(sum(mist), all), l)} of direct air emissions): ${named(mist, l)}. Hexavalent chromium mist is hazardous to workers.`;
    }
    default:
      return "";
  }
}

/** The effluent parameter furthest above its limit (for the WWTP direction). */
function worstEffluent(project: Project): { parameter: string; value: number; limit: number; unit: string } | null {
  let best: { parameter: string; value: number; limit: number; unit: string; ratio: number } | null = null;
  for (const e of project.effluent) {
    if (e.limit === undefined || e.limit <= 0 || concentrationFactor(e.unit) === null || e.value <= e.limit) continue;
    const ratio = e.value / e.limit;
    if (!best || ratio > best.ratio) best = { parameter: e.parameter, value: e.value, limit: e.limit, unit: e.unit, ratio };
  }
  return best;
}

const AUTO_PLAN: Record<LeverId, { effort: "rendah" | "sedang" | "tinggi"; timeline: string }> = {
  dragout: { effort: "rendah", timeline: "1–3 bulan" },
  bathConcentration: { effort: "rendah", timeline: "1–2 bulan" },
  countercurrent: { effort: "sedang", timeline: "3–6 bulan" },
  rectifier: { effort: "sedang", timeline: "3–6 bulan" },
  tankCover: { effort: "rendah", timeline: "1–2 bulan" },
  mistSuppressant: { effort: "rendah", timeline: "1 bulan" },
  effluentTarget: { effort: "sedang", timeline: "2–4 bulan" },
  gridFactor: { effort: "sedang", timeline: "3–12 bulan" },
};

/** Benefit on this data: yearly saving as % of yearly cost, plus carbon, mist and metal reductions. */
function scoreOf(o: ScenarioOutcome, base: Indicators, periodsPerYear: number): number {
  const yearCost = base.costRp * periodsPerYear;
  const money = yearCost > 0 ? (100 * Math.max(o.lcc.annualSavingRp, 0)) / yearCost : 0;
  const less = (k: keyof ScenarioOutcome["delta"]) => Math.max(-o.delta[k].pct, 0);
  return money + less("ccKg") + 0.5 * less("airKg") + 0.5 * less("effluentMetalKg") + 0.1 * less("waterL");
}

/**
 * Every lever applied to the current data: the user's own simulation when one
 * uses the lever, otherwise the default lever values. Levers with nothing to
 * act on in this data are left out.
 */
type Candidate = { outcome: ScenarioOutcome; auto: boolean; score: number };
// The same results are often asked for twice (Indonesian and English report).
const CACHE = new WeakMap<Results, { outcomes: ScenarioOutcome[]; list: Candidate[] }>();

export function candidateOutcomes(project: Project, results: Results, outcomes: ScenarioOutcome[]): Candidate[] {
  const hit = CACHE.get(results);
  if (hit && hit.outcomes === outcomes) return hit.list;
  const list = computeCandidates(project, results, outcomes);
  CACHE.set(results, { outcomes, list });
  return list;
}

function computeCandidates(project: Project, results: Results, outcomes: ScenarioOutcome[]): Candidate[] {
  const base = indicatorsOf(results);
  const perYear = 12 / Math.max(project.periodMonths, 1);
  const covered = new Set(outcomes.flatMap((o) => activeLevers(o.scenario.levers)));
  const autos: ScenarioOutcome[] = [];
  for (const def of LEVER_DEFS) {
    if (covered.has(def.id)) continue;
    let settings: LeverSettings[keyof LeverSettings] = LEVER_DEFAULTS[def.id];
    if (def.id === "effluentTarget") {
      const worst = worstEffluent(project);
      if (!worst) continue;
      settings = { parameter: worst.parameter, newValue: worst.limit, flocculantIncreasePct: LEVER_DEFAULTS.effluentTarget.flocculantIncreasePct };
    }
    const plan = AUTO_PLAN[def.id];
    autos.push(
      evaluateScenario(
        project,
        { id: `auto-${def.id}`, code: "A", name: def.label, description: def.description, levers: { [def.id]: settings }, capexRp: 0, extraOpexRpPerPeriod: 0, lifetimeYears: 5, status: "draft", ...plan },
        base,
      ),
    );
  }
  return [...outcomes.map((o) => ({ outcome: o, auto: false })), ...autos.map((o) => ({ outcome: o, auto: true }))]
    .filter(({ outcome }) => !outcome.assumptions.some((a) => isNothingNote(a)))
    .map((c) => ({ ...c, score: scoreOf(c.outcome, base, perYear) }))
    .filter((c) => c.score > 0.05)
    .sort((a, b) => b.score - a.score);
}

/** Inputs that look like placeholder data: most rows carry the very same number. */
export function placeholderData(project: Project): { value: number; count: number; total: number } | null {
  const qs = project.inputs.filter((i) => i.quantity > 0).map((i) => i.quantity);
  if (qs.length < 5) return null;
  const counts = new Map<number, number>();
  for (const q of qs) counts.set(q, (counts.get(q) ?? 0) + 1);
  const [value, count] = [...counts].sort((a, b) => b[1] - a[1])[0]!;
  return count >= 5 && count / qs.length >= 0.6 ? { value, count, total: qs.length } : null;
}

export function buildDirections(project: Project, results: Results, outcomes: ScenarioOutcome[], l: DirLang, max = 3): Direction[] {
  const ID = l === "id";
  const out: Direction[] = [];

  // 0. Placeholder data first: the rest of the report is not meaningful until it is replaced.
  const dummy = placeholderData(project);
  if (dummy) {
    out.push({
      id: "data-check",
      code: "D",
      title: ID ? "Periksa kembali data input" : "Check the input data",
      why: ID
        ? `${dummy.count} dari ${dummy.total} baris input bernilai sama (${n(dummy.value, 3, l)}). Pola ini biasanya berarti data contoh, sehingga titik boros dan arahan di laporan ini belum mencerminkan kondisi lini yang sebenarnya.`
        : `${dummy.count} of ${dummy.total} input rows have the same value (${n(dummy.value, 3, l)}). This usually means placeholder data, so the hotspots and directions in this report do not yet reflect the real line.`,
      steps: ID
        ? [
            "Isi jumlah setiap komponen dari catatan meter (listrik, air), timbangan (bahan kimia, limbah B3), dan faktur pembelian untuk periode yang sama.",
            "Periksa satuan setiap baris (kg, L, kWh) agar sesuai dengan dokumen sumber.",
            "Bila data tersedia dalam Excel, PDF, atau Word, gunakan tombol “Unggah dokumen” di Data Saya.",
            "Tekan “Hitung hasil” setelah data diganti, lalu buat ulang laporan ini.",
          ]
        : [
            "Enter each component's amount from meter records (electricity, water), weighing records (chemicals, hazardous waste) and purchase invoices for the same period.",
            "Check each row's unit (kg, L, kWh) against the source document.",
            "If the data exists in Excel, PDF or Word, use “Upload document” in My Data.",
            "Press “Calculate results” after replacing the data, then regenerate this report.",
          ],
      owner: ID ? "Staf EHS / pengelola data" : "EHS officer / data steward",
      target: ID ? "Semua baris input berisi angka dari dokumen sumber." : "Every input row holds a figure from a source document.",
      measure: ID ? "Tidak ada lagi peringatan data contoh pada laporan berikutnya." : "No placeholder-data warning in the next report.",
      schedule: ID ? "Segera, sebelum laporan dipakai untuk keputusan; tingkat usaha rendah." : "Immediately, before the report is used for decisions; effort low.",
      basis: [],
    });
  }

  // 1. Improvements with the largest effect on this data.
  const picked = candidateOutcomes(project, results, outcomes).slice(0, max);
  for (const { outcome: o, auto } of picked) {
    const levers = activeLevers(o.scenario.levers);
    const texts = levers.map((id) => LEVERS[id]);
    const main = texts[0];
    const why =
      levers.map((id) => whyFor(id, project, results, l)).filter(Boolean).join(" ") ||
      (id0(levers) === "effluentTarget"
        ? (() => {
            const e = o.scenario.levers.effluentTarget!;
            const cur = project.effluent.find((x) => x.parameter === e.parameter);
            return ID
              ? `${e.parameter} di air buangan ${n(cur?.value ?? 0, 3, l)} ${cur?.unit ?? ""}, di atas baku mutu ${n(e.newValue, 3, l)} ${cur?.unit ?? ""}.`
              : `${e.parameter} in the effluent is ${n(cur?.value ?? 0, 3, l)} ${cur?.unit ?? ""}, above the limit of ${n(e.newValue, 3, l)} ${cur?.unit ?? ""}.`;
          })()
        : o.scenario.description);

    const d = o.delta;
    const effects = [
      Math.abs(d.energyKwh.pct) >= 0.05 && `${ID ? "listrik" : "electricity"} ${signed(d.energyKwh.pct, l)}`,
      Math.abs(d.waterL.pct) >= 0.05 && `${ID ? "air" : "water"} ${signed(d.waterL.pct, l)}`,
      Math.abs(d.chemicalKg.pct) >= 0.05 && `${ID ? "bahan kimia" : "chemicals"} ${signed(d.chemicalKg.pct, l)}`,
      Math.abs(d.wasteKg.pct) >= 0.05 && `${ID ? "limbah B3" : "B3 waste"} ${signed(d.wasteKg.pct, l)}`,
      Math.abs(d.airKg.pct) >= 0.05 && `${ID ? "emisi udara langsung" : "direct air emissions"} ${signed(d.airKg.pct, l)}`,
      Math.abs(d.effluentMetalKg.pct) >= 0.05 && `${ID ? "logam di air buangan" : "metals in effluent"} ${signed(d.effluentMetalKg.pct, l)}`,
      Math.abs(d.ccKg.pct) >= 0.05 && `${ID ? "jejak karbon" : "carbon footprint"} ${signed(d.ccKg.pct, l)}`,
    ].filter((x): x is string => Boolean(x));
    const money =
      o.lcc.annualSavingRp > 0 ? (ID ? `perkiraan penghematan ${rp(o.lcc.annualSavingRp, l)} per tahun` : `estimated saving of ${rp(o.lcc.annualSavingRp, l)} per year`) : "";
    const capex = auto
      ? ID
        ? " Biaya investasi belum diisi; isi di Simulasi Perbaikan untuk menghitung balik modal."
        : " Investment cost not entered yet; fill it in under Improvement Simulation to get the payback."
      : o.scenario.capexRp > 0
        ? ID
          ? ` Investasi ${rp(o.scenario.capexRp, l)}${o.lcc.paybackYears !== null ? `, balik modal ${n(o.lcc.paybackYears, 1, l)} tahun` : ""}.`
          : ` Investment ${rp(o.scenario.capexRp, l)}${o.lcc.paybackYears !== null ? `, payback ${n(o.lcc.paybackYears, 1, l)} years` : ""}.`
        : ID
          ? " Tanpa investasi alat."
          : " No equipment investment.";
    const target = (ID ? "Hasil yang diharapkan (dihitung mesin hitung dari data terkini): " : "Expected result (calculated by the engine from the current data): ") + `${list([money, ...effects].filter(Boolean), l)}.${capex}`;
    const source = auto
      ? ID
        ? "Disusun otomatis dari hasil hitung dengan nilai bawaan pustaka perbaikan; belum ada di daftar simulasi."
        : "Suggested from the results with the improvement library's default values; not yet in the simulation list."
      : "";

    out.push({
      id: o.scenario.id,
      code: o.scenario.code,
      title: auto ? `${o.scenario.name}` : o.scenario.name,
      why: source ? `${why} ${source}` : why,
      steps: texts.flatMap((t) => t.steps(o.scenario.levers, l, project)),
      owner: main ? tr(main.owner, l) : ID ? "Ditentukan oleh manajemen lini" : "To be assigned by line management",
      target,
      measure: texts.map((t) => tr(t.measure, l)).join(" "),
      schedule: ID
        ? `Waktu pelaksanaan ${timeline(o.scenario.timeline ?? "perlu dikaji", l)}; tingkat usaha ${tr(EFFORT[o.scenario.effort ?? "sedang"]!, l)}.`
        : `Timeline ${timeline(o.scenario.timeline ?? "perlu dikaji", l)}; effort ${tr(EFFORT[o.scenario.effort ?? "sedang"]!, l)}.`,
      basis: o.assumptions,
    });
  }

  // 2. The largest carbon source when no chosen improvement acts on it.
  const gwp = results.analysis?.impacts.find((i) => i.category === "gwp");
  const top = gwp?.total ? [...gwp.contributions].sort((a, b) => b.value - a.value)[0] : undefined;
  const LEVER_SOURCES: Partial<Record<LeverId, string[]>> = {
    dragout: ["chemical", "wwtp_chemical", "waste_b3"],
    bathConcentration: ["chemical"],
    countercurrent: ["water"],
    rectifier: ["electricity"],
    tankCover: ["electricity"],
    gridFactor: ["electricity"],
  };
  const pickedLevers = picked.flatMap((c) => activeLevers(c.outcome.scenario.levers));
  const coveredByPick = (c: NonNullable<typeof top>) =>
    pickedLevers.some((id) => {
      if (!LEVER_SOURCES[id]?.includes(c.source)) return false;
      if (id === "rectifier") return /rectifier|penyearah/i.test(c.name);
      if (id === "tankCover") return /heater|pemanas/i.test(c.name);
      if (id === "dragout" || id === "bathConcentration") return c.source !== "chemical" || ["B", "C", "D"].includes(c.stage);
      return true;
    });
  if (top && gwp?.total && share(top.value, gwp.total) >= 10 && !coveredByPick(top)) {
    const pct = pctOf(share(top.value, gwp.total), l);
    const stage = plainStage(project, top.stage as StageId);
    out.push({
      id: `hotspot-${top.componentId}`,
      code: "H",
      title: ID ? `Kaji pemakaian ${top.name}` : `Review the use of ${top.name}`,
      why: ID
        ? `${top.name} di tahap ${stage} adalah penyumbang jejak karbon terbesar lini: ${n(top.value, 2, l)} kg CO₂e per periode (${pct}). Belum ada perbaikan di pustaka yang langsung menyasar komponen ini.`
        : `${top.name} in ${stage} is the line's largest carbon source: ${n(top.value, 2, l)} kg CO₂e per period (${pct}). No improvement in the library targets this component directly.`,
      steps: ID
        ? [
            `Pastikan angka pemakaian ${top.name} sesuai catatan meter, timbangan, atau faktur periode ini.`,
            `Bandingkan pemakaian ${top.name} per m² antarbulan atau antarbatch untuk menemukan pemakaian yang tidak wajar.`,
            "Telusuri penyebabnya bersama operator: dosis berlebih, kebocoran, alat menyala saat tidak berproduksi, atau pengerjaan ulang (rework).",
            "Tetapkan target internal, lalu masukkan perubahannya sebagai simulasi baru di Simulasi Perbaikan agar dampaknya dihitung.",
          ]
        : [
            `Confirm that the amount of ${top.name} matches this period's meter, weighing or invoice records.`,
            `Compare the use of ${top.name} per m² between months or batches to find abnormal use.`,
            "Investigate the causes with the operators: overdosing, leaks, equipment running while idle, or rework.",
            "Set an internal target, then enter the change as a new simulation under Improvement Simulation so its effect is calculated.",
          ],
      owner: ID ? `Kepala tahap ${stage}, dibantu staf EHS` : `${stage} supervisor, supported by the EHS officer`,
      target: ID
        ? `Pemakaian ${top.name} per m² turun; setiap penurunan mengurangi jejak karbon lini sebanding dengan porsinya (${pct}).`
        : `Lower use of ${top.name} per m²; every reduction lowers the line's carbon footprint in proportion to its share (${pct}).`,
      measure: ID ? `Pemakaian ${top.name} per m² dan jejak karbon lini pada hasil berikutnya.` : `Use of ${top.name} per m² and the line's carbon footprint in the next result.`,
      schedule: ID ? "Kajian satu periode produksi; tingkat usaha rendah." : "One production period of review; effort low.",
      basis: [],
    });
  }

  // 3. Estimated data (only when no placeholder warning was given).
  const conf = overallConfidence(project);
  if (!dummy && conf.level !== "High" && conf.estimatedSharePct > 0) {
    out.push({
      id: "data",
      code: "D",
      title: ID ? "Perkuat data pemakaian" : "Strengthen the usage data",
      why: ID
        ? `${pctOf(conf.estimatedSharePct, l)} baris data masih berupa perkiraan atau literatur, sehingga besarnya angka di laporan ini masih bisa bergeser.`
        : `${pctOf(conf.estimatedSharePct, l)} of the data rows are still estimates or literature values, so the size of the figures in this report may still change.`,
      steps: ID
        ? [
            "Ganti angka perkiraan dengan data meter (listrik, air) dan catatan timbang (bahan kimia, limbah B3).",
            "Lampirkan faktur pembelian bahan kimia untuk periode yang sama.",
            "Minta hasil uji laboratorium air buangan terbaru dari IPAL.",
            "Simpan hasil baru di AeroSphere agar laporan berikutnya merujuk nomor hasil yang bisa dicek ulang.",
          ]
        : [
            "Replace estimates with meter data (electricity, water) and weighing records (chemicals, hazardous waste).",
            "Attach purchase invoices for chemicals for the same period.",
            "Request the latest laboratory effluent results from the WWTP.",
            "Save a new result in AeroSphere so the next report refers to a result number that can be checked.",
          ],
      owner: ID ? "Staf EHS / pengelola data" : "EHS officer / data steward",
      target: ID ? "Tingkat keyakinan data naik ke kategori tinggi." : "Data confidence rises to the high category.",
      measure: ID ? "Persentase data primer di bagian kualitas data pada laporan berikutnya." : "Share of primary data in the data-quality section of the next report.",
      schedule: ID ? "Sebelum periode laporan berikutnya; tingkat usaha rendah." : "Before the next reporting period; effort low.",
      basis: [],
    });
  }
  return out;
}

const id0 = (ids: LeverId[]) => ids[0];

/** Written work steps of one lever (exported for tests). */
export const leverSteps = (id: LeverId, settings: LeverSettings, l: DirLang, project: Project) => LEVERS[id].steps(settings, l, project);
