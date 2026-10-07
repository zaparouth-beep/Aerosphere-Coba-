"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, CheckCircle2, ExternalLink, ShieldAlert, XCircle } from "lucide-react";
import { BarList } from "@/components/charts/Charts";
import { sequentialColor } from "@/components/charts/palette";
import { Badge, SeverityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout, ProgressBar, ReasonDialog } from "@/components/ui/Feedback";
import { KpiCard } from "@/components/ui/KpiCard";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { can } from "@/lib/domain/permissions";
import { STAGE_IDS } from "@/lib/engine/lci";
import { PEDIGREE_KEYS, type Issue } from "@/lib/engine/quality";
import { concentrationFactor } from "@/lib/engine/units";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults } from "@/lib/store/useResults";
import { stageLabel } from "@/lib/view/helpers";
import { fmt, fmtDate } from "@/lib/utils/format";

const TAB_FOR: Record<Issue["tab"], string> = {
  input: "input",
  air: "air",
  effluent: "effluent",
  waste: "waste",
  production: "production",
  prices: "prices",
  mapping: "mapping",
  scope: "input",
};

export default function KualitasDataPage() {
  const project = useAppStore((s) => s.project);
  const role = useAppStore((s) => s.user.role);
  const acceptWarning = useAppStore((s) => s.acceptWarning);
  const revokeWarning = useAppStore((s) => s.revokeWarning);
  const approveDataset = useAppStore((s) => s.approveDataset);
  const { results, isLive } = useActiveResults();
  const v = results.validation;
  const [accepting, setAccepting] = useState<Issue | null>(null);
  const accepted = project.dataset.acceptedWarnings;
  const openWarnings = v.issues.filter((i) => i.severity === "warning" && !accepted[i.key]).length;

  const pedigreeByStage = STAGE_IDS.map((s) => {
    const rows = project.inputs.filter((i) => i.stageId === s && i.quantity > 0);
    const avg = (k: (typeof PEDIGREE_KEYS)[number]["key"]) => (rows.length ? rows.reduce((a, r) => a + r.meta.pedigree[k], 0) / rows.length : undefined);
    return { stage: s, values: Object.fromEntries(PEDIGREE_KEYS.map((k) => [k.key, avg(k.key)])) as Record<string, number | undefined> };
  });

  const compliance = project.effluent.filter((e) => concentrationFactor(e.unit) !== null);
  const sortedIssues = [...v.issues].sort((a, b) => ["error", "warning", "info"].indexOf(a.severity) - ["error", "warning", "info"].indexOf(b.severity));

  return (
    <div className="space-y-6">
      {!isLive && <Callout tone="info">Validasi di halaman ini selalu dijalankan pada data run yang dipilih. Pilih “Draf langsung” untuk memvalidasi data terbaru.</Callout>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Kelengkapan" value={fmt(v.completenessPct, 0)} unit="% aliran terisi" />
        <KpiCard label="Error / warning" value={`${v.errors} / ${v.warnings}`} tone={v.errors ? "warn" : "default"} hint={`${openWarnings} warning belum diterima`} />
        <KpiCard label="Neraca air" value={fmt(v.water.closurePct, 1)} unit="% closure" hint={`${fmt(v.water.inM3, 2)} m³ masuk`} tone={v.water.closurePct < 90 ? "warn" : "default"} />
        <KpiCard label="Neraca logam" value={v.metal ? fmt(Math.min(v.metal.closurePct, 999), 1) : "–"} unit={v.metal ? "% lapisan/input" : ""} hint={v.metal ? `${fmt(v.metal.coatingKg, 2)} kg lapisan` : "ketebalan belum diisi"} />
        <KpiCard label="Pedigree rata-rata" value={fmt(v.avgPedigree, 2)} unit="(1 terbaik – 5)" />
      </div>

      <Card>
        <CardHeader
          eyebrow="Titik kontrol 1 · FR-04.7"
          title={`Approval dataset v${project.dataset.version}`}
          subtitle={
            project.dataset.status === "approved"
              ? `Di-approve ${fmtDate(project.dataset.approvedAt)} oleh ${project.dataset.approvedBy} · hash ${project.dataset.hash?.slice(0, 16)}…`
              : "Error wajib diperbaiki; warning boleh diterima dengan alasan tertulis. Hanya dataset approved yang boleh dipakai untuk run resmi."
          }
          action={
            project.dataset.status === "approved" ? (
              <Badge tone="green">
                <BadgeCheck className="h-3.5 w-3.5" /> Approved
              </Badge>
            ) : (
              <Button variant="brand" disabled={!v.readyForApproval || !can(role, "approveDataset")} onClick={approveDataset}>
                <BadgeCheck className="h-4 w-4" /> Approve dataset
              </Button>
            )
          }
        />
        <CardBody>
          <ul className="grid gap-2 text-xs sm:grid-cols-3">
            <Check ok={v.errors === 0} label={v.errors === 0 ? "Tidak ada error pemblokir" : `${v.errors} error harus diperbaiki`} />
            <Check ok={openWarnings === 0} label={openWarnings === 0 ? "Semua warning diterima/selesai" : `${openWarnings} warning menunggu alasan`} />
            <Check ok={can(role, "approveDataset")} label={can(role, "approveDataset") ? "Peran Anda boleh approve" : "Butuh peran Data Steward/Admin"} />
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Daftar isu validasi" subtitle="Klik “buka” untuk menuju tab data yang bermasalah" />
        <CardBody>
          {sortedIssues.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-status-ok">
              <CheckCircle2 className="h-4 w-4" /> Tidak ada isu.
            </p>
          ) : (
            <Table caption="Isu validasi">
              <THead>
                <tr>
                  <Th>Tingkat</Th>
                  <Th>Aturan</Th>
                  <Th className="min-w-[320px]">Pesan</Th>
                  <Th>Nilai / acuan</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </THead>
              <tbody>
                {sortedIssues.map((i) => (
                  <Tr key={i.key}>
                    <Td>
                      <SeverityBadge severity={i.severity} />
                    </Td>
                    <Td className="num text-[11px]">{i.code}</Td>
                    <Td className="text-xs leading-relaxed">
                      {i.message}
                      {i.compliance && (
                        <Badge tone="blue" className="ml-1">
                          kepatuhan
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-xs">{i.value ? `${i.value} vs ${i.reference}` : "–"}</Td>
                    <Td className="text-xs">
                      {i.severity === "warning" && accepted[i.key] ? (
                        <span title={accepted[i.key]}>
                          <Badge tone="green">diterima</Badge>
                          <span className="mt-0.5 block max-w-[220px] truncate text-[11px] text-navy-700/60">“{accepted[i.key]}”</span>
                        </span>
                      ) : i.severity === "error" ? (
                        <Badge tone="red">wajib diperbaiki</Badge>
                      ) : i.severity === "warning" ? (
                        <Badge tone="gold">terbuka</Badge>
                      ) : (
                        <Badge>info</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/data-proses?tab=${TAB_FOR[i.tab]}`} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-brand-blue hover:bg-sand-100">
                          buka <ExternalLink className="h-3 w-3" />
                        </Link>
                        {i.severity === "warning" &&
                          (accepted[i.key] ? (
                            <Button size="sm" variant="ghost" disabled={!can(role, "acceptWarning") || project.dataset.status === "approved"} onClick={() => revokeWarning(i.key)}>
                              Batalkan
                            </Button>
                          ) : (
                            <Button size="sm" variant="secondary" disabled={!can(role, "acceptWarning") || project.dataset.status === "approved"} onClick={() => setAccepting(i)}>
                              Terima dengan alasan
                            </Button>
                          ))}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Neraca air (FR-04.3)" subtitle="Air masuk = efluen + penguapan/air di produk & lumpur; toleransi ±10%" />
          <CardBody className="space-y-4">
            <BarList
              format={(n) => `${fmt(n, 2)} m³`}
              items={[
                { label: "Air masuk (proses + DI/RO)", value: v.water.inM3, color: "#0072B2" },
                { label: "Efluen", value: project.production.effluentVolumeM3, color: "#56B4E9" },
                { label: "Penguapan + air di produk/lumpur", value: project.production.waterEvaporatedM3, color: "#009E73" },
                { label: "Selisih tak terjelaskan", value: Math.abs(v.water.inM3 - v.water.outM3), color: "#D55E00" },
              ]}
            />
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span>Closure</span>
                <span className="num font-medium">{fmt(v.water.closurePct, 1)}%</span>
              </div>
              <ProgressBar value={v.water.closurePct} tone={v.water.closurePct >= 90 ? "green" : "red"} label="Closure neraca air" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Matriks pedigree per tahap" subtitle="Rata-rata skor 1 (terbaik) – 5 (terburuk) dari aliran terisi" />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-[3px] text-xs">
                <thead>
                  <tr>
                    <th className="px-2 text-left font-medium text-navy-700/70">Tahap</th>
                    {PEDIGREE_KEYS.map((k) => (
                      <th key={k.key} className="px-1 text-center text-[11px] font-medium text-navy-700/70">
                        {k.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pedigreeByStage.map((row) => (
                    <tr key={row.stage}>
                      <th scope="row" className="whitespace-nowrap px-2 text-left font-medium text-navy-900">
                        {stageLabel(project, row.stage)}
                      </th>
                      {PEDIGREE_KEYS.map((k) => {
                        const val = row.values[k.key];
                        const t = val === undefined ? 0 : (val - 1) / 4;
                        return (
                          <td key={k.key} className="p-0">
                            <div
                              className="num flex h-8 items-center justify-center rounded-md text-[11px] font-medium"
                              style={val === undefined ? { background: "#f7f5ef", color: "#9aa0ad" } : { background: sequentialColor(t), color: t > 0.5 ? "#fff" : "#0b1660" }}
                              title={val === undefined ? "Tidak ada data" : `${k.label}: ${fmt(val, 1)}`}
                            >
                              {val === undefined ? "–" : fmt(val, 1)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-navy-700/55">Warna lebih gelap = kualitas lebih rendah. Edit pedigree per baris lewat ikon pensil di Data Proses.</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Kepatuhan baku mutu efluen (FR-04.5)"
          subtitle="Temuan kepatuhan dilaporkan terpisah dari LCIA. Baku mutu diisi sesuai regulasi yang berlaku di fasilitas (mis. baku mutu air limbah usaha pelapisan logam)."
          action={<ShieldAlert className="h-4 w-4 text-navy-700/40" />}
        />
        <CardBody>
          <Table caption="Status baku mutu efluen">
            <THead>
              <tr>
                <Th>Parameter</Th>
                <Th align="right">Aktual</Th>
                <Th align="right">Baku mutu</Th>
                <Th>Status</Th>
                <Th className="min-w-[160px]">Terhadap batas</Th>
              </tr>
            </THead>
            <tbody>
              {compliance.map((e) => {
                const over = e.limit !== undefined && e.value > e.limit;
                const ratio = e.limit ? (e.value / e.limit) * 100 : 0;
                return (
                  <Tr key={e.id}>
                    <Td className="font-medium">{e.parameter}</Td>
                    <Td num>
                      {fmt(e.value, 3)} {e.unit}
                    </Td>
                    <Td num>{e.limit !== undefined ? `${fmt(e.limit, 3)} ${e.unit}` : "belum diisi"}</Td>
                    <Td>
                      {e.limit === undefined ? (
                        <Badge>belum dicek</Badge>
                      ) : over ? (
                        <Badge tone="red">
                          <XCircle className="h-3 w-3" /> melebihi
                        </Badge>
                      ) : (
                        <Badge tone="green">
                          <CheckCircle2 className="h-3 w-3" /> memenuhi
                        </Badge>
                      )}
                    </Td>
                    <Td>{e.limit !== undefined && <ProgressBar value={Math.min(ratio, 100)} tone={over ? "red" : ratio > 80 ? "gold" : "green"} label={`${e.parameter} terhadap baku mutu`} />}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <ReasonDialog
        open={!!accepting}
        title="Terima peringatan dengan alasan"
        description={accepting?.message}
        confirmLabel="Terima"
        onCancel={() => setAccepting(null)}
        onConfirm={(reason) => {
          if (accepting) acceptWarning(accepting.key, reason);
          setAccepting(null);
        }}
      />
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-sand-200 px-3 py-2">
      {ok ? <CheckCircle2 className="h-4 w-4 text-status-ok" /> : <XCircle className="h-4 w-4 text-status-danger" />}
      {label}
    </li>
  );
}
