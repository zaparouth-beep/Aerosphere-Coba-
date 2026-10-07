# AeroSphere LCA

Process-level LCA + MFCA untuk manufaktur aerospace, dimulai dari lini plating (Aerospace Bandung Facility, FU 1 m² permukaan ter-plating). Implementasi dari *AeroSphere LCA — Technical & Product Requirement Document v1.0* dan pitch deck BUILD 2026.

## Modul

| Kode | Modul | Halaman |
|---|---|---|
| M01 | Goal & Scope (wizard 5 langkah, boundary klik, versi & kunci scope, template) | `/goal-scope`, `/pengaturan` |
| M02–M03 | Peta proses A–F, data ingestion (input manual, template Excel 6 sheet, konversi satuan, basis per periode/bulan/batch) | `/data-proses` |
| M04 | Validasi (aturan blokir & peringatan, neraca air & logam, benchmark Ni, baku mutu), pedigree matrix, approval dataset | `/kualitas-data` |
| M05–M06 | Engine LCI → LCIA (kategori inti EF 3.1, background via adapter openLCA, Scope 1/2/3) | `/dampak-lingkungan` |
| M07 | MFCA ISO 14051 (positive/negative product, 4 kategori biaya, Sankey) | `/aliran-biaya` |
| M08 | Hotspot (heatmap, ambang, Pareto, skor prioritas, drill-down WHY → WHERE → WHAT IF) | `/hotspot` |
| M09 | What-if S0–S3 (8 lever terdokumentasi, bridge, decision matrix, tornado ±10%, LCC) | `/what-if` |
| M10 | Copilot (narasi berbasis aturan dengan guardrail angka, what-if bahasa alami) | panel kanan |
| M11 | Laporan (ISO 14044, PCF, GRI, PROPER, MFCA, decision brief, one-pager; Excel/CSV/JSON bukti audit) | `/laporan` |
| M12 | Executive overview (KPI + badge kualitas, tren antar-run, target, rekomendasi) | `/overview` |
| M13 | RBAC (simulasi klien), audit log hash-chain, run terkunci + re-run check | `/pengaturan` |

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
