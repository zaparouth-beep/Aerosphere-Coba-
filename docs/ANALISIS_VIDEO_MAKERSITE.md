# Analisis video "How to automate LCAs with Makersite" dan penerapannya di AeroSphere

Sumber: video YouTube `EcODvjWOdcQ` (6 menit 26 detik), dianalisis dari 64 frame (satu per 6 detik). Yang diambil hanya **konsep tampilan dan alur kerja**. Logo, nama produk, angka, dan data dari video tidak dipakai di aplikasi.

## 1. Alur kerja di video

| Menit | Yang terjadi | Pola tampilan |
| --- | --- | --- |
| 0:00–0:55 | Daftar bahan (BOM) dari Excel: level, nama, material, jumlah, satuan | Data mentah dari pengguna tetap dikenali (hierarki komponen) |
| 1:00–1:20 | Unggah file, lalu sistem mencocokkan tiap baris ke dataset | Tiap baris diberi tanda kecocokan (%, "Alternative", "Default") |
| 1:24–1:45 | **Ringkasan produk** | Kartu-kartu: Information, Should Cost (donat + total di tengah + legenda per komponen + saran "Reduce costs"), Supply Chain (alur mini + "Improve supply chain"), Environment (donat 14,71 kg CO₂e + "Improve environment"), Suppliers (peta), Life Cycle, Global Regulations. **Daftar isi di kanan** |
| 1:48–2:54 | **Diagram alur (Sankey)** bahan → komponen → produk | Hover menampilkan nilai ("2,16 kg, Motor → Blender"); klik node memunculkan menu (Drill in, Substitute, Edit, Save, To-Do); **breadcrumb** + "Back to default layout"; panel kanan **Tools & Suggestions** untuk node terpilih |
| 3:00–3:54 | **Ganti indikator** lewat ubin ikon (Business / Environment / Health / Regulations → Climate change, Ozone, Acidification, …) | Lebar pita berubah sesuai indikator (kg → kg CO₂e); tooltip "8,24 kg CO₂ eq" |
| 4:00–4:20 | **Substitute**: Stator diganti aluminium | Panel **Performance Analytics** menyimpan perubahan sebagai pin ("+23,0% increase", "1 active pin") |
| 4:24–4:42 | **Grid**: tabel biaya per baris (material, manufaktur, total, should cost, rentang ±%) | Tampilan sama, bentuk berbeda (Sankey / Heatmap / Grid) |
| 4:48–5:48 | Supply risk (pita berwarna per status), siklus hidup (Production / Use / Auxiliaries / End of Life) | Warna pita = status; siklus hidup sebagai alur |

## 2. Prinsip yang diambil

1. **Satu ringkasan, banyak kartu.** Setiap kartu menjawab satu pertanyaan, punya total besar di tengah, rincian di legenda, dan satu saran di bawah dengan tautan ke langkah berikutnya.
2. **Alur sebelum tabel.** Orang lebih cepat melihat "dari mana ke mana" lewat pita yang lebarnya sebanding dengan nilai; angka pasti ada di tooltip.
3. **Telusuri bertahap** (drill-in + breadcrumb + kembali ke tampilan awal), tanpa memenuhi layar sejak awal.
4. **Saran menempel pada yang dipilih** (panel Tools & Suggestions), bukan halaman terpisah.
5. **Ganti indikator tanpa ganti halaman** (ubin ikon).
6. **Coba ganti lalu bandingkan** (Substitute + pin Performance Analytics).

## 3. Penerapan di AeroSphere

| Menu | Penerapan | Sumber angka |
| --- | --- | --- |
| **Hasil** | Kartu Informasi; Angka utama; donat **Jejak karbon** per tahap dan **Nilai terbuang** per pos, dengan total di tengah, legenda, dan kotak saran; **Alur bahan & energi** (sumber → tahap → total) dengan ubin indikator; **Siklus hidup** (dibeli vs. di lini; pemakaian & akhir masa pakai tidak dikaji); Per tahap proses; **daftar isi** lengket di kanan | `buildTitikBoros`, `wasteItems`, `buildFlow`, `lifeCycleSplit` |
| **Titik Boros** | Pilihan tampilan **Batang 100% / Alur**. Mode Alur punya ubin indikator, hover pita/kotak, klik kotak membuka panel **Saran & alat** (angka, pemicu, alasan teknis, perbaikan + "Lihat perhitungannya"), **Telusuri lebih dalam** ke komponen, breadcrumb, dan "Kembali ke tampilan awal". Sorotan tetap terhubung ke tabel dan kotak | `buildFlow` (warna tahap = kelas porsi), pustaka alasan §7 |
| **Simulasi Perbaikan** | **Coba perubahan**: pilih perbaikan → alur menampilkan sesudahnya dengan ▼/▲ % per kotak, tooltip sebelum → sesudah, tombol Sebelum/Sesudah; panel **Analitik perubahan** dengan chip Δ (jejak karbon, nilai terbuang, air, limbah B3), **Sematkan** beberapa perbaikan berdampingan ("n pin aktif"), dan tombol ke rincian perhitungan | `evaluateScenario`, `compareFlows` |

Yang sengaja **tidak** diambil: peta pemasok, risiko pasokan, regulasi global, dan pencocokan BOM otomatis. Data dan modelnya belum ada di AeroSphere. Pencocokan data bisa menjadi bagian Data Saya (M2).
