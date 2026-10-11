import type { TraceStep } from "./types";

/** Records the main calculation steps so every number in the UI can be traced (§4.1). */
export class Trace {
  readonly steps: TraceStep[] = [];

  add(step: TraceStep): number {
    this.steps.push(step);
    return step.result.value;
  }
}
