# Changelog

Format: satu entri per milestone (lihat `docs/AUDIT.md` Bagian 7). Angka golden mengacu ke `docs/AEROSPHERE_SPEC.md` §4.8.

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
