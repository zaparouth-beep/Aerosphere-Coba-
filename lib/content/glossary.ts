/**
 * UI label dictionary (PRD v1.1 §3.0.4): technical term → everyday label →
 * one-sentence explanation. `why` and `action` feed the 3-line "Apa ini?"
 * popover (§3.0.5): what it means, why it matters, what you can do.
 */

export interface GlossaryEntry {
  key: string;
  term: string;
  label: string;
  explain: string;
  why?: string;
  action?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { key: "fu", term: "Functional unit (1 m²)", label: "Per 1 m² permukaan dilapisi", explain: "Semua angka dihitung untuk setiap 1 m² permukaan part yang dilapisi agar bisa dibandingkan antarbulan.", why: "Bulan dengan produksi besar tidak otomatis terlihat lebih boros.", action: "Pastikan total luas dilapisi di Data Saya sudah benar." },
  { key: "referenceFlow", term: "Reference flow", label: "Total luas dilapisi", explain: "Jumlah m² yang dilapisi dalam periode ini.", why: "Menjadi pembagi semua angka per m².", action: "Isi dari catatan produksi atau QA." },
  { key: "boundary", term: "System boundary", label: "Tahap yang dihitung", explain: "Bagian proses yang masuk perhitungan, dari pembersihan sampai pengolahan air limbah.", why: "Menentukan apa saja yang termasuk dalam angka hasil.", action: "Default: tahap A–F; ubah di Mode Ahli bila perlu." },
  { key: "cutoff", term: "Cut-off", label: "Yang tidak dihitung", explain: "Hal yang sengaja tidak dihitung karena kecil atau di luar kendali pabrik.", why: "Supaya pembaca tahu batas laporan.", action: "Lihat daftar di laporan teknis." },
  { key: "lci", term: "LCI (Life Cycle Inventory)", label: "Pemakaian & buangan", explain: "Daftar listrik, air, bahan kimia yang dipakai dan limbah yang keluar.", why: "Semua hasil dihitung dari daftar ini.", action: "Lengkapi di Data Saya." },
  { key: "lcia", term: "LCIA", label: "Dampak lingkungan", explain: "Hasil perhitungan pengaruh pemakaian dan buangan itu terhadap lingkungan.", why: "Menunjukkan dampak selain biaya.", action: "Buka menu Hasil." },
  { key: "cc", term: "Climate change / GWP", label: "Jejak karbon (kg CO₂e)", explain: "Jumlah gas rumah kaca yang dihasilkan, disetarakan dengan CO₂.", why: "Diminta pelanggan OEM dan laporan ESG.", action: "Cek perbaikan listrik dan bahan kimia di Simulasi Perbaikan." },
  { key: "ac", term: "Acidification", label: "Potensi hujan asam", explain: "Seberapa besar emisi yang bisa membuat tanah dan air menjadi asam.", why: "Relevan untuk kabut asam dari pickling dan plating.", action: "Lihat di Mode Ahli." },
  { key: "euf", term: "Eutrophication", label: "Potensi pencemaran nutrien air", explain: "Seberapa besar buangan yang bisa memicu ledakan alga di perairan.", why: "Berkaitan dengan kualitas air buangan.", action: "Lihat di Mode Ahli." },
  { key: "htc", term: "Human toxicity", label: "Risiko kesehatan manusia", explain: "Potensi zat beracun (mis. Cr(VI), nikel) membahayakan kesehatan.", why: "Kromium heksavalen dan kadmium diatur ketat.", action: "Lihat di Mode Ahli." },
  { key: "etf", term: "Ecotoxicity", label: "Racun bagi makhluk air", explain: "Potensi logam berat di air limbah meracuni ikan dan organisme air.", why: "Logam di air buangan berdampak langsung ke sungai.", action: "Coba simulasi peningkatan pengolahan air limbah." },
  { key: "rum", term: "Resource use, minerals & metals", label: "Pemakaian logam langka", explain: "Seberapa banyak logam terbatas (kadmium, nikel, krom) yang terpakai.", why: "Logam ini mahal dan pasokannya terbatas.", action: "Kurangi larutan yang terbuang." },
  { key: "wu", term: "Water use", label: "Pemakaian air", explain: "Air bersih yang diambil dan tidak kembali.", why: "Air bilas adalah pemakaian terbesar di lini pelapisan.", action: "Coba simulasi bilasan bertingkat." },
  { key: "greyWater", term: "Grey water footprint", label: "Air pengencer polutan", explain: "Volume air bersih yang dibutuhkan untuk mengencerkan polutan sampai aman.", why: "Menunjukkan beban polutan dalam satuan yang mudah dibayangkan.", action: "Turunkan konsentrasi logam di air buangan." },
  { key: "hotspot", term: "Hotspot", label: "Titik boros", explain: "Tahap yang paling banyak memakai sumber daya atau paling besar dampaknya.", why: "Perbaikan di titik ini memberi hasil terbesar.", action: "Buka menu Titik Boros." },
  { key: "mfca", term: "MFCA", label: "Biaya bahan yang terbuang", explain: "Nilai rupiah bahan, energi, dan pengolahan limbah yang tidak menjadi produk.", why: "Mengubah pemborosan menjadi angka rupiah.", action: "Lihat rincian di menu Hasil." },
  { key: "whatif", term: "What-if scenario", label: "Simulasi perbaikan", explain: "Hitungan ulang “bagaimana jika” sebelum perubahan dilakukan di lini.", why: "Keputusan diuji sebelum satu tangki pun diubah.", action: "Buka menu Simulasi Perbaikan." },
  { key: "baseline", term: "Baseline", label: "Kondisi sekarang", explain: "Hasil hitungan dengan data apa adanya, sebagai pembanding.", why: "Semua perbaikan dibandingkan terhadap angka ini." },
  { key: "dragout", term: "Drag-out", label: "Larutan terbawa part", explain: "Larutan kimia yang menempel dan terbawa keluar saat part diangkat dari tangki.", why: "Larutan ini terbuang, mencemari air bilas, dan menambah lumpur.", action: "Coba simulasi ‘Kurangi larutan terbawa part’." },
  { key: "rinse", term: "Rinse / counter-flow rinse", label: "Bilasan / bilasan bertingkat", explain: "Membilas part dengan aliran air yang dipakai ulang dari tangki bersih ke tangki kotor.", why: "Bisa memangkas pemakaian air bilas secara besar.", action: "Coba simulasi ‘Bilasan bertingkat’." },
  { key: "rectifier", term: "Rectifier", label: "Penyearah arus", explain: "Alat yang mengubah listrik menjadi arus searah untuk proses pelapisan.", why: "Biasanya pemakai listrik terbesar di lini.", action: "Coba simulasi ‘Perbaiki penyearah arus’." },
  { key: "confidence", term: "Data pedigree / confidence", label: "Tingkat keyakinan data", explain: "Seberapa bisa dipercaya angka ini: dari meter (tinggi), faktur (sedang), atau perkiraan (rendah).", why: "Keputusan besar butuh angka yang bisa dipertanggungjawabkan.", action: "Ganti perkiraan dengan data meter atau faktur." },
  { key: "sensitivity", term: "Sensitivity analysis", label: "Seberapa yakin hasilnya", explain: "Cek apakah kesimpulan berubah bila angka masukan meleset 10%.", why: "Menunjukkan angka mana yang paling perlu diukur teliti." },
  { key: "scope", term: "Scope 1 / 2 / 3", label: "Emisi langsung / dari listrik / dari rantai pasok", explain: "Pembagian emisi menurut sumbernya sesuai GHG Protocol.", why: "Format yang diminta laporan ESG dan pelanggan." },
  { key: "b3", term: "Limbah B3", label: "Limbah berbahaya (B3)", explain: "Limbah yang wajib dikelola khusus karena beracun atau berbahaya.", why: "Biaya pengolahannya tinggi dan diawasi regulator.", action: "Kurangi lumpur dengan mengurangi larutan terbuang." },
  { key: "ipal", term: "IPAL / WWTP", label: "Pengolahan air limbah", explain: "Unit yang membersihkan air limbah sebelum dibuang.", why: "Sumber utama lumpur B3 di lini." },
  { key: "run", term: "Run", label: "Hasil hitung tersimpan", explain: "Satu kali perhitungan yang dikunci dan diberi nomor agar bisa ditelusuri.", why: "Laporan selalu merujuk nomor hasil sehingga angkanya bisa dicek ulang.", action: "Tekan “Hitung hasil” setelah data berubah." },
  { key: "costPerM2", term: "Cost per functional unit", label: "Biaya per m²", explain: "Total biaya proses (bahan, listrik, air, tenaga kerja, limbah) dibagi luas dilapisi.", why: "Dasar harga jual dan target efisiensi.", action: "Isi harga riil di Data Saya → Harga." },
  { key: "status", term: "Status indicator", label: "Baik / Perlu perhatian / Kritis", explain: "Dibandingkan hasil tersimpan sebelumnya: membaik atau tetap = Baik, naik sampai 10% = Perlu perhatian, naik lebih dari 10% = Kritis.", why: "Menunjukkan arah perubahan tanpa harus membaca angka.", action: "Simpan hasil tiap bulan agar ada pembanding." },
];

export const GLOSSARY_BY_KEY = new Map(GLOSSARY.map((g) => [g.key, g]));

export function term(key: string): GlossaryEntry | undefined {
  return GLOSSARY_BY_KEY.get(key);
}
