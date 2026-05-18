import type { TaskExecutionRun } from "@prisma/client";

import {
  buildTeamRuntimeAdditiveFields,
  loadRequireApprovalBeforeApply,
  type TeamRuntimeTaskContext,
} from "./apiTeamRuntime";
import { loadTeamRuntimeTaskContextMap } from "./teamRuntimeTaskContext";

export function toTaskExecutionRunListItem(
  run: TaskExecutionRun,
  requireApproval: boolean,
  taskContext: TeamRuntimeTaskContext
) {
  return {
    id: run.id,
    projectId: run.projectId,
    workflowId: run.workflowId,
    taskId: run.taskId,
    provider: run.provider ?? "cursor",
    repoUrlSnapshot: run.repoUrlSnapshot,
    status: run.status,
    ...buildTeamRuntimeAdditiveFields(run, requireApproval, taskContext),
    branchName: run.branchName,
    cursorRunId: run.cursorRunId,
    cursorSummary: run.cursorSummary,
    changedFiles: Array.isArray(run.changedFiles) ? run.changedFiles : [],
    gitSummary: run.gitSummary,
    evaluationReason: run.evaluationReason,
    evaluationDecision: run.evaluationDecision,
    evaluationReviewerSteps: Array.isArray(run.evaluationReviewerSteps)
      ? run.evaluationReviewerSteps
      : [],
    validationOutput: run.validationOutput,
    runError: run.runError,
    commitStatus: run.commitStatus,
    pushStatus: run.pushStatus,
    commitSha: run.commitSha,
    prStatus: run.prStatus,
    retryCount: run.retryCount,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    archivedAt: run.archivedAt ? run.archivedAt.toISOString() : null,
  };
}

export async function mapTaskExecutionRunsToListItems(
  projectId: string,
  runs: readonly TaskExecutionRun[]
) {
  const [requireApproval, taskById] = await Promise.all([
    loadRequireApprovalBeforeApply(projectId),
    loadTeamRuntimeTaskContextMap(
      projectId,
      runs.map((run) => run.taskId)
    ),
  ]);

  return runs.map((run) =>
    toTaskExecutionRunListItem(run, requireApproval, taskById.get(run.taskId) ?? null)
  );
}
