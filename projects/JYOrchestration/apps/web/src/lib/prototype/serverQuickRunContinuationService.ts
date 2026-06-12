export type {
  ServerQuickRunContinuationOutcome,
  ServerQuickRunContinuationResult,
} from "@/lib/prototype/serverQuickRunContinuationTypes";

import { dispatchDbQueuedAutoAdvanceOnServer } from "@/lib/prototype/implementationDbQueuedExecutionUnitDispatch";
import { scheduleNextExecutionUnitAfterVerified } from "@/lib/prototype/implementationExecutionSchedulerDispatch";
import type { ServerQuickRunContinuationResult } from "@/lib/prototype/serverQuickRunContinuationTypes";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

/**
 * @deprecated legacy_runtime_deprecated — use dispatchDbQueuedAutoAdvanceOnServer / dispatchNextExecutionUnitOnServer (P3-M71).
 */
export async function tryDispatchCurrentQueuedQuickRunAfterDbAdvance(input: {
  readonly projectId: string;
  readonly nowIso?: string;
}): Promise<ServerQuickRunContinuationResult> {
  return dispatchDbQueuedAutoAdvanceOnServer(input);
}

/** @deprecated legacy_runtime_deprecated — use scheduleNextExecutionUnitAfterVerified (P3-M71). */
export async function continueSelectedCodeTaskQueueAfterAutoGate(input: {
  readonly projectId: string;
  readonly completedTaskId: string;
  readonly completedCodeTaskId?: string | null;
  readonly sourceCommitSha?: string | null;
  readonly runId?: string | null;
  readonly nowIso?: string;
  readonly requirementsOverlay?: Partial<RequirementsStateJson> | null;
}): Promise<ServerQuickRunContinuationResult> {
  const completedCodeTaskId =
    input.completedCodeTaskId?.trim() || input.completedTaskId.trim();
  const scheduled = await scheduleNextExecutionUnitAfterVerified({
    projectId: input.projectId,
    completedTaskId: input.completedTaskId,
    completedCodeTaskId,
    sourceCommitSha: input.sourceCommitSha,
    requirementsOverlay: input.requirementsOverlay,
    nowIso: input.nowIso,
  });
  return {
    ...scheduled.result,
    timelineEntries: scheduled.timeline,
  };
}
