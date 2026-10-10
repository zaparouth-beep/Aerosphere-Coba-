/**
 * Technical reasons behind a hotspot (spec §7), in plain words, Indonesian and
 * English. Key = coating type + stage + biggest driver; "any" matches every
 * coating. Sources are paraphrased; only title + link are shown (spec §13).
 */

export interface Reason {
  id: string;
  en: string;
  refs: string[];
}

export const REASONS: Record<string, Reason> = {
  "hard_chrome.C.electricity": {
    id: "Pada pelapisan krom keras, sebagian besar arus (sekitar 80–90%) habis untuk membentuk gas hidrogen, hanya 10–20% yang benar-benar menempelkan krom. Karena itu lapisan tebal butuh waktu lama dan listrik besar, dan gelembung gas ini juga membawa kabut krom ke udara.",
    en: "In hard chrome plating most of the current (about 80–90%) is spent forming hydrogen gas; only 10–20% actually deposits chromium. Thick layers therefore take long and use a lot of electricity, and the gas bubbles also carry chromium mist into the air.",
    refs: ["R14", "R15"],
  },
  "hard_chrome.C.chemical": {
    id: "Bath krom sangat pekat. Setiap kali rak diangkat, larutan menempel di part dan rak lalu terbuang ke bilasan; bath harus diisi ulang dengan asam kromat baru.",
    en: "The chrome bath is very concentrated. Each time a rack is lifted, solution clings to the parts and rack and is lost to the rinse; the bath has to be topped up with fresh chromic acid.",
    refs: ["R1", "R5"],
  },
  "hard_chrome.D.grinding": {
    id: "Lapisan krom keras sering dibuat lebih tebal dari target lalu digerinda, sehingga sebagian krom dan energi terbuang.",
    en: "Hard chrome is often plated thicker than the target and then ground, so part of the chromium and energy is wasted.",
    refs: ["R15"],
  },
  "any.F.waste_b3": {
    id: "Logam yang terbawa ke air bilas diendapkan di IPAL menjadi lumpur. Makin banyak larutan terbawa part, makin banyak lumpur berbahaya. Mengurangi drag-out adalah cara paling efektif menekan lumpur.",
    en: "Metal carried into the rinse water is precipitated in the wastewater plant as sludge. The more solution the parts carry out, the more hazardous sludge. Reducing drag-out is the most effective way to cut sludge.",
    refs: ["R16", "R5"],
  },
  "any.A.water": {
    id: "Bilasan satu tangki atau aliran air yang dibiarkan mengalir terus memakai air jauh lebih banyak daripada bilasan bertingkat berlawanan arah.",
    en: "A single-tank rinse or water left running uses far more water than a multi-stage counter-current rinse.",
    refs: ["R6", "R7"],
  },
  "any.D.water": {
    id: "Bilasan satu tangki atau aliran air yang dibiarkan mengalir terus memakai air jauh lebih banyak daripada bilasan bertingkat berlawanan arah.",
    en: "A single-tank rinse or water left running uses far more water than a multi-stage counter-current rinse.",
    refs: ["R6", "R7"],
  },
  "any.C.heater": {
    id: "Bath panas kehilangan energi lewat permukaan terbuka dan dinding tangki; bila lini jarang dipakai tetapi suhu tetap dijaga, listrik per m² naik.",
    en: "Hot baths lose energy through the open surface and tank walls; when the line is seldom used but kept at temperature, electricity per m² rises.",
    refs: ["R5"],
  },
  "any.E.heater": {
    id: "Bath panas kehilangan energi lewat permukaan terbuka dan dinding tangki; bila lini jarang dipakai tetapi suhu tetap dijaga, listrik per m² naik.",
    en: "Hot baths lose energy through the open surface and tank walls; when the line is seldom used but kept at temperature, electricity per m² rises.",
    refs: ["R5"],
  },
  "any.E.electricity": {
    id: "Ventilasi, scrubber, pompa, dan udara tekan menyala sepanjang jam kerja, tidak sebanding dengan jumlah part yang diproses.",
    en: "Ventilation, scrubbers, pumps and compressed air run throughout working hours, regardless of how many parts are processed.",
    refs: [],
  },
  "nickel.C.chemical": {
    id: "Bath nikel Watts berisi nikel sulfat dan nikel klorida pekat; garam yang terbawa part harus diganti, dan produksi garam nikel menyumbang dampak sumber daya dan asidifikasi.",
    en: "A Watts nickel bath holds concentrated nickel sulphate and nickel chloride; salts carried out with the parts must be replaced, and producing nickel salts adds resource and acidification impacts.",
    refs: ["R5"],
  },
};

export const NO_REASON = {
  id: "Alasan teknis belum tersedia untuk kombinasi ini.",
  en: "No technical reason is available yet for this combination.",
};

/** Titles and links of the sources cited above (spec §13). */
export const REFERENCES: Record<string, { title: string; url?: string }> = {
  R1: { title: "P2 Xchange (Kansas State Univ.), checklist pengurangan limbah plating, Plating & Surface Finishing, Mei 2000", url: "https://sterc.org/pdf/p0500i.pdf" },
  R5: { title: "Takuma Y. et al. (2018), Int J Life Cycle Assess 23:1609–1623, DOI 10.1007/s11367-017-1375-y" },
  R6: { title: "Hillier A.C., Walton C.W., Modeling Electroplating Rinse Systems Using Equation-Solving Software", url: "https://sterc.org/pdf/11191072.pdf" },
  R7: { title: "Improving rinse water efficiency", url: "https://sterc.org/pdf/other/0283.pdf.pdf" },
  R14: { title: "US EPA AP-42 Bab 12.20, Electroplating", url: "https://www.epa.gov/sites/default/files/2020-11/documents/c12s20.pdf" },
  R15: { title: "Elsyca, Engineering solutions for hard chrome plating", url: "https://elsyca-v2.nimbu.io/learn/engineering-solutions-for-hard-chrome-plating" },
  R16: { title: "Modeling for sludge estimation & reduction in electroplating", url: "https://nmfrc.org/pdf/9810059.pdf" },
};

/** Most specific reason for a coating, stage and driver; heater roles also match the "heater" key. */
export function reasonFor(coating: string, stage: string, driver: string, roles: string[] = []): Reason | null {
  const keys = [`${coating}.${stage}.${driver}`, `any.${stage}.${driver}`];
  if (driver === "electricity" && roles.includes("heater")) keys.push(`${coating}.${stage}.heater`, `any.${stage}.heater`);
  for (const k of keys) if (REASONS[k]) return REASONS[k]!;
  return null;
}
