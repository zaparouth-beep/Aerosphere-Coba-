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
import { tx } from "@/lib/i18n";
import { MetaCell, StageDot, StageSelect } from "./common";

export const CATEGORY_LABEL: Record<InputCategory, string> = {
  get Chemical() {
    return tx("Bahan kimia", "Chemicals");
  },
  get Anode() {
    return tx("Anoda", "Anodes");
  },
  get Water() {
    return tx("Air", "Water");
  },
  get Energy() {
    return tx("Listrik & energi", "Electricity & energy");
  },
  get WWTPChemical() {
    return tx("Kimia pengolahan air limbah", "Wastewater treatment chemicals");
  },
  get Consumable() {
    return tx("Bahan habis pakai", "Consumables");
  },
};

const BASES: Basis[] = ["period", "month", "batch"];

function rowTone(issues: Map<string, Issue["severity"]>, id: string) {
  const s = issues.get(id);
  return s === "error" ? "bg-status-danger/5" : s === "warning" ? "bg-status-warn/5" : "";
}

function BasisSelect({ value, onChange, disabled }: { value: Basis; onChange: (b: Basis) => void; disabled?: boolean }) {
  return (
    <Select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Basis)} aria-label={tx("Basis waktu", "Time basis")} className="w-[112px]">
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
      <Table caption={tx("LCI input", "LCI inputs")}>
        <THead>
          <tr>
            <Th>No</Th>
            <Th>{tx("Kategori", "Category")}</Th>
            <Th className="min-w-[200px]">{tx("Aliran", "Flow")}</Th>
            <Th>{tx("Tahap", "Stage")}</Th>
            <Th align="right">{tx("Kuantitas", "Quantity")}</Th>
            <Th>Unit</Th>
            <Th>Basis</Th>
            <Th className="min-w-[170px]">{tx("Sumber & kualitas", "Source & quality")}</Th>
            <Th align="right">{tx("Harga riil (Rp/unit)", "Actual price (Rp/unit)")}</Th>
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
                <Select value={i.category} disabled={readOnly} aria-label={tx("Kategori", "Category")} className="w-[132px]" onChange={(e) => updateItem("inputs", i.id, { category: e.target.value as InputCategory, unit: UNIT_OPTIONS[e.target.value as InputCategory][0] })}>
                  {(Object.keys(CATEGORY_LABEL) as InputCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </Td>
              <Td>
                <TextInput value={i.name} disabled={readOnly} ariaLabel={tx("Nama aliran", "Flow name")} onCommit={(v) => updateItem("inputs", i.id, { name: v })} />
                {i.meta.note && <p className="mt-0.5 text-[10px] leading-snug text-navy-700/55">{i.meta.note}</p>}
              </Td>
              <Td>
                <StageSelect value={i.stageId} disabled={readOnly} onChange={(v) => updateItem("inputs", i.id, { stageId: v })} />
              </Td>
              <Td>
                <NumberInput value={i.quantity} min={0} disabled={readOnly} ariaLabel={tx(`Kuantitas ${i.name}`, `Quantity ${i.name}`)} className="w-[110px]" onCommit={(v) => updateItem("inputs", i.id, { quantity: v ?? 0 })} />
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
                  ariaLabel={tx(`Harga ${i.name}`, `Price ${i.name}`)}
                  className="w-[120px]"
                  placeholder={categoryPrice(project, i.category) > 0 ? tx(`kategori ${fmt(categoryPrice(project, i.category), 0)}`, `category ${fmt(categoryPrice(project, i.category), 0)}`) : `Rp/${CANONICAL[CATEGORY_DIMENSION[i.category]]}`}
                  onCommit={(v) => updateItem("inputs", i.id, { unitPriceRp: v })}
                />
              </Td>
              <Td>
                <IconButton label={tx(`Hapus ${i.name}`, `Delete ${i.name}`)} disabled={readOnly} onClick={() => removeItem("inputs", i.id)} className="hover:text-status-danger">
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </Td>
            </Tr>
          ))}
          {!rows.length && (
            <Tr>
              <Td colSpan={10} className="py-6 text-center text-xs text-navy-700/55">
                {tx("Tidak ada aliran untuk filter ini.", "No flows match this filter.")}
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
      <Table caption={tx("Emisi udara", "Air emissions")}>
        <THead>
          <tr>
            <Th className="min-w-[160px]">{tx("Emisi", "Emission")}</Th>
            <Th className="min-w-[160px]">{tx("Relevansi", "Relevance")}</Th>
            <Th>{tx("Tahap", "Stage")}</Th>
            <Th>{tx("Berlaku", "Applicable")}</Th>
            <Th align="right">{tx("Nilai (kg)", "Value (kg)")}</Th>
            <Th>Basis</Th>
            <Th className="min-w-[180px]">{tx("Aliran elementer (LCIA)", "Elementary flow (LCIA)")}</Th>
            <Th>{tx("Kualitas", "Quality")}</Th>
            <Th />
          </tr>
        </THead>
        <tbody>
          {rows.map((a) => {
            const auto = resolveFlowKey(a.parameter, undefined, "air");
            return (
              <Tr key={a.id}>
                <Td>
                  <TextInput value={a.parameter} disabled={readOnly} ariaLabel={tx("Emisi", "Emission")} onCommit={(v) => updateItem("airEmissions", a.id, { parameter: v })} />
                </Td>
                <Td>
                  <TextInput value={a.relevance} disabled={readOnly} ariaLabel={tx("Relevansi", "Relevance")} onCommit={(v) => updateItem("airEmissions", a.id, { relevance: v })} />
                </Td>
                <Td>
                  <StageSelect value={a.stageId} disabled={readOnly} onChange={(v) => updateItem("airEmissions", a.id, { stageId: v })} />
                </Td>
                <Td>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" disabled={readOnly} checked={a.applicable} onChange={(e) => updateItem("airEmissions", a.id, { applicable: e.target.checked })} />
                    {a.applicable ? tx("Ya", "Yes") : tx("Tidak", "No")}
                  </label>
                </Td>
                <Td>
                  <NumberInput value={a.quantityKg} min={0} disabled={readOnly || !a.applicable} className="w-[100px]" ariaLabel={tx(`Nilai ${a.parameter}`, `Value ${a.parameter}`)} onCommit={(v) => updateItem("airEmissions", a.id, { quantityKg: v ?? 0 })} />
                </Td>
                <Td>
                  <BasisSelect value={a.basis} disabled={readOnly} onChange={(b) => updateItem("airEmissions", a.id, { basis: b })} />
                </Td>
                <Td>
                  <Select value={a.flowKey ?? ""} disabled={readOnly} aria-label={tx("Aliran elementer", "Elementary flow")} onChange={(e) => updateItem("airEmissions", a.id, { flowKey: e.target.value || undefined })}>
                    <option value="">{auto ? tx(`Otomatis: ${flows.find((f) => f.key === auto)?.label ?? auto}`, `Automatic: ${flows.find((f) => f.key === auto)?.label ?? auto}`) : tx("Otomatis (tidak cocok)", "Automatic (no match)")}</option>
                    <option value="none">{tx("Tidak dikarakterisasi", "Not characterised")}</option>
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
                  <IconButton label={tx(`Hapus ${a.parameter}`, `Delete ${a.parameter}`)} disabled={readOnly} onClick={() => removeItem("airEmissions", a.id)} className="hover:text-status-danger">
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
          <Plus className="h-3.5 w-3.5" /> {tx("Tambah emisi udara", "Add air emission")}
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
        <Field label={tx("Volume efluen per periode (m³)", "Effluent volume per period (m³)")} hint={tx("Beban polutan = volume × konsentrasi (PRD 2.2.4).", "Pollutant load = volume × concentration (PRD 2.2.4).")}>
          <NumberInput value={project.production.effluentVolumeM3} min={0} disabled={readOnly} onCommit={(v) => updateProduction({ effluentVolumeM3: v ?? 0 })} />
        </Field>
      </div>
      <Table caption={tx("Efluen", "Effluent")}>
        <THead>
          <tr>
            <Th className="min-w-[140px]">Parameter</Th>
            <Th>Unit</Th>
            <Th align="right">{tx("Nilai", "Value")}</Th>
            <Th align="right">{tx("Baku mutu", "Discharge limit")}</Th>
            <Th align="right">{tx("Beban (kg/periode)", "Load (kg/period)")}</Th>
            <Th className="min-w-[180px]">{tx("Aliran elementer (LCIA)", "Elementary flow (LCIA)")}</Th>
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
                  <NumberInput value={e.value} min={0} disabled={readOnly} className="w-[96px]" ariaLabel={tx(`Nilai ${e.parameter}`, `Value ${e.parameter}`)} onCommit={(v) => updateItem("effluent", e.id, { value: v ?? 0 })} />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <NumberInput value={e.limit} allowEmpty min={0} disabled={readOnly} className="w-[90px]" placeholder={tx("isi", "enter")} ariaLabel={tx(`Baku mutu ${e.parameter}`, `Discharge limit ${e.parameter}`)} onCommit={(v) => updateItem("effluent", e.id, { limit: v })} />
                    {over && <Badge tone="red">{tx("lewat", "exceeded")}</Badge>}
                  </div>
                </Td>
                <Td num>{isConc && factor !== null ? fmt(e.value * factor * project.production.effluentVolumeM3, 4) : "–"}</Td>
                <Td>
                  <Select value={e.flowKey ?? ""} disabled={readOnly} aria-label={tx("Aliran elementer", "Elementary flow")} onChange={(ev) => updateItem("effluent", e.id, { flowKey: ev.target.value || undefined })}>
                    <option value="">{auto ? tx(`Otomatis: ${flows.find((f) => f.key === auto)?.label ?? auto}`, `Automatic: ${flows.find((f) => f.key === auto)?.label ?? auto}`) : tx("Otomatis (tidak cocok)", "Automatic (no match)")}</option>
                    <option value="none">{tx("Tidak dikarakterisasi", "Not characterised")}</option>
                    {flows.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <IconButton label={tx(`Hapus ${e.parameter}`, `Delete ${e.parameter}`)} disabled={readOnly} onClick={() => removeItem("effluent", e.id)} className="hover:text-status-danger">
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
          <Plus className="h-3.5 w-3.5" /> {tx("Tambah parameter efluen", "Add effluent parameter")}
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
      <Table caption={tx("Limbah B3", "Hazardous (B3) waste")}>
        <THead>
          <tr>
            <Th className="min-w-[170px]">{tx("Jenis limbah", "Waste type")}</Th>
            <Th>{tx("Tahap", "Stage")}</Th>
            <Th align="right">{tx("Kuantitas (kg)", "Quantity (kg)")}</Th>
            <Th>Basis</Th>
            <Th align="right">{tx("Kadar air %", "Moisture %")}</Th>
            <Th align="right">{tx("Kadar logam %", "Metal content %")}</Th>
            <Th className="min-w-[150px]">{tx("Pengolahan", "Treatment")}</Th>
            <Th className="min-w-[170px]">{tx("Tujuan", "Destination")}</Th>
            <Th align="right">{tx("Transport km", "Transport km")}</Th>
            <Th>Recovery</Th>
            <Th>{tx("Kualitas", "Quality")}</Th>
            <Th />
          </tr>
        </THead>
        <tbody>
          {rows.map((w) => (
            <Tr key={w.id}>
              <Td>
                <TextInput value={w.wasteType} disabled={readOnly} ariaLabel={tx("Jenis limbah", "Waste type")} onCommit={(v) => updateItem("waste", w.id, { wasteType: v })} />
              </Td>
              <Td>
                <StageSelect value={w.stageId} disabled={readOnly} onChange={(v) => updateItem("waste", w.id, { stageId: v })} />
              </Td>
              <Td>
                <NumberInput value={w.quantityKg} min={0} disabled={readOnly} className="w-[96px]" ariaLabel={tx(`Kuantitas ${w.wasteType}`, `Quantity ${w.wasteType}`)} onCommit={(v) => updateItem("waste", w.id, { quantityKg: v ?? 0 })} />
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
                <TextInput value={w.treatment} disabled={readOnly} ariaLabel={tx("Pengolahan", "Treatment")} onCommit={(v) => updateItem("waste", w.id, { treatment: v })} />
              </Td>
              <Td>
                <TextInput value={w.destination} disabled={readOnly} ariaLabel={tx("Tujuan", "Destination")} onCommit={(v) => updateItem("waste", w.id, { destination: v })} />
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
                <IconButton label={tx(`Hapus ${w.wasteType}`, `Delete ${w.wasteType}`)} disabled={readOnly} onClick={() => removeItem("waste", w.id)} className="hover:text-status-danger">
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <p className="text-[11px] text-navy-700/55">
        {tx(
          "Limbah dengan tujuan yang sama dihitung satu trip angkut; jarak terjauh dipakai (lihat MFCA).",
          "Waste going to the same destination counts as one haulage trip; the longest distance is used (see MFCA).",
        )}
      </p>
      {!readOnly && (
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> {tx("Tambah limbah B3", "Add hazardous (B3) waste")}
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
        {num(tx("Luas ter-plating (m²/periode)", "Plated area (m²/period)"), "areaM2", tx("Reference flow untuk FU m².", "Reference flow for the m² FU."))}
        {num(tx("Jumlah part (per periode)", "Number of parts (per period)"), "parts")}
        {num(tx("Massa komponen (kg/periode)", "Component mass (kg/period)"), "componentMassKg")}
        {num(tx("Jumlah batch (per periode)", "Number of batches (per period)"), "batches", tx("Dipakai untuk data berbasis per batch.", "Used for per-batch data."))}
        {num(tx("Rework / reject (%)", "Rework / reject (%)"), "reworkPct", tx("Menaikkan beban per unit baik (B4).", "Raises the burden per good unit (B4)."))}
        {num(tx("Penguapan + air di produk/lumpur (m³)", "Evaporation + water in product/sludge (m³)"), "waterEvaporatedM3", tx("Komponen neraca air (FR-04.3).", "Water balance component (FR-04.3)."))}
        {num(tx("Volume efluen (m³/periode)", "Effluent volume (m³/period)"), "effluentVolumeM3")}
        {num(tx("Faktor kompresor (kWh/Nm³)", "Compressor factor (kWh/Nm³)"), "compressorKwhPerNm3", tx("Wajib bila udara tekan diisi dalam Nm³.", "Required when compressed air is entered in Nm³."))}
      </div>
      <div className="rounded-lg border border-sand-200 bg-sand-50 p-4">
        <p className="mb-3 text-xs font-semibold text-navy-900">{tx("Lapisan (cek fisika m = ρ × A × t, FR-04.4)", "Coating (physics check m = ρ × A × t, FR-04.4)")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={tx("Logam lapisan", "Coating metal")}>
            <TextInput value={p.coatingMetal} disabled={readOnly} onCommit={(v) => updateProduction({ coatingMetal: v })} />
          </Field>
          {num(tx("Ketebalan (µm)", "Thickness (µm)"), "coatingThicknessUm")}
          {num(tx("Densitas (kg/m³)", "Density (kg/m³)"), "coatingDensityKgM3", tx("Cr 7.190 · Ni 8.908 · Zn-Ni ±7.100", "Cr 7,190 · Ni 8,908 · Zn-Ni ±7,100"))}
        </div>
        <p className="mt-3 text-xs text-navy-800">
          {tx("Massa lapisan teoritis:", "Theoretical coating mass:")} <b className="num">{fmt(coatingKg, 3)} kg</b> {tx("per periode", "per period")}
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
    ["energyRpPerKwh", tx("Energi (Rp/kWh)", "Energy (Rp/kWh)")],
    ["waterRpPerL", tx("Air proses (Rp/L)", "Process water (Rp/L)")],
    ["chemicalRpPerKg", tx("Kimia & anoda (Rp/kg)", "Chemicals & anodes (Rp/kg)")],
    ["wwtpChemicalRpPerKg", tx("Kimia IPAL (Rp/kg)", "WWTP chemicals (Rp/kg)")],
    ["consumableRpPerKg", tx("Consumable (Rp/kg)", "Consumables (Rp/kg)")],
    ["wasteTreatmentRpPerKg", tx("Olah limbah B3 (Rp/kg)", "B3 waste treatment (Rp/kg)")],
    ["wasteTransportRpPerKm", tx("Transport B3 (Rp/km)", "B3 transport (Rp/km)")],
    ["wasteTripsPerPeriod", tx("Trip angkut per tujuan (per periode)", "Haulage trips per destination (per period)")],
    ["laborRpPerPeriod", tx("Tenaga kerja (Rp/periode)", "Labour (Rp/period)")],
    ["depreciationRpPerPeriod", tx("Depresiasi (Rp/periode)", "Depreciation (Rp/period)")],
    ["carbonPriceRpPerKgCO2e", tx("Harga karbon internal (Rp/kg CO₂e)", "Internal carbon price (Rp/kg CO₂e)")],
  ];
  return (
    <div className="space-y-4">
      {p.isDemo && <Badge tone="gold">{tx("Harga dataset demo — ganti dengan harga riil", "Demo dataset prices — replace with actual prices")}</Badge>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={tx("Berlaku sejak", "Valid from")} hint={tx("Harga bertanggal & berversi (FR-07.3).", "Prices are dated & versioned (FR-07.3).")}>
          <TextInput value={p.validFrom} onCommit={(v) => updatePrices({ validFrom: v })} />
        </Field>
        {fields.map(([k, label]) => (
          <Field key={k} label={label}>
            <NumberInput value={(p[k] as number) || undefined} allowEmpty min={0} placeholder={tx("belum diisi", "not filled in")} onCommit={(v) => updatePrices({ [k]: v ?? 0 })} />
          </Field>
        ))}
      </div>
      <p className="text-[11px] text-navy-700/60">
        {tx(
          "Harga per item di tab LCI Input diutamakan; harga kategori dipakai bila harga item kosong. Harga 0 berarti belum diisi dan dicatat di Kualitas Data.",
          "Per-item prices in the LCI Input tab take priority; category prices are used when an item price is empty. A price of 0 means not filled in and is logged under Data Quality.",
        )}
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
    ...project.waste.filter((w) => w.quantityKg > 0).map((w) => ({ kind: "waste" as const, id: w.id, name: tx(`${w.wasteType} (pengolahan)`, `${w.wasteType} (treatment)`), unit: "kg", mapping: w.mapping })),
  ];
  return (
    <div className="space-y-3">
      <Table caption={tx("Mapping ke dataset background", "Mapping to background datasets")}>
        <THead>
          <tr>
            <Th className="min-w-[200px]">{tx("Aliran foreground", "Foreground flow")}</Th>
            <Th>Unit</Th>
            <Th className="min-w-[230px]">{tx("Dataset background", "Background dataset")}</Th>
            <Th>Status</Th>
            <Th className="min-w-[220px]">{tx("Alasan (wajib untuk proxy/stoikiometri)", "Rationale (required for proxy/stoichiometry)")}</Th>
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
                    aria-label={tx("Dataset background", "Background dataset")}
                    onChange={(e) =>
                      updateItem(r.kind, r.id, { mapping: e.target.value ? { ...r.mapping, datasetId: e.target.value, status: r.mapping.status === "unmapped" ? "proxy" : r.mapping.status } : { status: "unmapped" } })
                    }
                  >
                    <option value="">{tx("— belum dipetakan —", "— not mapped —")}</option>
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
                    aria-label={tx("Status mapping", "Mapping status")}
                    className={cn("w-[120px]")}
                    onChange={(e) => updateItem(r.kind, r.id, { mapping: { ...r.mapping, status: e.target.value as MappingStatus } })}
                  >
                    <option value="exact">exact</option>
                    <option value="proxy">proxy</option>
                    <option value="stoich">{tx("stoikiometri", "stoichiometry")}</option>
                    <option value="unmapped">unmapped</option>
                  </Select>
                  <Badge tone={MAPPING_TONE[r.mapping.status]} className="mt-1">
                    {r.mapping.status}
                  </Badge>
                </Td>
                <Td>
                  <TextInput value={r.mapping.rationale ?? ""} disabled={!editable} placeholder={tx("mis. NiCl₂ dari NiO + HCl", "e.g. NiCl₂ from NiO + HCl")} onCommit={(v) => updateItem(r.kind, r.id, { mapping: { ...r.mapping, rationale: v || undefined } })} />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <p className="text-[11px] text-navy-700/60">
        {tx(
          "Dataset background (faktor cradle-to-gate per kg/L/kWh dari openLCA) dikelola di Pengaturan → Metode & database. Aliran unmapped dilaporkan, tidak dianggap nol, dan memblokir run resmi (FR-05.2).",
          "Background datasets (cradle-to-gate factors per kg/L/kWh from openLCA) are managed in Settings → Methods & databases. Unmapped flows are reported, not treated as zero, and block an official run (FR-05.2).",
        )}
      </p>
    </div>
  );
}
