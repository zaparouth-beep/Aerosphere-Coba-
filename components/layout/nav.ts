import type { LucideIcon } from "lucide-react";
import {
  Coins,
  FileText,
  FlaskConical,
  Flame,
  LayoutDashboard,
  Leaf,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Target,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  group: "Ringkasan" | "Inventori" | "Analisis" | "Keputusan" | "Sistem";
  description: string;
}

/** Sidebar menu per PRD 3.1, following the ISO 14044 flow. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", short: "Overview", icon: LayoutDashboard, group: "Ringkasan", description: "Executive dashboard: KPI, target, hotspot, rekomendasi" },
  { href: "/goal-scope", label: "Goal & Scope", short: "Scope", icon: Target, group: "Inventori", description: "Tujuan studi, satuan fungsi, boundary, cut-off, metode" },
  { href: "/data-proses", label: "Data Proses", short: "Data", icon: FlaskConical, group: "Inventori", description: "Peta proses A–F dan input/output LCI" },
  { href: "/kualitas-data", label: "Kualitas Data", short: "Kualitas", icon: ShieldCheck, group: "Inventori", description: "Validasi, neraca air & logam, pedigree, approval" },
  { href: "/aliran-biaya", label: "Aliran & Biaya (MFCA)", short: "MFCA", icon: Coins, group: "Analisis", description: "Material & cost loss ISO 14051" },
  { href: "/dampak-lingkungan", label: "Dampak Lingkungan (LCIA)", short: "LCIA", icon: Leaf, group: "Analisis", description: "Kategori EF 3.1, kontribusi, Scope 1/2/3, kepatuhan" },
  { href: "/hotspot", label: "Hotspot", short: "Hotspot", icon: Flame, group: "Analisis", description: "Heatmap, Pareto, skor prioritas, drill-down" },
  { href: "/what-if", label: "What-if", short: "What-if", icon: SlidersHorizontal, group: "Keputusan", description: "Skenario S0–S3, decision matrix, sensitivitas" },
  { href: "/laporan", label: "Laporan", short: "Laporan", icon: FileText, group: "Keputusan", description: "ISO 14044, GHG, GRI, PROPER, MFCA, ekspor" },
  { href: "/pengaturan", label: "Pengaturan", short: "Setelan", icon: Settings, group: "Sistem", description: "Proyek, metode & database, run, akses & audit log" },
];
