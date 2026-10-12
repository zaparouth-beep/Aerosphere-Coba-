import type { LeverId, LeverSettings, Project, StageId } from "@/lib/domain/types";
import type { Results } from "@/lib/engine/calculate";
import type { HotspotMetric } from "@/lib/engine/hotspot";
import { STAGE_IDS } from "@/lib/engine/lci";
import { activeLevers, type ScenarioOutcome } from "@/lib/engine/scenario";
import { overallConfidence, plainStage } from "@/lib/view/summary";

/**
 * "Arahan perbaikan": a detailed work direction for each improvement the
 * engine found worthwhile (spec §6 levers). The wording is written for the
 * plant (who does what, in which order, how success is measured); every
 * number is taken from the engine's scenario outcome or from the scenario's
 * own lever settings — nothing is estimated here.
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

export function buildDirections(project: Project, results: Results, outcomes: ScenarioOutcome[], l: DirLang, max = 3): Direction[] {
  const out: Direction[] = rankedOutcomes(outcomes)
    .slice(0, max)
    .map((o) => {
      const levers = activeLevers(o.scenario.levers);
      const texts = levers.map((id) => LEVERS[id]);
      const main = texts[0];
      const hot = main ? topStage(results, main.metric) : null;
      const why = main
        ? hot
          ? l === "id"
            ? `${tr(METRIC_NAME[main.metric], l)[0]!.toUpperCase()}${tr(METRIC_NAME[main.metric], l).slice(1)} terbesar ada di tahap ${plainStage(project, hot.id)} (${pctOf(hot.pct, l)} dari total lini). Perbaikan ini menyasar sumber tersebut.`
            : `The largest share of ${tr(METRIC_NAME[main.metric], l)} is in ${plainStage(project, hot.id)} (${pctOf(hot.pct, l)} of the line total). This improvement targets that source.`
          : l === "id"
            ? `Perbaikan ini menyasar ${tr(METRIC_NAME[main.metric], l)} lini.`
            : `This improvement targets the line's ${tr(METRIC_NAME[main.metric], l)}.`
        : o.scenario.description;

      const d = o.delta;
      const effects = [
        d.energyKwh.pct !== 0 && `${l === "id" ? "listrik" : "electricity"} ${signed(d.energyKwh.pct, l)}`,
        d.waterL.pct !== 0 && `${l === "id" ? "air" : "water"} ${signed(d.waterL.pct, l)}`,
        d.chemicalKg.pct !== 0 && `${l === "id" ? "bahan kimia" : "chemicals"} ${signed(d.chemicalKg.pct, l)}`,
        d.wasteKg.pct !== 0 && `${l === "id" ? "limbah B3" : "B3 waste"} ${signed(d.wasteKg.pct, l)}`,
        d.ccKg.pct !== 0 && `${l === "id" ? "jejak karbon" : "carbon footprint"} ${signed(d.ccKg.pct, l)}`,
      ].filter((x): x is string => Boolean(x));
      const money =
        o.lcc.annualSavingRp > 0
          ? l === "id"
            ? `perkiraan penghematan ${rp(o.lcc.annualSavingRp, l)} per tahun`
            : `estimated saving of ${rp(o.lcc.annualSavingRp, l)} per year`
          : "";
      const capex =
        o.scenario.capexRp > 0
          ? l === "id"
            ? ` Investasi ${rp(o.scenario.capexRp, l)}${o.lcc.paybackYears !== null ? `, balik modal ${n(o.lcc.paybackYears, 1, l)} tahun` : ""}.`
            : ` Investment ${rp(o.scenario.capexRp, l)}${o.lcc.paybackYears !== null ? `, payback ${n(o.lcc.paybackYears, 1, l)} years` : ""}.`
          : l === "id"
            ? " Tanpa investasi alat."
            : " No equipment investment.";
      const target =
        (l === "id" ? "Hasil yang diharapkan (dihitung mesin hitung): " : "Expected result (calculated by the engine): ") +
        `${list([money, ...effects].filter(Boolean), l)}.${capex}`;

      return {
        id: o.scenario.id,
        code: o.scenario.code,
        title: o.scenario.name,
        why,
        steps: texts.flatMap((t) => t.steps(o.scenario.levers, l, project)),
        owner: main ? tr(main.owner, l) : l === "id" ? "Ditentukan oleh manajemen lini" : "To be assigned by line management",
        target,
        measure: texts.map((t) => tr(t.measure, l)).join(" "),
        schedule:
          l === "id"
            ? `Waktu pelaksanaan ${timeline(o.scenario.timeline ?? "perlu dikaji", l)}; tingkat usaha ${tr(EFFORT[o.scenario.effort ?? "sedang"]!, l)}.`
            : `Timeline ${timeline(o.scenario.timeline ?? "perlu dikaji", l)}; effort ${tr(EFFORT[o.scenario.effort ?? "sedang"]!, l)}.`,
        basis: o.assumptions,
      };
    });

  // Data direction: weaker data makes every number above less certain.
  const conf = overallConfidence(project);
  if (conf.level !== "High" && conf.estimatedSharePct > 0) {
    out.push({
      id: "data",
      code: "D",
      title: l === "id" ? "Perkuat data pemakaian" : "Strengthen the usage data",
      why:
        l === "id"
          ? `${pctOf(conf.estimatedSharePct, l)} baris data masih berupa perkiraan atau literatur, sehingga besarnya angka di laporan ini masih bisa bergeser.`
          : `${pctOf(conf.estimatedSharePct, l)} of the data rows are still estimates or literature values, so the size of the figures in this report may still change.`,
      steps:
        l === "id"
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
      owner: l === "id" ? "Staf EHS / pengelola data" : "EHS officer / data steward",
      target: l === "id" ? "Tingkat keyakinan data naik ke kategori tinggi." : "Data confidence rises to the high category.",
      measure: l === "id" ? "Persentase data primer di bagian kualitas data pada laporan berikutnya." : "Share of primary data in the data-quality section of the next report.",
      schedule: l === "id" ? "Sebelum periode laporan berikutnya; tingkat usaha rendah." : "Before the next reporting period; effort low.",
      basis: [],
    });
  }
  return out;
}
