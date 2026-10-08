"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BarChart3, Calculator, FileText, Flame, ShieldCheck, SlidersHorizontal, Upload } from "lucide-react";
import { PlanCards, PlanComparison } from "@/components/plans/PlanPicker";
import { HeadlineCards, WorstStageBars } from "@/components/summary/Summary";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { NumberInput } from "@/components/ui/Input";
import { hardChromeDemo } from "@/lib/domain/templates";
import { calculate, indicatorsOf } from "@/lib/engine/calculate";
import { evaluateScenario } from "@/lib/engine/scenario";
import { fmt, fmtDelta, fmtRp } from "@/lib/utils/format";
import { headlines, worstStage } from "@/lib/view/summary";
import { cn } from "@/lib/utils/cn";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const STEPS = [
  { icon: Upload, title: "Unggah data", text: "Isi template Excel: listrik, air, bahan kimia, limbah, dan luas yang dilapisi." },
  { icon: BarChart3, title: "Lihat hasil", text: "Jejak karbon, air, limbah berbahaya, dan biaya per m² langsung terhitung." },
  { icon: SlidersHorizontal, title: "Coba perbaikan", text: "Uji “bagaimana jika” sebelum mengubah satu tangki pun di lini." },
  { icon: FileText, title: "Kirim laporan", text: "Laporan ringkas 2 halaman untuk atasan, laporan teknis untuk auditor." },
];

const FAQ = [
  { q: "Data apa saja yang perlu saya siapkan?", a: "Catatan pemakaian listrik, air, dan bahan kimia per bulan, berat limbah B3 dari manifest, serta total luas permukaan yang dilapisi. Template Excel menuntun kolom yang perlu diisi." },
  { q: "Apakah saya perlu paham LCA?", a: "Tidak. Mode Ringkas memakai bahasa sehari-hari dan setiap angka punya penjelasan “Apa ini?”. Mode Ahli tersedia untuk engineer dan auditor." },
  { q: "Dari mana angka hasilnya?", a: "Dari mesin hitung yang sama untuk semua pengguna, dengan faktor yang sumbernya tercatat. Asisten AI hanya menjelaskan angka, tidak mengarang angka." },
  { q: "Bagaimana dengan keamanan data?", a: "Versi demo ini menyimpan data hanya di browser Anda. Versi produksi memakai server terenkripsi dengan kontrol mengacu ISO/IEC 27001, dan paket Industri bisa dipasang on-premise." },
  { q: "Apa yang terjadi setelah 14 hari uji coba?", a: "Data tetap bisa dibaca selama 30 hari. Pilih paket untuk melanjutkan mengisi data dan mengunduh laporan tanpa tanda “Contoh”." },
];

export function Landing() {
  return (
    <>
      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-teal/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 left-10 h-96 w-96 rounded-full bg-brand-blue/20 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <h1 className="text-3xl font-semibold leading-tight md:text-[44px]">
              Jangan hanya tahu totalnya. <span className="bg-brand-gradient bg-clip-text text-transparent">Temukan sumbernya.</span>
            </h1>
            <p className="mt-4 text-sm font-semibold tracking-wide text-brand-gold md:text-base" lang="en">
              See the Hotspot. Measure the Impact. Improve the Process.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
              AeroSphere menelusuri penggunaan energi, material, air, limbah, dan biaya hingga level proses—agar Anda tahu di mana hotspot terjadi,
              seberapa besar dampaknya, dan perbaikan mana yang paling layak dilakukan.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/masuk?daftar=1" className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-95">
                Coba gratis <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#demo" className="rounded-lg border border-white/25 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10">
                Lihat demo
              </a>
              <a href="#paket" className="rounded-lg px-5 py-2.5 text-sm font-medium text-white/80 hover:text-white">
                Lihat paket
              </a>
            </div>
            <p className="mt-6 text-xs text-white/50">14 hari gratis · tanpa kartu kredit · proyek contoh siap dicoba</p>
          </div>
          <div className="flex justify-center">
            <div className="rounded-3xl bg-white p-8 shadow-2xl">
              <Image src={`${BASE}/brand/logo-color.png`} alt="Logo AeroSphere LCA" width={260} height={257} className="h-auto w-[220px]" unoptimized priority />
            </div>
          </div>
        </div>
      </section>

      <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="text-center text-2xl font-semibold text-navy-900">Empat langkah, satu jawaban</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-navy-700/70">
          Di mana paling boros? Berapa rupiahnya? Perbaikan apa yang paling layak? Apa yang dikirim ke atasan?
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

      <DemoSection />
      <SavingsCalculator />

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-8 rounded-2xl border border-sand-200 bg-white p-6 shadow-card md:grid-cols-[1fr_1.1fr] md:p-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal">Contoh laporan</p>
            <h2 className="mt-2 text-2xl font-semibold text-navy-900">Dua halaman yang bisa langsung dibaca atasan</h2>
            <ul className="mt-4 space-y-2 text-sm text-navy-800">
              <li>• Kesimpulan dalam tiga kalimat</li>
              <li>• Empat angka utama dengan status Baik / Perlu perhatian / Kritis</li>
              <li>• Tahap paling bermasalah dan tiga perbaikan dengan rupiahnya</li>
              <li>• Seberapa yakin hasilnya, dan langkah berikutnya</li>
            </ul>
            <Link href="/contoh-laporan" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">
              Buka contoh laporan <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-xl border border-sand-200 bg-sand-50 p-5 text-xs text-navy-800">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-700/55">Laporan Ringkas Manajemen</p>
            <p className="mt-2 text-sm font-semibold text-navy-900">1. Kesimpulan</p>
            <p className="mt-1 leading-relaxed">Tiga kalimat: tahap mana yang paling boros, berapa nilai bahan yang terbuang, dan perbaikan mana yang paling layak.</p>
            <p className="mt-3 text-sm font-semibold text-navy-900">2. Angka utama</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {["Jejak karbon", "Pemakaian air", "Limbah B3", "Biaya per m²"].map((x) => (
                <div key={x} className="rounded-md border border-sand-200 bg-white p-2">
                  {x}
                  <span className="mt-1 block h-2 w-2/3 rounded bg-sand-200" />
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-navy-700/55">Pratinjau tata letak · angka lengkap ada di contoh laporan</p>
          </div>
        </div>
      </section>

      <section id="paket" className="scroll-mt-20 border-y border-sand-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-semibold text-navy-900">Paket</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-navy-700/70">Mulai gratis 14 hari. Fitur lanjutan terbuka sesuai paket.</p>
          <div className="mt-8">
            <PlanCards readOnly />
          </div>
          <div className="mt-6 text-center">
            <Link href="/masuk?daftar=1" className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white">
              Coba gratis <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <details className="mt-8 rounded-xl border border-sand-200 p-4">
            <summary className="cursor-pointer text-sm font-medium text-navy-900">Bandingkan semua fitur</summary>
            <div className="mt-4 overflow-x-auto">
              <PlanComparison />
            </div>
          </details>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16">
        <h2 className="text-center text-2xl font-semibold text-navy-900">Pertanyaan yang sering diajukan</h2>
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
            Metode hitung selaras <b>ISO 14040/14044</b> (penilaian daur hidup) dan <b>ISO 14051</b> (biaya bahan yang terbuang). Versi produksi dirancang
            dengan kontrol keamanan mengacu <b>ISO/IEC 27001</b>. Hasil belum melalui critical review pihak ketiga; jangan dipakai sebagai klaim
            perbandingan publik.
          </p>
        </div>
      </section>
    </>
  );
}

/** Interactive demo on the sample hard-chrome line, computed live by the engine. */
function DemoSection() {
  const demo = useMemo(() => {
    const project = hardChromeDemo();
    const results = calculate(project);
    const indicators = indicatorsOf(results);
    const heads = headlines(indicators, results.lci.referenceFlow, results.lci.fuLabel, null);
    const outcomes = project.scenarios.map((s) => evaluateScenario(project, s, indicators));
    return { project, results, heads, worst: worstStage(project, results, heads), outcomes };
  }, []);
  const [pick, setPick] = useState<string | null>(null);
  const chosen = demo.outcomes.find((o) => o.scenario.id === pick);

  return (
    <section id="demo" className="scroll-mt-20 border-y border-sand-200 bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal">Demo interaktif</p>
        <h2 className="mt-1 text-center text-2xl font-semibold text-navy-900">Lini contoh: pelapisan hard chrome, 250 m² per tahun</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-navy-700/70">
          Angka di bawah dihitung langsung oleh mesin hitung AeroSphere dari data contoh. Tekan ikon <InfoTip what="Ikon ini menjelaskan arti setiap angka dalam tiga baris." /> untuk penjelasan.
        </p>
        <div className="mt-8">
          <HeadlineCards heads={demo.heads} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
          {demo.worst && (
            <Card>
              <CardHeader
                title={<span className="flex items-center gap-1.5"><Flame className="h-4 w-4 text-status-danger" /> Di mana masalahnya</span>}
                subtitle={`Tahap ${demo.worst.stageName} menyumbang ${fmt(demo.worst.sharePct, 0)}% dari ${demo.worst.indicator}.`}
                info="hotspot"
              />
              <CardBody>
                <WorstStageBars project={demo.project} results={demo.results} worst={demo.worst} />
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title="Coba perbaikan" subtitle="Pilih satu perbaikan; mesin hitung menghitung ulang seluruh lini." info="whatif" />
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {demo.outcomes.map((o) => (
                  <button
                    key={o.scenario.id}
                    type="button"
                    onClick={() => setPick(o.scenario.id === pick ? null : o.scenario.id)}
                    aria-pressed={o.scenario.id === pick}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium",
                      o.scenario.id === pick ? "border-navy-900 bg-navy-900 text-white" : "border-sand-300 bg-white text-navy-900 hover:bg-sand-50",
                    )}
                  >
                    {o.scenario.name}
                  </button>
                ))}
              </div>
              {chosen ? (
                <div className="space-y-2">
                  <p className="text-xs text-navy-700/75">{chosen.scenario.description}</p>
                  <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    {[
                      ["Jejak karbon", chosen.delta.ccKg.pct],
                      ["Air", chosen.delta.waterL.pct],
                      ["Limbah B3", chosen.delta.wasteKg.pct],
                      ["Biaya", chosen.delta.costRp.pct],
                    ].map(([label, pct]) => (
                      <div key={label as string} className="rounded-lg bg-sand-50 py-2">
                        <dt className="text-[10px] uppercase tracking-wide text-navy-700/55">{label}</dt>
                        <dd className={cn("num text-sm font-semibold", (pct as number) < 0 ? "text-status-ok" : (pct as number) > 0 ? "text-status-danger" : "text-navy-700/60")}>
                          {fmtDelta(pct as number)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm text-navy-900">
                    Hemat sekitar <b className="num">{fmtRp(chosen.lcc.annualSavingRp)}</b> per tahun pada lini contoh.
                  </p>
                </div>
              ) : (
                <p className="rounded-lg bg-sand-50 p-4 text-center text-xs text-navy-700/65">Pilih perbaikan di atas untuk melihat dampaknya.</p>
              )}
            </CardBody>
          </Card>
        </div>
        <p className="mt-3 text-center text-[11px] text-navy-700/55">Data dan harga contoh, bukan data pabrik nyata.</p>
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
    { key: "energy", label: "Listrik", p: pct.energy },
    { key: "chemical", label: "Bahan kimia", p: pct.chemical },
    { key: "water", label: "Air", p: pct.water },
    { key: "waste", label: "Pengolahan limbah B3", p: pct.waste },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal">
            <Calculator className="h-3.5 w-3.5" /> Kalkulator potensi hemat
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-navy-900">Perkiraan untuk lini Anda</h2>
          <p className="mt-2 text-sm text-navy-700/75">Isi pengeluaran bulanan lini pelapisan Anda (rupiah per bulan).</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className="block text-xs text-navy-800">
                <span className="mb-1 block font-medium">{f.label}</span>
                <NumberInput value={spend[f.key]} min={0} onCommit={(v) => setSpend((s) => ({ ...s, [f.key]: v ?? 0 }))} ariaLabel={`Pengeluaran ${f.label} per bulan`} />
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl bg-navy-950 p-6 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-brand-gold">Perkiraan</p>
            <p className="num mt-2 text-3xl font-semibold">{fmtRp(monthly * 12)}</p>
            <p className="text-sm text-white/70">potensi hemat per tahun ({fmtRp(monthly)} per bulan)</p>
          </div>
          <div className="mt-6 text-[11px] leading-relaxed text-white/60">
            <p className="font-semibold text-white/80">Asumsi</p>
            <p>
              Persentase hemat diambil dari simulasi tiga perbaikan sekaligus pada lini contoh hard chrome: listrik −{fmt(pct.energy, 1)}%, bahan kimia −
              {fmt(pct.chemical, 1)}%, air −{fmt(pct.water, 1)}%, limbah −{fmt(pct.waste, 1)}%. Lini Anda bisa berbeda; angka pasti didapat setelah data
              Anda dihitung. Belum termasuk biaya investasi.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
