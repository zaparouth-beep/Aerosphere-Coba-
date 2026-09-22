"use client";

import { useProjectStore } from "@/lib/store/useProjectStore";
import { Input } from "@/components/ui/Input";
import { Table, Td, Th, THead, Tr } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

export function AirEmissionTable() {
  const airEmissions = useProjectStore((s) => s.project.airEmissions);
  const updateAirEmission = useProjectStore((s) => s.updateAirEmission);

  return (
    <Table>
      <THead>
        <tr>
          <Th>Emisi</Th>
          <Th>Relevansi</Th>
          <Th className="w-28">Berlaku?</Th>
          <Th className="w-40">Nilai (kg/periode)</Th>
        </tr>
      </THead>
      <tbody>
        {airEmissions.map((entry) => (
          <Tr key={entry.id}>
            <Td className="font-medium">{entry.parameter}</Td>
            <Td className="text-xs text-navy-700/60">{entry.relevance}</Td>
            <Td>
              <button
                type="button"
                onClick={() => updateAirEmission(entry.id, { applicable: !entry.applicable })}
              >
                <Badge tone={entry.applicable ? "green" : "neutral"}>
                  {entry.applicable ? "Ya" : "Tidak"}
                </Badge>
              </button>
            </Td>
            <Td>
              <Input
                type="number"
                min={0}
                step="any"
                disabled={!entry.applicable}
                value={entry.valueKgPerPeriod}
                onChange={(e) =>
                  updateAirEmission(entry.id, { valueKgPerPeriod: Number(e.target.value) })
                }
              />
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
