import { findLatestRunForCodeTask, parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { ensureCodeTaskPlanWithFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { executionUnitIdForCodeTask } from "@/lib/prototype/implementationExecutionUnit";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { mergeCodeTaskRunsWithDbRuntime } from "@/lib/prototype/implementationQuickRunStuckGithubRecovery";
import {
  resolveCanonicalCodeTaskRunTarget,
} from "@/lib/prototype/codeTaskRunTargetCanonical";
import {
  resolveCodeTaskBaseBranchForTask,
  resolveCodeTaskWorkBranchForTask,
} from "@/lib/prototype/taskCursorExecution";
import {
  resolveProjectTargetRepositoryFromExecutionSetup,
  type ProjectTargetRepository,
} from "@/lib/prototype/projectTargetRepository";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationExecutionUnitsStateV1 } from "@/lib/prototype/implementationExecutionUnitStore";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import {
  isSampleDataCodeTaskRef,
  SAMPLE_DATA_WORK_BRANCH,
} from "@/lib/prototype/sampleDataCodeTaskPlanner";

export type CodeTaskManualGithubRecheckPayloadV1 = Readonly<{
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly taskId: string;
  readonly workBranch: string;
  readonly baseBranch: string;
  readonly repositoryOwner: string;
  readonly repositoryName: string;
  readonly repositoryFullName: string;
  readonly targetRepository: string;
  readonly githubCommitSha?: string | null;
  readonly githubOutcomeSaved?: boolean;
}>;

export type ResolveManualGithubRecheckPayloadInput = Readonly<{
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly requirementsState?: RequirementsStateJson | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly executionSetup?: Readonly<{
    readonly gitRepoUrl?: string | null;
    readonly gitRepoName?: string | null;
    readonly gitRepoProvider?: string | null;
    readonly baseBranch?: string | null;
  }> | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly executionUnits?: readonly ImplementationExecutionUnitV1[] | null;
  readonly hints?: Partial<
    Pick<
      CodeTaskManualGithubRecheckPayloadV1,
      "taskId" | "workBranch" | "baseBranch" | "githubCommitSha" | "githubOutcomeSaved"
    >
  > | null;
}>;

export type ResolveManualGithubRecheckPayloadResult = Readonly<{
  readonly payload: CodeTaskManualGithubRecheckPayloadV1 | null;
  readonly missing: readonly string[];
  readonly planTask: ImplementationCodeTaskV1 | null;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
}>;

function findWorkItemForCodeTask(
  workItems: readonly CursorWorkItem[] | undefined,
  codeTaskId: string,
): CursorWorkItem | null {
  if (!workItems?.length) return null;
  const id = codeTaskId.trim();
  return (
    workItems.find((wi) => wi.codeTaskId?.trim() === id || wi.taskId?.trim() === id) ?? null
  );
}

function findExecutionUnitForCodeTask(
  units: readonly ImplementationExecutionUnitV1[] | undefined,
  codeTaskId: string,
): ImplementationExecutionUnitV1 | null {
  if (!units?.length) return null;
  const id = codeTaskId.trim();
  return (
    units.find(
      (u) =>
        u.codeTaskId.trim() === id || executionUnitIdForCodeTask(u.codeTaskId) === id,
    ) ?? null
  );
}

function resolveRepository(
  executionSetup: ResolveManualGithubRecheckPayloadInput["executionSetup"],
): ProjectTargetRepository | null {
  if (!executionSetup) return null;
  return resolveProjectTargetRepositoryFromExecutionSetup({
    gitRepoUrl: executionSetup.gitRepoUrl,
    gitRepoName: executionSetup.gitRepoName,
    gitRepoProvider: executionSetup.gitRepoProvider,
    baseBranch: executionSetup.baseBranch,
  });
}

/** 수동 GitHub 재확인 — plan·DB·ExecutionUnit·WorkItem·setup에서 payload를 조합한다. */
export function resolveManualGithubRecheckPayload(
  input: ResolveManualGithubRecheckPayloadInput,
): ResolveManualGithubRecheckPayloadResult {
  const projectId = input.projectId.trim();
  const codeTaskId = input.codeTaskId.trim();
  const missing: string[] = [];
  if (!projectId) missing.push("projectId");
  if (!codeTaskId) missing.push("codeTaskId");

  const rawPlan = parseImplementationCodeTaskPlanV1(
    input.requirementsState?.implementationCodeTaskPlanV1,
  );
  const codeTaskPlan =
    ensureCodeTaskPlanWithFileBoundaries({
      plan: rawPlan,
      taskList: input.taskList ?? null,
    }) ?? rawPlan;

  let planTask = codeTaskPlan?.tasks.find((t) => t.codeTaskId.trim() === codeTaskId) ?? null;
  if (!planTask) missing.push("codeTaskPlanTask");

  const unitsFromState =
    input.executionUnits ??
    parseImplementationExecutionUnitsStateV1(input.requirementsState?.implementationExecutionUnitsV1)
      ?.units ??
    [];
  const executionUnit = findExecutionUnitForCodeTask(unitsFromState, codeTaskId);
  const workItem = findWorkItemForCodeTask(
    input.cursorWorkItems ?? input.requirementsState?.cursorWorkItemsV1 ?? undefined,
    codeTaskId,
  );

  const jsonRuns = parseCodeTaskExecutionRunsV1(input.requirementsState?.codeTaskExecutionRunsV1) ?? [];
  const mergedRuns = mergeCodeTaskRunsWithDbRuntime({
    jsonRuns,
    dbBundle: input.dbBundle,
    codeTaskPlan,
  });
  const run = findLatestRunForCodeTask(mergedRuns, codeTaskId);
  const dbRun = input.dbBundle?.runs.find((r) => r.codeTaskId.trim() === codeTaskId);

  const branchPlan = planTask ? parseCodeTaskBranchPlanV1(planTask.branchPlan) : null;
  const canonical = planTask ? resolveCanonicalCodeTaskRunTarget({ codeTask: planTask }) : null;

  const workBranch =
    String(input.hints?.workBranch ?? "").trim() ||
    String(executionUnit?.workBranch ?? "").trim() ||
    String(dbRun?.branchName ?? run?.workBranch ?? "").trim() ||
    String(branchPlan?.workBranch ?? "").trim() ||
    (planTask
      ? resolveCodeTaskWorkBranchForTask({
          codeTask: planTask,
          existingWorkBranch: run?.workBranch ?? dbRun?.branchName,
        })
      : "") ||
    (planTask && isSampleDataCodeTaskRef(planTask) ? SAMPLE_DATA_WORK_BRANCH : "");

  const baseBranch =
    String(input.hints?.baseBranch ?? "").trim() ||
    String(executionUnit?.baseBranch ?? "").trim() ||
    String(run?.baseBranch ?? "").trim() ||
    String(branchPlan?.baseBranch ?? "").trim() ||
    (planTask
      ? resolveCodeTaskBaseBranchForTask({
          codeTask: planTask,
          fallbackBaseBranch: run?.baseBranch,
        })
      : "") ||
    String(input.executionSetup?.baseBranch ?? "main").trim() ||
    "main";

  const taskId =
    String(input.hints?.taskId ?? "").trim() ||
    planTask?.parentTaskId?.trim() ||
    workItem?.parentTaskId?.trim() ||
    workItem?.taskId?.trim() ||
    canonical?.parentTaskId?.trim() ||
    "";

  const repo = resolveRepository(input.executionSetup);
  const repositoryOwner = repo?.owner?.trim() ?? "";
  const repositoryName = repo?.repo?.trim() ?? "";
  if (!workBranch) missing.push("workBranch");
  if (!repositoryOwner) missing.push("repositoryOwner");
  if (!repositoryName) missing.push("repositoryName");

  const githubCommitSha =
    input.hints?.githubCommitSha ??
    executionUnit?.commitSha ??
    executionUnit?.afterHeadSha ??
    run?.commitSha ??
    dbRun?.commitSha ??
    null;
  const githubOutcomeSaved =
    input.hints?.githubOutcomeSaved ??
    (executionUnit?.status === "verified" || executionUnit?.status === "skipped");

  if (missing.length) {
    return { payload: null, missing, planTask, codeTaskPlan };
  }

  const repositoryFullName = `${repositoryOwner}/${repositoryName}`;
  const payload: CodeTaskManualGithubRecheckPayloadV1 = {
    projectId,
    codeTaskId,
    taskId,
    workBranch,
    baseBranch,
    repositoryOwner,
    repositoryName,
    repositoryFullName,
    targetRepository: repositoryFullName,
    githubCommitSha,
    githubOutcomeSaved,
  };
  return { payload, missing: [], planTask, codeTaskPlan };
}
