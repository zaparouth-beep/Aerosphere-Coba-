/**
 * Subscription plans and feature entitlements (PRD v1.1 §3.0.2).
 *
 * In this browser build the check runs inside every store action as well as
 * in the UI, so a locked feature cannot be reached by bypassing a button. The
 * server version moves the same table into an `entitlement_check` middleware
 * that answers HTTP 403 PLAN_REQUIRED.
 */

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
  price: string;
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
    name: "Coba",
    audience: "Calon klien, juri, demo",
    price: "Gratis 14 hari",
    projects: "1 (proyek contoh + 1 unggahan)",
    users: "1",
    deployment: "Cloud",
    support: "—",
    rows: {
      "Input data": "Data contoh + 1 unggahan",
      "Hasil & Titik Boros": "Ya",
      "Simulasi perbaikan": "3 skenario contoh",
      Laporan: "Ringkas (watermark “Contoh”)",
      "Tanya AeroSphere": "10 pertanyaan",
    },
    features: ["uploadData", "reportSummary", "askAi"],
    limits: { uploads: 1, scenarios: 3, aiQuestions: 10, trialDays: 14 },
  },
  {
    id: "esensial",
    name: "Esensial",
    audience: "Pabrik kecil, 1 lini",
    price: "Diisi tim",
    projects: "1",
    users: "3",
    deployment: "Cloud",
    support: "1 sesi onboarding",
    rows: {
      "Input data": "Unggah Excel + isi manual",
      "Hasil & Titik Boros": "Ya",
      "Simulasi perbaikan": "Hingga 3 skenario",
      Laporan: "Ringkas",
      "Tanya AeroSphere": "Ya",
    },
    features: ["uploadData", "manualInput", "editScenario", "reportSummary", "askAi"],
    limits: { uploads: Infinity, scenarios: 3, aiQuestions: Infinity },
  },
  {
    id: "profesional",
    name: "Profesional",
    audience: "Tim EHS/ESG, beberapa lini",
    price: "Diisi tim",
    projects: "Hingga 5",
    users: "10",
    deployment: "Cloud",
    support: "Tinjauan kuartalan",
    rows: {
      "Input data": "+ validasi lanjutan",
      "Hasil & Titik Boros": "Ya + Mode Ahli (semua kategori dampak)",
      "Simulasi perbaikan": "Tanpa batas + bobot keputusan",
      Laporan: "+ Teknis ISO 14044, GRI, PROPER, GHG",
      "Tanya AeroSphere": "Ya",
    },
    features: ["uploadData", "manualInput", "editScenario", "decisionWeights", "expertMode", "advancedValidation", ...ALL_REPORTS, "askAi"],
    limits: { uploads: Infinity, scenarios: 10, aiQuestions: Infinity },
  },
  {
    id: "industri",
    name: "Industri",
    audience: "Grup manufaktur, data sensitif",
    price: "Penawaran khusus",
    projects: "Sesuai kontrak",
    users: "Sesuai kontrak",
    deployment: "Cloud atau on-premise",
    support: "Konsultan khusus",
    rows: {
      "Input data": "+ konektor ERP/IoT (roadmap V2)",
      "Hasil & Titik Boros": "Ya + Mode Ahli",
      "Simulasi perbaikan": "+ optimizer & biaya siklus hidup (roadmap V2)",
      Laporan: "+ paket bukti audit",
      "Tanya AeroSphere": "Ya (opsi model on-premise)",
    },
    features: ["uploadData", "manualInput", "editScenario", "decisionWeights", "expertMode", "advancedValidation", ...ALL_REPORTS, "auditEvidence", "askAi"],
    limits: { uploads: Infinity, scenarios: 10, aiQuestions: Infinity },
  },
];

export const PLAN_BY_ID = new Map(PLANS.map((p) => [p.id, p]));

/** One-sentence benefit shown on a locked feature (§3.0.2: gembok + manfaat). */
export const FEATURE_BENEFIT: Record<Feature, string> = {
  uploadData: "Unggah data lini Anda dari template Excel.",
  manualInput: "Isi dan koreksi data langsung di tabel tanpa unggah ulang.",
  expertMode: "Lihat semua kategori dampak, emisi per Scope, Sankey, heatmap, dan pengaturan database.",
  editScenario: "Rancang simulasi perbaikan sendiri dengan angka lini Anda.",
  decisionWeights: "Atur bobot keputusan untuk membandingkan banyak perbaikan sekaligus.",
  reportSummary: "Laporan ringkas 2 halaman untuk manajemen.",
  reportTechnical: "Laporan teknis ISO 14044 dan MFCA untuk engineer dan reviewer LCA.",
  reportCompliance: "Laporan GRI, GHG Protocol/ISO 14067, dan PROPER untuk EHS dan auditor.",
  auditEvidence: "Paket bukti audit lengkap untuk verifikator pihak ketiga.",
  askAi: "Tanyakan arti hasil dan saran perbaikan dalam bahasa sehari-hari.",
  advancedValidation: "Matriks keyakinan data lengkap dan neraca massa untuk audit.",
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
