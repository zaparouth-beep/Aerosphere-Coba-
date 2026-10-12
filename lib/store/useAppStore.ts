"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { findDemoAccount, passwordHash } from "@/lib/domain/accounts";
import { can, type Permission } from "@/lib/domain/permissions";
import { effectiveStatus, hasFeature, minimumPlanFor, PLAN_BY_ID, planLimits, type Feature, type PlanId, type Subscription } from "@/lib/domain/plans";
import { parseProject } from "@/lib/domain/schema";
import { hardChromeDemo, meta, newId, TEMPLATES } from "@/lib/domain/templates";
import type {
  AirEmission,
  AuditEvent,
  BackgroundDataset,
  EffluentParam,
  ElementaryFlowCF,
  HazardousWaste,
  InputCategory,
  InputFlow,
  LeverSettings,
  PriceBook,
  Production,
  Project,
  Role,
  Scenario,
  Scope,
  StageId,
  Targets,
} from "@/lib/domain/types";
import { calculate } from "@/lib/engine/calculate";
import { tx } from "@/lib/i18n";
import { DEFAULT_WEIGHTS, type HotspotWeights } from "@/lib/engine/hotspot";
import { appendEvent, createRun, datasetHash, type Run } from "@/lib/engine/run";

export const MAX_RUNS = 20;

export interface Notice {
  id: string;
  tone: "info" | "success" | "error";
  text: string;
}

interface Ui {
  activeRunId: string | null;
  compareScenarioId: string | null;
  fuView: "perFu" | "total";
  hotspotWeights: HotspotWeights;
  copilotOpen: boolean;
  insightDecisions: Record<string, "accepted" | "rejected">;
  onboarded: boolean;
  /** Mode Ahli (PRD v1.1 §3.0.3); Mode Ringkas is the default. */
  expertMode: boolean;
  /** Current step of the 5-step first tour, or null when not running. */
  tourStep: number | null;
  /** "Bandingkan dengan": a saved result id, or null for the previous saved result. */
  compareRunId: string | null;
  /** Checklist progress that has no data trace (PRD v1.1 §3.0.5). */
  seenHotspot: boolean;
  reportDownloaded: boolean;
  /** Interface language: Bahasa Indonesia (default) or English. */
  lang: "id" | "en";
}

export interface Account {
  name: string;
  email: string;
  company: string;
  createdAt: string;
}

/** A user edit of one report text block; `base` is the engine text it was written over. */
export interface ReportBlockEdit {
  text: string;
  base: string;
  at: string;
}

export interface ReportDocEdits {
  blocks: Record<string, ReportBlockEdit>;
  /** Optional blocks (e.g. one improvement direction) left out of the report. */
  hidden: string[];
}

export interface NextStep {
  action: string;
  owner: string;
  due: string;
}

type ListKey = "inputs" | "airEmissions" | "effluent" | "waste";
type ListItem<K extends ListKey> = Project[K][number];

interface State {
  project: Project;
  runs: Run[];
  events: AuditEvent[];
  user: { name: string; role: Role };
  account: Account | null;
  /** Account registered in this browser (password kept only as a salted hash). */
  registered: { account: Account; hash: string; subscription?: Subscription | null; onboardingDone?: boolean } | null;
  subscription: Subscription | null;
  onboardingDone: boolean;
  nextSteps: NextStep[];
  /** Data saved before each document import (latest first, max 5). */
  importBackups: ImportBackup[];
  /** Report text edits per report document (report type + result). */
  reportEdits: Record<string, ReportDocEdits>;
  ui: Ui;
  notices: Notice[];

  notify: (tone: Notice["tone"], text: string) => void;
  dismissNotice: (id: string) => void;
  setUser: (name: string, role: Role) => void;
  signIn: (account: Omit<Account, "createdAt">) => void;
  /** Sign in with email + password: demo accounts or the account registered in this browser. */
  signInWithPassword: (email: string, password: string) => { ok: true; next: string } | { ok: false; error: string };
  register: (account: Omit<Account, "createdAt">, password: string) => { ok: true } | { ok: false; error: string };
  signOut: () => void;
  choosePlan: (plan: PlanId) => void;
  activatePlan: () => boolean;
  completeOnboarding: () => void;
  /** Onboarding only: start from a prepared project (sample or line profile). */
  setupProject: (project: Project, source: string) => boolean;
  setExpertMode: (on: boolean) => boolean;
  requireFeature: (feature: Feature, what: string) => boolean;
  consumeAiQuestion: () => boolean;
  setNextSteps: (steps: NextStep[]) => void;
  setReportBlock: (doc: string, id: string, base: string, text: string) => void;
  resetReportBlock: (doc: string, id: string) => void;
  resetReportDoc: (doc: string) => void;
  setReportHidden: (doc: string, id: string, hidden: boolean) => void;
  setUi: (patch: Partial<Ui>) => void;

  loadTemplate: (templateId: string) => boolean;
  importProject: (raw: unknown) => boolean;
  updateProjectMeta: (patch: Partial<Pick<Project, "name" | "facility" | "client" | "periodLabel" | "periodMonths" | "partName" | "substrate" | "coatingType" | "hotspotThresholdPct">>) => boolean;

  updateScope: (patch: Partial<Scope>) => boolean;
  lockScope: () => boolean;
  newScopeVersion: (reason: string) => boolean;
  toggleStageBoundary: (id: StageId) => boolean;

  updateItem: <K extends ListKey>(key: K, id: string, patch: Partial<ListItem<K>>) => boolean;
  addInput: (category: InputCategory, stageId: StageId) => boolean;
  addAirEmission: () => boolean;
  addEffluent: () => boolean;
  addWaste: () => boolean;
  removeItem: (key: ListKey, id: string) => boolean;
  updateProduction: (patch: Partial<Production>) => boolean;
  applyDatasetPatch: (patch: Pick<Project, "inputs" | "airEmissions" | "effluent" | "waste" | "production"> & Pick<Partial<Project>, "externalImpacts">, source: string) => boolean;
  /** Document import (spec "tinjau dulu, lalu ganti"): back up the current data, open a new data version, then replace. */
  importDocumentData: (patch: ImportedData, source: string) => boolean;
  /** Put back the data saved before the last document import. */
  restoreImportBackup: () => boolean;
  updatePrices: (patch: Partial<PriceBook>) => boolean;
  updateTargets: (patch: Partial<Targets>) => boolean;
  updateStageScores: (field: "stageEase" | "stageComplianceRisk" | "laborHoursByStage", id: StageId, value: number) => boolean;

  upsertBackground: (ds: BackgroundDataset) => boolean;
  removeBackground: (id: string) => boolean;
  upsertFlowCF: (flows: ElementaryFlowCF[], release?: string) => boolean;

  acceptWarning: (key: string, reason: string) => boolean;
  revokeWarning: (key: string) => boolean;
  approveDataset: () => boolean;
  reopenDataset: (reason: string) => boolean;

  runCalculation: (kind: "draft" | "official", scenarioId?: string) => string | null;
  deleteRun: (id: string) => boolean;

  addScenario: () => boolean;
  createScenarioFrom: (name: string, levers: LeverSettings, description?: string) => string | null;
  updateScenario: (id: string, patch: Partial<Scenario>) => boolean;
  setLevers: (id: string, levers: LeverSettings) => boolean;
  removeScenario: (id: string) => boolean;
  markRecommended: (id: string) => boolean;
  approveScenario: (id: string) => boolean;

  log: (entity: string, entityId: string, action: string, extra?: { oldValue?: unknown; newValue?: unknown; reason?: string }) => void;
}

const nowIso = () => new Date().toISOString();

export type ImportedData = Pick<Project, "inputs" | "airEmissions" | "effluent" | "waste" | "production"> & Pick<Partial<Project>, "externalImpacts">;

export interface ImportBackup {
  at: string;
  source: string;
  version: number;
  data: ImportedData;
}

export const useAppStore = create<State>()(
  persist(
    (set, get) => {
      /**
       * Permission gate: denied attempts are logged (AC-08). `what` is Indonesian
       * and goes into the audit log unchanged; `whatEn` is only for the notice.
       */
      const guard = (permission: Permission, what: string, whatEn: string = what): boolean => {
        const { user } = get();
        if (can(user.role, permission)) return true;
        get().log("access", permission, "denied", { reason: `${user.role} mencoba: ${what}` });
        get().notify("error", tx(`Peran ${user.role} tidak berhak: ${what}.`, `The ${user.role} role is not allowed to: ${whatEn}.`));
        return false;
      };
      /** Plan entitlement (PRD v1.1 §3.0.2): denied attempts are logged as PLAN_REQUIRED. */
      const entitled = (feature: Feature, what: string, whatEn: string = what): boolean => {
        const sub = get().subscription;
        if (hasFeature(sub, feature)) return true;
        const status = effectiveStatus(sub);
        const min = minimumPlanFor(feature);
        get().log("access", feature, "PLAN_REQUIRED", { reason: `${what}; paket minimum ${min.name}; status ${status}` });
        get().notify(
          "error",
          status === "expired"
            ? tx("Masa paket berakhir. Data tetap bisa dibaca selama 30 hari; pilih paket untuk melanjutkan.", "Your plan has ended. Data stays readable for 30 days; choose a plan to continue.")
            : status === "pending"
              ? tx("Paket menunggu aktivasi admin.", "The plan is waiting for admin activation.")
              : tx(`${what} tersedia mulai paket ${min.name}.`, `${whatEn} is available from the ${min.name} plan.`),
        );
        return false;
      };
      /** Approved datasets are immutable; a new version must be opened first (AC-04). */
      const editableData = (what: string, whatEn: string = what): boolean => {
        if (!entitled("manualInput", what, whatEn)) return false;
        if (!guard("editData", what, whatEn)) return false;
        if (get().project.dataset.status === "approved") {
          get().notify("error", tx("Dataset sudah di-approve. Buka versi baru (dengan alasan) sebelum mengubah data.", "The dataset is approved. Open a new version (with a reason) before changing data."));
          return false;
        }
        return true;
      };
      const scopeEditable = (): boolean => {
        if (!entitled("expertMode", "Mengubah pengaturan studi (Goal & Scope)", "Changing the study settings (Goal & Scope)")) return false;
        if (!guard("editScope", "mengubah Goal & Scope", "change Goal & Scope")) return false;
        if (get().project.scope.lockedAt) {
          get().notify("error", tx(`Scope v${get().project.scope.version} terkunci. Buat versi baru untuk mengubahnya.`, `Scope v${get().project.scope.version} is locked. Create a new version to change it.`));
          return false;
        }
        return true;
      };
      /** Keep the registered account's plan when a demo account takes over this browser. */
      const snapshotRegistered = () => {
        const { registered, account, subscription, onboardingDone } = get();
        if (registered && account && account.email === registered.account.email) set({ registered: { ...registered, subscription, onboardingDone } });
      };
      /**
       * Every change to the live data. When a saved result is on screen, the
       * view moves to the live data so the change is visible right away (the
       * saved result itself is never changed and can be selected again).
       */
      const mutate = (fn: (p: Project) => void) => {
        const pinned = get().ui.activeRunId;
        set((s) => {
          const project = structuredClone(s.project);
          fn(project);
          return pinned ? { project, ui: { ...s.ui, activeRunId: null } } : { project };
        });
        if (pinned) get().notify(
            "info",
            tx(
              `Tampilan pindah ke data terkini agar perubahan langsung terlihat. Hasil #${pinned} tetap tersimpan dan bisa dipilih lagi di “Periode”.`,
              `The view switched to the current data so the change shows right away. Result #${pinned} is still saved and can be selected again under “Period”.`,
            ),
          );
      };

      return {
        project: hardChromeDemo(),
        runs: [],
        events: [],
        user: { name: "Pengguna demo", role: "Admin" },
        account: null,
        registered: null,
        subscription: null,
        onboardingDone: false,
        nextSteps: [],
        importBackups: [],
        reportEdits: {},
        ui: {
          activeRunId: null,
          compareScenarioId: null,
          fuView: "perFu",
          hotspotWeights: DEFAULT_WEIGHTS,
          copilotOpen: false,
          insightDecisions: {},
          onboarded: false,
          expertMode: false,
          tourStep: null,
          compareRunId: null,
          seenHotspot: false,
          reportDownloaded: false,
          lang: "id",
        },
        notices: [],

        notify: (tone, text) => {
          const id = newId("n");
          set((s) => ({ notices: [...s.notices.slice(-3), { id, tone, text }] }));
          if (typeof window !== "undefined") window.setTimeout(() => get().dismissNotice(id), 5000);
        },
        dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),

        log: (entity, entityId, action, extra = {}) => {
          const { user } = get();
          set((s) => ({ events: appendEvent(s.events, { actor: user.name, role: user.role, entity, entityId, action, ts: nowIso(), ...extra }) }));
        },

        setUser: (name, role) => {
          const old = get().user;
          set({ user: { name: name.trim() || "Pengguna", role } });
          get().log("session", "user", "switch-role", { oldValue: old, newValue: { name, role } });
        },
        setUi: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),

        signIn: (account) => {
          const acc = { ...account, name: account.name.trim(), email: account.email.trim().toLowerCase(), createdAt: get().account?.createdAt ?? nowIso() };
          set((s) => ({ account: acc, user: { ...s.user, name: acc.name || acc.email } }));
          get().log("session", acc.email, "sign-in");
        },
        signInWithPassword: (email, password) => {
          const demo = findDemoAccount(email, password);
          if (demo) {
            snapshotRegistered();
            const now = new Date();
            const def = PLAN_BY_ID.get(demo.plan)!;
            const acc: Account = { name: demo.name, email: demo.email, company: demo.company, createdAt: now.toISOString() };
            set((s) => ({
              account: acc,
              user: { name: demo.name, role: demo.role },
              subscription: {
                plan: demo.plan,
                status: demo.plan === "coba" ? "trial" : "active",
                startedAt: now.toISOString(),
                periodEnd: def.limits.trialDays ? new Date(now.getTime() + def.limits.trialDays * 86_400_000).toISOString() : undefined,
                uploadsUsed: 0,
                aiQuestionsUsed: 0,
              },
              onboardingDone: true,
              ui: { ...s.ui, onboarded: true, expertMode: false, tourStep: demo.tour ? 0 : null },
            }));
            get().log("session", demo.email, "sign-in", { reason: `akun demo (${def.name})` });
            return { ok: true, next: "/beranda" };
          }
          const reg = get().registered;
          const e = email.trim().toLowerCase();
          if (reg && reg.account.email === e && reg.hash === passwordHash(e, password)) {
            set((s) => ({
              account: reg.account,
              user: { ...s.user, name: reg.account.name },
              ...(reg.subscription !== undefined ? { subscription: reg.subscription, onboardingDone: !!reg.onboardingDone } : {}),
            }));
            get().log("session", e, "sign-in");
            const status = effectiveStatus(get().subscription);
            return { ok: true, next: !get().subscription || status === "pending" ? "/paket" : !get().onboardingDone ? "/mulai" : "/beranda" };
          }
          get().log("session", e || "-", "sign-in-failed");
          return { ok: false, error: tx("Email atau kata sandi salah.", "Wrong email or password.") };
        },
        register: (account, password) => {
          if (password.length < 8) return { ok: false, error: tx("Kata sandi minimal 8 karakter.", "The password must be at least 8 characters.") };
          const email = account.email.trim().toLowerCase();
          if (findDemoAccount(email, password) || email.endsWith("@aerosphere.demo")) return { ok: false, error: tx("Email ini dipakai akun demo. Gunakan email lain.", "This email is used by a demo account. Use another email.") };
          const acc: Account = { name: account.name.trim(), email, company: account.company.trim(), createdAt: nowIso() };
          const prev = get().registered;
          // A new person registering in this browser starts clean.
          const fresh = !prev || prev.account.email !== email;
          set((s) => ({
            registered: { account: acc, hash: passwordHash(email, password) },
            account: acc,
            user: { name: acc.name, role: "Admin" },
            ...(fresh ? { subscription: null, onboardingDone: false, nextSteps: [], ui: { ...s.ui, expertMode: false, tourStep: null } } : {}),
          }));
          get().log("session", email, "register");
          return { ok: true };
        },
        signOut: () => {
          snapshotRegistered();
          get().log("session", get().account?.email ?? "-", "sign-out");
          set({ account: null });
        },
        choosePlan: (plan) => {
          const now = new Date();
          const def = PLAN_BY_ID.get(plan)!;
          const prev = get().subscription;
          const status = effectiveStatus(prev);
          if (plan === "coba" && prev) {
            // One free trial per account; switching back cancels a pending upgrade.
            if (prev.pendingPlan) set({ subscription: { ...prev, pendingPlan: undefined } });
            else get().notify("error", tx("Uji coba gratis hanya sekali per akun. Pilih paket berbayar untuk melanjutkan.", "The free trial is once per account. Choose a paid plan to continue."));
            return;
          }
          if (plan !== "coba" && prev && (status === "trial" || status === "active")) {
            // Keep the running plan until the paid plan is activated.
            set({ subscription: { ...prev, pendingPlan: plan } });
            get().log("subscription", plan, "request-plan", { oldValue: prev.plan, newValue: plan });
            get().notify(
              "info",
              tx(
                `Paket ${def.name} menunggu aktivasi. Paket ${PLAN_BY_ID.get(prev.plan)?.name} tetap berjalan sampai saat itu.`,
                `The ${def.name} plan is waiting for activation. The ${PLAN_BY_ID.get(prev.plan)?.name} plan keeps running until then.`,
              ),
            );
            return;
          }
          set({
            subscription: {
              plan,
              // Coba starts immediately; paid plans wait for payment/admin activation.
              status: plan === "coba" ? "trial" : "pending",
              startedAt: now.toISOString(),
              periodEnd: def.limits.trialDays ? new Date(now.getTime() + def.limits.trialDays * 86_400_000).toISOString() : undefined,
              uploadsUsed: prev?.uploadsUsed ?? 0,
              aiQuestionsUsed: prev?.aiQuestionsUsed ?? 0,
            },
          });
          get().log("subscription", plan, "choose-plan", { oldValue: prev?.plan, newValue: plan });
        },
        activatePlan: () => {
          const sub = get().subscription;
          if (!sub || (sub.status !== "pending" && !sub.pendingPlan)) return false;
          const plan = sub.pendingPlan ?? sub.plan;
          set({ subscription: { ...sub, plan, pendingPlan: undefined, status: "active", startedAt: nowIso(), periodEnd: undefined } });
          get().log("subscription", plan, "activate", { reason: "Aktivasi admin (simulasi demo BUILD, tanpa gateway pembayaran)" });
          get().notify("success", tx(`Paket ${PLAN_BY_ID.get(plan)?.name} aktif.`, `The ${PLAN_BY_ID.get(plan)?.name} plan is active.`));
          return true;
        },
        completeOnboarding: () => {
          set((s) => ({ onboardingDone: true, ui: { ...s.ui, onboarded: true, tourStep: 0 } }));
          get().log("session", get().account?.email ?? "-", "onboarding-complete");
        },
        setupProject: (project, source) => {
          if (get().onboardingDone) {
            get().notify("error", tx("Profil lini hanya diatur saat onboarding. Ubah data lewat Data Saya.", "The line profile is only set during onboarding. Change data in My Data."));
            return false;
          }
          const parsed = parseProject(project);
          if (!parsed.ok) {
            get().notify("error", tx(`Proyek tidak valid — ${parsed.error}`, `Invalid project — ${parsed.error}`));
            return false;
          }
          set((s) => ({ project: parsed.project, runs: [], ui: { ...s.ui, activeRunId: null, compareRunId: null, compareScenarioId: null } }));
          get().log("project", parsed.project.id, "onboarding-setup", { newValue: source });
          return true;
        },
        setExpertMode: (on) => {
          if (on && !entitled("expertMode", "Mode Ahli", "Expert mode")) return false;
          set((s) => ({ ui: { ...s.ui, expertMode: on } }));
          return true;
        },
        requireFeature: (feature, what) => entitled(feature, what),
        consumeAiQuestion: () => {
          if (!entitled("askAi", "Tanya AeroSphere", "Ask AeroSphere")) return false;
          const sub = get().subscription!;
          const limit = planLimits(sub).aiQuestions;
          if (sub.aiQuestionsUsed >= limit) {
            get().notify("error", tx(`Kuota ${limit} pertanyaan paket Coba sudah habis. Pilih paket untuk melanjutkan.`, `The Trial plan's quota of ${limit} questions is used up. Choose a plan to continue.`));
            return false;
          }
          set({ subscription: { ...sub, aiQuestionsUsed: sub.aiQuestionsUsed + 1 } });
          return true;
        },
        setNextSteps: (steps) => {
          set({ nextSteps: steps });
          get().log("report", "next-steps", "update", { newValue: steps });
        },
        setReportBlock: (doc, id, base, text) =>
          set((s) => {
            const cur = s.reportEdits[doc] ?? { blocks: {}, hidden: [] };
            const blocks = { ...cur.blocks };
            // Typing the engine text back exactly is the same as no edit.
            if (text === base) delete blocks[id];
            else blocks[id] = { text, base, at: new Date().toISOString() };
            return { reportEdits: { ...s.reportEdits, [doc]: { ...cur, blocks } } };
          }),
        resetReportBlock: (doc, id) =>
          set((s) => {
            const cur = s.reportEdits[doc];
            if (!cur) return {};
            const blocks = { ...cur.blocks };
            delete blocks[id];
            return { reportEdits: { ...s.reportEdits, [doc]: { ...cur, blocks } } };
          }),
        resetReportDoc: (doc) => {
          const rest = { ...get().reportEdits };
          delete rest[doc];
          set({ reportEdits: rest });
          get().log("report", doc, "reset-report-text");
        },
        setReportHidden: (doc, id, hidden) =>
          set((s) => {
            const cur = s.reportEdits[doc] ?? { blocks: {}, hidden: [] };
            const set2 = new Set(cur.hidden);
            if (hidden) set2.add(id);
            else set2.delete(id);
            return { reportEdits: { ...s.reportEdits, [doc]: { ...cur, hidden: [...set2] } } };
          }),

        loadTemplate: (templateId) => {
          const role = get().user.role;
          if (!can(role, "admin") && !can(role, "editScope") && !guard("editData", "membuat proyek dari template", "create a project from a template")) return false;
          const tpl = TEMPLATES.find((t) => t.id === templateId);
          if (!tpl) return false;
          if (tpl.id !== "hard-chrome" && !entitled("manualInput", "Membuat proyek baru dari template", "Creating a new project from a template")) return false;
          const project = tpl.build();
          set((s) => ({ project, ui: { ...s.ui, activeRunId: null, compareScenarioId: null } }));
          get().log("project", project.id, "create-from-template", { newValue: tpl.labelId });
          get().notify("success", tx(`Proyek dibuat dari template "${tpl.label}".`, `Project created from template "${tpl.label}".`));
          return true;
        },

        importProject: (raw) => {
          if (!guard("admin", "mengimpor proyek", "import a project")) return false;
          const parsed = parseProject(raw);
          if (!parsed.ok) {
            get().notify("error", tx(`Impor ditolak — ${parsed.error}`, `Import rejected — ${parsed.error}`));
            return false;
          }
          set((s) => ({ project: parsed.project, ui: { ...s.ui, activeRunId: null } }));
          get().log("project", parsed.project.id, "import", { newValue: parsed.project.name });
          get().notify("success", tx("Proyek berhasil diimpor.", "Project imported."));
          return true;
        },

        updateProjectMeta: (patch) => {
          if (!guard("editScope", "mengubah metadata proyek", "change project metadata")) return false;
          const old = Object.fromEntries(Object.keys(patch).map((k) => [k, get().project[k as keyof Project]]));
          mutate((p) => Object.assign(p, patch));
          get().log("project", get().project.id, "update-meta", { oldValue: old, newValue: patch });
          return true;
        },

        updateScope: (patch) => {
          if (!scopeEditable()) return false;
          const old = Object.fromEntries(Object.keys(patch).map((k) => [k, get().project.scope[k as keyof Scope]]));
          mutate((p) => Object.assign(p.scope, patch));
          get().log("scope", `v${get().project.scope.version}`, "update", { oldValue: old, newValue: patch });
          return true;
        },
        lockScope: () => {
          if (!guard("editScope", "mengunci pengaturan studi", "lock the study settings")) return false;
          if (get().project.scope.lockedAt) return false;
          const { user } = get();
          mutate((p) => {
            p.scope.lockedAt = nowIso();
            p.scope.lockedBy = user.name;
          });
          get().log("scope", `v${get().project.scope.version}`, "lock");
          get().notify("success", tx(`Scope v${get().project.scope.version} dikunci.`, `Scope v${get().project.scope.version} locked.`));
          return true;
        },
        newScopeVersion: (reason) => {
          if (!guard("editScope", "membuat versi scope baru", "create a new scope version")) return false;
          if (!reason.trim()) {
            get().notify("error", tx("Alasan wajib diisi.", "A reason is required."));
            return false;
          }
          mutate((p) => {
            p.scopeHistory = [...p.scopeHistory, structuredClone(p.scope)];
            p.scope = { ...p.scope, version: p.scope.version + 1, lockedAt: undefined, lockedBy: undefined };
          });
          get().log("scope", `v${get().project.scope.version}`, "new-version", { reason });
          return true;
        },
        toggleStageBoundary: (id) => {
          if (!scopeEditable()) return false;
          let next = false;
          mutate((p) => {
            const st = p.stages.find((s) => s.id === id);
            if (st) {
              st.inBoundary = !st.inBoundary;
              next = st.inBoundary;
            }
          });
          get().log("scope", id, "boundary", { newValue: next });
          return true;
        },

        updateItem: (key, id, patch) => {
          if (!editableData("mengubah data", "change data")) return false;
          const list = get().project[key] as Array<{ id: string }>;
          const old = list.find((i) => i.id === id);
          if (!old) return false;
          const oldValues = Object.fromEntries(Object.keys(patch).map((k) => [k, (old as Record<string, unknown>)[k]]));
          mutate((p) => {
            const arr = p[key] as Array<{ id: string }>;
            const idx = arr.findIndex((i) => i.id === id);
            if (idx >= 0) arr[idx] = { ...arr[idx]!, ...patch };
          });
          get().log(key, id, "update", { oldValue: oldValues, newValue: patch });
          return true;
        },
        addInput: (category, stageId) => {
          if (!editableData("menambah input", "add an input")) return false;
          const unit = category === "Energy" ? "kWh" : category === "Water" ? "L" : "kg";
          const p0 = get().project;
          const item: InputFlow = {
            id: newId("in"),
            no: p0.inputs.reduce((m, i) => Math.max(m, i.no), 0) + 1,
            category,
            name: tx("Input baru", "New input"),
            stageId,
            quantity: 0,
            unit,
            basis: "period",
            meta: meta("measured"),
            mapping: category === "Energy" && p0.backgrounds.some((b) => b.id === "bg-grid-jamali") ? { status: "proxy", datasetId: "bg-grid-jamali", rationale: "Listrik grid" } : { status: "unmapped" },
          };
          mutate((p) => p.inputs.push(item));
          get().log("inputs", item.id, "create", { newValue: item });
          return true;
        },
        addAirEmission: () => {
          if (!editableData("menambah emisi", "add an emission")) return false;
          const item: AirEmission = { id: newId("air"), parameter: tx("Emisi baru", "New emission"), relevance: "", applicable: true, stageId: "C", quantityKg: 0, basis: "period", meta: meta("measured") };
          mutate((p) => p.airEmissions.push(item));
          get().log("airEmissions", item.id, "create", { newValue: item });
          return true;
        },
        addEffluent: () => {
          if (!editableData("menambah parameter efluen", "add an effluent parameter")) return false;
          const item: EffluentParam = { id: newId("eff"), parameter: tx("Parameter baru", "New parameter"), unit: "mg/L", value: 0 };
          mutate((p) => p.effluent.push(item));
          get().log("effluent", item.id, "create", { newValue: item });
          return true;
        },
        addWaste: () => {
          if (!editableData("menambah limbah", "add waste")) return false;
          const item: HazardousWaste = {
            id: newId("waste"),
            wasteType: tx("Limbah B3 baru", "New B3 waste"),
            stageId: "F",
            quantityKg: 0,
            basis: "period",
            moisturePct: 0,
            metalContentPct: 0,
            treatment: "Stabilization/dewatering",
            destination: "Vendor pengolah limbah B3 berizin",
            transportKm: 0,
            recovery: false,
            meta: meta("measured"),
            mapping: { status: "unmapped" },
          };
          mutate((p) => p.waste.push(item));
          get().log("waste", item.id, "create", { newValue: item });
          return true;
        },
        removeItem: (key, id) => {
          if (!editableData("menghapus data", "delete data")) return false;
          const old = (get().project[key] as Array<{ id: string }>).find((i) => i.id === id);
          mutate((p) => {
            (p[key] as Array<{ id: string }>) = (p[key] as Array<{ id: string }>).filter((i) => i.id !== id);
          });
          get().log(key, id, "delete", { oldValue: old });
          return true;
        },
        updateProduction: (patch) => {
          if (!editableData("mengubah data produksi", "change production data")) return false;
          const old = Object.fromEntries(Object.keys(patch).map((k) => [k, get().project.production[k as keyof Production]]));
          mutate((p) => Object.assign(p.production, patch));
          get().log("production", "production", "update", { oldValue: old, newValue: patch });
          return true;
        },
        applyDatasetPatch: (patch, source) => {
          if (!entitled("uploadData", "Unggah data", "Uploading data")) return false;
          const sub = get().subscription!;
          const limit = planLimits(sub).uploads;
          if (sub.uploadsUsed >= limit) {
            get().notify(
              "error",
              tx(
                `Paket ${PLAN_BY_ID.get(sub.plan)?.name} hanya mengizinkan ${limit} unggahan. Pilih paket Esensial atau lebih tinggi.`,
                `The ${PLAN_BY_ID.get(sub.plan)?.name} plan allows only ${limit} upload(s). Choose the Essential plan or higher.`,
              ),
            );
            return false;
          }
          if (!guard("editData", "mengimpor data", "import data")) return false;
          if (get().project.dataset.status === "approved") {
            get().notify("error", tx("Data sudah disetujui. Buka versi baru (dengan alasan) sebelum mengunggah.", "The data is approved. Open a new version (with a reason) before uploading."));
            return false;
          }
          set({ subscription: { ...sub, uploadsUsed: sub.uploadsUsed + 1 } });
          const before = { inputs: get().project.inputs.length, waste: get().project.waste.length };
          mutate((p) => Object.assign(p, structuredClone(patch)));
          get().log("dataset", `v${get().project.dataset.version}`, "import", { oldValue: before, newValue: { source, inputs: patch.inputs.length, waste: patch.waste.length } });
          return true;
        },
        importDocumentData: (patch, source) => {
          const p = get().project;
          if (p.dataset.status === "approved") {
            get().notify("error", tx("Data sudah disetujui. Buka versi baru (dengan alasan) sebelum mengunggah.", "The data is approved. Open a new version (with a reason) before uploading."));
            return false;
          }
          const backup: ImportBackup = {
            at: nowIso(),
            source,
            version: p.dataset.version,
            data: structuredClone({ inputs: p.inputs, airEmissions: p.airEmissions, effluent: p.effluent, waste: p.waste, production: p.production, externalImpacts: p.externalImpacts }),
          };
          if (!get().applyDatasetPatch({ externalImpacts: undefined, ...patch }, source)) return false;
          mutate((d) => {
            d.dataset = { version: d.dataset.version + 1, status: "draft", acceptedWarnings: {} };
          });
          set((s) => ({ importBackups: [backup, ...s.importBackups].slice(0, 5) }));
          get().log("dataset", `v${get().project.dataset.version}`, "import-document", { reason: `Diganti dari dokumen ${source}; data v${backup.version} disimpan sebagai cadangan.` });
          return true;
        },
        restoreImportBackup: () => {
          const [last, ...rest] = get().importBackups;
          if (!last) return false;
          if (!guard("editData", "mengembalikan data", "restore data")) return false;
          mutate((d) => {
            Object.assign(d, structuredClone(last.data));
            d.dataset = { version: d.dataset.version + 1, status: "draft", acceptedWarnings: {} };
          });
          set({ importBackups: rest });
          get().log("dataset", `v${get().project.dataset.version}`, "restore-backup", { reason: `Data sebelum impor ${last.source} dikembalikan.` });
          return true;
        },
        updatePrices: (patch) => {
          if (!entitled("manualInput", "Mengubah harga satuan", "Changing unit prices")) return false;
          if (!guard("editPrices", "mengubah harga satuan", "change unit prices")) return false;
          const old = Object.fromEntries(Object.keys(patch).map((k) => [k, get().project.prices[k as keyof PriceBook]]));
          mutate((p) => Object.assign(p.prices, { isDemo: false }, patch));
          get().log("prices", get().project.prices.validFrom, "update", { oldValue: old, newValue: patch });
          return true;
        },
        updateTargets: (patch) => {
          if (!guard("editScope", "mengubah target", "change targets")) return false;
          mutate((p) => Object.assign(p.targets, patch));
          get().log("targets", "targets", "update", { newValue: patch });
          return true;
        },
        updateStageScores: (field, id, value) => {
          if (!guard(field === "laborHoursByStage" ? "editPrices" : "editScenario", "mengubah skor tahap", "change stage scores")) return false;
          mutate((p) => {
            p[field][id] = value;
          });
          get().log(field, id, "update", { newValue: value });
          return true;
        },

        upsertBackground: (ds) => {
          if (!entitled("expertMode", "Mengubah database pemetaan", "Changing the mapping database")) return false;
          if (!guard("editMethod", "mengubah dataset background", "change a background dataset")) return false;
          mutate((p) => {
            const idx = p.backgrounds.findIndex((b) => b.id === ds.id);
            if (idx >= 0) p.backgrounds[idx] = ds;
            else p.backgrounds.push(ds);
          });
          get().log("backgrounds", ds.id, "upsert", { newValue: ds });
          return true;
        },
        removeBackground: (id) => {
          if (!entitled("expertMode", "Mengubah database pemetaan", "Changing the mapping database")) return false;
          if (!guard("editMethod", "menghapus dataset background", "delete a background dataset")) return false;
          mutate((p) => {
            p.backgrounds = p.backgrounds.filter((b) => b.id !== id);
            for (const i of p.inputs) if (i.mapping.datasetId === id) i.mapping = { status: "unmapped" };
            for (const w of p.waste) if (w.mapping.datasetId === id) w.mapping = { status: "unmapped" };
          });
          get().log("backgrounds", id, "delete");
          return true;
        },
        upsertFlowCF: (flows, release) => {
          if (!entitled("expertMode", "Mengubah faktor karakterisasi", "Changing characterisation factors")) return false;
          if (!guard("editMethod", "mengubah faktor karakterisasi", "change characterisation factors")) return false;
          mutate((p) => {
            for (const f of flows) {
              const idx = p.method.flows.findIndex((x) => x.key === f.key);
              if (idx >= 0) p.method.flows[idx] = { ...p.method.flows[idx]!, ...f, factors: { ...p.method.flows[idx]!.factors, ...f.factors } };
              else p.method.flows.push(f);
            }
            if (release) p.method.release = release;
          });
          get().log("method", get().project.method.release, "update-cf", { newValue: flows.map((f) => f.key) });
          return true;
        },

        acceptWarning: (key, reason) => {
          if (!guard("acceptWarning", "menerima peringatan", "accept warnings")) return false;
          if (!reason.trim()) {
            get().notify("error", tx("Alasan wajib diisi untuk menerima peringatan.", "A reason is required to accept a warning."));
            return false;
          }
          mutate((p) => {
            p.dataset.acceptedWarnings[key] = reason.trim();
          });
          get().log("validation", key, "accept-warning", { reason });
          return true;
        },
        revokeWarning: (key) => {
          if (!guard("acceptWarning", "membatalkan penerimaan peringatan", "revoke an accepted warning")) return false;
          mutate((p) => {
            delete p.dataset.acceptedWarnings[key];
          });
          get().log("validation", key, "revoke-warning");
          return true;
        },
        approveDataset: () => {
          if (!guard("approveDataset", "approve dataset", "approve the dataset")) return false;
          const v = calculate(get().project).validation;
          if (!v.readyForApproval) {
            get().notify("error", tx("Belum bisa di-approve: perbaiki error dan terima setiap peringatan dengan alasan.", "Cannot be approved yet: fix the errors and accept every warning with a reason."));
            return false;
          }
          const { user } = get();
          const hash = datasetHash(get().project);
          mutate((p) => {
            p.dataset = { ...p.dataset, status: "approved", approvedBy: user.name, approvedAt: nowIso(), hash };
          });
          get().log("dataset", `v${get().project.dataset.version}`, "approve", { newValue: hash });
          get().notify("success", tx(`Dataset v${get().project.dataset.version} di-approve.`, `Dataset v${get().project.dataset.version} approved.`));
          return true;
        },
        reopenDataset: (reason) => {
          if (!guard("editData", "membuka versi dataset baru", "open a new dataset version")) return false;
          if (!reason.trim()) {
            get().notify("error", tx("Alasan wajib diisi.", "A reason is required."));
            return false;
          }
          mutate((p) => {
            p.dataset = { version: p.dataset.version + 1, status: "draft", acceptedWarnings: { ...p.dataset.acceptedWarnings } };
          });
          get().log("dataset", `v${get().project.dataset.version}`, "new-version", { reason });
          return true;
        },

        runCalculation: (kind, scenarioId) => {
          if (!guard(kind === "official" ? "officialRun" : "runCalc", kind === "official" ? "run resmi" : "run draf", kind === "official" ? "make an official run" : "make a draft run")) return null;
          const { project, user, runs } = get();
          const v = calculate(project).validation;
          if (v.errors > 0) {
            get().notify("error", tx(`Belum bisa dihitung: ada ${v.errors} kesalahan data. Buka Data Saya → Cek data.`, `Cannot calculate yet: there are ${v.errors} data error(s). Open My Data → Check data.`));
            return null;
          }
          if (kind === "official" && !v.readyForOfficialRun) {
            get().notify("error", tx("Hasil resmi butuh pengaturan studi dikunci, data disetujui, dan semua buangan punya faktor dampak.", "An official result needs locked study settings, approved data, and an impact factor for every item."));
            return null;
          }
          const scenario = scenarioId ? project.scenarios.find((s) => s.id === scenarioId) : undefined;
          const number = runs.reduce((m, r) => Math.max(m, Number(r.id.split("-").pop()) || 0), 0) + 1;
          const id = `R-${new Date().getFullYear()}-${String(number).padStart(3, "0")}`;
          const run = createRun(project, {
            id,
            label: `${id}${scenario ? ` · ${scenario.code}` : ""}${kind === "official" ? " (resmi)" : " (draf)"}`,
            kind,
            actor: user.name,
            now: nowIso(),
            scenarioId,
            levers: scenario?.levers,
          });
          // A saved simulation is kept for comparison; the screens stay on the data being worked on.
          set((s) => ({ runs: [run, ...s.runs].slice(0, MAX_RUNS), ui: scenarioId ? s.ui : { ...s.ui, activeRunId: id } }));
          get().log("run", id, "create", { newValue: { kind, resultHash: run.resultHash, datasetHash: run.manifest.datasetHash } });
          get().notify("success", tx(`Hasil #${id} tersimpan${kind === "official" ? " sebagai hasil resmi" : ""}.`, `Result #${id} saved${kind === "official" ? " as an official result" : ""}.`));
          return id;
        },
        deleteRun: (id) => {
          if (!guard("admin", "menghapus run", "delete a run")) return false;
          const run = get().runs.find((r) => r.id === id);
          if (run?.manifest.kind === "official") {
            get().notify("error", tx("Hasil resmi tidak dapat dihapus.", "An official result cannot be deleted."));
            return false;
          }
          set((s) => ({ runs: s.runs.filter((r) => r.id !== id), ui: { ...s.ui, activeRunId: s.ui.activeRunId === id ? null : s.ui.activeRunId } }));
          get().log("run", id, "delete");
          return true;
        },

        addScenario: () => {
          if (!entitled("editScenario", "Membuat simulasi perbaikan sendiri", "Creating your own improvement simulations")) return false;
          if (!guard("editScenario", "membuat skenario", "create a scenario")) return false;
          const list = get().project.scenarios;
          const max = planLimits(get().subscription).scenarios;
          if (list.length >= max) {
            get().notify("error", tx(`Paket ini menampung ${max} simulasi perbaikan. Hapus satu atau pilih paket Profesional.`, `This plan holds ${max} improvement simulations. Delete one or choose the Professional plan.`));
            return false;
          }
          const used = new Set(list.map((s) => s.code));
          const code = Array.from({ length: max }, (_, i) => `S${i + 1}`).find((c) => !used.has(c)) ?? `S${list.length + 1}`;
          const sc: Scenario = { id: newId("sc"), code, name: tx("Skenario baru", "New scenario"), description: "", levers: {}, capexRp: 0, extraOpexRpPerPeriod: 0, lifetimeYears: 5, status: "draft" };
          mutate((p) => p.scenarios.push(sc));
          get().log("scenario", sc.id, "create");
          return true;
        },
        createScenarioFrom: (name, levers, description = "") => {
          if (!entitled("editScenario", "Membuat simulasi perbaikan sendiri", "Creating your own improvement simulations")) return null;
          const list = get().project.scenarios;
          if (list.length >= planLimits(get().subscription).scenarios) {
            // Slots full: reuse the most recent scenario that is not approved.
            const target = [...list].reverse().find((s) => s.status !== "approved");
            if (!target) {
              get().notify("error", tx("Semua slot S1–S3 sudah disetujui; hapus satu skenario dulu.", "All S1–S3 slots are approved; delete a scenario first."));
              return null;
            }
            if (!get().updateScenario(target.id, { name, levers, description })) return null;
            get().notify("info", tx(`${target.code} diganti dengan "${name}".`, `${target.code} replaced with "${name}".`));
            return target.id;
          }
          if (!get().addScenario()) return null;
          const created = get().project.scenarios[get().project.scenarios.length - 1];
          if (!created) return null;
          get().updateScenario(created.id, { name, levers, description });
          return created.id;
        },
        updateScenario: (id, patch) => {
          if (!entitled("editScenario", "Mengubah simulasi perbaikan", "Changing improvement simulations") || !guard("editScenario", "mengubah skenario", "change a scenario")) return false;
          mutate((p) => {
            const sc = p.scenarios.find((s) => s.id === id);
            if (sc) Object.assign(sc, patch, patch.levers || patch.capexRp !== undefined ? { status: "draft", approvedBy: undefined, approvedAt: undefined } : {});
          });
          get().log("scenario", id, "update", { newValue: patch });
          return true;
        },
        setLevers: (id, levers) => get().updateScenario(id, { levers }),
        removeScenario: (id) => {
          if (!entitled("editScenario", "Mengubah simulasi perbaikan", "Changing improvement simulations") || !guard("editScenario", "menghapus skenario", "delete a scenario")) return false;
          mutate((p) => {
            p.scenarios = p.scenarios.filter((s) => s.id !== id);
          });
          get().log("scenario", id, "delete");
          return true;
        },
        markRecommended: (id) => {
          if (!entitled("editScenario", "Mengubah simulasi perbaikan", "Changing improvement simulations") || !guard("editScenario", "menandai rekomendasi", "mark a recommendation")) return false;
          mutate((p) => {
            for (const s of p.scenarios) {
              if (s.id === id) s.status = s.status === "approved" ? "approved" : "recommended";
              else if (s.status === "recommended") s.status = "draft";
            }
          });
          get().log("scenario", id, "recommend");
          return true;
        },
        approveScenario: (id) => {
          if (!guard("approveScenario", "approve skenario", "approve a scenario")) return false;
          const { user } = get();
          mutate((p) => {
            const sc = p.scenarios.find((s) => s.id === id);
            if (sc) Object.assign(sc, { status: "approved", approvedBy: user.name, approvedAt: nowIso() });
          });
          get().log("scenario", id, "approve");
          get().notify("success", tx("Skenario disetujui.", "Scenario approved."));
          return true;
        },
      };
    },
    {
      name: "aerosphere-lca-v2",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        project: s.project,
        runs: s.runs,
        events: s.events,
        user: s.user,
        account: s.account,
        registered: s.registered,
        subscription: s.subscription,
        onboardingDone: s.onboardingDone,
        nextSteps: s.nextSteps,
        importBackups: s.importBackups,
        reportEdits: s.reportEdits,
        ui: { ...s.ui, copilotOpen: false },
      }),
      /** Corrupt or older state never crashes the app: fall back to the demo project. */
      migrate: (persisted) => {
        const state = persisted as Partial<State> | undefined;
        const parsed = parseProject(state?.project);
        return { ...(state ?? {}), project: parsed.ok ? parsed.project : hardChromeDemo(), runs: Array.isArray(state?.runs) ? state!.runs : [] } as State;
      },
      merge: (persisted, current) => {
        const state = persisted as Partial<State> | undefined;
        const parsed = parseProject(state?.project);
        return {
          ...current,
          ...(state ?? {}),
          project: parsed.ok ? parsed.project : current.project,
          ui: { ...current.ui, ...(state?.ui ?? {}) },
          reportEdits: state?.reportEdits && typeof state.reportEdits === "object" ? state.reportEdits : {},
          notices: [],
        };
      },
    },
  ),
);
