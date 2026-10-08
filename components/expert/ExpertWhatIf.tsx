"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Lock, Plus, Star, Trash2 } from "lucide-react";
import { DecisionBubble, Tornado, Waterfall } from "@/components/charts/Charts";
import { CATEGORICAL } from "@/components/charts/palette";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Feedback";
import { Field, NumberInput, TextInput } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Tabs";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { can } from "@/lib/domain/permissions";
import type { LeverId, LeverSettings, Scenario } from "@/lib/domain/types";
import type { Indicators } from "@/lib/engine/calculate";
import { bridge, LEVERS, sensitivity } from "@/lib/engine/scenario";
import { LockedFeature } from "@/components/ui/Locked";
import { InfoTip } from "@/components/ui/InfoTip";
import { Select } from "@/components/ui/Input";
import { hasFeature, planLimits } from "@/lib/domain/plans";
import { useAppStore } from "@/lib/store/useAppStore";
import { useActiveResults, useScenarioOutcomes } from "@/lib/store/useResults";
import { cn } from "@/lib/utils/cn";
import { fmt, fmtDelta, fmtRp, fmtRpShort, fmtSig } from "@/lib/utils/format";

const DEFAULTS: Required<LeverSettings> = {
  dragout: { reductionPct: 20 },
  countercurrent: { stagesOld: 2, stagesNew: 3, ratio: 1000 },
  rectifier: { etaOld: 75, etaNew: 88 },
  tankCover: { heatReductionPct: 20, mistReductionPct: 30 },
  mistSuppressant: { reductionPct: 50 },
  effluentTarget: { parameter: "Ni", newValue: 0.064, flocculantIncreasePct: 10 },
  gridFactor: { kgCO2ePerKwh: 0.5 },
  bathConcentration: { cOld: 55, cNew: 47.5 },
};

const PARAMS: Record<LeverId, Array<{ key: string; label: string; text?: boolean }>> = {
  dragout: [{ key: "reductionPct", label: "Larutan terbawa berkurang (%)" }],
  countercurrent: [
    { key: "stagesOld", label: "Tangki bilas sekarang" },
    { key: "stagesNew", label: "Tangki bilas baru" },
    { key: "ratio", label: "Target kebersihan (C₀/Cₙ)" },
  ],
  rectifier: [
    { key: "etaOld", label: "Efisiensi sekarang (%)" },
    { key: "etaNew", label: "Efisiensi baru (%)" },
  ],
  tankCover: [
    { key: "heatReductionPct", label: "Kehilangan panas turun (%)" },
    { key: "mistReductionPct", label: "Kabut turun (%)" },
  ],
  mistSuppressant: [{ key: "reductionPct", label: "Kabut berkurang (%)" }],
  effluentTarget: [
    { key: "parameter", label: "Zat di air buangan", text: true },
    { key: "newValue", label: "Kadar target" },
    { key: "flocculantIncreasePct", label: "Bahan penggumpal naik (%)" },
  ],
  gridFactor: [{ key: "kgCO2ePerKwh", label: "Emisi listrik (kg CO₂e/kWh)" }],
  bathConcentration: [
    { key: "cOld", label: "Konsentrasi sekarang (g/L)" },
    { key: "cNew", label: "Konsentrasi baru (g/L)" },
  ],
};

const INDICATOR_ROWS: Array<{ key: keyof Omit<Indicators, "perFu">; label: string; unit: string; rp?: boolean }> = [
  { key: "energyKwh", label: "Energi", unit: "kWh" },
  { key: "waterL", label: "Air", unit: "L" },
  { key: "chemicalKg", label: "Kimia", unit: "kg" },
  { key: "wasteKg", label: "Limbah B3", unit: "kg" },
  { key: "effluentM3", label: "Volume efluen", unit: "m³" },
  { key: "ccKg", label: "Climate change", unit: "kg CO₂e" },
  { key: "costRp", label: "Biaya proses", unit: "Rp", rp: true },
  { key: "costLossRp", label: "Cost loss (MFCA)", unit: "Rp", rp: true },
];

type Weights = { cc: number; cost: number; water: number; waste: number };

const STATUS_LABEL: Record<Scenario["status"], string> = { draft: "Draf", recommended: "Disarankan", approved: "Disetujui" };

export default function WhatIfPage() {
  const { project, indicators } = useActiveResults();
  const { outcomes } = useScenarioOutcomes();
  const role = useAppStore((s) => s.user.role);
  const addScenario = useAppStore((s) => s.addScenario);
  const updateScenario = useAppStore((s) => s.updateScenario);
  const setLevers = useAppStore((s) => s.setLevers);
  const removeScenario = useAppStore((s) => s.removeScenario);
  const markRecommended = useAppStore((s) => s.markRecommended);
  const approveScenario = useAppStore((s) => s.approveScenario);
  const runCalculation = useAppStore((s) => s.runCalculation);
  const [activeId, setActiveId] = useState<string | null>(project.scenarios[0]?.id ?? null);
  const [bridgeMetric, setBridgeMetric] = useState<"cc" | "cost">("cc");
  const [tornadoMetric, setTornadoMetric] = useState<"cc" | "cost" | "energy">("cc");
  const [weights, setWeights] = useState<Weights>({ cc: 40, cost: 30, water: 15, waste: 15 });
  const expert = useAppStore((s) => s.ui.expertMode);
  const subscription = useAppStore((s) => s.subscription);
  const maxScenarios = planLimits(subscription).scenarios;
  const editable = can(role, "editScenario") && hasFeature(subscription, "editScenario");
  const weightsAllowed = hasFeature(subscription, "decisionWeights");
  const active = project.scenarios.find((s) => s.id === activeId) ?? project.scenarios[0];
  const activeOutcome = outcomes.find((o) => o.scenario.id === active?.id);

  const bridgeSteps = useMemo(
    () => (active ? bridge(project, active.levers, (i) => (bridgeMetric === "cc" ? i.ccKg : i.costRp)) : []),
    [project, active, bridgeMetric],
  );
  const tornado = useMemo(
    () => sensitivity(project, (i) => (tornadoMetric === "cc" ? i.perFu.cc : tornadoMetric === "cost" ? i.perFu.cost : i.perFu.energy)),
    [project, tornadoMetric],
  );

  // Decision matrix: weighted improvement score (higher = better).
  const scored = outcomes.map((o) => {
    const improve = (pct: number) => -pct;
    const wSum = weights.cc + weights.cost + weights.water + weights.waste || 1;
    const score = (weights.cc * improve(o.delta.ccKg.pct) + weights.cost * improve(o.delta.costRp.pct) + weights.water * improve(o.delta.waterL.pct) + weights.waste * improve(o.delta.wasteKg.pct)) / wSum;
    return { o, score };
  });
  const bestId = [...scored].sort((a, b) => b.score - a.score)[0]?.o.scenario.id;

  const setLever = (sc: Scenario, id: LeverId, on: boolean) => {
    const next = { ...sc.levers } as Record<string, unknown>;
    if (on) next[id] = DEFAULTS[id];
    else delete next[id];
    setLevers(sc.id, next as LeverSettings);
  };
  const setParam = (sc: Scenario, id: LeverId, key: string, value: number | string) => {
    const cur = (sc.levers[id] ?? DEFAULTS[id]) as Record<string, unknown>;
    setLevers(sc.id, { ...sc.levers, [id]: { ...cur, [key]: value } });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader title="Daftar perbaikan" info="whatif" subtitle={`Kondisi sekarang + maksimal ${maxScenarios} simulasi`} action={editable && <IconButton label="Tambah simulasi" onClick={addScenario} disabled={project.scenarios.length >= maxScenarios}><Plus className="h-4 w-4" /></IconButton>} />
          <CardBody className="space-y-2">
            <div className="rounded-lg border border-sand-200 bg-sand-50 p-3 text-xs">
              <p className="font-semibold text-navy-900">{expert ? "S0 · Baseline" : "Kondisi sekarang"}</p>
              <p className="text-navy-700/65">Data proses saat ini, tanpa perubahan</p>
            </div>
            {project.scenarios.map((s, i) => {
              const o = outcomes.find((x) => x.scenario.id === s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={cn("w-full rounded-lg border p-3 text-left text-xs transition-colors", active?.id === s.id ? "border-brand-blue bg-brand-blue/5" : "border-sand-200 hover:border-sand-300")}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORICAL[i + 1] }} />
                    <span className="font-semibold text-navy-900">
                      {expert ? `${s.code} · ` : ""}
                      {s.name}
                    </span>
                    {s.id === bestId && <Star className="ml-auto h-3.5 w-3.5 fill-brand-gold text-brand-gold" aria-label="Skor terbaik" />}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={s.status === "approved" ? "green" : s.status === "recommended" ? "blue" : "neutral"}>{STATUS_LABEL[s.status]}</Badge>
                    {o && <Badge tone={o.delta.ccKg.pct < 0 ? "green" : "neutral"}>Karbon {fmtDelta(o.delta.ccKg.pct)}</Badge>}
                    {o && <Badge tone={o.delta.costRp.pct < 0 ? "green" : "neutral"}>Biaya {fmtDelta(o.delta.costRp.pct)}</Badge>}
                  </span>
                </button>
              );
            })}
          </CardBody>
        </Card>

        {active && activeOutcome ? (
          <Card>
            <CardHeader
              eyebrow={expert ? `Skenario ${active.code}` : undefined}
              title={active.name}
              subtitle={expert ? "Disimpan sebagai delta terhadap baseline; engine menghitung ulang LCI → LCIA → MFCA" : "Mesin hitung menghitung ulang seluruh lini dengan perubahan ini."}
              action={
                <>
                  <Button size="sm" variant="secondary" disabled={!editable} onClick={() => markRecommended(active.id)}>
                    <Star className="h-3.5 w-3.5" /> Tandai disarankan
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => runCalculation("draft", active.id)}>
                    <Lock className="h-3.5 w-3.5" /> Simpan hasil simulasi
                  </Button>
                  <Button size="sm" variant="brand" disabled={!can(role, "approveScenario") || active.status === "approved"} onClick={() => approveScenario(active.id)}>
                    <BadgeCheck className="h-3.5 w-3.5" /> Setujui
                  </Button>
                  {editable && (
                    <IconButton label="Hapus simulasi" onClick={() => removeScenario(active.id)} className="hover:text-status-danger">
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  )}
                </>
              }
            />
            <CardBody className="space-y-4">
              {!hasFeature(subscription, "editScenario") && <LockedFeature feature="editScenario" compact title="Ubah angka simulasi" />}
              <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
                <Field label="Nama">
                  <TextInput value={active.name} disabled={!editable} onCommit={(v) => updateScenario(active.id, { name: v })} />
                </Field>
                <Field label="Deskripsi">
                  <TextInput value={active.description} disabled={!editable} onCommit={(v) => updateScenario(active.id, { description: v })} />
                </Field>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {LEVERS.map((lv) => {
                  const on = active.levers[lv.id] !== undefined;
                  const values = (active.levers[lv.id] ?? DEFAULTS[lv.id]) as Record<string, number | string>;
                  return (
                    <div key={lv.id} className={cn("rounded-lg border p-3", on ? "border-brand-teal/50 bg-brand-teal/5" : "border-sand-200")}>
                      <label className="flex cursor-pointer items-start gap-2">
                        <input type="checkbox" className="mt-0.5" disabled={!editable} checked={on} onChange={(e) => setLever(active, lv.id, e.target.checked)} />
                        <span>
                          <span className="block text-xs font-semibold text-navy-900">{lv.label}</span>
                          <span className="block text-[11px] text-navy-700/65">Berpengaruh ke: {lv.affects}</span>
                          {expert && <span className="block text-[10px] text-navy-700/45">{lv.technical}</span>}
                        </span>
                      </label>
                      {on && (
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {PARAMS[lv.id].map((p) => (
                            <Field key={p.key} label={p.label}>
                              {p.text ? (
                                <TextInput value={String(values[p.key] ?? "")} disabled={!editable} onCommit={(v) => setParam(active, lv.id, p.key, v)} />
                              ) : (
                                <NumberInput value={Number(values[p.key])} min={0} disabled={!editable} onCommit={(v) => setParam(active, lv.id, p.key, v ?? 0)} />
                              )}
                            </Field>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label={expert ? "Capex (Rp)" : "Biaya investasi (Rp)"}>
                  <NumberInput value={active.capexRp} min={0} disabled={!editable} onCommit={(v) => updateScenario(active.id, { capexRp: v ?? 0 })} />
                </Field>
                <Field label={expert ? "Tambahan opex (Rp/periode)" : "Tambahan biaya operasi (Rp/periode)"}>
                  <NumberInput value={active.extraOpexRpPerPeriod} min={0} disabled={!editable} onCommit={(v) => updateScenario(active.id, { extraOpexRpPerPeriod: v ?? 0 })} />
                </Field>
                <Field label={expert ? "Umur aset (tahun)" : "Umur alat (tahun)"}>
                  <NumberInput value={active.lifetimeYears} min={0} disabled={!editable} onCommit={(v) => updateScenario(active.id, { lifetimeYears: v ?? 0 })} />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Usaha">
                  <Select value={active.effort ?? "sedang"} disabled={!editable} onChange={(e) => updateScenario(active.id, { effort: e.target.value as Scenario["effort"] })}>
                    <option value="rendah">Rendah</option>
                    <option value="sedang">Sedang</option>
                    <option value="tinggi">Tinggi</option>
                  </Select>
                </Field>
                <Field label="Perkiraan waktu">
                  <TextInput value={active.timeline ?? ""} disabled={!editable} placeholder="mis. 1–3 bulan" onCommit={(v) => updateScenario(active.id, { timeline: v })} />
                </Field>
              </div>
              <div className="rounded-lg border border-sand-200 bg-sand-50 p-3 text-xs">
                <p className="mb-1 font-semibold text-navy-900">{expert ? "Asumsi skenario (fungsi propagasi terdokumentasi)" : "Yang dihitung ulang"}</p>
                {activeOutcome.assumptions.length ? (
                  <ul className="list-disc space-y-0.5 pl-4 text-navy-800">
                    {activeOutcome.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-navy-700/60">Centang minimal satu perbaikan.</p>
                )}
                <p className="mt-2 text-navy-800">
                  Hemat {fmtRp(activeOutcome.lcc.annualSavingRp)} per tahun · balik modal {activeOutcome.lcc.paybackYears === null ? "–" : active.capexRp > 0 ? `${fmt(activeOutcome.lcc.paybackYears, 1)} tahun` : "langsung (tanpa investasi)"}
                  {expert && <> · NPV ({project.targets.discountRatePct}%) {fmtRp(activeOutcome.lcc.npvRp)}</>}
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Callout tone="info">Belum ada simulasi. Tambahkan dengan tombol +, atau minta saran lewat Tanya AeroSphere.</Callout>
        )}
      </div>

      {!expert && <SimpleComparison />}
      {expert && (
      <>
      <Card>
        <CardHeader title="Perbandingan S0–S3" subtitle="Nilai per periode; Δ terhadap baseline (hijau = turun)" />
        <CardBody>
          <Table caption="Perbandingan skenario">
            <THead>
              <tr>
                <Th>Indikator</Th>
                <Th align="right">S0 Baseline</Th>
                {outcomes.map((o) => (
                  <Th key={o.scenario.id} align="right">
                    {o.scenario.code}
                  </Th>
                ))}
              </tr>
            </THead>
            <tbody>
              {INDICATOR_ROWS.map((r) => (
                <Tr key={r.key}>
                  <Td className="font-medium">
                    {r.label} <span className="text-[11px] font-normal text-navy-700/55">{r.rp ? "" : r.unit}</span>
                  </Td>
                  <Td num>{r.rp ? fmtRp(indicators[r.key]) : fmtSig(indicators[r.key])}</Td>
                  {outcomes.map((o) => {
                    const d = o.delta[r.key];
                    return (
                      <Td key={o.scenario.id} num>
                        <span className="block">{r.rp ? fmtRp(o.indicators[r.key]) : fmtSig(o.indicators[r.key])}</span>
                        <span className={cn("text-[11px]", d.pct < -0.05 ? "text-status-ok" : d.pct > 0.05 ? "text-status-danger" : "text-navy-700/50")}>{fmtDelta(d.pct)}</span>
                      </Td>
                    );
                  })}
                </Tr>
              ))}
              <Tr>
                <Td className="font-medium">Payback (tahun)</Td>
                <Td num>–</Td>
                {outcomes.map((o) => (
                  <Td key={o.scenario.id} num>
                    {o.lcc.paybackYears === null ? "–" : o.scenario.capexRp ? fmt(o.lcc.paybackYears, 1) : "tanpa capex"}
                  </Td>
                ))}
              </Tr>
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title={`Bridge ${active?.code ?? ""}: baseline → per lever → skenario`}
            subtitle="Lever diterapkan berurutan; batang hijau = penurunan"
            action={<Segmented size="xs" ariaLabel="Indikator bridge" value={bridgeMetric} onChange={setBridgeMetric} options={[{ id: "cc", label: "GWP" }, { id: "cost", label: "Biaya" }]} />}
          />
          <CardBody>{bridgeSteps.length > 1 ? <Waterfall steps={bridgeSteps} format={bridgeMetric === "cc" ? (n) => fmt(n, 1) : fmtRpShort} /> : <p className="py-10 text-center text-xs text-navy-700/60">Aktifkan lever pada skenario terpilih.</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Decision matrix" subtitle="Skor = rata-rata tertimbang % perbaikan; ukuran gelembung = |Δ air|" />
          <CardBody className="space-y-3">
            {!weightsAllowed ? <LockedFeature feature="decisionWeights" compact /> : (<>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              {(
                [
                  ["cc", "GWP"],
                  ["cost", "Biaya"],
                  ["water", "Air"],
                  ["waste", "Limbah B3"],
                ] as Array<[keyof Weights, string]>
              ).map(([k, label]) => (
                <label key={k} className="block text-xs">
                  <span className="flex justify-between">
                    {label} <span className="num">{weights[k]}</span>
                  </span>
                  <input type="range" min={0} max={100} step={5} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} className="w-full" />
                </label>
              ))}
            </div>
            <DecisionBubble points={outcomes.map((o, i) => ({ code: o.scenario.code, name: o.scenario.name, dCostPct: o.delta.costRp.pct, dCcPct: o.delta.ccKg.pct, dWaterPct: o.delta.waterL.pct, color: CATEGORICAL[i + 1]! }))} height={220} />
            <Table caption="Skor keputusan">
              <THead>
                <tr>
                  <Th>Skenario</Th>
                  <Th align="right">Skor</Th>
                </tr>
              </THead>
              <tbody>
                {[...scored]
                  .sort((a, b) => b.score - a.score)
                  .map(({ o, score }) => (
                    <Tr key={o.scenario.id}>
                      <Td>
                        {o.scenario.code} · {o.scenario.name}
                      </Td>
                      <Td num className={o.scenario.id === bestId ? "font-semibold text-status-ok" : ""}>
                        {fmt(score, 2)}
                      </Td>
                    </Tr>
                  ))}
              </tbody>
            </Table>
            </>)}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Sensitivitas ±10% (tornado)"
          subtitle="One-at-a-time pada baseline (FR-09.4); faktor grid diuji pada rentang 0,61–0,87 kg CO₂e/kWh"
          action={<Segmented size="xs" ariaLabel="Indikator sensitivitas" value={tornadoMetric} onChange={setTornadoMetric} options={[{ id: "cc", label: "GWP/FU" }, { id: "cost", label: "Biaya/FU" }, { id: "energy", label: "Energi/FU" }]} />}
        />
        <CardBody>
          <p className="mb-2 text-xs text-navy-800">
            Nilai dasar: <b className="num">{tornadoMetric === "cost" ? fmtRp(tornado.base) : fmtSig(tornado.base)}</b>
          </p>
          <Tornado rows={tornado.rows} base={tornado.base} format={tornadoMetric === "cost" ? fmtRpShort : (n) => fmtSig(n)} />
        </CardBody>
      </Card>
      </>
      )}
    </div>
  );
}

/** Mode Ringkas: the four headline indicators, now vs each improvement (one table, no extra charts). */
function SimpleComparison() {
  const { indicators, results } = useActiveResults();
  const { outcomes } = useScenarioOutcomes();
  const ref = results.lci.referenceFlow || NaN;
  const fu = results.lci.fuLabel;
  const rows: Array<{ key: "ccKg" | "waterL" | "wasteKg" | "costRp"; label: string; unit: string; rp?: boolean; info: string }> = [
    { key: "ccKg", label: "Jejak karbon", unit: `kg CO₂e/${fu}`, info: "cc" },
    { key: "waterL", label: "Pemakaian air", unit: `L/${fu}`, info: "wu" },
    { key: "wasteKg", label: "Limbah B3", unit: `kg/${fu}`, info: "b3" },
    { key: "costRp", label: "Biaya proses", unit: `per ${fu}`, rp: true, info: "costPerM2" },
  ];
  return (
    <Card>
      <CardHeader title="Kondisi sekarang vs perbaikan" subtitle="Per 1 m² permukaan dilapisi; hijau = lebih baik" />
      <CardBody>
        <Table caption="Perbandingan perbaikan">
          <THead>
            <tr>
              <Th>Indikator</Th>
              <Th align="right">Kondisi sekarang</Th>
              {outcomes.map((o) => (
                <Th key={o.scenario.id} align="right">
                  {o.scenario.name}
                </Th>
              ))}
            </tr>
          </THead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.key}>
                <Td className="font-medium">
                  <span className="inline-flex items-center gap-1">
                    {r.label} <InfoTip k={r.info} />
                  </span>
                  <span className="block text-[11px] font-normal text-navy-700/55">{r.unit}</span>
                </Td>
                <Td num>{r.rp ? fmtRpShort(indicators[r.key] / ref) : fmt(indicators[r.key] / ref, 2)}</Td>
                {outcomes.map((o) => {
                  const d = o.delta[r.key];
                  const v = o.indicators[r.key] / (o.results.lci.referenceFlow || NaN);
                  return (
                    <Td key={o.scenario.id} num>
                      <span className="block">{r.rp ? fmtRpShort(v) : fmt(v, 2)}</span>
                      <span className={cn("text-[11px]", d.pct < -0.05 ? "text-status-ok" : d.pct > 0.05 ? "text-status-danger" : "text-navy-700/50")}>{fmtDelta(d.pct)}</span>
                    </Td>
                  );
                })}
              </Tr>
            ))}
            <Tr>
              <Td className="font-medium">Hemat per tahun</Td>
              <Td num>–</Td>
              {outcomes.map((o) => (
                <Td key={o.scenario.id} num className="font-semibold">
                  {fmtRp(o.lcc.annualSavingRp)}
                </Td>
              ))}
            </Tr>
            <Tr>
              <Td className="font-medium">Usaha · waktu</Td>
              <Td num>–</Td>
              {outcomes.map((o) => (
                <Td key={o.scenario.id} num>
                  {o.scenario.effort ?? "–"} · {o.scenario.timeline ?? "–"}
                </Td>
              ))}
            </Tr>
          </tbody>
        </Table>
      </CardBody>
    </Card>
  );
}
