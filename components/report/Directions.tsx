"use client";

import { EditableText, IncludeToggle, Optional } from "@/components/report/Editable";
import type { Direction, DirLang } from "@/lib/report/directions";
import { cn } from "@/lib/utils/cn";

const LABEL: Record<string, Record<DirLang, string>> = {
  why: { id: "Mengapa", en: "Why" },
  steps: { id: "Langkah kerja", en: "Work steps" },
  owner: { id: "Penanggung jawab", en: "Responsible" },
  target: { id: "Target", en: "Target" },
  measure: { id: "Cara mengukur keberhasilan", en: "How success is measured" },
  schedule: { id: "Waktu", en: "Timing" },
  basis: { id: "Dasar perhitungan (dari mesin hitung, tidak bisa diubah)", en: "Calculation basis (from the engine, not editable)" },
  note: { id: "Catatan tambahan", en: "Additional note" },
};

/**
 * Improvement directions as a work plan: why, numbered steps, owner, target,
 * how to measure, timing, and the engine's calculation basis. Every text is
 * editable; a whole direction can be left out of the report.
 */
export function DirectionsList({
  byLang,
  langs,
  compact,
  className,
}: {
  byLang: Partial<Record<DirLang, Direction[]>>;
  langs: DirLang[];
  /** One-pager: title, target and owner only. */
  compact?: boolean;
  className?: string;
}) {
  const first = byLang[langs[0]!] ?? [];
  const both = langs.length > 1;
  const sub = (i: number) => cn(i > 0 && "mt-0.5 italic text-navy-700/80");

  if (!first.length) return null;
  return (
    <ol className={cn("space-y-3", className)} data-testid="directions">
      {first.map((d, k) => {
        const per = langs.map((l) => ({ l, d: byLang[l]![k]! }));
        const field = (f: "why" | "owner" | "target" | "measure" | "schedule", as: "p" | "span" = "p") =>
          per.map(({ l, d: x }, i) => <EditableText key={l} id={`${l}:dir:${d.id}:${f}`} text={x[f]} as={as} lang={l} className={sub(i)} label={`${LABEL[f]![l]} — ${x.title}`} />);
        return (
          <li key={d.id} className="break-inside-avoid">
            <Optional id={`dir:${d.id}`} className="rounded-lg border border-sand-200 p-3 print:border-sand-300">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 font-semibold text-navy-900">
                  <span className="mr-1">{k + 1}.</span>
                  {per.map(({ l, d: x }, i) => (
                    <EditableText key={l} id={`${l}:dir:${d.id}:title`} text={x.title} as="span" lang={l} className={cn(i > 0 ? "block font-normal italic text-navy-700/80" : "")} label="Judul arahan" />
                  ))}
                </div>
                <IncludeToggle id={`dir:${d.id}`} label="arahan ini" />
              </div>
              {compact ? (
                <div className="mt-1 space-y-0.5">
                  {field("target")}
                  <p className="text-navy-700/80">
                    <b>{LABEL.owner!.id}:</b> {per[0]!.d.owner}
                  </p>
                </div>
              ) : (
                <dl className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-[160px_1fr]">
                  <Row label={LABEL.why!} langs={langs}>
                    {field("why")}
                  </Row>
                  <Row label={LABEL.steps!} langs={langs}>
                    <ol className="list-decimal space-y-1 pl-4">
                      {per[0]!.d.steps.map((_, j) => (
                        <li key={j}>
                          {per.map(({ l, d: x }, i) => (
                            <EditableText key={l} id={`${l}:dir:${d.id}:step${j}`} text={x.steps[j] ?? ""} lang={l} className={sub(i)} label={`Langkah ${j + 1} — ${x.title}`} />
                          ))}
                        </li>
                      ))}
                    </ol>
                  </Row>
                  <Row label={LABEL.owner!} langs={langs}>
                    {field("owner")}
                  </Row>
                  <Row label={LABEL.target!} langs={langs}>
                    {field("target")}
                  </Row>
                  <Row label={LABEL.measure!} langs={langs}>
                    {field("measure")}
                  </Row>
                  <Row label={LABEL.schedule!} langs={langs}>
                    {field("schedule")}
                  </Row>
                  {per[0]!.d.basis.length > 0 && (
                    <Row label={LABEL.basis!} langs={langs} muted>
                      <ul className="list-disc space-y-0.5 pl-4 text-[0.92em] text-navy-700/80">
                        {per[0]!.d.basis.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </Row>
                  )}
                  {/* Free note, empty by default: printed only when the user writes something. */}
                  {per.map(({ l }) => (
                    <div key={l} className="sm:col-span-2">
                      <EditableText id={`${l}:dir:${d.id}:note`} text="" lang={l} placeholder={`${LABEL.note![l]}${both ? ` (${l.toUpperCase()})` : ""} — opsional`} label={LABEL.note![l]} className="italic" />
                    </div>
                  ))}
                </dl>
              )}
            </Optional>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, langs, children, muted }: { label: Record<DirLang, string>; langs: DirLang[]; children: React.ReactNode; muted?: boolean }) {
  return (
    <>
      <dt className={cn("font-semibold text-navy-900", muted && "font-medium text-navy-700/70")}>
        {langs.map((l, i) => (
          <span key={l} className={cn("block", i > 0 && "font-normal italic text-navy-700/70")}>
            {label[l]}
          </span>
        ))}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}
