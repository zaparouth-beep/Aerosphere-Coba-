"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Header and footer for the public pages (landing, masuk, paket, mulai). */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const account = useAppStore((s) => s.account);
  const onboardingDone = useAppStore((s) => s.onboardingDone);
  useEffect(() => setMounted(true), []);
  const signedIn = mounted && !!account;

  const links = [
    { href: "/#fitur", label: "Cara kerja" },
    { href: "/#demo", label: "Demo" },
    { href: "/#paket", label: "Paket" },
    { href: "/contoh-laporan", label: "Contoh laporan" },
    { href: "/#faq", label: "FAQ" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-sand-50">
      <a href="#konten" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Lewati ke konten
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-sand-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/" prefetch={false} className="flex items-center gap-2" aria-label="AeroSphere LCA, beranda">
            <Image src={`${BASE}/brand/mark-color.png`} alt="" width={34} height={34} className="h-8 w-8" unoptimized priority />
            <span className="text-[15px] font-semibold tracking-wide text-navy-900">
              AeroSphere <span className="bg-brand-gradient bg-clip-text text-transparent">LCA</span>
            </span>
          </Link>
          <nav className="ml-6 hidden items-center gap-5 text-sm text-navy-800 md:flex" aria-label="Navigasi situs">
            {links.map((l) => (
              <Link key={l.href} href={l.href} prefetch={false} className="hover:text-brand-blue">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {signedIn ? (
              <Link href={onboardingDone ? "/beranda" : "/mulai"} className="rounded-lg bg-navy-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-navy-800">
                Buka aplikasi
              </Link>
            ) : (
              <>
                <Link href="/masuk" className="rounded-lg px-3 py-2 text-sm font-medium text-navy-900 hover:bg-sand-100">
                  Masuk
                </Link>
                <Link href="/masuk?daftar=1" className="rounded-lg bg-brand-gradient px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95">
                  Coba gratis
                </Link>
              </>
            )}
          </div>
          <button type="button" className="ml-auto text-navy-900 md:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? "Tutup menu" : "Buka menu"} aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-sand-200 bg-white px-4 py-3 md:hidden" aria-label="Navigasi situs (seluler)">
            {links.map((l) => (
              <Link key={l.href} href={l.href} prefetch={false} onClick={() => setOpen(false)} className="block py-2 text-sm text-navy-800">
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              <Link href={signedIn ? "/beranda" : "/masuk"} className="flex-1 rounded-lg border border-sand-300 py-2 text-center text-sm font-medium text-navy-900">
                {signedIn ? "Buka aplikasi" : "Masuk"}
              </Link>
              {!signedIn && (
                <Link href="/masuk?daftar=1" className="flex-1 rounded-lg bg-brand-gradient py-2 text-center text-sm font-medium text-white">
                  Coba gratis
                </Link>
              )}
            </div>
          </nav>
        )}
      </header>
      <main id="konten" className="flex-1">
        {children}
      </main>
      <footer className="no-print border-t border-sand-200 bg-navy-950 text-white/70">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-xs sm:grid-cols-3">
          <div>
            <Image src={`${BASE}/brand/mark-white.png`} alt="" width={32} height={32} className="h-8 w-8" unoptimized />
            <p className="mt-2 text-sm font-semibold text-white">AeroSphere LCA</p>
            <p className="mt-1 leading-relaxed">Temukan tahap paling boros di proses manufaktur Anda, berapa rupiahnya, dan perbaikan yang paling layak. Percontohan: lini pelapisan logam.</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-white">Produk</p>
            <Link href="/#fitur" prefetch={false} className="block hover:text-white">Cara kerja</Link>
            <Link href="/#paket" prefetch={false} className="block hover:text-white">Paket</Link>
            <Link href="/contoh-laporan" className="block hover:text-white">Contoh laporan</Link>
          </div>
          <div className="space-y-1.5 leading-relaxed">
            <p className="font-semibold text-white">Standar & keamanan</p>
            <p>Metode hitung selaras ISO 14040/14044 dan ISO 14051 (biaya bahan terbuang). Belum melalui critical review pihak ketiga.</p>
            <p>Versi produksi dirancang dengan kontrol keamanan mengacu ISO/IEC 27001. Versi demo ini menyimpan data hanya di browser Anda.</p>
          </div>
        </div>
        <p className="border-t border-white/10 py-3 text-center text-[11px] text-white/40">© {new Date().getFullYear()} AeroSphere LCA · versi demo BUILD</p>
      </footer>
    </div>
  );
}
