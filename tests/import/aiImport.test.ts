import { beforeEach, describe, expect, it, vi } from "vitest";
import { chunkDocument, documentNumbers, fromAi, type AiRow } from "@/lib/io/aiReader";
import type { ExtractedDoc } from "@/lib/io/docExtract";

/**
 * AI document reader: the Netlify Function (with a mocked Anthropic SDK) and
 * the client-side checks. No real API call is made in tests.
 */

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  class RateLimitError extends APIError {}
  class AuthenticationError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    static AuthenticationError = AuthenticationError;
    beta = { messages: { create } };
  }
  return { default: Anthropic };
});

const { default: handler } = await import("../../netlify/functions/ai-import.mts");

const post = (body: unknown) => handler(new Request("http://x/api/ai-import", { method: "POST", body: JSON.stringify(body) }));
const row = (over: Partial<AiRow> = {}): AiRow => ({
  kind: "input",
  category: "Chemical",
  name: "Asam kromat",
  quantity: 150,
  unit: "kg",
  stage: "C",
  production_field: null,
  impact_key: null,
  source_text: "Asam kromat (CrO3) C 150 kg",
  confidence: "high",
  ...over,
});

describe("Netlify function /api/ai-import", () => {
  beforeEach(() => {
    create.mockReset();
    process.env.ANTHROPIC_API_KEY = "test-key";
  });

  it("GET reports whether the key is configured", async () => {
    expect(await (await handler(new Request("http://x/api/ai-import"))).json()).toEqual({ available: true });
    delete process.env.ANTHROPIC_API_KEY;
    expect(await (await handler(new Request("http://x/api/ai-import"))).json()).toEqual({ available: false });
  });

  it("without a key, POST explains how to enable it", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await post({ fileName: "a.pdf", name: "Halaman 1", text: "x" });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/kunci API/);
  });

  it("rejects empty or oversized chunks", async () => {
    expect((await post({ fileName: "a", name: "b", text: "" })).status).toBe(400);
    expect((await post({ fileName: "a", name: "b", text: "x".repeat(20_001) })).status).toBe(400);
  });

  it("asks Claude for structured rows and returns them", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", model: "claude-opus-5-5", content: [{ type: "text", text: JSON.stringify({ rows: [row()] }) }] });
    const res = await post({ fileName: "lci.pdf", name: "Halaman 1", text: "Asam kromat (CrO3) C 150 kg" });
    expect(res.status).toBe(200);
    expect((await res.json()).rows).toEqual([row()]);
    const args = create.mock.calls[0]![0];
    expect(args.model).toBe("claude-opus-5-5");
    expect(args.fallbacks).toBe("default");
    expect(args.output_config.format.type).toBe("json_schema");
    expect(args.messages[0].content).toContain("<document");
  });

  it("handles a refusal and malformed output", async () => {
    create.mockResolvedValueOnce({ stop_reason: "refusal", content: [] });
    expect((await post({ fileName: "a", name: "b", text: "x" })).status).toBe(422);
    create.mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ rows: [{ kind: "nope" }] }) }] });
    expect((await post({ fileName: "a", name: "b", text: "x" })).status).toBe(502);
  });
});

describe("client checks", () => {
  const doc: ExtractedDoc = {
    fileName: "lci.pdf",
    kind: "pdf",
    tables: [{ name: "Halaman 1", rows: [["Asam kromat (CrO3)", "C", "150", "kg"], ["Listrik", "C", "1.250,5", "kWh"]] }],
    text: "Asam kromat (CrO3) | C | 150 | kg\nListrik | C | 1.250,5 | kWh",
  };

  it("numbers are read in the document's own format", () => {
    expect(documentNumbers(doc)).toEqual(expect.arrayContaining([150, 1250.5]));
  });

  it("a number the AI cannot point to in the document is marked and not applied", () => {
    const rows = fromAi([row(), row({ name: "Listrik", category: "Energy", quantity: 1250.5, unit: "kWh" }), row({ name: "Nikel", quantity: 999 })], doc, "Halaman 1", 0);
    expect(rows.map((r) => [r.name, r.include, r.confidence])).toEqual([
      ["Asam kromat", true, "high"],
      ["Listrik", true, "high"],
      ["Nikel", false, "low"],
    ]);
    expect(rows[2]!.notes.join()).toMatch(/tidak ditemukan/);
  });

  it("chunks keep whole rows and stay under the size limit", () => {
    const big: ExtractedDoc = { ...doc, tables: [{ name: "T", rows: Array.from({ length: 500 }, (_, i) => [`Bahan ${i}`, `${i}`, "kg"]) }] };
    const chunks = chunkDocument(big, 2000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.length <= 2000)).toBe(true);
    expect(chunks.map((c) => c.text).join("")).toContain("Bahan 499 | 499 | kg");
  });
});
