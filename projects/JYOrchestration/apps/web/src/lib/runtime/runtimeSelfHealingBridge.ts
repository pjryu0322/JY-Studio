/**
 * Self-healing bridge — review failure → AUTO_HEALING task candidate creation.
 */

import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";
import { triggerSelfHealingLite } from "@/lib/service/selfHealingService";

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
  readonly autoCursorEnqueued?: boolean;
};

export function isRuntimeSelfHealingAutoCursorEnabled(): boolean {
  return process.env.RUNTIME_SELF_HEALING_AUTO_CURSOR === "1";
}

export async function maybeEnqueueSelfHealingFromReviewFailure(
  input: SelfHealingBridgeInput
): Promise<SelfHealingBridgeResult> {
  const jobId = `runtime-review-${input.execRunId}`;
  const res = await triggerSelfHealingLite({
    jobId,
    projectId: input.projectId,
    failureType: "REVIEW_REJECTED",
    detailJson: {
      reviewReason: input.reviewReason.slice(0, 4000),
      execRunId: input.execRunId,
      sourceTaskId: input.taskId,
    },
    sourceTaskId: input.taskId,
  });

  if (!res.created) {
    await appendRuntimeEvent({
      eventType: "SELF_HEALING_SKIPPED",
      severity: "info",
      projectId: input.projectId,
      taskId: input.taskId,
      execRunId: input.execRunId,
      actorUserId: input.actorUserId,
      workerName: "pipeline",
      detail: { reviewReason: input.reviewReason.slice(0, 2000), reason: res.reason ?? "NOT_CREATED" },
    });
    return { triggered: false, reason: res.reason ?? "NOT_CREATED" };
  }

  const createdTaskIds = res.createdTasks.map((t) => t.taskId);

  await appendRuntimeEvent({
    eventType: "AUTO_HEALING_TRIGGERED",
    projectId: input.projectId,
    taskId: input.taskId,
    execRunId: input.execRunId,
    actorUserId: input.actorUserId,
    workerName: "pipeline",
    detail: {
      createdTaskIds,
      strategies: res.strategies,
      reviewReason: input.reviewReason.slice(0, 2000),
    },
  });

  let autoCursorEnqueued = false;
  if (isRuntimeSelfHealingAutoCursorEnabled() && createdTaskIds.length > 0) {
    const { enqueueExecution } = await import("@/lib/service/executionQueue");
    for (const healingTaskId of createdTaskIds) {
      const enq = await enqueueExecution({
        projectId: input.projectId,
        type: "cursor",
        payload: {
          execRunId: input.execRunId,
          taskId: healingTaskId,
          projectId: input.projectId,
          actorUserId: input.actorUserId,
          singleTaskId: healingTaskId,
          selfHealingFromExecRunId: input.execRunId,
        },
      });
      if (enq.queued) {
        autoCursorEnqueued = true;
      }
    }
  }

  return { triggered: true, createdTaskIds, autoCursorEnqueued };
}
