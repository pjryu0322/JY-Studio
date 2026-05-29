import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import {
  isRealCursorSourceGenerationCompleted,
  isStubCodeAgentWipExecution,
  REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
} from "@/lib/prototype/codeAgentWipExecution";
import type {
  ImplementationExecutionBoardTaskRowV1,
  ImplementationExecutionBoardV1,
} from "@/lib/prototype/implementationExecutionBoard";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type CodeAgentExecutionProgressStatus =
  | "idle"
  | "draft_created"
  | "cursor_request_ready"
  | "cursor_requested"
  | "cursor_running"
  | "cursor_completed"
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
  readonly steps: readonly CodeAgentExecutionProgressStep[];
  readonly recentEvents: readonly CodeAgentExecutionProgressEvent[];
}>;

const RELEVANT_TIMELINE_ACTIONS = new Set([
  "implementation_stage_action_routed",
  "implementation_stage_action_executed",
  "implementation_stage_action_blocked",
  "code_agent_wip_requested",
  "code_agent_wip_draft_created",
  "cursor_api_direct_execution_requested",
  "cursor_api_direct_execution_completed",
  "cursor_api_direct_execution_failed",
  "cursor_api_direct_execution_unsupported",
  "cursor_api_availability_checked",
]);

const TIMELINE_ACTION_LABELS: Record<string, string> = {
  implementation_stage_action_routed: "구현 액션 라우팅",
  implementation_stage_action_executed: "구현 액션 실행",
  implementation_stage_action_blocked: "구현 액션 차단",
  code_agent_wip_requested: "Code Agent WIP 요청",
  code_agent_wip_draft_created: "WIP 초안 생성",
  cursor_api_direct_execution_requested: "Cursor API 요청",
  cursor_api_direct_execution_completed: "Cursor API 완료",
  cursor_api_direct_execution_failed: "Cursor API 실패",
  cursor_api_direct_execution_unsupported: "Cursor API 미지원",
  cursor_api_availability_checked: "Cursor API 환경 점검",
};

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

function formatCommitShaDisplay(sha: string | undefined): string | undefined {
  const raw = sha?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("wip-stub")) return `${raw.slice(0, 12)}… (stub)`;
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

function resolveProgressStatus(wip: CodeAgentWipExecutionV1 | null | undefined): CodeAgentExecutionProgressStatus {
  if (!wip) return "idle";
  if (wip.status === "developer_approved") return "developer_approved";
  if (wip.status === "developer_reviewing" && isRealCursorSourceGenerationCompleted(wip)) {
    return "developer_reviewing";
  }
  const bridge = wip.bridgeExecutionStatus;
  if (bridge === "failed" || wip.executionStatus === "cursor_api_failed") return "cursor_failed";
  if (bridge === "bridge_running") return "cursor_running";
  if (bridge === "bridge_requested") return "cursor_requested";
  if (bridge === "bridge_completed") {
    return isRealCursorSourceGenerationCompleted(wip) ? "cursor_completed" : "draft_created";
  }
  if (bridge === "draft_approved") return "cursor_request_ready";
  if (bridge === "draft_created" || isStubCodeAgentWipExecution(wip)) return "draft_created";
  return "idle";
}

function statusLabelFor(status: CodeAgentExecutionProgressStatus): string {
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
    return "생성요청은 WIP 초안 생성 단계입니다. 실제 소스 생성을 진행하려면 Cursor 실행 요청을 선택하세요.";
  }
  if (status === "cursor_requested" || status === "cursor_running") {
    return "Cursor API 실행 결과를 기다리는 중입니다.";
  }
  if (status === "cursor_completed") {
    return "Cursor API 실행이 완료되었습니다. 변경사항을 확인한 뒤 구현 결과 승인 또는 재작업을 선택하세요.";
  }
  if (status === "cursor_failed") {
    return wip?.bridgeErrorMessage?.trim() || "Cursor API 실행에 실패했습니다.";
  }
  if (status === "developer_reviewing") {
    return "Cursor 결과를 AI 개발자가 검토 중입니다.";
  }
  return "Code Agent WIP 작업이 승인되었습니다.";
}

function nextActionLabelFor(status: CodeAgentExecutionProgressStatus): string | undefined {
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
  const pushed = wip?.pushed === true;
  const reviewed = status === "developer_reviewing" || status === "developer_approved";

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
      "git_push",
      "Git 커밋/푸시",
      pushed ? "done" : sourceReceived ? "pending" : "pending",
    ),
    step(
      "developer_review",
      "개발자 승인/검수",
      reviewed ? "done" : sourceReceived ? "pending" : "pending",
    ),
  ];
}

export function buildCodeAgentExecutionProgressView(input: {
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly board?: ImplementationExecutionBoardV1 | null;
  readonly latestTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
}): CodeAgentExecutionProgressView {
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

  return {
    status,
    statusLabel: statusLabelFor(status),
    summaryLine: summaryLineFor(status, wip),
    selectedTaskId,
    selectedTaskTitle: resolveSelectedTaskTitle(input.board ?? null, selectedTaskId),
    cursorApiLabel: cursorApiLabelFor(status, wip),
    branchName: wip?.branchName || latestCommit?.branchName,
    commitSha: rawSha,
    commitShaDisplay: isStubResult ? undefined : formatCommitShaDisplay(rawSha),
    changedFileCount: latestCommit?.changedFiles.length ?? 0,
    testStatus,
    testStatusLabel,
    runId,
    failureReason: status === "cursor_failed" ? wip?.bridgeErrorMessage?.trim() : undefined,
    nextActionLabel: nextActionLabelFor(status),
    showGenerationClarification: status === "draft_created" || status === "cursor_request_ready",
    isStubResult,
    steps: buildProgressSteps(status, wip),
    recentEvents,
  };
}

export function formatTaskRowCodeAgentProgressLine(input: {
  readonly row: ImplementationExecutionBoardTaskRowV1;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly progressView?: CodeAgentExecutionProgressView | null;
}): string | null {
  const wip = input.codeAgentWipExecutionV1;
  if (!wip) return null;
  const selectedTaskId = wip.selectedTaskId?.trim();
  if (selectedTaskId && selectedTaskId !== input.row.taskId) return null;

  const progress = input.progressView ?? buildCodeAgentExecutionProgressView({ codeAgentWipExecutionV1: wip });
  const devLabel = input.row.developerStatus === "in_progress" ? "개발 진행 중" : "개발 준비";

  if (progress.status === "cursor_running" || progress.status === "cursor_requested") {
    return `${devLabel} · Cursor 실행 중`;
  }
  if (progress.status === "cursor_completed" && !progress.isStubResult) {
    return `개발 완료 · 변경 ${progress.changedFileCount}개 · 테스트 ${progress.testStatusLabel}`;
  }
  if (progress.status === "draft_created" || progress.status === "cursor_request_ready" || progress.isStubResult) {
    return `${devLabel} · WIP 초안 생성됨 · Cursor: 미실행`;
  }
  if (progress.status === "cursor_failed") {
    return `${devLabel} · Cursor 실행 실패`;
  }
  if (progress.status === "developer_reviewing") {
    return `${devLabel} · Cursor 결과 검토 중`;
  }
  return null;
}

export function shouldHideBoardPrimaryCtaForProgress(status: CodeAgentExecutionProgressStatus): boolean {
  return status === "cursor_requested" || status === "cursor_running";
}
