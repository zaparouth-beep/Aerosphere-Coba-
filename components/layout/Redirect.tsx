"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { tx } from "@/lib/i18n";

/** Client redirect for v1.0 URLs (static export has no server redirects). */
export function Redirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => router.replace(to), [router, to]);
  return (
    <p className="p-8 text-sm text-navy-800">
      {tx("Halaman ini sudah pindah.", "This page has moved.")}{" "}
      <Link href={to} className="font-medium text-brand-blue underline">
        {tx("Buka halaman baru", "Open the new page")}
      </Link>
    </p>
  );
}
