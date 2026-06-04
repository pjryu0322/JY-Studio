import { buildCursorSourceGenerationPrompt } from "@/lib/prototype/cursorBridgeExecution";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ProjectTargetRepository } from "@/lib/prototype/projectTargetRepository";
import {
  defaultForbiddenTargetPathGlobs,
  validateTargetRepositoryChangedFiles,
} from "@/lib/prototype/targetRepositoryPathGuard";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export const TASK_CURSOR_EXECUTION_VERSION = "task_cursor_execution_v1" as const;

export const AI_DEVELOPER_EXECUTION_REQUEST_CHIP = "AI 개발자 실행 요청" as const;
export const VERIFY_TASK_CURSOR_GITHUB_CHIP = "GitHub 결과 확인" as const;

export type TaskCursorExecutionStatus =
  | "pending"
  | "prompt_ready"
  | "cursor_requested"
  | "cursor_running"
  | "cursor_completed"
  | "status_check_stopped"
  | "cursor_failed"
  | "github_verifying"
  | "github_verified"
  | "github_verify_failed"
  | "review_pending"
  | "security_pending"
  | "scm_pending";

export type TaskCursorFailureReason =
  | "cursor_endpoint_unsupported"
  | "cursor_auth_failed"
  | "github_auth_failed"
  | "commit_not_created"
  | "push_failed"
  | "no_changed_files"
  | "github_verify_failed"
  | "poll_cancelled"
  | "work_item_preflight_failed"
  | "prompt_preflight_failed"
  | "poll_timeout"
  | "unknown";

export type TaskCursorExecutionV1 = Readonly<{
  readonly version: typeof TASK_CURSOR_EXECUTION_VERSION;
  readonly projectId: string;
  readonly taskId: string;
  readonly workItemIds: readonly string[];
  readonly status: TaskCursorExecutionStatus;
  readonly cursorProvider: "cursor";
  readonly targetRepository: string;
  readonly baseBranch: string;
  readonly workBranch: string;
  readonly cursorPrompt?: string;
  readonly cursorRunId?: string;
  readonly commitSha?: string;
  readonly changedFiles?: readonly string[];
  readonly diffSummary?: readonly string[];
  readonly testResults?: readonly string[];
  readonly pushed?: boolean;
  readonly failureReason?: TaskCursorFailureReason;
  readonly errorMessage?: string;
  readonly cursorAgentStatus?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}>;

export type TaskCursorTimelineAction =
  | "task_cursor_execution_requested"
  | "task_cursor_prompt_built"
  | "task_cursor_api_requested"
  | "task_cursor_api_started"
  | "task_cursor_api_completed"
  | "task_cursor_api_failed"
  | "task_cursor_github_verify_requested"
  | "task_cursor_github_verified"
  | "task_cursor_github_verify_failed";

export const TASK_CURSOR_FAILURE_MESSAGES: Readonly<Record<TaskCursorFailureReason, string>> = {
  cursor_endpoint_unsupported:
    "현재 등록된 Cursor API URL은 Task 단위 소스 생성 endpoint를 지원하지 않습니다.",
  cursor_auth_failed: "Cursor API 인증에 실패했습니다.",
  github_auth_failed: "프로젝트 GitHub Token 인증에 실패했습니다.",
  commit_not_created: "Cursor 실행 결과 commitSha를 확인하지 못했습니다.",
  push_failed: "Cursor가 WIP branch push에 실패했습니다. GitHub remote에 WIP branch commit이 있어야 검수를 통과할 수 있습니다.",
  no_changed_files: "Cursor 실행 결과 changedFiles를 확인하지 못했습니다.",
  github_verify_failed:
    "Cursor 응답은 받았지만 GitHub WIP branch에서 commit을 확인하지 못했습니다. WIP branch push 여부를 확인해 주세요.",
  poll_cancelled: "사용자가 Cloud Agent 상태 확인을 중단했습니다.",
  work_item_preflight_failed:
    "WorkItem 품질 검증에 실패했습니다. 실행 로그에서 보완 항목을 확인한 뒤 WorkItem을 수정해 주세요.",
  prompt_preflight_failed:
    "Cursor Prompt Preflight에 실패했습니다. 실행 로그에서 누락 항목을 확인해 주세요.",
  poll_timeout: "Cloud Agent 폴링 시간 초과입니다. Cursor 대시보드에서 Agent 상태를 확인해 주세요.",
  unknown: "Task Cursor 실행에 실패했습니다.",
};

export const TASK_CURSOR_POLL_CANCELLED_MESSAGE =
  TASK_CURSOR_FAILURE_MESSAGES.poll_cancelled;

export const TASK_CURSOR_POLLING_CANCEL_HINT =
  "Cloud Agent 작업 자체를 취소하는 것이 아니라 플랫폼의 상태 확인만 중단합니다." as const;

export const TASK_CURSOR_STATUS_CHECK_RESUME_HINT =
  "Cloud Agent 작업은 계속 진행 중일 수 있습니다. 상단 툴바에서 빠른 실행을 다시 시도해 주세요." as const;

const TASK_CURSOR_STATUSES = new Set<TaskCursorExecutionStatus>([
  "pending",
  "prompt_ready",
  "cursor_requested",
  "cursor_running",
  "cursor_completed",
  "status_check_stopped",
  "cursor_failed",
  "github_verifying",
  "github_verified",
  "github_verify_failed",
  "review_pending",
  "security_pending",
  "scm_pending",
]);

const TASK_CURSOR_FAILURE_REASONS = new Set<TaskCursorFailureReason>([
  "cursor_endpoint_unsupported",
  "cursor_auth_failed",
  "github_auth_failed",
  "commit_not_created",
  "push_failed",
  "no_changed_files",
  "github_verify_failed",
  "poll_cancelled",
  "work_item_preflight_failed",
  "prompt_preflight_failed",
  "poll_timeout",
  "unknown",
]);

function isStubSha(sha: string | undefined): boolean {
  const v = String(sha ?? "").trim();
  return !v || v.startsWith("wip-stub");
}

export function buildTaskCursorWorkBranch(taskId: string): string {
  const slug = taskId
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `wip/cursor/${slug || "task"}`;
}

/** CodeTask 단위 work branch (실행·PR 추적 기준) */
export function buildCodeTaskWorkBranch(codeTaskId: string): string {
  return buildTaskCursorWorkBranch(codeTaskId);
}

export function buildTaskCursorRunId(nowIso?: string): string {
  const stamp = (nowIso ?? new Date().toISOString()).replace(/[:.]/g, "");
  return `task-cursor-${stamp}`;
}

/** Cursor Cloud Agent API agent id (`bc-<uuid>`). */
export function isCursorCloudAgentRunId(runId: string | null | undefined): boolean {
  return /^bc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(runId ?? "").trim(),
  );
}

export function buildInitialTaskCursorExecution(input: {
  readonly projectId: string;
  readonly taskId: string;
  readonly workItemIds: readonly string[];
  readonly targetRepository: string;
  readonly baseBranch: string;
  readonly workBranch?: string;
  readonly nowIso?: string;
}): TaskCursorExecutionV1 {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    version: TASK_CURSOR_EXECUTION_VERSION,
    projectId: input.projectId,
    taskId: input.taskId,
    workItemIds: [...input.workItemIds],
    status: "pending",
    cursorProvider: "cursor",
    targetRepository: input.targetRepository,
    baseBranch: input.baseBranch,
    workBranch: input.workBranch ?? buildTaskCursorWorkBranch(input.taskId),
    createdAt: now,
    updatedAt: now,
  };
}

export function parseTaskCursorExecutionV1(raw: unknown): TaskCursorExecutionV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== TASK_CURSOR_EXECUTION_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  const taskId = String(o.taskId ?? "").trim();
  if (!projectId || !taskId) return null;
  const statusRaw = String(o.status ?? "pending").trim();
  const status = TASK_CURSOR_STATUSES.has(statusRaw as TaskCursorExecutionStatus)
    ? (statusRaw as TaskCursorExecutionStatus)
    : "pending";
  const failureRaw = o.failureReason === undefined ? undefined : String(o.failureReason).trim();
  const failureReason =
    failureRaw && TASK_CURSOR_FAILURE_REASONS.has(failureRaw as TaskCursorFailureReason)
      ? (failureRaw as TaskCursorFailureReason)
      : undefined;
  const workItemIds = Array.isArray(o.workItemIds)
    ? o.workItemIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const changedFiles = Array.isArray(o.changedFiles)
    ? o.changedFiles.map((f) => String(f).trim()).filter(Boolean)
    : undefined;
  return {
    version: TASK_CURSOR_EXECUTION_VERSION,
    projectId,
    taskId,
    workItemIds,
    status,
    cursorProvider: "cursor",
    targetRepository: String(o.targetRepository ?? "").trim(),
    baseBranch: String(o.baseBranch ?? "main").trim() || "main",
    workBranch: String(o.workBranch ?? buildTaskCursorWorkBranch(taskId)).trim(),
    cursorPrompt: o.cursorPrompt === undefined ? undefined : String(o.cursorPrompt),
    cursorRunId: o.cursorRunId === undefined ? undefined : String(o.cursorRunId).trim() || undefined,
    commitSha: o.commitSha === undefined ? undefined : String(o.commitSha).trim() || undefined,
    ...(changedFiles?.length ? { changedFiles } : {}),
    diffSummary: Array.isArray(o.diffSummary)
      ? o.diffSummary.map((d) => String(d).trim()).filter(Boolean)
      : undefined,
    testResults: Array.isArray(o.testResults)
      ? o.testResults.map((t) => String(t).trim()).filter(Boolean)
      : undefined,
    pushed: o.pushed === true ? true : o.pushed === false ? false : undefined,
    failureReason,
    errorMessage: o.errorMessage === undefined ? undefined : String(o.errorMessage),
    cursorAgentStatus:
      o.cursorAgentStatus === undefined ? undefined : String(o.cursorAgentStatus).trim() || undefined,
    createdAt: String(o.createdAt ?? new Date().toISOString()),
    updatedAt: String(o.updatedAt ?? new Date().toISOString()),
  };
}

export function parseTaskCursorExecutionHistoryV1(
  raw: unknown,
): readonly TaskCursorExecutionV1[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!Array.isArray(raw)) return null;
  return raw
    .map((entry) => parseTaskCursorExecutionV1(entry))
    .filter((entry): entry is TaskCursorExecutionV1 => entry != null);
}

export function appendTaskCursorExecutionHistory(
  history: readonly TaskCursorExecutionV1[] | null | undefined,
  entry: TaskCursorExecutionV1,
): readonly TaskCursorExecutionV1[] {
  const base = history ? [...history] : [];
  base.push(entry);
  return base.slice(-20);
}

export function buildTaskCursorPrompt(input: {
  readonly taskId: string;
  readonly workBranch: string;
  readonly workItems: readonly CursorWorkItem[];
  readonly targetRepository: ProjectTargetRepository;
  readonly commitMessage: string;
  readonly allowedPathGlobs: readonly string[];
}): string {
  return buildCursorSourceGenerationPrompt({
    selectedTaskId: input.taskId,
    workBranch: input.workBranch,
    workItems: input.workItems,
    targetRepository: input.targetRepository,
    commitMessage: input.commitMessage,
    allowedPathGlobs: input.allowedPathGlobs,
  });
}

export type TaskCursorNoCodeChangeEvidence = Readonly<{
  readonly noCodeChange: true;
  readonly reason: string;
  readonly inspectedFiles: readonly string[];
  readonly validationSummary: string;
}>;

export type TaskCursorExecuteApiResult = Readonly<{
  readonly ok: boolean;
  readonly status: "completed" | "failed" | "blocked";
  readonly taskId: string;
  readonly branchName?: string;
  readonly commitSha?: string;
  readonly pushed?: boolean;
  readonly changedFiles?: readonly string[];
  readonly diffSummary?: readonly string[];
  readonly testResults?: readonly string[];
  readonly noCodeChangeEvidence?: TaskCursorNoCodeChangeEvidence;
  readonly reason?: TaskCursorFailureReason;
  readonly message?: string;
}>;

export function validateTaskCursorExecuteApiResult(
  result: TaskCursorExecuteApiResult,
  options?: Readonly<{
    readonly allowEmptyChangedFilesWithCommit?: boolean;
    readonly deferCommitDiscoveryToGithub?: boolean;
  }>,
): TaskCursorExecuteApiResult {
  if (!result.ok || result.status !== "completed") {
    return result;
  }

  const noCodeChange = result.noCodeChangeEvidence;
  if (noCodeChange?.noCodeChange) {
    if (
      noCodeChange.inspectedFiles.length > 0 &&
      String(noCodeChange.validationSummary ?? "").trim()
    ) {
      return result;
    }
    return {
      ...result,
      ok: false,
      status: "failed",
      reason: "no_changed_files",
      message: TASK_CURSOR_FAILURE_MESSAGES.no_changed_files,
    };
  }

  if (
    !result.commitSha &&
    !result.changedFiles?.length &&
    result.diffSummary?.length
  ) {
    return {
      ...result,
      ok: false,
      status: "failed",
      reason: "commit_not_created",
      message: TASK_CURSOR_FAILURE_MESSAGES.commit_not_created,
    };
  }

  if (options?.deferCommitDiscoveryToGithub) {
    return result;
  }
  if (isStubSha(result.commitSha)) {
    return {
      ...result,
      ok: false,
      status: "failed",
      reason: "commit_not_created",
      message: TASK_CURSOR_FAILURE_MESSAGES.commit_not_created,
    };
  }
  if (!result.changedFiles?.length) {
    if (options?.allowEmptyChangedFilesWithCommit && result.commitSha && !isStubSha(result.commitSha)) {
      // Cloud Agent는 changedFiles를 비울 수 있음 — GitHub verify에서 확인
    } else {
      return {
        ...result,
        ok: false,
        status: "failed",
        reason: "no_changed_files",
        message: TASK_CURSOR_FAILURE_MESSAGES.no_changed_files,
      };
    }
  }
  if (result.pushed !== true) {
    return {
      ...result,
      ok: false,
      status: "failed",
      reason: "push_failed",
      message: TASK_CURSOR_FAILURE_MESSAGES.push_failed,
    };
  }
  return result;
}

export function mapTaskCursorApiFailureReason(input: {
  readonly httpStatus?: number;
  readonly status?: string;
  readonly message?: string;
}): TaskCursorFailureReason {
  const message = String(input.message ?? "").toLowerCase();
  if (input.httpStatus === 401 || input.httpStatus === 403 || message.includes("auth")) {
    return message.includes("github") ? "github_auth_failed" : "cursor_auth_failed";
  }
  if (
    input.httpStatus === 404 ||
    input.httpStatus === 405 ||
    input.httpStatus === 501 ||
    input.status === "unsupported"
  ) {
    return "cursor_endpoint_unsupported";
  }
  if (message.includes("push")) return "push_failed";
  if (message.includes("commit")) return "commit_not_created";
  if (message.includes("changedfiles") || message.includes("changed files")) return "no_changed_files";
  return "unknown";
}

export function buildTaskCursorTimelineEntry(input: {
  readonly action: TaskCursorTimelineAction;
  readonly projectId: string;
  readonly taskId: string;
  readonly status: string;
  readonly targetRepository?: string;
  readonly baseBranch?: string;
  readonly workBranch?: string;
  readonly commitSha?: string;
  readonly workItemCount?: number;
  readonly changedFileCount?: number;
  readonly reason?: string;
  readonly runId?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const now = input.nowIso ?? new Date().toISOString();
  const fields = [
    `type=${input.action}`,
    `projectId=${input.projectId}`,
    `taskId=${input.taskId}`,
    `status=${input.status}`,
    ...(input.targetRepository ? [`targetRepository=${input.targetRepository}`] : []),
    ...(input.baseBranch ? [`baseBranch=${input.baseBranch}`] : []),
    ...(input.workBranch ? [`workBranch=${input.workBranch}`] : []),
    ...(input.commitSha ? [`commitSha=${input.commitSha}`] : []),
    ...(input.workItemCount != null ? [`workItemCount=${input.workItemCount}`] : []),
    ...(input.changedFileCount != null ? [`changedFileCount=${input.changedFileCount}`] : []),
    ...(input.reason ? [`reason=${input.reason}`] : []),
    ...(input.runId ? [`runId=${input.runId}`] : []),
  ];
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: "platform",
    routingDecision: input.taskId,
    responseText: fields.join(" "),
    createdAt: now,
    orchestrationTraceGroup: "task_cursor_execution",
  };
}

export function patchTaskCursorExecution(
  current: TaskCursorExecutionV1,
  patch: Partial<
    Omit<TaskCursorExecutionV1, "version" | "projectId" | "taskId" | "createdAt">
  > & { readonly nowIso?: string },
): TaskCursorExecutionV1 {
  const now = patch.nowIso ?? new Date().toISOString();
  const { nowIso: _nowIso, ...rest } = patch;
  return {
    ...current,
    ...rest,
    ...(patch.workItemIds ? { workItemIds: [...patch.workItemIds] } : {}),
    ...(patch.changedFiles ? { changedFiles: [...patch.changedFiles] } : {}),
    ...(patch.diffSummary ? { diffSummary: [...patch.diffSummary] } : {}),
    ...(patch.testResults ? { testResults: [...patch.testResults] } : {}),
    updatedAt: now,
  };
}

export function validateTaskCursorChangedFiles(input: {
  readonly changedFiles: readonly string[];
  readonly targetRepository: ProjectTargetRepository;
  readonly allowedPathGlobs: readonly string[];
}): Readonly<{ readonly ok: true } | Readonly<{ readonly ok: false; readonly message: string }>> {
  const validation = validateTargetRepositoryChangedFiles({
    changedFiles: input.changedFiles,
    targetRepository: input.targetRepository,
    allowedPathGlobs: input.allowedPathGlobs,
    forbiddenPathGlobs: defaultForbiddenTargetPathGlobs(),
  });
  if (!validation.ok) {
    return { ok: false, message: validation.message };
  }
  return { ok: true };
}

export function isTaskCursorExecutionActive(
  execution: TaskCursorExecutionV1 | null | undefined,
): boolean {
  if (!execution) return false;
  return !["github_verified", "review_pending", "security_pending", "scm_pending"].includes(
    execution.status,
  );
}

export function isTaskCursorExecutionFailed(
  execution: TaskCursorExecutionV1 | null | undefined,
): boolean {
  return execution?.status === "cursor_failed" || execution?.status === "github_verify_failed";
}
