import { parseTaskCursorJobExecution } from "@/lib/prototype/taskCursorExecutionJobRepository";
import { prisma } from "@/lib/prisma";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import {
  markImplementationRuntimeCodeTaskQueueItemCursorRequested,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueService";
import { markImplementationRuntimeCursorRunning } from "@/lib/runtime/implementationRuntime/implementationRuntimeCursorService";
import {
  findImplementationRunByTaskCursorJobId,
  scheduleImplementationRuntimePoll,
} from "@/lib/runtime/implementationRuntime/implementationRuntimePollRepository";

export type TaskCursorRuntimeReconcileResult = Readonly<{
  readonly reconciledCount: number;
  readonly projectIds: readonly string[];
}>;

/**
 * task_cursor_execution_jobs는 cursor_running인데 DB Run/Queue가 queued인 desync를 poll 가능 상태로 보정한다.
 * completed/advance는 하지 않는다.
 */
export async function reconcileTaskCursorRuntimePollTargets(input?: {
  readonly now?: Date;
  readonly limit?: number;
}): Promise<TaskCursorRuntimeReconcileResult> {
  const now = input?.now ?? new Date();
  const limit = Math.max(1, input?.limit ?? 10);

  const jobs = await prisma.taskCursorExecutionJob.findMany({
    where: {
      completedAt: null,
      status: "cursor_running",
      cursorRunId: { not: null },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });

  const projectIds: string[] = [];
  let reconciledCount = 0;

  for (const job of jobs) {
    const agentId = String(job.cursorRunId ?? "").trim();
    if (!agentId) continue;

    const linkedRun = await findImplementationRunByTaskCursorJobId(job.id);
    const execution = parseTaskCursorJobExecution(job);
    const bundle = await getImplementationRuntimeBundle(job.projectId);
    const run =
      linkedRun ??
      bundle.runs.find((r) => r.codeTaskId === bundle.job?.currentCodeTaskId) ??
      null;
    if (!run || !bundle.job) continue;

    const queueItem = await prisma.implementationRuntimeCodeTaskQueueItem.findFirst({
      where: { jobId: bundle.job.id, codeTaskId: run.codeTaskId },
    });

    const runNeedsFix = run.runtimeState === "queued" || !run.cursorAgentId;
    const queueNeedsFix = queueItem?.status === "queued";
    if (!runNeedsFix && !queueNeedsFix) continue;

    if (runNeedsFix) {
      await markImplementationRuntimeCursorRunning({
        projectId: job.projectId,
        jobId: bundle.job.id,
        runId: run.id,
        cursorAgentId: agentId,
        branchName: execution?.workBranch ?? job.workBranch ?? run.branchName,
        now,
      });
    }

    if (queueNeedsFix && queueItem) {
      await markImplementationRuntimeCodeTaskQueueItemCursorRequested({
        jobId: bundle.job.id,
        codeTaskId: run.codeTaskId,
        cursorRequestId: agentId,
        cursorRunId: agentId,
        targetRepository: job.targetRepository ?? execution?.targetRepository ?? null,
        baseBranch: job.baseBranch ?? execution?.baseBranch ?? null,
        workBranch: execution?.workBranch ?? job.workBranch ?? null,
        now,
      });
    }

    await scheduleImplementationRuntimePoll({ runId: run.id, now });
    reconciledCount += 1;
    projectIds.push(job.projectId);
  }

  return { reconciledCount, projectIds };
}
