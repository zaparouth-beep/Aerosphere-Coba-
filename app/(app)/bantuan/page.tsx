"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Compass, Search, Sparkles } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { GLOSSARY } from "@/lib/content/glossary";
import { tx } from "@/lib/i18n";
import { useAppStore } from "@/lib/store/useAppStore";

type Pair = [id: string, en: string];

const GUIDE_TEXT: Record<string, Pair[]> = {
  "/beranda": [
    ["Lihat empat angka utama dan statusnya.", "Check the four key figures and their status."],
    ["Ikuti daftar “Langkah Anda” dari kiri ke kanan.", "Follow the “Your steps” list from left to right."],
    ["Klik kartu untuk membuka rinciannya.", "Click a card to open its details."],
  ],
  "/data": [
    ["Unduh template Excel, isi pemakaian bulan lalu, lalu unggah.", "Download the Excel template, fill in last month's usage, then upload it."],
    ["Buka “Cek data”: perbaiki yang merah, terima yang kuning dengan alasan.", "Open “Check data”: fix the red items, accept the yellow ones with a reason."],
    ["Tekan “Setujui data”, lalu “Hitung hasil”.", "Press “Approve data”, then “Calculate results”."],
  ],
  "/hasil": [
    ["Pilih indikator di grafik per tahap.", "Choose an indicator in the per-stage chart."],
    ["Lihat berapa rupiah bahan dan energi yang terbuang.", "See how many rupiah of materials and energy are wasted."],
    ["Mode Ahli menampilkan semua kategori dampak.", "Expert mode shows every impact category."],
  ],
  "/titik-boros": [
    ["Tahap teratas paling layak diperbaiki lebih dulu.", "The top stage is the best one to improve first."],
    ["Klik tahap untuk melihat penyebab dan pengeluaran terbesarnya.", "Click a stage to see its causes and largest costs."],
    ["Lanjutkan ke Simulasi Perbaikan.", "Continue to Improvement Simulation."],
  ],
  "/simulasi": [
    ["Pilih perbaikan di kiri, centang perubahan yang ingin diuji.", "Choose an improvement on the left and tick the changes you want to test."],
    ["Isi biaya investasi agar waktu balik modal terhitung.", "Enter the investment cost so the payback time can be calculated."],
    ["Tandai yang disarankan agar masuk laporan.", "Mark the recommended ones so they appear in the report."],
  ],
  "/laporan": [
    ["Laporan Ringkas: 2 halaman untuk atasan.", "Summary report: 2 pages for your manager."],
    ["Isi langkah berikutnya, penanggung jawab, dan tenggat.", "Fill in the next steps, owner and deadline."],
    ["Tekan “Cetak / simpan PDF”.", "Press “Print / save PDF”."],
  ],
};

const guides = (href: string): string[] | undefined => GUIDE_TEXT[href]?.map(([id, en]) => tx(id, en));

const FAQ_TEXT: Array<{ q: Pair; a: Pair }> = [
  {
    q: ["Kenapa angka saya berbeda dari bulan lalu?", "Why are my figures different from last month?"],
    a: [
      "Status Baik / Perlu perhatian / Kritis membandingkan dengan hasil tersimpan sebelumnya. Pastikan luas yang dilapisi sudah benar, karena semua angka dibagi luas itu.",
      "The Good / Needs attention / Critical status compares against the previous saved result. Make sure the plated area is correct, because every figure is divided by it.",
    ],
  },
  {
    q: ["Apa beda “Hitung hasil” dan data terkini?", "What is the difference between “Calculate results” and current data?"],
    a: [
      "Data terkini berubah setiap kali Anda mengedit. “Hitung hasil” menyimpan salinan data dan angka dengan nomor, sehingga laporan bisa dicek ulang kapan saja.",
      "Current data changes every time you edit. “Calculate results” saves a numbered copy of the data and figures, so reports can be rechecked at any time.",
    ],
  },
  {
    q: ["Apakah Tanya AeroSphere bisa salah hitung?", "Can Ask AeroSphere miscalculate?"],
    a: [
      "Tanya AeroSphere tidak menghitung. Semua angka berasal dari mesin hitung dan diperiksa ulang sebelum ditampilkan.",
      "Ask AeroSphere does not calculate. Every number comes from the calculation engine and is double-checked before it is shown.",
    ],
  },
  {
    q: ["Bagaimana mengganti harga contoh dengan harga riil?", "How do I replace sample prices with real prices?"],
    a: [
      "Buka Data Saya → Isi data → Harga. Isi harga per item dari faktur; tanda “data contoh” hilang setelah harga diubah.",
      "Open My Data → Enter data → Prices. Enter each item's price from invoices; the “sample data” tag disappears once a price is changed.",
    ],
  },
  {
    q: ["Siapa yang boleh menyetujui data?", "Who can approve data?"],
    a: [
      "Admin dan Data Steward. Peran bisa dilihat di Pengaturan → Pengguna & peran.",
      "Admins and Data Stewards. Roles are listed in Settings → Users & roles.",
    ],
  },
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
          <CardHeader
            title={tx("Tur pengenalan", "Intro tour")}
            subtitle={tx(
              "5 langkah singkat: Beranda → Data Saya → Hasil → Titik Boros → Laporan",
              "5 quick steps: Home → My Data → Results → Waste Hotspots → Reports",
            )}
          />
          <CardBody>
            <Button variant="brand" onClick={() => setUi({ tourStep: 0 })}>
              <Compass className="h-4 w-4" /> {tx("Ulangi tur", "Replay tour")}
            </Button>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={tx("Tanya AeroSphere", "Ask AeroSphere")}
            subtitle={tx(
              "Tanyakan arti hasil atau “bagaimana jika…” dengan bahasa sehari-hari.",
              "Ask what the results mean or “what if…” in plain language.",
            )}
          />
          <CardBody>
            <Button variant="secondary" onClick={() => setUi({ copilotOpen: true })}>
              <Sparkles className="h-4 w-4 text-brand-gold" /> {tx("Buka Tanya AeroSphere", "Open Ask AeroSphere")}
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={tx("Panduan per menu", "Guide by menu")} />
        <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {NAV_ITEMS.filter((n) => GUIDE_TEXT[n.href]).map((n) => (
            <div key={n.href} className="rounded-lg border border-sand-200 p-3">
              <Link href={n.href} className="flex items-center gap-2 text-sm font-semibold text-navy-900 hover:text-brand-blue">
                <n.icon className="h-4 w-4 text-brand-teal" /> {n.label}
              </Link>
              <p className="mt-0.5 text-[11px] italic text-navy-700/60">{n.question}</p>
              <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-xs text-navy-800">
                {guides(n.href)!.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ol>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card id="kamus">
        <CardHeader
          title={tx("Kamus istilah", "Glossary")}
          subtitle={tx("Istilah teknis dan padanan sehari-hari yang dipakai di aplikasi", "Technical terms and the everyday words used for them in the app")}
          action={
            <label className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-navy-700/45" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Cari istilah…", "Search terms…")} className="w-56 pl-7" aria-label={tx("Cari istilah", "Search terms")} />
            </label>
          }
        />
        <CardBody>
          <dl className="grid gap-3 md:grid-cols-2">
            {terms.map((g) => (
              <div key={g.key} className="rounded-lg bg-sand-50 p-3">
                <dt className="text-sm font-semibold text-navy-900">{g.label}</dt>
                <dd className="text-[11px] text-navy-700/55">
                  {tx("Istilah teknis", "Technical term")}: {g.term}
                </dd>
                <dd className="mt-1 text-xs leading-relaxed text-navy-800">{g.explain}</dd>
                {g.why && (
                  <dd className="mt-1 text-xs text-navy-700/75">
                    {tx("Kenapa penting", "Why it matters")}: {g.why}
                  </dd>
                )}
              </div>
            ))}
            {!terms.length && <p className="text-xs text-navy-700/60">{tx("Tidak ada istilah yang cocok.", "No matching terms.")}</p>}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={tx("Pertanyaan umum", "FAQ")} />
        <CardBody className="space-y-2">
          {FAQ_TEXT.map((f) => (
            <details key={f.q[0]} className="rounded-lg border border-sand-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-navy-900">{tx(...f.q)}</summary>
              <p className="mt-2 text-xs leading-relaxed text-navy-800">{tx(...f.a)}</p>
            </details>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
