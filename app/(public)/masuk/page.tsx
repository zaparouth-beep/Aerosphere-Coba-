"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { effectiveStatus } from "@/lib/domain/plans";
import { useAppStore } from "@/lib/store/useAppStore";

const FREE_MAIL = /@(gmail|yahoo|ymail|hotmail|outlook|live|icloud|proton(mail)?)\./i;

export default function Page() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const router = useRouter();
  const search = useSearchParams();
  const signup = search.get("daftar") === "1";
  const signIn = useAppStore((s) => s.signIn);
  const existing = useAppStore((s) => s.account);
  const [form, setForm] = useState({ name: existing?.name ?? "", email: existing?.email ?? "", company: existing?.company ?? "" });
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Isi nama Anda.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Alamat email belum benar, contoh: nama@perusahaan.co.id.");
    if (!form.company.trim()) return setError("Isi nama perusahaan atau pabrik.");
    signIn({ name: form.name, email: form.email, company: form.company });
    const { subscription, onboardingDone } = useAppStore.getState();
    const status = effectiveStatus(subscription);
    const next = search.get("lanjut");
    if (!subscription || status === "pending") router.push("/paket");
    else if (!onboardingDone) router.push("/mulai");
    else router.push(next && next.startsWith("/") ? next : "/beranda");
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 md:flex-row md:items-start md:py-20">
      <div className="flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal">{signup ? "Daftar" : "Masuk"}</p>
        <h1 className="mt-2 text-3xl font-semibold text-navy-900">{signup ? "Mulai uji coba 14 hari" : "Selamat datang kembali"}</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-navy-700/75">
          Setelah masuk, pilih paket, isi profil lini dalam 3 langkah, dan lihat hasil pertama dari proyek contoh atau data Anda sendiri.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-navy-800">
          <li>1. Masuk dengan email kantor</li>
          <li>2. Pilih paket (Coba langsung aktif)</li>
          <li>3. Isi profil lini dan data</li>
          <li>4. Lihat hasil pertama</li>
        </ul>
      </div>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-sand-200 bg-white p-6 shadow-card" noValidate>
        <label className="block text-xs font-medium text-navy-800">
          Nama
          <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
        </label>
        <label className="mt-4 block text-xs font-medium text-navy-800">
          Email kantor
          <Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" placeholder="nama@perusahaan.co.id" />
        </label>
        {FREE_MAIL.test(form.email) && <p className="mt-1 text-[11px] text-status-warn">Ini email pribadi. Untuk pemakaian tim, gunakan email kantor agar undangan rekan kerja tersambung.</p>}
        <label className="mt-4 block text-xs font-medium text-navy-800">
          Perusahaan / pabrik
          <Input className="mt-1" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoComplete="organization" />
        </label>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-status-danger/5 px-3 py-2 text-xs text-status-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="brand" className="mt-5 w-full">
          <LogIn className="h-4 w-4" /> {signup ? "Daftar dan lanjut" : "Masuk"}
        </Button>
        <p className="mt-3 text-center text-xs text-navy-700/60">
          {signup ? (
            <>
              Sudah punya akun? <Link href="/masuk" className="font-medium text-brand-blue">Masuk</Link>
            </>
          ) : (
            <>
              Belum punya akun? <Link href="/masuk?daftar=1" className="font-medium text-brand-blue">Coba gratis</Link>
            </>
          )}
        </p>
        <p className="mt-4 flex items-start gap-2 border-t border-sand-200 pt-4 text-[11px] leading-relaxed text-navy-700/60">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-teal" />
          Versi demo: akun dan data disimpan hanya di browser ini, tanpa kata sandi. Versi server menambahkan masuk dengan SSO perusahaan dan verifikasi dua
          langkah (MFA) untuk Admin dan Data Steward.
        </p>
      </form>
    </div>
  );
}
