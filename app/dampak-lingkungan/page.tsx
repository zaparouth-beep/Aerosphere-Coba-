"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Upload } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { PROCESS_STAGES } from "@/lib/lca/constants";
import {
  ELEMENTARY_FLOWS,
  IMPACT_CATEGORIES,
  IMPACT_IDS,
  SOURCE_LABEL,
  computeLCIA,
  type SourceKey,
  type StageOrDirect,
} from "@/lib/lca/lcia";
import {
  buildBackgroundTemplate,
  parseBackgroundCSV,
  TEMPLATE_HEADERS,
} from "@/lib/lca/backgroundImport";
import { downloadCSV } from "@/lib/utils/export";
import { formatNumber, formatPercent } from "@/lib/utils/format";
import type { ImpactFactors, ImpactId, LCICategory } from "@/lib/lca/types";

const FU_LABEL = {
  m2_plated: "m²",
  part: "part",
  kg_metal_deposited: "kg logam",
} as const;

const CATEGORY_DEFAULTS: Array<{
  id: LCICategory;
  label: string;
  unit: string;
}> = [
  { id: "Energy", label: "Energi (listrik)", unit: "kWh" },
  { id: "Water", label: "Air proses", unit: "L" },
  { id: "Chemical", label: "Bahan kimia", unit: "kg" },
  { id: "Anode", label: "Anoda", unit: "kg" },
  { id: "WWTPChemical", label: "Bahan kimia WWTP", unit: "kg" },
  { id: "Consumable", label: "Consumable", unit: "kg" },
];

function formatImpact(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const abs = Math.abs(value);
  if (abs < 0.01 || abs >= 1e7) return value.toExponential(2);
  return formatNumber(value, abs < 1 ? 4 : 2);
}

export default function DampakLingkunganPage() {
  const project = useProjectStore((s) => s.project);
  const updateLCIInput = useProjectStore((s) => s.updateLCIInput);
  const updateHazardousWaste = useProjectStore((s) => s.updateHazardousWaste);
  const updateCategoryFactors = useProjectStore((s) => s.updateCategoryFactors);
  const applyBackgroundFactors = useProjectStore(
    (s) => s.applyBackgroundFactors,
  );

  const lcia = useMemo(() => computeLCIA(project), [project]);
  const fuLabel = FU_LABEL[project.functionalUnit.type];
  const [selected, setSelected] = useState<ImpactId>("gwp");
  const [csvText, setCsvText] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedDef = IMPACT_CATEGORIES.find((c) => c.id === selected)!;

  const sourceData = (Object.keys(SOURCE_LABEL) as SourceKey[])
    .map((k) => ({ label: SOURCE_LABEL[k], value: lcia.bySource[k][selected] }))
    .filter((d) => d.value !== 0)
    .sort((a, b) => b.value - a.value);

  const stageRows = (
    [...PROCESS_STAGES.map((s) => s.id), "direct"] as StageOrDirect[]
  ).map((id) => ({
    id,
    label:
      id === "direct"
        ? "Emisi langsung (tanpa tahap)"
        : `${PROCESS_STAGES.find((s) => s.id === id)?.code}. ${PROCESS_STAGES.find((s) => s.id === id)?.name}`,
    values: lcia.byStage[id],
  }));
  const topContributors = [...lcia.contributions]
    .filter((c) => c.values[selected] !== 0)
    .sort((a, b) => b.values[selected] - a.values[selected])
    .slice(0, 8);
  const total = lcia.totals[selected];

  const handleImport = (text: string) => {
    const { rows, errors } = parseBackgroundCSV(text);
    if (errors.length > 0 && rows.length === 0) {
      setImportMessage(errors.join(" "));
      return;
    }
    const result = applyBackgroundFactors(rows);
    setImportMessage(
      `${result.applied} baris diterapkan.` +
        (result.unmatched.length
          ? ` Tidak cocok dengan inventori: ${result.unmatched.join(", ")}.`
          : "") +
        (errors.length ? ` Catatan: ${errors.join(" ")}` : ""),
    );
  };

  const setLciFactor = (
    id: string,
    current: ImpactFactors | undefined,
    impact: ImpactId,
    raw: string,
  ) => {
    const next = { ...current };
    if (raw === "") delete next[impact];
    else next[impact] = Number(raw);
    updateLCIInput(id, { bgFactors: next });
  };
  const setWasteFactor = (
    id: string,
    current: ImpactFactors | undefined,
    impact: ImpactId,
    raw: string,
  ) => {
    const next = { ...current };
    if (raw === "") delete next[impact];
    else next[impact] = Number(raw);
    updateHazardousWaste(id, { bgFactors: next });
  };
  const setCategoryFactor = (
    cat: LCICategory,
    impact: ImpactId,
    raw: string,
  ) => {
    const next = { ...project.lcia?.categoryFactors?.[cat] };
    if (raw === "") delete next[impact];
    else next[impact] = Number(raw);
    updateCategoryFactors(cat, next);
  };

  return (
    <div className="space-y-6">
      {/* Goal & scope ------------------------------------------------------ */}
      <Card>
        <CardHeader
          title="Tujuan & Ruang Lingkup (ISO 14044 §4.2)"
          subtitle="Dasar interpretasi seluruh hasil di halaman ini"
        />
        <CardBody>
          <dl className="grid gap-x-8 gap-y-3 text-xs md:grid-cols-2">
            <ScopeItem
              term="Satuan fungsi"
              detail={`${formatNumber(project.functionalUnit.value)} ${fuLabel} hasil plating per proses (${project.part.partName}, ${project.part.material}). Semua hasil per proses dan per ${fuLabel}.`}
            />
            <ScopeItem
              term="Batas sistem"
              detail="Gate-to-gate: input dan output tahap A–F di Data Proses. Produksi hulu input (cradle-to-gate) masuk lewat faktor latar belakang dari database seperti ecoinvent yang dihitung di openLCA. Distribusi produk dan fase pakai tidak dicakup."
            />
            <ScopeItem
              term="Alokasi & cut-off"
              detail="Tidak ada alokasi (satu produk). Input tanpa faktor latar belakang dikeluarkan dari hasil dan dicatat pada pemeriksaan kelengkapan di bawah, bukan dianggap nol."
            />
            <ScopeItem
              term="Metode LCIA"
              detail="Klasifikasi dan karakterisasi saja: GWP100 (IPCC AR6), asidifikasi, eutrofikasi, dan deplesi abiotik (CML-IA baseline). Tanpa normalisasi atau pembobotan."
            />
          </dl>
        </CardBody>
      </Card>

      {/* Results ------------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {IMPACT_CATEGORIES.map((c) => (
          <StatTile
            key={c.id}
            label={c.short}
            value={formatImpact(lcia.perFunctionalUnit[c.id])}
            unit={`${c.unit}/${fuLabel}`}
            hint={
              lcia.uncertainty[c.id] > 0
                ? `± ${formatImpact(lcia.uncertainty[c.id] / (project.functionalUnit.value || 1))}`
                : undefined
            }
          />
        ))}
      </div>

      <Card>
        <CardHeader
          title="Hasil LCIA"
          subtitle="Σ kuantitas × faktor (latar belakang) + emisi langsung × faktor karakterisasi"
        />
        <CardBody>
          <Table>
            <THead>
              <tr>
                <Th>Kategori dampak</Th>
                <Th>Metode</Th>
                <Th>Per proses</Th>
                <Th>± Ketidakpastian</Th>
                <Th>Per {fuLabel}</Th>
                <Th>Kelengkapan input</Th>
              </tr>
            </THead>
            <tbody>
              {IMPACT_CATEGORIES.map((c) => {
                const cov = lcia.coverage.find((r) => r.impact === c.id)!;
                const complete =
                  cov.totalCount > 0 && cov.coveredCount === cov.totalCount;
                return (
                  <Tr key={c.id}>
                    <Td className="font-medium">{c.label}</Td>
                    <Td className="text-xs text-navy-700/60">{c.method}</Td>
                    <Td className="whitespace-nowrap">
                      {formatImpact(lcia.totals[c.id])} {c.unit}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {lcia.uncertainty[c.id] > 0
                        ? `± ${formatImpact(lcia.uncertainty[c.id])}`
                        : "-"}
                    </Td>
                    <Td className="whitespace-nowrap font-semibold">
                      {formatImpact(lcia.perFunctionalUnit[c.id])} {c.unit}/
                      {fuLabel}
                    </Td>
                    <Td>
                      <Badge tone={complete ? "green" : "red"}>
                        {cov.coveredCount}/{cov.totalCount} input
                      </Badge>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      {/* Contribution analysis --------------------------------------------- */}
      <Card>
        <CardHeader
          title="Analisis Kontribusi (ISO 14044 §4.5)"
          subtitle="Sumber dan tahap proses yang paling besar menyumbang dampak"
        />
        <div className="flex flex-wrap gap-1 border-b border-sand-200 px-5 pt-3">
          {IMPACT_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c.id)}
              className={
                selected === c.id
                  ? "rounded-t-lg border-b-2 border-navy-900 px-3 py-2 text-xs font-medium text-navy-900"
                  : "rounded-t-lg px-3 py-2 text-xs font-medium text-navy-700/50 hover:text-navy-900"
              }
            >
              {c.short}
            </button>
          ))}
        </div>
        <CardBody className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold text-navy-900">
              Per sumber ({selectedDef.unit}/proses)
            </p>
            {sourceData.length > 0 ? (
              <HorizontalBarChart
                data={sourceData}
                categoryKey="label"
                valueKey="value"
                valueFormatter={(v) => `${formatImpact(v)} ${selectedDef.unit}`}
              />
            ) : (
              <p className="rounded-lg bg-sand-100 p-4 text-xs text-navy-700/60">
                Belum ada kontribusi untuk {selectedDef.short}. Isi faktor latar
                belakang di bagian bawah atau pilih aliran LCIA pada emisi di
                Data Proses.
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-navy-900">
              Per tahap proses
            </p>
            <Table>
              <THead>
                <tr>
                  <Th>Tahap</Th>
                  <Th>{selectedDef.unit}</Th>
                  <Th className="w-20">%</Th>
                </tr>
              </THead>
              <tbody>
                {stageRows.map((row) => (
                  <Tr key={row.id}>
                    <Td className="text-xs">{row.label}</Td>
                    <Td className="whitespace-nowrap text-xs">
                      {formatImpact(row.values[selected])}
                    </Td>
                    <Td className="text-xs">
                      {total > 0
                        ? formatPercent((row.values[selected] / total) * 100)
                        : "-"}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-2 text-xs font-semibold text-navy-900">
              8 kontributor terbesar
            </p>
            <Table>
              <THead>
                <tr>
                  <Th>Aliran</Th>
                  <Th>Sumber</Th>
                  <Th>Kuantitas</Th>
                  <Th>{selectedDef.unit}</Th>
                  <Th className="w-20">%</Th>
                </tr>
              </THead>
              <tbody>
                {topContributors.length === 0 && (
                  <Tr>
                    <Td className="text-xs text-navy-700/60">
                      Belum ada data.
                    </Td>
                    <Td>{""}</Td>
                    <Td>{""}</Td>
                    <Td>{""}</Td>
                    <Td>{""}</Td>
                  </Tr>
                )}
                {topContributors.map((c) => (
                  <Tr key={c.id}>
                    <Td className="text-xs font-medium">{c.name}</Td>
                    <Td className="text-xs text-navy-700/60">
                      {SOURCE_LABEL[c.source]}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {formatNumber(c.quantity, 2)} {c.unit}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {formatImpact(c.values[selected])}
                    </Td>
                    <Td className="text-xs">
                      {total > 0
                        ? formatPercent((c.values[selected] / total) * 100)
                        : "-"}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </CardBody>
      </Card>

      {/* Interpretation checks --------------------------------------------- */}
      <Card>
        <CardHeader
          title="Pemeriksaan Kelengkapan & Kualitas Data (ISO 14044 §4.5.3)"
          subtitle="Hasil di atas hanya sah untuk input yang punya faktor"
        />
        <CardBody className="space-y-4">
          <Table>
            <THead>
              <tr>
                <Th>Kategori</Th>
                <Th>Input berfaktor</Th>
                <Th>Massa berfaktor (input kg)</Th>
                <Th>Input belum berfaktor</Th>
              </tr>
            </THead>
            <tbody>
              {lcia.coverage.map((row) => {
                const def = IMPACT_CATEGORIES.find((c) => c.id === row.impact)!;
                return (
                  <Tr key={row.impact}>
                    <Td className="whitespace-nowrap font-medium">
                      {def.short}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {row.coveredCount}/{row.totalCount}
                    </Td>
                    <Td className="whitespace-nowrap text-xs">
                      {formatPercent(row.coveredMassPct, 0)}
                    </Td>
                    <Td className="text-xs text-navy-700/70">
                      {row.missing.length === 0
                        ? "Semua lengkap"
                        : row.missing.length > 6
                          ? `${row.missing.slice(0, 6).join(", ")}, +${row.missing.length - 6} lainnya`
                          : row.missing.join(", ")}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <ul className="space-y-1.5 text-xs text-navy-700">
            {lcia.uncharacterised.length > 0 && (
              <Note>
                Emisi langsung berikut ada di inventori tetapi tidak punya
                faktor karakterisasi pada empat kategori ini (butuh kategori
                toksisitas, mis. USEtox): {lcia.uncharacterised.join(", ")}.
              </Note>
            )}
            {lcia.warnings.map((w) => (
              <Note key={w}>{w}</Note>
            ))}
            <li className="flex gap-2 text-navy-700/70">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-green" />
              Ketidakpastian dihitung dari kolom Uncertainty (%) tiap input LCI
              (akar jumlah kuadrat, diasumsikan independen). Limbah dan emisi
              langsung belum memiliki ketidakpastian.
            </li>
          </ul>
        </CardBody>
      </Card>

      {/* Background factors ------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Faktor Latar Belakang (cradle-to-gate)"
          subtitle="Dampak untuk memproduksi 1 satuan input. Hitung di openLCA dengan database ecoinvent, lalu isi atau impor di sini"
        />
        <CardBody className="space-y-5">
          <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-navy-700/80">
            <li>Unduh template, daftar input dan limbah sudah terisi.</li>
            <li>
              Di openLCA, buat product system dari proses ecoinvent tiap input
              (mis. listrik grid Indonesia, nikel sulfat, kromat), hitung dengan
              metode CML-IA baseline dan IPCC 2021 GWP100 untuk 1 satuan dasar
              (kg, L, atau kWh).
            </li>
            <li>
              Isi kolom gwp, ap, ep, adp_fossil, adp_elements (dan nama proses
              ecoinvent yang dipakai), lalu impor CSV-nya.
            </li>
          </ol>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const rows = buildBackgroundTemplate(project);
                downloadCSV(
                  rows.length
                    ? rows
                    : [
                        Object.fromEntries(
                          TEMPLATE_HEADERS.map((h) => [h, ""]),
                        ),
                      ],
                  "template-faktor-latar-belakang.csv",
                );
              }}
            >
              <Download className="h-4 w-4" /> Unduh template CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" /> Impor file CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(await file.text());
                e.target.value = "";
              }}
            />
          </div>
          <div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={4}
              placeholder="Atau tempel isi CSV di sini (pemisah koma atau titik koma)"
              className="w-full rounded-lg border border-sand-200 bg-white p-3 font-mono text-xs text-navy-900 outline-none focus:border-navy-700 focus:ring-1 focus:ring-navy-700"
            />
            <Button
              className="mt-2"
              disabled={csvText.trim() === ""}
              onClick={() => handleImport(csvText)}
            >
              Terapkan
            </Button>
            {importMessage && (
              <p className="mt-2 text-xs text-navy-700">{importMessage}</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-navy-900">
              Faktor default per kategori (dipakai bila input tidak punya faktor
              sendiri)
            </p>
            <FactorTable>
              {CATEGORY_DEFAULTS.map((cat) => (
                <Tr key={cat.id}>
                  <Td className="whitespace-nowrap text-xs font-medium">
                    {cat.label}{" "}
                    <span className="text-navy-700/50">per {cat.unit}</span>
                  </Td>
                  <Td>{""}</Td>
                  {IMPACT_IDS.map((id) => (
                    <Td key={id}>
                      <FactorInput
                        value={project.lcia?.categoryFactors?.[cat.id]?.[id]}
                        onChange={(raw) => setCategoryFactor(cat.id, id, raw)}
                      />
                    </Td>
                  ))}
                </Tr>
              ))}
            </FactorTable>
          </div>

          <details>
            <summary className="cursor-pointer text-xs font-semibold text-navy-900">
              Faktor per item ({project.lciInputs.length} input +{" "}
              {project.hazardousWaste.length} limbah)
            </summary>
            <div className="mt-3">
              <FactorTable>
                {project.lciInputs.map((e) => (
                  <Tr key={e.id}>
                    <Td className="text-xs font-medium">
                      {e.name}{" "}
                      <span className="text-navy-700/50">
                        per {e.unit.split("/")[0]}
                      </span>
                    </Td>
                    <Td>
                      <Input
                        value={e.bgProcess ?? ""}
                        placeholder="Proses ecoinvent"
                        onChange={(ev) =>
                          updateLCIInput(e.id, { bgProcess: ev.target.value })
                        }
                      />
                    </Td>
                    {IMPACT_IDS.map((id) => (
                      <Td key={id}>
                        <FactorInput
                          value={e.bgFactors?.[id]}
                          onChange={(raw) =>
                            setLciFactor(e.id, e.bgFactors, id, raw)
                          }
                        />
                      </Td>
                    ))}
                  </Tr>
                ))}
                {project.hazardousWaste.map((w) => (
                  <Tr key={w.id}>
                    <Td className="text-xs font-medium">
                      {w.wasteType}{" "}
                      <span className="text-navy-700/50">per kg limbah</span>
                    </Td>
                    <Td>
                      <Input
                        value={w.bgProcess ?? ""}
                        placeholder="Proses ecoinvent"
                        onChange={(ev) =>
                          updateHazardousWaste(w.id, {
                            bgProcess: ev.target.value,
                          })
                        }
                      />
                    </Td>
                    {IMPACT_IDS.map((id) => (
                      <Td key={id}>
                        <FactorInput
                          value={w.bgFactors?.[id]}
                          onChange={(raw) =>
                            setWasteFactor(w.id, w.bgFactors, id, raw)
                          }
                        />
                      </Td>
                    ))}
                  </Tr>
                ))}
              </FactorTable>
            </div>
          </details>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Emisi Udara"
            subtitle="Inventori langsung dari Data Proses"
          />
          <CardBody>
            <Table>
              <THead>
                <tr>
                  <Th>Parameter</Th>
                  <Th>Berlaku</Th>
                  <Th className="w-32">kg/proses</Th>
                </tr>
              </THead>
              <tbody>
                {project.airEmissions.map((e) => (
                  <Tr key={e.id}>
                    <Td>{e.parameter}</Td>
                    <Td>
                      <Badge tone={e.applicable ? "green" : "neutral"}>
                        {e.applicable ? "Ya" : "Tidak"}
                      </Badge>
                    </Td>
                    <Td>
                      {e.applicable ? formatNumber(e.valueKgPerPeriod, 2) : "-"}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Efluen Air (WWTP outlet)"
            subtitle="Parameter kualitas air limbah hasil olahan"
          />
          <CardBody>
            <Table>
              <THead>
                <tr>
                  <Th>Parameter</Th>
                  <Th className="w-24">Unit</Th>
                  <Th className="w-32">Nilai</Th>
                </tr>
              </THead>
              <tbody>
                {project.waterEffluent.map((e) => (
                  <Tr key={e.id}>
                    <Td>{e.parameter}</Td>
                    <Td className="text-xs text-navy-700/60">{e.unit}</Td>
                    <Td>{formatNumber(e.value, 2)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>

      {/* Direct flows ------------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Faktor Karakterisasi Emisi Langsung"
          subtitle="Dipakai untuk emisi udara dan efluen air di Data Proses (per kg zat yang dilepas)"
        />
        <CardBody>
          <Table>
            <THead>
              <tr>
                <Th>Zat</Th>
                <Th>Media</Th>
                {IMPACT_CATEGORIES.slice(0, 3).map((c) => (
                  <Th key={c.id}>
                    {c.short} ({c.unit}/kg)
                  </Th>
                ))}
              </tr>
            </THead>
            <tbody>
              {ELEMENTARY_FLOWS.map((f) => (
                <Tr key={f.key}>
                  <Td className="text-xs font-medium">{f.label}</Td>
                  <Td className="text-xs text-navy-700/60">
                    {f.medium === "air" ? "Udara" : "Air"}
                  </Td>
                  {IMPACT_CATEGORIES.slice(0, 3).map((c) => (
                    <Td key={c.id} className="text-xs">
                      {f.factors[c.id] ?? "-"}
                    </Td>
                  ))}
                </Tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-[11px] leading-relaxed text-navy-700/60">
            Nilai mengikuti IPCC AR6 (GWP100) dan CML-IA baseline. Cocokkan
            dengan versi metode yang terpasang di openLCA sebelum dipakai untuk
            pelaporan. Cr(VI), Ni, Cd, dan logam lain adalah dampak toksisitas,
            bukan empat kategori di halaman ini.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function ScopeItem({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="font-semibold text-navy-900">{term}</dt>
      <dd className="mt-0.5 leading-relaxed text-navy-700/70">{detail}</dd>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-red" />
      {children}
    </li>
  );
}

function FactorTable({ children }: { children: React.ReactNode }) {
  return (
    <Table>
      <THead>
        <tr>
          <Th>Input</Th>
          <Th className="w-44">Proses ecoinvent</Th>
          {IMPACT_CATEGORIES.map((c) => (
            <Th key={c.id} className="w-28">
              {c.short}
              <span className="block text-[10px] font-normal normal-case opacity-70">
                {c.unit}
              </span>
            </Th>
          ))}
        </tr>
      </THead>
      <tbody>{children}</tbody>
    </Table>
  );
}

/** Blank = factor not provided (excluded and reported), 0 = a deliberate zero. */
function FactorInput({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (raw: string) => void;
}) {
  return (
    <Input
      type="number"
      step="any"
      min={0}
      placeholder="-"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
