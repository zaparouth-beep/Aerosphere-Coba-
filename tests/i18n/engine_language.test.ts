import { afterEach, describe, expect, it } from "vitest";
import { hardChromeDemo } from "@/lib/domain/templates";
import { calculate } from "@/lib/engine/calculate";
import { hashOf } from "@/lib/engine/hash";
import { issueText } from "@/lib/engine/quality";
import { setCurrentLang } from "@/lib/i18n";

/**
 * Calculation results must not depend on the interface language: a Run hashes
 * its results, so the same data must give the same hash in Indonesian and English.
 */
describe("engine results are language-independent", () => {
  afterEach(() => setCurrentLang("id"));

  it("gives the same result hash in id and en", () => {
    // One project (template ids are random), calculated in each language.
    const project = hardChromeDemo();
    setCurrentLang("id");
    const id = calculate(structuredClone(project));
    setCurrentLang("en");
    const en = calculate(structuredClone(project));
    expect(hashOf(en)).toBe(hashOf(id));
  });

  it("stores issues in both languages and shows the interface language", () => {
    const project = hardChromeDemo();
    // Make sure there is at least one issue: a negative quantity is always an error.
    project.inputs[0]!.quantity = -1;
    setCurrentLang("en");
    const r = calculate(project);
    expect(r.validation.issues.length).toBeGreaterThan(0);
    for (const i of r.validation.issues) expect(i.messageEn, i.code).toBeTruthy();
    const neg = r.validation.issues.find((i) => i.code === "NEGATIVE_VALUE")!;
    expect(neg.message).toContain("bernilai negatif");
    expect(issueText(neg)).toBe(neg.messageEn);
    setCurrentLang("id");
    expect(issueText(neg)).toBe(neg.message);
  });

  it("stores engine warnings and trace labels in both languages", () => {
    const r = calculate(hardChromeDemo());
    for (const w of r.analysis!.warnings) expect(w.messageEn, w.code).toBeTruthy();
    for (const t of r.analysis!.trace) expect(t.labelEn, t.id).toBeTruthy();
  });
});
