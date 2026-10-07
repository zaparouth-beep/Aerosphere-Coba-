"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { can, type Permission } from "@/lib/domain/permissions";
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
import { DEFAULT_WEIGHTS, type HotspotWeights } from "@/lib/engine/hotspot";
import { appendEvent, createRun, datasetHash, type Run } from "@/lib/engine/run";

export const MAX_RUNS = 20;
export const MAX_SCENARIOS = 3;

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
  hotspotThreshold: number;
  copilotOpen: boolean;
  insightDecisions: Record<string, "accepted" | "rejected">;
  onboarded: boolean;
}

type ListKey = "inputs" | "airEmissions" | "effluent" | "waste";
type ListItem<K extends ListKey> = Project[K][number];

interface State {
  project: Project;
  runs: Run[];
  events: AuditEvent[];
  user: { name: string; role: Role };
  ui: Ui;
  notices: Notice[];

  notify: (tone: Notice["tone"], text: string) => void;
  dismissNotice: (id: string) => void;
  setUser: (name: string, role: Role) => void;
  setUi: (patch: Partial<Ui>) => void;

  loadTemplate: (templateId: string) => boolean;
  importProject: (raw: unknown) => boolean;
  updateProjectMeta: (patch: Partial<Pick<Project, "name" | "facility" | "client" | "periodLabel" | "periodMonths" | "partName" | "substrate" | "coatingType">>) => boolean;

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
  applyDatasetPatch: (patch: Pick<Project, "inputs" | "airEmissions" | "effluent" | "waste" | "production">, source: string) => boolean;
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

export const useAppStore = create<State>()(
  persist(
    (set, get) => {
      /** Permission gate: denied attempts are logged (AC-08). */
      const guard = (permission: Permission, what: string): boolean => {
        const { user } = get();
        if (can(user.role, permission)) return true;
        get().log("access", permission, "denied", { reason: `${user.role} mencoba: ${what}` });
        get().notify("error", `Peran ${user.role} tidak berhak: ${what}.`);
        return false;
      };
      /** Approved datasets are immutable; a new version must be opened first (AC-04). */
      const editableData = (what: string): boolean => {
        if (!guard("editData", what)) return false;
        if (get().project.dataset.status === "approved") {
          get().notify("error", "Dataset sudah di-approve. Buka versi baru (dengan alasan) sebelum mengubah data.");
          return false;
        }
        return true;
      };
      const scopeEditable = (): boolean => {
        if (!guard("editScope", "mengubah Goal & Scope")) return false;
        if (get().project.scope.lockedAt) {
          get().notify("error", `Scope v${get().project.scope.version} terkunci. Buat versi baru untuk mengubahnya.`);
          return false;
        }
        return true;
      };
      const mutate = (fn: (p: Project) => void) =>
        set((s) => {
          const project = structuredClone(s.project);
          fn(project);
          return { project };
        });

      return {
        project: hardChromeDemo(),
        runs: [],
        events: [],
        user: { name: "Pengguna demo", role: "Admin" },
        ui: {
          activeRunId: null,
          compareScenarioId: null,
          fuView: "perFu",
          hotspotWeights: DEFAULT_WEIGHTS,
          hotspotThreshold: 30,
          copilotOpen: false,
          insightDecisions: {},
          onboarded: false,
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

        loadTemplate: (templateId) => {
          const role = get().user.role;
          if (!can(role, "admin") && !can(role, "editScope") && !guard("editData", "membuat proyek dari template")) return false;
          const tpl = TEMPLATES.find((t) => t.id === templateId);
          if (!tpl) return false;
          const project = tpl.build();
          set((s) => ({ project, ui: { ...s.ui, activeRunId: null, compareScenarioId: null } }));
          get().log("project", project.id, "create-from-template", { newValue: tpl.label });
          get().notify("success", `Proyek dibuat dari template "${tpl.label}".`);
          return true;
        },

        importProject: (raw) => {
          if (!guard("admin", "mengimpor proyek")) return false;
          const parsed = parseProject(raw);
          if (!parsed.ok) {
            get().notify("error", `Impor ditolak — ${parsed.error}`);
            return false;
          }
          set((s) => ({ project: parsed.project, ui: { ...s.ui, activeRunId: null } }));
          get().log("project", parsed.project.id, "import", { newValue: parsed.project.name });
          get().notify("success", "Proyek berhasil diimpor.");
          return true;
        },

        updateProjectMeta: (patch) => {
          if (!guard("editScope", "mengubah metadata proyek")) return false;
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
          if (!scopeEditable()) return false;
          const { user } = get();
          mutate((p) => {
            p.scope.lockedAt = nowIso();
            p.scope.lockedBy = user.name;
          });
          get().log("scope", `v${get().project.scope.version}`, "lock");
          get().notify("success", `Scope v${get().project.scope.version} dikunci.`);
          return true;
        },
        newScopeVersion: (reason) => {
          if (!guard("editScope", "membuat versi scope baru")) return false;
          if (!reason.trim()) {
            get().notify("error", "Alasan wajib diisi.");
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
          if (!editableData("mengubah data")) return false;
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
          if (!editableData("menambah input")) return false;
          const unit = category === "Energy" ? "kWh" : category === "Water" ? "L" : "kg";
          const p0 = get().project;
          const item: InputFlow = {
            id: newId("in"),
            no: p0.inputs.reduce((m, i) => Math.max(m, i.no), 0) + 1,
            category,
            name: "Input baru",
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
          if (!editableData("menambah emisi")) return false;
          const item: AirEmission = { id: newId("air"), parameter: "Emisi baru", relevance: "", applicable: true, stageId: "C", quantityKg: 0, basis: "period", meta: meta("measured") };
          mutate((p) => p.airEmissions.push(item));
          get().log("airEmissions", item.id, "create", { newValue: item });
          return true;
        },
        addEffluent: () => {
          if (!editableData("menambah parameter efluen")) return false;
          const item: EffluentParam = { id: newId("eff"), parameter: "Parameter baru", unit: "mg/L", value: 0 };
          mutate((p) => p.effluent.push(item));
          get().log("effluent", item.id, "create", { newValue: item });
          return true;
        },
        addWaste: () => {
          if (!editableData("menambah limbah")) return false;
          const item: HazardousWaste = {
            id: newId("waste"),
            wasteType: "Limbah B3 baru",
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
          if (!editableData("menghapus data")) return false;
          const old = (get().project[key] as Array<{ id: string }>).find((i) => i.id === id);
          mutate((p) => {
            (p[key] as Array<{ id: string }>) = (p[key] as Array<{ id: string }>).filter((i) => i.id !== id);
          });
          get().log(key, id, "delete", { oldValue: old });
          return true;
        },
        updateProduction: (patch) => {
          if (!editableData("mengubah data produksi")) return false;
          const old = Object.fromEntries(Object.keys(patch).map((k) => [k, get().project.production[k as keyof Production]]));
          mutate((p) => Object.assign(p.production, patch));
          get().log("production", "production", "update", { oldValue: old, newValue: patch });
          return true;
        },
        applyDatasetPatch: (patch, source) => {
          if (!editableData("mengimpor data")) return false;
          const before = { inputs: get().project.inputs.length, waste: get().project.waste.length };
          mutate((p) => Object.assign(p, structuredClone(patch)));
          get().log("dataset", `v${get().project.dataset.version}`, "import", { oldValue: before, newValue: { source, inputs: patch.inputs.length, waste: patch.waste.length } });
          return true;
        },
        updatePrices: (patch) => {
          if (!guard("editPrices", "mengubah harga satuan")) return false;
          const old = Object.fromEntries(Object.keys(patch).map((k) => [k, get().project.prices[k as keyof PriceBook]]));
          mutate((p) => Object.assign(p.prices, { isDemo: false }, patch));
          get().log("prices", get().project.prices.validFrom, "update", { oldValue: old, newValue: patch });
          return true;
        },
        updateTargets: (patch) => {
          if (!guard("editScope", "mengubah target")) return false;
          mutate((p) => Object.assign(p.targets, patch));
          get().log("targets", "targets", "update", { newValue: patch });
          return true;
        },
        updateStageScores: (field, id, value) => {
          if (!guard(field === "laborHoursByStage" ? "editPrices" : "editScenario", "mengubah skor tahap")) return false;
          mutate((p) => {
            p[field][id] = value;
          });
          get().log(field, id, "update", { newValue: value });
          return true;
        },

        upsertBackground: (ds) => {
          if (!guard("editMethod", "mengubah dataset background")) return false;
          mutate((p) => {
            const idx = p.backgrounds.findIndex((b) => b.id === ds.id);
            if (idx >= 0) p.backgrounds[idx] = ds;
            else p.backgrounds.push(ds);
          });
          get().log("backgrounds", ds.id, "upsert", { newValue: ds });
          return true;
        },
        removeBackground: (id) => {
          if (!guard("editMethod", "menghapus dataset background")) return false;
          mutate((p) => {
            p.backgrounds = p.backgrounds.filter((b) => b.id !== id);
            for (const i of p.inputs) if (i.mapping.datasetId === id) i.mapping = { status: "unmapped" };
            for (const w of p.waste) if (w.mapping.datasetId === id) w.mapping = { status: "unmapped" };
          });
          get().log("backgrounds", id, "delete");
          return true;
        },
        upsertFlowCF: (flows, release) => {
          if (!guard("editMethod", "mengubah faktor karakterisasi")) return false;
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
          if (!guard("acceptWarning", "menerima peringatan")) return false;
          if (!reason.trim()) {
            get().notify("error", "Alasan wajib diisi untuk menerima peringatan.");
            return false;
          }
          mutate((p) => {
            p.dataset.acceptedWarnings[key] = reason.trim();
          });
          get().log("validation", key, "accept-warning", { reason });
          return true;
        },
        revokeWarning: (key) => {
          if (!guard("acceptWarning", "membatalkan penerimaan peringatan")) return false;
          mutate((p) => {
            delete p.dataset.acceptedWarnings[key];
          });
          get().log("validation", key, "revoke-warning");
          return true;
        },
        approveDataset: () => {
          if (!guard("approveDataset", "approve dataset")) return false;
          const v = calculate(get().project).validation;
          if (!v.readyForApproval) {
            get().notify("error", "Belum bisa di-approve: perbaiki error dan terima setiap peringatan dengan alasan.");
            return false;
          }
          const { user } = get();
          const hash = datasetHash(get().project);
          mutate((p) => {
            p.dataset = { ...p.dataset, status: "approved", approvedBy: user.name, approvedAt: nowIso(), hash };
          });
          get().log("dataset", `v${get().project.dataset.version}`, "approve", { newValue: hash });
          get().notify("success", `Dataset v${get().project.dataset.version} di-approve.`);
          return true;
        },
        reopenDataset: (reason) => {
          if (!guard("editData", "membuka versi dataset baru")) return false;
          if (!reason.trim()) {
            get().notify("error", "Alasan wajib diisi.");
            return false;
          }
          mutate((p) => {
            p.dataset = { version: p.dataset.version + 1, status: "draft", acceptedWarnings: { ...p.dataset.acceptedWarnings } };
          });
          get().log("dataset", `v${get().project.dataset.version}`, "new-version", { reason });
          return true;
        },

        runCalculation: (kind, scenarioId) => {
          if (!guard(kind === "official" ? "officialRun" : "runCalc", kind === "official" ? "run resmi" : "run draf")) return null;
          const { project, user, runs } = get();
          const v = calculate(project).validation;
          if (v.errors > 0) {
            get().notify("error", `Run diblokir: ${v.errors} error validasi.`);
            return null;
          }
          if (kind === "official" && !v.readyForOfficialRun) {
            get().notify("error", "Run resmi butuh scope terkunci, dataset approved, dan semua aliran sudah dipetakan.");
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
          set((s) => ({ runs: [run, ...s.runs].slice(0, MAX_RUNS), ui: { ...s.ui, activeRunId: id } }));
          get().log("run", id, "create", { newValue: { kind, resultHash: run.resultHash, datasetHash: run.manifest.datasetHash } });
          get().notify("success", `Run ${id} dikunci (${kind === "official" ? "resmi" : "draf"}).`);
          return id;
        },
        deleteRun: (id) => {
          if (!guard("admin", "menghapus run")) return false;
          const run = get().runs.find((r) => r.id === id);
          if (run?.manifest.kind === "official") {
            get().notify("error", "Run resmi tidak dapat dihapus.");
            return false;
          }
          set((s) => ({ runs: s.runs.filter((r) => r.id !== id), ui: { ...s.ui, activeRunId: s.ui.activeRunId === id ? null : s.ui.activeRunId } }));
          get().log("run", id, "delete");
          return true;
        },

        addScenario: () => {
          if (!guard("editScenario", "membuat skenario")) return false;
          const list = get().project.scenarios;
          if (list.length >= MAX_SCENARIOS) {
            get().notify("error", `Maksimal ${MAX_SCENARIOS} skenario (S1–S3) dibandingkan dengan baseline S0.`);
            return false;
          }
          const used = new Set(list.map((s) => s.code));
          const code = ["S1", "S2", "S3"].find((c) => !used.has(c)) ?? `S${list.length + 1}`;
          const sc: Scenario = { id: newId("sc"), code, name: "Skenario baru", description: "", levers: {}, capexRp: 0, extraOpexRpPerPeriod: 0, lifetimeYears: 5, status: "draft" };
          mutate((p) => p.scenarios.push(sc));
          get().log("scenario", sc.id, "create");
          return true;
        },
        createScenarioFrom: (name, levers, description = "") => {
          const list = get().project.scenarios;
          if (list.length >= MAX_SCENARIOS) {
            // Slots full: reuse the most recent scenario that is not approved.
            const target = [...list].reverse().find((s) => s.status !== "approved");
            if (!target) {
              get().notify("error", "Semua slot S1–S3 sudah disetujui; hapus satu skenario dulu.");
              return null;
            }
            if (!get().updateScenario(target.id, { name, levers, description })) return null;
            get().notify("info", `${target.code} diganti dengan "${name}".`);
            return target.id;
          }
          if (!get().addScenario()) return null;
          const created = get().project.scenarios[get().project.scenarios.length - 1];
          if (!created) return null;
          get().updateScenario(created.id, { name, levers, description });
          return created.id;
        },
        updateScenario: (id, patch) => {
          if (!guard("editScenario", "mengubah skenario")) return false;
          mutate((p) => {
            const sc = p.scenarios.find((s) => s.id === id);
            if (sc) Object.assign(sc, patch, patch.levers || patch.capexRp !== undefined ? { status: "draft", approvedBy: undefined, approvedAt: undefined } : {});
          });
          get().log("scenario", id, "update", { newValue: patch });
          return true;
        },
        setLevers: (id, levers) => get().updateScenario(id, { levers }),
        removeScenario: (id) => {
          if (!guard("editScenario", "menghapus skenario")) return false;
          mutate((p) => {
            p.scenarios = p.scenarios.filter((s) => s.id !== id);
          });
          get().log("scenario", id, "delete");
          return true;
        },
        markRecommended: (id) => {
          if (!guard("editScenario", "menandai rekomendasi")) return false;
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
          if (!guard("approveScenario", "approve skenario")) return false;
          const { user } = get();
          mutate((p) => {
            const sc = p.scenarios.find((s) => s.id === id);
            if (sc) Object.assign(sc, { status: "approved", approvedBy: user.name, approvedAt: nowIso() });
          });
          get().log("scenario", id, "approve");
          get().notify("success", "Skenario disetujui.");
          return true;
        },
      };
    },
    {
      name: "aerosphere-lca-v2",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ project: s.project, runs: s.runs, events: s.events, user: s.user, ui: { ...s.ui, copilotOpen: false } }),
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
          notices: [],
        };
      },
    },
  ),
);
