"use client";

import { timelineWord } from "@/lib/view/summary";
import { useEffect, useMemo, useState } from "react";
import { OPEN_SCENARIO_EVENT } from "@/components/simulasi/ChangeLab";
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
import { bridge, LEVER_DEFAULTS, LEVERS, sensitivity } from "@/lib/engine/scenario";
import { LockedFeature } from "@/components/ui/Locked";
import { InfoTip } from "@/components/ui/InfoTip";
import { Select } from "@/components/ui/Input";
import { hasFeature, planLimits } from "@/lib/domain/plans";
import { useAppStore } from "@/lib/store/useAppStore";
import { useLiveResults, useScenarioOutcomes } from "@/lib/store/useResults";
import { tx } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";
import { fmt, fmtDelta, fmtRp, fmtRpShort, fmtSig } from "@/lib/utils/format";

const DEFAULTS = LEVER_DEFAULTS;

const PARAMS: Record<LeverId, Array<{ key: string; label: string; text?: boolean }>> = {
  dragout: [{ key: "reductionPct", get label() { return tx("Larutan terbawa berkurang (%)", "Drag-out reduced (%)"); } }],
  countercurrent: [
    { key: "stagesOld", get label() { return tx("Tangki bilas sekarang", "Current rinse tanks"); } },
    { key: "stagesNew", get label() { return tx("Tangki bilas baru", "New rinse tanks"); } },
    { key: "ratio", get label() { return tx("Target kebersihan (C₀/Cₙ)", "Cleanliness target (C₀/Cₙ)"); } },
  ],
  rectifier: [
    { key: "etaOld", get label() { return tx("Efisiensi sekarang (%)", "Current efficiency (%)"); } },
    { key: "etaNew", get label() { return tx("Efisiensi baru (%)", "New efficiency (%)"); } },
  ],
  tankCover: [
    { key: "heatReductionPct", get label() { return tx("Kehilangan panas turun (%)", "Heat loss reduced (%)"); } },
    { key: "mistReductionPct", get label() { return tx("Kabut turun (%)", "Mist reduced (%)"); } },
  ],
  mistSuppressant: [{ key: "reductionPct", get label() { return tx("Kabut berkurang (%)", "Mist reduced (%)"); } }],
  effluentTarget: [
    { key: "parameter", get label() { return tx("Zat di air buangan", "Substance in wastewater"); }, text: true },
    { key: "newValue", get label() { return tx("Kadar target", "Target concentration"); } },
    { key: "flocculantIncreasePct", get label() { return tx("Bahan penggumpal naik (%)", "Flocculant increase (%)"); } },
  ],
  gridFactor: [{ key: "kgCO2ePerKwh", get label() { return tx("Emisi listrik (kg CO₂e/kWh)", "Electricity emissions (kg CO₂e/kWh)"); } }],
  bathConcentration: [
    { key: "cOld", get label() { return tx("Konsentrasi sekarang (g/L)", "Current concentration (g/L)"); } },
    { key: "cNew", get label() { return tx("Konsentrasi baru (g/L)", "New concentration (g/L)"); } },
  ],
};

const INDICATOR_ROWS: Array<{ key: keyof Omit<Indicators, "perFu">; label: string; unit: string; rp?: boolean }> = [
  { key: "energyKwh", get label() { return tx("Energi", "Energy"); }, unit: "kWh" },
  { key: "waterL", get label() { return tx("Air", "Water"); }, unit: "L" },
  { key: "chemicalKg", get label() { return tx("Kimia", "Chemicals"); }, unit: "kg" },
  { key: "wasteKg", get label() { return tx("Limbah B3", "Hazardous (B3) waste"); }, unit: "kg" },
  { key: "effluentM3", get label() { return tx("Volume efluen", "Effluent volume"); }, unit: "m³" },
  { key: "ccKg", label: "Climate change", unit: "kg CO₂e" },
  { key: "costRp", get label() { return tx("Biaya proses", "Process cost"); }, unit: "Rp", rp: true },
  { key: "costLossRp", label: "Cost loss (MFCA)", unit: "Rp", rp: true },
];

type Weights = { cc: number; cost: number; water: number; waste: number };

const STATUS_LABEL: Record<Scenario["status"], string> = {
  get draft() { return tx("Draf", "Draft"); },
  get recommended() { return tx("Disarankan", "Recommended"); },
  get approved() { return tx("Disetujui", "Approved"); },
};

/** English for the stored effort value (shown as-is in Indonesian). */
const EFFORT_EN: Record<string, string> = { rendah: "low", sedang: "medium", tinggi: "high" };

export default function WhatIfPage() {
  const { project, indicators } = useLiveResults();
  const { outcomes } = useScenarioOutcomes({ live: true });
  const role = useAppStore((s) => s.user.role);
  const addScenario = useAppStore((s) => s.addScenario);
  const updateScenario = useAppStore((s) => s.updateScenario);
  const setLevers = useAppStore((s) => s.setLevers);
  const removeScenario = useAppStore((s) => s.removeScenario);
  const markRecommended = useAppStore((s) => s.markRecommended);
  const approveScenario = useAppStore((s) => s.approveScenario);
  const runCalculation = useAppStore((s) => s.runCalculation);
  const [activeId, setActiveId] = useState<string | null>(project.scenarios[0]?.id ?? null);
  // "Lihat perhitungannya" from Titik Boros opens /simulasi?skenario=<id>.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("skenario");
    if (id && project.scenarios.some((s) => s.id === id)) {
      setActiveId(id);
      requestAnimationFrame(() => document.getElementById("detail-simulasi")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    // Only on first load of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // "Lihat perhitungannya" from the change lab on the same page.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setActiveId(id);
      requestAnimationFrame(() => document.getElementById("detail-simulasi")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    window.addEventListener(OPEN_SCENARIO_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SCENARIO_EVENT, onOpen);
  }, []);
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
          <CardHeader title={tx("Daftar perbaikan", "Improvement list")} info="whatif" subtitle={tx(`Kondisi sekarang + maksimal ${maxScenarios} simulasi`, `Current state + up to ${maxScenarios} simulations`)} action={editable && <IconButton label={tx("Tambah simulasi", "Add simulation")} onClick={addScenario} disabled={project.scenarios.length >= maxScenarios}><Plus className="h-4 w-4" /></IconButton>} />
          <CardBody className="space-y-2">
            <div className="rounded-lg border border-sand-200 bg-sand-50 p-3 text-xs">
              <p className="font-semibold text-navy-900">{expert ? "S0 · Baseline" : tx("Kondisi sekarang", "Current state")}</p>
              <p className="text-navy-700/65">{tx("Data proses saat ini, tanpa perubahan", "Current process data, unchanged")}</p>
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
                    {s.id === bestId && <Star className="ml-auto h-3.5 w-3.5 fill-brand-gold text-brand-gold" aria-label={tx("Skor terbaik", "Best score")} />}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={s.status === "approved" ? "green" : s.status === "recommended" ? "blue" : "neutral"}>{STATUS_LABEL[s.status]}</Badge>
                    {o && <Badge tone={o.delta.ccKg.pct < 0 ? "green" : "neutral"}>{tx("Karbon", "Carbon")} {fmtDelta(o.delta.ccKg.pct)}</Badge>}
                    {o && <Badge tone={o.delta.costRp.pct < 0 ? "green" : "neutral"}>{tx("Biaya", "Cost")} {fmtDelta(o.delta.costRp.pct)}</Badge>}
                  </span>
                </button>
              );
            })}
          </CardBody>
        </Card>

        {active && activeOutcome ? (
          <Card id="detail-simulasi">
            <CardHeader
              eyebrow={expert ? tx(`Skenario ${active.code}`, `Scenario ${active.code}`) : undefined}
              title={active.name}
              subtitle={expert ? tx("Disimpan sebagai delta terhadap baseline; engine menghitung ulang LCI → LCIA → MFCA", "Stored as a delta to the baseline; the engine recalculates LCI → LCIA → MFCA") : tx("Mesin hitung menghitung ulang seluruh lini dengan perubahan ini.", "The calculation engine recalculates the whole line with this change.")}
              action={
                <>
                  <Button size="sm" variant="secondary" disabled={!editable} onClick={() => markRecommended(active.id)}>
                    <Star className="h-3.5 w-3.5" /> {tx("Tandai disarankan", "Mark as recommended")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => runCalculation("draft", active.id)}>
                    <Lock className="h-3.5 w-3.5" /> {tx("Simpan hasil simulasi", "Save simulation result")}
                  </Button>
                  <Button size="sm" variant="brand" disabled={!can(role, "approveScenario") || active.status === "approved"} onClick={() => approveScenario(active.id)}>
                    <BadgeCheck className="h-3.5 w-3.5" /> {tx("Setujui", "Approve")}
                  </Button>
                  {editable && (
                    <IconButton label={tx("Hapus simulasi", "Delete simulation")} onClick={() => removeScenario(active.id)} className="hover:text-status-danger">
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  )}
                </>
              }
            />
            <CardBody className="space-y-4">
              {!hasFeature(subscription, "editScenario") && <LockedFeature feature="editScenario" compact title={tx("Ubah angka simulasi", "Edit simulation numbers")} />}
              <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
                <Field label={tx("Nama", "Name")}>
                  <TextInput value={active.name} disabled={!editable} onCommit={(v) => updateScenario(active.id, { name: v })} />
                </Field>
                <Field label={tx("Deskripsi", "Description")}>
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
                          <span className="block text-[11px] text-navy-700/65">{tx("Berpengaruh ke:", "Affects:")} {lv.affects}</span>
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
                                <NumberInput value={Number(values[p.key])} min={0} disabled={!editable} ariaLabel={p.label} onCommit={(v) => setParam(active, lv.id, p.key, v ?? 0)} />
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
                <Field label={expert ? "Capex (Rp)" : tx("Biaya investasi (Rp)", "Investment cost (Rp)")}>
                  <NumberInput value={active.capexRp} min={0} disabled={!editable} onCommit={(v) => updateScenario(active.id, { capexRp: v ?? 0 })} />
                </Field>
                <Field label={expert ? tx("Tambahan opex (Rp/periode)", "Extra opex (Rp/period)") : tx("Tambahan biaya operasi (Rp/periode)", "Extra operating cost (Rp/period)")}>
                  <NumberInput value={active.extraOpexRpPerPeriod} min={0} disabled={!editable} onCommit={(v) => updateScenario(active.id, { extraOpexRpPerPeriod: v ?? 0 })} />
                </Field>
                <Field label={expert ? tx("Umur aset (tahun)", "Asset lifetime (years)") : tx("Umur alat (tahun)", "Equipment lifetime (years)")}>
                  <NumberInput value={active.lifetimeYears} min={0} disabled={!editable} onCommit={(v) => updateScenario(active.id, { lifetimeYears: v ?? 0 })} />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label={tx("Usaha", "Effort")}>
                  <Select value={active.effort ?? "sedang"} disabled={!editable} onChange={(e) => updateScenario(active.id, { effort: e.target.value as Scenario["effort"] })}>
                    <option value="rendah">{tx("Rendah", "Low")}</option>
                    <option value="sedang">{tx("Sedang", "Medium")}</option>
                    <option value="tinggi">{tx("Tinggi", "High")}</option>
                  </Select>
                </Field>
                <Field label={tx("Perkiraan waktu", "Estimated time")}>
                  <TextInput value={active.timeline ?? ""} disabled={!editable} placeholder={tx("mis. 1–3 bulan", "e.g. 1–3 months")} onCommit={(v) => updateScenario(active.id, { timeline: v })} />
                </Field>
              </div>
              <div className="rounded-lg border border-sand-200 bg-sand-50 p-3 text-xs">
                <p className="mb-1 font-semibold text-navy-900">{expert ? tx("Asumsi skenario (fungsi propagasi terdokumentasi)", "Scenario assumptions (documented propagation functions)") : tx("Yang dihitung ulang", "What is recalculated")}</p>
                {activeOutcome.assumptions.length ? (
                  <ul className="list-disc space-y-0.5 pl-4 text-navy-800">
                    {activeOutcome.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-navy-700/60">{tx("Centang minimal satu perbaikan.", "Tick at least one improvement.")}</p>
                )}
                <p className="mt-2 text-navy-800">
                  {tx(`Hemat ${fmtRp(activeOutcome.lcc.annualSavingRp)} per tahun · balik modal `, `Saves ${fmtRp(activeOutcome.lcc.annualSavingRp)} per year · payback `)}
                  {activeOutcome.lcc.paybackYears === null ? "–" : active.capexRp > 0 ? tx(`${fmt(activeOutcome.lcc.paybackYears, 1)} tahun`, `${fmt(activeOutcome.lcc.paybackYears, 1)} years`) : tx("langsung (tanpa investasi)", "immediate (no investment)")}
                  {expert && <> · NPV ({project.targets.discountRatePct}%) {fmtRp(activeOutcome.lcc.npvRp)}</>}
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Callout tone="info">{tx("Belum ada simulasi. Tambahkan dengan tombol +, atau minta saran lewat Tanya AeroSphere.", "No simulations yet. Add one with the + button, or ask for suggestions via Ask AeroSphere.")}</Callout>
        )}
      </div>

      {!expert && <SimpleComparison />}
      {expert && (
      <>
      <Card>
        <CardHeader title={tx("Perbandingan S0–S3", "S0–S3 comparison")} subtitle={tx("Nilai per periode; Δ terhadap baseline (hijau = turun)", "Values per period; Δ vs baseline (green = lower)")} />
        <CardBody>
          <Table caption={tx("Perbandingan skenario", "Scenario comparison")}>
            <THead>
              <tr>
                <Th>{tx("Indikator", "Indicator")}</Th>
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
                <Td className="font-medium">{tx("Payback (tahun)", "Payback (years)")}</Td>
                <Td num>–</Td>
                {outcomes.map((o) => (
                  <Td key={o.scenario.id} num>
                    {o.lcc.paybackYears === null ? "–" : o.scenario.capexRp ? fmt(o.lcc.paybackYears, 1) : tx("tanpa capex", "no capex")}
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
            title={tx(`Bridge ${active?.code ?? ""}: baseline → per lever → skenario`, `Bridge ${active?.code ?? ""}: baseline → per lever → scenario`)}
            subtitle={tx("Lever diterapkan berurutan; batang hijau = penurunan", "Levers applied in sequence; green bars = reduction")}
            action={<Segmented size="xs" ariaLabel={tx("Indikator bridge", "Bridge indicator")} value={bridgeMetric} onChange={setBridgeMetric} options={[{ id: "cc", label: "GWP" }, { id: "cost", label: tx("Biaya", "Cost") }]} />}
          />
          <CardBody>{bridgeSteps.length > 1 ? <Waterfall steps={bridgeSteps} format={bridgeMetric === "cc" ? (n) => fmt(n, 1) : fmtRpShort} /> : <p className="py-10 text-center text-xs text-navy-700/60">{tx("Aktifkan lever pada skenario terpilih.", "Turn on a lever in the selected scenario.")}</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title="Decision matrix" subtitle={tx("Skor = rata-rata tertimbang % perbaikan; ukuran gelembung = |Δ air|", "Score = weighted average % improvement; bubble size = |Δ water|")} />
          <CardBody className="space-y-3">
            {!weightsAllowed ? <LockedFeature feature="decisionWeights" compact /> : (<>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              {(
                [
                  ["cc", "GWP"],
                  ["cost", tx("Biaya", "Cost")],
                  ["water", tx("Air", "Water")],
                  ["waste", tx("Limbah B3", "Hazardous (B3) waste")],
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
            <Table caption={tx("Skor keputusan", "Decision score")}>
              <THead>
                <tr>
                  <Th>{tx("Skenario", "Scenario")}</Th>
                  <Th align="right">{tx("Skor", "Score")}</Th>
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
          title={tx("Sensitivitas ±10% (tornado)", "Sensitivity ±10% (tornado)")}
          subtitle={tx("One-at-a-time pada baseline (FR-09.4); faktor grid diuji pada rentang 0,61–0,87 kg CO₂e/kWh", "One-at-a-time on the baseline (FR-09.4); grid factor tested over 0.61–0.87 kg CO₂e/kWh")}
          action={<Segmented size="xs" ariaLabel={tx("Indikator sensitivitas", "Sensitivity indicator")} value={tornadoMetric} onChange={setTornadoMetric} options={[{ id: "cc", label: "GWP/FU" }, { id: "cost", label: tx("Biaya/FU", "Cost/FU") }, { id: "energy", label: tx("Energi/FU", "Energy/FU") }]} />}
        />
        <CardBody>
          <p className="mb-2 text-xs text-navy-800">
            {tx("Nilai dasar:", "Base value:")} <b className="num">{tornadoMetric === "cost" ? fmtRp(tornado.base) : fmtSig(tornado.base)}</b>
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
  const { indicators, results } = useLiveResults();
  const { outcomes } = useScenarioOutcomes({ live: true });
  const ref = results.lci.referenceFlow || NaN;
  const fu = results.lci.fuLabel;
  type Row = { key: "ccKg" | "waterL" | "wasteKg" | "costRp" | "energyKwh" | "chemicalKg" | "airKg" | "effluentMetalKg"; label: string; unit: string; rp?: boolean; info?: string; optional?: boolean };
  const all: Row[] = [
    { key: "ccKg", label: tx("Jejak karbon", "Carbon footprint"), unit: `kg CO₂e/${fu}`, info: "cc" },
    { key: "waterL", label: tx("Pemakaian air", "Water use"), unit: `L/${fu}`, info: "wu" },
    { key: "wasteKg", label: tx("Limbah B3", "Hazardous (B3) waste"), unit: `kg/${fu}`, info: "b3" },
    { key: "costRp", label: tx("Biaya proses", "Process cost"), unit: `per ${fu}`, rp: true, info: "costPerM2" },
    { key: "energyKwh", label: tx("Listrik", "Electricity"), unit: `kWh/${fu}`, optional: true },
    { key: "chemicalKg", label: tx("Bahan kimia", "Chemicals"), unit: `kg/${fu}`, optional: true },
    { key: "airKg", label: tx("Emisi udara langsung", "Direct air emissions"), unit: `g/${fu}`, optional: true },
    { key: "effluentMetalKg", label: tx("Logam di air buangan", "Metals in wastewater"), unit: `g/${fu}`, optional: true },
  ];
  // Extra rows only when some simulation changes them (e.g. mist or effluent improvements).
  const rows = all.filter((r) => !r.optional || outcomes.some((o) => Math.abs(o.delta[r.key].pct) >= 0.05));
  const scale = (r: Row) => (r.key === "airKg" || r.key === "effluentMetalKg" ? 1000 : 1);
  return (
    <Card>
      <CardHeader title={tx("Kondisi sekarang vs perbaikan", "Current state vs improvements")} subtitle={tx("Per 1 m² permukaan dilapisi; hijau = lebih baik", "Per 1 m² of plated surface; green = better")} />
      <CardBody>
        <Table caption={tx("Perbandingan perbaikan", "Improvement comparison")}>
          <THead>
            <tr>
              <Th>{tx("Indikator", "Indicator")}</Th>
              <Th align="right">{tx("Kondisi sekarang", "Current state")}</Th>
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
                    {r.label} {r.info && <InfoTip k={r.info} />}
                  </span>
                  <span className="block text-[11px] font-normal text-navy-700/55">{r.unit}</span>
                </Td>
                <Td num>{r.rp ? fmtRpShort(indicators[r.key] / ref) : fmt((indicators[r.key] * scale(r)) / ref, 2)}</Td>
                {outcomes.map((o) => {
                  const d = o.delta[r.key];
                  const v = (o.indicators[r.key] * (r.rp ? 1 : scale(r))) / (o.results.lci.referenceFlow || NaN);
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
              <Td className="font-medium">{tx("Hemat per tahun", "Saves per year")}</Td>
              <Td num>–</Td>
              {outcomes.map((o) => (
                <Td key={o.scenario.id} num className="font-semibold">
                  {fmtRp(o.lcc.annualSavingRp)}
                </Td>
              ))}
            </Tr>
            <Tr>
              <Td className="font-medium">{tx("Usaha · waktu", "Effort · time")}</Td>
              <Td num>–</Td>
              {outcomes.map((o) => (
                <Td key={o.scenario.id} num>
                  {o.scenario.effort ? tx(o.scenario.effort, EFFORT_EN[o.scenario.effort] ?? o.scenario.effort) : "–"} · {o.scenario.timeline ? timelineWord(o.scenario.timeline) : "–"}
                </Td>
              ))}
            </Tr>
          </tbody>
        </Table>
      </CardBody>
    </Card>
  );
}
