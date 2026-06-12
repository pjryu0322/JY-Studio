import type { PrototypeExecutionOperationalSendResult } from "@/lib/prototype/prototypeExecutionOperationalSendResult";
import type { ImplementationStageActionRun } from "@/lib/prototype/implementationStageActionRun";

export type PrototypeExecutionOperationalResultDecision =
  | Readonly<{ kind: "stage_action_run"; run: ImplementationStageActionRun }>
  | Readonly<{ kind: "handled" }>
  | Readonly<{ kind: "continue" }>;

export function classifyPrototypeExecutionOperationalResult(
  result: PrototypeExecutionOperationalSendResult,
): PrototypeExecutionOperationalResultDecision {
  if (result === "handled") return { kind: "handled" };
  if (result === "continue") return { kind: "continue" };
  if (typeof result === "object" && result.kind === "stage_action_run") {
    return { kind: "stage_action_run", run: result.run };
  }
  return { kind: "continue" };
}

export function shouldStopAfterOperationalResult(
  result: PrototypeExecutionOperationalSendResult,
): boolean {
  if (result === "handled") return true;
  if (!result || typeof result !== "object") return false;
  return (
    result.kind === "stage_action_run" ||
    result.kind === "apply_conversation" ||
    result.kind === "timeline_only" ||
    result.kind === "status_query" ||
    result.kind === "assistant_reply"
  );
}

