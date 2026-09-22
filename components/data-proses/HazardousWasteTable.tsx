"use client";

import { Trash2, Plus } from "lucide-react";
import { PROCESS_STAGES } from "@/lib/lca/constants";
import { useProjectStore } from "@/lib/store/useProjectStore";
import type { ProcessStageId } from "@/lib/lca/types";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";

export function HazardousWasteTable() {
  const hazardousWaste = useProjectStore((s) => s.project.hazardousWaste);
  const updateHazardousWaste = useProjectStore((s) => s.updateHazardousWaste);
  const addHazardousWaste = useProjectStore((s) => s.addHazardousWaste);
  const removeHazardousWaste = useProjectStore((s) => s.removeHazardousWaste);

  return (
    <div className="space-y-3">
      <Table>
        <THead>
          <tr>
            <Th>Jenis limbah</Th>
            <Th>Tahap sumber</Th>
            <Th className="w-32">Kuantitas (kg/bln)</Th>
            <Th>Treatment</Th>
            <Th>Destinasi</Th>
            <Th className="w-24">Transport (km)</Th>
            <Th className="w-10" />
          </tr>
        </THead>
        <tbody>
          {hazardousWaste.map((entry) => (
            <Tr key={entry.id}>
              <Td>
                <Input
                  value={entry.wasteType}
                  onChange={(e) => updateHazardousWaste(entry.id, { wasteType: e.target.value })}
                />
              </Td>
              <Td>
                <Select
                  value={entry.sourceStageId}
                  onChange={(e) =>
                    updateHazardousWaste(entry.id, {
                      sourceStageId: e.target.value as ProcessStageId,
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
                  value={entry.quantityKgMonth}
                  onChange={(e) =>
                    updateHazardousWaste(entry.id, { quantityKgMonth: Number(e.target.value) })
                  }
                />
              </Td>
              <Td>
                <Input
                  value={entry.treatment}
                  onChange={(e) => updateHazardousWaste(entry.id, { treatment: e.target.value })}
                />
              </Td>
              <Td>
                <Input
                  value={entry.destination}
                  onChange={(e) => updateHazardousWaste(entry.id, { destination: e.target.value })}
                />
              </Td>
              <Td>
                <Input
                  type="number"
                  min={0}
                  value={entry.transportKm}
                  onChange={(e) =>
                    updateHazardousWaste(entry.id, { transportKm: Number(e.target.value) })
                  }
                />
              </Td>
              <Td>
                <button
                  type="button"
                  onClick={() => removeHazardousWaste(entry.id)}
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
          addHazardousWaste({
            wasteType: "Limbah B3 baru",
            sourceStageId: "wwtp",
            quantityKgMonth: 0,
            hazardClass: "B3",
            moisturePct: 0,
            metalContentPct: 0,
            treatment: "Stabilization/dewatering",
            disposal: "Licensed treatment",
            destination: "Vendor pengolah limbah B3 bersertifikat",
            transportKm: 0,
            recovery: false,
          })
        }
      >
        <Plus className="h-4 w-4" /> Tambah limbah B3
      </Button>
    </div>
  );
}
