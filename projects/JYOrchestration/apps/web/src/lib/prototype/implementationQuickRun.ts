import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import { isInFlightTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
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
    ...(typeof o.blockedReason === "string" && o.blockedReason.trim()
      ? { blockedReason: o.blockedReason.trim() }
      : {}),
    ...(typeof o.previewUrl === "string" && o.previewUrl.trim() ? { previewUrl: o.previewUrl.trim() } : {}),
  };
}

export function buildImplementationQuickRunStartedPatch(input: {
  readonly projectId: string;
  readonly currentTaskId?: string | null;
  readonly nowIso?: string;
}): ImplementationQuickRunV1 {
  const nowIso = input.nowIso ?? new Date().toISOString();
  return {
    version: "implementation_quick_run_v1",
    projectId: input.projectId,
    status: "running",
    startedAt: nowIso,
    updatedAt: nowIso,
    ...(input.currentTaskId?.trim() ? { currentTaskId: input.currentTaskId.trim() } : {}),
    completedTaskIds: [],
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
    return "blocked";
  }
  if (input.quickRun?.status === "preview_ready") return "preview_ready";
  if (input.quickRun?.status === "failed" || input.quickRun?.status === "blocked") {
    if (execution && isInFlightTaskCursorExecution(execution)) return "running";
    return input.quickRun.status;
  }
  if (input.quickRun?.status === "running") return "running";
  if (execution && isInFlightTaskCursorExecution(execution)) return "running";
  if (isPostCursorPipelineExecution(execution)) return "running";
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
