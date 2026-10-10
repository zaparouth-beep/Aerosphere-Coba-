# AeroSphere LCA — Spesifikasi Pengembangan & Backend untuk Claude Code

**Versi 1.0 · 11 Oktober 2026**
**Target aplikasi:** https://aerospherelca.netlify.app/ (versi demo BUILD)
**Dasar:** TPRD AeroSphere LCA v1.1, catatan Industrial & Systems Engineering Lead (C) 11 Okt 2026, format laporan LCA PT INALUM 2025, data demo lini plating 250 m²/tahun.

---

## 0. Cara memakai dokumen ini

1. Simpan file ini di repo sebagai `docs/AEROSPHERE_SPEC.md`.
2. Buat atau tambahkan `CLAUDE.md` di root repo dengan isi di bawah.
3. Kerjakan **satu milestone per sesi** (Bagian 12). Setiap milestone punya prompt siap pakai dan definisi selesai.
4. Jangan lompat ke Phase 2 (backend) sebelum Phase 1 lulus semua tes golden di Bagian 4.8.

### 0.1 Isi `CLAUDE.md` yang disarankan

```markdown
# AeroSphere LCA — aturan kerja

Baca docs/AEROSPHERE_SPEC.md sebelum mengubah kode. Ikuti milestone di Bagian 12.

Aturan wajib:
1. Semua angka di UI dan laporan berasal dari mesin hitung (src/engine). Komponen UI dan AI tidak boleh menghitung atau mengarang angka.
2. Faktor emisi/karakterisasi hanya dari tabel faktor berversi. Faktor kosong (null) ditampilkan "belum dihitung", bukan 0.
3. Hasil analisis (Run) tidak pernah ditimpa. Run baru = snapshot baru.
4. Setiap rekomendasi perbaikan wajib punya: rumus, nilai default, rentang bukti, sumber, dan trace perhitungan.
5. Bahasa UI: Indonesia sehari-hari (kamus di Bagian 5.0). Istilah teknis hanya di Mode Ahli.
6. Setiap tombol harus berfungsi. Tombol yang belum bisa dipakai harus disabled dengan tooltip alasannya.
7. Tes golden (tests/golden) wajib lulus sebelum commit.
8. Nomor tangki dan nama produk kimia dari dokumen klien memakai inisial (lihat Bagian 10).
9. Simpan semua besaran dalam satuan kanonis: kg, L, kWh, m², Rp, mg/L.
10. Jangan mengubah tampilan landing page kecuali diminta.
```

---

## 1. Temuan audit aplikasi saat ini

Audit dilakukan pada halaman publik dan contoh laporan (`/contoh-laporan`) tanggal 11 Oktober 2026. Temuan A1 dan A2 adalah kesalahan perhitungan, bukan sekadar tampilan, sehingga wajib diperbaiki sebelum fitur lain.

| # | Temuan | Bukti | Dampak | Perbaikan |
| --- | --- | --- | --- | --- |
| A1 | Jejak karbon hanya menghitung listrik | 2,37 kg CO₂e/m² = 965 kWh × 0,613 ÷ 250 m². Per tahap: Pelapisan utama 1,35 = 550 × 0,613 ÷ 250. Bahan kimia 502 kg tidak masuk. | Rekomendasi "kurangi larutan terbawa part 20%" tampil 0% jejak karbon, padahal mengurangi ±70 kg bahan kimia. Angka juga bertentangan dengan materi slide (8,31 kg/m²). Juri LCA akan langsung menangkapnya. | Tambahkan faktor hulu bahan kimia dan air (Bagian 4.2). Angka baru demo: 7,39 kg CO₂e/m². |
| A2 | "Bahan dan energi yang terbuang bernilai 97% dari biaya proses" | Contoh laporan, bagian Kesimpulan | Tidak masuk akal bagi manajer; tenaga kerja dan energi ikut terhitung sebagai "terbuang" melalui alokasi massa MFCA. | Definisi baru "nilai terbuang" (Bagian 4.5). Angka baru demo: Rp22,68 juta = 45,3% biaya proses. |
| A3 | Kalkulator landing: air −68,4% tanpa penjelasan | Halaman utama | Angka berasal dari asumsi rasio bilas R = 1.000 (Bagian 6, L2) yang tidak ditampilkan. | Tampilkan asumsi dan tautan ke detail perhitungan. |
| A4 | Ikon hapus di Data Saya tidak bisa diklik | Catatan C | Pengguna tidak bisa mengoreksi data. | Bagian 5.2. |
| A5 | Tidak ada tombol "Jalankan analisis" dan riwayat hasil | "Belum ada hasil tersimpan untuk dibandingkan" di semua kartu | Status Baik/Perlu perhatian/Kritis tidak pernah berfungsi. | Run + riwayat (Bagian 5.2). |
| A6 | Titik Boros sulit dipahami | Catatan C | Inti produk tidak tersampaikan. | Bagian 5.3. |
| A7 | Rekomendasi tanpa perhitungan dan sumber | Catatan C | Angka 20% terlihat dikarang. | Bagian 5.4 dan 6. |
| A8 | Laporan belum mengikuti format kajian LCA PROPER | Catatan C | Tidak setara dengan laporan yang dikenal regulator dan industri. | Bagian 8. |
| A9 | Beranda sulit dibaca | Catatan C | Pengguna non-LCA berhenti di halaman pertama. | Bagian 5.1. |
| A10 | Data demo: efluen 100 m³ padahal air masuk 6,5 m³ | Tab Dampak Lingkungan prototipe | Beban polutan efluen tidak kredibel. | Neraca air (Bagian 4.4): efluen = 0,9 × air masuk = 5,85 m³. |
| A11 | Data hanya tersimpan di browser | FAQ situs | Wajar untuk demo; tidak untuk pilot. | Phase 2 backend (Bagian 9). |

---

## 2. Arsitektur target & tahapan

### 2.1 Tiga fase

| Fase | Waktu | Isi | Penyimpanan |
| --- | --- | --- | --- |
| Phase 1 — Perbaikan aplikasi | Sebelum pitching BUILD | Engine TypeScript murni, perbaikan 5 menu, run & riwayat, Titik Boros baru, simulasi dengan trace, laporan format INALUM, ekspor PDF/Excel | IndexedDB di browser |
| Phase 2 — Backend | Setelah pitching / pilot | FastAPI + PostgreSQL di VPS (Docker Compose), port engine ke Python dengan fixture golden yang sama, akun & paket | PostgreSQL + object storage |
| Phase 3 — Data nyata | Pilot industri | Pipeline faktor openLCA, impor ERP, sensor IoT | Sama + TimescaleDB |

### 2.2 Alur data (Phase 1 dan Phase 2 sama secara logika)

```text
Data Saya (komponen per tahap)
   │  validasi
   ▼
Snapshot input (hash)  ──►  Engine (faktor berversi)  ──►  Run (immutable)
                                                          │
             ┌───────────────┬───────────────┬────────────┼──────────────┐
             ▼               ▼               ▼            ▼              ▼
          Beranda        Hasil          Titik Boros    Simulasi      Laporan
                                                      (Run turunan)  (dari Run)
```

### 2.3 Struktur folder yang disarankan (Phase 1)

Claude Code harus lebih dulu mendeteksi framework yang dipakai (Vite/React, Next.js, dll.) dan menyesuaikan path. Struktur logis:

```text
src/
  engine/
    index.ts            # runAnalysis(input, factors) -> RunResult
    types.ts
    inventory.ts        # agregasi per tahap, konversi satuan
    impacts.ts          # karakterisasi per kategori & profil metode
    water.ts            # neraca air & efluen
    costs.ts            # biaya & nilai terbuang
    hotspot.ts          # peringkat & aturan titik boros
    levers/             # satu file per tuas perbaikan (Bagian 6)
      dragout.ts
      rinse.ts
      rectifier.ts
      chromeMist.ts
      effluentNickel.ts
      bathConcentration.ts
    trace.ts            # pencatat langkah perhitungan
    reasons.ts          # pustaka alasan teknis (Bagian 7)
  data/
    factors/screening_v1.json
    factors/proper_inalum_v1.json   # diisi pipeline openLCA (Phase 3), awalnya null
    demo/plating_demo_v1.json
    references.json
  store/
    db.ts               # IndexedDB (idb / dexie)
    runs.ts
  pages/ (atau app/)
    beranda, data-saya, hasil, titik-boros, simulasi, laporan, riwayat
  report/
    inalumTemplate.tsx
    excelExport.ts
tests/
  golden/               # fixture + expected values Bagian 4.8
  e2e/                  # Playwright: alur & "tidak ada tombol mati"
```

---

## 3. Model data

### 3.1 Tipe inti (TypeScript)

```ts
export type StageCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export const STAGES: Record<StageCode, { nameId: string; nameEn: string }> = {
  A: { nameId: 'Pembersihan awal', nameEn: 'Pre-treatment' },
  B: { nameId: 'Lapisan pengikat', nameEn: 'Activation / strike' },
  C: { nameId: 'Pelapisan utama', nameEn: 'Main plating' },
  D: { nameId: 'Perlakuan akhir', nameEn: 'Post-treatment' },
  E: { nameId: 'Utilitas (listrik & panas)', nameEn: 'Utilities' },
  F: { nameId: 'Pengolahan air limbah', nameEn: 'Wastewater treatment' },
};

export type ComponentCategory =
  | 'chemical'        // bahan kimia proses
  | 'anode'           // anoda logam
  | 'wwtp_chemical'   // bahan kimia IPAL
  | 'consumable'      // masking, filter, dll.
  | 'water'           // air proses / DI
  | 'electricity'     // listrik per alat
  | 'fuel'            // bahan bakar (jika ada)
  | 'waste_b3'        // limbah B3 (output)
  | 'air_emission'    // emisi udara langsung (output)
  | 'effluent_param'; // parameter efluen mg/L (output)

export type DataSource = 'meter' | 'invoice' | 'weighing' | 'lab' | 'estimate' | 'literature';

export interface InventoryComponent {
  id: string;                 // uuid
  stage: StageCode;
  category: ComponentCategory;
  name: string;               // tampil ke user, boleh inisial
  flowKey: string;            // kunci ke tabel faktor, mis. 'chem.generic', 'elec.grid_id'
  quantity: number;
  unit: string;               // satuan kanonis setelah konversi
  source: DataSource;
  note?: string;
  deviceRole?: 'rectifier' | 'heater' | 'chiller' | 'oven' | 'ventilation' | 'pump' | 'compressed_air' | 'di_ro' | 'wwtp';
  scalesWith?: 'dragout_load' | 'effluent_volume' | 'none'; // untuk propagasi tuas
  deletedAt?: string;         // soft delete
}

export interface ProjectInput {
  projectId: string;
  name: string;
  facility: string;
  periodStart: string;        // ISO date
  periodEnd: string;
  coatingType: 'hard_chrome' | 'nickel' | 'cadmium' | 'zinc_nickel' | 'anodize_chromic' | 'other';
  areaPlatedM2: number;       // reference flow (FU = 1 m²)
  components: InventoryComponent[];
  prices: PriceTable;
  methodProfile: 'screening_v1' | 'proper_inalum_v1';
}

export interface PriceTable {
  electricityRpPerKWh: number;   // demo 1.500
  waterRpPerL: number;           // demo 15
  chemicalRpPerKg: number;       // demo 45.000 (bahan kimia & anoda)
  wwtpChemicalRpPerKg: number;   // demo 20.000
  consumableRpPerKg: number;     // demo 30.000
  b3TreatmentRpPerKg: number;    // demo 8.000
  b3TransportRpPerPeriod: number;// demo 2.520.000 (210 km × 12.000)
  laborRpPerPeriod: number;      // demo 25.000.000
}

export interface Run {
  id: string;                 // 'R-0001'
  label: string;              // 'Hasil #R-0004 — 11 Okt 2026 00.12'
  createdAt: string;
  createdBy: string;
  inputSnapshot: ProjectInput;   // salinan penuh, bukan referensi
  inputHash: string;             // sha-256 dari JSON kanonis
  factorVersion: string;         // 'screening_v1@2026-10-11'
  engineVersion: string;         // dari package.json / git sha
  kind: 'baseline' | 'scenario';
  parentRunId?: string;          // untuk skenario
  levers?: LeverSetting[];
  result: RunResult;
  pinnedAsComparison?: boolean;
  deletedAt?: string;
}

export interface RunResult {
  perStage: Record<StageCode, StageResult>;
  totals: Totals;
  perFU: Totals;                 // dibagi areaPlatedM2
  impacts: ImpactResult[];       // per kategori
  hotspots: HotspotFinding[];
  waste: WasteValueResult;       // nilai terbuang
  dataConfidence: 'high' | 'medium' | 'low';
  warnings: EngineWarning[];
  trace: TraceStep[];            // langkah perhitungan utama
}

export interface TraceStep {
  id: string;
  label: string;                 // 'Jejak karbon listrik tahap C'
  formula: string;               // 'kWh × faktor grid'
  inputs: Record<string, { value: number; unit: string; source?: string }>;
  result: { value: number; unit: string };
}
```

### 3.2 Skema basis data (Phase 2, PostgreSQL)

```sql
create table tenant (id uuid primary key, name text not null, plan text not null default 'trial', created_at timestamptz default now());
create table app_user (id uuid primary key, tenant_id uuid references tenant(id), email text unique not null, password_hash text, role text not null check (role in ('admin','data_steward','engineer','analyst','executive','auditor')), mfa_secret text, created_at timestamptz default now());
create table project (id uuid primary key, tenant_id uuid references tenant(id), name text, facility text, coating_type text, period_start date, period_end date, area_plated_m2 numeric not null, method_profile text not null default 'screening_v1', created_at timestamptz default now());
create table inventory_component (id uuid primary key, project_id uuid references project(id), stage char(1) not null, category text not null, name text not null, flow_key text not null, quantity numeric not null, unit text not null, source text not null, device_role text, scales_with text, note text, deleted_at timestamptz, updated_at timestamptz default now());
create table price_table (project_id uuid primary key references project(id), data jsonb not null, updated_at timestamptz default now());
create table run (id text, project_id uuid references project(id), label text, kind text not null, parent_run_id text, input_snapshot jsonb not null, input_hash text not null, factor_version text not null, engine_version text not null, levers jsonb, result jsonb not null, created_by uuid references app_user(id), created_at timestamptz default now(), pinned boolean default false, deleted_at timestamptz, primary key (project_id, id));
create table factor_set (version text primary key, profile text not null, data jsonb not null, created_at timestamptz default now());
create table report (id uuid primary key, project_id uuid, run_id text, template text not null, language text not null, file_key text, file_sha256 text, created_at timestamptz default now());
create table event_log (id bigserial primary key, ts timestamptz default now(), actor uuid, entity text, entity_id text, action text, old jsonb, new jsonb, reason text, prev_hash text, hash text);
-- role aplikasi hanya boleh INSERT ke event_log; tidak boleh UPDATE/DELETE.
-- run.result dan run.input_snapshot tidak boleh di-UPDATE (trigger menolak).
```

---

## 4. Mesin hitung

### 4.1 Prinsip

- Engine adalah fungsi murni: `runAnalysis(input: ProjectInput, factors: FactorSet): RunResult`. Tidak ada akses UI, waktu, atau acak di dalamnya.
- Setiap angka yang tampil di UI harus bisa ditelusuri ke `TraceStep`.
- Faktor `null` menghasilkan kategori berstatus `not_computed`, bukan 0.

### 4.2 Tabel faktor & profil metode

#### 4.2.1 Profil `screening_v1` (dipakai sekarang)

Faktor skrining ini konsisten dengan materi slide LCIA tim. Statusnya **skrining**, wajib diberi label di UI dan laporan, dan diganti hasil pipeline openLCA (Bagian 4.2.3) sebelum diklaim sebagai hasil LCA formal.

| flowKey | Satuan | GWP (kg CO₂e) | AP (kg SO₂e) | EP (kg PO₄e) | ADP fosil (MJ) | Sumber |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `elec.grid_id` | kWh | 0,613 | 0,004 | 0,0005 | 10,5 | GWP: faktor grid JAMALI (GEC/JCM 2022); lainnya skrining tim |
| `chem.generic` (kimia proses, anoda, consumable) | kg | 2,5 | 0,012 | 0,003 | 35 | Skrining tim |
| `chem.wwtp` | kg | 2,5 | 0,012 | 0,003 | 25 | Skrining tim |
| `water.process` | L | 0,0003 | — | — | — | Skrining tim |
| `air.acid_mist` (emisi langsung) | kg | — | 0,77 | — | — | Skrining tim |
| `effluent.cod` (beban) | kg | — | — | 0,022 | — | Skrining tim |

ADP mineral (CML-IA, kg Sb-eq per kg logam; verifikasi ulang terhadap paket metode openLCA): Cd 0,157 · Pb 0,00634 · Cu 0,00137 · Zn 0,000538 · Cr 0,000443 · Ni 0,0000653.

Catatan grid: nilai 0,613 dipertahankan agar konsisten dengan aplikasi saat ini. Simpan di konfigurasi dengan sumber dan tahun, dan perbarui ke faktor emisi grid resmi terbaru dari Kementerian ESDM sebelum pilot.

#### 4.2.2 Profil `proper_inalum_v1` (untuk Laporan format INALUM)

Laporan LCA untuk PROPER di Indonesia memakai metode berbeda per kategori dampak. Profil ini meniru pemetaan pada laporan INALUM 2025, dengan GWP memakai IPCC versi terbaru.

| No | Kelompok | Kategori dampak | Satuan | Metode |
| --- | --- | --- | --- | --- |
| 1 | Dampak primer | Global warming potential (GWP) | kg CO₂ eq | IPCC 2021 GWP100 |
| 2 | Dampak primer | Potensi penipisan ozon | kg CFC-11 eq | ReCiPe 2016 Midpoint (H) |
| 3 | Dampak primer | Potensi hujan asam | kg SO₂ eq | ReCiPe 2016 Midpoint (H) |
| 4 | Dampak primer | Potensi eutrofikasi | kg PO₄ eq | CML-IA baseline |
| 5 | Dampak sekunder | Photochemical oxidation | kg C₂H₄ eq | CML-IA baseline |
| 6a | Dampak sekunder | Penurunan abiotik (fosil) | MJ | CML-IA baseline |
| 6b | Dampak sekunder | Penurunan abiotik (non-fosil) | kg Sb eq | CML-IA baseline |
| 7a | Dampak sekunder | Penurunan biotik — ekotoksisitas darat | kg 1,4-DCB | ReCiPe 2016 Midpoint (H) |
| 7b | Dampak sekunder | Penurunan biotik — ekotoksisitas air tawar | kg 1,4-DCB | ReCiPe 2016 Midpoint (H) |
| 7c | Dampak sekunder | Penurunan biotik — ekotoksisitas laut | kg 1,4-DCB | ReCiPe 2016 Midpoint (H) |
| 8 | Dampak sekunder | Karsinogenik | kg 1,4-DCB | ReCiPe 2016 Midpoint (H) |
| 9 | Dampak sekunder | Toksisitas (manusia) | kg 1,4-DB eq | CML-IA baseline |
| 10 | Dampak sekunder | Water footprint | m³ | ReCiPe 2016 Midpoint (H), water consumption |
| 11 | Dampak sekunder | Land use change | m²a crop eq | ReCiPe 2016 Midpoint (H) |
| 12a | Pemakaian energi | Cumulative Energy Demand — non-renewable | MJ | CED |
| 12b | Pemakaian energi | Cumulative Energy Demand — renewable | MJ | CED |

Sampai pipeline 4.2.3 dijalankan, kategori yang tidak punya faktor di `screening_v1` tampil "belum dihitung" di laporan. GWP, AP, dan EP dapat sementara diisi dari `screening_v1` dengan label "skrining".

Ini menyimpang dari keputusan TPRD (EF 3.1 sebagai metode primer). Keputusannya: EF 3.1 tetap untuk Mode Ahli dan laporan teknis internasional; `proper_inalum_v1` untuk laporan format PROPER/INALUM. Kedua profil tidak boleh dicampur dalam satu tabel.

#### 4.2.3 Pipeline faktor openLCA (Phase 3, tetapi skripnya bisa disiapkan sekarang)

- Jalankan openLCA 2.x dengan IPC server, database USLCI (LCA Commons) + paket metode LCIA openLCA (berisi IPCC, CML-IA, ReCiPe 2016, CED).
- Buat proses listrik Indonesia sendiri (faktor ESDM) agar tidak memakai listrik AS.
- Skrip `tools/factors/export_openlca.py` (paket `olca-ipc`): untuk setiap `flowKey` yang dipetakan ke proses background, hitung hasil LCIA untuk 1 unit, lalu tulis `proper_inalum_v1.json`.
- Format file faktor:

```json
{
  "version": "proper_inalum_v1@2026-11-01",
  "profile": "proper_inalum_v1",
  "flows": {
    "elec.grid_id": {
      "unit": "kWh",
      "dataset": "Electricity, Indonesia JAMALI grid (custom, ESDM 2024)",
      "status": "verified",
      "factors": { "gwp": 0.0, "odp": null, "ap": null }
    }
  },
  "directEmissionCF": {
    "air.cr6": { "carcinogenic": null, "toxicity": null },
    "water.ni": { "eco_freshwater": null, "toxicity": null }
  }
}
```

### 4.3 Rumus inti

Untuk setiap tahap s dan kategori k:

```text
Dampak[s,k] = Σ_i ( qty_i × faktor[flowKey_i, k] )            # komponen input di tahap s
            + Σ_j ( emisiLangsung_j × CF[j, k] )               # emisi udara & efluen yang dialokasikan ke tahap s
Dampak[k]   = Σ_s Dampak[s,k]
PerFU[k]    = Dampak[k] ÷ areaPlatedM2
Share[s,k]  = Dampak[s,k] ÷ Dampak[k]

Intensitas energi  = Σ kWh ÷ m²
Intensitas air     = Σ L air ÷ m²
Intensitas kimia   = Σ kg (chemical + anode + wwtp_chemical + consumable) ÷ m²
Intensitas B3      = Σ kg limbah B3 ÷ m²
```

Pembagian titik untuk laporan INALUM:

- **Titik cradle** = bagian dampak dari faktor hulu (produksi bahan kimia, pembangkitan listrik, penyediaan air).
- **Titik gate** = emisi langsung di lini (kabut asam, kabut Cr(VI), efluen, limbah di lokasi) + pemakaian di tahap A–F.
- **Titik grave** = di luar batas sistem saat ini; ditulis "tidak dikaji".

### 4.4 Neraca air & efluen

```text
airMasuk      = Σ komponen kategori water (L)
efluenVolume  = airMasuk × 0,90        # 10% hilang (penguapan, terbawa produk, lumpur); dapat diubah
beban_x (kg)  = efluenVolume (m³) × C_x (mg/L) ÷ 1000
```

Jika pengguna mengisi volume efluen terukur yang > airMasuk, tampilkan peringatan `WATER_BALANCE`: "Air buangan lebih besar dari air masuk. Periksa angka air masuk atau volume efluen." Jangan memblokir run, tetapi turunkan keyakinan data ke "rendah".

### 4.5 Biaya & nilai terbuang (pengganti angka 97%)

```text
BiayaProses = Σ (qty × harga) + transport B3 + tenaga kerja

NilaiTerbuang =
    biaya bahan kimia proses (bukan anoda)        # larutan yang tidak menjadi lapisan
  + biaya bahan kimia IPAL
  + biaya consumable
  + biaya pengolahan & transport limbah B3
  + biaya air
# Anoda dianggap menjadi lapisan (produk positif).
# Energi dan tenaga kerja TIDAK dihitung sebagai "terbuang"; ditampilkan sebagai biaya operasi.

PersenTerbuang = NilaiTerbuang ÷ BiayaProses
```

Alasan: pada pelapisan, part bukan input material lini, jadi alokasi massa MFCA (ISO 14051) atas tenaga kerja dan energi membuat hampir semua biaya tampak "terbuang" dan tidak berguna bagi keputusan. Tampilan MFCA penuh tetap tersedia di Mode Ahli dengan label metodenya.

### 4.6 Aturan titik boros

```text
untuk setiap indikator (jejak karbon, nilai terbuang, air, limbah B3, dan kategori lain di Mode Ahli):
  urutkan tahap berdasarkan Share
  tahap = TITIK BOROS bila Share ≥ 30%  ATAU  peringkat 1
  driver tahap = 3 komponen teratas berdasarkan kontribusi ke indikator itu
```

Ambang 30% bisa diubah di Pengaturan proyek.

### 4.7 Tingkat keyakinan data

```text
skor komponen: meter/weighing/lab = 3, invoice = 2, estimate/literature = 1
keyakinan = rata-rata tertimbang (bobot = kontribusi ke jejak karbon)
  ≥ 2,5 → tinggi; 1,8–2,49 → sedang; < 1,8 → rendah
peringatan WATER_BALANCE atau faktor skrining → maksimal "sedang"
```

### 4.8 Data demo & nilai golden (wajib lulus tes)

#### 4.8.1 Fixture `plating_demo_v1.json`

Diambil dari tab Data Proses prototipe. Verifikasi ulang terhadap data di aplikasi sebelum dijadikan fixture.

| No | Komponen | Tahap | Kategori | Jumlah | Satuan |
| --- | --- | --- | --- | ---: | --- |
| 1 | Degreaser alkali | A | chemical | 30 | kg |
| 2 | H₂SO₄ | A | chemical | 25 | kg |
| 3 | HCl | A | chemical | 15 | kg |
| 4 | Ni/Cu strike chemical | B | chemical | 60 | kg |
| 5 | CrO₃ / asam kromat | C | chemical | 40 | kg |
| 6 | Garam nikel | C | chemical | 25 | kg |
| 7 | Kimia kadmium | C | chemical | 20 | kg |
| 8 | Natrium hipofosfit | C | chemical | 15 | kg |
| 9 | Elektrolit anodizing | C | chemical | 20 | kg |
| 10 | Brightener/aditif | C | chemical | 10 | kg |
| 11 | Chromate/passivation | D | chemical | 90 | kg |
| 12 | Anoda Ni/Cd/Pb/Zn | C | anode | 20 | kg |
| 13 | Air proses/bilas | A | water | 3.500 | L |
| 14 | Air DI/RO | D | water | 3.000 | L |
| 15 | Listrik rectifier | C | electricity (rectifier) | 300 | kWh |
| 16 | Pemanas bath | C | electricity (heater) | 150 | kWh |
| 17 | Chiller | C | electricity (chiller) | 100 | kWh |
| 18 | Oven HE-relief | D | electricity (oven) | 150 | kWh |
| 19 | Ventilasi/scrubber | E | electricity (ventilation) | 80 | kWh |
| 20 | Pompa/agitator | E | electricity (pump) | 40 | kWh |
| 21 | Udara tekan | E | electricity (compressed_air) | 25 | kWh |
| 22 | DI/RO | E | electricity (di_ro) | 40 | kWh |
| 23 | IPAL | F | electricity (wwtp) | 80 | kWh |
| 24 | Pereduksi Cr(VI) | F | wwtp_chemical, scalesWith dragout_load | 35 | kg |
| 25 | NaOCl/oksidator | F | wwtp_chemical | 30 | kg |
| 26 | NaOH/kapur | F | wwtp_chemical, scalesWith dragout_load | 35 | kg |
| 27 | Koagulan/flokulan | F | wwtp_chemical, scalesWith effluent_volume | 25 | kg |
| 28 | Masking | A | consumable | 5 | kg |
| 29 | Filter/cartridge | E | consumable | 1 | kg |
| 30 | Consumable lain | E | consumable | 1 | kg |

Output: limbah B3 per tahap A 20, B 16, C 30, D 24, E 10, F 100 kg (F scalesWith dragout_load). Emisi udara: Cr(VI) 0,15 kg; kabut asam 0,8 kg; H₂ 12 kg; VOC 0,5 kg. Efluen (mg/L): pH 7,2; TSS 25; COD 40; Cr total 0,8; Cr(VI) 0,5; Cd 0,02; Ni 0,3; Zn 0,15; Cu 0,1; sianida 0. Luas dilapisi 250 m². Harga: lihat `PriceTable`.

#### 4.8.2 Nilai yang wajib dihasilkan engine (`screening_v1`)

| Besaran | Nilai | Toleransi |
| --- | ---: | --- |
| Total listrik | 965 kWh → 3,86 kWh/m² | eksak |
| Total air | 6.500 L → 26 L/m² | eksak |
| Total kimia (semua kategori kg) | 502 kg → 2,008 kg/m² | eksak |
| Total limbah B3 | 200 kg → 0,8 kg/m² | eksak |
| Volume efluen | 5,85 m³ | eksak |
| GWP listrik | 591,545 kg CO₂e | ±0,01 |
| GWP bahan kimia | 1.255,0 kg CO₂e | ±0,01 |
| GWP air | 1,95 kg CO₂e | ±0,01 |
| **GWP total** | **1.848,495 kg → 7,394 kg CO₂e/m²** | ±0,01 |
| GWP per tahap (kg) | A 188,55 · B 150,00 · C 712,15 · D 317,85 · E 118,405 · F 361,54 | ±0,01 |
| Share GWP | C 38,5% · F 19,6% · D 17,2% · A 10,2% · B 8,1% · E 6,4% | ±0,1 pp |
| Titik boros GWP | C (satu-satunya ≥ 30%) | — |
| AP total | 10,50 kg SO₂e (listrik 3,86 + kimia proses 4,524 + kimia IPAL 1,5 + kabut asam 0,616) | ±0,01 |
| EP total | 1,994 kg PO₄e (listrik 0,4825 + kimia 1,131 + IPAL 0,375 + COD 0,00515) | ±0,005 |
| Titik boros air | A 53,8% dan D 46,2% (keduanya ≥ 30%) | — |
| Titik boros limbah B3 | F 50% | — |
| Biaya proses | Rp50.025.000 → Rp200.100/m² | eksak |
| Nilai terbuang | Rp22.677.500 (45,3%) | eksak |

Rincian nilai terbuang: kimia proses non-anoda 350 kg × 45.000 = 15.750.000; kimia IPAL 2.500.000; consumable 210.000; pengolahan B3 1.600.000; transport B3 2.520.000; air 97.500.

---

## 5. Spesifikasi per menu (catatan C)

### 5.0 Aturan bahasa yang berlaku di semua menu

Pakai kamus label dari TPRD v1.1 bagian 3.0.4. Contoh wajib: titik boros (bukan hotspot), jejak karbon (bukan GWP), larutan terbawa part (bukan drag-out), penyearah arus (bukan rectifier), per 1 m² permukaan dilapisi (bukan FU). Angka dibulatkan maksimal 3 angka penting; tidak ada notasi ilmiah di Mode Ringkas.

### 5.1 Beranda — untuk orang yang tidak paham LCA

Masalah sekarang: terlalu banyak angka dan istilah tanpa arti. Beranda harus menjawab satu pertanyaan: **"Bagaimana kondisi lini saya, dan apa yang harus saya lakukan?"**

Tata letak dari atas ke bawah:

1. **Kalimat ringkasan** (huruf besar, 2–3 kalimat, dibuat dari template + angka run):
   > Setiap 1 m² permukaan yang dilapisi bulan ini menghabiskan biaya **Rp200 ribu** dan menghasilkan **7,4 kg CO₂e**. Tahap yang paling boros adalah **Pelapisan utama**. Perbaikan paling layak: **kurangi larutan yang terbawa part**, hemat sekitar **Rp3,0 juta per tahun**.
2. **Empat kartu** (urutan: uang dulu): Biaya per m² · Jejak karbon · Pemakaian air · Limbah berbahaya. Isi tiap kartu:
   - label sehari-hari + satuan yang dibaca ("liter per m² permukaan dilapisi"),
   - status dengan kata dan warna (Baik / Perlu perhatian / Kritis) dibanding run pembanding,
   - satu baris "Artinya: …" (mis. "Artinya: limbah berbahaya naik 6% dari hasil sebelumnya, terutama dari pengolahan air limbah."),
   - ikon "Apa ini?".
3. **Kartu "Mulai dari sini"**: satu perbaikan teratas dengan hemat Rp/tahun, usaha, waktu, tombol "Lihat perhitungannya" (ke Simulasi detail).
4. **Satu grafik kecil**: batang jejak karbon per tahap, tahap titik boros diberi garis tebal dan label.
5. **Checklist langkah**: Isi data → Jalankan analisis → Lihat titik boros → Coba perbaikan → Unduh laporan (centang otomatis).
6. Banner bila data berubah sejak run terakhir: "Data Anda berubah sejak Hasil #R-0003. Jalankan analisis ulang untuk angka terbaru." + tombol.

Kriteria penerimaan:

- Tidak ada istilah dari daftar teknis (GWP, LCIA, FU, MFCA, hotspot) di Mode Ringkas.
- Ukuran teks isi ≥ 16 px; kalimat ringkasan ≥ 20 px.
- Uji: 5 orang non-LCA menjawab "tahap mana paling boros dan apa sarannya" dalam ≤ 60 detik.

### 5.2 Data Saya — hapus, tambah, jalankan analisis, riwayat hasil

#### 5.2.1 Tabel komponen per tahap

Setiap tahap A–F tampil sebagai kartu yang bisa dibuka-tutup, berisi tabel: Komponen · Jumlah · Satuan · Sumber data · Aksi (ubah, hapus).

#### 5.2.2 Hapus komponen

- Ikon tempat sampah harus berupa `<button>` dengan `aria-label="Hapus {nama}"`, area klik ≥ 40×40 px.
- Klik → dialog konfirmasi: "Hapus *HCl* dari Pembersihan awal? Komponen ini tidak akan ikut di analisis berikutnya. Hasil analisis lama tetap tersimpan." Tombol: Batal · Hapus.
- Setelah hapus: soft delete (`deletedAt`), toast "Komponen dihapus · **Urungkan**" selama 8 detik.
- Menghapus komponen tidak mengubah run yang sudah ada.
- Event tercatat (Phase 2: `event_log`).

#### 5.2.3 Tambah komponen

- Tombol **"+ Tambah komponen"** di baris paling bawah setiap tabel tahap, dan tombol "+ Tambah komponen" global di bagian paling bawah halaman (memilih tahap di form).
- Form: Nama (dengan saran dari pustaka komponen plating), Tahap, Jenis (bahan kimia / listrik / air / limbah B3 / emisi udara / parameter air limbah / consumable), Jumlah, Satuan (pilihan sesuai jenis), Sumber data, Catatan. Untuk listrik: peran alat (penyearah arus, pemanas, chiller, oven, ventilasi, pompa, udara tekan, DI/RO, IPAL).
- `flowKey` dipilih otomatis dari jenis. Jika tidak ada faktor: tampilkan peringatan "Faktor dampak untuk komponen ini belum tersedia. Komponen tetap dihitung untuk biaya, tetapi tidak untuk jejak karbon." (tidak diam-diam 0).
- Validasi: jumlah ≥ 0, satuan sesuai jenis, nama tidak kosong.

#### 5.2.4 Tombol "Jalankan analisis"

- Bar tetap (sticky) di bawah halaman Data Saya: kiri teks status, kanan tombol utama **"Jalankan analisis"**.
- Teks status: "Belum pernah dianalisis" / "Data berubah sejak Hasil #R-0003 (2 perubahan)" / "Data sama dengan Hasil #R-0003".
- Klik → validasi (aturan TPRD M04 versi ringan) → bila ada error, tampilkan daftar dan arahkan ke sel; bila lolos → `runAnalysis()` → simpan **Run baru** → toast "Hasil #R-0004 tersimpan" → pindah ke Beranda.
- Jika data tidak berubah sejak run terakhir, tombol tetap aktif tetapi menampilkan konfirmasi "Data sama dengan Hasil #R-0003. Jalankan lagi?".

#### 5.2.5 Riwayat hasil ("sheet" hasil lama)

- Menu baru **Riwayat hasil** (juga tab di Data Saya). Hasil lama tidak pernah hilang.
- Daftar: Nomor hasil, tanggal, dibuat oleh, jejak karbon/m², biaya/m², limbah B3/m², jumlah perubahan data dibanding run sebelumnya.
- Aksi per baris: **Buka** (semua halaman menampilkan banner kuning "Anda melihat hasil lama #R-0002 — 3 Okt 2026" + tombol "Kembali ke hasil terbaru"), **Bandingkan** (pilih dua run → tabel Δ per indikator dan per komponen yang berubah), **Jadikan pembanding** (dipakai untuk status Baik/Perlu perhatian/Kritis), **Ganti nama**, **Ekspor**, **Hapus** (soft delete, dengan konfirmasi; run yang dipakai laporan tidak bisa dihapus).
- **Ekspor Excel**: satu file `.xlsx` berisi sheet `Ringkasan` (semua run) lalu **satu sheet per run** (`R-0001`, `R-0002`, …) berisi input dan hasil. Ini memenuhi permintaan "disimpan di sheet lain".
- Phase 1: simpan di IndexedDB (bukan localStorage, karena kuota). Batas 100 run per proyek; peringatan di 90.

#### 5.2.6 Semua tombol harus berfungsi

- Inventaris tombol per halaman dibuat dalam tes e2e (Playwright): klik setiap `button` dan `a[href]` yang terlihat; gagal bila tidak ada perubahan state, navigasi, dialog, atau unduhan, atau bila ada error di console.
- Tombol yang memang belum tersedia (mis. fitur paket lebih tinggi) harus `disabled` + tooltip alasannya + tautan "Lihat paket".

### 5.3 Titik Boros — grafik jelas + alasan

Tata letak dari atas ke bawah:

1. **Pemilih indikator** (chip): Jejak karbon · Nilai terbuang (Rp) · Pemakaian air · Limbah berbahaya. Mode Ahli menambah semua kategori dampak.
2. **Grafik utama** (lebar penuh, tinggi ±360 px):
   - Batang horizontal per tahap A–F, diurutkan dari terbesar, ditumpuk per pemicu (listrik / bahan kimia / air / emisi langsung / limbah) dengan legenda.
   - Garis putus-putus vertikal pada 30% total berlabel "Ambang titik boros (30%)".
   - Tahap yang menjadi titik boros: **outline merah 3 px**, latar batang tetap berwarna, label **"TITIK BOROS #1"** di ujung batang, ikon peringatan. Tahap lain diredam (abu-abu muda) agar kontras.
   - Angka absolut dan persen di ujung setiap batang.
   - Tidak bergantung warna saja: titik boros juga diberi pola arsir dan teks.
3. **Kalimat jawaban** di bawah grafik: "Pelapisan utama menyumbang 38,5% jejak karbon lini — terbesar dari enam tahap."
4. **Kartu penjelasan per titik boros** (satu kartu per tahap yang ditandai), berisi tiga bagian:
   - **Kenapa ini titik boros (data)**: share, nilai absolut, 3 pemicu terbesar beserta angkanya, perbandingan dengan rata-rata tahap lain. Contoh: "Bahan kimia 150 kg menyumbang 375 kg CO₂e (53%) dan listrik 550 kWh menyumbang 337 kg CO₂e (47%) dari tahap ini."
   - **Alasan teknis (kenapa bisa boros)**: diambil dari pustaka alasan (Bagian 7) sesuai jenis lapisan dan pemicu, lengkap dengan sumber.
   - **Yang bisa dilakukan**: 1–3 tuas perbaikan relevan dengan tombol "Lihat perhitungannya".
5. Mode Ahli: heatmap tahap × kategori dan tabel kontribusi komponen.

Kriteria penerimaan: dengan fixture demo, indikator jejak karbon menandai hanya tahap C; indikator air menandai A dan D; indikator limbah B3 menandai F.

### 5.4 Simulasi Perbaikan — rekomendasi realistis dengan perhitungan & bukti

#### 5.4.1 Daftar rekomendasi

- Kartu per tuas dari pustaka (Bagian 6) yang **lolos syarat tampil**: punya rumus, nilai default berada di dalam atau di bawah rentang bukti, sumber minimal satu, dan data input yang dibutuhkan tersedia.
- Isi kartu: nama sehari-hari, nilai yang diusulkan (mis. "−20%"), hemat Rp/tahun, perubahan jejak karbon, air, limbah B3, usaha (rendah/sedang/tinggi), waktu, label keyakinan ("berdasarkan data Anda + bukti literatur" atau "perkiraan, perlu uji di lini").
- Urutan: hemat Rp/tahun, lalu penurunan jejak karbon.
- Slider untuk mengubah nilai dalam rentang yang diizinkan; di luar rentang bukti → peringatan "di luar rentang yang terbukti di literatur".
- Kombinasi beberapa tuas → engine membuat Run skenario (kind `scenario`, `parentRunId` = baseline).

#### 5.4.2 Panel detail (klik kartu → "Kenapa 20%?")

Urutan isi panel, semuanya dirender dari output engine (`TraceStep[]`) dan pustaka bukti, bukan teks tetap:

1. **Kondisi sekarang** — angka dari data Anda (mis. bahan kimia tahap B, C, D = 280 kg/tahun).
2. **Dari mana angka 20%** — tabel bukti: sumber, kondisi studi, rentang hasil. Kalimat logika: "Studi dan panduan pencegahan pencemaran melaporkan penurunan 25–67% dengan waktu tiris dan tangki penampung. AeroSphere memakai 20%, di bawah angka terendah yang terbukti, agar tidak berlebihan."
3. **Perhitungan langkah demi langkah** — setiap langkah: rumus, angka masuk, hasil, satuan.
4. **Hasil** — tabel sebelum/sesudah: bahan kimia, air, limbah B3, jejak karbon, biaya.
5. **Penjelasan logis** — 3–5 kalimat mekanisme (mis. larutan yang terbawa part harus diganti dengan bahan baru, lalu masuk ke air bilas dan menjadi lumpur di IPAL).
6. **Sumber** — daftar tautan.
7. **Batasan** — apa yang tidak dihitung, asumsi yang perlu diukur di lini.

#### 5.4.3 Kriteria penerimaan

- Untuk fixture demo, angka di panel identik dengan nilai golden Bagian 6.
- Mengubah slider memperbarui seluruh langkah perhitungan dan hasil.
- Tidak ada rekomendasi tanpa sumber.

### 5.5 Laporan

Lihat Bagian 8 (format INALUM). Laporan Ringkas Manajemen yang sudah ada dipertahankan sebagai tab kedua ("Ringkasan untuk manajemen").

---

## 6. Pustaka tuas perbaikan (berbasis bukti)

Aturan umum:

- Setiap tuas adalah fungsi murni `applyLever(input, params) => { input', trace }`; engine lalu menghitung Run skenario dari `input'`.
- Nilai default dipilih **di bawah batas bawah rentang bukti** bila memungkinkan.
- Efek ke jejak karbon otomatis ikut karena engine menghitung ulang dengan faktor yang sama (setelah perbaikan A1).

### L1 — Kurangi larutan terbawa part (drag-out)

| Butir | Isi |
| --- | --- |
| Apa yang diubah | Waktu tiris di atas tangki, papan tiris (drain board), posisi part di rak, tangki penampung (drag-out tank) yang dikembalikan ke bath |
| Parameter | `r` = persen pengurangan drag-out; default **20%**; rentang slider 0–50% |
| Rentang bukti | Panduan pencegahan pencemaran untuk plating: waktu tiris yang cukup dapat menurunkan drag-out hingga sekitar dua pertiga, dan tangki drag-out memangkas kehilangan air dan bahan kimia sekitar 50% [R1]. Proyek EPA Region 5: menambah waktu tiris dan papan tiris menurunkan drag-out 25% [R2]. Proyek EPA Region 9 pada lini kadmium untuk aerospace: perubahan tata letak dan bilas semprot diperkirakan menurunkan kehilangan larutan 50% [R3]. Desain barrel saja dapat menurunkan drag-out hingga 48% [R4]. Takuma et al.: drag-out menentukan kebutuhan pengisian ulang bahan kimia, dan menguranginya menurunkan bahan kimia, beban IPAL, lumpur, dan dampak lingkungan sekaligus biaya [R5]. |
| Alasan default 20% | Lebih kecil dari hasil terendah yang terdokumentasi (25%), sehingga konservatif |
| Rumus | Bahan kimia bath (B, C, D; kategori `chemical`, bukan anoda) × (1 − r). Bahan kimia IPAL ber-`scalesWith: dragout_load` × (1 − r). Limbah B3 tahap F × (1 − r). Asumsi: pengisian ulang bath didominasi kehilangan drag-out; logam anoda menjadi lapisan [R5]. |
| Contoh golden (r = 20%) | Kimia proses: 280 kg × 20% = **−56 kg** → Rp2.520.000. Kimia IPAL (pereduksi Cr(VI) 35 + NaOH/kapur 35): 70 kg × 20% = **−14 kg** → Rp280.000. Lumpur B3 IPAL: 100 kg × 20% = **−20 kg** → Rp160.000. **Total hemat Rp2.960.000/tahun.** Jejak karbon: (56 + 14) × 2,5 = **−175 kg CO₂e (−9,5%)**, per m² 7,394 → 6,694. |
| Batasan | Transport B3 dihitung per periode, tidak ikut turun. Pengurangan air bilas akibat drag-out lebih kecil tidak dihitung agar tidak dobel dengan L2. Perlu uji drag-out di lini (konduktivitas bilasan pertama sebelum/sesudah). |
| Usaha / waktu | Rendah / 1–3 bulan |

Catatan: angka aplikasi saat ini (Rp3.180.000) akan berubah menjadi Rp2.960.000 karena rumus kini eksplisit.

### L2 — Bilasan bertingkat berlawanan arah (counter-current)

| Butir | Isi |
| --- | --- |
| Apa yang diubah | Jumlah tingkat bilas berlawanan arah dari n lama ke n baru (default 2 → 3) |
| Rumus | Kebutuhan air bilas Q = D × R^(1/n), dengan D = laju drag-out dan R = rasio konsentrasi bath ÷ konsentrasi bilasan terakhir yang diizinkan. Maka Q_baru ÷ Q_lama = R^(1/n_baru − 1/n_lama). Untuk 2 → 3: faktor = R^(−1/6). |
| Parameter | R default **1.000** (perkiraan; harus dihitung dari konduktivitas bath ÷ batas konduktivitas bilasan, mis. batas ≤ 20 µS/cm di SCM klien) |
| Rentang bukti | Model bilas: dua tangki berlawanan arah dapat mengurangi kebutuhan air hingga hampir 99% dibanding satu tangki, dan tiga tangki umumnya titik optimum [R6]. Menambah tangki bilas berlawanan arah kedua dapat memangkas air sekitar 90% [R7]. Studi kasus pabrik: tiga stasiun bilas memangkas aliran air 95% [R8]. |
| Contoh golden (R = 1.000, 2 → 3) | Faktor = 1.000^(−1/6) = 0,3162 → air bilas turun 68,4%. Air: 6.500 L → 2.055,5 L (**−4.444,5 L**) → Rp66.668. Listrik DI/RO ikut skala air DI: 40 kWh × 68,4% = **−27,35 kWh** → Rp41.027. **Total Rp107.694/tahun.** Jejak karbon −18,1 kg (−1,0%). |
| Batasan | Hanya berlaku untuk aliran air yang memang dipakai membilas. Butuh ruang tangki tambahan. Volume efluen ikut turun; koagulan ber-`scalesWith: effluent_volume` dapat ikut turun bila koefisien diisi (default 0). |
| Usaha / waktu | Sedang / 3–6 bulan |

### L3 — Ganti penyearah arus ke tipe switch-mode

| Butir | Isi |
| --- | --- |
| Rumus | kWh_baru = kWh_lama × η_lama ÷ η_baru (hanya komponen `deviceRole: rectifier`) |
| Parameter | η_lama default **75%** (wajib diukur: daya DC keluar ÷ daya AC masuk), η_baru default **88%** |
| Rentang bukti | Penyearah switch-mode modern mencapai efisiensi sekitar 90% pada tegangan operasi umum, dan penggantian dapat menurunkan konsumsi energi 10–30% atau lebih; selisih efisiensi makin besar pada tegangan keluaran rendah [R9]. Sumber lain mengingatkan penghematan nyata hanya signifikan pada kondisi tertentu, misalnya penyearah lama yang sering dioperasikan jauh di bawah kapasitasnya [R10]. |
| Contoh golden | 300 kWh × (1 − 0,75/0,88) = **−44,32 kWh** → **Rp66.477/tahun**; jejak karbon −27,2 kg (−1,5%) |
| Syarat tampil | Tampilkan dengan label "perlu ukur efisiensi penyearah sekarang" bila η_lama masih default |
| Usaha / waktu | Sedang / 3–6 bulan (investasi alat) |

### L4 — Kurangi kabut krom dari tangki (fume suppressant atau penutup tangki)

| Butir | Isi |
| --- | --- |
| Berlaku untuk | Hard chrome dan chromic acid anodizing |
| Rumus | Emisi Cr(VI) udara × (1 − e); kabut asam dari tangki krom × (1 − e) |
| Parameter | e default **90%** |
| Rentang bukti | Uji pada bath hard chrome menunjukkan penurunan emisi krom 20–70 kali dengan fume suppressant [R11]. Data uji regulator California menunjukkan penurunan sekitar 99% dibanding tangki tanpa kendali [R12]. Peringatan: sebagian suppressant menimbulkan pitting pada hard chrome, dan suppressant berbasis PFOS sudah dibatasi; alternatif mekanis berupa penutup tangki atau bola polipropilena [R13]. |
| Contoh golden | Cr(VI) udara 0,15 kg → 0,015 kg (−0,135 kg/tahun). Tidak ada penghematan biaya langsung; nilai utamanya kesehatan kerja dan kepatuhan. |
| Usaha / waktu | Rendah–sedang / 1–3 bulan; wajib uji kualitas lapisan |

### L5 — Turunkan nikel di efluen dengan flokulan (dari Takuma et al.)

| Butir | Isi |
| --- | --- |
| Rumus | Beban Ni efluen = volume efluen × C_Ni_baru; lumpur naik sebesar Ni yang tertangkap × (massa lumpur per mol Ni) |
| Parameter | C_Ni_baru default 0,064 mg/L (batas deteksi pada studi) |
| Rentang bukti | Penambahan flokulan menurunkan Ni efluen dari 5 ppm ke 64 ppb dan menurunkan dampak terintegrasi sekitar 2,4% (bath Watts) dan 3,2% (bath sitrat), dengan tambahan dampak lumpur hampir nol [R5] |
| Contoh golden | Ni efluen demo 0,3 mg/L × 5,85 m³ = 1,755 g → 0,374 g (−1,38 g/tahun). Dampak ekotoksisitas dihitung setelah faktor `proper_inalum_v1` tersedia. |
| Usaha / waktu | Rendah / 1–3 bulan |

### L6 — Turunkan konsentrasi bath di dalam batas kendali

| Butir | Isi |
| --- | --- |
| Rumus | Kehilangan bahan kimia via drag-out × (C_baru ÷ C_lama) |
| Parameter | C_baru dibatasi batas bawah control limit spesifikasi proses (mis. CrO₃ bebas 55 → 47,5 g/L = −13,6%) |
| Rentang bukti | Takuma et al. menyarankan menurunkan konsentrasi bath dalam rentang yang diizinkan untuk mengurangi bahan kimia yang terbawa tanpa mengubah drag-out [R5] |
| Syarat tampil | Hanya bila pengguna mengisi control limit tangki |

### L7 — Jadwal pemanas bath saat lini tidak dipakai

Takuma et al. menunjukkan listrik pemanas per kg produk naik bila bath jarang dipakai tetapi tetap dipanaskan [R5]. Belum ada angka persentase yang bisa dipakai umum, jadi tuas ini **tidak ditampilkan sebagai rekomendasi** sampai pengguna mengisi jam idle dan daya pemanas; setelah itu: kWh hemat = daya penahan suhu × jam idle yang dihapus.

### Golden kombinasi L1 + L2 + L3

Hemat **Rp3.134.171/tahun**; jejak karbon −220,3 kg (−11,9%), per m² 7,394 → 6,513.

---

## 7. Pustaka alasan teknis titik boros

Dipakai di kartu Titik Boros dan di kesimpulan laporan. Kunci = jenis lapisan + tahap + pemicu terbesar.

| Kunci | Alasan teknis (bahasa sehari-hari) | Sumber |
| --- | --- | --- |
| `hard_chrome.C.electricity` | Pada pelapisan krom keras, sebagian besar arus (sekitar 80–90%) habis untuk membentuk gas hidrogen, hanya 10–20% yang benar-benar menempelkan krom. Karena itu lapisan tebal butuh waktu lama dan listrik besar, dan gelembung gas ini juga membawa kabut krom ke udara. | [R14], [R15] |
| `hard_chrome.C.chemical` | Bath krom sangat pekat. Setiap kali rak diangkat, larutan menempel di part dan rak lalu terbuang ke bilasan; bath harus diisi ulang dengan asam kromat baru. | [R1], [R5] |
| `hard_chrome.D.grinding` (jika ada data gerinda) | Lapisan krom keras sering dibuat lebih tebal dari target lalu digerinda, sehingga sebagian krom dan energi terbuang. | [R15] |
| `any.F.waste_b3` | Logam yang terbawa ke air bilas diendapkan di IPAL menjadi lumpur. Makin banyak larutan terbawa part, makin banyak lumpur berbahaya. Mengurangi drag-out adalah cara paling efektif menekan lumpur. | [R16], [R5] |
| `any.A.water` / `any.D.water` | Bilasan satu tangki atau aliran air yang dibiarkan mengalir terus memakai air jauh lebih banyak daripada bilasan bertingkat berlawanan arah. | [R6], [R7] |
| `any.C.heater` / `any.E.heater` | Bath panas kehilangan energi lewat permukaan terbuka dan dinding tangki; bila lini jarang dipakai tetapi suhu tetap dijaga, listrik per m² naik. | [R5] |
| `any.E.electricity` | Ventilasi, scrubber, pompa, dan udara tekan menyala sepanjang jam kerja, tidak sebanding dengan jumlah part yang diproses. | Data pengguna (tanpa klaim literatur) |
| `nickel.C.chemical` | Bath nikel Watts berisi nikel sulfat dan nikel klorida pekat; garam yang terbawa part harus diganti, dan produksi garam nikel menyumbang dampak sumber daya dan asidifikasi. | [R5] |

Bila kunci tidak ditemukan, tampilkan hanya bagian "kenapa (data)" dan tulis "Alasan teknis belum tersedia untuk kombinasi ini".

---

## 8. Laporan format INALUM (menu Laporan)

Bagian ini menggantikan Laporan Ringkas sebagai laporan utama di menu Laporan, mengikuti permintaan C. Strukturnya meniru laporan kajian LCA PT INALUM 2025, ditambah kesimpulan dampak tertinggi di akhir.

### 8.1 Struktur halaman

1. **Judul**: "Laporan Kajian Life Cycle Assessment (LCA) Tahun {tahun}" + nama lini dan fasilitas.
2. **Kalimat pembuka**: "Laporan Kajian Life Cycle Assessment {lini} di {fasilitas} dengan lingkup {cradle to gate} disusun sesuai standar:" lalu daftar:
   - SNI ISO 14040:2016
   - SNI ISO 14044:2017
   - IAEG Aerospace LCA Framework v01 (2025) — sebagai pengganti PCR, karena PCR khusus pelapisan logam belum tersedia (tulis apa adanya)
   - Peraturan Menteri Lingkungan Hidup/BPLH No. 7 Tahun 2025 tentang PROPER
   - Pedoman Penyusunan Laporan Penilaian Daur Hidup (Ditjen PPKL)
3. **Tujuan Kajian LCA**: satu paragraf, template: menilai dampak lingkungan lini {lini} untuk menyusun program perbaikan dan mengidentifikasi peluang meningkatkan kinerja lingkungan secara konsisten.
4. **Ruang Lingkup LCA**: satu paragraf: jenis industri, produksi periode ({m²} permukaan dilapisi, {jumlah part} bila ada), bahan baku/input utama (cradle: bahan kimia, anoda, listrik, air), proses di lini (gate: tahap A–F), keluaran (part terlapisi, limbah B3, efluen, emisi udara). Kalimat wajib: "Tahap grave (pemakaian dan akhir masa pakai part) berada di luar lingkup kajian ini." Satuan fungsi: 1 m² permukaan dilapisi.
5. **Kesimpulan** (format INALUM): paragraf pengantar, lalu daftar kategori dampak signifikan per titik:
   - **a. Titik Cradle** — kategori di mana kontribusi hulu ≥ 50% dari total.
   - **b. Titik Gate** — kategori di mana kontribusi gate ≥ 50% atau ada tahap A–F dengan share ≥ 30%.
   - **c. Titik Grave** — "Tidak dikaji (di luar lingkup)".
   - Ditulis dua kolom berupa butir, seperti laporan INALUM.
   - Kalimat penutup: kajian dapat dipakai sebagai tahap awal menuju kajian yang lebih lengkap dan deklarasi produk ramah lingkungan (EPD).
6. **Tabel Ringkasan Evaluasi Dampak Proses Inti** (inti laporan):

| No | Kategori Dampak | Satuan | Metode | Pembersihan awal | Lapisan pengikat | Pelapisan utama | Perlakuan akhir | Utilitas | Pengolahan air limbah |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| | **Dampak Primer** | | | | | | | | |
| 1 | Global warming potential | % | IPCC 2021 GWP100 | 10,20 | 8,11 | 38,53 | 17,20 | 6,41 | 19,56 |
| 2 | Potensi penipisan ozon | % | ReCiPe 2016 Midpoint (H) | … | | | | | |
| 3 | Potensi hujan asam | % | ReCiPe 2016 Midpoint (H) | … | | | | | |
| 4 | Potensi eutrofikasi | % | CML-IA baseline | … | | | | | |
| | **Dampak Sekunder** | | | | | | | | |
| 5 | Photochemical oxidation | % | CML-IA baseline | | | | | | |
| 6 | Penurunan abiotik: a. fosil; b. non-fosil | % | CML-IA baseline | | | | | | |
| 7 | Penurunan biotik: a. ekotoksisitas darat; b. air tawar; c. laut | % | ReCiPe 2016 Midpoint (H) | | | | | | |
| 8 | Karsinogenik | % | ReCiPe 2016 Midpoint (H) | | | | | | |
| 9 | Toksisitas | % | CML-IA baseline | | | | | | |
| 10 | Water footprint | % | ReCiPe 2016 Midpoint (H) | | | | | | |
| 11 | Land use change | % | ReCiPe 2016 Midpoint (H) | | | | | | |
| | **Dampak Pemakaian Energi** | | | | | | | | |
| 12 | Cumulative Energy Demand: a. non-renewable; b. renewable | % | CED | | | | | | |

   Aturan: setiap baris berjumlah 100,00%; dua desimal; sel terbesar di setiap baris ditebalkan; kategori tanpa faktor → seluruh baris "belum dihitung" dengan catatan kaki. Contoh baris GWP di atas adalah nilai golden demo dengan faktor skrining.

7. **Tambahan yang tidak ada di INALUM tetapi wajib** (agar persentase bisa dipertanggungjawabkan): tabel nilai absolut per 1 m² dan per periode untuk setiap kategori (format seperti laporan LCA Pusri), dan catatan kualitas data (persentase data primer vs sekunder, profil faktor dan versinya).
8. **Kesimpulan dampak tertinggi dan kemungkinan alasannya** (permintaan C), disusun otomatis:
   - **Per kategori**: untuk setiap kategori, tahap dengan share tertinggi + 1 kalimat pemicu (dari driver engine) + alasan teknis (Bagian 7). Contoh dari data demo: "Global warming potential tertinggi di Pelapisan utama (38,53%). Pemicunya bahan kimia bath (375 kg CO₂e) dan listrik penyearah arus, pemanas, dan chiller (337 kg CO₂e). Pada krom keras, sebagian besar arus habis menjadi gas hidrogen sehingga pemakaian listrik per lapisan tinggi."
   - **Lintas kategori**: membandingkan "dampak mana yang paling tinggi" antar kategori yang satuannya berbeda **hanya sah setelah normalisasi**. Bila faktor normalisasi ReCiPe 2016 (H) sudah diimpor dari paket metode, tampilkan peringkat kategori ternormalisasi dengan label "indikatif". Bila belum, laporan menulis: "Perbandingan antar kategori belum dilakukan karena memerlukan normalisasi; peringkat di atas berlaku per kategori." Engine tidak boleh membandingkan angka mentah antar kategori.
   - **Tiga rekomendasi** dari tuas yang lolos syarat (Bagian 6), lengkap dengan hemat Rp dan penurunan dampak.
9. **Footer setiap halaman**: nomor hasil, versi profil faktor, tanggal, kelas informasi ("Rahasia – Tenant"), dan kalimat "Belum melalui tinjauan kritis pihak ketiga".

### 8.2 Bahasa

INALUM menerbitkan versi Indonesia dan Inggris. Laporan punya pilihan **Bahasa Indonesia / English / Dwibahasa**. Kamus istilah laporan:

| Indonesia | English |
| --- | --- |
| Laporan Kajian Life Cycle Assessment (LCA) | Life Cycle Assessment (LCA) Study Report |
| Tujuan Kajian LCA | Objectives of the LCA Study |
| Ruang Lingkup LCA | Scope of the LCA |
| Titik Cradle / Gate / Grave | Cradle point / Gate point / Grave point |
| Dampak Primer / Sekunder / Pemakaian Energi | Primary Impact / Secondary Impact / Energy Use Impact |
| Potensi hujan asam | Acidification potential |
| Potensi penipisan ozon | Ozone depletion potential |
| Penurunan abiotik / biotik | Abiotic depletion / Biotic depletion |
| Tabel Ringkasan Evaluasi Dampak Proses Inti | Summary of Core Process Impact Evaluation |

### 8.3 Ekspor

- **PDF**: CSS cetak A4, margin 2 cm, header logo, tabel tidak terpotong antarhalaman.
- **Excel**: sheet `Laporan`, `Tabel_Dampak_%`, `Nilai_Absolut`, `Kesimpulan`, `Data_Input`, `Faktor`.
- **Word (Phase 2)**: dari template yang sama di server.

---

## 9. Backend (Phase 2)

### 9.1 Stack

| Lapisan | Pilihan | Catatan |
| --- | --- | --- |
| API | Python 3.12 + FastAPI + Pydantic v2 | Engine diport dari TypeScript; fixture golden yang sama di `tests/golden` |
| DB | PostgreSQL 16 | Skema Bagian 3.2 |
| Antrian | RQ atau Dramatiq + Redis | Run, laporan, ekspor |
| Auth | JWT (fastapi-users) + MFA TOTP untuk admin | Keycloak ditunda ke fase komersial; lebih ringan untuk satu VPS |
| Laporan | Jinja2 → HTML → PDF (WeasyPrint), openpyxl untuk Excel | Template sama dengan frontend |
| Hosting | VPS (sesuai RAB), Docker Compose: caddy, api, worker, postgres, redis, minio | Backup harian terenkripsi |
| Frontend | Tetap di Netlify; variabel lingkungan URL API; CORS hanya untuk domain Netlify | Mode demo (IndexedDB) tetap tersedia tanpa login |

### 9.2 Endpoint

| Method | Path | Fungsi |
| --- | --- | --- |
| POST | `/api/v1/auth/register`, `/auth/login`, `/auth/refresh` | Akun |
| GET/POST | `/api/v1/projects` | Daftar/buat proyek |
| GET/PATCH | `/api/v1/projects/{id}` | Detail, ubah luas dilapisi, profil metode |
| GET | `/api/v1/projects/{id}/components` | Daftar komponen (tanpa yang terhapus) |
| POST | `/api/v1/projects/{id}/components` | Tambah komponen |
| PATCH | `/api/v1/components/{cid}` | Ubah komponen |
| DELETE | `/api/v1/components/{cid}` | Soft delete; `POST /components/{cid}/restore` untuk urungkan |
| POST | `/api/v1/projects/{id}/import` | Unggah Excel template → komponen |
| POST | `/api/v1/projects/{id}/runs` | Jalankan analisis → 202 + `job_id` |
| GET | `/api/v1/projects/{id}/runs` | Riwayat hasil |
| GET | `/api/v1/projects/{id}/runs/{rid}` | Satu run lengkap |
| GET | `/api/v1/projects/{id}/runs/compare?a=&b=` | Perbandingan |
| PATCH | `/api/v1/projects/{id}/runs/{rid}` | Ganti nama, jadikan pembanding |
| DELETE | `/api/v1/projects/{id}/runs/{rid}` | Soft delete (ditolak bila dipakai laporan) |
| GET | `/api/v1/levers` | Pustaka tuas + bukti + sumber |
| POST | `/api/v1/projects/{id}/runs/{rid}/scenarios` | Body: daftar tuas & parameter → Run skenario + trace |
| POST | `/api/v1/projects/{id}/runs/{rid}/reports` | Body: `template: inalum|ringkas`, `language: id|en|bilingual`, `format: pdf|xlsx` |
| GET | `/api/v1/reports/{id}/download` | Unduh |
| GET | `/api/v1/projects/{id}/export.xlsx` | Ekspor semua run (satu sheet per run) |
| GET | `/api/v1/audit?entity=&from=&to=` | Log perubahan (admin, auditor) |

Konvensi: error format `application/problem+json`; kunci idempotensi untuk POST run dan impor; semua angka dari engine server, frontend hanya menampilkan.

### 9.3 Aturan backend

- `run.result` dan `run.input_snapshot` tidak bisa di-UPDATE (trigger PostgreSQL).
- Setiap perubahan komponen, harga, dan run tercatat di `event_log` dengan hash berantai.
- Pemeriksaan paket (entitlement) di middleware: fitur di luar paket → HTTP 403 `PLAN_REQUIRED`.
- AI ("Tanya AeroSphere"): hanya membaca `run.result`; setiap angka dalam jawaban dicocokkan ke field hasil, jika tidak cocok jawaban ditolak.

---

## 10. Keamanan & kerahasiaan data

- Nomor tangki dan nama produk kimia dari dokumen klien (mis. SCM) disimpan dalam bentuk inisial; kunci pemetaan hanya untuk peran Admin/Data Steward.
- Kelas informasi: Public, Internal, Rahasia – Tenant, Terbatas. Kelas tercetak di footer laporan dan nama file ekspor.
- Kontrol mengacu ISO/IEC 27001:2022 Annex A (klasifikasi 5.12, pelabelan 5.13, kontrol akses 5.15, logging 8.15, kriptografi 8.24, data masking 8.11). Jangan menulis "bersertifikat ISO 27001" di UI.
- Mode demo: tampilkan jelas bahwa data hanya di browser ini.

---

## 11. Pengujian & definisi selesai

| Jenis | Isi | Alat |
| --- | --- | --- |
| Unit golden | Semua nilai Bagian 4.8.2 dan contoh golden Bagian 6 | Vitest/Jest (Phase 1), pytest (Phase 2) — fixture JSON yang sama |
| Properti | Share tiap kategori berjumlah 100% ±0,01; hapus komponen lalu urungkan menghasilkan hash input yang sama | Vitest + fast-check |
| E2E alur | Login demo → Data Saya → tambah → hapus → urungkan → Jalankan analisis → Riwayat (2 run) → Bandingkan → Titik Boros → Simulasi detail → Laporan PDF & Excel | Playwright |
| E2E tombol mati | Klik semua tombol/tautan terlihat di tiap halaman; gagal bila tanpa efek atau ada error console | Playwright |
| Aksesibilitas | Kontras, label tombol ikon, navigasi keyboard | axe-core |
| Visual | Tangkapan layar Titik Boros & Laporan dibanding baseline | Playwright screenshot |

Definisi selesai setiap milestone: tes lulus, tidak ada error console, tidak ada istilah teknis di Mode Ringkas, dokumentasi perubahan di `CHANGELOG.md`.

---

## 12. Milestone & prompt untuk Claude Code

| # | Milestone | Prompt |
| --- | --- | --- |
| M0 | Audit repo | "Baca docs/AEROSPHERE_SPEC.md. Petakan struktur repo: framework, routing, di mana perhitungan dilakukan, di mana data disimpan, daftar semua tombol per halaman dan apakah handler-nya ada. Tulis temuan ke docs/AUDIT.md. Jangan ubah kode." |
| M1 | Engine + golden | "Ekstrak semua perhitungan ke src/engine sesuai Bagian 3–4. Buat fixture plating_demo_v1.json dan tes golden Bagian 4.8.2. Perbaiki A1 (faktor bahan kimia & air) dan A2 (nilai terbuang). Semua tes harus lulus." |
| M2 | Data Saya + Run + Riwayat | "Implementasikan Bagian 5.2: hapus dengan konfirmasi & urungkan, tambah komponen, tombol Jalankan analisis, run immutable di IndexedDB, halaman Riwayat hasil dengan buka/bandingkan/jadikan pembanding/ekspor Excel satu sheet per run. Tambah tes e2e." |
| M3 | Beranda | "Implementasikan Bagian 5.1 memakai hasil run terbaru dan run pembanding." |
| M4 | Titik Boros | "Implementasikan Bagian 4.6, 5.3, dan 7: grafik batang bertumpuk dengan penanda titik boros, kalimat jawaban, kartu alasan data dan teknis." |
| M5 | Simulasi | "Implementasikan Bagian 5.4 dan 6: tuas L1–L6 sebagai fungsi murni dengan trace, kartu rekomendasi, panel detail 'Kenapa x%'. Tambahkan nilai golden Bagian 6 ke tes." |
| M6 | Laporan INALUM | "Implementasikan Bagian 8: laporan format INALUM dwibahasa, tabel persen per tahap, tabel nilai absolut, kesimpulan otomatis, ekspor PDF dan Excel. Kategori tanpa faktor ditulis 'belum dihitung'." |
| M7 | QA | "Jalankan seluruh tes Bagian 11, perbaiki semua tombol mati, periksa istilah teknis di Mode Ringkas." |
| M8 | Backend | "Bangun backend Bagian 9 di folder server/, port engine ke Python dengan fixture golden yang sama, Docker Compose untuk VPS, sambungkan frontend lewat variabel URL API dengan mode demo tetap berjalan." |
| M9 | Pipeline faktor | "Buat tools/factors/export_openlca.py sesuai Bagian 4.2.3 memakai olca-ipc, hasilkan proper_inalum_v1.json." |

---

## 13. Referensi

| Kode | Sumber |
| --- | --- |
| R1 | P2 Xchange (Kansas State Univ.), checklist pengurangan limbah plating, dimuat di Plating & Surface Finishing, Mei 2000 — https://sterc.org/pdf/p0500i.pdf |
| R2 | US EPA Region 5, P2 Research and Implementation for Michigan Metal Finishers (webinar, 27 Mei 2020) — https://www.epa.gov/sites/default/files/2020-07/documents/p2webinar_cushnie_052720.pdf |
| R3 | US EPA Region 9 / MFASC, Modifying Tank Layouts (studi lini kadmium aerospace) — https://19january2021snapshot.epa.gov/sites/static/files/documents/metal-tanklay.pdf |
| R4 | The Effect of Barrel Design on Drag-out, Plating & Surface Finishing, Feb 2002 — https://sterc.org/pdf/psf2002/020232.pdf |
| R5 | Takuma Y., Sugimori H., Ando E., Mizumoto K., Tahara K. (2018). Comparison of the environmental impact of the conventional nickel electroplating and the new nickel electroplating. Int J Life Cycle Assess 23:1609–1623. DOI 10.1007/s11367-017-1375-y |
| R6 | Hillier A.C., Walton C.W., Modeling Electroplating Rinse Systems Using Equation-Solving Software — https://sterc.org/pdf/11191072.pdf |
| R7 | Improving rinse water efficiency (survei & panduan bilas berlawanan arah) — https://sterc.org/pdf/other/0283.pdf.pdf |
| R8 | Studi kasus Orbel Corporation, pengurangan air pada pelapisan reel-to-reel — https://sterc.org/pdf/other/0255.pdf.pdf |
| R9 | NMFRC/KraftPowercon, efisiensi penyearah switch-mode vs SCR — https://www.nmfrc.org/tech_articles/jhleditwalldaldossantos.pdf |
| R10 | Products Finishing, The True Cost of SCR Versus Switch-Mode Rectifiers (Juli 2020) — https://pfonline.com/articles/the-true-cost-of-scr-versus-switch-mode-rectifiers |
| R11 | A Comprehensive Test of the Effect of a Fume Suppressant Used in Hard Chromium Electroplating — https://sterc.org/pdf/awk04/awk0417.pdf |
| R12 | CARB, Proposed Amended ATCM for Hexavalent Chromium, komentar dan data uji — https://www.arb.ca.gov/lists/chrom06/2-chrom06-2.pdf |
| R13 | TCEQ, Chromium emission reduction techniques (BACT memo) — https://www.tceq.texas.gov/assets/public/permitting/air/memos/historical_memos/chrome.txt |
| R14 | US EPA AP-42 Bab 12.20, Electroplating — https://www.epa.gov/sites/default/files/2020-11/documents/c12s20.pdf |
| R15 | Elsyca, Engineering solutions for hard chrome plating — https://elsyca-v2.nimbu.io/learn/engineering-solutions-for-hard-chrome-plating |
| R16 | Modeling for sludge estimation & reduction in electroplating — https://nmfrc.org/pdf/9810059.pdf |
| — | PT INALUM, Laporan Kajian LCA Tahun 2025 (versi ID & EN) — acuan format |
| — | PT Pupuk Sriwidjaja Palembang, Laporan Penilaian Daur Hidup Urea 2025 — acuan tabel nilai absolut & kualitas data |
| — | GEC/JCM, Grid emission factor Indonesia JAMALI — https://gec.jp/innovation/R4/T.CO2EmissionFactor_20220406.pdf |
| — | ISO 14040:2006, ISO 14044:2006, ISO 14051:2011; IAEG Aerospace LCA Framework v01 (2025); ISO/IEC 27001:2022 |

Semua sumber di atas diparafrasekan. Saat ditampilkan di aplikasi, tampilkan judul + tautan, jangan menyalin paragraf sumber.
