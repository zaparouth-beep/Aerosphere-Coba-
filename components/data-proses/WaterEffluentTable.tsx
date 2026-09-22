"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";

export function WaterEffluentTable() {
  const waterEffluent = useProjectStore((s) => s.project.waterEffluent);
  const updateWaterEffluent = useProjectStore((s) => s.updateWaterEffluent);

  return (
    <Table>
      <THead>
        <tr>
          <Th>Parameter</Th>
          <Th className="w-24">Unit</Th>
          <Th className="w-40">Nilai</Th>
        </tr>
      </THead>
      <tbody>
        {waterEffluent.map((entry) => (
          <Tr key={entry.id}>
            <Td className="font-medium">{entry.parameter}</Td>
            <Td className="text-xs text-navy-700/60">{entry.unit}</Td>
            <Td>
              <Input
                type="number"
                min={0}
                step="any"
                value={entry.value}
                onChange={(e) => updateWaterEffluent(entry.id, { value: Number(e.target.value) })}
              />
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
