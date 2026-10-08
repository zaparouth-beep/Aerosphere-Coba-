import { describe, expect, it } from "vitest";
import { daysLeft, effectiveStatus, hasFeature, minimumPlanFor, type Subscription } from "./plans";

const sub = (patch: Partial<Subscription>): Subscription => ({ plan: "coba", status: "trial", startedAt: "2026-10-01T00:00:00Z", uploadsUsed: 0, aiQuestionsUsed: 0, ...patch });
const now = new Date("2026-10-08T00:00:00Z");

describe("plans & entitlements (PRD v1.1 §3.0.2)", () => {
  it("Coba allows the summary report but not Mode Ahli or own scenarios", () => {
    const s = sub({ periodEnd: "2026-10-15T00:00:00Z" });
    expect(hasFeature(s, "reportSummary", now)).toBe(true);
    expect(hasFeature(s, "expertMode", now)).toBe(false);
    expect(hasFeature(s, "editScenario", now)).toBe(false);
    expect(daysLeft(s, now)).toBe(7);
  });

  it("an expired trial is read-only", () => {
    const s = sub({ periodEnd: "2026-10-05T00:00:00Z" });
    expect(effectiveStatus(s, now)).toBe("expired");
    expect(hasFeature(s, "reportSummary", now)).toBe(false);
  });

  it("paid plans wait for activation", () => {
    expect(hasFeature(sub({ plan: "profesional", status: "pending" }), "expertMode", now)).toBe(false);
    expect(hasFeature(sub({ plan: "profesional", status: "active" }), "expertMode", now)).toBe(true);
  });

  it("names the minimum plan for a locked feature", () => {
    expect(minimumPlanFor("expertMode").name).toBe("Profesional");
    expect(minimumPlanFor("auditEvidence").name).toBe("Industri");
    expect(minimumPlanFor("manualInput").name).toBe("Esensial");
  });
});
