# AeroSphere LCA

Process-level LCA + MFCA untuk manufaktur aerospace, dimulai dari lini plating (Aerospace Bandung Facility, FU 1 m² permukaan ter-plating). Implementasi dari *AeroSphere LCA — Technical & Product Requirement Document* (v1.0 + revisi UX v1.1) dan pitch deck BUILD 2026.

## Alur pengguna (PRD v1.1)

Situs publik `/` (manfaat, 4 langkah, demo interaktif, kalkulator potensi hemat, paket, FAQ) → `/masuk` → `/paket` (Coba langsung aktif 14 hari; paket berbayar menunggu aktivasi admin, disimulasikan di demo) → `/mulai` (profil lini → unggah template atau proyek contoh → hasil pertama) → aplikasi dengan tur 5 langkah. Contoh laporan publik di `/contoh-laporan`.

## Menu aplikasi

| Menu | Pertanyaan | Mode Ringkas (bawaan) | Mode Ahli (Profesional+) |
|---|---|---|---|
| Beranda `/beranda` | Bagaimana kondisi lini saya? | Checklist 5 langkah, 4 angka utama + status, titik paling boros, saran, keyakinan | + overview teknis (tren, target, Sankey) |
| Data Saya `/data` | Data apa yang perlu saya isi? | Isi data, Cek data (pesan bahasa sehari-hari), Setujui data | + pedigree matrix, neraca massa, pemetaan, Goal & Scope |
| Hasil `/hasil` | Berapa dampak dan biayanya? | 4 angka utama, maks. 2 grafik | + semua kategori EF 3.1, Scope 1/2/3, MFCA |
| Titik Boros `/titik-boros` | Tahap mana paling bermasalah, kenapa? | Urutan tahap, penyebab, perbaikan yang bisa dicoba | + heatmap, Pareto, bobot prioritas |
| Simulasi Perbaikan `/simulasi` | Kalau saya ubah ini, apa hasilnya? | Editor perbaikan (Esensial+), tabel sekarang vs perbaikan | + bridge, decision matrix (bobot), tornado |
| Laporan `/laporan` | Apa yang saya kirim ke atasan/auditor? | Laporan Ringkas Manajemen 2 halaman (watermark “Contoh” di paket Coba) | Teknis (ISO 14044, MFCA) & Kepatuhan (GRI, GHG, PROPER, paket bukti audit Industri) |
| Bantuan `/bantuan` | Apa arti istilah ini? | Ulangi tur, panduan per menu, kamus istilah, FAQ, Tanya AeroSphere | |

Paket dan hak fitur ada di `lib/domain/plans.ts`; pemeriksaan berjalan di setiap aksi store (ditolak → `PLAN_REQUIRED` di jejak audit), bukan hanya di tombol. Kamus label UI di `lib/content/glossary.ts`; ringkasan Mode Ringkas di `lib/view/summary.ts`. URL lama (`/overview`, `/data-proses`, `/what-if`, …) dialihkan ke menu baru. Modul M01–M13 v1.0 tetap ada sebagai komponen `components/expert/*`.

## Prinsip yang dijaga di kode

- **Angka dari engine** (`lib/engine`, fungsi murni). Copilot hanya mengisi placeholder; narasi dengan angka bebas ditolak (`render` di `copilot.ts`).
- **Tidak ada angka karangan**: CF/background bawaan hanya yang bersumber (IPCC AR6 GWP100, faktor grid JAMALI 0,613). Aliran tanpa faktor dilaporkan sebagai *unmapped/uncharacterised*, tidak dianggap nol.
- **Traceable**: setiap run menyimpan snapshot, versi metode/engine, hash dataset & hasil; audit log append-only dengan hash chain.

## Pengembangan

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # tes engine (kriteria penerimaan AC-01…AC-06)
npm run lint && npm run typecheck
npm run build:pages  # bundle statis untuk GitHub Pages (basePath /Aerosphere-Coba-)
```

## Batasan versi browser

Data tersimpan di `localStorage` browser. Backend PRD (FastAPI, PostgreSQL/Timescale, Keycloak SSO/MFA, MQTT/ERP, LLM, PDF server-side, JSON-LD openLCA) belum termasuk; RBAC di sini simulasi untuk demo dan uji alur, bukan kontrol keamanan.

## Deploy

| Tujuan | Perintah | Folder hasil |
|---|---|---|
| GitHub Pages (`/Aerosphere-Coba-/`) | `npm run build:pages` | `out/` → branch `gh-pages` |
| Netlify / hosting di root domain | `npm run build:static` (otomatis lewat `netlify.toml`) | `out/` |

Build GitHub Pages memakai base path `/Aerosphere-Coba-`, jadi folder `out/` dari build itu **tidak** bisa diunggah ke Netlify. Untuk Netlify cukup hubungkan repo; `netlify.toml` mengatur perintah build dan folder publish.

