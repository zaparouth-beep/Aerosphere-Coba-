# Changelog

Format: satu entri per milestone (lihat `docs/AUDIT.md` Bagian 7). Angka golden mengacu ke `docs/AEROSPHERE_SPEC.md` §4.8.

## Aplikasi dua bahasa: Indonesia dan English · 2026-10-12

### Ditambahkan
- Tombol **ID | EN** di bar atas aplikasi dan header situs publik. Pilihan disimpan di browser; bahasa bawaan Indonesia.
- Semua halaman diterjemahkan: Beranda, Data Saya (termasuk unggah dokumen), Hasil, Titik Boros, Simulasi Perbaikan, Laporan (keempat jenis, termasuk arahan perbaikan dan mode ubah teks), Pengaturan, Bantuan, halaman Mode Ahli, situs publik, masuk/daftar, pilih paket, dan onboarding. Juga pemberitahuan, pesan validasi, dan pesan dari mesin hitung.
- Format angka dan tanggal mengikuti bahasa (`1.234,5` ↔ `1,234.5`).
- `lib/i18n.tsx` (`tx`, `T`, `pick`, `locale`), `components/layout/LangRoot.tsx`, `components/layout/LangSwitch.tsx`, panduan dan daftar istilah `docs/I18N.md`, spesifikasi §5.0a.
- Hasil hitung tetap identik di kedua bahasa. Teks yang tersimpan di hasil (pesan validasi, peringatan, langkah trace) menyimpan dua bahasa. Tes `tests/i18n/engine_language.test.ts` memastikan hash sama.
- Tes e2e `tests/e2e/bahasa.spec.ts` (ganti bahasa, tersimpan setelah muat ulang). Tangkapan layar: `docs/screenshots/bahasa-inggris-*.png`.

### Catatan
- Data proyek tidak diterjemahkan, termasuk proyek contoh: nama/deskripsi simulasi, tujuan kajian, asumsi, nama periode. Isi template Excel juga tetap Indonesia agar bisa dibaca ulang.

## Arahan perbaikan mengikuti hasil hitung · 2026-10-12

### Masalah
- Arahan perbaikan selalu berasal dari tiga simulasi yang sama (S1–S3). Bila data diubah, misalnya semua diisi 1, isi dan urutan arahan tetap sama; hanya angkanya yang bergeser. Alasannya pun bisa tidak cocok: pemakai listrik terbesar ada di Utilitas, tetapi arahan tetap membahas penyearah arus.

### Diubah
- Arahan dipilih dari hasil hitung data terkini (spesifikasi §5.5.1). Semua tuas di pustaka dicoba mesin hitung pada data lini, termasuk yang belum ada di daftar simulasi, lalu yang manfaatnya terbesar dijabarkan.
- Alasan tiap arahan mengutip komponen dan jumlah dari data sendiri.
- Arahan baru:
  - "Periksa kembali data input" bila sebagian besar baris bernilai sama;
  - "Kaji pemakaian {komponen}" untuk penyumbang karbon terbesar yang belum disasar;
  - target air buangan mengikuti baku mutu yang terlampaui.
- Nilai bawaan tuas dipindah ke mesin hitung (`LEVER_DEFAULTS`).
- Tes: `tests/report/report_edits.test.ts` (data berbeda menghasilkan arahan berbeda; data dummy; tuas tanpa komponen dilewati) dan e2e "directions follow the data". Tangkapan layar: `docs/screenshots/laporan-arahan-ikut-data.png`.

## Perbaikan: Simulasi Perbaikan mengikuti perubahan data · 2026-10-12

### Masalah
- Setelah "Hitung hasil", semua menu (termasuk Simulasi) menampilkan hasil tersimpan yang terkunci. Angka yang diubah di Data Saya, atau di pengaturan simulasi, tidak terlihat di Simulasi. Pengaturan simulasi seolah-olah kembali ke angka lama.
- Perbaikan penyearah arus, penutup tangki, dan bilasan hanya mengenali nama komponen berbahasa Inggris ("Rectifier", "Heater"). Komponen bernama "Listrik penyearah arus", "Pemanas", atau "Kabut krom" tidak ikut berubah.
- Perbaikan kabut krom dan target logam di air buangan tidak punya ukuran yang terlihat, sehingga tampak "tidak ada perubahan".

### Diperbaiki
- **Simulasi selalu dihitung dari data terkini.** Bila menu lain sedang menampilkan hasil tersimpan, muncul keterangan dan tombol "Tampilkan data terkini di semua menu".
- Mengubah data saat hasil tersimpan sedang ditampilkan memindahkan tampilan ke data terkini, disertai pemberitahuan. Hasil tersimpan tidak berubah dan bisa dipilih lagi di "Periode".
- "Simpan hasil simulasi" tidak lagi mengunci tampilan ke hasil simulasi itu.
- Tuas perbaikan mengenali nama komponen berbahasa Indonesia (penyearah, pemanas, DI/RO, kabut, koagulan/penggumpal). Bila data tidak berisi komponen yang bisa diubah, simulasi menuliskannya dengan jelas ("Tidak ada listrik penyearah arus di data proyek ...") dan tidak lagi diam saja.
- Indikator baru dari mesin hitung: **emisi udara langsung** dan **logam di air buangan** (Q × C untuk Ni, Cr, Cd, Zn, Cu).
- "Coba perubahan" menampilkan semua ukuran yang berubah (listrik, air, bahan kimia, limbah B3, emisi udara, logam di air buangan, biaya) beserta tabel **Sekarang → Sesudah** per periode, sehingga perubahan data langsung terlihat dalam angka absolut.
- Kolom pengaturan simulasi kini punya label untuk pembaca layar.
- Tes: `tests/simulasi/simulasi.test.ts` dan `tests/e2e/simulasi.spec.ts` (alur: hitung hasil → ubah data → simulasi berubah). Tangkapan layar: `docs/screenshots/simulasi-ikut-data.png`.

## Laporan: arahan perbaikan rinci dan teks yang bisa diubah · 2026-10-12

### Ditambahkan
- **Arahan perbaikan** di semua laporan (spesifikasi §5.5.1): untuk setiap perbaikan terbaik ada alasan, langkah kerja berurutan, penanggung jawab, target dari mesin hitung, cara mengukur keberhasilan, waktu, dan dasar perhitungan. Langkah kerja ditulis per tuas (drag-out, konsentrasi bath, bilasan bertingkat, penyearah arus, penutup tangki, fume suppressant, target efluen, listrik rendah emisi) dalam bahasa Indonesia dan Inggris (`lib/report/directions.ts`).
- **Ubah teks laporan** (spesifikasi §5.5.2) di Kajian LCA, Ringkasan untuk manajemen, Teknis, dan Kepatuhan. Teks bisa diubah, arahan bisa dikeluarkan, dan catatan bisa ditambah sebelum dicetak atau diunduh (`components/report/Editable.tsx`, `lib/report/edits.ts`).
  - Angka yang tidak berasal dari mesin hitung memblokir cetak/unduh.
  - Perubahan tersimpan per nomor hasil, dan ada tombol untuk mengembalikan teks asli.
  - Excel Kajian LCA ikut memakai teks yang diubah.
- Tes: `tests/report/report_edits.test.ts` dan `tests/e2e/laporan.spec.ts`. Tangkapan layar: `docs/screenshots/laporan-ubah-teks.png`, `laporan-arahan-perbaikan.png`, `laporan-teknis-onepager.png`.

### Diubah
- Bahasa laporan Teknis/Kepatuhan dirapikan menjadi bahasa Indonesia profesional, misalnya "Climate change terpetakan" menjadi "Jejak karbon (perubahan iklim)", "Goal & scope" menjadi "Tujuan dan ruang lingkup", "Positive/Negative" menjadi "Produk (positif)/Kerugian (negatif)", dan status skenario menjadi Draf/Direkomendasikan/Disetujui. GRI dan PROPER kini diberi paragraf pengantar.
- Kalimat kesimpulan Ringkasan untuk manajemen dibuat lebih formal.

## Perbaikan: unggah file Excel dari software lain · 2026-10-11

- Unggah .xlsx yang dibuat ERP/sistem lain (XML berawalan, mis. `<x:workbook>`) gagal dengan "Impor gagal: Cannot read properties of undefined (reading 'sheets')". Sekarang file seperti itu dibaca oleh pembaca cadangan `lib/io/xlsxLite.ts` (hanya nilai sel; rumus tidak dijalankan), dan pemeriksaan templat tidak lagi menggagalkan unggahan.
- Tes: `tests/fixtures/import/erp-prefix.xlsx`, tes unit, dan tes e2e Excel (workbook biasa + workbook ERP).

## Unggah dokumen apa pun + baca dengan AI · 2026-10-11

### Ditambahkan
- **Data Saya → Unggah dokumen**: Excel (.xlsx), CSV, PDF berteks, dan Word (.docx). Spesifikasi §5.2.5a.
  - Pembaca otomatis berbasis aturan di browser (`lib/io/docExtract.ts`, `lib/io/smartReader.ts`): bagian INPUT/OUTPUT, kolom, satuan, angka `1.250,5`/`1,250.5`, baris PDF yang bergeser, beberapa tabel per halaman.
  - Layar tinjau yang bisa diedit; dokumen harus berisi input **dan** output sebelum bisa diterapkan.
  - **Ganti data proyek** = versi data baru, data lama jadi cadangan dan bisa dikembalikan.
  - Hasil dampak dari software lain tampil sebagai **Pembanding dari dokumen** di Hasil, tidak dipakai menghitung.
- **Analisis dengan AI** (Claude) lewat Netlify Function `netlify/functions/ai-import.mts` (`/api/ai-import`).
  - Hanya berjalan setelah pengguna mencentang persetujuan pengiriman dokumen.
  - Keluaran JSON terstruktur, divalidasi; angka yang tidak ada di dokumen ditandai dan tidak dipakai.
  - Aktif hanya di build Netlify (`NEXT_PUBLIC_AI_IMPORT=1`) dan bila `ANTHROPIC_API_KEY` dipasang di Netlify → Site configuration → Environment variables. Tanpa kunci, tombol nonaktif dengan keterangan.
- Tes: `tests/import/smartReader.test.ts`, `tests/import/aiImport.test.ts` (SDK di-mock, tanpa panggilan API sungguhan), `tests/e2e/import.spec.ts` (PDF, Word, CSV hanya input); contoh dokumen di `tests/fixtures/import/`.
- Tangkapan layar: `docs/screenshots/unggah-dokumen-tinjau.png`, `unggah-dokumen-pembanding.png`.

### Catatan
- Belum didukung: `.xls` lama (simpan ulang sebagai .xlsx) dan PDF hasil scan/gambar.
- Worker PDF disalin ke `public/` saat build (`scripts/copy-pdf-worker.mjs`).

## Teks kartu paket · 2026-10-11

- Judul besar di kartu paket diganti: Esensial "Temukan Titik Boros Utama", Profesional "Analisis Mendalam, Keputusan Lebih Tepat", Industri "Solusi Sesuai Kebutuhan Perusahaan". Coba tetap "Gratis 14 hari". Field `price` di `PlanDef` diganti nama menjadi `tagline`.
- Badge Profesional "Paling lengkap" menjadi "Rekomendasi", karena Industri punya cakupan fitur lebih luas.

## Harga di tombol paket · 2026-10-11

- Kartu paket (Pengaturan → Paket, dan halaman pilih paket setelah daftar): tombol Profesional sekarang bertuliskan **IDR 18.000.000/year** dan tetap bisa dipilih. Tombol Esensial dan Industri bertuliskan **-**, dinonaktifkan, dengan keterangan "Harga belum tersedia". Tombol Coba tidak berubah.

## Hasil, Titik Boros, dan Simulasi dengan konsep alur interaktif · 2026-10-11

Konsep diambil dari analisis video "How to automate LCAs with Makersite" (`docs/ANALISIS_VIDEO_MAKERSITE.md`).

### Ditambahkan
- **Hasil**: ringkasan berbentuk kartu.
  - Kartu Informasi, donat jejak karbon per tahap, dan donat nilai terbuang per pos, masing-masing dengan total di tengah dan kotak saran.
  - Alur bahan & energi dengan ubin indikator.
  - Siklus hidup: dibeli vs. di lini; pemakaian dan akhir masa pakai tidak dikaji.
  - Daftar isi lengket di kanan.
- **Titik Boros**: tampilan **Alur** di samping Batang 100%.
  - Diagram sumber → tahap → total yang bisa di-hover dan diklik.
  - Panel **Saran & alat** untuk kotak yang dipilih.
  - **Telusuri lebih dalam** ke komponen, dengan breadcrumb dan "Kembali ke tampilan awal".
- **Simulasi**: **Coba perubahan**.
  - Terapkan satu perbaikan ke alur dengan perubahan per kotak (▼/▲ %) dan tombol Sebelum/Sesudah.
  - Panel **Analitik perubahan** dengan chip Δ dan pin untuk membandingkan beberapa perbaikan.
- Engine:
  - `lib/engine/flow.ts`: `buildFlow`, `compareFlows`, `lifeCycleSplit`, `wasteItems`.
  - `RunResult.useContributions`: kontribusi per komponen untuk air, limbah B3, dan nilai terbuang.
- Komponen: `components/flow/FlowSankey.tsx` (diagram SVG sendiri), `FlowExplorer.tsx`, `components/hasil/Overview.tsx`, `components/simulasi/ChangeLab.tsx`.
- Tes: `tests/flow/flow.test.ts` (10 tes: kekekalan alur, nilai golden, drill-in, sebelum/sesudah, siklus hidup) dan `tests/e2e/alur.spec.ts` (Hasil, Titik Boros Alur, Simulasi). Helper e2e dipindah ke `tests/e2e/helpers.ts`.
- Tangkapan layar: `docs/screenshots/hasil-*.png`, `titik-boros-alur*.png`, dan `simulasi-coba-perubahan.png`.

## Akun demo dengan semua fitur (uji dewan juri) · 2026-10-11

- Akun demo publik (`demo@aerosphere.demo`) sekarang memakai paket **Industri**: semua fitur terbuka (Mode Ahli, Laporan Teknis & Kepatuhan, bobot keputusan, simulasi tanpa batas), tanpa tanda "Contoh" dan tanpa batas uji coba 14 hari. Halaman Masuk menjelaskan hal ini.
- Tes `accounts.test.ts` disesuaikan, dan ada tes e2e baru "demo account has every feature".

## Titik Boros dikerjakan ulang (§5.3 baru) · 2026-10-10

### Diubah
- Halaman **Titik Boros** sekarang punya tiga area dengan satu sistem warna kelas porsi: Merah = titik boros (≥ ambang), Oranye = tinggi (20% – < ambang), Kuning = sedang (10–<20%), Hijau = rendah (>0–<10%), Abu-abu = tidak ada atau belum dihitung. Setiap warna disertai label dan ikon, kontras teks ≥ 4,5:1, dan ada satu legenda di atas.
  - **A:** batang bertumpuk 100% per indikator (4 dampak dengan faktor + air, limbah B3, nilai terbuang). Segmen A–F berwarna kelas, segmen merah diberi outline tebal dan label "TITIK BOROS", total per m² di kanan, tooltip berisi dua pemicu terbesar, dan catatan "12 kategori dampak lain belum dihitung".
  - **B:** tabel heatmap dengan baris yang sama. Persen di Mode Ringkas; toggle "% / nilai" per m² di Mode Ahli. Sel terbesar dicetak tebal. Tombol "Unduh tabel (Excel)" dan "Salin".
  - **C:** kotak per tahap diurutkan dari kelas paling parah, berisi di mana boros, pemicu, alasan teknis (§7) dengan sumber, dan simulasi yang bisa dicoba beserta tombol "Lihat perhitungannya".
  - Interaksi antar-area lewat hover dan klik. Tata letak 12 kolom (7/5) pada ≥ 1280 px, bertumpuk di bawahnya.
- Ambang titik boros sekarang **pengaturan proyek** (`Project.hotspotThresholdPct`, Pengaturan → Proyek, bawaan 30%). Ambang ini ikut ke run, bukan lagi slider di UI.
- Simulasi Perbaikan membuka skenario dari `?skenario=<id>`.

### Dihapus
- Daftar "Urutan tahap paling bermasalah" dengan skor, panel "Kenapa …?", dan detail Mode Ahli lama (`ExpertHotspot`: heatmap, Pareto, slider bobot prioritas).

### Ditambahkan
- Engine `buildTitikBoros` dan `severityOf` (`lib/engine/titikBoros.ts`); teks dan format di `lib/view/titikBoros.ts`; ekspor Excel di `lib/io/titikBorosExport.ts`.
- Tes unit: `tests/titik-boros/` (17 tes: kelas, ambang, nilai uji, urutan kotak, jumlah 100%, kontras warna).
- **E2E Playwright di repo** (`playwright.config.ts`, `tests/e2e/titik-boros.spec.ts`, `npm run test:e2e` setelah `npm run build:static`): desktop dan HP, interaksi, semua tombol, Mode Ahli, ambang 40%, tanpa istilah teknis di Mode Ringkas, tanpa error console.
- Tangkapan layar `docs/screenshots/titik-boros-desktop.png`, `-desktop-sorot.png`, dan `-hp.png` (`SCREENSHOTS=1 npm run test:e2e`).

## M6 — Laporan Kajian LCA format PROPER (Bagian 8) · 2026-10-10

M6 dikerjakan atas permintaan langsung, sebelum M2–M5.

### Ditambahkan
- Tab utama **"Laporan Kajian LCA"** di menu Laporan. Laporan Ringkas Manajemen pindah ke tab kedua "Ringkasan untuk manajemen" (§5.5).
- Urutan bagian mengikuti laporan acuan: judul, kalimat pembuka + daftar standar (§8.1.2), Tujuan, Ruang Lingkup (kalimat grave wajib, satuan fungsi 1 m²), Kesimpulan dengan daftar butir dua kolom per Titik Cradle / Gate / Grave ("Tidak dikaji (di luar lingkup)") dan kalimat penutup EPD.
- **Tabel Ringkasan Evaluasi Dampak Proses Inti**: kelompok Dampak Primer / Sekunder / Pemakaian Energi; kolom No, Kategori, Satuan (%), Metode, lalu satu kolom per tahap A–F. Baris induk "terdiri dari:" untuk 6, 7, 12. Dua desimal, sel terbesar per baris ditebalkan. GWP demo: 10,20 · 8,11 · 38,53 · 17,20 · 6,41 · 19,56 (sama dengan baris golden §8.1.6).
- Kategori tanpa faktor ditulis **"belum dihitung¹"** dengan catatan kaki (13 dari 16 baris), tidak pernah 0. GWP, AP, EP diisi sementara dari `screening_v1` dengan tanda ², dan komponen tanpa faktor dicatat di ³.
- Gaya laporan acuan kedua: tabel **nilai absolut per 1 m² dan per periode** (hulu/cradle, proses inti/gate, total; notasi 7,39E+00), tabel inventori utama, dan **Indikator Kualitas Data** (jumlah data, % primer vs sekunder, rincian asal data, profil faktor, tingkat keyakinan).
- **Kesimpulan Dampak Tertinggi dan Kemungkinan Alasannya** (§8.1.8): per kategori ada tahap tertinggi, pemicu dari engine (dikelompokkan per sumber, listrik dengan nama alat), dan alasan teknis dari pustaka §7 (`lib/content/reasons.ts`, ID/EN). Kalimat lintas kategori tanpa normalisasi ditulis apa adanya. Tiga rekomendasi dengan hemat Rp dan perubahan jejak karbon. Ada juga daftar sumber alasan teknis.
- Kaki halaman di setiap halaman: nomor hasil, profil faktor + versi nilai, tanggal, "Rahasia – Tenant", "Belum melalui tinjauan kritis pihak ketiga".
- Bahasa: **Bahasa Indonesia / English / Dwibahasa** (Inggris dicetak miring di bawah teks Indonesia).
- Ekspor **PDF A4** (`@page` A4, margin 2 cm, logo di kepala halaman, kepala dan kaki halaman berulang, baris tabel tidak terpotong; ID dan EN masing-masing 4 halaman) dan **Excel** (sheet `Laporan`, `Tabel_Dampak_%`, `Nilai_Absolut`, `Kesimpulan`, `Data_Input`, `Faktor`). Nama file memuat kelas informasi.
- Engine: `buildStudyModel` (`lib/engine/study.ts`). `RunResult` mendapat `areaPlatedM2` dan `dataQuality`, kontribusi membawa `deviceRole`, dan tabel faktor punya `label` tampilan.
- Tes `tests/report/lca_study_report.test.ts` (16 tes). Ditulis dulu dan gagal sebelum implementasi.
- Tangkapan layar di `docs/screenshots/`: halaman A4 (ID 4, EN 4, Dwibahasa 9) dan tampilan layar penuh per bahasa.

## M1 — Engine + golden (A1, A2) · 2026-10-10

### Ditambahkan
- `runAnalysis(input, factors)` di `lib/engine/index.ts`: fungsi murni, tanpa UI/jam/acak, setiap angka utama punya jejak (`trace`).
- Model data engine `lib/engine/types.ts` (`ProjectInput`, `InventoryComponent`, `FactorSet`, `RunResult`) sesuai §3.1.
- Tabel faktor berversi: `data/factors/screening_v1.json` (`screening_v1@2026-10-11`: GWP, AP, EP, ADP fosil) dan `data/factors/proper_inalum_v1.json` (16 baris kategori, semua faktor `null` → "belum dihitung", bukan 0).
- Modul: `inventory.ts` (adaptor `Project → ProjectInput`, keputusan Q2-b), `impacts.ts` (Dampak[s,k] + status `computed/partial/not_computed`), `water.ts` (efluen = 0,9 × air masuk kecuali terukur; peringatan `WATER_BALANCE`), `costs.ts` (nilai terbuang §4.5), `confidence.ts` (§4.7), `trace.ts`, `factors.ts`; `findHotspots` (§4.6: share ≥ 30% atau peringkat 1, 3 pemicu teratas) di `hotspot.ts`.
- Tes golden `tests/golden/plating_demo_v1.json`, `tests/golden/screening_v1.test.ts` (semua baris §4.8.2), `tests/golden/app_integration.test.ts` (angka yang tampil di aplikasi), tes properti share = 100% ± 0,01 (`fast-check`, dependensi dev baru).

### Diubah
- **A1:** jejak karbon kini menghitung listrik + bahan kimia + air (proksi skrining), bukan listrik saja: 1.848,495 kg CO₂e = 7,394 kg CO₂e/m² (sebelumnya 591,5 = 2,37/m²). Mode Ahli (EF 3.1, climate change) memakai proksi yang sama sehingga angkanya sama dengan Mode Ringkas.
- **A2:** "nilai terbuang" kini Rp22.677.500 = 45,3% dari biaya proses (sebelumnya 97% karena listrik, tenaga kerja, dan penyusutan ikut dihitung terbuang). Dipakai di kesimpulan Mode Ringkas, kartu "Nilai yang terbuang" di Hasil, dan wawasan Tanya AeroSphere. MFCA lama tetap ada di Mode Ahli (Aliran Biaya).
- Faktor listrik proyek (atau tuas "Pakai listrik lebih bersih") menimpa faktor GWP listrik skrining; versinya tercatat, mis. `screening_v1@2026-10-11+grid=0.3`.
- Simulasi "Kurangi larutan terbawa" kini menurunkan jejak karbon (−11%), sebelumnya 0%.
- Sensitivitas jejak karbon per m²: parameter teratas kini "Volume produksi ±10%" (sebelumnya faktor grid), karena listrik tidak lagi 100% dari karbon.
- Manifest run menyimpan `factorVersion`; versi engine `aerosphere-engine 2.2.0`.

### Tidak berubah (sengaja)
- Landing page, mockup, deck, dan banner tidak disentuh (masih memuat angka era 2,37 kg/m² dan 97% di gambar/teks statis).
- Proyek yang sudah tersimpan di browser pengguna tidak dimigrasi; bahan kimia/air tanpa pemetaan tetap dihitung oleh engine baru (pemetaan per `flowKey`), tetapi tampilan EF 3.1 Mode Ahli untuk proyek lama tetap listrik saja sampai dipetakan ulang.
