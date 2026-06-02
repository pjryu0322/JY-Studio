import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import {
  formatWipDraftFailureReasonLabel,
  isRealCursorSourceGenerationCompleted,
  isStubCodeAgentWipExecution,
  REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
} from "@/lib/prototype/codeAgentWipExecution";
import { platformScmStatusLabel } from "@/lib/prototype/platformScmExecution";
import type {
  ImplementationExecutionBoardTaskRowV1,
  ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
import { pickFirstExecutableDeveloperTaskId } from "@/lib/prototype/implementationExecutionBoard";
import { resolveTaskCursorAutoChainDecision } from "@/lib/prototype/implementationTaskCursorAutoChain";
import {
  canContinueTaskCursorAutoChainAfterFailure,
  resolveTaskCursorFailurePolicyFromExecution,
} from "@/lib/prototype/taskCursorFailurePolicy";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import {
  TASK_CURSOR_POLLING_CANCEL_HINT,
  TASK_CURSOR_STATUS_CHECK_RESUME_HINT,
} from "@/lib/prototype/taskCursorExecution";
import {
  isTaskCursorCloudAgentPollingCancellable,
  isTaskCursorStatusCheckResumable,
} from "@/lib/prototype/taskCursorClientPollLoop";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import {
  AI_DEVELOPER_EXECUTION_REQUEST_CHIP,
  TASK_CURSOR_FAILURE_MESSAGES,
} from "@/lib/prototype/taskCursorExecution";
import { formatTaskCursorElapsedMinutes } from "@/lib/prototype/taskCursorClientPollLoop";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { summarizeImplementationAutoQualityGateForProgress } from "@/lib/prototype/implementationAutoQualityGate";

export type CodeAgentExecutionProgressStatus =
  | "idle"
  | "draft_created"
  | "cursor_request_ready"
  | "cursor_requested"
  | "cursor_running"
  | "cursor_completed"
  | "status_check_stopped"
  | "cursor_failed"
  | "developer_reviewing"
  | "developer_approved";

export type CodeAgentExecutionProgressStepState = "pending" | "active" | "done" | "failed";

export type CodeAgentExecutionProgressStep = Readonly<{
  readonly id: string;
  readonly label: string;
  readonly state: CodeAgentExecutionProgressStepState;
}>;

export type CodeAgentExecutionProgressEvent = Readonly<{
  readonly id: string;
  readonly label: string;
  readonly timeLabel: string;
  readonly runId?: string;
}>;

export type CodeAgentExecutionProgressView = Readonly<{
  readonly status: CodeAgentExecutionProgressStatus;
  readonly statusLabel: string;
  readonly summaryLine: string;
  readonly selectedTaskId?: string;
  readonly selectedTaskTitle?: string;
  readonly nextProcessingHint?: string;
  readonly cursorApiLabel: string;
  readonly branchName?: string;
  readonly commitSha?: string;
  readonly commitShaDisplay?: string;
  readonly changedFileCount: number;
  readonly testStatus: "none" | "stub" | "passed" | "failed" | "unknown";
  readonly testStatusLabel: string;
  readonly runId?: string;
  readonly failureReason?: string;
  readonly nextActionLabel?: string;
  readonly showGenerationClarification: boolean;
  readonly isStubResult: boolean;
  readonly scmStatusLabel?: string;
  readonly steps: readonly CodeAgentExecutionProgressStep[];
  readonly compactSteps?: readonly CodeAgentExecutionProgressStep[];
  readonly recentEvents: readonly CodeAgentExecutionProgressEvent[];
  /** 모바일 메인 화면 단순화 — 기술 상세는 상세 보기로 이동 */
  readonly compactMainPresentation?: boolean;
  readonly progressCardTitle?: string;
  readonly canCancelCloudAgentPolling?: boolean;
  readonly canResumeStatusCheck?: boolean;
  readonly pollingCancelHint?: string;
  readonly statusCheckResumeHint?: string;
  readonly hideTaskDetailInCompact?: boolean;
}>;

export const RELEVANT_TIMELINE_ACTIONS = new Set([
  "implementation_stage_action_routed",
  "implementation_stage_action_clicked",
  "implementation_stage_action_executed",
  "implementation_stage_action_blocked",
  "code_agent_wip_requested",
  "code_agent_wip_draft_created",
  "code_agent_wip_draft_failed",
  "implementation_wip_draft_created",
  "implementation_wip_draft_persisted",
  "cursor_api_direct_execution_requested",
  "cursor_api_direct_execution_started",
  "cursor_api_direct_execution_completed",
  "cursor_api_direct_execution_failed",
  "cursor_api_direct_execution_unsupported",
  "cursor_api_git_commit_created",
  "platform_scm_push_requested",
  "platform_scm_push_started",
  "platform_scm_push_completed",
  "platform_scm_push_failed",
  "platform_scm_pr_created",
  "platform_scm_pr_requested",
  "platform_scm_pr_failed",
  "platform_scm_merge_requested",
  "platform_scm_merge_completed",
  "platform_scm_merge_failed",
  "task_cursor_execution_requested",
  "task_cursor_prompt_built",
  "task_cursor_api_requested",
  "task_cursor_api_started",
  "task_cursor_api_completed",
  "task_cursor_api_failed",
  "task_cursor_github_verify_requested",
  "task_cursor_github_verified",
  "task_cursor_github_verify_failed",
]);

const TIMELINE_ACTION_LABELS: Record<string, string> = {
  implementation_stage_action_routed: "구현 액션 라우팅",
  implementation_stage_action_clicked: "구현 액션 클릭",
  implementation_stage_action_executed: "구현 액션 실행",
  implementation_stage_action_blocked: "구현 액션 차단",
  code_agent_wip_requested: "Code Agent WIP 요청",
  code_agent_wip_draft_created: "WIP 초안 생성",
  code_agent_wip_draft_failed: "WIP 초안 생성 실패",
  implementation_wip_draft_created: "WIP 초안 생성",
  implementation_wip_draft_persisted: "WIP 초안 저장",
  cursor_api_direct_execution_requested: "Cursor API 요청",
  cursor_api_direct_execution_started: "Cursor API 실행 시작",
  cursor_api_direct_execution_completed: "Cursor API 완료",
  cursor_api_direct_execution_failed: "Cursor API 실패",
  cursor_api_direct_execution_unsupported: "Cursor API 미지원",
  cursor_api_git_commit_created: "Git 커밋 생성",
  platform_scm_push_requested: "SCM push 요청",
  platform_scm_push_started: "SCM push 시작",
  platform_scm_push_completed: "SCM push 완료",
  platform_scm_push_failed: "SCM push 실패",
  platform_scm_pr_created: "SCM PR 생성",
  platform_scm_pr_requested: "SCM PR 요청",
  platform_scm_pr_failed: "SCM PR 실패",
  platform_scm_merge_requested: "SCM merge 요청",
  platform_scm_merge_completed: "SCM merge 완료",
  platform_scm_merge_failed: "SCM merge 실패",
  task_cursor_execution_requested: "AI 개발자 실행 요청",
  task_cursor_prompt_built: "Cursor prompt 생성",
  task_cursor_api_requested: "Cursor API 요청",
  task_cursor_api_started: "Cursor 작업 진행 중",
  task_cursor_api_completed: "Cursor 작업 완료",
  task_cursor_api_failed: "Cursor 실행 실패",
  task_cursor_github_verify_requested: "GitHub 확인 요청",
  task_cursor_github_verified: "GitHub 결과 확인됨",
  task_cursor_github_verify_failed: "GitHub 확인 실패",
  cursor_api_availability_checked: "Cursor API 환경 점검",
};

function extractTimelineField(text: string, field: string): string | undefined {
  const match = text.match(new RegExp(`${field}=([^\\s]+(?:\\s(?!\\w+=)[^\\s]+)*)`));
  return match?.[1]?.trim() || undefined;
}

function extractWipDraftFailureFromTimeline(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): { readonly reason?: string; readonly detail?: string } | null {
  if (!timeline?.length) return null;
  const failed = [...timeline]
    .filter((entry) => entry.action === "code_agent_wip_draft_failed")
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  if (!failed) return null;
  const text = failed.responseText ?? "";
  return {
    reason: extractTimelineField(text, "reason"),
    detail: extractTimelineField(text, "detail"),
  };
}

function formatWipDraftFailureMessage(failure: {
  readonly reason?: string;
  readonly detail?: string;
}): string {
  const reasonLine = formatWipDraftFailureReasonLabel(failure.reason);
  const detail = failure.detail?.trim();
  if (detail && detail !== reasonLine) {
    return `Code Agent WIP 초안 생성에 실패했습니다.\n\n사유:\n- ${reasonLine}\n\n${detail}`;
  }
  return `Code Agent WIP 초안 생성에 실패했습니다.\n\n사유:\n- ${reasonLine}`;
}

function formatTimelineTimeLabel(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function extractRunIdFromTimelineEntry(entry: RequirementsPromptTimelineEntry): string | undefined {
  const text = entry.responseText ?? "";
  const match = text.match(/runId=([^\s]+)/);
  return match?.[1]?.trim() || undefined;
}

function formatTimelineEntryLabel(entry: RequirementsPromptTimelineEntry): string {
  const base = TIMELINE_ACTION_LABELS[entry.action] ?? entry.action;
  const decision = entry.routingDecision?.trim();
  if (decision) return `${base} (${decision})`;
  return base;
}

export function extractRecentCodeAgentTimelineEvents(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  limit = 5,
): readonly CodeAgentExecutionProgressEvent[] {
  if (!timeline?.length) return [];
  return [...timeline]
    .filter((entry): entry is RequirementsPromptTimelineEntry => Boolean(entry?.action))
    .filter((entry) => RELEVANT_TIMELINE_ACTIONS.has(entry.action))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map((entry, index) => ({
      id: `${entry.action}-${entry.createdAt}-${index}`,
      label: formatTimelineEntryLabel(entry),
      timeLabel: formatTimelineTimeLabel(entry.createdAt),
      runId: extractRunIdFromTimelineEntry(entry),
    }));
}

function resolveSelectedTaskTitle(
  board: ImplementationExecutionBoardV1 | null | undefined,
  taskId: string | undefined,
): string | undefined {
  if (!taskId || !board) return undefined;
  return board.taskRows.find((row) => row.taskId === taskId)?.title;
}

function formatCommitShaDisplay(sha: string | undefined, isStub: boolean): string | undefined {
  const raw = sha?.trim();
  if (!raw) return undefined;
  if (isStub || raw.startsWith("wip-stub")) return raw;
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 7)}…`;
}

function resolveTestStatus(wip: CodeAgentWipExecutionV1 | null | undefined): {
  readonly testStatus: CodeAgentExecutionProgressView["testStatus"];
  readonly testStatusLabel: string;
} {
  if (!wip?.commits.length) {
    return { testStatus: "none", testStatusLabel: "없음" };
  }
  const last = wip.commits[wip.commits.length - 1];
  const sha = String(last?.sha ?? wip.commitSha ?? "").trim();
  if (!sha || sha.startsWith("wip-stub")) {
    return { testStatus: "stub", testStatusLabel: "stub (미실행)" };
  }
  const results = last?.testResults ?? [];
  if (!results.length) {
    return { testStatus: "unknown", testStatusLabel: "미확인" };
  }
  const failed = results.some((line) => /fail|error|실패/i.test(line));
  return failed
    ? { testStatus: "failed", testStatusLabel: "failed" }
    : { testStatus: "passed", testStatusLabel: "passed" };
}

function isStubApprovedWip(wip: CodeAgentWipExecutionV1): boolean {
  return (
    wip.status === "developer_approved" &&
    isStubCodeAgentWipExecution(wip) &&
    !isRealCursorSourceGenerationCompleted(wip)
  );
}

function resolveProgressStatus(wip: CodeAgentWipExecutionV1 | null | undefined): CodeAgentExecutionProgressStatus {
  if (!wip) return "idle";
  const bridge = wip.bridgeExecutionStatus;
  const executionStatus = wip.executionStatus;
  if (bridge === "failed" || executionStatus === "cursor_api_failed") return "cursor_failed";
  if (bridge === "bridge_running") return "cursor_running";
  if (bridge === "bridge_requested") return "cursor_requested";
  if (bridge === "bridge_completed") {
    return isRealCursorSourceGenerationCompleted(wip) ? "cursor_completed" : "draft_created";
  }
  if (isStubApprovedWip(wip)) {
    return bridge === "draft_approved" ? "cursor_request_ready" : "draft_created";
  }
  if (wip.status === "developer_approved") return "developer_approved";
  if (wip.status === "developer_reviewing" && isRealCursorSourceGenerationCompleted(wip)) {
    return "developer_reviewing";
  }
  if (bridge === "draft_approved") return "cursor_request_ready";
  if (
    bridge === "draft_created" ||
    executionStatus === "draft_created" ||
    isStubCodeAgentWipExecution(wip)
  ) {
    return "draft_created";
  }
  return "idle";
}

function statusLabelFor(
  status: CodeAgentExecutionProgressStatus,
  wip?: CodeAgentWipExecutionV1 | null,
): string {
  if (status === "cursor_request_ready" && wip && isStubApprovedWip(wip)) {
    return "WIP 초안 승인됨";
  }
  switch (status) {
    case "idle":
      return "대기";
    case "draft_created":
      return "WIP 초안 생성됨";
    case "cursor_request_ready":
      return "Cursor 실행 준비";
    case "cursor_requested":
      return "Cursor API 요청됨";
    case "cursor_running":
      return "Cursor API 실행 중";
    case "cursor_completed":
      return "Cursor 결과 수신";
    case "cursor_failed":
      return "실패";
    case "developer_reviewing":
      return "개발자 검토 중";
    case "developer_approved":
      return "개발자 승인됨";
    default:
      return status;
  }
}

function cursorApiLabelFor(
  status: CodeAgentExecutionProgressStatus,
  wip: CodeAgentWipExecutionV1 | null | undefined,
): string {
  if (!wip) return "미실행";
  if (status === "cursor_running") return "실행 중";
  if (status === "cursor_requested") return "요청 전송됨";
  if (status === "cursor_completed") return "실행 완료";
  if (status === "cursor_failed") return "실행 실패";
  if (isRealCursorSourceGenerationCompleted(wip)) return "실행 완료";
  if (isStubCodeAgentWipExecution(wip) || wip.executionMode === "stub") {
    return "미실행 (WIP stub)";
  }
  return "미실행";
}

function summaryLineFor(
  status: CodeAgentExecutionProgressStatus,
  wip: CodeAgentWipExecutionV1 | null | undefined,
): string {
  if (status === "idle") {
    return "아직 Code Agent WIP 초안이 없습니다. [생성요청]으로 첫 작업 초안을 만들 수 있습니다.";
  }
  if (status === "draft_created" || status === "cursor_request_ready") {
    if (wip && isStubApprovedWip(wip)) {
      return "WIP 초안 승인됨. 실제 Cursor API: 아직 실행하지 않음. 다음 단계: Cursor 실행 요청";
    }
    return "WIP 초안 생성됨. 실제 Cursor API: 아직 실행하지 않음. 다음 단계: Cursor 실행 요청";
  }
  if (status === "cursor_requested" || status === "cursor_running") {
    return "Cursor API 실행 결과를 기다리는 중입니다.";
  }
  if (status === "cursor_completed") {
    return "소스 생성/commit 완료. SCM Push/PR은 플랫폼 SCM 단계에서 수행합니다. 구현 결과 승인 또는 재작업을 선택하세요.";
  }
  if (status === "cursor_failed") {
    return wip?.bridgeErrorMessage?.trim() || "Cursor API 실행에 실패했습니다.";
  }
  if (status === "developer_reviewing") {
    return "Cursor 결과를 AI 개발자가 검토 중입니다.";
  }
  return "Code Agent WIP 작업이 승인되었습니다.";
}

function nextActionLabelFor(
  status: CodeAgentExecutionProgressStatus,
  wip?: CodeAgentWipExecutionV1 | null,
): string | undefined {
  const scm = wip?.platformScmExecutionV1;
  if (scm?.pushStatus === "push_failed" || scm?.pushStatus === "pr_failed") {
    return "SCM 재시도";
  }
  if (
    (wip?.status === "developer_approved" || wip?.status === "scm_commit_pending") &&
    scm &&
    !["push_completed", "pr_completed"].includes(scm.pushStatus)
  ) {
    return "SCM 반영 요청";
  }
  if (scm?.pushStatus === "pr_completed" && scm.mergeStatus !== "merge_completed") {
    return "PR Merge 실행";
  }
  switch (status) {
    case "idle":
      return "생성요청";
    case "draft_created":
    case "cursor_request_ready":
      return REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP;
    case "cursor_completed":
    case "developer_reviewing":
      return "구현 결과 승인";
    case "cursor_failed":
      return REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP;
    default:
      return undefined;
  }
}

function buildProgressSteps(
  status: CodeAgentExecutionProgressStatus,
  wip: CodeAgentWipExecutionV1 | null | undefined,
): readonly CodeAgentExecutionProgressStep[] {
  const bridge = wip?.bridgeExecutionStatus;
  const realDone = Boolean(wip && isRealCursorSourceGenerationCompleted(wip));
  const step = (id: string, label: string, state: CodeAgentExecutionProgressStepState) => ({ id, label, state });

  const wipDone = Boolean(wip);
  const cursorRequested = bridge === "bridge_requested" || bridge === "bridge_running" || realDone || bridge === "bridge_completed";
  const cursorRunning = bridge === "bridge_running";
  const sourceReceived = realDone;
  const scmPending = sourceReceived && wip?.pushed !== true;
  const scmDone =
    wip?.platformScmExecutionV1?.pushStatus === "push_completed" ||
    wip?.platformScmExecutionV1?.pushStatus === "pr_completed";
  const mergeDone = wip?.platformScmExecutionV1?.mergeStatus === "merge_completed";
  const mergePending =
    scmDone &&
    wip?.platformScmExecutionV1?.pushStatus === "pr_completed" &&
    wip?.platformScmExecutionV1?.mergeStatus === "merge_pending";
  const reviewed =
    (status === "developer_reviewing" || status === "developer_approved") &&
    Boolean(wip && isRealCursorSourceGenerationCompleted(wip));

  return [
    step("wip_draft", "WIP 초안 생성", wipDone ? "done" : status === "idle" ? "pending" : "active"),
    step(
      "cursor_request",
      "Cursor API 요청",
      cursorRunning
        ? "active"
        : cursorRequested
          ? bridge === "failed"
            ? "failed"
            : "done"
          : wipDone
            ? "pending"
            : "pending",
    ),
    step(
      "source_change",
      "소스 변경 수신",
      sourceReceived ? "done" : cursorRunning ? "active" : cursorRequested ? "pending" : "pending",
    ),
    step(
      "scm_reflection",
      "SCM Push/PR",
      scmDone ? "done" : sourceReceived ? (scmPending ? "pending" : "active") : "pending",
    ),
    step(
      "scm_merge",
      "SCM Merge",
      mergeDone ? "done" : mergePending ? "pending" : scmDone ? "pending" : "pending",
    ),
    step(
      "developer_review",
      "개발자 승인/검수",
      reviewed ? "done" : sourceReceived ? "pending" : "pending",
    ),
  ];
}

function mapTaskCursorToProgressStatus(
  execution: TaskCursorExecutionV1,
): CodeAgentExecutionProgressStatus {
  switch (execution.status) {
    case "pending":
    case "prompt_ready":
      return "cursor_request_ready";
    case "cursor_requested":
      return "cursor_requested";
    case "cursor_running":
    case "github_verifying":
      return "cursor_running";
    case "cursor_completed":
      return "cursor_completed";
    case "github_verified":
    case "review_pending":
    case "security_pending":
    case "scm_pending":
      return "developer_reviewing";
    case "cursor_failed":
    case "github_verify_failed":
      return "cursor_failed";
    default:
      return "idle";
  }
}

function taskCursorStatusLabel(execution: TaskCursorExecutionV1): string {
  switch (execution.status) {
    case "pending":
    case "prompt_ready":
      return "AI 개발자 실행 대기";
    case "cursor_requested":
      return "Cursor 실행 요청됨";
    case "cursor_running":
      return "AI 개발자 실행 중";
    case "cursor_completed":
      return "Cursor 작업 완료 — GitHub 확인 대기";
    case "github_verifying":
      return "GitHub 결과 확인 중";
    case "github_verified":
    case "review_pending":
      return "GitHub 결과 확인됨";
    case "security_pending":
      return "GitHub 결과 확인됨";
    case "scm_pending":
      return "Task 완료 — 다음 작업 대기";
    case "status_check_stopped":
      return "상태 확인 중단됨";
    case "cursor_failed":
    case "github_verify_failed":
      return "실패";
    default:
      return execution.status;
  }
}

function taskCursorSummaryLine(execution: TaskCursorExecutionV1): string {
  if (execution.status === "status_check_stopped") {
    return [
      execution.errorMessage ?? TASK_CURSOR_FAILURE_MESSAGES.poll_cancelled,
      TASK_CURSOR_STATUS_CHECK_RESUME_HINT,
    ].join("\n");
  }
  if (execution.status === "cursor_failed" || execution.status === "github_verify_failed") {
    return (
      execution.errorMessage ??
      (execution.failureReason
        ? TASK_CURSOR_FAILURE_MESSAGES[execution.failureReason]
        : "Task Cursor 실행에 실패했습니다.")
    );
  }
  if (execution.status === "github_verified" || execution.status === "review_pending") {
    return "검수 자동 점검을 진행합니다.";
  }
  if (execution.status === "security_pending" || execution.status === "scm_pending") {
    return "검수가 완료되었습니다. 다음 작업을 자동으로 진행합니다.";
  }
  if (execution.status === "cursor_completed" || execution.status === "github_verifying") {
    return "GitHub commit 확인을 진행합니다.";
  }
  if (execution.status === "cursor_running" || execution.status === "cursor_requested") {
    const elapsed = formatTaskCursorElapsedMinutes(execution.updatedAt ?? execution.createdAt);
    const elapsedNote = elapsed != null ? ` · 경과 ${elapsed}분` : "";
    return [
      `Cursor Cloud Agent가 코드를 생성하는 중입니다${elapsedNote}.`,
      "플랫폼은 결과 branch/commit을 확인하고 있습니다.",
      "Cursor 작업은 외부 Cloud Agent 처리 시간에 따라 오래 걸릴 수 있습니다.",
    ].join("\n");
  }
  return "Quick 실행으로 프로토타입 생성을 시작할 수 있습니다.";
}

function taskCursorNextProcessingHint(execution: TaskCursorExecutionV1): string {
  if (execution.status === "status_check_stopped") {
    return "진행: [상태 다시 확인]으로 Cloud Agent 결과 확인 재개";
  }
  if (execution.status === "cursor_failed" || execution.status === "github_verify_failed") {
    return "실패 원인을 확인한 뒤 재작업 요청을 진행해 주세요.";
  }
  if (execution.status === "scm_pending") {
    return "다음 처리: 우선순위 기준 다음 작업 자동 실행";
  }
  if (
    execution.status === "github_verified" ||
    execution.status === "review_pending" ||
    execution.status === "security_pending"
  ) {
    return "다음 처리: 다음 CodeTask 자동 실행";
  }
  if (execution.status === "cursor_completed" || execution.status === "github_verifying") {
    return "다음 처리: GitHub 결과 확인";
  }
  if (execution.status === "cursor_running" || execution.status === "cursor_requested") {
    return "진행: Cloud Agent 작업 결과 확인 중";
  }
  return "다음 처리: AI 개발자 실행 → GitHub 결과 확인";
}

function buildTaskCursorProgressSteps(execution: TaskCursorExecutionV1): readonly CodeAgentExecutionProgressStep[] {
  const step = (id: string, label: string, state: CodeAgentExecutionProgressStepState) => ({ id, label, state });
  const s = execution.status;
  const cursorDone = ["cursor_completed", "github_verifying", "github_verified", "review_pending", "security_pending", "scm_pending"].includes(s);
  const githubDone = ["github_verified", "review_pending", "security_pending", "scm_pending"].includes(s);
  const cursorFailed = s === "cursor_failed" || s === "github_verify_failed";
  return [
    step("task_prompt", "AI 개발자 실행 요청", s === "pending" ? "pending" : "done"),
    step(
      "cursor_request",
      "Cursor API 실행",
      cursorFailed && !cursorDone ? "failed" : cursorDone ? "done" : s === "cursor_running" || s === "cursor_requested" ? "active" : "pending",
    ),
    step(
      "github_verify",
      "GitHub commit 확인",
      s === "github_verify_failed" ? "failed" : githubDone ? "done" : s === "github_verifying" || s === "cursor_completed" ? "active" : "pending",
    ),
    step(
      "review",
      "검수",
      s === "scm_pending" || s === "security_pending" ? "done" : githubDone ? "active" : "pending",
    ),
  ];
}

export function buildCompactDashboardProgressSteps(
  execution: TaskCursorExecutionV1 | null | undefined,
  autoGate?: ImplementationAutoQualityGateV1 | null,
): readonly CodeAgentExecutionProgressStep[] {
  const step = (id: string, label: string, state: CodeAgentExecutionProgressStepState) => ({ id, label, state });
  if (!execution) {
    return [
      step("development", "개발 중", "pending"),
      step("github", "GitHub 확인", "pending"),
      step("quality", "검수", "pending"),
      step("preview", "다음 작업", "pending"),
    ];
  }
  const s = execution.status;
  const devActive = ["cursor_requested", "cursor_running", "pending", "prompt_ready"].includes(s);
  const devDone = ["cursor_completed", "github_verifying", "github_verified", "review_pending", "security_pending", "scm_pending"].includes(s);
  const devFailed = s === "cursor_failed";
  const githubActive = s === "github_verifying" || s === "cursor_completed";
  const githubDone = ["github_verified", "review_pending", "security_pending", "scm_pending"].includes(s);
  const githubFailed = s === "github_verify_failed";
  const qualityActive =
    s === "review_pending" ||
    (autoGate?.taskId === execution.taskId && autoGate.status === "review_running");
  const qualityDone =
    autoGate?.taskId === execution.taskId &&
    autoGate.status === "passed" &&
    ["security_pending", "scm_pending"].includes(s);
  const qualityFailed = autoGate?.taskId === execution.taskId && autoGate.status === "failed";
  const nextTaskReady = s === "scm_pending" && autoGate?.status === "passed";

  return [
    step(
      "development",
      "개발 중",
      devFailed ? "failed" : devDone ? "done" : devActive ? "active" : "pending",
    ),
    step(
      "github",
      "GitHub 확인",
      githubFailed ? "failed" : githubDone ? "done" : githubActive ? "active" : "pending",
    ),
    step(
      "quality",
      "검수",
      qualityFailed ? "failed" : qualityDone ? "done" : qualityActive ? "active" : "pending",
    ),
    step("preview", "다음 작업", nextTaskReady ? "done" : "pending"),
  ];
}

function parseTimelineResponseFields(responseText: string | undefined): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const token of String(responseText ?? "").split(/\s+/)) {
    const eq = token.indexOf("=");
    if (eq <= 0) continue;
    fields[token.slice(0, eq)] = token.slice(eq + 1);
  }
  return fields;
}

function inferInFlightTaskCursorExecutionFromTimeline(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
): TaskCursorExecutionV1 | null {
  if (!timeline?.length) return null;
  const terminalActions = new Set([
    "task_cursor_api_completed",
    "task_cursor_api_failed",
    "task_cursor_github_verified",
    "task_cursor_github_verify_failed",
  ]);
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const entry = timeline[index];
    if (!entry?.action) continue;
    const action = String(entry.action).trim();
    const fields = parseTimelineResponseFields(entry.responseText);
    if (terminalActions.has(action)) return null;
    if (action !== "task_cursor_api_started" && action !== "task_cursor_execution_requested") continue;
    const taskId = String(fields.taskId ?? entry.routingDecision ?? "").trim();
    if (!taskId) continue;
    const createdAt = String(entry.createdAt ?? new Date().toISOString());
    return {
      version: "task_cursor_execution_v1",
      projectId: String(fields.projectId ?? ""),
      taskId,
      workItemIds: [],
      status: "cursor_running",
      cursorProvider: "cursor",
      targetRepository: String(fields.targetRepository ?? ""),
      baseBranch: String(fields.baseBranch ?? "main"),
      workBranch: String(fields.workBranch ?? ""),
      cursorRunId: String(fields.runId ?? ""),
      createdAt,
      updatedAt: createdAt,
    };
  }
  return null;
}

function shouldUseCompactTaskCursorPresentation(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
}): boolean {
  const postVerifyStatuses = new Set([
    "github_verified",
    "review_pending",
    "security_pending",
    "scm_pending",
  ]);
  if (!postVerifyStatuses.has(input.execution.status)) return false;
  if (input.execution.status === "scm_pending") return true;
  const gate = input.autoGate;
  if (!gate || gate.taskId !== input.execution.taskId) return false;
  const commitSha = String(input.execution.commitSha ?? "").trim();
  return !commitSha || gate.sourceCommitSha === commitSha;
}

function buildTaskCursorExecutionProgressView(input: {
  readonly execution: TaskCursorExecutionV1;
  readonly board?: ImplementationExecutionBoardV1 | null;
  readonly latestTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
}): CodeAgentExecutionProgressView {
  const execution = input.execution;
  const status = mapTaskCursorToProgressStatus(execution);
  const rawSha = execution.commitSha;
  const isStubResult = Boolean(rawSha?.startsWith("wip-stub"));
  const recentEvents = extractRecentCodeAgentTimelineEvents(input.latestTimeline);
  const runId = execution.cursorRunId ?? recentEvents.find((event) => event.runId)?.runId;
  const compactMainPresentation = true;
  const autoGateSummary = summarizeImplementationAutoQualityGateForProgress(input.autoGate);
  let statusLabel = taskCursorStatusLabel(execution);
  let summaryLine = taskCursorSummaryLine(execution);
  let progressCardTitle = "구현 실행 중";
  if (execution.status === "cursor_running" || execution.status === "cursor_requested") {
    const elapsed = formatTaskCursorElapsedMinutes(execution.updatedAt ?? execution.createdAt);
    statusLabel = elapsed != null ? `AI 개발자 실행 중 · ${elapsed}분` : "AI 개발자 실행 중";
  }
  if (shouldUseCompactTaskCursorPresentation({ execution, autoGate: input.autoGate })) {
    if (autoGateSummary) {
      statusLabel = autoGateSummary.statusLabel;
      summaryLine = autoGateSummary.summaryLine;
    } else if (
      execution.status === "github_verified" ||
      execution.status === "review_pending"
    ) {
      statusLabel = "개발 결과 확인됨";
      summaryLine = "검수자 점검을 자동으로 진행합니다.";
    } else if (execution.status === "scm_pending") {
      statusLabel = "검수 통과";
      summaryLine = "다음 작업을 실행합니다.";
    }
  }
  if (execution.status === "cursor_failed" || execution.status === "github_verify_failed") {
    const chainDecision = input.board
      ? resolveTaskCursorAutoChainDecision({
          board: input.board,
          taskCursorExecution: execution,
          autoGate: input.autoGate,
        })
      : null;
    const canContinueAfterFailure =
      chainDecision?.kind === "continue_after_failure" ||
      (!input.board && canContinueTaskCursorAutoChainAfterFailure(execution));
    const policy = resolveTaskCursorFailurePolicyFromExecution(execution);
    if (canContinueAfterFailure) {
      progressCardTitle = "재작업 필요 · 계속 진행";
      statusLabel = "재작업 필요";
      summaryLine =
        execution.errorMessage ??
        policy?.userMessage ??
        "GitHub branch/commit 미확인";
    } else if (policy?.shouldStopAll) {
      progressCardTitle = "자동실행 중단";
      statusLabel = "실패";
      summaryLine = policy.userMessage || "환경설정을 확인해 주세요.";
    } else {
      progressCardTitle = "자동실행 중단";
      statusLabel = "실패";
      summaryLine = summaryLine || "자동실행이 중단되었습니다.";
    }
  }
  const nextProcessingHint =
    execution.status === "cursor_failed" || execution.status === "github_verify_failed"
      ? (() => {
          const chainDecision = input.board
            ? resolveTaskCursorAutoChainDecision({
                board: input.board,
                taskCursorExecution: execution,
                autoGate: input.autoGate,
              })
            : null;
          if (chainDecision?.kind === "continue_after_failure") {
            return "1개 작업은 재작업 필요로 분류했습니다. 독립적인 다음 작업을 계속 진행합니다.";
          }
          const policy = resolveTaskCursorFailurePolicyFromExecution(execution);
          if (policy?.shouldStopAll) {
            return "자동실행이 중단되었습니다. 환경설정을 확인해 주세요.";
          }
          return taskCursorNextProcessingHint(execution);
        })()
      : taskCursorNextProcessingHint(execution);
  return {
    status,
    statusLabel,
    summaryLine,
    selectedTaskId: execution.taskId,
    selectedTaskTitle: resolveSelectedTaskTitle(input.board ?? null, execution.taskId),
    nextProcessingHint,
    cursorApiLabel:
      status === "cursor_failed"
        ? "실행 실패"
        : status === "cursor_completed" || status === "developer_reviewing"
          ? "실행 완료"
          : status === "cursor_running" || status === "cursor_requested"
            ? "실행 중"
            : "미실행",
    branchName: execution.workBranch,
    commitSha: rawSha,
    commitShaDisplay: formatCommitShaDisplay(rawSha, isStubResult),
    changedFileCount: execution.changedFiles?.length ?? 0,
    testStatus: execution.testResults?.length ? "unknown" : "none",
    testStatusLabel: execution.testResults?.length ? "보고됨" : "없음",
    runId,
    failureReason:
      status === "cursor_failed"
        ? execution.errorMessage ??
          (execution.failureReason
            ? TASK_CURSOR_FAILURE_MESSAGES[execution.failureReason]
            : undefined)
        : input.autoGate?.status === "failed"
          ? input.autoGate.failureReason
          : undefined,
    nextActionLabel:
      status === "cursor_failed"
        ? AI_DEVELOPER_EXECUTION_REQUEST_CHIP
        : status === "cursor_completed"
          ? "GitHub 결과 확인"
          : status === "cursor_request_ready"
            ? AI_DEVELOPER_EXECUTION_REQUEST_CHIP
            : undefined,
    showGenerationClarification: false,
    isStubResult,
    steps: buildTaskCursorProgressSteps(execution),
    compactSteps: buildCompactDashboardProgressSteps(execution, input.autoGate),
    recentEvents,
    compactMainPresentation,
    progressCardTitle,
    hideTaskDetailInCompact: true,
    canCancelCloudAgentPolling: isTaskCursorCloudAgentPollingCancellable(execution),
    canResumeStatusCheck: isTaskCursorStatusCheckResumable(execution),
    pollingCancelHint: isTaskCursorCloudAgentPollingCancellable(execution)
      ? TASK_CURSOR_POLLING_CANCEL_HINT
      : undefined,
    statusCheckResumeHint: isTaskCursorStatusCheckResumable(execution)
      ? TASK_CURSOR_STATUS_CHECK_RESUME_HINT
      : undefined,
  };
}

export function buildCodeAgentExecutionProgressView(input: {
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  readonly board?: ImplementationExecutionBoardV1 | null;
  readonly latestTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly implementationAutoQualityGateV1?: ImplementationAutoQualityGateV1 | null;
}): CodeAgentExecutionProgressView {
  const inferredTaskCursor =
    input.taskCursorExecutionV1 ?? inferInFlightTaskCursorExecutionFromTimeline(input.latestTimeline);
  if (inferredTaskCursor) {
    return buildTaskCursorExecutionProgressView({
      execution: inferredTaskCursor,
      board: input.board,
      latestTimeline: input.latestTimeline,
      autoGate: input.implementationAutoQualityGateV1,
    });
  }
  const board = input.board ?? null;
  if (!input.codeAgentWipExecutionV1 && board) {
    const activeTaskId =
      pickFirstExecutableDeveloperTaskId(board) ?? board.taskRows.find((row) => row.developerStatus !== "skipped")?.taskId;
    const activeRow = activeTaskId ? board.taskRows.find((row) => row.taskId === activeTaskId) : undefined;
    const recentEvents = extractRecentCodeAgentTimelineEvents(input.latestTimeline);
    return {
      status: "idle",
      statusLabel: "대기",
      progressCardTitle: "구현 실행 현황",
      summaryLine: "Quick 실행으로 선택한 CodeTask를 실행할 수 있습니다.",
      hideTaskDetailInCompact: true,
      cursorApiLabel: "실제 Cursor API 미실행",
      changedFileCount: 0,
      testStatus: "unknown",
      testStatusLabel: "미실행",
      showGenerationClarification: false,
      isStubResult: false,
      compactMainPresentation: true,
      compactSteps: buildCompactDashboardProgressSteps(null, null),
      nextProcessingHint: activeTaskId ? "다음 처리: AI 개발자 실행 → GitHub 결과 확인" : undefined,
      steps: buildCompactDashboardProgressSteps(null, null).map((step) => ({
        id: step.id,
        label: step.label,
        state: step.state,
      })),
      recentEvents,
    };
  }
  const wip = input.codeAgentWipExecutionV1 ?? null;
  const status = resolveProgressStatus(wip);
  const selectedTaskId = wip?.selectedTaskId?.trim() || undefined;
  const latestCommit = wip?.commits[wip.commits.length - 1];
  const rawSha = latestCommit?.sha ?? wip?.commitSha;
  const isStubResult = Boolean(
    wip &&
      !isRealCursorSourceGenerationCompleted(wip) &&
      (isStubCodeAgentWipExecution(wip) || String(rawSha ?? "").startsWith("wip-stub")),
  );
  const { testStatus, testStatusLabel } = resolveTestStatus(wip);
  const recentEvents = extractRecentCodeAgentTimelineEvents(input.latestTimeline);
  const runId = recentEvents.find((event) => event.runId)?.runId;
  const draftFailure = !wip ? extractWipDraftFailureFromTimeline(input.latestTimeline) : null;
  const failureReason =
    status === "cursor_failed"
      ? wip?.bridgeErrorMessage?.trim()
      : draftFailure
        ? formatWipDraftFailureMessage(draftFailure)
        : undefined;
  const summaryLine =
    draftFailure && status === "idle"
      ? formatWipDraftFailureMessage(draftFailure)
      : summaryLineFor(status, wip);

  return {
    status,
    statusLabel: statusLabelFor(status, wip),
    summaryLine,
    selectedTaskId,
    selectedTaskTitle: resolveSelectedTaskTitle(input.board ?? null, selectedTaskId),
    cursorApiLabel: cursorApiLabelFor(status, wip),
    branchName: wip?.branchName || latestCommit?.branchName,
    commitSha: rawSha,
    commitShaDisplay: formatCommitShaDisplay(rawSha, isStubResult),
    changedFileCount: latestCommit?.changedFiles.length ?? 0,
    testStatus,
    testStatusLabel,
    runId,
    failureReason,
    nextActionLabel: nextActionLabelFor(status, wip),
    showGenerationClarification: status === "draft_created" || status === "cursor_request_ready",
    isStubResult,
    scmStatusLabel:
      status === "cursor_completed" || status === "developer_reviewing"
        ? platformScmStatusLabel(wip?.platformScmExecutionV1)
        : undefined,
    steps: buildProgressSteps(status, wip),
    recentEvents,
  };
}

export function resolveTaskCursorExecutionForRow(input: {
  readonly taskId: string;
  readonly taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistoryV1?: readonly TaskCursorExecutionV1[] | null;
}): TaskCursorExecutionV1 | null {
  const active = input.taskCursorExecutionV1;
  if (active?.taskId === input.taskId) return active;
  const history = input.taskCursorExecutionHistoryV1;
  if (!history?.length) return null;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry?.taskId === input.taskId) return entry;
  }
  return null;
}

export type TaskRowCursorProgressTone = "idle" | "polling" | "verifying" | "done" | "failed";

export type TaskRowCursorProgressView = Readonly<{
  readonly text: string;
  readonly tone: TaskRowCursorProgressTone;
  readonly isPolling: boolean;
  readonly shortLabel: string;
}>;

function taskRowProgressFromTaskCursorExecution(
  execution: TaskCursorExecutionV1,
  row: ImplementationExecutionBoardTaskRowV1,
): TaskRowCursorProgressView {
  const devLabel = row.developerStatus === "in_progress" ? "개발 진행 중" : "개발 준비";
  const runHint = execution.cursorRunId ? ` · ${execution.cursorRunId.slice(-12)}` : "";

  switch (execution.status) {
    case "pending":
    case "prompt_ready":
      return {
        text: `${devLabel} · AI 개발자 실행 대기`,
        tone: "idle",
        isPolling: false,
        shortLabel: "실행 대기",
      };
    case "cursor_requested":
      return {
        text: `${devLabel} · Cursor 실행 요청됨 · 응답 대기${runHint}`,
        tone: "polling",
        isPolling: true,
        shortLabel: "요청됨",
      };
    case "cursor_running":
      return {
        text: `${devLabel} · Cloud Agent 폴링 중${runHint}`,
        tone: "polling",
        isPolling: true,
        shortLabel: "폴링 중",
      };
    case "cursor_completed":
      return {
        text: `${devLabel} · Cursor 완료 · GitHub 확인 대기`,
        tone: "verifying",
        isPolling: true,
        shortLabel: "GitHub 대기",
      };
    case "github_verifying":
      return {
        text: `${devLabel} · GitHub 결과 확인 중${runHint}`,
        tone: "verifying",
        isPolling: true,
        shortLabel: "GitHub 확인",
      };
    case "github_verified":
    case "review_pending":
    case "security_pending":
    case "scm_pending":
      return {
        text: `${devLabel} · GitHub 결과 확인됨`,
        tone: "done",
        isPolling: false,
        shortLabel: "확인됨",
      };
    case "cursor_failed":
    case "github_verify_failed":
      return {
        text: `${devLabel} · Cursor 실행 실패`,
        tone: "failed",
        isPolling: false,
        shortLabel: "실패",
      };
    default:
      return {
        text: `${devLabel} · ${execution.status}`,
        tone: "idle",
        isPolling: false,
        shortLabel: execution.status,
      };
  }
}

export function buildTaskRowCursorProgressView(input: {
  readonly row: ImplementationExecutionBoardTaskRowV1;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistoryV1?: readonly TaskCursorExecutionV1[] | null;
  readonly progressView?: CodeAgentExecutionProgressView | null;
}): TaskRowCursorProgressView | null {
  const taskCursor = resolveTaskCursorExecutionForRow({
    taskId: input.row.taskId,
    taskCursorExecutionV1: input.taskCursorExecutionV1,
    taskCursorExecutionHistoryV1: input.taskCursorExecutionHistoryV1,
  });
  if (taskCursor) {
    return taskRowProgressFromTaskCursorExecution(taskCursor, input.row);
  }

  const wip = input.codeAgentWipExecutionV1;
  if (!wip) return null;
  const selectedTaskId = wip.selectedTaskId?.trim();
  if (selectedTaskId && selectedTaskId !== input.row.taskId) return null;

  const progress =
    input.progressView ?? buildCodeAgentExecutionProgressView({ codeAgentWipExecutionV1: wip });
  const devLabel = input.row.developerStatus === "in_progress" ? "개발 진행 중" : "개발 준비";

  if (progress.status === "cursor_running" || progress.status === "cursor_requested") {
    return {
      text: `${devLabel} · Cursor 실행 중`,
      tone: "polling",
      isPolling: true,
      shortLabel: "실행 중",
    };
  }
  if (progress.status === "cursor_completed" && !progress.isStubResult) {
    return {
      text: `개발 완료 · 변경 ${progress.changedFileCount}개 · 테스트 ${progress.testStatusLabel}`,
      tone: "done",
      isPolling: false,
      shortLabel: "완료",
    };
  }
  if (progress.status === "draft_created" || progress.status === "cursor_request_ready" || progress.isStubResult) {
    return {
      text: `${devLabel} · WIP 초안 생성됨 · Cursor: 미실행`,
      tone: "idle",
      isPolling: false,
      shortLabel: "WIP 초안",
    };
  }
  if (progress.status === "cursor_failed") {
    return {
      text: `${devLabel} · Cursor 실행 실패`,
      tone: "failed",
      isPolling: false,
      shortLabel: "실패",
    };
  }
  if (progress.status === "developer_reviewing") {
    return {
      text: `${devLabel} · Cursor 결과 검토 중`,
      tone: "done",
      isPolling: false,
      shortLabel: "검토 중",
    };
  }
  return null;
}

export function formatTaskRowCodeAgentProgressLine(input: {
  readonly row: ImplementationExecutionBoardTaskRowV1;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistoryV1?: readonly TaskCursorExecutionV1[] | null;
  readonly progressView?: CodeAgentExecutionProgressView | null;
}): string | null {
  return buildTaskRowCursorProgressView(input)?.text ?? null;
}

export function shouldHideBoardPrimaryCtaForProgress(
  status: CodeAgentExecutionProgressStatus,
  autoGateInFlight?: boolean,
): boolean {
  return (
    status === "cursor_requested" ||
    status === "cursor_running" ||
    autoGateInFlight === true
  );
}
