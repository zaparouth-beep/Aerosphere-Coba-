"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BarChart3, Calculator, FileText, ShieldCheck, SlidersHorizontal, Upload } from "lucide-react";
import { PlanCards, PlanComparison } from "@/components/plans/PlanPicker";
import { NumberInput } from "@/components/ui/Input";
import { hardChromeDemo } from "@/lib/domain/templates";
import { calculate, indicatorsOf } from "@/lib/engine/calculate";
import { evaluateScenario } from "@/lib/engine/scenario";
import { fmt, fmtRp } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { T, tx } from "@/lib/i18n";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const STEPS = [
  {
    icon: Upload,
    get title() {
      return tx("Unggah data", "Upload data");
    },
    get text() {
      return tx("Isi template Excel: listrik, air, bahan kimia, limbah, dan luas yang dilapisi.", "Fill in the Excel template: electricity, water, chemicals, waste and plated area.");
    },
  },
  {
    icon: BarChart3,
    get title() {
      return tx("Lihat hasil", "See results");
    },
    get text() {
      return tx("Jejak karbon, air, limbah berbahaya, dan biaya per m² langsung terhitung.", "Carbon footprint, water, hazardous waste and cost per m², calculated instantly.");
    },
  },
  {
    icon: SlidersHorizontal,
    get title() {
      return tx("Coba perbaikan", "Try improvements");
    },
    get text() {
      return tx("Uji “bagaimana jika” sebelum mengubah satu tangki pun di lini.", "Test “what if” before changing a single tank on the line.");
    },
  },
  {
    icon: FileText,
    get title() {
      return tx("Kirim laporan", "Send the report");
    },
    get text() {
      return tx("Laporan ringkas 2 halaman untuk atasan, laporan teknis untuk auditor.", "A 2-page summary for management, a technical report for auditors.");
    },
  },
];

const FAQ = [
  {
    get q() {
      return tx("Apakah hanya untuk lini pelapisan logam?", "Is it only for metal plating lines?");
    },
    get a() {
      return tx("Saat ini lini pelapisan logam (plating) komponen pesawat menjadi proyek percontohan: template data, tahap proses, dan simulasi perbaikannya sudah siap. Metode LCA yang sama akan diperluas bertahap ke lini proses manufaktur pesawat lainnya.", "For now, metal plating lines for aircraft components are the pilot project: the data template, process stages and improvement simulations are ready. The same LCA method will be extended step by step to other aircraft manufacturing process lines.");
    },
  },
  {
    get q() {
      return tx("Data apa saja yang perlu saya siapkan?", "What data do I need to prepare?");
    },
    get a() {
      return tx("Catatan pemakaian listrik, air, dan bahan kimia per bulan, berat limbah B3 dari manifest, serta total luas permukaan yang dilapisi. Template Excel menuntun kolom yang perlu diisi.", "Monthly records of electricity, water and chemical use, hazardous (B3) waste weights from your manifests, and the total plated surface area. The Excel template guides you through the columns to fill in.");
    },
  },
  {
    get q() {
      return tx("Apakah saya perlu paham LCA?", "Do I need to understand LCA?");
    },
    get a() {
      return tx("Tidak. Mode Ringkas memakai bahasa sehari-hari dan setiap angka punya penjelasan “Apa ini?”. Mode Ahli tersedia untuk engineer dan auditor.", "No. Simple mode uses plain language and every number has a “What is this?” explanation. Expert mode is available for engineers and auditors.");
    },
  },
  {
    get q() {
      return tx("Dari mana angka hasilnya?", "Where do the numbers come from?");
    },
    get a() {
      return tx("Dari mesin hitung yang sama untuk semua pengguna, dengan faktor yang sumbernya tercatat. Asisten AI hanya menjelaskan angka, tidak mengarang angka.", "From the same calculation engine for every user, using factors with recorded sources. The AI assistant only explains numbers; it never makes them up.");
    },
  },
  {
    get q() {
      return tx("Bagaimana dengan keamanan data?", "What about data security?");
    },
    get a() {
      return tx("Versi demo ini menyimpan data hanya di browser Anda. Versi produksi memakai server terenkripsi dengan kontrol mengacu ISO/IEC 27001, dan paket Industri bisa dipasang on-premise.", "This demo stores data only in your browser. The production version uses encrypted servers with controls based on ISO/IEC 27001, and the Industry plan can be installed on-premise.");
    },
  },
  {
    get q() {
      return tx("Apa yang terjadi setelah 14 hari uji coba?", "What happens after the 14-day trial?");
    },
    get a() {
      return tx("Data tetap bisa dibaca selama 30 hari. Pilih paket untuk melanjutkan mengisi data dan mengunduh laporan tanpa tanda “Contoh”.", "Your data stays readable for 30 days. Choose a plan to keep entering data and download reports without the “Sample” watermark.");
    },
  },
];

export function Landing() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-teal/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 left-10 h-96 w-96 rounded-full bg-brand-blue/20 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-gold">{tx("Untuk keberlanjutan proses manufaktur Anda", "For more sustainable manufacturing processes")}</p>
            <h1 className="mt-3 text-2xl font-semibold leading-tight md:text-[34px]">
              <T
                id={
                  <>
                    Temukan tahap paling boros di proses, berapa rupiahnya, dan perbaikan apa yang paling layak di industri manufaktur Anda melalui metode{" "}
                    <span className="bg-brand-gradient bg-clip-text text-transparent">LCA terintegrasi</span>.
                  </>
                }
                en={
                  <>
                    Find the most wasteful stage in your process, what it costs, and the most worthwhile improvements for your manufacturing business with{" "}
                    <span className="bg-brand-gradient bg-clip-text text-transparent">integrated LCA</span>.
                  </>
                }
              />
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
              {tx(
                "AeroSphere menghitung jejak karbon, pemakaian air, limbah berbahaya, dan biaya per m² dari data yang sudah Anda punya, lalu menunjukkan perbaikan dengan hasil terbesar.",
                "AeroSphere calculates carbon footprint, water use, hazardous waste and cost per m² from the data you already have, then shows the improvements with the biggest payoff.",
              )}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/masuk?daftar=1" className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95">
                {tx("Coba gratis", "Try for free")} <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#demo" className="rounded-lg border border-white/25 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10">
                {tx("Lihat demo", "See the demo")}
              </a>
              <a href="#paket" className="rounded-lg px-5 py-2.5 text-sm font-medium text-white/80 hover:text-white">
                {tx("Lihat paket", "See plans")}
              </a>
            </div>
            <p className="mt-6 text-xs text-white/50">{tx("14 hari gratis · tanpa kartu kredit · proyek contoh siap dicoba", "14 days free · no credit card · sample project ready to explore")}</p>
            <p className="mt-3 max-w-xl rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/70">
              <span className="font-semibold text-brand-gold">{tx("Proyek percontohan:", "Pilot project:")}</span>{" "}
              {tx(
                "lini pelapisan logam (plating) komponen pesawat. Lini proses manufaktur pesawat lainnya menyusul.",
                "metal plating lines for aircraft components. Other aircraft manufacturing process lines will follow.",
              )}
            </p>
          </div>
          <div className="flex justify-center">
            <div className="rounded-3xl bg-white p-8 shadow-2xl">
              <Image src={`${BASE}/brand/logo-color.png`} alt={tx("Logo AeroSphere LCA", "AeroSphere LCA logo")} width={260} height={257} className="h-auto w-[220px]" unoptimized priority />
            </div>
          </div>
        </div>
      </section>

      <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="text-center text-2xl font-semibold text-navy-900">{tx("Empat langkah, satu jawaban", "Four steps, one answer")}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-navy-700/70">
          {tx(
            "Di mana paling boros? Berapa rupiahnya? Perbaikan apa yang paling layak? Apa yang dikirim ke atasan?",
            "Where is the most waste? What does it cost? Which fix is most worthwhile? What goes to management?",
          )}
        </p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-xl border border-sand-200 bg-white p-5 shadow-card">
              <span className="num absolute right-4 top-4 text-3xl font-semibold text-sand-200">{i + 1}</span>
              <s.icon className="h-6 w-6 text-brand-teal" />
              <p className="mt-3 font-semibold text-navy-900">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-navy-700/75">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <MockupSection />
      <SavingsCalculator />

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-8 rounded-2xl border border-sand-200 bg-white p-6 shadow-card md:grid-cols-[1fr_1.1fr] md:p-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal">{tx("Contoh laporan", "Sample report")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-navy-900">{tx("Dua halaman yang bisa langsung dibaca atasan", "Two pages your management can read right away")}</h2>
            <ul className="mt-4 space-y-2 text-sm text-navy-800">
              <li>• {tx("Kesimpulan dalam tiga kalimat", "Conclusions in three sentences")}</li>
              <li>• {tx("Empat angka utama dengan status Baik / Perlu perhatian / Kritis", "Four key numbers rated Good / Needs attention / Critical")}</li>
              <li>• {tx("Tahap paling bermasalah dan tiga perbaikan dengan rupiahnya", "The most problematic stage and three improvements with their rupiah value")}</li>
              <li>• {tx("Seberapa yakin hasilnya, dan langkah berikutnya", "How confident the results are, and next steps")}</li>
            </ul>
            <Link href="/contoh-laporan" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">
              {tx("Buka contoh laporan", "Open the sample report")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-xl border border-sand-200 bg-sand-50 p-5 text-xs text-navy-800">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-700/55">{tx("Laporan Ringkas Manajemen", "Management Summary Report")}</p>
            <p className="mt-2 text-sm font-semibold text-navy-900">{tx("1. Kesimpulan", "1. Conclusions")}</p>
            <p className="mt-1 leading-relaxed">{tx("Tiga kalimat: tahap mana yang paling boros, berapa nilai bahan yang terbuang, dan perbaikan mana yang paling layak.", "Three sentences: which stage wastes the most, the value of wasted material, and which improvement is most worthwhile.")}</p>
            <p className="mt-3 text-sm font-semibold text-navy-900">{tx("2. Angka utama", "2. Key numbers")}</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {[tx("Jejak karbon", "Carbon footprint"), tx("Pemakaian air", "Water use"), tx("Limbah B3", "Hazardous (B3) waste"), tx("Biaya per m²", "Cost per m²")].map((x) => (
                <div key={x} className="rounded-md border border-sand-200 bg-white p-2">
                  {x}
                  <span className="mt-1 block h-2 w-2/3 rounded bg-sand-200" />
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-navy-700/55">{tx("Pratinjau tata letak · angka lengkap ada di contoh laporan", "Layout preview · full numbers are in the sample report")}</p>
          </div>
        </div>
      </section>

      <section id="paket" className="scroll-mt-20 border-y border-sand-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-semibold text-navy-900">{tx("Paket", "Plans")}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-navy-700/70">{tx("Mulai gratis 14 hari. Fitur lanjutan terbuka sesuai paket.", "Start free for 14 days. Advanced features unlock with your plan.")}</p>
          <div className="mt-8">
            <PlanCards readOnly />
          </div>
          <div className="mt-6 text-center">
            <Link href="/masuk?daftar=1" className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white">
              {tx("Coba gratis", "Try for free")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <details className="mt-8 rounded-xl border border-sand-200 p-4">
            <summary className="cursor-pointer text-sm font-medium text-navy-900">{tx("Bandingkan semua fitur", "Compare all features")}</summary>
            <div className="mt-4 overflow-x-auto">
              <PlanComparison />
            </div>
          </details>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16">
        <h2 className="text-center text-2xl font-semibold text-navy-900">{tx("Pertanyaan yang sering diajukan", "Frequently asked questions")}</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border border-sand-200 bg-white p-4 shadow-card">
              <summary className="cursor-pointer list-none text-sm font-semibold text-navy-900">
                <span className="mr-2 inline-block text-brand-teal transition-transform group-open:rotate-90">›</span>
                {f.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-navy-800">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="flex flex-col items-start gap-4 rounded-2xl bg-sand-100 p-6 text-sm text-navy-800 md:flex-row md:items-center">
          <ShieldCheck className="h-8 w-8 shrink-0 text-brand-teal" />
          <p className="flex-1 leading-relaxed">
            <T
              id={
                <>
                  Metode hitung selaras <b>ISO 14040/14044</b> (penilaian daur hidup) dan <b>ISO 14051</b> (biaya bahan yang terbuang). Versi produksi dirancang
                  dengan kontrol keamanan mengacu <b>ISO/IEC 27001</b>. Hasil belum melalui critical review pihak ketiga; jangan dipakai sebagai klaim
                  perbandingan publik.
                </>
              }
              en={
                <>
                  Calculation methods are aligned with <b>ISO 14040/14044</b> (life cycle assessment) and <b>ISO 14051</b> (cost of wasted material). The
                  production version is designed with security controls based on <b>ISO/IEC 27001</b>. Results have not yet been critically reviewed by a third
                  party; do not use them for public comparative claims.
                </>
              }
            />
          </p>
        </div>
      </section>
    </>
  );
}

const SCREENS = [
  {
    id: "beranda",
    get label() {
      return tx("Beranda", "Home");
    },
    get text() {
      return tx("Empat angka utama, tahap paling boros, dan perbaikan yang disarankan dalam satu layar.", "Four key numbers, the most wasteful stage and suggested improvements on one screen.");
    },
  },
  {
    id: "titik-boros",
    get label() {
      return tx("Titik Boros", "Waste Hotspots");
    },
    get text() {
      return tx("Urutan tahap paling bermasalah, penyebabnya, dan pengeluaran terbesar per m².", "The most problematic stages ranked, their causes and the biggest costs per m².");
    },
  },
  {
    id: "simulasi",
    get label() {
      return tx("Simulasi Perbaikan", "Improvement Simulation");
    },
    get text() {
      return tx("Uji “bagaimana jika” sebelum mengubah lini: hemat per tahun, jejak karbon, usaha, dan waktu.", "Test “what if” before changing the line: yearly savings, carbon footprint, effort and time.");
    },
  },
  {
    id: "laporan",
    get label() {
      return tx("Laporan", "Reports");
    },
    get text() {
      return tx("Laporan ringkas 2 halaman untuk atasan, siap dicetak atau disimpan sebagai PDF.", "A 2-page summary for management, ready to print or save as PDF.");
    },
  },
] as const;

/** Device mockups with real screenshots of the app (proyek percontohan), so visitors can picture the dashboard. */
function MockupSection() {
  const [screen, setScreen] = useState<(typeof SCREENS)[number]["id"]>("beranda");
  const current = SCREENS.find((s) => s.id === screen)!;
  return (
    <section id="demo" className="scroll-mt-20 overflow-hidden border-y border-sand-200 bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal">{tx("Tampilan aplikasi", "Inside the app")}</p>
        <h2 className="mt-1 text-center text-2xl font-semibold text-navy-900">{tx("Dashboard yang langsung bisa dibaca, di laptop maupun HP", "A dashboard you can read at a glance, on laptop or phone")}</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-2" role="tablist" aria-label={tx("Pilih layar", "Choose a screen")}>
          {SCREENS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={screen === s.id}
              onClick={() => setScreen(s.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
                screen === s.id ? "border-navy-900 bg-navy-900 text-white" : "border-sand-300 bg-white text-navy-800 hover:bg-sand-50",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-navy-700/75">{current.text}</p>

        <div className="relative mx-auto mt-10 max-w-4xl pb-6 md:pr-24">
          {/* Laptop */}
          <div className="mx-auto">
            <div className="rounded-t-[18px] border border-navy-900 bg-navy-950 p-2.5 pb-3 shadow-2xl md:p-3.5">
              <div className="mx-auto mb-2 h-1.5 w-1.5 rounded-full bg-white/25" aria-hidden />
              <div className="aspect-[16/10] overflow-hidden rounded-md bg-sand-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${BASE}/mockup/${screen}.jpg`} alt={tx(`Tampilan ${current.label} di laptop`, `${current.label} screen on a laptop`)} className="h-full w-full object-cover object-top" loading="lazy" />
              </div>
            </div>
            <div className="relative mx-[-4%] h-3 rounded-b-xl bg-gradient-to-b from-[#c9ccd3] to-[#9aa0ab] md:h-4" aria-hidden>
              <div className="absolute left-1/2 top-0 h-1.5 w-24 -translate-x-1/2 rounded-b-md bg-[#8a909b]" />
            </div>
          </div>
          {/* Phone */}
          <div className="mx-auto mt-8 w-[210px] md:absolute md:-bottom-2 md:right-0 md:mt-0 md:w-[170px] lg:w-[190px]">
            <div className="rounded-[28px] border-[6px] border-navy-950 bg-navy-950 shadow-2xl ring-1 ring-navy-900">
              <div className="relative aspect-[390/844] overflow-hidden rounded-[22px] bg-sand-50">
                <div className="absolute left-1/2 top-1.5 z-10 h-3.5 w-14 -translate-x-1/2 rounded-full bg-navy-950" aria-hidden />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${BASE}/mockup/beranda-hp.jpg`} alt={tx("Tampilan Beranda di HP", "Home screen on a phone")} className="h-full w-full object-cover object-top" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/masuk?daftar=1" className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white">
            {tx("Coba sendiri gratis", "Try it yourself for free")} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/masuk" className="rounded-lg border border-sand-300 px-5 py-2.5 text-sm font-medium text-navy-900 hover:bg-sand-50">
            {tx("Masuk dengan akun demo", "Sign in with the demo account")}
          </Link>
        </div>
        <p className="mt-3 text-center text-[11px] text-navy-700/55">{tx("Tangkapan layar dari proyek percontohan lini pelapisan hard chrome; data dan harga contoh.", "Screenshots from the hard chrome plating pilot project; sample data and prices.")}</p>
      </div>
    </section>
  );
}

/** Savings calculator: user's monthly spend × reductions simulated on the sample line. Clearly an estimate. */
function SavingsCalculator() {
  const pct = useMemo(() => {
    const project = hardChromeDemo();
    const base = indicatorsOf(calculate(project));
    const levers = Object.assign({}, ...project.scenarios.map((s) => s.levers));
    const out = evaluateScenario(project, { ...project.scenarios[0]!, id: "all", levers }, base);
    const r = (k: "energyKwh" | "waterL" | "chemicalKg" | "wasteKg") => Math.max(-out.delta[k].pct, 0);
    return { energy: r("energyKwh"), water: r("waterL"), chemical: r("chemicalKg"), waste: r("wasteKg") };
  }, []);
  const [spend, setSpend] = useState({ energy: 150_000_000, chemical: 80_000_000, water: 10_000_000, waste: 25_000_000 });
  const monthly = (spend.energy * pct.energy + spend.chemical * pct.chemical + spend.water * pct.water + spend.waste * pct.waste) / 100;
  const fields: Array<{ key: keyof typeof spend; label: string; p: number }> = [
    { key: "energy", label: tx("Listrik", "Electricity"), p: pct.energy },
    { key: "chemical", label: tx("Bahan kimia", "Chemicals"), p: pct.chemical },
    { key: "water", label: tx("Air", "Water"), p: pct.water },
    { key: "waste", label: tx("Pengolahan limbah B3", "Hazardous (B3) waste treatment"), p: pct.waste },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal">
            <Calculator className="h-3.5 w-3.5" /> {tx("Kalkulator potensi hemat", "Savings potential calculator")}
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-navy-900">{tx("Perkiraan untuk lini Anda", "An estimate for your line")}</h2>
          <p className="mt-2 text-sm text-navy-700/75">{tx("Isi pengeluaran bulanan lini proses Anda (rupiah per bulan). Perkiraan memakai hasil lini pelapisan percontohan.", "Enter your process line’s monthly spend (rupiah per month). The estimate uses results from the pilot plating line.")}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className="block text-xs text-navy-800">
                <span className="mb-1 block font-medium">{f.label}</span>
                <NumberInput value={spend[f.key]} min={0} onCommit={(v) => setSpend((s) => ({ ...s, [f.key]: v ?? 0 }))} ariaLabel={tx(`Pengeluaran ${f.label} per bulan`, `Monthly spend on ${f.label.toLowerCase()}`)} />
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl bg-navy-950 p-6 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-brand-gold">{tx("Perkiraan", "Estimate")}</p>
            <p className="num mt-2 text-3xl font-semibold">{fmtRp(monthly * 12)}</p>
            <p className="text-sm text-white/70">{tx(`potensi hemat per tahun (${fmtRp(monthly)} per bulan)`, `potential savings per year (${fmtRp(monthly)} per month)`)}</p>
          </div>
          <div className="mt-6 text-[11px] leading-relaxed text-white/60">
            <p className="font-semibold text-white/80">{tx("Asumsi", "Assumptions")}</p>
            <p>
              <T
                id={
                  <>
                    Persentase hemat diambil dari simulasi tiga perbaikan sekaligus pada lini contoh hard chrome: listrik −{fmt(pct.energy, 1)}%, bahan kimia −
                    {fmt(pct.chemical, 1)}%, air −{fmt(pct.water, 1)}%, limbah −{fmt(pct.waste, 1)}%. Lini Anda bisa berbeda; angka pasti didapat setelah data
                    Anda dihitung. Belum termasuk biaya investasi.
                  </>
                }
                en={
                  <>
                    Savings percentages come from simulating three improvements at once on the sample hard chrome line: electricity −{fmt(pct.energy, 1)}%,
                    chemicals −{fmt(pct.chemical, 1)}%, water −{fmt(pct.water, 1)}%, waste −{fmt(pct.waste, 1)}%. Your line may differ; exact figures come once
                    your data is calculated. Investment costs are not included.
                  </>
                }
              />
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
