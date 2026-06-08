import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { findLatestRunForCodeTask } from "@/lib/prototype/codeTaskExecutionRun";
import { isInFlightCodeTaskExecutionRunStatus } from "@/lib/prototype/codeTaskExecutionRunStatus";
import {
  runHasVerifiedGithubOutcome,
  type CodeTaskGithubOutcomeV1,
} from "@/lib/prototype/codeTaskGithubOutcome";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { ensureCodeTaskPlanWithFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { isMockCodeTaskId } from "@/lib/prototype/codeTaskCanonicalId";
import { isIntegrationWiringCodeTask } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import {
  executionUnitIdForCodeTask,
  type ImplementationExecutionUnitBranchGroupV1,
  type ImplementationExecutionUnitStatusV1,
  type ImplementationExecutionUnitV1,
} from "@/lib/prototype/implementationExecutionUnit";
import { sortCodeTaskIdsByImplementationPlanOrder } from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";

export type BuildExecutionUnitsAuditV1 = Readonly<{
  readonly unitCount: number;
  readonly codeTaskCount: number;
  readonly workItemCount: number;
  readonly excludedPseudoCount: number;
}>;

function branchGroupFromTask(task: ImplementationCodeTaskV1): ImplementationExecutionUnitBranchGroupV1 {
  const bp = parseCodeTaskBranchPlanV1(task.branchPlan);
  const g = String(bp?.branchGroup ?? "data").trim();
  if (
    g === "foundation" ||
    g === "data" ||
    g === "common" ||
    g === "feature" ||
    g === "screen" ||
    g === "integration"
  ) {
    return g;
  }
  return "data";
}

function shouldIncludeCodeTaskInExecutionUnits(task: ImplementationCodeTaskV1): boolean {
  const id = task.codeTaskId.trim();
  if (!id || isMockCodeTaskId(id)) return false;
  const bp = parseCodeTaskBranchPlanV1(task.branchPlan);
  if (bp?.executionMode === "integration_only" && isIntegrationWiringCodeTask(task)) {
    return false;
  }
  if (bp?.executionMode === "integration_only" && task.changeType === "integration") {
    return false;
  }
  return true;
}

function deriveExecutionUnitStatusFromRun(
  run: CodeTaskExecutionRunV1 | null | undefined,
): Pick<
  ImplementationExecutionUnitV1,
  "status" | "retryable" | "runId" | "startedAt" | "verifyingAt" | "verifiedAt" | "failedAt" | "beforeHeadSha" | "afterHeadSha" | "commitSha" | "errorCode" | "errorMessage"
> {
  if (!run) {
    return { status: "ready", runId: null };
  }
  const github = run.githubOutcome as CodeTaskGithubOutcomeV1 | null | undefined;
  const beforeHeadSha =
    github && github.status === "verified"
      ? github.baseHeadSha ?? run.baseCommitSha ?? null
      : run.baseCommitSha ?? null;
  const afterHeadSha =
    github && github.status === "verified"
      ? github.headSha ?? github.commitSha ?? run.branchHeadCommitSha ?? run.commitSha ?? null
      : run.branchHeadCommitSha ?? run.commitSha ?? null;
  const commitSha =
    github && github.status === "verified"
      ? github.commitSha ?? afterHeadSha
      : run.commitSha ?? afterHeadSha;

  if (run.status === "skipped_by_user") {
    return {
      status: "skipped",
      runId: run.runId,
      startedAt: run.startedAt ?? null,
      verifiedAt: run.completedAt ?? run.updatedAt,
      beforeHeadSha,
      afterHeadSha,
      commitSha,
    };
  }

  if (github?.status === "failed") {
    return {
      status: "failed",
      retryable: github.retryable !== false,
      runId: run.runId,
      failedAt: github.checkedAt ?? run.updatedAt,
      errorCode: github.reason ?? "github_verify_failed",
      errorMessage: github.message ?? run.errorMessage ?? null,
      beforeHeadSha,
      afterHeadSha,
      commitSha,
    };
  }

  if (runHasVerifiedGithubOutcome(run)) {
    return {
      status: "verified",
      runId: run.runId,
      startedAt: run.startedAt ?? null,
      verifiedAt: github?.status === "verified" ? github.checkedAt : run.completedAt ?? run.updatedAt,
      beforeHeadSha,
      afterHeadSha,
      commitSha,
    };
  }

  if (run.status === "github_verifying") {
    return {
      status: "verifying",
      runId: run.runId,
      verifyingAt: run.updatedAt,
      beforeHeadSha,
      afterHeadSha,
      commitSha,
    };
  }

  if (isInFlightCodeTaskExecutionRunStatus(run.status)) {
    return {
      status: "running",
      runId: run.runId,
      startedAt: run.startedAt ?? run.updatedAt,
      beforeHeadSha,
      afterHeadSha,
      commitSha,
    };
  }

  if (run.status === "failed" || run.status === "rework_required") {
    return {
      status: "failed",
      retryable: true,
      runId: run.runId,
      failedAt: run.completedAt ?? run.updatedAt,
      errorMessage: run.errorMessage ?? run.failureReason ?? null,
      beforeHeadSha,
      afterHeadSha,
      commitSha,
    };
  }

  if (run.status === "blocked_by_dependency") {
    return {
      status: "blocked",
      runId: run.runId,
      errorCode: "blocked_by_dependency",
      beforeHeadSha,
      afterHeadSha,
      commitSha,
    };
  }

  return {
    status: "ready",
    runId: run.runId,
    beforeHeadSha,
    afterHeadSha,
    commitSha,
  };
}

/** legacy_bootstrap_only — builds units from CodeTask plan; not runtime SoT after persist (P3-M69). */
export function buildExecutionUnitsFromLegacyState(input: {
  readonly projectId?: string | null;
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
  readonly workItemCount?: number;
}): Readonly<{
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly audit: BuildExecutionUnitsAuditV1;
}> {
  const plan =
    input.taskList != null
      ? ensureCodeTaskPlanWithFileBoundaries({
          plan: input.codeTaskPlan ?? null,
          taskList: input.taskList,
        }) ?? input.codeTaskPlan ?? null
      : input.codeTaskPlan ?? null;

  const executableIds: string[] = [];
  for (const t of plan?.tasks ?? []) {
    if (!shouldIncludeCodeTaskInExecutionUnits(t)) continue;
    const id = t.codeTaskId.trim();
    if (id) executableIds.push(id);
  }
  const visibleIds = sortCodeTaskIdsByImplementationPlanOrder(plan, executableIds);
  const orderedIds = visibleIds;
  const taskById = new Map<string, ImplementationCodeTaskV1>();
  for (const t of plan?.tasks ?? []) {
    const id = t.codeTaskId.trim();
    if (id) taskById.set(id, t);
  }

  let excludedPseudoCount = 0;
  for (const t of plan?.tasks ?? []) {
    if (!shouldIncludeCodeTaskInExecutionUnits(t)) excludedPseudoCount += 1;
  }

  const units: ImplementationExecutionUnitV1[] = [];
  orderedIds.forEach((codeTaskId, index) => {
    const task = taskById.get(codeTaskId);
    if (!task || !shouldIncludeCodeTaskInExecutionUnits(task)) return;
    const bp = parseCodeTaskBranchPlanV1(task.branchPlan);
    const run = findLatestRunForCodeTask(input.runs ?? [], codeTaskId);
    const derived = deriveExecutionUnitStatusFromRun(run);
    const deps = [
      ...(task.codeTaskDependencies ?? []),
      ...(task.dependencies ?? []),
    ]
      .map((d) => d.trim())
      .filter(Boolean);
    const uniqueDeps = [...new Set(deps)];

    units.push({
      unitId: executionUnitIdForCodeTask(codeTaskId),
      codeTaskId,
      processTaskId: String(task.parentTaskId ?? "").trim(),
      title: String(task.title ?? "").trim() || codeTaskId,
      order: index,
      branchGroup: branchGroupFromTask(task),
      baseBranch: String(bp?.baseBranch ?? plan?.implementationBranchPlanV1?.baseBranch ?? "main").trim(),
      workBranch: String(bp?.workBranch ?? "").trim(),
      dependencies: uniqueDeps,
      sourceCodeTaskId: codeTaskId,
      sourceWorkItemId: run?.workItemId ?? null,
      ...derived,
    });
  });

  return {
    units,
    audit: {
      unitCount: units.length,
      codeTaskCount: visibleIds.length,
      workItemCount: input.workItemCount ?? 0,
      excludedPseudoCount,
    },
  };
}
