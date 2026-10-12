"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PUBLIC_DEMO } from "@/lib/domain/accounts";
import { effectiveStatus } from "@/lib/domain/plans";
import { useAppStore } from "@/lib/store/useAppStore";
import { tx } from "@/lib/i18n";

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
  const signInWithPassword = useAppStore((s) => s.signInWithPassword);
  const register = useAppStore((s) => s.register);
  const [form, setForm] = useState({ name: "", email: "", company: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  const after = (next: string) => {
    const lanjut = search.get("lanjut");
    router.push(next === "/beranda" && lanjut && lanjut.startsWith("/") && !lanjut.startsWith("/masuk") ? lanjut : next);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError(tx("Alamat email belum benar, contoh: nama@perusahaan.co.id.", "That email address doesn’t look right, e.g. name@company.com."));
    if (!signup) {
      const r = signInWithPassword(form.email, form.password);
      return r.ok ? after(r.next) : setError(r.error);
    }
    if (!form.name.trim()) return setError(tx("Isi nama Anda.", "Enter your name."));
    if (!form.company.trim()) return setError(tx("Isi nama perusahaan atau pabrik.", "Enter your company or plant name."));
    if (form.password !== form.confirm) return setError(tx("Konfirmasi kata sandi tidak sama.", "The passwords don’t match."));
    const r = register({ name: form.name, email: form.email, company: form.company }, form.password);
    if (!r.ok) return setError(r.error);
    const { subscription, onboardingDone } = useAppStore.getState();
    const status = effectiveStatus(subscription);
    router.push(!subscription || status === "pending" ? "/paket" : !onboardingDone ? "/mulai" : "/beranda");
  };

  const fillDemo = () => {
    setForm({ ...form, email: PUBLIC_DEMO.email, password: PUBLIC_DEMO.password });
    setError(null);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 md:flex-row md:items-start md:py-20">
      <div className="flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-teal">{signup ? tx("Daftar", "Sign up") : tx("Masuk", "Sign in")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-navy-900">{signup ? tx("Mulai uji coba 14 hari", "Start your 14-day trial") : tx("Masuk ke AeroSphere", "Sign in to AeroSphere")}</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-navy-700/75">
          {signup
            ? tx(
                "Setelah mendaftar, pilih paket, isi profil lini dalam 3 langkah, dan lihat hasil pertama dari proyek contoh atau data Anda sendiri.",
                "After signing up, choose a plan, fill in your line profile in 3 steps, and see your first results from the sample project or your own data.",
              )
            : tx("Masuk untuk membuka Beranda, data lini, hasil, dan laporan Anda.", "Sign in to open your Home, line data, results and reports.")}
        </p>
        {!signup && (
          <div className="mt-6 max-w-md rounded-xl border border-brand-teal/40 bg-brand-teal/5 p-4 text-sm text-navy-800">
            <p className="font-semibold text-navy-900">{tx("Ingin mencoba dulu?", "Want to try it first?")}</p>
            <p className="mt-1 text-xs leading-relaxed">{tx("Pakai akun demo (semua fitur terbuka, termasuk Mode Ahli; proyek contoh sudah terisi):", "Use the demo account (all features unlocked, including Expert mode; sample project already filled in):")}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
              <dt className="text-navy-700/60">Email</dt>
              <dd className="num">{PUBLIC_DEMO.email}</dd>
              <dt className="text-navy-700/60">{tx("Kata sandi", "Password")}</dt>
              <dd className="num">{PUBLIC_DEMO.password}</dd>
            </dl>
            <Button size="sm" variant="secondary" className="mt-3" onClick={fillDemo}>
              {tx("Isi akun demo", "Fill in demo account")}
            </Button>
          </div>
        )}
      </div>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-sand-200 bg-white p-6 shadow-card" noValidate>
        {signup && (
          <label className="mb-4 block text-xs font-medium text-navy-800">
            {tx("Nama", "Name")}
            <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
          </label>
        )}
        <label className="block text-xs font-medium text-navy-800">
          {signup ? tx("Email kantor", "Work email") : "Email"}
          <Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" placeholder={tx("nama@perusahaan.co.id", "name@company.com")} />
        </label>
        {signup && FREE_MAIL.test(form.email) && <p className="mt-1 text-[11px] text-status-warn">{tx("Ini email pribadi. Untuk pemakaian tim, gunakan email kantor agar undangan rekan kerja tersambung.", "This is a personal email. For team use, use your work email so colleague invitations connect.")}</p>}
        {signup && (
          <label className="mt-4 block text-xs font-medium text-navy-800">
            {tx("Perusahaan / pabrik", "Company / plant")}
            <Input className="mt-1" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} autoComplete="organization" />
          </label>
        )}
        <div className="mt-4">
          <label htmlFor="kata-sandi" className="block text-xs font-medium text-navy-800">
            {tx("Kata sandi", "Password")}
          </label>
          <div className="relative mt-1">
            <Input
              id="kata-sandi"
              type={show ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete={signup ? "new-password" : "current-password"}
              className="pr-24"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-brand-blue">
              {show ? tx("Sembunyikan", "Hide") : tx("Tampilkan", "Show")}
            </button>
          </div>
        </div>
        {signup && (
          <label className="mt-4 block text-xs font-medium text-navy-800">
            {tx("Ulangi kata sandi", "Repeat password")}
            <Input className="mt-1" type={show ? "text" : "password"} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} autoComplete="new-password" />
            <span className="mt-1 block text-[11px] font-normal text-navy-700/55">{tx("Minimal 8 karakter.", "At least 8 characters.")}</span>
          </label>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-status-danger/5 px-3 py-2 text-xs text-status-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="brand" className="mt-5 w-full">
          <LogIn className="h-4 w-4" /> {signup ? tx("Daftar dan lanjut", "Sign up and continue") : tx("Masuk", "Sign in")}
        </Button>
        <p className="mt-3 text-center text-xs text-navy-700/60">
          {signup ? (
            <>
              {tx("Sudah punya akun?", "Already have an account?")} <Link href="/masuk" className="font-medium text-brand-blue">{tx("Masuk", "Sign in")}</Link>
            </>
          ) : (
            <>
              {tx("Belum punya akun?", "Don’t have an account?")} <Link href="/masuk?daftar=1" className="font-medium text-brand-blue">{tx("Coba gratis", "Try for free")}</Link>
            </>
          )}
        </p>
        <p className="mt-4 flex items-start gap-2 border-t border-sand-200 pt-4 text-[11px] leading-relaxed text-navy-700/60">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-teal" />
          {tx(
            "Versi demo: akun dan data disimpan hanya di browser ini, dan kata sandi diperiksa di browser (bukan server). Jangan memakai kata sandi yang Anda pakai di tempat lain. Versi server menambahkan login aman, SSO perusahaan, dan verifikasi dua langkah (MFA) untuk Admin dan Data Steward.",
            "Demo version: accounts and data are stored only in this browser, and passwords are checked in the browser (not on a server). Don’t use a password you use elsewhere. The server version adds secure sign-in, company SSO and two-step verification (MFA) for Admin and Data Steward.",
          )}
        </p>
      </form>
    </div>
  );
}
