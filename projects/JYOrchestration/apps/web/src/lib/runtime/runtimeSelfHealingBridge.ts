/**
 * Self-healing bridge — review failure → future cursor re-run (Phase 2 stub).
 */

import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";

export type SelfHealingBridgeInput = {
  readonly projectId: string;
  readonly taskId: string;
  readonly execRunId: string;
  readonly actorUserId: string;
  readonly reviewReason: string;
};

export type SelfHealingBridgeResult = {
  readonly triggered: boolean;
  readonly reason?: string;
  readonly createdTaskIds?: string[];
};

export async function maybeEnqueueSelfHealingFromReviewFailure(
  input: SelfHealingBridgeInput
): Promise<SelfHealingBridgeResult> {
  await appendRuntimeEvent({
    eventType: "SELF_HEALING_SKIPPED",
    severity: "info",
    projectId: input.projectId,
    taskId: input.taskId,
    execRunId: input.execRunId,
    actorUserId: input.actorUserId,
    workerName: "pipeline",
    detail: { reviewReason: input.reviewReason.slice(0, 2000), stub: "NOT_IMPLEMENTED" },
  });

  return { triggered: false, reason: "NOT_IMPLEMENTED" };
}
