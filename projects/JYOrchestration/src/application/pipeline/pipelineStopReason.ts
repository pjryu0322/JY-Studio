/**
 * Typed planning pipeline terminal reasons (internal read-model).
 *
 * {@link legacyEarlyStopReasonString} preserves the previous `PipelineContext.earlyStopReason` wire shape.
 */

export type PipelineStopReasonCode =
  | "FEATURE_ENTRY_GATE_BLOCKED"
  | "FEATURE_ENTRY_GATE_NEEDS_CONFIRMATION"
  | "FEATURE_GENERATION_FAILED"
  | "IA_GENERATION_FAILED"
  | "SCREEN_GENERATION_FAILED"
  | "TASK_GENERATION_FAILED";

export type PipelineStopReason =
  | { code: "FEATURE_ENTRY_GATE_BLOCKED" }
  | { code: "FEATURE_ENTRY_GATE_NEEDS_CONFIRMATION" }
  | { code: "FEATURE_GENERATION_FAILED"; state: string }
  | { code: "IA_GENERATION_FAILED"; state: string }
  | { code: "SCREEN_GENERATION_FAILED"; state: string }
  | { code: "TASK_GENERATION_FAILED"; state: string };

/** Same strings previously written to {@link import("./pipelineContext").PipelineContext.earlyStopReason}. */
export function legacyEarlyStopReasonString(reason: PipelineStopReason): string {
  switch (reason.code) {
    case "FEATURE_ENTRY_GATE_BLOCKED":
      return "feature_entry_gate:BLOCKED";
    case "FEATURE_ENTRY_GATE_NEEDS_CONFIRMATION":
      return "feature_entry_gate:NEEDS_CONFIRMATION";
    case "FEATURE_GENERATION_FAILED":
      return `feature_generation:${reason.state}`;
    case "IA_GENERATION_FAILED":
      return `ia_generation:${reason.state}`;
    case "SCREEN_GENERATION_FAILED":
      return `screen_generation:${reason.state}`;
    case "TASK_GENERATION_FAILED":
      return `task_generation:${reason.state}`;
    default: {
      const _exhaustive: never = reason;
      throw new Error(`legacyEarlyStopReasonString: unexpected stop ${String(_exhaustive)}`);
    }
  }
}

export function pipelineStopFromFeatureEntryStatus(status: "BLOCKED" | "NEEDS_CONFIRMATION"): PipelineStopReason {
  return status === "BLOCKED"
    ? { code: "FEATURE_ENTRY_GATE_BLOCKED" }
    : { code: "FEATURE_ENTRY_GATE_NEEDS_CONFIRMATION" };
}

export function pipelineStopFromGenerationFailure(
  kind: "FEATURE" | "IA" | "SCREEN" | "TASK",
  state: string
): PipelineStopReason {
  switch (kind) {
    case "FEATURE":
      return { code: "FEATURE_GENERATION_FAILED", state };
    case "IA":
      return { code: "IA_GENERATION_FAILED", state };
    case "SCREEN":
      return { code: "SCREEN_GENERATION_FAILED", state };
    case "TASK":
      return { code: "TASK_GENERATION_FAILED", state };
    default: {
      const _e: never = kind;
      return _e;
    }
  }
}
