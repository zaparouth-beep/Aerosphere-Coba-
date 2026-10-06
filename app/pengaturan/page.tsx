"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { useProjectStore } from "@/lib/store/useProjectStore";
import type { FunctionalUnitType } from "@/lib/lca/types";

const FU_OPTIONS: Array<{ value: FunctionalUnitType; label: string }> = [
  { value: "m2_plated", label: "1 m² luas permukaan ter-plating" },
  { value: "part", label: "1 part" },
  { value: "kg_metal_deposited", label: "1 kg logam terdeposit" },
];

export default function PengaturanPage() {
  const project = useProjectStore((s) => s.project);
  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta);
  const updatePart = useProjectStore((s) => s.updatePart);
  const updateFunctionalUnit = useProjectStore((s) => s.updateFunctionalUnit);
  const resetProject = useProjectStore((s) => s.resetProject);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Informasi Proyek" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Nama proyek</Label>
            <Input
              value={project.name}
              onChange={(e) => updateProjectMeta({ name: e.target.value })}
            />
          </div>
          <div>
            <Label>Fasilitas</Label>
            <Input
              value={project.facility}
              onChange={(e) => updateProjectMeta({ facility: e.target.value })}
            />
          </div>
          <div>
            <Label>Klien</Label>
            <Input
              value={project.client}
              onChange={(e) => updateProjectMeta({ client: e.target.value })}
            />
          </div>
          <div>
            <Label>Periode</Label>
            <Input
              value={project.period}
              onChange={(e) => updateProjectMeta({ period: e.target.value })}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Informasi Part" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Nama part</Label>
            <Input
              value={project.part.partName}
              onChange={(e) => updatePart({ partName: e.target.value })}
            />
          </div>
          <div>
            <Label>Material</Label>
            <Input
              value={project.part.material}
              onChange={(e) => updatePart({ material: e.target.value })}
            />
          </div>
          <div>
            <Label>Massa stok awal (kg)</Label>
            <Input
              type="number"
              min={0}
              value={project.part.initialStockMassKg}
              onChange={(e) => updatePart({ initialStockMassKg: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Massa produk jadi (kg)</Label>
            <Input
              type="number"
              min={0}
              value={project.part.finishedMassKg}
              onChange={(e) => updatePart({ finishedMassKg: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Volume tahunan (part)</Label>
            <Input
              type="number"
              min={0}
              value={project.part.annualVolumeParts}
              onChange={(e) => updatePart({ annualVolumeParts: Number(e.target.value) })}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Functional Unit" subtitle="Basis normalisasi untuk seluruh perhitungan intensitas & hotspot" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Tipe unit fungsional</Label>
            <Select
              value={project.functionalUnit.type}
              onChange={(e) =>
                updateFunctionalUnit({ type: e.target.value as FunctionalUnitType })
              }
            >
              {FU_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Total produksi per proses</Label>
            <Input
              type="number"
              min={0}
              step="any"
              value={project.functionalUnit.value}
              onChange={(e) => updateFunctionalUnit({ value: Number(e.target.value) })}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Reset Data" subtitle="Kembalikan seluruh data proyek ke contoh bawaan" />
        <CardBody className="flex items-center gap-3">
          {!confirmReset ? (
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="h-4 w-4" /> Reset ke data contoh
            </Button>
          ) : (
            <>
              <span className="text-sm text-navy-700/70">
                Yakin? Semua perubahan pada proyek ini akan hilang.
              </span>
              <Button
                variant="danger"
                onClick={() => {
                  resetProject();
                  setConfirmReset(false);
                }}
              >
                Ya, reset
              </Button>
              <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                Batal
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
