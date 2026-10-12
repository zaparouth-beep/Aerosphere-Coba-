import { tx } from "@/lib/i18n";
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
  get Admin() {
    return tx("Admin platform", "Platform admin");
  },
  DataSteward: "EHS / Data Steward",
  Engineer: "Process Engineer",
  Analyst: "ESG Analyst",
  Executive: "Executive Viewer",
  Auditor: "Auditor (read-only)",
};

export const PERMISSION_LABEL: Record<Permission, string> = {
  get editData() {
    return tx("Ubah data proses", "Edit process data");
  },
  get editPrices() {
    return tx("Ubah harga satuan", "Edit unit prices");
  },
  get editScope() {
    return tx("Ubah Goal & Scope", "Edit Goal & Scope");
  },
  get editMethod() {
    return tx("Ubah metode & database", "Edit method & database");
  },
  get acceptWarning() {
    return tx("Terima peringatan", "Accept warnings");
  },
  get approveDataset() {
    return tx("Approve dataset", "Approve dataset");
  },
  get runCalc() {
    return tx("Jalankan run draf", "Run draft calculation");
  },
  get officialRun() {
    return tx("Jalankan run resmi", "Run official calculation");
  },
  get editScenario() {
    return tx("Buat/ubah skenario", "Create/edit scenarios");
  },
  get approveScenario() {
    return tx("Approve skenario", "Approve scenarios");
  },
  get generateReport() {
    return tx("Buat laporan", "Create reports");
  },
  get admin() {
    return tx("Kelola akses & data", "Manage access & data");
  },
};

export const ROLES = Object.keys(MATRIX) as Role[];
export const PERMISSIONS = Object.keys(PERMISSION_LABEL) as Permission[];

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}
