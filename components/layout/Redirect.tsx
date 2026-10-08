"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Client redirect for v1.0 URLs (static export has no server redirects). */
export function Redirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => router.replace(to), [router, to]);
  return (
    <p className="p-8 text-sm text-navy-800">
      Halaman ini sudah pindah. <Link href={to} className="font-medium text-brand-blue underline">Buka halaman baru</Link>
    </p>
  );
}
