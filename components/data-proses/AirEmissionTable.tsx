"use client";

import { Plus, Trash2 } from "lucide-react";
import { useProjectStore } from "@/lib/store/useProjectStore";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { FlowSelect } from "@/components/data-proses/FlowSelect";
import { Button } from "@/components/ui/Button";

export function AirEmissionTable() {
  const airEmissions = useProjectStore((s) => s.project.airEmissions);
  const updateAirEmission = useProjectStore((s) => s.updateAirEmission);
  const addAirEmission = useProjectStore((s) => s.addAirEmission);
  const removeAirEmission = useProjectStore((s) => s.removeAirEmission);

  return (
    <div className="space-y-3">
      <Table>
        <THead>
          <tr>
            <Th>Emisi</Th>
            <Th>Relevansi</Th>
            <Th className="w-28">Berlaku?</Th>
            <Th className="w-48">Aliran LCIA</Th>
            <Th className="w-40">Nilai (kg/proses)</Th>
            <Th className="w-10" />
          </tr>
        </THead>
        <tbody>
          {airEmissions.map((entry) => (
            <Tr key={entry.id}>
              <Td>
                <Input
                  value={entry.parameter}
                  onChange={(e) =>
                    updateAirEmission(entry.id, { parameter: e.target.value })
                  }
                />
              </Td>
              <Td>
                <Input
                  value={entry.relevance}
                  onChange={(e) =>
                    updateAirEmission(entry.id, { relevance: e.target.value })
                  }
                />
              </Td>
              <Td>
                <button
                  type="button"
                  onClick={() =>
                    updateAirEmission(entry.id, {
                      applicable: !entry.applicable,
                    })
                  }
                >
                  <Badge tone={entry.applicable ? "green" : "neutral"}>
                    {entry.applicable ? "Ya" : "Tidak"}
                  </Badge>
                </button>
              </Td>
              <Td>
                <FlowSelect
                  parameter={entry.parameter}
                  flow={entry.flow}
                  medium="air"
                  onChange={(flow) => updateAirEmission(entry.id, { flow })}
                />
              </Td>
              <Td>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  disabled={!entry.applicable}
                  value={entry.valueKgPerPeriod}
                  onChange={(e) =>
                    updateAirEmission(entry.id, {
                      valueKgPerPeriod: Number(e.target.value),
                    })
                  }
                />
              </Td>
              <Td>
                <button
                  type="button"
                  onClick={() => removeAirEmission(entry.id)}
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
          addAirEmission({
            parameter: "Emisi baru",
            relevance: "",
            applicable: true,
            valueKgPerPeriod: 0,
          })
        }
      >
        <Plus className="h-4 w-4" /> Tambah emisi udara
      </Button>
    </div>
  );
}
