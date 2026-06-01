import type { ImplementationBoardStepStatus } from "@/lib/prototype/implementationExecutionBoard";
import type { CodeTaskReviewSecurityPolicyResult } from "@/lib/prototype/implementationReviewSecurityPolicy";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

export type CodeTaskExecutionFlowPhase =
  | "prompt_ready"
  | "cursor_running"
  | "cursor_completed"
  | "github_verifying"
  | "github_verified"
  | "lightweight_checking"
  | "review_policy_checked"
  | "ai_review_running"
  | "ai_review_passed"
  | "security_policy_checked"
  | "ai_security_running"
  | "ai_security_passed"
  | "completed"
  | "failed"
  | "blocked_by_dependency";

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
  { id: "review_policy_checked", label: "검수 필요 여부" },
  { id: "security_policy_checked", label: "보안 필요 여부" },
  { id: "completed", label: "완료" },
];

export function formatCodeTaskExecutionFlowPhaseKo(phase: CodeTaskExecutionFlowPhase): string {
  switch (phase) {
    case "prompt_ready":
      return "개발 프롬프트 준비";
    case "cursor_running":
      return "Cursor 실행 중";
    case "cursor_completed":
      return "Cursor 실행 완료";
    case "github_verifying":
      return "GitHub commit 확인 중";
    case "github_verified":
      return "GitHub 확인 완료";
    case "lightweight_checking":
      return "경량 자동검사 중";
    case "review_policy_checked":
      return "AI검수 필요 여부 확인 완료";
    case "ai_review_running":
      return "AI검수 진행 중";
    case "ai_review_passed":
      return "AI검수 완료";
    case "security_policy_checked":
      return "AI보안 필요 여부 확인 완료";
    case "ai_security_running":
      return "AI보안 진행 중";
    case "ai_security_passed":
      return "AI보안 완료";
    case "completed":
      return "완료";
    case "failed":
      return "재작업 필요";
    case "blocked_by_dependency":
      return "선행 작업 대기";
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
    case "ai_review_running":
      return "AI검수 진행 중";
    case "ai_security_running":
      return "AI보안 진행 중";
    case "completed":
      return "실행 완료";
    case "failed":
      return "commit 확인 실패";
    case "blocked_by_dependency":
      return "선행 작업 대기";
    case "prompt_ready":
      return "Quick 실행 대기";
    default:
      return "진행 중";
  }
}

function mapCursorStatusToPhase(input: {
  readonly execution?: TaskCursorExecutionV1 | null;
  readonly parentTaskId: string;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly developerStatus?: ImplementationBoardStepStatus;
  readonly failureReason?: string;
}): CodeTaskExecutionFlowPhase {
  if (input.failureReason === "blocked_by_dependency") return "blocked_by_dependency";
  const execution = input.execution;
  if (!execution || execution.taskId !== input.parentTaskId) {
    if (input.developerStatus === "done") return "completed";
    if (input.developerStatus === "failed") return "failed";
    return "prompt_ready";
  }
  const s = execution.status;
  if (s === "cursor_failed" || s === "github_verify_failed") return "failed";
  if (s === "status_check_stopped") return "cursor_running";
  if (s === "scm_pending") return "completed";
  const gate = input.autoGate;
  const gateForTask = gate && gate.taskId === execution.taskId ? gate : null;
  if (gateForTask?.status === "review_running") return "ai_review_running";
  if (gateForTask?.status === "passed") {
    if (s === "security_pending") return "ai_review_passed";
    return "review_policy_checked";
  }
  if (s === "review_pending" || s === "security_pending") return "lightweight_checking";
  if (s === "github_verified") return "github_verified";
  if (s === "github_verifying" || s === "cursor_completed") return "github_verifying";
  if (s === "cursor_running" || s === "cursor_requested") return "cursor_running";
  return "prompt_ready";
}

function phaseIndex(phase: CodeTaskExecutionFlowPhase): number {
  const order: CodeTaskExecutionFlowPhase[] = [
    "blocked_by_dependency",
    "prompt_ready",
    "cursor_running",
    "cursor_completed",
    "github_verifying",
    "github_verified",
    "lightweight_checking",
    "review_policy_checked",
    "ai_review_running",
    "ai_review_passed",
    "security_policy_checked",
    "ai_security_running",
    "ai_security_passed",
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
  const reviewSkipped = input.policy.reviewPolicy === "skip";
  const securitySkipped = input.policy.securityPolicy === "skip";

  return FLOW_STEP_DEFS.map((def, index) => {
    let label = def.label;
    if (def.id === "review_policy_checked" && reviewSkipped) label = "검수 필요 여부 (생략)";
    if (def.id === "security_policy_checked" && securitySkipped) label = "보안 필요 여부 (생략)";

    const stepPhase = def.id as CodeTaskExecutionFlowPhase;
    const stepIdx = phaseIndex(stepPhase === "completed" ? "completed" : stepPhase);

    let state: CodeTaskExecutionFlowStepState = "pending";
    if (input.phase === "failed") {
      if (stepIdx < phaseIndex("github_verifying")) state = stepIdx < current ? "done" : "pending";
      else if (def.id === "github_verifying") state = "failed";
      else state = "pending";
    } else if (input.phase === "blocked_by_dependency") {
      state = "pending";
    } else if (stepIdx < current) {
      state = def.id === "review_policy_checked" && reviewSkipped ? "skipped" : def.id === "security_policy_checked" && securitySkipped ? "skipped" : "done";
    } else if (stepIdx === current || (def.id === "cursor_running" && input.phase === "cursor_running")) {
      state = def.id === "review_policy_checked" && reviewSkipped ? "skipped" : def.id === "security_policy_checked" && securitySkipped ? "skipped" : "active";
    } else if (
      (def.id === "review_policy_checked" && reviewSkipped && current > stepIdx) ||
      (def.id === "security_policy_checked" && securitySkipped && current > stepIdx)
    ) {
      state = "skipped";
    }

    if (input.phase === "completed" && def.id === "completed") state = "done";
    if (input.phase === "completed" && stepIdx < phaseIndex("completed")) {
      state =
        def.id === "review_policy_checked" && reviewSkipped
          ? "skipped"
          : def.id === "security_policy_checked" && securitySkipped
            ? "skipped"
            : "done";
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
}): CodeTaskExecutionFlowPhase {
  return mapCursorStatusToPhase(input);
}
