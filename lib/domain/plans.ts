/**
 * Subscription plans and feature entitlements (PRD v1.1 §3.0.2).
 *
 * In this browser build the check runs inside every store action as well as
 * in the UI, so a locked feature cannot be reached by bypassing a button. The
 * server version moves the same table into an `entitlement_check` middleware
 * that answers HTTP 403 PLAN_REQUIRED.
 */

import { tx } from "@/lib/i18n";

export type PlanId = "coba" | "esensial" | "profesional" | "industri";

export type Feature =
  | "uploadData"
  | "manualInput"
  | "expertMode"
  | "editScenario"
  | "decisionWeights"
  | "reportSummary"
  | "reportTechnical"
  | "reportCompliance"
  | "auditEvidence"
  | "askAi"
  | "advancedValidation";

export interface PlanDef {
  id: PlanId;
  name: string;
  audience: string;
  /** Short headline under the audience line on the plan card. */
  tagline: string;
  projects: string;
  users: string;
  deployment: string;
  support: string;
  rows: Record<string, string>;
  features: Feature[];
  limits: { uploads: number; scenarios: number; aiQuestions: number; trialDays?: number };
}

const ALL_REPORTS: Feature[] = ["reportSummary", "reportTechnical", "reportCompliance"];

export const PLANS: PlanDef[] = [
  {
    id: "coba",
    get name() {
      return tx("Coba", "Trial");
    },
    get audience() {
      return tx("Calon klien, juri, demo", "Prospective clients, judges, demos");
    },
    get tagline() {
      return tx("Gratis 14 hari", "Free for 14 days");
    },
    get projects() {
      return tx("1 (proyek contoh + 1 unggahan)", "1 (sample project + 1 upload)");
    },
    users: "1",
    deployment: "Cloud",
    support: "—",
    get rows() {
      return {
        "Input data": tx("Data contoh + 1 unggahan", "Sample data + 1 upload"),
        "Hasil & Titik Boros": tx("Ya", "Yes"),
        "Simulasi perbaikan": tx("3 skenario contoh", "3 sample scenarios"),
        Laporan: tx("Ringkas (watermark “Contoh”)", "Summary (“Sample” watermark)"),
        "Tanya AeroSphere": tx("10 pertanyaan", "10 questions"),
      };
    },
    features: ["uploadData", "reportSummary", "askAi"],
    limits: { uploads: 1, scenarios: 3, aiQuestions: 10, trialDays: 14 },
  },
  {
    id: "esensial",
    get name() {
      return tx("Esensial", "Essential");
    },
    get audience() {
      return tx("Pabrik kecil, 1 lini", "Small plant, 1 line");
    },
    get tagline() {
      return tx("Temukan Titik Boros Utama", "Find Your Main Waste Hotspots");
    },
    projects: "1",
    users: "3",
    deployment: "Cloud",
    get support() {
      return tx("1 sesi onboarding", "1 onboarding session");
    },
    get rows() {
      return {
        "Input data": tx("Unggah Excel + isi manual", "Excel upload + manual entry"),
        "Hasil & Titik Boros": tx("Ya", "Yes"),
        "Simulasi perbaikan": tx("Hingga 3 skenario", "Up to 3 scenarios"),
        Laporan: tx("Ringkas", "Summary"),
        "Tanya AeroSphere": tx("Ya", "Yes"),
      };
    },
    features: ["uploadData", "manualInput", "editScenario", "reportSummary", "askAi"],
    limits: { uploads: Infinity, scenarios: 3, aiQuestions: Infinity },
  },
  {
    id: "profesional",
    get name() {
      return tx("Profesional", "Professional");
    },
    get audience() {
      return tx("Tim EHS/ESG, beberapa lini", "EHS/ESG teams, multiple lines");
    },
    get tagline() {
      return tx("Analisis Mendalam, Keputusan Lebih Tepat", "Deeper Analysis, Better Decisions");
    },
    get projects() {
      return tx("Hingga 5", "Up to 5");
    },
    users: "10",
    deployment: "Cloud",
    get support() {
      return tx("Tinjauan kuartalan", "Quarterly review");
    },
    get rows() {
      return {
        "Input data": tx("+ validasi lanjutan", "+ advanced validation"),
        "Hasil & Titik Boros": tx("Ya + Mode Ahli (semua kategori dampak)", "Yes + Expert mode (all impact categories)"),
        "Simulasi perbaikan": tx("Tanpa batas + bobot keputusan", "Unlimited + decision weights"),
        Laporan: tx("+ Teknis ISO 14044, GRI, PROPER, GHG", "+ Technical ISO 14044, GRI, PROPER, GHG"),
        "Tanya AeroSphere": tx("Ya", "Yes"),
      };
    },
    features: ["uploadData", "manualInput", "editScenario", "decisionWeights", "expertMode", "advancedValidation", ...ALL_REPORTS, "askAi"],
    limits: { uploads: Infinity, scenarios: 10, aiQuestions: Infinity },
  },
  {
    id: "industri",
    get name() {
      return tx("Industri", "Industry");
    },
    get audience() {
      return tx("Grup manufaktur, data sensitif", "Manufacturing groups, sensitive data");
    },
    get tagline() {
      return tx("Solusi Sesuai Kebutuhan Perusahaan", "Solutions Tailored to Your Company");
    },
    get projects() {
      return tx("Sesuai kontrak", "Per contract");
    },
    get users() {
      return tx("Sesuai kontrak", "Per contract");
    },
    get deployment() {
      return tx("Cloud atau on-premise", "Cloud or on-premise");
    },
    get support() {
      return tx("Konsultan khusus", "Dedicated consultant");
    },
    get rows() {
      return {
        "Input data": tx("+ konektor ERP/IoT (roadmap V2)", "+ ERP/IoT connectors (V2 roadmap)"),
        "Hasil & Titik Boros": tx("Ya + Mode Ahli", "Yes + Expert mode"),
        "Simulasi perbaikan": tx("+ optimizer & biaya siklus hidup (roadmap V2)", "+ optimizer & life-cycle costing (V2 roadmap)"),
        Laporan: tx("+ paket bukti audit", "+ audit evidence pack"),
        "Tanya AeroSphere": tx("Ya (opsi model on-premise)", "Yes (on-premise model option)"),
      };
    },
    features: ["uploadData", "manualInput", "editScenario", "decisionWeights", "expertMode", "advancedValidation", ...ALL_REPORTS, "auditEvidence", "askAi"],
    limits: { uploads: Infinity, scenarios: 10, aiQuestions: Infinity },
  },
];

export const PLAN_BY_ID = new Map(PLANS.map((p) => [p.id, p]));

/** One-sentence benefit shown on a locked feature (§3.0.2: gembok + manfaat). */
export const FEATURE_BENEFIT: Record<Feature, string> = {
  get uploadData() {
    return tx("Unggah data lini Anda dari template Excel.", "Upload your line data from the Excel template.");
  },
  get manualInput() {
    return tx("Isi dan koreksi data langsung di tabel tanpa unggah ulang.", "Enter and correct data directly in the table without re-uploading.");
  },
  get expertMode() {
    return tx("Lihat semua kategori dampak, emisi per Scope, Sankey, heatmap, dan pengaturan database.", "See all impact categories, emissions by Scope, Sankey, heatmap and database settings.");
  },
  get editScenario() {
    return tx("Rancang simulasi perbaikan sendiri dengan angka lini Anda.", "Design your own improvement simulations with your line’s figures.");
  },
  get decisionWeights() {
    return tx("Atur bobot keputusan untuk membandingkan banyak perbaikan sekaligus.", "Set decision weights to compare many improvements at once.");
  },
  get reportSummary() {
    return tx("Laporan ringkas 2 halaman untuk manajemen.", "2-page summary report for management.");
  },
  get reportTechnical() {
    return tx("Laporan teknis ISO 14044 dan MFCA untuk engineer dan reviewer LCA.", "ISO 14044 and MFCA technical report for engineers and LCA reviewers.");
  },
  get reportCompliance() {
    return tx("Laporan GRI, GHG Protocol/ISO 14067, dan PROPER untuk EHS dan auditor.", "GRI, GHG Protocol/ISO 14067 and PROPER reports for EHS and auditors.");
  },
  get auditEvidence() {
    return tx("Paket bukti audit lengkap untuk verifikator pihak ketiga.", "Complete audit evidence pack for third-party verifiers.");
  },
  get askAi() {
    return tx("Tanyakan arti hasil dan saran perbaikan dalam bahasa sehari-hari.", "Ask what your results mean and get improvement tips in plain language.");
  },
  get advancedValidation() {
    return tx("Matriks keyakinan data lengkap dan neraca massa untuk audit.", "Full data-confidence matrix and mass balance for audits.");
  },
};

export function minimumPlanFor(feature: Feature): PlanDef {
  return PLANS.find((p) => p.features.includes(feature)) ?? PLANS[PLANS.length - 1]!;
}

export type SubscriptionStatus = "trial" | "active" | "pending" | "expired";

export interface Subscription {
  plan: PlanId;
  status: SubscriptionStatus;
  startedAt: string;
  periodEnd?: string;
  uploadsUsed: number;
  aiQuestionsUsed: number;
  /** Paid plan chosen while another plan is running; it replaces the current one on activation. */
  pendingPlan?: PlanId;
}

/** Trial and paid periods end; afterwards data stays read-only for 30 days. */
export function effectiveStatus(sub: Subscription | null, now: Date = new Date()): SubscriptionStatus | "none" {
  if (!sub) return "none";
  if (sub.periodEnd && new Date(sub.periodEnd).getTime() < now.getTime()) return "expired";
  return sub.status;
}

export function hasFeature(sub: Subscription | null, feature: Feature, now: Date = new Date()): boolean {
  const status = effectiveStatus(sub, now);
  if (!sub || status === "expired" || status === "pending" || status === "none") return false;
  return PLAN_BY_ID.get(sub.plan)?.features.includes(feature) ?? false;
}

export function planLimits(sub: Subscription | null) {
  return PLAN_BY_ID.get(sub?.plan ?? "coba")!.limits;
}

export function daysLeft(sub: Subscription | null, now: Date = new Date()): number | null {
  if (!sub?.periodEnd) return null;
  return Math.max(0, Math.ceil((new Date(sub.periodEnd).getTime() - now.getTime()) / 86_400_000));
}
