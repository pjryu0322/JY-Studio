import type { ImplementationBoardStepStatus } from "@/lib/prototype/implementationExecutionBoard";
import type { CodeTaskReviewSecurityPolicyResult } from "@/lib/prototype/implementationReviewSecurityPolicy";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { classifyCodeTaskExecutionRunFromTaskCursor } from "@/lib/prototype/codeTaskExecutionRunResult";
import { buildTaskCursorWorkBranch } from "@/lib/prototype/taskCursorExecution";
import {
  isInFlightCodeTaskExecutionRunStatus,
  isQueuedCodeTaskExecutionRunStatus,
} from "@/lib/prototype/codeTaskExecutionRunStatus";
import type { RuntimeState } from "@/lib/prototype/implementationRuntimeState";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { resolveGithubVerifyStuckEscalation } from "@/lib/prototype/taskCursorGithubVerifyTimeoutPolicy";

export type CodeTaskExecutionFlowPhase =
  | "prompt_ready"
  | "prompt_preflight_failed"
  | "cursor_running"
  | "cursor_completed"
  | "github_verifying"
  | "github_verified"
  | "github_branch_missing"
  | "github_verify_timeout"
  | "dispatch_failed_retryable"
  | "lightweight_checking"
  | "completed"
  | "failed";

export type CodeTaskExecutionFlowStepState = "pending" | "active" | "done" | "failed" | "skipped";

export type CodeTaskExecutionFlowStepVm = Readonly<{
  readonly id: string;
  readonly label: string;
  readonly state: CodeTaskExecutionFlowStepState;
}>;

const FLOW_STEP_DEFS: readonly Readonly<{ readonly id: string; readonly label: string }>[] = [
  { id: "prompt_ready", label: "개발 프롬프트 생성" },
  { id: "cursor_running", label: "Cursor 실행" },
  { id: "github_verifying", label: "GitHub commit 확인" },
  { id: "lightweight_checking", label: "경량 자동검사" },
  { id: "completed", label: "완료" },
];

export function formatCodeTaskExecutionFlowPhaseKo(phase: CodeTaskExecutionFlowPhase): string {
  switch (phase) {
    case "prompt_ready":
      return "개발 프롬프트 준비";
    case "prompt_preflight_failed":
      return "프롬프트 품질 검사 실패";
    case "cursor_running":
      return "Cursor 실행 중";
    case "cursor_completed":
      return "Cursor 실행 완료";
    case "github_verifying":
      return "GitHub commit 확인 중";
    case "github_branch_missing":
      return "GitHub branch가 생성되지 않음";
    case "github_verify_timeout":
      return "GitHub commit 확인 시간 초과";
    case "dispatch_failed_retryable":
      return "CodeTask 실행 준비 실패";
    case "github_verified":
      return "GitHub 확인 완료";
    case "lightweight_checking":
      return "경량 자동검사 중";
    case "completed":
      return "완료";
    case "failed":
      return "재작업 필요";
    default:
      return "대기";
  }
}

export function formatCodeTaskExecutionProgressLine(phase: CodeTaskExecutionFlowPhase): string {
  switch (phase) {
    case "cursor_running":
      return "Cursor 실행 중";
    case "github_verifying":
      return "Cursor 실행 완료, commit 확인 중";
    case "github_verified":
    case "lightweight_checking":
      return "GitHub 확인 완료, 경량검사 진행";
    case "completed":
      return "실행 완료";
    case "failed":
      return "commit 확인 실패";
    case "prompt_preflight_failed":
      return "프롬프트 품질 검사 실패로 Cursor 실행 전 차단";
    case "prompt_ready":
      return "Cursor 실행 대기";
    default:
      return "진행 중";
  }
}

function mapCodeTaskRunStatusToFlowPhase(
  status: CodeTaskExecutionRunV1["status"],
): CodeTaskExecutionFlowPhase | null {
  switch (status) {
    case "completed":
    case "no_code_change_completed":
      return "completed";
    case "github_verifying":
      return "github_verifying";
    case "cursor_running":
    case "cursor_requested":
      return "cursor_running";
    case "prompt_building":
    case "prompt_ready":
    case "queued":
      return "prompt_ready";
    case "status_check_stopped":
      return "cursor_running";
    case "blocked_by_dependency":
      return "prompt_ready";
    case "failed":
    case "rework_required":
      return "failed";
    default:
      return null;
  }
}

function executionHasRecordedCommit(execution: TaskCursorExecutionV1): boolean {
  return Boolean(String(execution.commitSha ?? execution.branchHeadCommitSha ?? "").trim());
}

function runHasCursorOrGithubEvidence(run: CodeTaskExecutionRunV1): boolean {
  return Boolean(
    String(run.commitSha ?? run.branchHeadCommitSha ?? "").trim() ||
      String(run.cursorRunId ?? "").trim(),
  );
}

function firstRecordedCommitSha(...values: readonly (string | null | undefined)[]): string {
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

/** JSON Run만으로는 commit/status가 뒤처질 수 있어 TaskCursor·DB 런타임 증거를 합친다. */
export function enrichCodeTaskRunForFlowPhase(input: {
  readonly run: CodeTaskExecutionRunV1 | null | undefined;
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly dbRun?: Readonly<{
    readonly commitSha?: string | null;
    readonly runtimeState?: RuntimeState | null;
  }> | null;
}): CodeTaskExecutionRunV1 | null {
  const base = input.run ?? null;
  if (!base) return null;

  if (base.status === "completed" || base.status === "no_code_change_completed") {
    return base;
  }

  const execution =
    input.execution?.taskId === base.processTaskId ? input.execution : null;
  const commit = firstRecordedCommitSha(
    base.commitSha,
    base.branchHeadCommitSha,
    execution?.commitSha,
    execution?.branchHeadCommitSha,
    input.dbRun?.commitSha,
  );

  let status = base.status;
  if (execution) {
    const syncFromCursorStatuses = new Set<TaskCursorExecutionV1["status"]>([
      "github_verifying",
      "cursor_completed",
      "github_verified",
      "review_pending",
      "security_pending",
      "scm_pending",
    ]);
    if (syncFromCursorStatuses.has(execution.status)) {
      const classified = classifyCodeTaskExecutionRunFromTaskCursor(execution);
      if (classified.status === "github_verifying" || execution.status === "github_verifying") {
        status = "github_verifying";
      } else if (
        classified.status === "completed" ||
        classified.status === "no_code_change_completed"
      ) {
        status = classified.status;
      }
    }
  }

  if (
    input.dbRun?.runtimeState === "completed" &&
    status !== "failed" &&
    status !== "rework_required"
  ) {
    status = "completed";
  }

  if (
    input.dbRun?.runtimeState === "github_verifying" &&
    (status === "cursor_running" || status === "cursor_requested" || status === "status_check_stopped")
  ) {
    status = "github_verifying";
  }

  if (
    commit &&
    (status === "cursor_running" ||
      status === "cursor_requested" ||
      status === "status_check_stopped")
  ) {
    status = "github_verifying";
  }

  const workBranch = String(
    base.workBranch ?? execution?.workBranch ?? buildTaskCursorWorkBranch(base.processTaskId),
  ).trim();
  const cursorRunId = String(base.cursorRunId ?? execution?.cursorRunId ?? "").trim();
  if (
    !commit &&
    workBranch &&
    cursorRunId &&
    (status === "cursor_running" ||
      status === "cursor_requested" ||
      status === "status_check_stopped")
  ) {
    status = "github_verifying";
  }

  if (
    status === base.status &&
    !commit &&
    String(base.workBranch ?? "").trim() === workBranch
  ) {
    return base;
  }
  return {
    ...base,
    status,
    ...(workBranch && !base.workBranch ? { workBranch } : {}),
    ...(commit ? { commitSha: commit, branchHeadCommitSha: commit } : {}),
  };
}

function mapCursorStatusToPhase(input: {
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly parentTaskId: string;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly developerStatus?: ImplementationBoardStepStatus;
  readonly failureReason?: string;
}): CodeTaskExecutionFlowPhase {
  if (input.failureReason === "prompt_preflight_failed") return "prompt_preflight_failed";
  const execution = input.execution;
  if (!execution || execution.taskId !== input.parentTaskId) {
    if (input.developerStatus === "failed") return "failed";
    return "prompt_ready";
  }
  if (
    input.autoGate?.status === "passed" &&
    input.autoGate.taskId === input.parentTaskId
  ) {
    return "completed";
  }
  const s = execution.status;
  if (execution.failureReason === "prompt_preflight_failed") return "prompt_preflight_failed";
  if (s === "cursor_failed" || s === "github_verify_failed") {
    if (execution.failureReason === "github_branch_missing") return "github_branch_missing";
    if (execution.failureReason === "github_verify_timeout") return "github_verify_timeout";
    return "failed";
  }
  if (s === "status_check_stopped") return "cursor_running";
  if (s === "scm_pending") return "completed";
  // Reviewer/Security are handled in integrated stage, not per CodeTask.
  if (s === "review_pending" || s === "security_pending") return "lightweight_checking";
  if (s === "github_verified") return "github_verified";
  if (s === "github_verifying" || s === "cursor_completed") {
    const escalation = resolveGithubVerifyStuckEscalation({ execution });
    if (escalation === "github_branch_missing") return "github_branch_missing";
    if (escalation === "github_verify_timeout") return "github_verify_timeout";
    return "github_verifying";
  }
  if (s === "cursor_running" || s === "cursor_requested") {
    if (executionHasRecordedCommit(execution)) return "github_verifying";
    const workBranch = String(execution.workBranch ?? "").trim();
    const cursorRunId = String(execution.cursorRunId ?? "").trim();
    if (workBranch && cursorRunId) return "github_verifying";
    return "cursor_running";
  }
  return "prompt_ready";
}

function bumpFlowPhaseWithGithubCommitEvidence(input: {
  readonly run: CodeTaskExecutionRunV1 | null;
  readonly execution: TaskCursorExecutionV1 | null;
  readonly phase: CodeTaskExecutionFlowPhase;
}): CodeTaskExecutionFlowPhase {
  const hasCommit = Boolean(
    (input.run &&
      String(input.run.commitSha ?? input.run.branchHeadCommitSha ?? "").trim()) ||
      (input.execution && executionHasRecordedCommit(input.execution)),
  );
  if (!hasCommit) return input.phase;
  if (input.phase === "cursor_running" || input.phase === "prompt_ready") {
    return "github_verifying";
  }
  return input.phase;
}

function phaseIndex(phase: CodeTaskExecutionFlowPhase): number {
  const order: CodeTaskExecutionFlowPhase[] = [
    "prompt_ready",
    "prompt_preflight_failed",
    "cursor_running",
    "cursor_completed",
    "github_verifying",
    "github_verified",
    "lightweight_checking",
    "completed",
    "failed",
  ];
  const idx = order.indexOf(phase);
  return idx >= 0 ? idx : 0;
}

export function buildCodeTaskExecutionFlowSteps(input: {
  readonly phase: CodeTaskExecutionFlowPhase;
  readonly policy: CodeTaskReviewSecurityPolicyResult;
}): readonly CodeTaskExecutionFlowStepVm[] {
  const current = phaseIndex(input.phase);

  return FLOW_STEP_DEFS.map((def, index) => {
    let label = def.label;

    const stepPhase = def.id as CodeTaskExecutionFlowPhase;
    const stepIdx = phaseIndex(stepPhase === "completed" ? "completed" : stepPhase);

    let state: CodeTaskExecutionFlowStepState = "pending";
    if (input.phase === "prompt_preflight_failed") {
      if (def.id === "prompt_ready") state = "done";
      else if (def.id === "cursor_running") {
        state = "failed";
        label = "Cursor 실행 전 차단";
      } else {
        state = "pending";
      }
    } else if (input.phase === "failed") {
      if (stepIdx < phaseIndex("github_verifying")) state = stepIdx < current ? "done" : "pending";
      else if (def.id === "github_verifying") state = "failed";
      else state = "pending";
    } else if (input.phase === "prompt_ready") {
      if (def.id === "prompt_ready") state = "done";
      else if (def.id === "cursor_running") {
        state = "pending";
        label = "Cursor 실행 대기";
      } else {
        state = "pending";
      }
    } else if (stepIdx < current) {
      state = "done";
    } else if (stepIdx === current || (def.id === "cursor_running" && input.phase === "cursor_running")) {
      state = "active";
    }

    if (input.phase === "completed" && def.id === "completed") state = "done";
    if (input.phase === "completed" && stepIdx < phaseIndex("completed")) {
      state = "done";
    }

    return { id: def.id, label, state };
  });
}

export function deriveCodeTaskExecutionFlowPhase(input: {
  readonly parentTaskId: string;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly developerStatus?: ImplementationBoardStepStatus;
  readonly failureReason?: string;
  readonly latestRun?: CodeTaskExecutionRunV1 | null;
}): CodeTaskExecutionFlowPhase {
  const run = input.latestRun ?? null;
  const execution =
    input.taskCursorExecution?.taskId === input.parentTaskId ? input.taskCursorExecution : null;

  const finish = (phase: CodeTaskExecutionFlowPhase): CodeTaskExecutionFlowPhase =>
    bumpFlowPhaseWithGithubCommitEvidence({ run, execution, phase });

  if (
    run?.failureReason === "prompt_preflight_failed" ||
    execution?.failureReason === "prompt_preflight_failed"
  ) {
    return "prompt_preflight_failed";
  }

  if (run?.status === "completed" || run?.status === "no_code_change_completed") {
    return "completed";
  }

  if (
    input.autoGate?.status === "passed" &&
    input.autoGate.taskId === input.parentTaskId.trim()
  ) {
    return "completed";
  }

  if (execution) {
    const fromCursor = mapCursorStatusToPhase({
      execution,
      parentTaskId: input.parentTaskId,
      autoGate: input.autoGate,
      developerStatus: input.developerStatus,
      failureReason: input.failureReason,
    });
    if (
      fromCursor === "completed" ||
      fromCursor === "lightweight_checking" ||
      fromCursor === "github_verified" ||
      fromCursor === "github_verifying" ||
      fromCursor === "cursor_running"
    ) {
      return finish(fromCursor);
    }
  }

  if (run) {
    if (run.status === "completed" || run.status === "no_code_change_completed") {
      return "completed";
    }
    if (isInFlightCodeTaskExecutionRunStatus(run.status)) {
      return finish(mapCodeTaskRunStatusToFlowPhase(run.status) ?? "cursor_running");
    }
    if (
      run.status === "failed" ||
      run.status === "rework_required" ||
      run.status === "status_check_stopped"
    ) {
      if (run.failureReason === "prompt_preflight_failed") {
        return "prompt_preflight_failed";
      }
      if (run.status === "status_check_stopped") return finish("cursor_running");
      if (runHasCursorOrGithubEvidence(run)) {
        return String(run.commitSha ?? run.branchHeadCommitSha ?? "").trim()
          ? "failed"
          : finish("cursor_running");
      }
      return "failed";
    }
    if (isQueuedCodeTaskExecutionRunStatus(run.status)) {
      if (
        execution &&
        (execution.status === "cursor_running" || execution.status === "cursor_requested")
      ) {
        return finish("cursor_running");
      }
      return "prompt_ready";
    }
  }

  if (execution) {
    return finish(
      mapCursorStatusToPhase({
        execution,
        parentTaskId: input.parentTaskId,
        autoGate: input.autoGate,
        developerStatus: input.developerStatus,
        failureReason: input.failureReason,
      }),
    );
  }

  if (input.developerStatus === "failed") return "failed";
  return "prompt_ready";
}
