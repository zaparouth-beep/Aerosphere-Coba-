"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSeedProject, generateId } from "@/lib/lca/constants";
import type {
  AirEmissionEntry,
  CostConfig,
  FunctionalUnit,
  HazardousWasteEntry,
  LCIInputEntry,
  PartInfo,
  Project,
  WaterEffluentEntry,
} from "@/lib/lca/types";

interface ProjectState {
  project: Project;
  activeLeverIds: string[];

  updateProjectMeta: (patch: Partial<Pick<Project, "name" | "facility" | "client" | "period">>) => void;
  updatePart: (patch: Partial<PartInfo>) => void;
  updateFunctionalUnit: (patch: Partial<FunctionalUnit>) => void;
  updateCostConfig: (patch: Partial<CostConfig>) => void;

  updateLCIInput: (id: string, patch: Partial<LCIInputEntry>) => void;
  addLCIInput: (entry: Omit<LCIInputEntry, "id">) => void;
  removeLCIInput: (id: string) => void;

  updateAirEmission: (id: string, patch: Partial<AirEmissionEntry>) => void;
  addAirEmission: (entry: Omit<AirEmissionEntry, "id">) => void;
  removeAirEmission: (id: string) => void;

  updateWaterEffluent: (id: string, patch: Partial<WaterEffluentEntry>) => void;
  addWaterEffluent: (entry: Omit<WaterEffluentEntry, "id">) => void;
  removeWaterEffluent: (id: string) => void;

  updateHazardousWaste: (id: string, patch: Partial<HazardousWasteEntry>) => void;
  addHazardousWaste: (entry: Omit<HazardousWasteEntry, "id">) => void;
  removeHazardousWaste: (id: string) => void;

  toggleLever: (id: string) => void;
  updateLeverReductionPct: (id: string, pct: number) => void;

  resetProject: () => void;
  replaceProject: (project: Project) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      project: createSeedProject(),
      activeLeverIds: [],

      updateProjectMeta: (patch) =>
        set((state) => ({ project: { ...state.project, ...patch } })),

      updatePart: (patch) =>
        set((state) => ({
          project: { ...state.project, part: { ...state.project.part, ...patch } },
        })),

      updateFunctionalUnit: (patch) =>
        set((state) => ({
          project: {
            ...state.project,
            functionalUnit: { ...state.project.functionalUnit, ...patch },
          },
        })),

      updateCostConfig: (patch) =>
        set((state) => ({
          project: {
            ...state.project,
            costConfig: { ...state.project.costConfig, ...patch },
          },
        })),

      updateLCIInput: (id, patch) =>
        set((state) => ({
          project: {
            ...state.project,
            lciInputs: state.project.lciInputs.map((entry) =>
              entry.id === id ? { ...entry, ...patch } : entry,
            ),
          },
        })),

      addLCIInput: (entry) =>
        set((state) => ({
          project: {
            ...state.project,
            lciInputs: [...state.project.lciInputs, { ...entry, id: generateId("lci") }],
          },
        })),

      removeLCIInput: (id) =>
        set((state) => ({
          project: {
            ...state.project,
            lciInputs: state.project.lciInputs.filter((entry) => entry.id !== id),
          },
        })),

      updateAirEmission: (id, patch) =>
        set((state) => ({
          project: {
            ...state.project,
            airEmissions: state.project.airEmissions.map((entry) =>
              entry.id === id ? { ...entry, ...patch } : entry,
            ),
          },
        })),

      addAirEmission: (entry) =>
        set((state) => ({
          project: {
            ...state.project,
            airEmissions: [...state.project.airEmissions, { ...entry, id: generateId("air") }],
          },
        })),

      removeAirEmission: (id) =>
        set((state) => ({
          project: {
            ...state.project,
            airEmissions: state.project.airEmissions.filter((entry) => entry.id !== id),
          },
        })),

      addWaterEffluent: (entry) =>
        set((state) => ({
          project: {
            ...state.project,
            waterEffluent: [...state.project.waterEffluent, { ...entry, id: generateId("water") }],
          },
        })),

      removeWaterEffluent: (id) =>
        set((state) => ({
          project: {
            ...state.project,
            waterEffluent: state.project.waterEffluent.filter((entry) => entry.id !== id),
          },
        })),

      updateWaterEffluent: (id, patch) =>
        set((state) => ({
          project: {
            ...state.project,
            waterEffluent: state.project.waterEffluent.map((entry) =>
              entry.id === id ? { ...entry, ...patch } : entry,
            ),
          },
        })),

      updateHazardousWaste: (id, patch) =>
        set((state) => ({
          project: {
            ...state.project,
            hazardousWaste: state.project.hazardousWaste.map((entry) =>
              entry.id === id ? { ...entry, ...patch } : entry,
            ),
          },
        })),

      addHazardousWaste: (entry) =>
        set((state) => ({
          project: {
            ...state.project,
            hazardousWaste: [
              ...state.project.hazardousWaste,
              { ...entry, id: generateId("waste") },
            ],
          },
        })),

      removeHazardousWaste: (id) =>
        set((state) => ({
          project: {
            ...state.project,
            hazardousWaste: state.project.hazardousWaste.filter((entry) => entry.id !== id),
          },
        })),

      toggleLever: (id) =>
        set((state) => ({
          activeLeverIds: state.activeLeverIds.includes(id)
            ? state.activeLeverIds.filter((l) => l !== id)
            : [...state.activeLeverIds, id],
        })),

      updateLeverReductionPct: (id, pct) =>
        set((state) => ({
          project: {
            ...state.project,
            whatIfLevers: state.project.whatIfLevers.map((lever) =>
              lever.id === id ? { ...lever, reductionPct: pct } : lever,
            ),
          },
        })),

      resetProject: () => set({ project: createSeedProject(), activeLeverIds: [] }),

      replaceProject: (project) => set({ project, activeLeverIds: [] }),
    }),
    {
      name: "aerosphere-lca-project",
    },
  ),
);
