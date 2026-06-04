import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cancelActiveTaskCursorJobsForProject } from "@/lib/prototype/taskCursorExecutionJobRepository";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import { IMPLEMENTATION_SESSION_RESET_NULL_PATCH } from "@/lib/requirements/resetDerivedImplementationState";

export type PlanningResetCascadeReason =
  | "planning_reset"
  | "planning_regenerated"
  | "manual";

export const PLANNING_RESET_CLEARED_REQUIREMENTS_STATE_KEYS = Object.keys(
  IMPLEMENTATION_SESSION_RESET_NULL_PATCH,
) as readonly string[];

export type PlanningResetCascadeResult = Readonly<{
  readonly resetRuntimeJobs: number;
  readonly resetCodeTaskRuns: number;
  readonly resetTaskCursorJobs: number;
  readonly resetRuntimeEvents: number;
  readonly cancelledActiveTaskCursorJobs: number;
  readonly resetStateKeys: readonly string[];
  readonly githubResourcesDeleted: false;
}>;

async function deleteDownstreamRuntimeForProject(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<{
  resetRuntimeJobs: number;
  resetCodeTaskRuns: number;
  resetTaskCursorJobs: number;
  resetRuntimeEvents: number;
}> {
  const runs = await tx.implementationCodeTaskRun.deleteMany({
    where: { projectId },
  });
  const events = await tx.implementationRuntimeEvent.deleteMany({
    where: { projectId },
  });
  const jobs = await tx.implementationExecutionJob.deleteMany({
    where: { projectId },
  });
  const taskCursorJobs = await tx.taskCursorExecutionJob.deleteMany({
    where: { projectId },
  });
  return {
    resetRuntimeJobs: jobs.count,
    resetCodeTaskRuns: runs.count,
    resetRuntimeEvents: events.count,
    resetTaskCursorJobs: taskCursorJobs.count,
  };
}

/**
 * 기획 초기화 시 구현/Runtime/Task Worker DB·상태를 폐기한다.
 * GitHub 원격 branch/commit은 삭제하지 않는다.
 */
export async function resetProjectDownstreamFromPlanning(input: {
  readonly projectId: string;
  readonly reason: PlanningResetCascadeReason;
  readonly now?: Date;
}): Promise<PlanningResetCascadeResult> {
  const projectId = input.projectId.trim();
  if (!projectId) {
    throw new Error("projectId is required");
  }

  const cancelledActiveTaskCursorJobs = await cancelActiveTaskCursorJobsForProject({
    projectId,
    failureReason: "cancelled_by_planning_reset",
    errorMessage: "기획 초기화로 Task Cursor 실행 job을 종료했습니다.",
    now: input.now,
  });

  const deleted = await prisma.$transaction(async (tx) => {
    const counts = await deleteDownstreamRuntimeForProject(tx, projectId);
    await tx.implementationRuntimeEvent.create({
      data: {
        projectId,
        jobId: null,
        runId: null,
        eventType: "planning_reset_cascade",
        payloadJson: {
          reason: input.reason,
          cancelledActiveTaskCursorJobs,
          ...counts,
          githubBranchCommitAutoDelete: false,
        } as Prisma.InputJsonValue,
      },
    });
    return counts;
  });

  const bundle = await getImplementationRuntimeBundle(projectId);
  if (bundle.job || bundle.runs.length > 0 || bundle.currentRun) {
    throw new Error("Planning reset cascade incomplete: implementation runtime still present");
  }

  return {
    ...deleted,
    cancelledActiveTaskCursorJobs,
    resetStateKeys: PLANNING_RESET_CLEARED_REQUIREMENTS_STATE_KEYS,
    githubResourcesDeleted: false,
  };
}
