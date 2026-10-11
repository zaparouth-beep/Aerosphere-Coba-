"use client";

import ExpertWhatIf from "@/components/expert/ExpertWhatIf";
import { ChangeLab } from "@/components/simulasi/ChangeLab";
import { useActiveResults, useScenarioOutcomes } from "@/lib/store/useResults";

export default function Page() {
  const { project, results } = useActiveResults();
  const { outcomes } = useScenarioOutcomes();
  return (
    <div className="space-y-6">
      {results.analysis && <ChangeLab project={project} run={results.analysis} outcomes={outcomes} />}
      <ExpertWhatIf />
    </div>
  );
}
