"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { PROCESS_STAGES } from "@/lib/lca/constants";
import { useProjectStore } from "@/lib/store/useProjectStore";
import type {
  Confidence,
  DataType,
  LCICategory,
  LCIInputEntry,
} from "@/lib/lca/types";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { cn } from "@/lib/utils/cn";

const CATEGORIES: LCICategory[] = [
  "Chemical",
  "Anode",
  "Water",
  "Energy",
  "WWTPChemical",
  "Consumable",
];

const DATA_TYPES: DataType[] = ["Measured", "Calculated", "Estimated"];
const CONFIDENCE_LEVELS: Confidence[] = ["High", "Medium", "Low"];

export function LCIInputTable() {
  const lciInputs = useProjectStore((s) => s.project.lciInputs);
  const updateLCIInput = useProjectStore((s) => s.updateLCIInput);
  const addLCIInput = useProjectStore((s) => s.addLCIInput);
  const removeLCIInput = useProjectStore((s) => s.removeLCIInput);
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
    <div className="space-y-3">
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
            <Th className="w-10" />
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
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </Td>
                  <Td>{entry.no}</Td>
                  <Td>
                    <Select
                      value={entry.category}
                      onChange={(e) =>
                        updateLCIInput(entry.id, {
                          category: e.target.value as LCICategory,
                        })
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Input
                      value={entry.name}
                      onChange={(e) =>
                        updateLCIInput(entry.id, { name: e.target.value })
                      }
                    />
                  </Td>
                  <Td>
                    <Select
                      value={entry.stageId}
                      onChange={(e) =>
                        updateLCIInput(entry.id, {
                          stageId: e.target.value as LCIInputEntry["stageId"],
                        })
                      }
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
                      onChange={(e) =>
                        updateLCIInput(entry.id, {
                          quantity: Number(e.target.value),
                        })
                      }
                    />
                  </Td>
                  <Td>
                    <Input
                      value={entry.unit}
                      onChange={(e) =>
                        updateLCIInput(entry.id, { unit: e.target.value })
                      }
                    />
                  </Td>
                  <Td>
                    <Select
                      value={entry.confidence}
                      onChange={(e) =>
                        updateLCIInput(entry.id, {
                          confidence: e.target.value as Confidence,
                        })
                      }
                    >
                      {CONFIDENCE_LEVELS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={() => removeLCIInput(entry.id)}
                      className="text-navy-700/40 hover:text-accent-red"
                      aria-label="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Td>
                </Tr>
                {isOpen && (
                  <tr className={cn("bg-sand-50")}>
                    <td
                      colSpan={9}
                      className="border-b border-sand-200 px-6 py-3"
                    >
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <Field label="Source">
                          <Input
                            value={entry.source}
                            onChange={(e) =>
                              updateLCIInput(entry.id, {
                                source: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label="Data type">
                          <Select
                            value={entry.dataType}
                            onChange={(e) =>
                              updateLCIInput(entry.id, {
                                dataType: e.target.value as DataType,
                              })
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
                              updateLCIInput(entry.id, {
                                measurementMethod: e.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label="Uncertainty (%)">
                          <Input
                            type="number"
                            min={0}
                            value={entry.uncertaintyPct}
                            onChange={(e) =>
                              updateLCIInput(entry.id, {
                                uncertaintyPct: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field label="Harga satuan (Rp, kosong = harga kategori)">
                        <Input
                          type="number"
                          min={0}
                          placeholder="Ikuti harga kategori"
                          value={entry.unitPriceRp ?? ""}
                          onChange={(e) =>
                            updateLCIInput(entry.id, {
                              unitPriceRp: e.target.value === "" ? undefined : Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                      <Field label="Period">
                          <Input
                            value={entry.period}
                            onChange={(e) =>
                              updateLCIInput(entry.id, {
                                period: e.target.value,
                              })
                            }
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
      <Button
        variant="secondary"
        onClick={() =>
          addLCIInput({
            no: lciInputs.reduce((max, e) => Math.max(max, e.no), 0) + 1,
            category: "Chemical",
            name: "Input baru",
            unit: "kg",
            stageId: "pretreatment",
            quantity: 0,
            source: "",
            dataType: "Estimated",
            measurementMethod: "",
            uncertaintyPct: 0,
            period: "",
            confidence: "Low",
          })
        }
      >
        <Plus className="h-4 w-4" /> Tambah input LCI
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-navy-700/60">{label}</p>
      {children}
    </div>
  );
}
