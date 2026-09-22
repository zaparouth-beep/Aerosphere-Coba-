"use client";

import { usePathname } from "next/navigation";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { NAV_ITEMS } from "./nav";

export function Header() {
  const pathname = usePathname();
  const project = useProjectStore((s) => s.project);
  const current = NAV_ITEMS.find((item) => pathname?.startsWith(item.href));

  return (
    <header className="no-print flex items-center justify-between border-b border-sand-200 bg-sand-50/80 px-6 py-4 backdrop-blur">
      <div>
        <h1 className="text-lg font-semibold text-navy-900">{current?.label ?? "AeroSphere LCA"}</h1>
        <p className="text-xs text-navy-700/60">
          {project.name} · {project.facility}
        </p>
      </div>
      <div className="text-right text-xs text-navy-700/60">
        <p className="font-medium text-navy-900">{project.period}</p>
        <p>
          Unit fungsional: {project.functionalUnit.value.toLocaleString("id-ID")}{" "}
          {project.functionalUnit.type === "m2_plated"
            ? "m² ter-plating"
            : project.functionalUnit.type === "part"
              ? "part"
              : "kg logam terdeposit"}
        </p>
      </div>
    </header>
  );
}
