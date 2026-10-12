"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, ShieldCheck, Sparkles, Wand2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Feedback";
import { Input } from "@/components/ui/Input";
import { buildInsights, parseWhatIf } from "@/lib/engine/copilot";
import { hasFeature, planLimits } from "@/lib/domain/plans";
import { tx } from "@/lib/i18n";
import { useAppStore } from "@/lib/store/useAppStore";
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
  const subscription = useAppStore((s) => s.subscription);
  const consumeAiQuestion = useAppStore((s) => s.consumeAiQuestion);
  const maxScenarios = planLimits(subscription).scenarios;
  const canEditScenario = hasFeature(subscription, "editScenario");
  const aiLimit = planLimits(subscription).aiQuestions;
  const replaceTarget = scenarios.length >= maxScenarios ? [...scenarios].reverse().find((s) => s.status !== "approved") : undefined;
  const router = useRouter();
  const { project, results } = useActiveResults();
  const { outcomes } = useScenarioOutcomes();
  const [question, setQuestion] = useState("");
  const [proposal, setProposal] = useState<ReturnType<typeof parseWhatIf> | undefined>(undefined);

  const insights = useMemo(() => {
    try {
      return buildInsights(project, results, outcomes);
    } catch {
      return Object.assign([], { rejected: [tx("Gagal menyusun ringkasan", "Could not build the summary")] });
    }
  }, [project, results, outcomes]);

  if (!open) return null;

  const decide = (id: string, d: "accepted" | "rejected") => {
    setUi({ insightDecisions: { ...decisions, [id]: d } });
    log("ai", id, d === "accepted" ? "accept-insight" : "reject-insight");
  };

  return (
    <aside className="no-print fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col border-l border-sand-200 bg-white shadow-2xl" aria-label={tx("Tanya AeroSphere", "Ask AeroSphere")}>
      <div className="flex items-center gap-2 border-b border-sand-200 bg-navy-950 px-4 py-3 text-white">
        <Sparkles className="h-4 w-4 text-brand-gold" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{tx("Tanya AeroSphere", "Ask AeroSphere")}</p>
          <p className="text-[11px] text-white/55">
            {tx("Menjelaskan hasil dengan bahasa sehari-hari. Angka selalu dari mesin hitung.", "Explains results in plain language. Numbers always come from the calculation engine.")}
          </p>
        </div>
        <button type="button" onClick={() => setUi({ copilotOpen: false })} aria-label={tx("Tutup Tanya AeroSphere", "Close Ask AeroSphere")} className="text-white/60 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <Callout tone="info">
          <span className="font-medium">{tx("Disusun otomatis – perlu ditinjau.", "Generated automatically – please review.")}</span>{" "}
          {tx(
            "Setiap angka diambil dari hasil hitung dan diperiksa ulang; kalimat dengan angka yang tidak berasal dari hasil hitung tidak ditampilkan.",
            "Every number is taken from the calculated results and double-checked; sentences with numbers that do not come from the results are not shown.",
          )}
        </Callout>
        {insights.rejected.length > 0 && (
          <Callout tone="warn">
            {tx(
              `${insights.rejected.length} penjelasan tidak ditampilkan karena memuat angka yang bukan dari hasil hitung.`,
              `${insights.rejected.length} explanation(s) hidden because they contain numbers that are not from the calculated results.`,
            )}
          </Callout>
        )}
        {insights.map((ins) => {
          const d = decisions[ins.id];
          return (
            <article key={ins.id} className={cn("rounded-lg border p-3", d === "rejected" ? "border-sand-200 opacity-50" : "border-sand-300")}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-navy-900">{ins.title}</p>
                {d && <Badge tone={d === "accepted" ? "green" : "neutral"}>{d === "accepted" ? tx("Diterima", "Accepted") : tx("Ditolak", "Rejected")}</Badge>}
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
                  <Check className="h-3 w-3" /> {tx("Terima", "Accept")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => decide(ins.id, "rejected")}>
                  {tx("Tolak", "Reject")}
                </Button>
              </div>
            </article>
          );
        })}

        <div className="rounded-lg border border-brand-teal/30 bg-brand-teal/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-navy-900">
            <Wand2 className="h-3.5 w-3.5 text-brand-teal" /> {tx("Tanya “bagaimana jika…”", "Ask “what if…”")}
          </p>
          <p className="mb-2 text-[11px] text-navy-700/70">
            {tx(
              "Contoh: “bagaimana jika larutan terbawa part turun 20%?” atau “penyearah 75% ke 88%”.",
              "Example: “what if drag-out drops 20%?” or “rectifier 75% to 88%”.",
            )}
            {Number.isFinite(aiLimit) &&
              subscription &&
              tx(
                ` Sisa ${Math.max(aiLimit - subscription.aiQuestionsUsed, 0)} pertanyaan di paket Coba.`,
                ` ${Math.max(aiLimit - subscription.aiQuestionsUsed, 0)} questions left on the Trial plan.`,
              )}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!consumeAiQuestion()) return;
              const p = parseWhatIf(question);
              setProposal(p);
              log("ai", "nl-whatif", p ? "propose-scenario" : "no-match", { newValue: question });
            }}
            className="flex gap-1.5"
          >
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={tx("Tulis pertanyaan…", "Type a question…")} aria-label={tx("Pertanyaan bagaimana jika", "What-if question")} />
            <Button type="submit" size="md" disabled={!question.trim()}>
              {tx("Tanya", "Ask")}
            </Button>
          </form>
          {proposal === null && <p className="mt-2 text-[11px] text-status-warn">
              {tx(
                "Belum ada perbaikan yang dikenali. Sebut larutan terbawa, bilasan, penyearah, listrik, kabut, atau pemanas, beserta angkanya.",
                "No improvement recognised yet. Mention drag-out, rinse, rectifier, electricity, mist or heater, with a number.",
              )}
            </p>}
          {proposal && (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] font-medium text-navy-900">
                {tx("Perbaikan yang diusulkan (mesin hitung yang menghitung hasilnya):", "Proposed improvement (the calculation engine computes the result):")}
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-navy-800">
                {proposal.summary.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="brand"
                disabled={!canEditScenario || (scenarios.length >= maxScenarios && !replaceTarget)}
                onClick={() => {
                  const description = tx(`Disusun dari: “${question}”`, `Built from: “${question}”`);
                  const name = tx("Dari Tanya AeroSphere", "From Ask AeroSphere");
                  const ok = replaceTarget
                    ? updateScenario(replaceTarget.id, { name, levers: proposal.levers, description })
                    : !!createScenarioFrom(name, proposal.levers, description);
                  if (ok) {
                    setUi({ copilotOpen: false });
                    router.push("/simulasi");
                  }
                }}
              >
                {replaceTarget
                  ? tx(`Ganti ${replaceTarget.code} dengan saran ini`, `Replace ${replaceTarget.code} with this suggestion`)
                  : tx("Buat simulasi dari saran ini", "Create a simulation from this suggestion")}
              </Button>
              {!canEditScenario && <p className="text-[11px] text-navy-700/60">{tx("Membuat simulasi sendiri tersedia mulai paket Esensial.", "Creating your own simulations is available from the Essential plan.")}</p>}
              {scenarios.length >= maxScenarios && !replaceTarget && <p className="text-[11px] text-status-warn">{tx("Semua slot simulasi sudah disetujui; hapus satu dulu.", "All simulation slots are approved; delete one first.")}</p>}
            </div>
          )}
        </div>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-navy-700/55">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {tx(
            "Versi demo ini memakai aturan tetap, bukan model bahasa. Versi server memakai model AI dengan pemeriksaan angka yang sama.",
            "This demo uses fixed rules, not a language model. The server version uses an AI model with the same number checks.",
          )}
        </p>
      </div>
    </aside>
  );
}
