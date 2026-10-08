import { describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS, findDemoAccount, passwordHash, PUBLIC_DEMO } from "./accounts";

describe("demo accounts", () => {
  it("public demo credentials open the Coba account", () => {
    expect(findDemoAccount(PUBLIC_DEMO.email, PUBLIC_DEMO.password)?.plan).toBe("coba");
  });
  it("the admin account is Industri with the Admin role", () => {
    const a = DEMO_ACCOUNTS.find((x) => x.email === "admin@aerosphere.demo");
    expect(a?.role).toBe("Admin");
    expect(a?.plan).toBe("industri");
  });
  it("email is case-insensitive", () => {
    expect(findDemoAccount(PUBLIC_DEMO.email.toUpperCase(), PUBLIC_DEMO.password)).toBeDefined();
  });
  it("wrong password or swapped credentials are rejected", () => {
    expect(findDemoAccount("admin@aerosphere.demo", PUBLIC_DEMO.password)).toBeUndefined();
    expect(findDemoAccount(PUBLIC_DEMO.email, PUBLIC_DEMO.password.toLowerCase())).toBeUndefined();
  });
  it("only hashes are stored", () => {
    for (const a of DEMO_ACCOUNTS) expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(passwordHash("x@y.z", "a")).not.toBe(passwordHash("x@y.z", "b"));
  });
});
