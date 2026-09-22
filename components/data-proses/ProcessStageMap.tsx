import { PROCESS_STAGES } from "@/lib/lca/constants";
import { STAGE_COLORS } from "@/components/charts/palette";

export function ProcessStageMap() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {PROCESS_STAGES.map((stage) => (
        <div key={stage.id} className="rounded-xl border border-sand-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: STAGE_COLORS[stage.id] }}
            >
              {stage.code}
            </span>
            <p className="text-xs font-semibold text-navy-900">{stage.name}</p>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-navy-700/60">{stage.functionDesc}</p>
        </div>
      ))}
    </div>
  );
}
