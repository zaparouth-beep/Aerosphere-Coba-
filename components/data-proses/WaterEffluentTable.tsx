"use client";

import { Plus, Trash2 } from "lucide-react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { FlowSelect } from "@/components/data-proses/FlowSelect";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";

export function WaterEffluentTable() {
  const waterEffluent = useProjectStore((s) => s.project.waterEffluent);
  const updateWaterEffluent = useProjectStore((s) => s.updateWaterEffluent);
  const addWaterEffluent = useProjectStore((s) => s.addWaterEffluent);
  const removeWaterEffluent = useProjectStore((s) => s.removeWaterEffluent);

  return (
    <div className="space-y-3">
      <Table>
        <THead>
          <tr>
            <Th>Parameter</Th>
            <Th className="w-24">Unit</Th>
            <Th className="w-48">Aliran LCIA</Th>
            <Th className="w-40">Nilai</Th>
            <Th className="w-10" />
          </tr>
        </THead>
        <tbody>
          {waterEffluent.map((entry) => (
            <Tr key={entry.id}>
              <Td>
                <Input
                  value={entry.parameter}
                  onChange={(e) =>
                    updateWaterEffluent(entry.id, { parameter: e.target.value })
                  }
                />
              </Td>
              <Td>
                <Input
                  value={entry.unit}
                  onChange={(e) =>
                    updateWaterEffluent(entry.id, { unit: e.target.value })
                  }
                />
              </Td>
              <Td>
                <FlowSelect
                  parameter={entry.parameter}
                  flow={entry.flow}
                  medium="water"
                  onChange={(flow) => updateWaterEffluent(entry.id, { flow })}
                />
              </Td>
              <Td>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={entry.value}
                  onChange={(e) =>
                    updateWaterEffluent(entry.id, {
                      value: Number(e.target.value),
                    })
                  }
                />
              </Td>
              <Td>
                <button
                  type="button"
                  onClick={() => removeWaterEffluent(entry.id)}
                  className="text-navy-700/40 hover:text-accent-red"
                  aria-label="Hapus"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <Button
        variant="secondary"
        onClick={() =>
          addWaterEffluent({
            parameter: "Parameter baru",
            unit: "mg/L",
            value: 0,
          })
        }
      >
        <Plus className="h-4 w-4" /> Tambah parameter efluen
      </Button>
    </div>
  );
}
