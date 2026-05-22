/**
 * Self-healing bridge — review failure → AUTO_HEALING task + optional cursor enqueue.
 */

import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";
import { createSelfHealingExecutionRun } from "@/lib/runtime/runtimeSelfHealingExecution";
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
  readonly healingExecRunIds?: string[];
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
  const healingExecRunIds: string[] = [];

  if (isRuntimeSelfHealingAutoCursorEnabled() && createdTaskIds.length > 0) {
    const { enqueueExecution } = await import("@/lib/service/executionQueue");

    for (const healingTaskId of createdTaskIds) {
      let healingRunId: string;
      try {
        const healingRun = await createSelfHealingExecutionRun({
          projectId: input.projectId,
          healingTaskId,
          actorUserId: input.actorUserId,
          sourceExecRunId: input.execRunId,
          sourceTaskId: input.taskId,
        });
        healingRunId = healingRun.execRunId;
        healingExecRunIds.push(healingRunId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await appendRuntimeEvent({
          eventType: "SELF_HEALING_CURSOR_ENQUEUE_FAILED",
          severity: "error",
          projectId: input.projectId,
          taskId: input.taskId,
          execRunId: input.execRunId,
          actorUserId: input.actorUserId,
          workerName: "self-healing",
          detail: { healingTaskId, error: msg },
        });
        continue;
      }

      const enq = await enqueueExecution({
        projectId: input.projectId,
        type: "cursor",
        payload: {
          execRunId: healingRunId,
          taskId: healingTaskId,
          projectId: input.projectId,
          actorUserId: input.actorUserId,
          singleTaskId: healingTaskId,
          selfHealingFromExecRunId: input.execRunId,
          syncDispatch: false,
          chainSource: "self-healing",
        },
      });

      if (enq.queued) {
        autoCursorEnqueued = true;
        await appendRuntimeEvent({
          eventType: "SELF_HEALING_CURSOR_ENQUEUED",
          projectId: input.projectId,
          taskId: healingTaskId,
          execRunId: healingRunId,
          actorUserId: input.actorUserId,
          workerName: "self-healing",
          detail: {
            cursorJobId: enq.jobId,
            selfHealingFromExecRunId: input.execRunId,
            sourceTaskId: input.taskId,
          },
        });
      } else {
        await appendRuntimeEvent({
          eventType: "SELF_HEALING_CURSOR_ENQUEUE_FAILED",
          severity: "warning",
          projectId: input.projectId,
          taskId: healingTaskId,
          execRunId: healingRunId,
          actorUserId: input.actorUserId,
          workerName: "self-healing",
          detail: { reason: enq.reason, healingTaskId },
        });
      }
    }
  }

  return { triggered: true, createdTaskIds, autoCursorEnqueued, healingExecRunIds };
}
