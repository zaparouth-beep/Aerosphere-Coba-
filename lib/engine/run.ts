import type { AuditEvent, LeverSettings, Project, Role } from "@/lib/domain/types";
import { calculate, ENGINE_VERSION, type Results } from "./calculate";
import { hashOf } from "./hash";
import { applyScenario } from "./scenario";

/** Inputs that define a run; everything else on the project is presentation. */
export function datasetPayload(project: Project) {
  return {
    stages: project.stages,
    inputs: project.inputs,
    airEmissions: project.airEmissions,
    effluent: project.effluent,
    waste: project.waste,
    production: project.production,
    prices: project.prices,
    periodMonths: project.periodMonths,
  };
}

export function datasetHash(project: Project): string {
  return hashOf(datasetPayload(project));
}

export interface RunManifest {
  runId: string;
  projectId: string;
  kind: "draft" | "official";
  scopeVersion: number;
  scopeLocked: boolean;
  datasetVersion: number;
  datasetStatus: string;
  datasetHash: string;
  methodRelease: string;
  backgroundHash: string;
  engineVersion: string;
  scenarioId?: string;
  leverSet?: LeverSettings;
  createdBy: string;
  createdAt: string;
}

export interface Run {
  id: string;
  label: string;
  manifest: RunManifest;
  snapshot: Project;
  results: Results;
  resultHash: string;
}

/** Locks a run: snapshot of all inputs + results + hashes (PRD 2.4). */
export function createRun(
  project: Project,
  opts: { id: string; label: string; kind: "draft" | "official"; actor: string; now: string; scenarioId?: string; levers?: LeverSettings },
): Run {
  const snapshot = structuredClone(project);
  const effective = opts.levers ? applyScenario(snapshot, opts.levers).project : snapshot;
  const results = calculate(effective);
  return {
    id: opts.id,
    label: opts.label,
    manifest: {
      runId: opts.id,
      projectId: project.id,
      kind: opts.kind,
      scopeVersion: project.scope.version,
      scopeLocked: !!project.scope.lockedAt,
      datasetVersion: project.dataset.version,
      datasetStatus: project.dataset.status,
      datasetHash: datasetHash(project),
      methodRelease: project.method.release,
      backgroundHash: hashOf(project.backgrounds),
      engineVersion: ENGINE_VERSION,
      scenarioId: opts.scenarioId,
      leverSet: opts.levers,
      createdBy: opts.actor,
      createdAt: opts.now,
    },
    snapshot,
    results,
    resultHash: hashOf(results),
  };
}

/** "Re-run from manifest" (AC-03): recompute from the frozen snapshot and compare. */
export function rerunCheck(run: Run): { ok: boolean; hash: string } {
  const effective = run.manifest.leverSet ? applyScenario(run.snapshot, run.manifest.leverSet).project : run.snapshot;
  const hash = hashOf(calculate(effective));
  return { ok: hash === run.resultHash, hash };
}

/* ------------------------------- Audit log ------------------------------- */

export const GENESIS_HASH = "0".repeat(64);

export function appendEvent(
  log: AuditEvent[],
  e: { actor: string; role: Role; entity: string; entityId: string; action: string; oldValue?: unknown; newValue?: unknown; reason?: string; ts: string },
): AuditEvent[] {
  const prev = log[log.length - 1];
  const body = { seq: (prev?.seq ?? 0) + 1, ...e, prevHash: prev?.hash ?? GENESIS_HASH };
  return [...log, { ...body, hash: hashOf(body) }];
}

/** Returns the seq of the first event whose hash or link does not match, or null. */
export function verifyChain(log: AuditEvent[]): number | null {
  let prevHash = GENESIS_HASH;
  for (const e of log) {
    const { hash, ...body } = e;
    if (e.prevHash !== prevHash || hashOf(body) !== hash) return e.seq;
    prevHash = hash;
  }
  return null;
}
