import type { LucideIcon } from "lucide-react";
import { BarChart3, FileText, Flame, FolderInput, Home, LifeBuoy, Settings, SlidersHorizontal } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The question the page answers (PRD v1.1 §3.0.3). */
  question: string;
  group: "main" | "bottom";
}

/** Five core menus plus Beranda, with Bantuan and Pengaturan at the bottom (PRD v1.1 §3.0.3). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/beranda", label: "Beranda", icon: Home, question: "Bagaimana kondisi lini saya?", group: "main" },
  { href: "/data", label: "Data Saya", icon: FolderInput, question: "Data apa yang perlu saya isi?", group: "main" },
  { href: "/hasil", label: "Hasil", icon: BarChart3, question: "Berapa dampak dan biayanya?", group: "main" },
  { href: "/titik-boros", label: "Titik Boros", icon: Flame, question: "Tahap mana yang paling bermasalah, dan kenapa?", group: "main" },
  { href: "/simulasi", label: "Simulasi Perbaikan", icon: SlidersHorizontal, question: "Kalau saya ubah ini, apa hasilnya?", group: "main" },
  { href: "/laporan", label: "Laporan", icon: FileText, question: "Apa yang saya kirim ke atasan atau auditor?", group: "main" },
  { href: "/bantuan", label: "Bantuan", icon: LifeBuoy, question: "Apa arti istilah ini? Bagaimana caranya?", group: "bottom" },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings, question: "Paket, pengguna, proyek, dan keamanan", group: "bottom" },
];
