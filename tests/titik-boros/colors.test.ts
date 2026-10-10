import { describe, expect, it } from "vitest";
import { SEVERITIES } from "@/lib/engine/titikBoros";
import { SEVERITY_STYLE } from "@/lib/view/titikBoros";

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};
const lightness = (hex: string) => 116 * Math.cbrt(lum(hex)) - 16;

describe("severity colours", () => {
  it("text on every fill has contrast ≥ 4.5:1", () => {
    for (const s of SEVERITIES) expect(contrast(SEVERITY_STYLE[s].bg, SEVERITY_STYLE[s].fg)).toBeGreaterThanOrEqual(4.5);
  });
  it("red, orange, green and yellow differ clearly in lightness (≥ 10 L*)", () => {
    const L = (["red", "orange", "green", "yellow"] as const).map((s) => lightness(SEVERITY_STYLE[s].bg)).sort((a, b) => a - b);
    for (let i = 1; i < L.length; i++) expect(L[i]! - L[i - 1]!).toBeGreaterThanOrEqual(10);
  });
  it("every class has a text label", () => {
    expect(SEVERITIES.map((s) => SEVERITY_STYLE[s].label)).toEqual(["Titik boros", "Tinggi", "Sedang", "Rendah", "Tidak ada"]);
  });
});
