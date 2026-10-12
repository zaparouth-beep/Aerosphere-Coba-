"use client";

import ExpertWhatIf from "@/components/expert/ExpertWhatIf";
import { ChangeLab } from "@/components/simulasi/ChangeLab";
import { Callout } from "@/components/ui/Feedback";
import { T, tx } from "@/lib/i18n";
import { useAppStore } from "@/lib/store/useAppStore";
import { useLiveResults, useScenarioOutcomes } from "@/lib/store/useResults";

/**
 * Simulasi always works on the live data: changes in Data Saya and in the
 * simulation settings show up here at once. A saved result selected in the
 * top bar stays unchanged and is used by the other menus.
 */
export default function Page() {
  const { project, results, indicators } = useLiveResults();
  const { outcomes } = useScenarioOutcomes({ live: true });
  const activeRunId = useAppStore((s) => s.ui.activeRunId);
  const setUi = useAppStore((s) => s.setUi);
  return (
    <div className="space-y-6">
      {activeRunId && (
        <div data-testid="sim-live-note">
          <Callout>
            <T
              id={<>Simulasi selalu dihitung dari <b>data terkini</b>. Menu lain sedang menampilkan hasil tersimpan #{activeRunId}.</>}
              en={<>The simulation is always calculated from the <b>current data</b>. Other menus are showing saved result #{activeRunId}.</>}
            />{" "}
            <button type="button" className="font-medium text-brand-blue underline" onClick={() => setUi({ activeRunId: null })}>
              {tx("Tampilkan data terkini di semua menu", "Show current data in all menus")}
            </button>
          </Callout>
        </div>
      )}
      {results.analysis && <ChangeLab project={project} run={results.analysis} base={indicators} outcomes={outcomes} />}
      <ExpertWhatIf />
    </div>
  );
}
