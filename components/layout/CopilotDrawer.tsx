"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, ShieldCheck, Sparkles, Wand2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Feedback";
import { Input } from "@/components/ui/Input";
import { buildInsights, parseWhatIf } from "@/lib/engine/copilot";
import { MAX_SCENARIOS, useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults, useScenarioOutcomes } from "@/lib/store/useResults";
import { cn } from "@/lib/utils/cn";

/**
 * Copilot panel (M10). Rule-based in this browser MVP: every number is a
 * placeholder filled from the engine payload and checked by the guardrail.
 */
export function CopilotDrawer() {
  const open = useAppStore((s) => s.ui.copilotOpen);
  const decisions = useAppStore((s) => s.ui.insightDecisions);
  const setUi = useAppStore((s) => s.setUi);
  const log = useAppStore((s) => s.log);
  const createScenarioFrom = useAppStore((s) => s.createScenarioFrom);
  const updateScenario = useAppStore((s) => s.updateScenario);
  const scenarios = useAppStore((s) => s.project.scenarios);
  const replaceTarget = scenarios.length >= MAX_SCENARIOS ? [...scenarios].reverse().find((s) => s.status !== "approved") : undefined;
  const router = useRouter();
  const { project, results } = useActiveResults();
  const { outcomes } = useScenarioOutcomes();
  const [question, setQuestion] = useState("");
  const [proposal, setProposal] = useState<ReturnType<typeof parseWhatIf> | undefined>(undefined);

  const insights = useMemo(() => {
    try {
      return buildInsights(project, results, outcomes);
    } catch {
      return Object.assign([], { rejected: ["Gagal menyusun ringkasan"] });
    }
  }, [project, results, outcomes]);

  if (!open) return null;

  const decide = (id: string, d: "accepted" | "rejected") => {
    setUi({ insightDecisions: { ...decisions, [id]: d } });
    log("ai", id, d === "accepted" ? "accept-insight" : "reject-insight");
  };

  return (
    <aside className="no-print fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col border-l border-sand-200 bg-white shadow-2xl" aria-label="AI Copilot">
      <div className="flex items-center gap-2 border-b border-sand-200 bg-navy-950 px-4 py-3 text-white">
        <Sparkles className="h-4 w-4 text-brand-gold" />
        <div className="flex-1">
          <p className="text-sm font-semibold">AeroSphere Copilot</p>
          <p className="text-[11px] text-white/55">Menafsirkan hasil engine — tidak menghitung angka</p>
        </div>
        <button type="button" onClick={() => setUi({ copilotOpen: false })} aria-label="Tutup Copilot" className="text-white/60 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <Callout tone="info">
          <span className="font-medium">Disusun otomatis – perlu ditinjau.</span> Setiap angka diambil dari payload hasil run dan dicek guardrail;
          narasi dengan angka bebas ditolak.
        </Callout>
        {insights.rejected.length > 0 && (
          <Callout tone="warn">{insights.rejected.length} narasi ditolak guardrail karena memuat angka yang bukan dari hasil engine.</Callout>
        )}
        {insights.map((ins) => {
          const d = decisions[ins.id];
          return (
            <article key={ins.id} className={cn("rounded-lg border p-3", d === "rejected" ? "border-sand-200 opacity-50" : "border-sand-300")}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-navy-900">{ins.title}</p>
                {d && <Badge tone={d === "accepted" ? "green" : "neutral"}>{d === "accepted" ? "Diterima" : "Ditolak"}</Badge>}
              </div>
              <p className="text-xs leading-relaxed text-navy-800">{ins.text}</p>
              <p className="mt-1.5 flex flex-wrap gap-1">
                {ins.refs.map((r) => (
                  <code key={r} className="rounded bg-sand-100 px-1 text-[10px] text-navy-700/70">
                    {r}
                  </code>
                ))}
              </p>
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => decide(ins.id, "accepted")}>
                  <Check className="h-3 w-3" /> Terima
                </Button>
                <Button size="sm" variant="ghost" onClick={() => decide(ins.id, "rejected")}>
                  Tolak
                </Button>
              </div>
            </article>
          );
        })}

        <div className="rounded-lg border border-brand-teal/30 bg-brand-teal/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-navy-900">
            <Wand2 className="h-3.5 w-3.5 text-brand-teal" /> What-if dalam bahasa alami
          </p>
          <p className="mb-2 text-[11px] text-navy-700/70">Contoh: “apa yang terjadi bila drag-out turun 20%?” atau “rectifier 75% ke 88%”.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const p = parseWhatIf(question);
              setProposal(p);
              log("ai", "nl-whatif", p ? "propose-scenario" : "no-match", { newValue: question });
            }}
            className="flex gap-1.5"
          >
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Tulis pertanyaan…" aria-label="Pertanyaan what-if" />
            <Button type="submit" size="md" disabled={!question.trim()}>
              Susun
            </Button>
          </form>
          {proposal === null && <p className="mt-2 text-[11px] text-status-warn">Tidak ada lever yang dikenali. Sebut drag-out, bilas, rectifier, grid, kabut, atau pemanas.</p>}
          {proposal && (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] font-medium text-navy-900">Parameter skenario yang diusulkan (engine yang menghitung):</p>
              <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-navy-800">
                {proposal.summary.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="brand"
                disabled={scenarios.length >= MAX_SCENARIOS && !replaceTarget}
                onClick={() => {
                  const description = `Disusun dari: “${question}”`;
                  const ok = replaceTarget
                    ? updateScenario(replaceTarget.id, { name: "Dari Copilot", levers: proposal.levers, description })
                    : !!createScenarioFrom("Dari Copilot", proposal.levers, description);
                  if (ok) {
                    setUi({ copilotOpen: false });
                    router.push("/what-if");
                  }
                }}
              >
                {replaceTarget ? `Ganti ${replaceTarget.code} dengan saran ini` : "Buat skenario dari saran ini"}
              </Button>
              {scenarios.length >= MAX_SCENARIOS && !replaceTarget && <p className="text-[11px] text-status-warn">Semua slot S1–S3 sudah disetujui; hapus satu skenario dulu.</p>}
            </div>
          )}
        </div>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-navy-700/55">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Versi browser ini memakai aturan deterministik. Integrasi LLM (PRD 2.5) membutuhkan backend agar kunci API tidak terekspos; guardrail yang sama tetap berlaku.
        </p>
      </div>
    </aside>
  );
}
