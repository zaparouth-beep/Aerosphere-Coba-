# Changelog

Format: satu entri per milestone (lihat `docs/AUDIT.md` Bagian 7). Angka golden mengacu ke `docs/AEROSPHERE_SPEC.md` §4.8.

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
