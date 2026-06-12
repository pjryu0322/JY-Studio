import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ServerQuickRunContinuationOutcome =
  | "dispatched"
  | "no_next_task"
  | "queue_state_mismatch"
  | "already_in_flight"
  | "prompt_gate_failed"
  | "execute_request_failed"
  | "skipped";

export type ServerQuickRunContinuationResult = Readonly<{
  readonly ok: boolean;
  readonly outcome: ServerQuickRunContinuationOutcome;
  readonly nextTaskId?: string | null;
  readonly nextCodeTaskId?: string | null;
  readonly reason?: string | null;
  readonly diagnostics?: unknown;
  readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
}>;
