import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  normalizeCodeTaskGithubOutcomeFromRun,
  runHasTerminalGithubOutcome,
  runHasVerifiedGithubOutcome,
} from "@/lib/prototype/codeTaskGithubOutcome";
import {
  isInFlightCodeTaskExecutionRunStatus,
  isQueuedCodeTaskExecutionRunStatus,
} from "@/lib/prototype/codeTaskExecutionRunStatus";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { resolveCodeTaskSpecificRole, type CodeTaskRoleKind } from "@/lib/prototype/codeTaskPromptRoleResolver";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export type CompletedCodeTaskIntegrationTarget = Readonly<{
  readonly codeTaskId: string;
  readonly taskId: string;
  readonly title: string;
  readonly status: string;
  readonly commitSha?: string | null;
  readonly workBranch?: string | null;
  readonly source:
    | "runtime_run"
    | "github_verified"
    | "quality_gate"
    | "task_cursor_execution";
}>;

export type ExcludedCodeTaskIntegrationTarget = Readonly<{
  readonly codeTaskId: string;
  readonly taskId: string;
  readonly title: string;
  readonly status: string;
  readonly reason:
    | "not_started"
    | "queued"
    | "prompt_ready"
    | "cursor_running"
    | "github_verifying"
    | "failed"
    | "blocked_by_dependency"
    | "cancelled"
    | "unknown";
}>;

const SCREEN_ROLE_KINDS = new Set<CodeTaskRoleKind>([
  "screen_input",
  "screen_result",
  "screen_admin",
]);

function readCommitSha(run: CodeTaskExecutionRunV1 | null | undefined): string | null {
  const outcome = run ? normalizeCodeTaskGithubOutcomeFromRun(run) : null;
  if (outcome?.status === "verified") {
    return outcome.commitSha.trim() || null;
  }
  const sha = String(run?.commitSha ?? run?.branchHeadCommitSha ?? "").trim();
  return sha || null;
}

function formatRunStatusLabel(run: CodeTaskExecutionRunV1 | null): string {
  if (!run) return "대기";
  switch (run.status) {
    case "queued":
    case "prompt_building":
      return "대기";
    case "prompt_ready":
      return "프롬프트 준비";
    case "cursor_requested":
    case "cursor_running":
      return "Cursor 실행 중";
    case "github_verifying":
      return "GitHub 확인 중";
    case "completed":
      return "완료";
    case "no_code_change_completed":
      return "변경 없음";
    case "blocked_by_dependency":
      return "선행 대기";
    case "failed":
    case "rework_required":
      return "실패";
    case "status_check_stopped":
      return "중단";
    case "skipped_by_user":
      return "건너뜀";
    default:
      return run.status;
  }
}

function mapRunToExcludedReason(
  run: CodeTaskExecutionRunV1 | null,
): ExcludedCodeTaskIntegrationTarget["reason"] {
  if (!run) return "not_started";
  const outcome = normalizeCodeTaskGithubOutcomeFromRun(run);
  if (outcome?.status === "failed") return "failed";
  if (outcome?.status === "pending") return "github_verifying";
  if (run.status === "blocked_by_dependency") return "blocked_by_dependency";
  if (run.status === "failed" || run.status === "rework_required") return "failed";
  if (run.status === "skipped_by_user") return "cancelled";
  if (run.status === "prompt_ready" || run.status === "prompt_building") return "prompt_ready";
  if (run.status === "cursor_requested" || run.status === "cursor_running" || run.status === "status_check_stopped") {
    return "cursor_running";
  }
  if (run.status === "github_verifying") return "github_verifying";
  if (isQueuedCodeTaskExecutionRunStatus(run.status)) return "queued";
  return "unknown";
}

function resolveIntegratableFromRun(input: {
  readonly run: CodeTaskExecutionRunV1 | null;
  readonly autoGate: ImplementationAutoQualityGateV1 | null | undefined;
}): CompletedCodeTaskIntegrationTarget | null {
  const run = input.run;
  if (!run) return null;

  const githubOutcome = normalizeCodeTaskGithubOutcomeFromRun(run);
  if (githubOutcome?.status === "failed" || githubOutcome?.status === "pending") {
    return null;
  }

  const commitSha = readCommitSha(run);
  if (!commitSha) return null;

  const autoGate = input.autoGate;
  const autoGatePassed =
    autoGate?.status === "passed" &&
    autoGate.taskId === run.processTaskId &&
    Boolean(autoGate.sourceCommitSha.trim()) &&
    autoGate.sourceCommitSha.trim() === commitSha;

  if (autoGatePassed) {
    return {
      codeTaskId: run.codeTaskId,
      taskId: run.processTaskId,
      title: "",
      status: "passed",
      commitSha,
      workBranch: run.workBranch ?? null,
      source: "quality_gate",
    };
  }

  if (runHasVerifiedGithubOutcome(run)) {
    if (run.status === "completed" || run.status === "no_code_change_completed") {
      return {
        codeTaskId: run.codeTaskId,
        taskId: run.processTaskId,
        title: "",
        status: run.status,
        commitSha,
        workBranch: run.workBranch ?? null,
        source: "runtime_run",
      };
    }
    return null;
  }

  if (
    commitSha &&
    (run.status === "github_verifying" ||
      run.status === "cursor_running" ||
      run.status === "cursor_requested")
  ) {
    return null;
  }

  if (run.status === "completed" || run.status === "no_code_change_completed") {
    return {
      codeTaskId: run.codeTaskId,
      taskId: run.processTaskId,
      title: "",
      status: run.status,
      commitSha,
      workBranch: run.workBranch ?? null,
      source: "runtime_run",
    };
  }

  if (isInFlightCodeTaskExecutionRunStatus(run.status)) {
    return null;
  }

  return null;
}

function resolveIntegratableFromCursorHistory(input: {
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly runs: readonly CodeTaskExecutionRunV1[];
  readonly taskCursorExecutions: readonly TaskCursorExecutionV1[];
}): CompletedCodeTaskIntegrationTarget | null {
  const run = findLatestRunForCodeTask(input.runs, input.codeTaskId);
  if (run && runHasTerminalGithubOutcome(run)) {
    return null;
  }
  const commitSha = readCommitSha(run);
  if (!commitSha) return null;

  const verified = input.taskCursorExecutions.find(
    (execution) =>
      execution.taskId === input.parentTaskId &&
      (execution.status === "github_verified" ||
        execution.status === "review_pending" ||
        execution.status === "security_pending" ||
        execution.status === "scm_pending") &&
      String(execution.commitSha ?? "").trim() === commitSha,
  );
  if (!verified) return null;

  return {
    codeTaskId: input.codeTaskId,
    taskId: input.parentTaskId,
    title: "",
    status: verified.status,
    commitSha,
    workBranch: verified.workBranch ?? run?.workBranch ?? null,
    source: "github_verified",
  };
}

export function selectCompletedCodeTasksForIntegration(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly taskCursorExecutions?: readonly TaskCursorExecutionV1[] | null;
  readonly autoQualityGate?: ImplementationAutoQualityGateV1 | null;
}): Readonly<{
  readonly included: readonly CompletedCodeTaskIntegrationTarget[];
  readonly excluded: readonly ExcludedCodeTaskIntegrationTarget[];
  readonly hasAppShell: boolean;
  readonly hasAnyScreenTask: boolean;
  readonly canIntegrate: boolean;
  readonly warnings: readonly string[];
}> {
  const plan = input.codeTaskPlan;
  const tasks = plan?.tasks ?? [];
  const runs = input.codeTaskRuns ?? [];
  const cursorExecutions = [
    ...(input.taskCursorExecutions ?? []),
  ];
  const autoGate = input.autoQualityGate ?? null;

  const taskTitleById = new Map(
    (input.taskList?.tasks ?? []).map((task) => [task.taskId, task.title] as const),
  );

  const included: CompletedCodeTaskIntegrationTarget[] = [];
  const excluded: ExcludedCodeTaskIntegrationTarget[] = [];
  let hasAppShell = false;
  let hasAnyScreenTask = false;

  for (const codeTask of tasks) {
    const parentTaskId = codeTask.parentTaskId;
    const title = codeTask.title.trim();
    const latestRun = findLatestRunForCodeTask(runs, codeTask.codeTaskId);
    const role = resolveCodeTaskSpecificRole({
      codeTaskTitle: title,
      codeTaskDescription: codeTask.description,
      parentTaskTitle: taskTitleById.get(parentTaskId),
      changeType: codeTask.changeType,
    });

    const fromRun = resolveIntegratableFromRun({ run: latestRun, autoGate });
    const fromCursor =
      fromRun == null
        ? resolveIntegratableFromCursorHistory({
            codeTaskId: codeTask.codeTaskId,
            parentTaskId,
            runs,
            taskCursorExecutions: cursorExecutions,
          })
        : null;
    const target = fromRun ?? fromCursor;

    if (target) {
      const merged: CompletedCodeTaskIntegrationTarget = {
        ...target,
        title,
        taskId: parentTaskId,
      };
      included.push(merged);
      if (role.roleKind === "app_shell") hasAppShell = true;
      if (SCREEN_ROLE_KINDS.has(role.roleKind)) hasAnyScreenTask = true;
      continue;
    }

    excluded.push({
      codeTaskId: codeTask.codeTaskId,
      taskId: parentTaskId,
      title,
      status: formatRunStatusLabel(latestRun),
      reason: mapRunToExcludedReason(latestRun),
    });
  }

  const warnings: string[] = [];
  if (included.length > 0 && !hasAppShell) {
    warnings.push("화면 프레임/앱 Shell이 완료되지 않아 Preview 품질이 제한될 수 있습니다.");
  }
  if (included.length > 0 && !hasAnyScreenTask) {
    warnings.push("완료된 화면 CodeTask가 없어 Preview에서 확인 가능한 화면이 제한됩니다.");
  }

  return {
    included,
    excluded,
    hasAppShell,
    hasAnyScreenTask,
    canIntegrate: included.length > 0,
    warnings,
  };
}
