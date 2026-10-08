"use client";

import { Check, Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { daysLeft, effectiveStatus, PLANS, type PlanId } from "@/lib/domain/plans";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils/cn";

const ROW_KEYS = ["Input data", "Hasil & Titik Boros", "Simulasi perbaikan", "Laporan", "Tanya AeroSphere"] as const;

/** Four plan cards (PRD v1.1 §3.0.2). `onChosen` runs after a plan is picked. */
export function PlanCards({ onChosen, readOnly }: { onChosen?: (plan: PlanId) => void; readOnly?: boolean }) {
  const subscription = useAppStore((s) => s.subscription);
  const choosePlan = useAppStore((s) => s.choosePlan);
  const status = effectiveStatus(subscription);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {PLANS.map((p) => {
        const current = subscription?.plan === p.id && status !== "expired";
        const requested = subscription?.pendingPlan === p.id;
        const featured = p.id === "profesional";
        return (
          <div
            key={p.id}
            className={cn(
              "flex flex-col rounded-xl border bg-white p-4 shadow-card",
              featured ? "border-brand-blue/50 ring-1 ring-brand-blue/30" : "border-sand-200",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-semibold text-navy-900">{p.name}</p>
              {featured && (
                <Badge tone="blue">
                  <Sparkles className="h-3 w-3" /> Paling lengkap
                </Badge>
              )}
              {current && <Badge tone={status === "pending" ? "gold" : "green"}>{status === "pending" ? "Menunggu aktivasi" : "Paket Anda"}</Badge>}
              {requested && <Badge tone="gold">Menunggu aktivasi</Badge>}
            </div>
            <p className="text-xs text-navy-700/65">{p.audience}</p>
            <p className="mt-3 text-lg font-semibold text-navy-900">{p.price}</p>
            <ul className="mt-3 flex-1 space-y-1.5 text-xs text-navy-800">
              {ROW_KEYS.map((k) => (
                <li key={k} className="flex gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-ok" aria-hidden />
                  <span>
                    <span className="text-navy-700/60">{k}: </span>
                    {p.rows[k]}
                  </span>
                </li>
              ))}
              <li className="flex gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-ok" aria-hidden />
                <span>
                  <span className="text-navy-700/60">Pengguna: </span>
                  {p.users}
                </span>
              </li>
            </ul>
            {!readOnly && (
              <Button
                className="mt-4 w-full"
                variant={featured ? "brand" : "secondary"}
                disabled={current || requested || (p.id === "coba" && !!subscription)}
                onClick={() => {
                  choosePlan(p.id);
                  onChosen?.(p.id);
                }}
              >
                {current ? "Paket saat ini" : requested ? "Menunggu aktivasi" : p.id === "coba" && subscription ? "Uji coba sudah dipakai" : p.id === "coba" ? "Coba gratis 14 hari" : p.id === "industri" ? "Ajukan penawaran" : `Pilih ${p.name}`}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PlanComparison() {
  return (
    <Table caption="Perbandingan paket">
      <THead>
        <tr>
          <Th>Fitur</Th>
          {PLANS.map((p) => (
            <Th key={p.id}>{p.name}</Th>
          ))}
        </tr>
      </THead>
      <tbody>
        <Tr>
          <Td className="font-medium">Untuk</Td>
          {PLANS.map((p) => (
            <Td key={p.id}>{p.audience}</Td>
          ))}
        </Tr>
        <Tr>
          <Td className="font-medium">Proyek</Td>
          {PLANS.map((p) => (
            <Td key={p.id}>{p.projects}</Td>
          ))}
        </Tr>
        {ROW_KEYS.map((k) => (
          <Tr key={k}>
            <Td className="font-medium">{k}</Td>
            {PLANS.map((p) => (
              <Td key={p.id}>{p.rows[k]}</Td>
            ))}
          </Tr>
        ))}
        <Tr>
          <Td className="font-medium">Pengguna</Td>
          {PLANS.map((p) => (
            <Td key={p.id}>{p.users}</Td>
          ))}
        </Tr>
        <Tr>
          <Td className="font-medium">Penempatan</Td>
          {PLANS.map((p) => (
            <Td key={p.id}>{p.deployment}</Td>
          ))}
        </Tr>
        <Tr>
          <Td className="font-medium">Dukungan</Td>
          {PLANS.map((p) => (
            <Td key={p.id}>{p.support}</Td>
          ))}
        </Tr>
      </tbody>
    </Table>
  );
}

/** Current subscription summary + simulated admin activation (demo BUILD has no payment gateway). */
export function SubscriptionSummary() {
  const subscription = useAppStore((s) => s.subscription);
  const activatePlan = useAppStore((s) => s.activatePlan);
  const status = effectiveStatus(subscription);
  if (!subscription) return null;
  const plan = PLANS.find((p) => p.id === subscription.plan)!;
  const left = daysLeft(subscription);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sand-200 bg-sand-50 p-4 text-xs text-navy-800">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy-900">
          Paket {plan.name}{" "}
          <Badge tone={status === "active" || status === "trial" ? "green" : status === "pending" ? "gold" : "red"}>
            {status === "trial" ? "Uji coba" : status === "active" ? "Aktif" : status === "pending" ? "Menunggu aktivasi" : "Berakhir"}
          </Badge>
        </p>
        <p className="mt-1">
          {status === "trial" && left !== null && <>Sisa {left} hari. </>}
          {status === "expired" && <>Data tetap bisa dibaca selama 30 hari. </>}
          Unggahan dipakai: {subscription.uploadsUsed}
          {Number.isFinite(plan.limits.uploads) ? ` dari ${plan.limits.uploads}` : ""} · Pertanyaan AI: {subscription.aiQuestionsUsed}
          {Number.isFinite(plan.limits.aiQuestions) ? ` dari ${plan.limits.aiQuestions}` : ""}
        </p>
      </div>
      {subscription.pendingPlan && (
        <p className="w-full text-[11px] text-navy-700/70">Permintaan paket {PLANS.find((p) => p.id === subscription.pendingPlan)?.name}: paket saat ini tetap berjalan sampai aktivasi.</p>
      )}
      {(status === "pending" || subscription.pendingPlan) && (
        <div className="flex flex-col items-end gap-1">
          <Button variant="brand" onClick={activatePlan}>
            <Clock className="h-4 w-4" /> Aktifkan sekarang (simulasi admin)
          </Button>
          <p className="max-w-[260px] text-right text-[10px] text-navy-700/55">
            Versi demo belum terhubung ke pembayaran. Di versi produksi, admin AeroSphere mengaktifkan paket setelah faktur dibayar.
          </p>
        </div>
      )}
    </div>
  );
}
