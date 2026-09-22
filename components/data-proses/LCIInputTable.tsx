"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PROCESS_STAGES } from "@/lib/lca/constants";
import { useProjectStore } from "@/lib/store/useProjectStore";
import type { Confidence, DataType, LCIInputEntry } from "@/lib/lca/types";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { cn } from "@/lib/utils/cn";

const CATEGORY_TONE: Record<LCIInputEntry["category"], "neutral" | "green" | "gold" | "red"> = {
  Chemical: "gold",
  Anode: "neutral",
  Water: "green",
  Energy: "red",
  WWTPChemical: "gold",
  Consumable: "neutral",
};

const DATA_TYPES: DataType[] = ["Measured", "Calculated", "Estimated"];
const CONFIDENCE_LEVELS: Confidence[] = ["High", "Medium", "Low"];

export function LCIInputTable() {
  const lciInputs = useProjectStore((s) => s.project.lciInputs);
  const updateLCIInput = useProjectStore((s) => s.updateLCIInput);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sorted = [...lciInputs].sort((a, b) => a.no - b.no);

  return (
    <Table>
      <THead>
        <tr>
          <Th className="w-8" />
          <Th className="w-10">No</Th>
          <Th>Kategori</Th>
          <Th>Input</Th>
          <Th>Tahap</Th>
          <Th className="w-32">Kuantitas</Th>
          <Th>Unit</Th>
          <Th className="w-28">Confidence</Th>
        </tr>
      </THead>
      <tbody>
        {sorted.map((entry) => {
          const isOpen = expanded.has(entry.id);
          return (
            <Fragment key={entry.id}>
              <Tr>
                <Td>
                  <button
                    type="button"
                    onClick={() => toggle(entry.id)}
                    className="text-navy-700/50 hover:text-navy-900"
                    aria-label="Detail data pedigree"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </Td>
                <Td>{entry.no}</Td>
                <Td>
                  <Badge tone={CATEGORY_TONE[entry.category]}>{entry.category}</Badge>
                </Td>
                <Td className="font-medium">{entry.name}</Td>
                <Td>
                  <Select
                    value={entry.stageId}
                    onChange={(e) => updateLCIInput(entry.id, { stageId: e.target.value as LCIInputEntry["stageId"] })}
                  >
                    {PROCESS_STAGES.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.code}. {stage.name}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={entry.quantity}
                    onChange={(e) => updateLCIInput(entry.id, { quantity: Number(e.target.value) })}
                  />
                </Td>
                <Td className="whitespace-nowrap text-xs text-navy-700/60">{entry.unit}</Td>
                <Td>
                  <Select
                    value={entry.confidence}
                    onChange={(e) => updateLCIInput(entry.id, { confidence: e.target.value as Confidence })}
                  >
                    {CONFIDENCE_LEVELS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Td>
              </Tr>
              {isOpen && (
                <tr className={cn("bg-sand-50")}>
                  <td colSpan={8} className="border-b border-sand-200 px-6 py-3">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <Field label="Source">
                        <Input
                          value={entry.source}
                          onChange={(e) => updateLCIInput(entry.id, { source: e.target.value })}
                        />
                      </Field>
                      <Field label="Data type">
                        <Select
                          value={entry.dataType}
                          onChange={(e) =>
                            updateLCIInput(entry.id, { dataType: e.target.value as DataType })
                          }
                        >
                          {DATA_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Measurement method">
                        <Input
                          value={entry.measurementMethod}
                          onChange={(e) =>
                            updateLCIInput(entry.id, { measurementMethod: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Uncertainty (%)">
                        <Input
                          type="number"
                          min={0}
                          value={entry.uncertaintyPct}
                          onChange={(e) =>
                            updateLCIInput(entry.id, { uncertaintyPct: Number(e.target.value) })
                          }
                        />
                      </Field>
                      <Field label="Period">
                        <Input
                          value={entry.period}
                          onChange={(e) => updateLCIInput(entry.id, { period: e.target.value })}
                        />
                      </Field>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </Table>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-navy-700/60">{label}</p>
      {children}
    </div>
  );
}
