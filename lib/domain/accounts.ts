import { sha256Hex } from "@/lib/engine/hash";
import type { PlanId } from "./plans";
import type { Role } from "./types";

/**
 * Password check for the browser demo. Only salted SHA-256 hashes are kept in
 * the bundle, never the passwords. This is NOT real authentication: without a
 * server anyone can change localStorage. The server version replaces this with
 * SSO/password login and MFA for Admin and Data Steward (PRD v1.1 §1.3).
 */
export function passwordHash(email: string, password: string): string {
  return sha256Hex(`aerosphere-lca:${email.trim().toLowerCase()}:${password}`);
}

export interface DemoAccount {
  email: string;
  hash: string;
  name: string;
  company: string;
  role: Role;
  plan: PlanId;
  /** Start the 5-step tour after sign-in. */
  tour: boolean;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "admin@aerosphere.demo",
    hash: "b2f0779fb658612978c4563eac8c6531b575d335df2544a60d322dbd21cad5b7",
    name: "Admin AeroSphere",
    company: "AeroSphere (admin demo)",
    role: "Admin",
    plan: "industri",
    tour: false,
  },
  {
    email: "demo@aerosphere.demo",
    hash: "799a6a4349cd1e991c28276d2ddc260f8c6cdf0cb9072b4082f9fb9ec3661e11",
    name: "Pengguna Demo",
    company: "Pabrik contoh (uji coba)",
    role: "Admin",
    plan: "coba",
    tour: true,
  },
];

/** Shown on the sign-in page so anyone can try the trial. The admin password is shared privately. */
export const PUBLIC_DEMO = { email: "demo@aerosphere.demo", password: "CobaDemo2026" };

export function findDemoAccount(email: string, password: string): DemoAccount | undefined {
  const e = email.trim().toLowerCase();
  const h = passwordHash(e, password);
  return DEMO_ACCOUNTS.find((a) => a.email === e && a.hash === h);
}
