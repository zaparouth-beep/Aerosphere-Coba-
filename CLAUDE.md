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
