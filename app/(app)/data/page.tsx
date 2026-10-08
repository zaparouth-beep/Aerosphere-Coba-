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
import type { Issue } from "@/lib/engine/quality";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults } from "@/lib/store/useResults";
import { fmt, fmtDate } from "@/lib/utils/format";

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
            { id: "isi", label: "Isi data" },
            { id: "cek", label: "Cek data", count: problems },
            { id: "studi", label: expert ? "Goal & Scope" : "Pengaturan studi" },
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
            Pengaturan studi memakai bawaan: dihitung per 1 m² permukaan dilapisi, dari pembersihan awal sampai pengolahan air limbah. Untuk mengubahnya,
            aktifkan Mode Ahli di kanan atas.
          </Callout>
        ) : (
          <div className="space-y-3">
            <Callout>
              Pengaturan studi memakai bawaan: dihitung per 1 m² permukaan dilapisi, dari pembersihan awal sampai pengolahan air limbah.
            </Callout>
            <LockedFeature feature="expertMode" title="Ubah pengaturan studi" />
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
      {!isLive && <Callout>Pemeriksaan ini memakai data dari hasil tersimpan yang dipilih. Pilih “data terkini” di bar atas untuk memeriksa data terbaru.</Callout>}
      <Card>
        <CardHeader
          title="Cek data"
          info={{ what: "Pemeriksaan otomatis: angka kosong, satuan salah, dan neraca air yang tidak masuk akal.", why: "Hasil hanya sebaik datanya.", action: "Perbaiki yang merah, terima yang kuning dengan alasan, lalu setujui data." }}
          subtitle={
            approved
              ? `Data disetujui ${fmtDate(project.dataset.approvedAt)} oleh ${project.dataset.approvedBy}.`
              : v.errors
                ? `Ada ${v.errors} hal yang wajib diperbaiki sebelum data bisa disetujui.`
                : "Tidak ada kesalahan. Periksa peringatan, lalu setujui data."
          }
          action={
            approved ? (
              <Badge tone="green">
                <BadgeCheck className="h-3.5 w-3.5" /> Data disetujui
              </Badge>
            ) : (
              <Button variant="brand" disabled={!v.readyForApproval || !can(role, "approveDataset")} onClick={approveDataset} title={can(role, "approveDataset") ? undefined : "Butuh peran Data Steward atau Admin"}>
                <BadgeCheck className="h-4 w-4" /> Setujui data
              </Button>
            )
          }
        />
        <CardBody className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>Data terisi</span>
              <span className="num font-medium">{fmt(v.completenessPct, 0)}%</span>
            </div>
            <ProgressBar value={v.completenessPct} tone={v.completenessPct >= 80 ? "green" : "gold"} label="Data terisi" />
          </div>
          {issues.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg bg-status-ok/5 p-3 text-sm text-status-ok">
              <CheckCircle2 className="h-4 w-4" /> Semua data lolos pemeriksaan.
            </p>
          ) : (
            <ul className="space-y-2">
              {issues.map((i) => {
                const isAccepted = i.severity === "warning" && !!accepted[i.key];
                return (
                  <li key={i.key} className="flex flex-wrap items-start gap-3 rounded-lg border border-sand-200 p-3">
                    {i.severity === "error" ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" aria-label="Wajib diperbaiki" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warn" aria-label="Perlu diperiksa" />
                    )}
                    <div className="min-w-0 flex-1 text-sm text-navy-900">
                      <p>{i.message}</p>
                      <p className="mt-0.5 text-[11px] text-navy-700/60">
                        {i.severity === "error" ? "Wajib diperbaiki" : isAccepted ? `Diterima: “${accepted[i.key]}”` : "Perlu diperiksa — boleh diterima dengan alasan"}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Link href={`/data?tab=${i.tab === "scope" ? "input" : i.tab}`} className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-brand-blue hover:bg-sand-100">
                        Perbaiki
                      </Link>
                      {i.severity === "warning" && !isAccepted && (
                        <Button size="sm" variant="secondary" disabled={approved || !can(role, "acceptWarning")} onClick={() => setAccepting(i)}>
                          Terima dengan alasan
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-sand-200 pt-3 text-xs text-navy-700/70">
            Setelah data disetujui, tekan
            <Button size="sm" onClick={() => runCalculation("draft")} disabled={v.errors > 0}>
              Hitung hasil
            </Button>
            untuk menyimpan hasil dengan nomor.
          </div>
        </CardBody>
      </Card>
      <ReasonDialog
        open={!!accepting}
        title="Terima peringatan"
        description={accepting?.message ?? ""}
        confirmLabel="Terima"
        onCancel={() => setAccepting(null)}
        onConfirm={(r) => {
          if (accepting) acceptWarning(accepting.key, r);
          setAccepting(null);
        }}
      />
    </div>
  );
}
