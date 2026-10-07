import type { Role } from "./types";

export type Permission =
  | "editData"
  | "editPrices"
  | "editScope"
  | "editMethod"
  | "acceptWarning"
  | "approveDataset"
  | "runCalc"
  | "officialRun"
  | "editScenario"
  | "approveScenario"
  | "generateReport"
  | "admin";

/** Default role bindings (FR-13.1, PRD 0.4). */
const MATRIX: Record<Role, Permission[]> = {
  Admin: ["editData", "editPrices", "editScope", "editMethod", "acceptWarning", "approveDataset", "runCalc", "officialRun", "editScenario", "approveScenario", "generateReport", "admin"],
  DataSteward: ["editData", "editPrices", "acceptWarning", "approveDataset", "runCalc", "officialRun", "generateReport"],
  Engineer: ["editData", "runCalc", "editScenario", "generateReport"],
  Analyst: ["editScope", "editMethod", "editPrices", "runCalc", "officialRun", "editScenario", "generateReport"],
  Executive: ["approveScenario", "generateReport"],
  Auditor: [],
};

export const ROLE_LABEL: Record<Role, string> = {
  Admin: "Admin platform",
  DataSteward: "EHS / Data Steward",
  Engineer: "Process Engineer",
  Analyst: "ESG Analyst",
  Executive: "Executive Viewer",
  Auditor: "Auditor (read-only)",
};

export const PERMISSION_LABEL: Record<Permission, string> = {
  editData: "Ubah data proses",
  editPrices: "Ubah harga satuan",
  editScope: "Ubah Goal & Scope",
  editMethod: "Ubah metode & database",
  acceptWarning: "Terima peringatan",
  approveDataset: "Approve dataset",
  runCalc: "Jalankan run draf",
  officialRun: "Jalankan run resmi",
  editScenario: "Buat/ubah skenario",
  approveScenario: "Approve skenario",
  generateReport: "Buat laporan",
  admin: "Kelola akses & data",
};

export const ROLES = Object.keys(MATRIX) as Role[];
export const PERMISSIONS = Object.keys(PERMISSION_LABEL) as Permission[];

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}
