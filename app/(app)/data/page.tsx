"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertTriangle, BadgeCheck, CheckCircle2, XCircle } from "lucide-react";
import ExpertDataProses from "@/components/expert/ExpertDataProses";
import ExpertGoalScope from "@/components/expert/ExpertGoalScope";
import ExpertQuality from "@/components/expert/ExpertQuality";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout, ProgressBar, ReasonDialog } from "@/components/ui/Feedback";
import { LockedFeature } from "@/components/ui/Locked";
import { Tabs } from "@/components/ui/Tabs";
import { can } from "@/lib/domain/permissions";
import { hasFeature } from "@/lib/domain/plans";
import { issueText, type Issue } from "@/lib/engine/quality";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults } from "@/lib/store/useResults";
import { fmt, fmtDate } from "@/lib/utils/format";
import { tx } from "@/lib/i18n";

type View = "isi" | "cek" | "studi";

export default function Page() {
  return (
    <Suspense>
      <DataSaya />
    </Suspense>
  );
}

function DataSaya() {
  const search = useSearchParams();
  const router = useRouter();
  const expert = useAppStore((s) => s.ui.expertMode);
  const subscription = useAppStore((s) => s.subscription);
  const { results } = useActiveResults();
  const view = ((search.get("view") as View) || "isi") as View;
  const go = (v: View) => router.replace(v === "isi" ? "/data" : `/data?view=${v}`);
  const problems = results.validation.errors + results.validation.warnings;

  return (
    <div className="space-y-4">
      <Card>
        <Tabs<View>
          value={view}
          onChange={go}
          tabs={[
            { id: "isi", label: tx("Isi data", "Enter data") },
            { id: "cek", label: tx("Cek data", "Check data"), count: problems },
            { id: "studi", label: expert ? "Goal & Scope" : tx("Pengaturan studi", "Study settings") },
          ]}
        />
      </Card>
      {view === "isi" && <ExpertDataProses />}
      {view === "cek" && (expert && hasFeature(subscription, "advancedValidation") ? <ExpertQuality /> : <CekRingkas />)}
      {view === "studi" &&
        (expert ? (
          <ExpertGoalScope />
        ) : hasFeature(subscription, "expertMode") ? (
          <Callout>
            {tx(
              "Pengaturan studi memakai bawaan: dihitung per 1 m² permukaan dilapisi, dari pembersihan awal sampai pengolahan air limbah. Untuk mengubahnya, aktifkan Mode Ahli di kanan atas.",
              "Study settings use the defaults: calculated per 1 m² of plated surface, from initial cleaning through wastewater treatment. To change them, turn on Expert mode at the top right.",
            )}
          </Callout>
        ) : (
          <div className="space-y-3">
            <Callout>
              {tx(
                "Pengaturan studi memakai bawaan: dihitung per 1 m² permukaan dilapisi, dari pembersihan awal sampai pengolahan air limbah.",
                "Study settings use the defaults: calculated per 1 m² of plated surface, from initial cleaning through wastewater treatment.",
              )}
            </Callout>
            <LockedFeature feature="expertMode" title={tx("Ubah pengaturan studi", "Change study settings")} />
          </div>
        ))}
    </div>
  );
}

/** Mode Ringkas data check: plain messages, "Terima dengan alasan", "Setujui data". */
function CekRingkas() {
  const project = useAppStore((s) => s.project);
  const role = useAppStore((s) => s.user.role);
  const acceptWarning = useAppStore((s) => s.acceptWarning);
  const approveDataset = useAppStore((s) => s.approveDataset);
  const runCalculation = useAppStore((s) => s.runCalculation);
  const { results, isLive } = useActiveResults();
  const [accepting, setAccepting] = useState<Issue | null>(null);
  const v = results.validation;
  const accepted = project.dataset.acceptedWarnings;
  const issues = v.issues.filter((i) => i.severity !== "info").sort((a, b) => (a.severity === "error" ? -1 : 1) - (b.severity === "error" ? -1 : 1));
  const approved = project.dataset.status === "approved";

  return (
    <div className="space-y-4">
      {!isLive && (
        <Callout>
          {tx(
            "Pemeriksaan ini memakai data dari hasil tersimpan yang dipilih. Pilih “data terkini” di bar atas untuk memeriksa data terbaru.",
            "This check uses data from the selected saved result. Choose “current data” in the top bar to check the latest data.",
          )}
        </Callout>
      )}
      <Card>
        <CardHeader
          title={tx("Cek data", "Check data")}
          info={{
            what: tx("Pemeriksaan otomatis: angka kosong, satuan salah, dan neraca air yang tidak masuk akal.", "Automatic checks: empty numbers, wrong units, and water balances that don't add up."),
            why: tx("Hasil hanya sebaik datanya.", "Results are only as good as the data."),
            action: tx("Perbaiki yang merah, terima yang kuning dengan alasan, lalu setujui data.", "Fix the red items, accept the yellow ones with a reason, then approve the data."),
          }}
          subtitle={
            approved
              ? tx(`Data disetujui ${fmtDate(project.dataset.approvedAt)} oleh ${project.dataset.approvedBy}.`, `Data approved ${fmtDate(project.dataset.approvedAt)} by ${project.dataset.approvedBy}.`)
              : v.errors
                ? tx(`Ada ${v.errors} hal yang wajib diperbaiki sebelum data bisa disetujui.`, `${v.errors} item(s) must be fixed before the data can be approved.`)
                : tx("Tidak ada kesalahan. Periksa peringatan, lalu setujui data.", "No errors. Review the warnings, then approve the data.")
          }
          action={
            approved ? (
              <Badge tone="green">
                <BadgeCheck className="h-3.5 w-3.5" /> {tx("Data disetujui", "Data approved")}
              </Badge>
            ) : (
              <Button variant="brand" disabled={!v.readyForApproval || !can(role, "approveDataset")} onClick={approveDataset} title={can(role, "approveDataset") ? undefined : tx("Butuh peran Data Steward atau Admin", "Requires the Data Steward or Admin role")}>
                <BadgeCheck className="h-4 w-4" /> {tx("Setujui data", "Approve data")}
              </Button>
            )
          }
        />
        <CardBody className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>{tx("Data terisi", "Data filled in")}</span>
              <span className="num font-medium">{fmt(v.completenessPct, 0)}%</span>
            </div>
            <ProgressBar value={v.completenessPct} tone={v.completenessPct >= 80 ? "green" : "gold"} label={tx("Data terisi", "Data filled in")} />
          </div>
          {issues.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg bg-status-ok/5 p-3 text-sm text-status-ok">
              <CheckCircle2 className="h-4 w-4" /> {tx("Semua data lolos pemeriksaan.", "All data passed the checks.")}
            </p>
          ) : (
            <ul className="space-y-2">
              {issues.map((i) => {
                const isAccepted = i.severity === "warning" && !!accepted[i.key];
                return (
                  <li key={i.key} className="flex flex-wrap items-start gap-3 rounded-lg border border-sand-200 p-3">
                    {i.severity === "error" ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" aria-label={tx("Wajib diperbaiki", "Must be fixed")} />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warn" aria-label={tx("Perlu diperiksa", "Needs review")} />
                    )}
                    <div className="min-w-0 flex-1 text-sm text-navy-900">
                      <p>{issueText(i)}</p>
                      <p className="mt-0.5 text-[11px] text-navy-700/60">
                        {i.severity === "error"
                          ? tx("Wajib diperbaiki", "Must be fixed")
                          : isAccepted
                            ? tx(`Diterima: “${accepted[i.key]}”`, `Accepted: “${accepted[i.key]}”`)
                            : tx("Perlu diperiksa — boleh diterima dengan alasan", "Needs review — may be accepted with a reason")}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Link href={`/data?tab=${i.tab === "scope" ? "input" : i.tab}`} className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-brand-blue hover:bg-sand-100">
                        {tx("Perbaiki", "Fix")}
                      </Link>
                      {i.severity === "warning" && !isAccepted && (
                        <Button size="sm" variant="secondary" disabled={approved || !can(role, "acceptWarning")} onClick={() => setAccepting(i)}>
                          {tx("Terima dengan alasan", "Accept with a reason")}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-sand-200 pt-3 text-xs text-navy-700/70">
            {tx("Setelah data disetujui, tekan", "Once the data is approved, press")}
            <Button size="sm" onClick={() => runCalculation("draft")} disabled={v.errors > 0}>
              {tx("Hitung hasil", "Calculate results")}
            </Button>
            {tx("untuk menyimpan hasil dengan nomor.", "to save a numbered result.")}
          </div>
        </CardBody>
      </Card>
      <ReasonDialog
        open={!!accepting}
        title={tx("Terima peringatan", "Accept warning")}
        description={(accepting ? issueText(accepting) : undefined) ?? ""}
        confirmLabel={tx("Terima", "Accept")}
        onCancel={() => setAccepting(null)}
        onConfirm={(r) => {
          if (accepting) acceptWarning(accepting.key, r);
          setAccepting(null);
        }}
      />
    </div>
  );
}
