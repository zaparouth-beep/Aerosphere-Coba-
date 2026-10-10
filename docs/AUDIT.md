# AeroSphere LCA — Audit Repo (Milestone M0)

**Tanggal:** 10 Oktober 2026 · **Commit yang diaudit:** `fc48d56` (branch `claude/loving-edison-bnbrzq`, sama dengan yang ter-deploy)
**Acuan:** `docs/AEROSPHERE_SPEC.md` v1.0, laporan LCA INALUM 2025 (ID & EN), laporan LCA Pusri 2025.
**Status:** audit saja. Tidak ada kode yang diubah. Bagian 6 berisi pertanyaan yang perlu diputuskan sebelum M1.

---

## 1. Ringkasan

- Aplikasi sudah punya mesin hitung terpisah (`lib/engine`), run terkunci dengan hash, jejak audit, dan semua tombol yang terlihat punya handler. Jadi pekerjaan M1–M7 lebih banyak **mengganti rumus dan model data** daripada membangun dari nol.
- **A1 dan A2 terkonfirmasi** dengan angka dari engine: jejak karbon hanya dari listrik (591,545 kg; 21 aliran tanpa faktor), dan "nilai terbuang" 97,19% berasal dari alokasi massa MFCA.
- **A4, A5, A10 perlu dikoreksi:** tombol hapus berfungsi untuk Admin tetapi *disabled tanpa alasan* untuk paket Coba (akun demo); tombol run sudah ada ("Hitung hasil") tetapi tidak ada halaman riwayat/bandingkan; efluen demo sudah 5,85 m³ di kode.
- Ada **15 hal yang bertentangan** antara kode, spesifikasi, PRD v1.1, dan laporan referensi (Bagian 6). Saya tidak memilih sendiri.

---

## 2. Peta repo

### 2.1 Framework & build

| Butir | Temuan | Lokasi |
| --- | --- | --- |
| Framework | Next.js 14.2 (App Router), React 18, TypeScript 5.6, Tailwind 3 | `package.json` |
| Mode build | Ekspor statis (`output: "export"`) bila `STATIC_EXPORT=1`; tanpa server | `next.config.mjs` |
| State | zustand 4 + `persist` | `lib/store/useAppStore.ts` |
| Validasi data | zod (`parseProject`) saat memuat dari penyimpanan dan impor | `lib/domain/schema.ts` |
| Grafik | recharts 2 + komponen HTML | `components/charts/Charts.tsx` |
| Excel | exceljs (template 6 lembar, ekspor hasil) | `lib/io/excel.ts`, `lib/io/reports.ts` |
| Tes | vitest, 35 tes di 4 file (`lib/**/**.test.ts`) | `lib/engine/engine.test.ts`, `lib/domain/*.test.ts`, `lib/view/summary.test.ts` |
| E2E | Belum ada di repo. Playwright hanya dipakai lewat skrip lokal di luar repo | — |
| Struktur folder | **Tidak ada `src/`.** Kode ada di `app/`, `components/`, `lib/` | — |

### 2.2 Routing

| Grup | Route | File | Catatan |
| --- | --- | --- | --- |
| Publik (`app/(public)`, `PublicShell`) | `/` | `components/public/Landing.tsx` | Kalkulator hemat (A3) di baris 252–303 |
| | `/masuk` | `app/(public)/masuk/page.tsx` | Login kata sandi; akun demo di `lib/domain/accounts.ts` |
| | `/paket`, `/mulai`, `/contoh-laporan` | `app/(public)/*/page.tsx` | Pilih paket, onboarding 3 langkah, contoh laporan |
| Aplikasi (`app/(app)`, `AppShell` dengan gate login) | `/beranda` | `app/(app)/beranda/page.tsx` | |
| | `/data` (`?view=isi\|cek\|studi`) | `app/(app)/data/page.tsx` + `components/expert/ExpertDataProses.tsx` | |
| | `/hasil` (`?view=dampak\|biaya` di Mode Ahli) | `app/(app)/hasil/page.tsx` | |
| | `/titik-boros` | `app/(app)/titik-boros/page.tsx` | |
| | `/simulasi` | `components/expert/ExpertWhatIf.tsx` | |
| | `/laporan` | `app/(app)/laporan/page.tsx`, `components/report/SummaryReport.tsx`, `components/expert/ExpertReports.tsx` | |
| | `/bantuan`, `/pengaturan?tab=…` | `app/(app)/bantuan`, `app/(app)/pengaturan` | |
| Pengalihan v1.0 | `/overview`, `/data-proses`, `/what-if`, … | `app/<lama>/page.tsx` → `components/layout/Redirect.tsx` | |

Gate login: `components/layout/AppShell.tsx` baris 29–32 (belum login → `/masuk`, paket pending → `/paket`, onboarding → `/mulai`).

### 2.3 Lokasi perhitungan

| Perhitungan | File | Catatan terhadap spesifikasi |
| --- | --- | --- |
| Konversi satuan & basis (periode/bulan/batch) | `lib/engine/units.ts`, `lib/engine/lci.ts` | Sudah kanonis kg/L/kWh |
| Inventori per tahap, intensitas per m² | `lib/engine/lci.ts` | Sesuai 4.3 |
| Dampak (11 kategori EF 3.1) | `lib/engine/lcia.ts`, `lib/engine/method.ts` | Faktor hulu hanya listrik (A1). Profil `screening_v1` belum ada |
| Biaya & MFCA (ISO 14051) | `lib/engine/mfca.ts` | Nilai terbuang = produk negatif MFCA (A2). Belum ada rumus 4.5 |
| Titik boros | `lib/engine/hotspot.ts` | Ada share per tahap + **skor prioritas berbobot** (dampak, biaya, kemudahan, kepatuhan). Aturan 4.6 (≥30% atau peringkat 1 + 3 driver) belum ada |
| Validasi & neraca air/logam | `lib/engine/quality.ts` | Efluen adalah **input** (`production.effluentVolumeM3`), bukan 0,9 × air masuk |
| Skenario (8 tuas), sensitivitas, LCC | `lib/engine/scenario.ts` | Belum ada trace per langkah, bukti, sumber |
| Run, hash, jejak audit | `lib/engine/run.ts`, `lib/engine/hash.ts` | SHA-256 dan hash berantai sudah ada |
| Narasi AI berpagar angka | `lib/engine/copilot.ts` | |
| View-model Mode Ringkas | `lib/view/summary.ts`, `lib/view/helpers.ts` | Kesimpulan "terbuang 97%" di `summary.ts:171` |
| **Hitungan di komponen UI (melanggar aturan 1)** | `components/public/Landing.tsx:263` (kalkulator), `app/(app)/hasil/page.tsx:95-96`, `app/(app)/titik-boros/page.tsx:125`, `components/expert/ExpertWhatIf.tsx:117` (skor keputusan), `:447-450`, `components/expert/ExpertOverview.tsx:95-98` (penurunan vs baseline), `components/expert/ExpertQuality.tsx:48` | Sebagian besar pembagian per m²; harus pindah ke engine/view-model |

### 2.4 Penyimpanan data

- Seluruh state (proyek, run, jejak audit, akun, paket) disimpan di **localStorage** lewat zustand `persist`: `lib/store/useAppStore.ts:820-822` (`name: "aerosphere-lca-v2"`, `version: 2`, `createJSONStorage(() => localStorage)`).
- Run disimpan sebagai objek berisi snapshot proyek + hasil + manifest (`lib/engine/run.ts`), maksimal 20 (`useAppStore.ts:33`). Bila lebih dari 20, run terlama terbuang otomatis; run draf bisa dihapus permanen (`useAppStore.ts:729-740`).
- Akun & kata sandi: hash SHA-256 bergaram, dicek di browser (`lib/domain/accounts.ts`).
- Komponen yang dihapus **langsung dibuang** (hard delete) dari array: `useAppStore.ts:556-564`. Tidak ada soft delete atau urungkan.

### 2.5 Deploy

| Tujuan | Cara | File |
| --- | --- | --- |
| Netlify (https://aerospherelca.netlify.app) | Netlify membaca `netlify.toml`: `npm run build:static` → publish `out/`, Node 20, plugin Next dilewati, 404 → `/404.html` | `netlify.toml` |
| GitHub Pages (`/Aerosphere-Coba-/`) | Manual: `npm run build:pages` lalu salin `out/` ke branch `gh-pages` | `package.json` |

Catatan: build Pages memakai base path `/Aerosphere-Coba-`; jangan dipakai untuk Netlify. Netlify belum terkonfirmasi tersambung ke repo (lihat pertanyaan Q15).

---

## 3. Inventaris tombol

Metode: aplikasi hasil build disajikan lokal, lalu Playwright membuka setiap halaman dengan tiga akun (Admin paket Industri di Mode Ringkas dan Ahli, serta akun demo paket Coba). Untuk setiap `button` dan tautan yang terlihat, handler dibaca langsung dari properti React (`onClick`, `onSubmit` form, atau `href`). Total 1.209 kontrol diperiksa.

**Hasil: tidak ada tombol tanpa handler, dan tidak ada error console** di semua halaman. Batasan metode: "punya handler" belum berarti "berhasil"; beberapa handler sengaja ditolak oleh pemeriksaan paket/peran di store dan hanya memunculkan notifikasi. Uji klik dengan pengecekan efek (spesifikasi 5.2.6) dijadwalkan di M7.

| Halaman | Admin · Ringkas (kontrol / disabled) | Admin · Ahli | Demo Coba |
| --- | ---: | ---: | ---: |
| `/beranda` | 33 / 0 | 58 / 0 | 33 / 0 |
| `/data` | 61 / 0 | 63 / 0 | 57 / 21 |
| `/data?view=cek` | 22 / 1 | 20 / 1 | 22 / 1 |
| `/data?view=studi` | 17 / 0 | 27 / 1 | 18 / 0 |
| `/hasil` | 25 / 0 | 42 / 0 | 25 / 0 |
| `/titik-boros` | 23 / 0 | 40 / 0 | 24 / 0 |
| `/simulasi` | 27 / 0 | 28 / 0 | 26 / 1 |
| `/laporan` | 20 / 0 | 20 / 0 | 20 / 0 |
| `/bantuan` | 16 / 0 | 16 / 0 | 16 / 0 |
| `/pengaturan?tab=paket` | 24 / 2 | 24 / 2 | 24 / 1 |
| `/pengaturan?tab=proyek` | 27 / 0 | 27 / 0 | 27 / 0 |
| `/pengaturan?tab=users` | 21 / 0 | 21 / 0 | 21 / 0 |
| `/pengaturan?tab=keamanan` | 21 / 0 | 21 / 0 | 21 / 0 |
| `/pengaturan?tab=hasil` | 22 / 1 | 22 / 1 | 22 / 1 |
| `/pengaturan?tab=method` | 21 / 0 | 23 / 1 | 21 / 0 |

Kontrol yang disabled (semua akun):

| Halaman | Kontrol | Tooltip alasan? |
| --- | --- | --- |
| `/data?view=cek` (ADMIN-RINGKAS) | Setujui data | Tidak |
| `/pengaturan?tab=paket` (ADMIN-RINGKAS) | Uji coba sudah dipakai | Tidak |
| `/pengaturan?tab=paket` (ADMIN-RINGKAS) | Paket saat ini | Tidak |
| `/pengaturan?tab=hasil` (ADMIN-RINGKAS) | Simpan hasil resmi | Tidak |
| `/data?view=cek` (ADMIN-AHLI) | Approve dataset | Tidak |
| `/data?view=studi` (ADMIN-AHLI) | Kembali | Tidak |
| `/pengaturan?tab=method` (ADMIN-AHLI) | Terapkan | Tidak |
| `/data` (DEMO-COBA) | Hapus {komponen} (21 tombol, semua baris tabel) | Tidak (title = nama tombol saja) |
| `/simulasi` (DEMO-COBA) | Tandai disarankan | Tidak |

Pelanggaran aturan 6 (disabled harus punya tooltip alasan): **semua** kontrol di tabel kedua. Yang paling terasa adalah 21 ikon hapus di Data Saya untuk akun demo (lihat A4).

Penanganan yang sudah benar: fitur di luar paket memakai kartu gembok + "Lihat paket" (`components/ui/Locked.tsx`), dan aksi yang dilarang dicatat sebagai `PLAN_REQUIRED` di jejak audit (`useAppStore.ts`, fungsi `entitled`).

---

## 4. Verifikasi temuan A1–A11

Angka "kode sekarang" diambil dengan menjalankan engine pada dataset demo (`hardChromeDemo()`), bukan dari layar.

| # | Status | Bukti di kode | Catatan |
| --- | --- | --- | --- |
| A1 | **Terkonfirmasi** | Hanya dataset `bg-grid-jamali` dengan `factors: { cc: 0.613 }` (`lib/engine/method.ts:96-110`). Hanya input Energy yang dipetakan (`lib/domain/templates.ts:93-95`); input lain `unmapped` dan dilewati di `lib/engine/lcia.ts:98-99`. Tes `engine.test.ts:89` ("climate change from mapped grid electricity only") justru mengunci perilaku ini | Engine: total 591,545 kg = 2,366 kg/m²; per tahap A 0 · B 0 · C 337,15 · D 91,95 · E 113,405 · F 49,04. 21 aliran tanpa faktor. AP dan EP = 0. Skenario drag-out: jejak karbon 0,00% |
| A2 | **Terkonfirmasi** | Alokasi massa MFCA: produk positif hanya massa lapisan di tahap C, energi & tenaga kerja dibagi rasio massa (`lib/engine/mfca.ts:114-141`). Kalimat di `lib/view/summary.ts:171` | Engine: biaya 50.025.000; terbuang 48.617.957 (97,19%); tenaga kerja terbuang 24,5 juta |
| A3 | **Sebagian** | Kalkulator `components/public/Landing.tsx:252-303` sudah menampilkan persen asumsi (listrik, kimia, air −68,4%, limbah) di blok "Asumsi" baris 295-298, tetapi **tidak** menyebut rasio bilas R = 1.000 (`templates.ts:188`) dan tidak ada tautan ke perhitungan. Hitungan dilakukan di komponen (baris 263) | Perbaikannya mengubah landing → bertabrakan dengan aturan CLAUDE.md #10 (Q12) |
| A4 | **Perlu koreksi** | Ikon hapus adalah `<button>` dengan `aria-label="Hapus {nama}"` dan handler (`components/data/Tables.tsx:136`). Untuk Admin berfungsi. Untuk paket Coba (akun demo) semua 21 tombol `disabled` karena `readOnly = approved \|\| !can(role,"editData") \|\| !manual` (`components/expert/ExpertDataProses.tsx:71`) tanpa tooltip alasan; ukuran 32×32 px (`components/ui/Button.tsx`, `IconButton` `h-8 w-8`), di bawah 40×40 px. Hapus bersifat permanen tanpa konfirmasi/urungkan (`useAppStore.ts:556-564`) | Penyebab yang dialami pengguna kemungkinan besar akun Coba. Keputusan paket di Q8 |
| A5 | **Perlu koreksi** | Tombol run ada: "Hitung hasil" di bar atas (`components/layout/ContextBar.tsx:59-66`) dan di Cek data (`app/(app)/data/page.tsx:165`). Run tersimpan (`useAppStore.ts:700-728`) dan tampil di Pengaturan → Hasil hitung tersimpan. Status Baik/Perlu perhatian/Kritis **berfungsi setelah ada 2 run** (`lib/store/useResults.ts:56-70`) | Yang belum ada: tombol di Data Saya dengan status "data berubah", halaman Riwayat, buka/bandingkan/jadikan pembanding/ganti nama/ekspor per run, IndexedDB |
| A6 | Terkonfirmasi (UX) | `app/(app)/titik-boros/page.tsx` memakai urutan **skor prioritas berbobot** (`hotspot.ts:66-75`), bukan share per indikator; tidak ada grafik bertumpuk, garis ambang 30%, atau penanda titik boros | |
| A7 | Terkonfirmasi | Tuas di `lib/engine/scenario.ts` hanya punya teks asumsi; tidak ada rentang bukti, sumber, atau trace langkah. Drag-out sekarang menurunkan **seluruh** kimia IPAL 125 kg (baris 37-50) → hemat Rp3.180.000; spesifikasi hanya 70 kg yang `scalesWith: dragout_load` → Rp2.960.000 | |
| A8 | Terkonfirmasi | Laporan ringkas 2 halaman (`components/report/SummaryReport.tsx`) dan template teknis/kepatuhan (`components/expert/ExpertReports.tsx`); tidak ada format INALUM/PROPER | |
| A9 | Terkonfirmasi (UX) | `app/(app)/beranda/page.tsx`: checklist, 4 kartu, titik boros, saran. Belum ada kalimat ringkasan, baris "Artinya", banner data berubah. Urutan kartu: karbon dulu, bukan biaya | |
| A10 | **Sudah diperbaiki di kode** | `lib/domain/templates.ts:290-291`: `effluentVolumeM3: 5.85` (komentar "Gap A3"). Tes `engine.test.ts:64` | Yang belum: efluen dihitung otomatis 0,9 × air masuk (spesifikasi 4.4). Angka 100 m³ hanya ada di prototipe lama |
| A11 | Terkonfirmasi | localStorage (`useAppStore.ts:820-822`); FAQ landing menyebut data di browser | Spesifikasi M2 meminta IndexedDB |

### 4.1 Angka engine sekarang vs nilai golden (Bagian 4.8.2)

| Besaran | Kode sekarang | Golden | Status |
| --- | ---: | ---: | --- |
| Listrik / air / kimia / limbah B3 | 965 kWh / 6.500 L / 502 kg / 200 kg | sama | ✅ |
| Volume efluen | 5,85 m³ (input) | 5,85 m³ (0,9 × air) | ✅ angka, ❌ cara hitung |
| GWP total | 591,545 kg (2,366/m²) | 1.848,495 kg (7,394/m²) | ❌ A1 |
| GWP per tahap | A 0 · B 0 · C 337,15 · D 91,95 · E 113,405 · F 49,04 | A 188,55 · B 150,00 · C 712,15 · D 317,85 · E 118,405 · F 361,54 | ❌ |
| AP / EP | 0 / 0 (kategori EF 3.1, satuan mol H⁺ / kg P) | 10,50 kg SO₂e / 1,994 kg PO₄e | ❌ profil berbeda (Q3) |
| Titik boros air / limbah B3 | A 53,8% & D 46,2% / F 50% (share sudah benar) | sama | ✅ data, ❌ aturan |
| Biaya proses | Rp50.025.000 (Rp200.100/m²) | sama | ✅ |
| Transport B3 | 35 km × 6 trip × Rp12.000 = Rp2.520.000 | Rp2.520.000 | ✅ |
| Nilai terbuang | Rp48.617.957 (97,19%) | Rp22.677.500 (45,3%) | ❌ A2 |
| L1 drag-out 20% | Rp3.180.000; karbon 0,00% | Rp2.960.000; −175 kg (−9,5%) | ❌ |
| L2 bilasan 2→3 | Rp107.694; air −68,4% | Rp107.694 | ✅ |
| L3 penyearah | Rp66.477 | Rp66.477 | ✅ |

---

## 5. Pemetaan laporan INALUM & Pusri ke Bagian 8

### 5.1 Struktur laporan INALUM (ID & EN, 3 halaman)

| Bagian INALUM | Bagian 8 spesifikasi | Yang perlu ditambah/disesuaikan |
| --- | --- | --- |
| Judul "Laporan Kajian LCA Tahun {tahun}" / "LCA Study Report {year}" | 8.1-1 | Sama. Tahun dari periode data, bukan tanggal cetak (Q10) |
| Kalimat pembuka + daftar standar (SNI ISO 14040:2016, SNI ISO 14044:2017, PCR produk, Permen LH/BPLH No. 7/2025) | 8.1-2 | Ganti PCR dengan IAEG Aerospace LCA Framework (sesuai spesifikasi) + Pedoman Ditjen PPKL. Lingkup tertulis "cradle to gate" (INALUM: cradle to grave) |
| Tujuan Kajian LCA (1 paragraf) | 8.1-3 | Sama |
| Ruang Lingkup (jenis industri, kapasitas produksi, cradle = bahan baku, gate = proses, grave = distribusi) | 8.1-4 | Tambah kalimat wajib grave di luar lingkup + satuan fungsi 1 m². INALUM tidak menulis satuan fungsi; Pusri menulisnya |
| Kesimpulan: paragraf pengantar + daftar kategori per Titik Cradle/Gate/Grave, dua kolom butir + kalimat penutup EPD | 8.1-5 | INALUM **tidak menyebut aturan** pemilihan kategori; aturan ≥50% / ≥30% adalah tambahan spesifikasi. Grave: "Tidak dikaji (di luar lingkup)" |
| Tabel Ringkasan Evaluasi Dampak Proses Inti (%, 2 desimal, baris = kategori, kolom = unit proses, kelompok Primer/Sekunder/Energi) | 8.1-6 | Kolom = tahap A–F. Penamaan metode di INALUM menyertakan versi ("ReCiPe 2016 Midpoint (H) V1.04", "CML-IA Baseline V3.06", GWP "ReCiPe … dan IPCC 2019") — spesifikasi memakai IPCC 2021 tanpa versi metode (Q4) |
| Versi Inggris terpisah | 8.2 | Kamus spesifikasi cukup; tambahkan istilah tabel ("Table of Summary of Core Process Impact Evaluation", "Carcinogenic", "Water Footprint", "Land Use Change") |

### 5.2 Yang diambil dari laporan Pusri (12 halaman)

| Bagian Pusri | Dipakai untuk | Penyesuaian |
| --- | --- | --- |
| Tabel 2 "Kategori dan Indikator Dampak" (no, dampak, indikator/satuan, metode) | Tambahan 8.1-7 | Belum disebut eksplisit di spesifikasi; usul ditambahkan sebelum tabel % |
| Tabel 3/4 nilai absolut per unit fungsi: kolom Upstream · Core · Downstream · Total · Dalam 1 periode | 8.1-7 nilai absolut | Kolom AeroSphere: Cradle (hulu) · Gate (tahap A–F) · Grave ("tidak dikaji") · Total per m² · Total per periode. Pusri memakai notasi ilmiah (6,76E+03); spesifikasi melarang notasi ilmiah di Mode Ringkas — laporan teknis boleh? (Q11) |
| Tabel 1 Inventori Data (input/output per upstream/core/downstream, total per periode, satuan) | Tidak ada di spesifikasi | Usul ditambahkan sebagai lampiran "Data inventori" agar persen bisa ditelusuri |
| Indikator kualitas data: jumlah data, % primer vs sekunder | 8.1-7 kualitas data | Butuh pemetaan sumber data aplikasi (pedigree) ke primer/sekunder (Q6) |
| Tabel 5/6 Analisis isu penting (dampak → unit proses tertinggi → %) | 8.1-8 kesimpulan per kategori | Bentuk tabel ini lebih ringkas dari paragraf; usul dipakai sebagai tabel + kalimat |
| Kesimpulan bernomor (cakupan, kontributor inventori terbesar per kategori dengan %, nilai per unit, kontributor unit proses, standar, langkah lanjut) | 8.1-5 & 8.1-8 | Kontributor inventori per kategori (mis. "emisi CO₂ 67%") bisa dihasilkan dari driver engine |
| Rekomendasi (paragraf per isu, mengaitkan LCI & LCIA) | 8.1-8 tiga rekomendasi | Ambil dari tuas yang lolos syarat; gaya paragraf Pusri |
| Identitas pemrakarsa, praktisi, riwayat versi, tanggal publikasi, Tinjauan Kritis | Tidak ada di spesifikasi | Nama orang & tanda tangan **tidak** boleh masuk. Usul: identitas fasilitas dari proyek, riwayat versi dari nomor run, status tinjauan kritis "belum dilakukan" |

Perbedaan metode antar acuan (perlu keputusan, Q4):

| Kategori | INALUM | Pusri | Spesifikasi 4.2.2 |
| --- | --- | --- | --- |
| GWP | ReCiPe 2016 (H) + IPCC 2019 | IPCC 2021 (100a) | IPCC 2021 GWP100 |
| Penipisan ozon | ReCiPe 2016 (H) | CML-IA Baseline | ReCiPe 2016 (H) |
| Hujan asam | ReCiPe 2016 (H) | CML-IA Non Baseline | ReCiPe 2016 (H) |
| Photochemical oxidation | CML-IA (kg C₂H₄ eq) | ILCD 2011 (kg NMVOC eq) | CML-IA (kg C₂H₄ eq) |
| Water footprint | ReCiPe 2016 (H) | AWARE | ReCiPe 2016 (H) |
| Penurunan biotik | 3 sub-kategori ekotoksisitas | 1 kategori BDP | 3 sub-kategori |

---

## 6. Konflik & pertanyaan untuk diputuskan

| # | Konflik | Pilihan | Dampak bila tidak diputuskan |
| --- | --- | --- | --- |
| Q1 | CLAUDE.md (disalin apa adanya dari 0.1) menyebut `src/engine` dan `tests/golden`, sedangkan engine ada di `lib/engine` dan tes di `lib/**` | (a) pindahkan engine ke `src/engine`; (b) tetap `lib/engine` dan ubah CLAUDE.md | Path di CLAUDE.md tidak cocok dengan repo |
| Q2 | Model data: spesifikasi memakai satu daftar `InventoryComponent` (termasuk limbah, emisi, efluen) dengan `flowKey`, `scalesWith`, `deviceRole`; kode memakai 4 array terpisah + `basis` + pedigree + mapping (`lib/domain/types.ts`) | (a) migrasi penuh ke model spesifikasi (data localStorage lama dikonversi sekali); (b) adaptor `Project → ProjectInput` dan engine baru membaca adaptor | Menentukan ukuran M1–M2 |
| Q3 | Kategori dampak: kode memakai 11 kategori EF 3.1 (AP mol H⁺, EP kg P); `screening_v1` memakai GWP, AP kg SO₂e, EP kg PO₄e, ADP fosil MJ; `proper_inalum_v1` 15 kategori lain lagi | Apakah EF 3.1 tetap dihitung di Mode Ahli (faktornya kosong selain listrik) atau diganti profil `screening_v1` di semua menu? | Tampilan Hasil dan Laporan Teknis |
| Q4 | Metode per kategori berbeda antara INALUM, Pusri, dan spesifikasi (tabel 5.2) | Ikuti spesifikasi 4.2.2 apa adanya? Sertakan versi metode (V1.04, V3.06) seperti INALUM? | Kolom "Metode" di laporan |
| Q5 | Limbah B3 (pengolahan) dan transport tidak punya faktor di `screening_v1`, padahal batas kajian cradle-to-gate; golden GWP tidak memasukkannya | Tampilkan total GWP dengan catatan "pengolahan limbah belum dihitung", atau tandai kategori sebagai sebagian? | Aturan 2 (null ≠ 0) vs total yang sama dengan golden |
| Q6 | Keyakinan data: spesifikasi 4.7 memakai sumber meter/invoice/weighing/lab/estimate/literature; kode memakai pedigree 5 indikator + `SourceType` measured/calculated/supplier/database/literature | Pemetaan yang diusulkan: measured→meter (3), supplier→invoice (2), calculated/database/literature→estimate/literature (1). Setuju? Dan "data primer" = meter + invoice + weighing + lab? | Skor keyakinan & % data primer di laporan |
| Q7 | Nomor run: spesifikasi `R-0001`; kode `R-2026-001` | Ganti format? | Kecil |
| Q8 | Akun demo paket Coba tidak bisa hapus/tambah/ubah data (PRD v1.1: isi manual mulai Esensial). Spesifikasi 5.2 meminta hapus/tambah untuk pengguna | (a) buka isi manual untuk Coba; (b) pertahankan dan tampilkan tooltip + "Lihat paket"; (c) akun demo diubah ke paket Esensial | A4 akan tetap terlihat "rusak" bagi juri |
| Q9 | Spesifikasi 5.2.5 menambah menu **Riwayat hasil**, PRD v1.1 membatasi 5 menu inti + Bantuan + Pengaturan | Menu ke-7, atau tab di Data Saya saja? | Navigasi |
| Q10 | Beranda 5.1 menulis "bulan ini", padahal data demo periode 1 tahun (Jan–Des 2026) | Kalimat mengikuti periode run ("pada periode Jan–Des 2026")? | Kalimat ringkasan |
| Q11 | Laporan INALUM 2 desimal %, Pusri notasi ilmiah; spesifikasi melarang notasi ilmiah di Mode Ringkas | Boleh notasi ilmiah di laporan formal untuk nilai sangat kecil? | Tabel nilai absolut |
| Q12 | A3 butuh perubahan landing, aturan CLAUDE.md #10 melarang mengubah landing tanpa diminta | Izinkan perubahan kalkulator (asumsi R + tautan) di M5? | A3 |
| Q13 | Laporan INALUM jadi laporan utama; PRD v1.1 mengunci laporan teknis/kepatuhan untuk Profesional+ | Laporan INALUM tersedia di semua paket (dengan watermark "Contoh" di Coba)? | Gating menu Laporan |
| Q14 | Titik Boros spesifikasi memakai share per indikator; kode sekarang memakai skor prioritas berbobot (dipakai juga di Mode Ahli & laporan teknis) | Hapus skor prioritas, atau simpan hanya di Mode Ahli? | M4 |
| Q15 | Dokumen referensi: `docs/referensi/*.pdf` belum ada di repo. Laporan INALUM & Pusri berisi nama perusahaan dan nama orang; repo ini tersambung ke GitHub Pages | Commit PDF ke repo, simpan di luar repo, atau hanya ringkasan strukturnya di `docs/`? Netlify tersambung ke repo atau unggah manual? | Saya tidak meng-commit PDF sampai diputuskan |

Ketidakcocokan kecil yang saya catat tetapi tidak perlu keputusan: spesifikasi Bagian 0 menyebut dokumen bertanggal 11 Okt 2026; nama file Pusri di permintaan (`LCA_Pusri_2025.pdf`) berbeda dari file unggahan.

---

## 7. Rencana kerja M1–M7

Prinsip lintas milestone: satu milestone per sesi; setiap milestone ditutup dengan `npm run typecheck`, `npm run lint`, `npm test` (termasuk golden), build statis, entri `CHANGELOG.md`, dan deploy hanya setelah disetujui. Path di bawah mengasumsikan Q1 = (b) `lib/engine` dan Q2 = (b) adaptor; akan saya sesuaikan bila jawabannya lain.

### M1 — Engine + golden (A1, A2)

| Butir | Isi |
| --- | --- |
| File baru | `lib/engine/factors.ts` (pemuat tabel faktor berversi), `data/factors/screening_v1.json`, `data/factors/proper_inalum_v1.json` (semua `null`), `lib/engine/inventory.ts` (adaptor `Project → ProjectInput` + `flowKey`/`scalesWith`/`deviceRole`), `lib/engine/impacts.ts` (Dampak[s,k], status `not_computed`), `lib/engine/water.ts` (efluen 0,9 × air, `WATER_BALANCE`), `lib/engine/costs.ts` (nilai terbuang 4.5), `lib/engine/confidence.ts` (4.7), `lib/engine/trace.ts`, `lib/engine/index.ts` (`runAnalysis`) |
| File diubah | `lib/engine/calculate.ts` (memanggil `runAnalysis`), `lib/engine/hotspot.ts` (aturan 4.6 + 3 driver), `lib/domain/templates.ts` (flowKey demo), `lib/view/summary.ts:171` (nilai terbuang), `lib/engine/engine.test.ts:89` (tes A1 lama dihapus) |
| Tes | `tests/golden/plating_demo_v1.json` + `tests/golden/screening_v1.test.ts`: semua baris 4.8.2 dengan toleransi; properti: share per kategori = 100% ±0,01 (perlu `fast-check`, dependensi baru); faktor null → `not_computed`; `vitest.config` ditambah `tests/**` |
| Risiko | Angka di landing (kalkulator), mockup, deck, dan banner berubah (2,37 → 7,39 kg/m²). Proyek tersimpan di browser pengguna lama perlu migrasi `flowKey`. Kategori EF 3.1 di Mode Ahli tergantung Q3. Total GWP dengan limbah tanpa faktor tergantung Q5 |

### M2 — Data Saya + Run + Riwayat (A4, A5, A11)

| Butir | Isi |
| --- | --- |
| File baru | `lib/store/db.ts` (IndexedDB; usul `idb` ±1 KB, dependensi baru), `lib/store/runs.ts`, `components/data/ComponentForm.tsx`, `components/data/ConfirmDelete.tsx`, `components/data/RunBar.tsx` (bar sticky "Jalankan analisis"), `app/(app)/riwayat/page.tsx` (atau tab, Q9), `lib/io/runsWorkbook.ts` (satu sheet per run) |
| File diubah | `lib/store/useAppStore.ts` (soft delete + urungkan, run immutable, batas 100 run, pindah run ke IndexedDB, migrasi dari localStorage), `components/data/Tables.tsx` (tabel per tahap, tombol hapus 40×40 + dialog + toast urungkan), `components/expert/ExpertDataProses.tsx`, `components/layout/ContextBar.tsx`, `components/layout/nav.ts`, `lib/store/useResults.ts` (banner hasil lama, pembanding yang disematkan) |
| Tes | Unit: hapus + urungkan → hash input sama; run lama tidak berubah setelah data diubah; perbandingan dua run. E2E (Playwright di repo, dependensi `@playwright/test`, Chromium `/opt/pw-browsers`): tambah → hapus → urungkan → jalankan → riwayat 2 run → bandingkan → ekspor Excel |
| Risiko | Migrasi data dari localStorage tanpa kehilangan run; IndexedDB tidak tersedia di mode privat sebagian browser (perlu fallback); keputusan paket Coba (Q8) |

### M3 — Beranda (A9)

| Butir | Isi |
| --- | --- |
| File | `app/(app)/beranda/page.tsx`, `lib/view/summary.ts` (template kalimat ringkasan, baris "Artinya", urutan kartu biaya dulu), `components/summary/Summary.tsx`, banner "data berubah sejak Hasil #…" (bandingkan hash input) |
| Tes | Unit view-model: kalimat dari fixture sama dengan contoh 5.1 (dengan angka golden); e2e: tidak ada istilah teknis di Mode Ringkas, ukuran teks ≥16/20 px |
| Risiko | Kalimat periode (Q10); uji 5 orang non-LCA di luar cakupan kode (perlu dilakukan tim) |

### M4 — Titik Boros (A6)

| Butir | Isi |
| --- | --- |
| File | `lib/engine/hotspot.ts` (sudah di M1), `lib/content/reasons.ts` (pustaka alasan Bagian 7), `data/references.json` (R1–R16), `components/charts/StageStackBar.tsx` (batang bertumpuk per pemicu, garis 30%, outline + arsir + label "TITIK BOROS #1"), `app/(app)/titik-boros/page.tsx` |
| Tes | Golden: karbon → hanya C; air → A dan D; limbah B3 → F; kalimat jawaban; kunci alasan tidak ditemukan → teks cadangan. Visual: tangkapan layar baseline |
| Risiko | recharts tidak mendukung pola arsir bawaan (perlu SVG `<pattern>` kustom); nasib skor prioritas (Q14) |

### M5 — Simulasi (A7, A3)

| Butir | Isi |
| --- | --- |
| File | `lib/engine/levers/{dragout,rinse,rectifier,chromeMist,effluentNickel,bathConcentration}.ts` (fungsi murni + trace + syarat tampil), `lib/content/levers.ts` (bukti, rentang, sumber), kartu rekomendasi + panel "Kenapa x%?" (menggantikan `components/expert/ExpertWhatIf.tsx` di Mode Ringkas), run skenario `kind: "scenario"` dengan `parentRunId`; `lib/engine/copilot.ts` (`parseWhatIf` ke tuas baru); kalkulator landing (bila Q12 disetujui) |
| Tes | Golden Bagian 6: L1 Rp2.960.000 & −175 kg; L2 Rp107.694; L3 Rp66.477; L4 0,015 kg; L5 0,374 g; kombinasi L1+L2+L3 Rp3.134.171 & 6,513 kg/m²; slider di luar rentang → peringatan; tidak ada tuas tanpa sumber |
| Risiko | Angka hemat di deck/banner/landing berubah; L6 butuh control limit yang belum ada di form; L7 sengaja tidak ditampilkan |

### M6 — Laporan format INALUM (A8)

| Butir | Isi |
| --- | --- |
| File | `components/report/InalumReport.tsx`, `lib/content/reportI18n.ts` (ID/EN/dwibahasa), `lib/engine/reportModel.ts` (persen per tahap, titik cradle/gate, nilai absolut, kualitas data, kesimpulan otomatis), `lib/io/inalumWorkbook.ts` (sheet `Laporan`, `Tabel_Dampak_%`, `Nilai_Absolut`, `Kesimpulan`, `Data_Input`, `Faktor`), CSS cetak A4; `app/(app)/laporan/page.tsx` (tab utama + "Ringkasan untuk manajemen") |
| Tes | Setiap baris persen = 100,00; baris tanpa faktor "belum dihitung"; baris GWP demo = 10,20 / 8,11 / 38,53 / 17,20 / 6,41 / 19,56; Grave "tidak dikaji"; tidak ada perbandingan lintas kategori tanpa normalisasi; nama sheet Excel; snapshot ID & EN |
| Risiko | Sebagian besar baris akan "belum dihitung" sampai pipeline openLCA (M9); PDF hanya lewat cetak browser (tidak ada server); gating paket (Q13); format angka (Q11) |

### M7 — QA

| Butir | Isi |
| --- | --- |
| File | `tests/e2e/flow.spec.ts`, `tests/e2e/dead-buttons.spec.ts` (klik semua kontrol, cek efek/navigasi/dialog/unduhan/console), `tests/e2e/a11y.spec.ts` (axe-core, dependensi baru), `scripts/check-terms.mjs` (istilah teknis di Mode Ringkas), `CHANGELOG.md` |
| Tes | Seluruh Bagian 11 |
| Risiko | E2E pada ekspor statis lebih lambat; tombol yang sengaja ditolak paket harus dibedakan dari tombol mati |

---

## 8. Lampiran: cara audit diulang

1. `npm run build:static` lalu sajikan `out/` di root (mis. server statis sederhana).
2. Masuk dengan akun Admin dan akun demo, buka setiap route di Bagian 2.2, baca `__reactProps` tiap `button`/`a` untuk mendeteksi handler.
3. Angka engine: bundel `hardChromeDemo()` + `calculate()` dengan esbuild (`--alias:@=.`) dan jalankan dengan Node.
