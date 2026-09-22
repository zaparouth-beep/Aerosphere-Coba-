import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Coins,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  Leaf,
  Settings,
  Sparkles,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/data-proses", label: "Data Proses", icon: FlaskConical },
  { href: "/aliran-biaya", label: "Aliran & Biaya", icon: Coins },
  { href: "/dampak-lingkungan", label: "Dampak Lingkungan", icon: Leaf },
  { href: "/hotspot", label: "Hotspot", icon: Gauge },
  { href: "/what-if", label: "What-if", icon: Sparkles },
  { href: "/laporan", label: "Laporan", icon: ClipboardList },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings },
];
