import type { LucideIcon } from "lucide-react";
import { BarChart3, FileText, Flame, FolderInput, Home, LifeBuoy, Settings, SlidersHorizontal } from "lucide-react";
import { tx } from "@/lib/i18n";

export interface NavItem {
  href: string;
  readonly label: string;
  icon: LucideIcon;
  /** The question the page answers (PRD v1.1 §3.0.3). */
  readonly question: string;
  group: "main" | "bottom";
}

/** Five core menus plus Beranda, with Bantuan and Pengaturan at the bottom (PRD v1.1 §3.0.3). */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/beranda",
    icon: Home,
    group: "main",
    get label() {
      return tx("Beranda", "Home");
    },
    get question() {
      return tx("Bagaimana kondisi lini saya?", "How is my line doing?");
    },
  },
  {
    href: "/data",
    icon: FolderInput,
    group: "main",
    get label() {
      return tx("Data Saya", "My Data");
    },
    get question() {
      return tx("Data apa yang perlu saya isi?", "What data do I need to fill in?");
    },
  },
  {
    href: "/hasil",
    icon: BarChart3,
    group: "main",
    get label() {
      return tx("Hasil", "Results");
    },
    get question() {
      return tx("Berapa dampak dan biayanya?", "What are the impacts and costs?");
    },
  },
  {
    href: "/titik-boros",
    icon: Flame,
    group: "main",
    get label() {
      return tx("Titik Boros", "Waste Hotspots");
    },
    get question() {
      return tx("Tahap mana yang paling bermasalah, dan kenapa?", "Which stage is the biggest problem, and why?");
    },
  },
  {
    href: "/simulasi",
    icon: SlidersHorizontal,
    group: "main",
    get label() {
      return tx("Simulasi Perbaikan", "Improvement Simulation");
    },
    get question() {
      return tx("Kalau saya ubah ini, apa hasilnya?", "If I change this, what happens?");
    },
  },
  {
    href: "/laporan",
    icon: FileText,
    group: "main",
    get label() {
      return tx("Laporan", "Reports");
    },
    get question() {
      return tx("Apa yang saya kirim ke atasan atau auditor?", "What do I send to my manager or auditor?");
    },
  },
  {
    href: "/bantuan",
    icon: LifeBuoy,
    group: "bottom",
    get label() {
      return tx("Bantuan", "Help");
    },
    get question() {
      return tx("Apa arti istilah ini? Bagaimana caranya?", "What does this term mean? How do I do this?");
    },
  },
  {
    href: "/pengaturan",
    icon: Settings,
    group: "bottom",
    get label() {
      return tx("Pengaturan", "Settings");
    },
    get question() {
      return tx("Paket, pengguna, proyek, dan keamanan", "Plan, users, projects and security");
    },
  },
];
