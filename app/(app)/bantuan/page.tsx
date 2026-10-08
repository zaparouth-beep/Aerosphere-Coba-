"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Compass, Search, Sparkles } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { GLOSSARY } from "@/lib/content/glossary";
import { useAppStore } from "@/lib/store/useAppStore";

const GUIDES: Record<string, string[]> = {
  "/beranda": ["Lihat empat angka utama dan statusnya.", "Ikuti daftar “Langkah Anda” dari kiri ke kanan.", "Klik kartu untuk membuka rinciannya."],
  "/data": ["Unduh template Excel, isi pemakaian bulan lalu, lalu unggah.", "Buka “Cek data”: perbaiki yang merah, terima yang kuning dengan alasan.", "Tekan “Setujui data”, lalu “Hitung hasil”."],
  "/hasil": ["Pilih indikator di grafik per tahap.", "Lihat berapa rupiah bahan dan energi yang terbuang.", "Mode Ahli menampilkan semua kategori dampak."],
  "/titik-boros": ["Tahap teratas paling layak diperbaiki lebih dulu.", "Klik tahap untuk melihat penyebab dan pengeluaran terbesarnya.", "Lanjutkan ke Simulasi Perbaikan."],
  "/simulasi": ["Pilih perbaikan di kiri, centang perubahan yang ingin diuji.", "Isi biaya investasi agar waktu balik modal terhitung.", "Tandai yang disarankan agar masuk laporan."],
  "/laporan": ["Laporan Ringkas: 2 halaman untuk atasan.", "Isi langkah berikutnya, penanggung jawab, dan tenggat.", "Tekan “Cetak / simpan PDF”."],
};

const FAQ = [
  { q: "Kenapa angka saya berbeda dari bulan lalu?", a: "Status Baik / Perlu perhatian / Kritis membandingkan dengan hasil tersimpan sebelumnya. Pastikan luas yang dilapisi sudah benar, karena semua angka dibagi luas itu." },
  { q: "Apa beda “Hitung hasil” dan data terkini?", a: "Data terkini berubah setiap kali Anda mengedit. “Hitung hasil” menyimpan salinan data dan angka dengan nomor, sehingga laporan bisa dicek ulang kapan saja." },
  { q: "Apakah Tanya AeroSphere bisa salah hitung?", a: "Tanya AeroSphere tidak menghitung. Semua angka berasal dari mesin hitung dan diperiksa ulang sebelum ditampilkan." },
  { q: "Bagaimana mengganti harga contoh dengan harga riil?", a: "Buka Data Saya → Isi data → Harga. Isi harga per item dari faktur; tanda “data contoh” hilang setelah harga diubah." },
  { q: "Siapa yang boleh menyetujui data?", a: "Admin dan Data Steward. Peran bisa dilihat di Pengaturan → Pengguna & peran." },
];

export default function Page() {
  const setUi = useAppStore((s) => s.setUi);
  const [q, setQ] = useState("");
  const terms = useMemo(
    () => GLOSSARY.filter((g) => `${g.label} ${g.term} ${g.explain}`.toLowerCase().includes(q.toLowerCase())),
    [q],
  );
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Tur pengenalan" subtitle="5 langkah singkat: Beranda → Data Saya → Hasil → Titik Boros → Laporan" />
          <CardBody>
            <Button variant="brand" onClick={() => setUi({ tourStep: 0 })}>
              <Compass className="h-4 w-4" /> Ulangi tur
            </Button>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Tanya AeroSphere" subtitle="Tanyakan arti hasil atau “bagaimana jika…” dengan bahasa sehari-hari." />
          <CardBody>
            <Button variant="secondary" onClick={() => setUi({ copilotOpen: true })}>
              <Sparkles className="h-4 w-4 text-brand-gold" /> Buka Tanya AeroSphere
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Panduan per menu" />
        <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {NAV_ITEMS.filter((n) => GUIDES[n.href]).map((n) => (
            <div key={n.href} className="rounded-lg border border-sand-200 p-3">
              <Link href={n.href} className="flex items-center gap-2 text-sm font-semibold text-navy-900 hover:text-brand-blue">
                <n.icon className="h-4 w-4 text-brand-teal" /> {n.label}
              </Link>
              <p className="mt-0.5 text-[11px] italic text-navy-700/60">{n.question}</p>
              <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-xs text-navy-800">
                {GUIDES[n.href]!.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ol>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card id="kamus">
        <CardHeader
          title="Kamus istilah"
          subtitle="Istilah teknis dan padanan sehari-hari yang dipakai di aplikasi"
          action={
            <label className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-navy-700/45" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari istilah…" className="w-56 pl-7" aria-label="Cari istilah" />
            </label>
          }
        />
        <CardBody>
          <dl className="grid gap-3 md:grid-cols-2">
            {terms.map((g) => (
              <div key={g.key} className="rounded-lg bg-sand-50 p-3">
                <dt className="text-sm font-semibold text-navy-900">{g.label}</dt>
                <dd className="text-[11px] text-navy-700/55">Istilah teknis: {g.term}</dd>
                <dd className="mt-1 text-xs leading-relaxed text-navy-800">{g.explain}</dd>
                {g.why && <dd className="mt-1 text-xs text-navy-700/75">Kenapa penting: {g.why}</dd>}
              </div>
            ))}
            {!terms.length && <p className="text-xs text-navy-700/60">Tidak ada istilah yang cocok.</p>}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Pertanyaan umum" />
        <CardBody className="space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-lg border border-sand-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-navy-900">{f.q}</summary>
              <p className="mt-2 text-xs leading-relaxed text-navy-800">{f.a}</p>
            </details>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
