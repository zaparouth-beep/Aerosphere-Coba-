/**
 * UI label dictionary (PRD v1.1 §3.0.4): technical term → everyday label →
 * one-sentence explanation. `why` and `action` feed the 3-line "Apa ini?"
 * popover (§3.0.5): what it means, why it matters, what you can do.
 *
 * Each text is stored as an `{ id, en }` pair; the exported entries expose
 * getters so `term(k).label` / `.explain` follow the current language.
 */

import { pick } from "@/lib/i18n";

export interface GlossaryEntry {
  key: string;
  readonly term: string;
  readonly label: string;
  readonly explain: string;
  readonly why?: string;
  readonly action?: string;
}

type Pair = { id: string; en: string };

interface RawEntry {
  key: string;
  term: string | Pair;
  label: Pair;
  explain: Pair;
  why?: Pair;
  action?: Pair;
}

const p = (id: string, en: string): Pair => ({ id, en });

const RAW: RawEntry[] = [
  {
    key: "fu",
    term: "Functional unit (1 m²)",
    label: p("Per 1 m² permukaan dilapisi", "Per 1 m² of plated surface"),
    explain: p("Semua angka dihitung untuk setiap 1 m² permukaan part yang dilapisi agar bisa dibandingkan antarbulan.", "Every figure is calculated per 1 m² of plated part surface so months can be compared."),
    why: p("Bulan dengan produksi besar tidak otomatis terlihat lebih boros.", "A high-production month does not automatically look more wasteful."),
    action: p("Pastikan total luas dilapisi di Data Saya sudah benar.", "Make sure the total plated area in My Data is correct."),
  },
  {
    key: "referenceFlow",
    term: "Reference flow",
    label: p("Total luas dilapisi", "Total plated area"),
    explain: p("Jumlah m² yang dilapisi dalam periode ini.", "The number of m² plated in this period."),
    why: p("Menjadi pembagi semua angka per m².", "It is the divisor for every per-m² figure."),
    action: p("Isi dari catatan produksi atau QA.", "Fill it in from production or QA records."),
  },
  {
    key: "boundary",
    term: "System boundary",
    label: p("Tahap yang dihitung", "Stages included"),
    explain: p("Bagian proses yang masuk perhitungan, dari pembersihan sampai pengolahan air limbah.", "The parts of the process included in the calculation, from cleaning to wastewater treatment."),
    why: p("Menentukan apa saja yang termasuk dalam angka hasil.", "It decides what the results cover."),
    action: p("Default: tahap A–F; ubah di Mode Ahli bila perlu.", "Default: stages A–F; change it in Expert mode if needed."),
  },
  {
    key: "cutoff",
    term: "Cut-off",
    label: p("Yang tidak dihitung", "What is left out"),
    explain: p("Hal yang sengaja tidak dihitung karena kecil atau di luar kendali pabrik.", "Items deliberately left out because they are small or outside the plant's control."),
    why: p("Supaya pembaca tahu batas laporan.", "So readers know the limits of the report."),
    action: p("Lihat daftar di laporan teknis.", "See the list in the technical report."),
  },
  {
    key: "lci",
    term: "LCI (Life Cycle Inventory)",
    label: p("Pemakaian & buangan", "Inputs & outputs"),
    explain: p("Daftar listrik, air, bahan kimia yang dipakai dan limbah yang keluar.", "The list of electricity, water and chemicals used and the waste that comes out."),
    why: p("Semua hasil dihitung dari daftar ini.", "All results are calculated from this list."),
    action: p("Lengkapi di Data Saya.", "Complete it in My Data."),
  },
  {
    key: "lcia",
    term: "LCIA",
    label: p("Dampak lingkungan", "Environmental impact"),
    explain: p("Hasil perhitungan pengaruh pemakaian dan buangan itu terhadap lingkungan.", "The calculated effect of those inputs and outputs on the environment."),
    why: p("Menunjukkan dampak selain biaya.", "It shows impacts beyond cost."),
    action: p("Buka menu Hasil.", "Open the Results menu."),
  },
  {
    key: "cc",
    term: "Climate change / GWP",
    label: p("Jejak karbon (kg CO₂e)", "Carbon footprint (kg CO₂e)"),
    explain: p("Jumlah gas rumah kaca yang dihasilkan, disetarakan dengan CO₂.", "The amount of greenhouse gases produced, expressed as CO₂ equivalent."),
    why: p("Diminta pelanggan OEM dan laporan ESG.", "Requested by OEM customers and ESG reports."),
    action: p("Cek perbaikan listrik dan bahan kimia di Simulasi Perbaikan.", "Check electricity and chemical improvements in Improvement Simulation."),
  },
  {
    key: "ac",
    term: "Acidification",
    label: p("Potensi hujan asam", "Acid rain potential"),
    explain: p("Seberapa besar emisi yang bisa membuat tanah dan air menjadi asam.", "How much the emissions could make soil and water acidic."),
    why: p("Relevan untuk kabut asam dari pickling dan plating.", "Relevant for acid mist from pickling and plating."),
    action: p("Lihat di Mode Ahli.", "See it in Expert mode."),
  },
  {
    key: "euf",
    term: "Eutrophication",
    label: p("Potensi pencemaran nutrien air", "Water nutrient pollution potential"),
    explain: p("Seberapa besar buangan yang bisa memicu ledakan alga di perairan.", "How much the discharges could trigger algal blooms in waterways."),
    why: p("Berkaitan dengan kualitas air buangan.", "Linked to wastewater quality."),
    action: p("Lihat di Mode Ahli.", "See it in Expert mode."),
  },
  {
    key: "htc",
    term: "Human toxicity",
    label: p("Risiko kesehatan manusia", "Human health risk"),
    explain: p("Potensi zat beracun (mis. Cr(VI), nikel) membahayakan kesehatan.", "The potential for toxic substances (e.g. Cr(VI), nickel) to harm health."),
    why: p("Kromium heksavalen dan kadmium diatur ketat.", "Hexavalent chromium and cadmium are strictly regulated."),
    action: p("Lihat di Mode Ahli.", "See it in Expert mode."),
  },
  {
    key: "etf",
    term: "Ecotoxicity",
    label: p("Racun bagi makhluk air", "Toxicity to aquatic life"),
    explain: p("Potensi logam berat di air limbah meracuni ikan dan organisme air.", "The potential for heavy metals in wastewater to poison fish and aquatic organisms."),
    why: p("Logam di air buangan berdampak langsung ke sungai.", "Metals in wastewater directly affect rivers."),
    action: p("Coba simulasi peningkatan pengolahan air limbah.", "Try simulating improved wastewater treatment."),
  },
  {
    key: "rum",
    term: "Resource use, minerals & metals",
    label: p("Pemakaian logam langka", "Scarce metal use"),
    explain: p("Seberapa banyak logam terbatas (kadmium, nikel, krom) yang terpakai.", "How much scarce metal (cadmium, nickel, chromium) is used."),
    why: p("Logam ini mahal dan pasokannya terbatas.", "These metals are expensive and in limited supply."),
    action: p("Kurangi larutan yang terbuang.", "Reduce wasted solution."),
  },
  {
    key: "wu",
    term: "Water use",
    label: p("Pemakaian air", "Water use"),
    explain: p("Air bersih yang diambil dan tidak kembali.", "Fresh water taken and not returned."),
    why: p("Air bilas adalah pemakaian terbesar di lini pelapisan.", "Rinse water is the largest use on a plating line."),
    action: p("Coba simulasi bilasan bertingkat.", "Try simulating counter-flow rinsing."),
  },
  {
    key: "greyWater",
    term: "Grey water footprint",
    label: p("Air pengencer polutan", "Water to dilute pollutants"),
    explain: p("Volume air bersih yang dibutuhkan untuk mengencerkan polutan sampai aman.", "The volume of fresh water needed to dilute pollutants to safe levels."),
    why: p("Menunjukkan beban polutan dalam satuan yang mudah dibayangkan.", "It shows the pollutant load in a unit that is easy to picture."),
    action: p("Turunkan konsentrasi logam di air buangan.", "Lower the metal concentration in wastewater."),
  },
  {
    key: "hotspot",
    term: "Hotspot",
    label: p("Titik boros", "Waste hotspot"),
    explain: p("Tahap yang paling banyak memakai sumber daya atau paling besar dampaknya.", "The stage that uses the most resources or has the largest impact."),
    why: p("Perbaikan di titik ini memberi hasil terbesar.", "Improvements here give the biggest gains."),
    action: p("Buka menu Titik Boros.", "Open the Waste Hotspots menu."),
  },
  {
    key: "mfca",
    term: "MFCA",
    label: p("Biaya bahan yang terbuang", "Cost of wasted materials"),
    explain: p("Nilai rupiah bahan, energi, dan pengolahan limbah yang tidak menjadi produk.", "The rupiah value of materials, energy and waste treatment that do not end up in the product."),
    why: p("Mengubah pemborosan menjadi angka rupiah.", "It turns waste into a rupiah figure."),
    action: p("Lihat rincian di menu Hasil.", "See the breakdown in the Results menu."),
  },
  {
    key: "whatif",
    term: "What-if scenario",
    label: p("Simulasi perbaikan", "Improvement simulation"),
    explain: p("Hitungan ulang “bagaimana jika” sebelum perubahan dilakukan di lini.", "A “what if” recalculation before any change is made on the line."),
    why: p("Keputusan diuji sebelum satu tangki pun diubah.", "Decisions are tested before a single tank is changed."),
    action: p("Buka menu Simulasi Perbaikan.", "Open the Improvement Simulation menu."),
  },
  {
    key: "baseline",
    term: "Baseline",
    label: p("Kondisi sekarang", "Current state"),
    explain: p("Hasil hitungan dengan data apa adanya, sebagai pembanding.", "Results calculated from the data as it is, used as the comparison point."),
    why: p("Semua perbaikan dibandingkan terhadap angka ini.", "Every improvement is compared against these figures."),
  },
  {
    key: "dragout",
    term: "Drag-out",
    label: p("Larutan terbawa part", "Drag-out"),
    explain: p("Larutan kimia yang menempel dan terbawa keluar saat part diangkat dari tangki.", "Chemical solution that clings to parts and is carried out when they are lifted from the tank."),
    why: p("Larutan ini terbuang, mencemari air bilas, dan menambah lumpur.", "This solution is wasted, contaminates rinse water and adds to sludge."),
    action: p("Coba simulasi ‘Kurangi larutan terbawa part’.", "Try the ‘Reduce drag-out’ simulation."),
  },
  {
    key: "rinse",
    term: "Rinse / counter-flow rinse",
    label: p("Bilasan / bilasan bertingkat", "Rinse / counter-flow rinse"),
    explain: p("Membilas part dengan aliran air yang dipakai ulang dari tangki bersih ke tangki kotor.", "Rinsing parts with water reused from the cleanest tank toward the dirtiest."),
    why: p("Bisa memangkas pemakaian air bilas secara besar.", "It can cut rinse water use substantially."),
    action: p("Coba simulasi ‘Bilasan bertingkat’.", "Try the ‘Counter-flow rinse’ simulation."),
  },
  {
    key: "rectifier",
    term: "Rectifier",
    label: p("Penyearah arus", "Rectifier"),
    explain: p("Alat yang mengubah listrik menjadi arus searah untuk proses pelapisan.", "Equipment that converts electricity to direct current for plating."),
    why: p("Biasanya pemakai listrik terbesar di lini.", "Usually the largest electricity user on the line."),
    action: p("Coba simulasi ‘Perbaiki penyearah arus’.", "Try the ‘Improve rectifier’ simulation."),
  },
  {
    key: "confidence",
    term: "Data pedigree / confidence",
    label: p("Tingkat keyakinan data", "Data confidence"),
    explain: p("Seberapa bisa dipercaya angka ini: dari meter (tinggi), faktur (sedang), atau perkiraan (rendah).", "How far a figure can be trusted: from a meter (high), an invoice (medium) or an estimate (low)."),
    why: p("Keputusan besar butuh angka yang bisa dipertanggungjawabkan.", "Big decisions need figures you can stand behind."),
    action: p("Ganti perkiraan dengan data meter atau faktur.", "Replace estimates with meter or invoice data."),
  },
  {
    key: "sensitivity",
    term: "Sensitivity analysis",
    label: p("Seberapa yakin hasilnya", "How certain the results are"),
    explain: p("Cek apakah kesimpulan berubah bila angka masukan meleset 10%.", "Checks whether the conclusion changes if input figures are off by 10%."),
    why: p("Menunjukkan angka mana yang paling perlu diukur teliti.", "It shows which figures most need careful measurement."),
  },
  {
    key: "scope",
    term: "Scope 1 / 2 / 3",
    label: p("Emisi langsung / dari listrik / dari rantai pasok", "Direct / electricity / supply-chain emissions"),
    explain: p("Pembagian emisi menurut sumbernya sesuai GHG Protocol.", "Emissions split by source according to the GHG Protocol."),
    why: p("Format yang diminta laporan ESG dan pelanggan.", "The format requested by ESG reports and customers."),
  },
  {
    key: "b3",
    term: p("Limbah B3", "B3 waste (hazardous waste)"),
    label: p("Limbah berbahaya (B3)", "Hazardous (B3) waste"),
    explain: p("Limbah yang wajib dikelola khusus karena beracun atau berbahaya.", "Waste that must be specially managed because it is toxic or hazardous."),
    why: p("Biaya pengolahannya tinggi dan diawasi regulator.", "Treatment is costly and overseen by regulators."),
    action: p("Kurangi lumpur dengan mengurangi larutan terbuang.", "Reduce sludge by wasting less solution."),
  },
  {
    key: "ipal",
    term: p("IPAL / WWTP", "WWTP (IPAL)"),
    label: p("Pengolahan air limbah", "Wastewater treatment"),
    explain: p("Unit yang membersihkan air limbah sebelum dibuang.", "The unit that cleans wastewater before it is discharged."),
    why: p("Sumber utama lumpur B3 di lini.", "The main source of B3 sludge on the line."),
  },
  {
    key: "run",
    term: "Run",
    label: p("Hasil hitung tersimpan", "Saved result"),
    explain: p("Satu kali perhitungan yang dikunci dan diberi nomor agar bisa ditelusuri.", "A single calculation that is locked and numbered so it can be traced."),
    why: p("Laporan selalu merujuk nomor hasil sehingga angkanya bisa dicek ulang.", "Reports always cite the result number so the figures can be rechecked."),
    action: p("Tekan “Hitung hasil” setelah data berubah.", "Press “Calculate results” after the data changes."),
  },
  {
    key: "costPerM2",
    term: "Cost per functional unit",
    label: p("Biaya per m²", "Cost per m²"),
    explain: p("Total biaya proses (bahan, listrik, air, tenaga kerja, limbah) dibagi luas dilapisi.", "Total process cost (materials, electricity, water, labour, waste) divided by plated area."),
    why: p("Dasar harga jual dan target efisiensi.", "The basis for selling price and efficiency targets."),
    action: p("Isi harga riil di Data Saya → Harga.", "Enter real prices in My Data → Prices."),
  },
  {
    key: "status",
    term: "Status indicator",
    label: p("Baik / Perlu perhatian / Kritis", "Good / Needs attention / Critical"),
    explain: p(
      "Dibandingkan hasil tersimpan sebelumnya: membaik atau tetap = Baik, naik sampai 10% = Perlu perhatian, naik lebih dari 10% = Kritis.",
      "Compared with the previous saved result: improved or unchanged = Good, up to 10% higher = Needs attention, more than 10% higher = Critical.",
    ),
    why: p("Menunjukkan arah perubahan tanpa harus membaca angka.", "Shows the direction of change without reading the numbers."),
    action: p("Simpan hasil tiap bulan agar ada pembanding.", "Save a result every month so there is a comparison."),
  },
];

function entry(r: RawEntry): GlossaryEntry {
  return {
    key: r.key,
    get term() {
      return typeof r.term === "string" ? r.term : pick(r.term);
    },
    get label() {
      return pick(r.label);
    },
    get explain() {
      return pick(r.explain);
    },
    get why() {
      return r.why ? pick(r.why) : undefined;
    },
    get action() {
      return r.action ? pick(r.action) : undefined;
    },
  };
}

export const GLOSSARY: GlossaryEntry[] = RAW.map(entry);

export const GLOSSARY_BY_KEY = new Map(GLOSSARY.map((g) => [g.key, g]));

export function term(key: string): GlossaryEntry | undefined {
  return GLOSSARY_BY_KEY.get(key);
}
