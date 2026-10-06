"use client";

import { ELEMENTARY_FLOWS, resolveFlow } from "@/lib/lca/lcia";
import { Select } from "@/components/ui/Input";

/** Chooses the elementary flow whose characterisation factors are applied in the LCIA. */
export function FlowSelect({
  parameter,
  flow,
  medium,
  onChange,
}: {
  parameter: string;
  flow: string | undefined;
  medium: "air" | "water";
  onChange: (flow: string | undefined) => void;
}) {
  const auto = resolveFlow(parameter, undefined, medium);
  return (
    <Select value={flow ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}>
      <option value="">{auto ? `Otomatis: ${auto.label}` : "Otomatis (tidak ada yang cocok)"}</option>
      <option value="none">Tidak dikarakterisasi</option>
      {ELEMENTARY_FLOWS.filter((f) => f.medium === medium).map((f) => (
        <option key={f.key} value={f.key}>
          {f.label}
        </option>
      ))}
    </Select>
  );
}
