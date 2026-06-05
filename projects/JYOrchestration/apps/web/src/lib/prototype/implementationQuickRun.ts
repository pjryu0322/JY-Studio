import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { isInFlightTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import {
  canContinueTaskCursorAutoChainAfterFailure,
  resolveTaskCursorFailurePolicyFromExecution,
} from "@/lib/prototype/taskCursorFailurePolicy";
import {
  isTaskCursorExecutionFailed,
  type TaskCursorExecutionStatus,
  type TaskCursorExecutionV1,
} from "@/lib/prototype/taskCursorExecution";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ImplementationQuickRunStatus =
  | "idle"
  | "running"
  | "paused"
  | "blocked"
  | "preview_ready"
  | "failed";

export type ImplementationQuickRunV1 = Readonly<{
  readonly version: "implementation_quick_run_v1";
  readonly projectId: string;
  readonly status: ImplementationQuickRunStatus;
  readonly startedAt?: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly currentTaskId?: string;
  readonly completedTaskIds?: readonly string[];
  readonly selectedTaskIds?: readonly string[];
  readonly blockedReason?: string;
  readonly previewUrl?: string;
}>;

const POST_CURSOR_PIPELINE_STATUSES = new Set<TaskCursorExecutionStatus>([
  "github_verified",
  "review_pending",
  "security_pending",
  "scm_pending",
]);

const QUICK_RUN_STATUSES = new Set<ImplementationQuickRunStatus>([
  "idle",
  "running",
  "paused",
  "blocked",
  "preview_ready",
  "failed",
]);

export function parseImplementationQuickRunV1(raw: unknown): ImplementationQuickRunV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== "implementation_quick_run_v1") return null;
  const projectId = String(o.projectId ?? "").trim();
  const status = String(o.status ?? "").trim() as ImplementationQuickRunStatus;
  const updatedAt = String(o.updatedAt ?? "").trim();
  if (!projectId || !QUICK_RUN_STATUSES.has(status) || !updatedAt) return null;
  const completedTaskIds = Array.isArray(o.completedTaskIds)
    ? o.completedTaskIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : undefined;
  const selectedTaskIds = Array.isArray(o.selectedTaskIds)
    ? o.selectedTaskIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : undefined;
  return {
    version: "implementation_quick_run_v1",
    projectId,
    status,
    updatedAt,
    ...(typeof o.startedAt === "string" && o.startedAt.trim() ? { startedAt: o.startedAt.trim() } : {}),
    ...(typeof o.completedAt === "string" && o.completedAt.trim() ? { completedAt: o.completedAt.trim() } : {}),
    ...(typeof o.currentTaskId === "string" && o.currentTaskId.trim()
      ? { currentTaskId: o.currentTaskId.trim() }
      : {}),
    ...(completedTaskIds?.length ? { completedTaskIds } : {}),
    ...(selectedTaskIds?.length ? { selectedTaskIds } : {}),
    ...(typeof o.blockedReason === "string" && o.blockedReason.trim()
      ? { blockedReason: o.blockedReason.trim() }
      : {}),
    ...(typeof o.previewUrl === "string" && o.previewUrl.trim() ? { previewUrl: o.previewUrl.trim() } : {}),
  };
}

export function buildImplementationQuickRunStartedPatch(input: {
  readonly projectId: string;
  readonly currentTaskId?: string | null;
  readonly selectedTaskIds?: readonly string[] | null;
  readonly nowIso?: string;
}): ImplementationQuickRunV1 {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const selectedTaskIds = (input.selectedTaskIds ?? [])
    .map((taskId) => String(taskId ?? "").trim())
    .filter(Boolean);
  return {
    version: "implementation_quick_run_v1",
    projectId: input.projectId,
    status: "running",
    startedAt: nowIso,
    updatedAt: nowIso,
    ...(input.currentTaskId?.trim() ? { currentTaskId: input.currentTaskId.trim() } : {}),
    ...(selectedTaskIds.length ? { selectedTaskIds } : {}),
    completedTaskIds: [],
  };
}

export function resolveQuickRunAllowedTaskIds(
  quickRun?: ImplementationQuickRunV1 | null,
): readonly string[] | null {
  const selectedTaskIds = quickRun?.selectedTaskIds;
  if (!selectedTaskIds?.length) return null;
  return selectedTaskIds;
}

export type ImplementationQuickRunCursorDispatchOutcome = "executed" | "blocked" | "no_op";

export function buildImplementationQuickRunCursorDispatchTimelineEntry(input: {
  readonly projectId: string;
  readonly taskId?: string | null;
  readonly outcome: ImplementationQuickRunCursorDispatchOutcome;
  readonly message?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const parts = [
    `projectId=${input.projectId}`,
    `outcome=${input.outcome}`,
    "linkedAction=REQUEST_TASK_CURSOR_EXECUTION",
  ];
  if (input.taskId?.trim()) parts.push(`taskId=${input.taskId.trim()}`);
  if (input.message?.trim()) parts.push(`message=${input.message.trim().replace(/\s+/g, " ").slice(0, 240)}`);
  return {
    stage: "implementation",
    action: "implementation_quick_run_cursor_dispatch",
    source: "platform",
    responseText: parts.join(" "),
    createdAt: nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationQuickRunTimelineEntry(input: {
  readonly action: "implementation_quick_run_started" | "implementation_quick_run_blocked" | "implementation_quick_run_preview_ready";
  readonly projectId: string;
  readonly taskId?: string | null;
  readonly reason?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const parts = [`projectId=${input.projectId}`];
  if (input.taskId?.trim()) parts.push(`taskId=${input.taskId.trim()}`);
  if (input.reason?.trim()) parts.push(`reason=${input.reason.trim()}`);
  return {
    stage: "implementation",
    action: input.action,
    source: "platform",
    responseText: parts.join(" "),
    createdAt: nowIso,
  };
}

function isPostCursorPipelineExecution(
  execution: TaskCursorExecutionV1 | null | undefined,
): execution is TaskCursorExecutionV1 {
  return Boolean(execution && POST_CURSOR_PIPELINE_STATUSES.has(execution.status));
}

export function deriveImplementationQuickRunStatus(input: {
  readonly quickRun?: ImplementationQuickRunV1 | null;
  readonly board?: ImplementationExecutionBoardV1 | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly previewReady?: boolean;
}): ImplementationQuickRunStatus {
  if (input.previewReady) return "preview_ready";
  const execution = input.taskCursorExecution ?? null;
  const autoGate = input.autoGate ?? null;
  if (isPostCursorPipelineExecution(execution)) return "running";
  if (
    autoGate?.status === "failed" &&
    execution &&
    autoGate.taskId === execution.taskId
  ) {
    return "failed";
  }
  if (
    execution &&
    (isTaskCursorExecutionFailed(execution) || execution.status === "github_verify_failed")
  ) {
    if (canContinueTaskCursorAutoChainAfterFailure(execution)) {
      return "running";
    }
    const policy = resolveTaskCursorFailurePolicyFromExecution(execution);
    if (policy?.shouldStopAll) return "blocked";
    return "blocked";
  }
  if (input.quickRun?.status === "preview_ready") return "preview_ready";
  if (input.quickRun?.status === "failed" || input.quickRun?.status === "blocked") {
    if (execution && isInFlightTaskCursorExecution(execution)) return "running";
    return input.quickRun.status;
  }
  if (input.quickRun?.status === "running") return "running";
  if (execution && isInFlightTaskCursorExecution(execution)) return "running";
  return input.quickRun?.status ?? "idle";
}

export function shouldAllowTaskCursorAutoChain(input: {
  readonly quickRun?: ImplementationQuickRunV1 | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly derivedStatus?: ImplementationQuickRunStatus;
}): boolean {
  const derived = input.derivedStatus ?? deriveImplementationQuickRunStatus(input);
  if (derived === "running") return true;
  const execution = input.taskCursorExecution ?? null;
  if (execution && isInFlightTaskCursorExecution(execution)) return true;
  if (isPostCursorPipelineExecution(execution)) return true;
  return false;
}

export function syncImplementationQuickRunWithExecution(input: {
  readonly quickRun: ImplementationQuickRunV1;
  readonly board?: ImplementationExecutionBoardV1 | null;
  readonly taskCursorExecution?: TaskCursorExecutionV1 | null;
  readonly autoGate?: ImplementationAutoQualityGateV1 | null;
  readonly previewReady?: boolean;
  readonly nowIso?: string;
}): ImplementationQuickRunV1 {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const derived = deriveImplementationQuickRunStatus(input);
  const execution = input.taskCursorExecution ?? null;
  const completedTaskIds = [...(input.quickRun.completedTaskIds ?? [])];
  if (
    execution?.status === "scm_pending" &&
    input.autoGate?.status === "passed" &&
    input.autoGate.taskId === execution.taskId &&
    !completedTaskIds.includes(execution.taskId)
  ) {
    completedTaskIds.push(execution.taskId);
  }
  return {
    ...input.quickRun,
    status: derived,
    updatedAt: nowIso,
    ...(execution?.taskId ? { currentTaskId: execution.taskId } : {}),
    ...(completedTaskIds.length ? { completedTaskIds } : {}),
    ...(derived === "preview_ready" ? { completedAt: nowIso } : {}),
    ...(derived === "blocked" || derived === "failed"
      ? {
          blockedReason:
            execution?.errorMessage ??
            input.autoGate?.failureReason ??
            input.quickRun.blockedReason,
        }
      : { blockedReason: undefined }),
  };
}

export function formatQuickRunContinuationReason(reason: string | null | undefined): string {
  const r = String(reason ?? "").trim();
  switch (r) {
    case "quick_run_not_running":
      return "Quick Run이 DB에 아직 반영되지 않았습니다. 자동 복구 후 재시도합니다.";
    case "no_queued_db_run":
      return "대기(queued) 상태의 Runtime Run이 없습니다.";
    case "dispatch_target_not_found":
      return "CodeTask에 연결된 WorkItem을 찾을 수 없습니다.";
    case "execution_setup_not_ready":
      return "실행 설정(Cursor 토큰·저장소)이 준비되지 않았습니다.";
    case "queue_state_mismatch":
      return "큐 상태가 일치하지 않습니다.";
    default:
      return r || "Quick Run 연속 실행을 처리하지 못했습니다.";
  }
}
