"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Badge, ConfidenceBadge } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Feedback";
import { Field, NumberInput, Select, TextInput } from "@/components/ui/Input";
import type { DataMeta, Pedigree, SourceType, StageId } from "@/lib/domain/types";
import { confidenceOf, defaultPedigree, PEDIGREE_KEYS, pedigreeScore, SOURCE_TIER } from "@/lib/engine/quality";
import { STAGE_COLOR } from "@/components/charts/palette";
import { useAppStore } from "@/lib/store/useAppStore";
import { fmt } from "@/lib/utils/format";

export const STAGE_OPTIONS: StageId[] = ["A", "B", "C", "D", "E", "F"];

export function StageSelect({ value, onChange, disabled }: { value: StageId; onChange: (v: StageId) => void; disabled?: boolean }) {
  return (
    <Select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as StageId)} aria-label="Tahap" className="w-[68px]">
      {STAGE_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </Select>
  );
}

export function StageDot({ id }: { id: StageId }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: STAGE_COLOR[id] }}>
      {id}
    </span>
  );
}

/** Data pedigree editor (FR-04.6, FR-03.7); changes go through the audited store action. */
const SIMPLE_SOURCE: Array<{ id: SourceType; label: string }> = [
  { id: "measured", label: "Dari meter / timbangan" },
  { id: "supplier", label: "Dari faktur / catatan" },
  { id: "calculated", label: "Dihitung" },
  { id: "literature", label: "Perkiraan" },
];

export function MetaCell({ meta, onChange, disabled }: { meta: DataMeta; onChange: (m: DataMeta) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DataMeta>(meta);
  const expert = useAppStore((s) => s.ui.expertMode);
  const conf = confidenceOf(meta);
  if (!expert) {
    // Mode Ringkas: one plain question — where does this number come from? (PRD v1.1 §3.0.3)
    const options = SIMPLE_SOURCE.some((o) => o.id === meta.sourceType) ? SIMPLE_SOURCE : [...SIMPLE_SOURCE, { id: meta.sourceType, label: SOURCE_TIER[meta.sourceType].label }];
    return (
      <div className="flex items-center gap-1.5">
        <Select
          value={meta.sourceType}
          disabled={disabled}
          aria-label="Asal angka"
          className="w-[150px] text-xs"
          onChange={(e) => {
            const st = e.target.value as SourceType;
            onChange({ ...meta, sourceType: st, pedigree: defaultPedigree(st) });
          }}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
        <ConfidenceBadge value={conf} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Badge tone="neutral" title={SOURCE_TIER[meta.sourceType].label}>
        T{SOURCE_TIER[meta.sourceType].tier}
      </Badge>
      <ConfidenceBadge value={conf} title={`Skor pedigree ${fmt(pedigreeScore(meta.pedigree), 1)} · ${meta.source || "sumber belum diisi"}`} />
      <IconButton
        label="Ubah metadata & pedigree"
        disabled={disabled}
        onClick={() => {
          setDraft(meta);
          setOpen(true);
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
      </IconButton>
      <Modal
        open={open}
        title="Metadata & data pedigree"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Simpan
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipe sumber (Tier 1–5)">
            <Select
              value={draft.sourceType}
              onChange={(e) => {
                const st = e.target.value as SourceType;
                setDraft({ ...draft, sourceType: st, pedigree: defaultPedigree(st) });
              }}
            >
              {(Object.keys(SOURCE_TIER) as SourceType[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_TIER[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ketidakpastian (%)">
            <NumberInput value={draft.uncertaintyPct} min={0} onCommit={(v) => setDraft({ ...draft, uncertaintyPct: v ?? 0 })} />
          </Field>
          <Field label="Sumber">
            <TextInput value={draft.source} onCommit={(v) => setDraft({ ...draft, source: v })} placeholder="mis. Meter kWh panel C" />
          </Field>
          <Field label="Metode ukur">
            <TextInput value={draft.method} onCommit={(v) => setDraft({ ...draft, method: v })} placeholder="mis. Flowmeter / invoice" />
          </Field>
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold text-navy-900">Pedigree matrix (1 = terbaik, 5 = terburuk)</p>
        <div className="grid grid-cols-5 gap-2">
          {PEDIGREE_KEYS.map((k) => (
            <Field key={k.key} label={k.label}>
              <Select value={draft.pedigree[k.key]} onChange={(e) => setDraft({ ...draft, pedigree: { ...draft.pedigree, [k.key]: Number(e.target.value) } as Pedigree })}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
        <p className="mt-3 text-xs text-navy-700/70">
          Skor {fmt(pedigreeScore(draft.pedigree), 1)} → <ConfidenceBadge value={confidenceOf(draft)} />
        </p>
        <Field label="Catatan" className="mt-3">
          <TextInput multiline rows={2} value={draft.note ?? ""} onCommit={(v) => setDraft({ ...draft, note: v || undefined })} />
        </Field>
      </Modal>
    </div>
  );
}
