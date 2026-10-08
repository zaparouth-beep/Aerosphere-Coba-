"use client";

import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, NumberInput, Select, TextInput } from "@/components/ui/Input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import type { Basis, InputCategory, MappingStatus, Project, StageId } from "@/lib/domain/types";
import { resolveFlowKey } from "@/lib/engine/method";
import { categoryPrice } from "@/lib/engine/mfca";
import type { Issue } from "@/lib/engine/quality";
import { BASIS_LABEL, CANONICAL, CATEGORY_DIMENSION, UNIT_OPTIONS } from "@/lib/engine/units";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils/cn";
import { fmt } from "@/lib/utils/format";
import { MetaCell, StageDot, StageSelect } from "./common";

export const CATEGORY_LABEL: Record<InputCategory, string> = {
  Chemical: "Bahan kimia",
  Anode: "Anoda",
  Water: "Air",
  Energy: "Listrik & energi",
  WWTPChemical: "Kimia pengolahan air limbah",
  Consumable: "Bahan habis pakai",
};

const BASES: Basis[] = ["period", "month", "batch"];

function rowTone(issues: Map<string, Issue["severity"]>, id: string) {
  const s = issues.get(id);
  return s === "error" ? "bg-status-danger/5" : s === "warning" ? "bg-status-warn/5" : "";
}

function BasisSelect({ value, onChange, disabled }: { value: Basis; onChange: (b: Basis) => void; disabled?: boolean }) {
  return (
    <Select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Basis)} aria-label="Basis waktu" className="w-[112px]">
      {BASES.map((b) => (
        <option key={b} value={b}>
          {BASIS_LABEL[b]}
        </option>
      ))}
    </Select>
  );
}

/* ------------------------------- LCI input ------------------------------- */

export function InputTable({
  project,
  categories,
  stage,
  readOnly,
  issues,
}: {
  project: Project;
  categories: InputCategory[];
  stage: StageId | null;
  readOnly: boolean;
  issues: Map<string, Issue["severity"]>;
}) {
  const updateItem = useAppStore((s) => s.updateItem);
  const removeItem = useAppStore((s) => s.removeItem);
  const addInput = useAppStore((s) => s.addInput);
  const rows = project.inputs.filter((i) => categories.includes(i.category) && (!stage || i.stageId === stage)).sort((a, b) => a.no - b.no);

  return (
    <div className="space-y-3">
      <Table caption="LCI input">
        <THead>
          <tr>
            <Th>No</Th>
            <Th>Kategori</Th>
            <Th className="min-w-[200px]">Aliran</Th>
            <Th>Tahap</Th>
            <Th align="right">Kuantitas</Th>
            <Th>Unit</Th>
            <Th>Basis</Th>
            <Th className="min-w-[170px]">Sumber & kualitas</Th>
            <Th align="right">Harga riil (Rp/unit)</Th>
            <Th />
          </tr>
        </THead>
        <tbody>
          {rows.map((i) => (
            <Tr key={i.id} className={rowTone(issues, i.id)}>
              <Td num className="text-navy-700/60">
                {i.no}
              </Td>
              <Td>
                <Select value={i.category} disabled={readOnly} aria-label="Kategori" className="w-[132px]" onChange={(e) => updateItem("inputs", i.id, { category: e.target.value as InputCategory, unit: UNIT_OPTIONS[e.target.value as InputCategory][0] })}>
                  {(Object.keys(CATEGORY_LABEL) as InputCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </Td>
              <Td>
                <TextInput value={i.name} disabled={readOnly} ariaLabel="Nama aliran" onCommit={(v) => updateItem("inputs", i.id, { name: v })} />
                {i.meta.note && <p className="mt-0.5 text-[10px] leading-snug text-navy-700/55">{i.meta.note}</p>}
              </Td>
              <Td>
                <StageSelect value={i.stageId} disabled={readOnly} onChange={(v) => updateItem("inputs", i.id, { stageId: v })} />
              </Td>
              <Td>
                <NumberInput value={i.quantity} min={0} disabled={readOnly} ariaLabel={`Kuantitas ${i.name}`} className="w-[110px]" onCommit={(v) => updateItem("inputs", i.id, { quantity: v ?? 0 })} />
              </Td>
              <Td>
                <Select value={i.unit} disabled={readOnly} aria-label="Unit" className="w-[80px]" onChange={(e) => updateItem("inputs", i.id, { unit: e.target.value })}>
                  {[...new Set([i.unit, ...UNIT_OPTIONS[i.category]])].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Td>
              <Td>
                <BasisSelect value={i.basis} disabled={readOnly} onChange={(b) => updateItem("inputs", i.id, { basis: b })} />
              </Td>
              <Td>
                <MetaCell meta={i.meta} disabled={readOnly} onChange={(m) => updateItem("inputs", i.id, { meta: m })} />
              </Td>
              <Td>
                <NumberInput
                  value={i.unitPriceRp}
                  allowEmpty
                  min={0}
                  disabled={readOnly}
                  ariaLabel={`Harga ${i.name}`}
                  className="w-[120px]"
                  placeholder={categoryPrice(project, i.category) > 0 ? `kategori ${fmt(categoryPrice(project, i.category), 0)}` : `Rp/${CANONICAL[CATEGORY_DIMENSION[i.category]]}`}
                  onCommit={(v) => updateItem("inputs", i.id, { unitPriceRp: v })}
                />
              </Td>
              <Td>
                <IconButton label={`Hapus ${i.name}`} disabled={readOnly} onClick={() => removeItem("inputs", i.id)} className="hover:text-status-danger">
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </Td>
            </Tr>
          ))}
          {!rows.length && (
            <Tr>
              <Td colSpan={10} className="py-6 text-center text-xs text-navy-700/55">
                Tidak ada aliran untuk filter ini.
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Button key={c} variant="secondary" size="sm" onClick={() => addInput(c, stage ?? (c === "Energy" ? "E" : c === "WWTPChemical" ? "F" : "C"))}>
              <Plus className="h-3.5 w-3.5" /> {CATEGORY_LABEL[c]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Air emissions ---------------------------- */

export function AirTable({ project, readOnly, stage }: { project: Project; readOnly: boolean; stage: StageId | null }) {
  const updateItem = useAppStore((s) => s.updateItem);
  const removeItem = useAppStore((s) => s.removeItem);
  const add = useAppStore((s) => s.addAirEmission);
  const flows = project.method.flows.filter((f) => f.compartment === "air");
  const rows = project.airEmissions.filter((a) => !stage || a.stageId === stage);
  return (
    <div className="space-y-3">
      <Table caption="Emisi udara">
        <THead>
          <tr>
            <Th className="min-w-[160px]">Emisi</Th>
            <Th className="min-w-[160px]">Relevansi</Th>
            <Th>Tahap</Th>
            <Th>Berlaku</Th>
            <Th align="right">Nilai (kg)</Th>
            <Th>Basis</Th>
            <Th className="min-w-[180px]">Aliran elementer (LCIA)</Th>
            <Th>Kualitas</Th>
            <Th />
          </tr>
        </THead>
        <tbody>
          {rows.map((a) => {
            const auto = resolveFlowKey(a.parameter, undefined, "air");
            return (
              <Tr key={a.id}>
                <Td>
                  <TextInput value={a.parameter} disabled={readOnly} ariaLabel="Emisi" onCommit={(v) => updateItem("airEmissions", a.id, { parameter: v })} />
                </Td>
                <Td>
                  <TextInput value={a.relevance} disabled={readOnly} ariaLabel="Relevansi" onCommit={(v) => updateItem("airEmissions", a.id, { relevance: v })} />
                </Td>
                <Td>
                  <StageSelect value={a.stageId} disabled={readOnly} onChange={(v) => updateItem("airEmissions", a.id, { stageId: v })} />
                </Td>
                <Td>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" disabled={readOnly} checked={a.applicable} onChange={(e) => updateItem("airEmissions", a.id, { applicable: e.target.checked })} />
                    {a.applicable ? "Ya" : "Tidak"}
                  </label>
                </Td>
                <Td>
                  <NumberInput value={a.quantityKg} min={0} disabled={readOnly || !a.applicable} className="w-[100px]" ariaLabel={`Nilai ${a.parameter}`} onCommit={(v) => updateItem("airEmissions", a.id, { quantityKg: v ?? 0 })} />
                </Td>
                <Td>
                  <BasisSelect value={a.basis} disabled={readOnly} onChange={(b) => updateItem("airEmissions", a.id, { basis: b })} />
                </Td>
                <Td>
                  <Select value={a.flowKey ?? ""} disabled={readOnly} aria-label="Aliran elementer" onChange={(e) => updateItem("airEmissions", a.id, { flowKey: e.target.value || undefined })}>
                    <option value="">{auto ? `Otomatis: ${flows.find((f) => f.key === auto)?.label ?? auto}` : "Otomatis (tidak cocok)"}</option>
                    <option value="none">Tidak dikarakterisasi</option>
                    {flows.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <MetaCell meta={a.meta} disabled={readOnly} onChange={(m) => updateItem("airEmissions", a.id, { meta: m })} />
                </Td>
                <Td>
                  <IconButton label={`Hapus ${a.parameter}`} disabled={readOnly} onClick={() => removeItem("airEmissions", a.id)} className="hover:text-status-danger">
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      {!readOnly && (
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Tambah emisi udara
        </Button>
      )}
    </div>
  );
}

/* --------------------------------- Effluent ------------------------------ */

export function EffluentTable({ project, readOnly, issues }: { project: Project; readOnly: boolean; issues: Map<string, Issue["severity"]> }) {
  const updateItem = useAppStore((s) => s.updateItem);
  const removeItem = useAppStore((s) => s.removeItem);
  const add = useAppStore((s) => s.addEffluent);
  const updateProduction = useAppStore((s) => s.updateProduction);
  const flows = project.method.flows.filter((f) => f.compartment === "water");
  return (
    <div className="space-y-3">
      <div className="grid max-w-md grid-cols-2 gap-3">
        <Field label="Volume efluen per periode (m³)" hint="Beban polutan = volume × konsentrasi (PRD 2.2.4).">
          <NumberInput value={project.production.effluentVolumeM3} min={0} disabled={readOnly} onCommit={(v) => updateProduction({ effluentVolumeM3: v ?? 0 })} />
        </Field>
      </div>
      <Table caption="Efluen">
        <THead>
          <tr>
            <Th className="min-w-[140px]">Parameter</Th>
            <Th>Unit</Th>
            <Th align="right">Nilai</Th>
            <Th align="right">Baku mutu</Th>
            <Th align="right">Beban (kg/periode)</Th>
            <Th className="min-w-[180px]">Aliran elementer (LCIA)</Th>
            <Th />
          </tr>
        </THead>
        <tbody>
          {project.effluent.map((e) => {
            const auto = resolveFlowKey(e.parameter, undefined, "water");
            const isConc = /\/l$|\/m3$/i.test(e.unit);
            const factor = e.unit.toLowerCase() === "mg/l" ? 1e-3 : e.unit.toLowerCase() === "g/l" ? 1 : e.unit.toLowerCase() === "µg/l" ? 1e-6 : null;
            const over = e.limit !== undefined && e.value > e.limit;
            return (
              <Tr key={e.id} className={rowTone(issues, e.id)}>
                <Td>
                  <TextInput value={e.parameter} disabled={readOnly} ariaLabel="Parameter" onCommit={(v) => updateItem("effluent", e.id, { parameter: v })} />
                </Td>
                <Td>
                  <Select value={e.unit} disabled={readOnly} aria-label="Unit" className="w-[90px]" onChange={(ev) => updateItem("effluent", e.id, { unit: ev.target.value })}>
                    {[...new Set([e.unit, "mg/L", "µg/L", "g/L", "-"])].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <NumberInput value={e.value} min={0} disabled={readOnly} className="w-[96px]" ariaLabel={`Nilai ${e.parameter}`} onCommit={(v) => updateItem("effluent", e.id, { value: v ?? 0 })} />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <NumberInput value={e.limit} allowEmpty min={0} disabled={readOnly} className="w-[90px]" placeholder="isi" ariaLabel={`Baku mutu ${e.parameter}`} onCommit={(v) => updateItem("effluent", e.id, { limit: v })} />
                    {over && <Badge tone="red">lewat</Badge>}
                  </div>
                </Td>
                <Td num>{isConc && factor !== null ? fmt(e.value * factor * project.production.effluentVolumeM3, 4) : "–"}</Td>
                <Td>
                  <Select value={e.flowKey ?? ""} disabled={readOnly} aria-label="Aliran elementer" onChange={(ev) => updateItem("effluent", e.id, { flowKey: ev.target.value || undefined })}>
                    <option value="">{auto ? `Otomatis: ${flows.find((f) => f.key === auto)?.label ?? auto}` : "Otomatis (tidak cocok)"}</option>
                    <option value="none">Tidak dikarakterisasi</option>
                    {flows.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <IconButton label={`Hapus ${e.parameter}`} disabled={readOnly} onClick={() => removeItem("effluent", e.id)} className="hover:text-status-danger">
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      {!readOnly && (
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Tambah parameter efluen
        </Button>
      )}
    </div>
  );
}

/* --------------------------------- Waste --------------------------------- */

export function WasteTable({ project, readOnly, stage }: { project: Project; readOnly: boolean; stage: StageId | null }) {
  const updateItem = useAppStore((s) => s.updateItem);
  const removeItem = useAppStore((s) => s.removeItem);
  const add = useAppStore((s) => s.addWaste);
  const rows = project.waste.filter((w) => !stage || w.stageId === stage);
  return (
    <div className="space-y-3">
      <Table caption="Limbah B3">
        <THead>
          <tr>
            <Th className="min-w-[170px]">Jenis limbah</Th>
            <Th>Tahap</Th>
            <Th align="right">Kuantitas (kg)</Th>
            <Th>Basis</Th>
            <Th align="right">Kadar air %</Th>
            <Th align="right">Kadar logam %</Th>
            <Th className="min-w-[150px]">Pengolahan</Th>
            <Th className="min-w-[170px]">Tujuan</Th>
            <Th align="right">Transport km</Th>
            <Th>Recovery</Th>
            <Th>Kualitas</Th>
            <Th />
          </tr>
        </THead>
        <tbody>
          {rows.map((w) => (
            <Tr key={w.id}>
              <Td>
                <TextInput value={w.wasteType} disabled={readOnly} ariaLabel="Jenis limbah" onCommit={(v) => updateItem("waste", w.id, { wasteType: v })} />
              </Td>
              <Td>
                <StageSelect value={w.stageId} disabled={readOnly} onChange={(v) => updateItem("waste", w.id, { stageId: v })} />
              </Td>
              <Td>
                <NumberInput value={w.quantityKg} min={0} disabled={readOnly} className="w-[96px]" ariaLabel={`Kuantitas ${w.wasteType}`} onCommit={(v) => updateItem("waste", w.id, { quantityKg: v ?? 0 })} />
              </Td>
              <Td>
                <BasisSelect value={w.basis} disabled={readOnly} onChange={(b) => updateItem("waste", w.id, { basis: b })} />
              </Td>
              <Td>
                <NumberInput value={w.moisturePct} min={0} disabled={readOnly} className="w-[72px]" onCommit={(v) => updateItem("waste", w.id, { moisturePct: v ?? 0 })} />
              </Td>
              <Td>
                <NumberInput value={w.metalContentPct} min={0} disabled={readOnly} className="w-[72px]" onCommit={(v) => updateItem("waste", w.id, { metalContentPct: v ?? 0 })} />
              </Td>
              <Td>
                <TextInput value={w.treatment} disabled={readOnly} ariaLabel="Pengolahan" onCommit={(v) => updateItem("waste", w.id, { treatment: v })} />
              </Td>
              <Td>
                <TextInput value={w.destination} disabled={readOnly} ariaLabel="Tujuan" onCommit={(v) => updateItem("waste", w.id, { destination: v })} />
              </Td>
              <Td>
                <NumberInput value={w.transportKm} min={0} disabled={readOnly} className="w-[72px]" onCommit={(v) => updateItem("waste", w.id, { transportKm: v ?? 0 })} />
              </Td>
              <Td>
                <input type="checkbox" aria-label="Recovery" disabled={readOnly} checked={w.recovery} onChange={(e) => updateItem("waste", w.id, { recovery: e.target.checked })} />
              </Td>
              <Td>
                <MetaCell meta={w.meta} disabled={readOnly} onChange={(m) => updateItem("waste", w.id, { meta: m })} />
              </Td>
              <Td>
                <IconButton label={`Hapus ${w.wasteType}`} disabled={readOnly} onClick={() => removeItem("waste", w.id)} className="hover:text-status-danger">
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <p className="text-[11px] text-navy-700/55">Limbah dengan tujuan yang sama dihitung satu trip angkut; jarak terjauh dipakai (lihat MFCA).</p>
      {!readOnly && (
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Tambah limbah B3
        </Button>
      )}
    </div>
  );
}

/* ------------------------------- Production ------------------------------ */

export function ProductionForm({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const updateProduction = useAppStore((s) => s.updateProduction);
  const p = project.production;
  const num = (label: string, key: keyof typeof p, hint?: string) => (
    <Field label={label} hint={hint}>
      <NumberInput value={p[key] as number | undefined} allowEmpty={key === "compressorKwhPerNm3"} min={0} disabled={readOnly} onCommit={(v) => updateProduction({ [key]: key === "compressorKwhPerNm3" ? v : (v ?? 0) })} />
    </Field>
  );
  const coatingKg = p.coatingDensityKgM3 * p.areaM2 * p.coatingThicknessUm * 1e-6;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {num("Luas ter-plating (m²/periode)", "areaM2", "Reference flow untuk FU m².")}
        {num("Jumlah part (per periode)", "parts")}
        {num("Massa komponen (kg/periode)", "componentMassKg")}
        {num("Jumlah batch (per periode)", "batches", "Dipakai untuk data berbasis per batch.")}
        {num("Rework / reject (%)", "reworkPct", "Menaikkan beban per unit baik (B4).")}
        {num("Penguapan + air di produk/lumpur (m³)", "waterEvaporatedM3", "Komponen neraca air (FR-04.3).")}
        {num("Volume efluen (m³/periode)", "effluentVolumeM3")}
        {num("Faktor kompresor (kWh/Nm³)", "compressorKwhPerNm3", "Wajib bila udara tekan diisi dalam Nm³.")}
      </div>
      <div className="rounded-lg border border-sand-200 bg-sand-50 p-4">
        <p className="mb-3 text-xs font-semibold text-navy-900">Lapisan (cek fisika m = ρ × A × t, FR-04.4)</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Logam lapisan">
            <TextInput value={p.coatingMetal} disabled={readOnly} onCommit={(v) => updateProduction({ coatingMetal: v })} />
          </Field>
          {num("Ketebalan (µm)", "coatingThicknessUm")}
          {num("Densitas (kg/m³)", "coatingDensityKgM3", "Cr 7.190 · Ni 8.908 · Zn-Ni ±7.100")}
        </div>
        <p className="mt-3 text-xs text-navy-800">
          Massa lapisan teoritis: <b className="num">{fmt(coatingKg, 3)} kg</b> per periode
          {p.areaM2 > 0 && (
            <>
              {" "}
              (<span className="num">{fmt(coatingKg / p.areaM2, 4)}</span> kg/m²)
            </>
          )}
          .
        </p>
      </div>
    </div>
  );
}

/* --------------------------------- Prices -------------------------------- */

export function PriceForm({ project }: { project: Project }) {
  const updatePrices = useAppStore((s) => s.updatePrices);
  const p = project.prices;
  const fields: Array<[keyof typeof p, string]> = [
    ["energyRpPerKwh", "Energi (Rp/kWh)"],
    ["waterRpPerL", "Air proses (Rp/L)"],
    ["chemicalRpPerKg", "Kimia & anoda (Rp/kg)"],
    ["wwtpChemicalRpPerKg", "Kimia IPAL (Rp/kg)"],
    ["consumableRpPerKg", "Consumable (Rp/kg)"],
    ["wasteTreatmentRpPerKg", "Olah limbah B3 (Rp/kg)"],
    ["wasteTransportRpPerKm", "Transport B3 (Rp/km)"],
    ["wasteTripsPerPeriod", "Trip angkut per tujuan (per periode)"],
    ["laborRpPerPeriod", "Tenaga kerja (Rp/periode)"],
    ["depreciationRpPerPeriod", "Depresiasi (Rp/periode)"],
    ["carbonPriceRpPerKgCO2e", "Harga karbon internal (Rp/kg CO₂e)"],
  ];
  return (
    <div className="space-y-4">
      {p.isDemo && <Badge tone="gold">Harga dataset demo — ganti dengan harga riil</Badge>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Berlaku sejak" hint="Harga bertanggal & berversi (FR-07.3).">
          <TextInput value={p.validFrom} onCommit={(v) => updatePrices({ validFrom: v })} />
        </Field>
        {fields.map(([k, label]) => (
          <Field key={k} label={label}>
            <NumberInput value={(p[k] as number) || undefined} allowEmpty min={0} placeholder="belum diisi" onCommit={(v) => updatePrices({ [k]: v ?? 0 })} />
          </Field>
        ))}
      </div>
      <p className="text-[11px] text-navy-700/60">
        Harga per item di tab LCI Input diutamakan; harga kategori dipakai bila harga item kosong. Harga 0 berarti belum diisi dan dicatat di Kualitas Data.
      </p>
    </div>
  );
}

/* --------------------------------- Mapping ------------------------------- */

const MAPPING_TONE: Record<MappingStatus, "green" | "blue" | "gold" | "red"> = { exact: "green", proxy: "blue", stoich: "gold", unmapped: "red" };

export function MappingTable({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const updateItem = useAppStore((s) => s.updateItem);
  const editable = !readOnly;
  const rows = [
    ...project.inputs.filter((i) => i.quantity > 0).map((i) => ({ kind: "inputs" as const, id: i.id, name: i.name, unit: CANONICAL[CATEGORY_DIMENSION[i.category]], mapping: i.mapping })),
    ...project.waste.filter((w) => w.quantityKg > 0).map((w) => ({ kind: "waste" as const, id: w.id, name: `${w.wasteType} (pengolahan)`, unit: "kg", mapping: w.mapping })),
  ];
  return (
    <div className="space-y-3">
      <Table caption="Mapping ke dataset background">
        <THead>
          <tr>
            <Th className="min-w-[200px]">Aliran foreground</Th>
            <Th>Unit</Th>
            <Th className="min-w-[230px]">Dataset background</Th>
            <Th>Status</Th>
            <Th className="min-w-[220px]">Alasan (wajib untuk proxy/stoikiometri)</Th>
          </tr>
        </THead>
        <tbody>
          {rows.map((r) => {
            const compatible = project.backgrounds.filter((b) => b.refUnit === r.unit);
            return (
              <Tr key={r.id}>
                <Td className="text-xs font-medium">{r.name}</Td>
                <Td className="text-xs">{r.unit}</Td>
                <Td>
                  <Select
                    value={r.mapping.datasetId ?? ""}
                    disabled={!editable}
                    aria-label="Dataset background"
                    onChange={(e) =>
                      updateItem(r.kind, r.id, { mapping: e.target.value ? { ...r.mapping, datasetId: e.target.value, status: r.mapping.status === "unmapped" ? "proxy" : r.mapping.status } : { status: "unmapped" } })
                    }
                  >
                    <option value="">— belum dipetakan —</option>
                    {compatible.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} · {b.provider}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <Select
                    value={r.mapping.status}
                    disabled={!editable || !r.mapping.datasetId}
                    aria-label="Status mapping"
                    className={cn("w-[120px]")}
                    onChange={(e) => updateItem(r.kind, r.id, { mapping: { ...r.mapping, status: e.target.value as MappingStatus } })}
                  >
                    <option value="exact">exact</option>
                    <option value="proxy">proxy</option>
                    <option value="stoich">stoikiometri</option>
                    <option value="unmapped">unmapped</option>
                  </Select>
                  <Badge tone={MAPPING_TONE[r.mapping.status]} className="mt-1">
                    {r.mapping.status}
                  </Badge>
                </Td>
                <Td>
                  <TextInput value={r.mapping.rationale ?? ""} disabled={!editable} placeholder="mis. NiCl₂ dari NiO + HCl" onCommit={(v) => updateItem(r.kind, r.id, { mapping: { ...r.mapping, rationale: v || undefined } })} />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <p className="text-[11px] text-navy-700/60">
        Dataset background (faktor cradle-to-gate per kg/L/kWh dari openLCA) dikelola di Pengaturan → Metode & database. Aliran unmapped dilaporkan, tidak dianggap
        nol, dan memblokir run resmi (FR-05.2).
      </p>
    </div>
  );
}
