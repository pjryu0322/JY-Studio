import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { normalizeCodeTaskGithubOutcomeFromRun } from "@/lib/prototype/codeTaskGithubOutcome";
import { normalizeCodeTaskQualityOutcomeFromRun } from "@/lib/prototype/codeTaskQualityOutcome";
import {
  isCodeTaskRunMergeIncluded,
  readCodeTaskRunCommitSha,
} from "@/lib/prototype/codeTaskRunPreviewPolicy";
import {
  isInFlightCodeTaskExecutionRunStatus,
  isQueuedCodeTaskExecutionRunStatus,
} from "@/lib/prototype/codeTaskExecutionRunStatus";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { resolveCodeTaskSpecificRole, type CodeTaskRoleKind } from "@/lib/prototype/codeTaskPromptRoleResolver";
import { isSampleDataCodeTaskRef } from "@/lib/prototype/sampleDataCodeTaskPlanner";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

export type CompletedCodeTaskIntegrationTarget = Readonly<{
  readonly codeTaskId: string;
  readonly taskId: string;
  readonly title: string;
  readonly status: string;
  readonly commitSha?: string | null;
  readonly workBranch?: string | null;
  readonly source: "runtime_run" | "quality_gate";
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
    | "quality_not_passed"
    | "missing_branch"
    | "missing_commit"
    | "unknown";
}>;

const SCREEN_ROLE_KINDS = new Set<CodeTaskRoleKind>([
  "screen_input",
  "screen_result",
  "screen_admin",
]);

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
    case "github_verified":
      return "GitHub commit 확인 완료";
    case "quality_gate_running":
      return "경량 자동검사 진행 중";
    case "quality_gate_passed":
      return "경량 자동검사 완료";
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
  if (run?.status === "github_verified") return "github_verifying";
  if (run.status === "blocked_by_dependency") return "blocked_by_dependency";
  if (run.status === "failed" || run.status === "rework_required") return "failed";
  if (run.status === "skipped_by_user") return "cancelled";
  if (run.status === "prompt_ready" || run.status === "prompt_building") return "prompt_ready";
  if (run.status === "cursor_requested" || run.status === "cursor_running" || run.status === "status_check_stopped") {
    return "cursor_running";
  }
  if (run.status === "github_verifying") return "github_verifying";
  if (isQueuedCodeTaskExecutionRunStatus(run.status)) return "queued";
  const quality = normalizeCodeTaskQualityOutcomeFromRun(run);
  if (quality?.status === "failed") return "quality_not_passed";
  if (!String(run.workBranch ?? "").trim()) return "missing_branch";
  if (!readCodeTaskRunCommitSha(run) && run.status !== "no_code_change_completed") {
    return "missing_commit";
  }
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

  const commitSha = readCodeTaskRunCommitSha(run);
  if (!commitSha && run.status !== "no_code_change_completed") return null;

  if (isCodeTaskRunMergeIncluded(run)) {
    return {
      codeTaskId: run.codeTaskId,
      taskId: run.processTaskId,
      title: "",
      status: run.status,
      commitSha: commitSha ?? null,
      workBranch: run.workBranch ?? null,
      source: run.qualityOutcome ? "quality_gate" : "runtime_run",
    };
  }

  const autoGate = input.autoGate;
  const legacyGatePassed =
    autoGate?.status === "passed" &&
    autoGate.taskId === run.processTaskId &&
    autoGate.sourceCommitSha.trim() === commitSha &&
    (run.status === "completed" || run.status === "no_code_change_completed");

  if (legacyGatePassed && normalizeCodeTaskQualityOutcomeFromRun(run)?.status !== "passed") {
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

  if (isInFlightCodeTaskExecutionRunStatus(run.status)) {
    return null;
  }

  return null;
}

export function selectCompletedCodeTasksForIntegration(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly taskList: ImplementationTaskListV1 | null;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
  /** @deprecated P3-M41: integration 판정은 run SoT만 사용 */
  readonly taskCursorExecutions?: readonly import("@/lib/prototype/taskCursorExecution").TaskCursorExecutionV1[] | null;
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
  const autoGate = input.autoQualityGate ?? null;

  const taskTitleById = new Map(
    (input.taskList?.tasks ?? []).map((task) => [task.taskId, task.title] as const),
  );

  const included: CompletedCodeTaskIntegrationTarget[] = [];
  const excluded: ExcludedCodeTaskIntegrationTarget[] = [];
  let hasAppShell = false;
  let hasAnyScreenTask = false;
  let hasSampleDataTask = false;

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

    const target = resolveIntegratableFromRun({ run: latestRun, autoGate });

    if (target) {
      included.push({
        ...target,
        title,
        taskId: parentTaskId,
      });
      if (role.roleKind === "app_shell") hasAppShell = true;
      if (SCREEN_ROLE_KINDS.has(role.roleKind)) hasAnyScreenTask = true;
      if (
        isSampleDataCodeTaskRef({
          codeTaskId: codeTask.codeTaskId,
          parentTaskId: codeTask.parentTaskId,
          title: codeTask.title,
          changeType: codeTask.changeType,
        }) ||
        role.roleKind === "mock_data"
      ) {
        hasSampleDataTask = true;
      }
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
  if (included.length > 0 && hasAnyScreenTask && !hasSampleDataTask) {
    warnings.push("샘플데이터 CodeTask가 통합 대상에 없어 actual Preview 품질이 제한됩니다.");
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
