"use client";

import { Check, Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { daysLeft, effectiveStatus, PLANS, type PlanId } from "@/lib/domain/plans";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils/cn";
import { tx } from "@/lib/i18n";

const ROW_KEYS = ["Input data", "Hasil & Titik Boros", "Simulasi perbaikan", "Laporan", "Tanya AeroSphere"] as const;

/** Display label for a feature row (keys stay Indonesian; they index `PlanDef.rows`). */
const rowLabel = (k: (typeof ROW_KEYS)[number]): string =>
  ({
    "Input data": tx("Input data", "Data input"),
    "Hasil & Titik Boros": tx("Hasil & Titik Boros", "Results & Waste Hotspots"),
    "Simulasi perbaikan": tx("Simulasi perbaikan", "Improvement simulation"),
    Laporan: tx("Laporan", "Reports"),
    "Tanya AeroSphere": tx("Tanya AeroSphere", "Ask AeroSphere"),
  })[k];

/** Four plan cards (PRD v1.1 §3.0.2). `onChosen` runs after a plan is picked. */
/** Price shown on the plan button; plans without a published price show "-" and cannot be chosen here. */
const PRICE_LABEL: Partial<Record<PlanId, { label: string; title: string; selectable: boolean }>> = {
  esensial: {
    label: "-",
    get title() {
      return tx("Harga belum tersedia", "Price not yet available");
    },
    selectable: false,
  },
  profesional: {
    label: "IDR 18.000.000/year",
    get title() {
      return tx("Pilih paket Profesional (IDR 18.000.000 per tahun)", "Choose the Professional plan (IDR 18.000.000 per year)");
    },
    selectable: true,
  },
  industri: {
    label: "-",
    get title() {
      return tx("Harga belum tersedia", "Price not yet available");
    },
    selectable: false,
  },
};

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
                  <Sparkles className="h-3 w-3" /> {tx("Rekomendasi", "Recommended")}
                </Badge>
              )}
              {current && <Badge tone={status === "pending" ? "gold" : "green"}>{status === "pending" ? tx("Menunggu aktivasi", "Awaiting activation") : tx("Paket Anda", "Your plan")}</Badge>}
              {requested && <Badge tone="gold">{tx("Menunggu aktivasi", "Awaiting activation")}</Badge>}
            </div>
            <p className="text-xs text-navy-700/65">{p.audience}</p>
            <p className="mt-3 text-lg font-semibold text-navy-900">{p.tagline}</p>
            <ul className="mt-3 flex-1 space-y-1.5 text-xs text-navy-800">
              {ROW_KEYS.map((k) => (
                <li key={k} className="flex gap-1.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-ok" aria-hidden />
                  <span>
                    <span className="text-navy-700/60">{rowLabel(k)}: </span>
                    {p.rows[k]}
                  </span>
                </li>
              ))}
              <li className="flex gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-ok" aria-hidden />
                <span>
                  <span className="text-navy-700/60">{tx("Pengguna", "Users")}: </span>
                  {p.users}
                </span>
              </li>
            </ul>
            {!readOnly && (
              <Button
                className="mt-4 w-full"
                variant={featured ? "brand" : "secondary"}
                disabled={!!PRICE_LABEL[p.id] && !PRICE_LABEL[p.id]!.selectable ? true : current || requested || (p.id === "coba" && !!subscription)}
                title={PRICE_LABEL[p.id]?.title}
                aria-label={PRICE_LABEL[p.id] ? `${p.name}: ${PRICE_LABEL[p.id]!.title}` : undefined}
                onClick={() => {
                  choosePlan(p.id);
                  onChosen?.(p.id);
                }}
              >
                {PRICE_LABEL[p.id]
                  ? PRICE_LABEL[p.id]!.label
                  : current
                    ? tx("Paket saat ini", "Current plan")
                    : requested
                      ? tx("Menunggu aktivasi", "Awaiting activation")
                      : p.id === "coba" && subscription
                        ? tx("Uji coba sudah dipakai", "Trial already used")
                        : tx("Coba gratis 14 hari", "Try free for 14 days")}
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
    <Table caption={tx("Perbandingan paket", "Plan comparison")}>
      <THead>
        <tr>
          <Th>{tx("Fitur", "Feature")}</Th>
          {PLANS.map((p) => (
            <Th key={p.id}>{p.name}</Th>
          ))}
        </tr>
      </THead>
      <tbody>
        <Tr>
          <Td className="font-medium">{tx("Untuk", "For")}</Td>
          {PLANS.map((p) => (
            <Td key={p.id}>{p.audience}</Td>
          ))}
        </Tr>
        <Tr>
          <Td className="font-medium">{tx("Proyek", "Projects")}</Td>
          {PLANS.map((p) => (
            <Td key={p.id}>{p.projects}</Td>
          ))}
        </Tr>
        {ROW_KEYS.map((k) => (
          <Tr key={k}>
            <Td className="font-medium">{rowLabel(k)}</Td>
            {PLANS.map((p) => (
              <Td key={p.id}>{p.rows[k]}</Td>
            ))}
          </Tr>
        ))}
        <Tr>
          <Td className="font-medium">{tx("Pengguna", "Users")}</Td>
          {PLANS.map((p) => (
            <Td key={p.id}>{p.users}</Td>
          ))}
        </Tr>
        <Tr>
          <Td className="font-medium">{tx("Penempatan", "Deployment")}</Td>
          {PLANS.map((p) => (
            <Td key={p.id}>{p.deployment}</Td>
          ))}
        </Tr>
        <Tr>
          <Td className="font-medium">{tx("Dukungan", "Support")}</Td>
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
          {tx(`Paket ${plan.name}`, `${plan.name} plan`)}{" "}
          <Badge tone={status === "active" || status === "trial" ? "green" : status === "pending" ? "gold" : "red"}>
            {status === "trial" ? tx("Uji coba", "Trial") : status === "active" ? tx("Aktif", "Active") : status === "pending" ? tx("Menunggu aktivasi", "Awaiting activation") : tx("Berakhir", "Expired")}
          </Badge>
        </p>
        <p className="mt-1">
          {status === "trial" && left !== null && <>{tx(`Sisa ${left} hari. `, `${left} days left. `)}</>}
          {status === "expired" && <>{tx("Data tetap bisa dibaca selama 30 hari. ", "Your data stays readable for 30 days. ")}</>}
          {tx("Unggahan dipakai", "Uploads used")}: {subscription.uploadsUsed}
          {Number.isFinite(plan.limits.uploads) ? tx(` dari ${plan.limits.uploads}`, ` of ${plan.limits.uploads}`) : ""} · {tx("Pertanyaan AI", "AI questions")}: {subscription.aiQuestionsUsed}
          {Number.isFinite(plan.limits.aiQuestions) ? tx(` dari ${plan.limits.aiQuestions}`, ` of ${plan.limits.aiQuestions}`) : ""}
        </p>
      </div>
      {subscription.pendingPlan && (
        <p className="w-full text-[11px] text-navy-700/70">
          {tx(
            `Permintaan paket ${PLANS.find((p) => p.id === subscription.pendingPlan)?.name}: paket saat ini tetap berjalan sampai aktivasi.`,
            `${PLANS.find((p) => p.id === subscription.pendingPlan)?.name} plan requested: your current plan keeps running until activation.`,
          )}
        </p>
      )}
      {(status === "pending" || subscription.pendingPlan) && (
        <div className="flex flex-col items-end gap-1">
          <Button variant="brand" onClick={activatePlan}>
            <Clock className="h-4 w-4" /> {tx("Aktifkan sekarang (simulasi admin)", "Activate now (admin simulation)")}
          </Button>
          <p className="max-w-[260px] text-right text-[10px] text-navy-700/55">
            {tx(
              "Versi demo belum terhubung ke pembayaran. Di versi produksi, admin AeroSphere mengaktifkan paket setelah faktur dibayar.",
              "The demo is not connected to payments yet. In production, an AeroSphere admin activates the plan once the invoice is paid.",
            )}
          </p>
        </div>
      )}
    </div>
  );
}
