import { z } from "zod";
import type { Project } from "./types";

/** Runtime validation for anything that enters from outside (imported JSON, localStorage). */

const stageId = z.enum(["A", "B", "C", "D", "E", "F"]);
const basis = z.enum(["period", "month", "batch"]);
const finite = z.number().finite();
const pedigree = z.object({
  reliability: z.number().min(1).max(5),
  completeness: z.number().min(1).max(5),
  temporal: z.number().min(1).max(5),
  geographical: z.number().min(1).max(5),
  technological: z.number().min(1).max(5),
});
const metaSchema = z.object({
  sourceType: z.enum(["measured", "calculated", "supplier", "database", "literature"]),
  source: z.string(),
  method: z.string(),
  uncertaintyPct: finite.min(0),
  pedigree,
  note: z.string().optional(),
});
const mapping = z.object({
  status: z.enum(["exact", "proxy", "stoich", "unmapped"]),
  datasetId: z.string().optional(),
  rationale: z.string().optional(),
});
const factors = z.record(z.string(), finite);

const projectSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string(),
  name: z.string().max(200),
  facility: z.string(),
  client: z.string(),
  periodLabel: z.string(),
  periodMonths: finite.positive(),
  template: z.string(),
  partName: z.string(),
  substrate: z.string(),
  coatingType: z.string(),
  scope: z.object({
    version: z.number().int().positive(),
    lockedAt: z.string().optional(),
    lockedBy: z.string().optional(),
    goal: z.string(),
    intendedAudience: z.string(),
    fuType: z.enum(["m2", "part", "kg"]),
    boundary: z.enum(["gate-to-gate", "gate-to-gate+upstream", "cradle-to-gate"]),
    cutoffPct: finite.min(0),
    allocation: z.enum(["m2", "mass", "hours"]),
    backgroundDb: z.string(),
    assumptions: z.array(z.string()),
  }),
  scopeHistory: z.array(z.any()),
  stages: z.array(z.object({ id: stageId, name: z.string(), functionDesc: z.string(), subprocesses: z.array(z.string()), inBoundary: z.boolean() })).length(6),
  inputs: z.array(
    z.object({
      id: z.string(),
      no: z.number(),
      category: z.enum(["Chemical", "Anode", "Water", "Energy", "WWTPChemical", "Consumable"]),
      name: z.string(),
      stageId,
      quantity: finite,
      unit: z.string(),
      basis,
      meta: metaSchema,
      unitPriceRp: finite.optional(),
      mapping,
    }),
  ),
  airEmissions: z.array(
    z.object({ id: z.string(), parameter: z.string(), relevance: z.string(), applicable: z.boolean(), stageId, quantityKg: finite, basis, flowKey: z.string().optional(), meta: metaSchema }),
  ),
  effluent: z.array(z.object({ id: z.string(), parameter: z.string(), unit: z.string(), value: finite, flowKey: z.string().optional(), limit: finite.optional() })),
  waste: z.array(
    z.object({
      id: z.string(),
      wasteType: z.string(),
      stageId,
      quantityKg: finite,
      basis,
      moisturePct: finite,
      metalContentPct: finite,
      treatment: z.string(),
      destination: z.string(),
      transportKm: finite,
      recovery: z.boolean(),
      meta: metaSchema,
      mapping,
    }),
  ),
  production: z.object({
    areaM2: finite,
    parts: finite,
    componentMassKg: finite,
    batches: finite,
    reworkPct: finite,
    coatingMetal: z.string(),
    coatingThicknessUm: finite,
    coatingDensityKgM3: finite,
    effluentVolumeM3: finite,
    waterEvaporatedM3: finite,
    compressorKwhPerNm3: finite.optional(),
  }),
  prices: z.object({
    validFrom: z.string(),
    isDemo: z.boolean(),
    energyRpPerKwh: finite,
    waterRpPerL: finite,
    chemicalRpPerKg: finite,
    wwtpChemicalRpPerKg: finite,
    consumableRpPerKg: finite,
    wasteTreatmentRpPerKg: finite,
    wasteTransportRpPerKm: finite,
    wasteTripsPerPeriod: finite,
    laborRpPerPeriod: finite,
    depreciationRpPerPeriod: finite,
    carbonPriceRpPerKgCO2e: finite,
  }),
  backgrounds: z.array(
    z.object({ id: z.string(), name: z.string(), provider: z.string(), version: z.string(), geography: z.string(), refUnit: z.enum(["kg", "L", "kWh"]), factors, licenseScope: z.string(), importedAt: z.string() }),
  ),
  method: z.object({
    release: z.string(),
    primary: z.literal("EF 3.1"),
    secondary: z.literal("ReCiPe 2016 Midpoint (H)").optional(),
    flows: z.array(z.object({ key: z.string(), label: z.string(), compartment: z.enum(["air", "water"]), factors, source: z.string() })),
  }),
  scenarios: z.array(z.any()),
  targets: z.object({ baselineLabel: z.string(), gwpReductionPct: finite, wasteReductionPct: finite, waterReductionPct: finite, targetYear: finite, discountRatePct: finite }),
  stageEase: z.record(stageId, finite),
  stageComplianceRisk: z.record(stageId, finite),
  laborHoursByStage: z.record(stageId, finite),
  dataset: z.object({
    version: z.number(),
    status: z.enum(["draft", "approved"]),
    approvedBy: z.string().optional(),
    approvedAt: z.string().optional(),
    hash: z.string().optional(),
    acceptedWarnings: z.record(z.string(), z.string()),
  }),
});

export function parseProject(value: unknown): { ok: true; project: Project } | { ok: false; error: string } {
  const result = projectSchema.safeParse(value);
  if (result.success) return { ok: true, project: result.data as Project };
  const first = result.error.issues[0];
  return { ok: false, error: first ? `${first.path.join(".")}: ${first.message}` : "Format proyek tidak valid" };
}
