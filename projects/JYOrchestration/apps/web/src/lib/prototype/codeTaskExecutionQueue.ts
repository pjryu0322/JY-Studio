import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  isQueueContinueAfterRunStatus,
  isQueueIssueRunStatus,
  isTerminalCodeTaskExecutionRunStatus,
} from "@/lib/prototype/codeTaskExecutionRunStatus";
import type { CodeTaskExecutionRunStatus, CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

export const CODE_TASK_EXECUTION_QUEUE_VERSION = "code_task_execution_queue_v1" as const;

export type CodeTaskExecutionQueueStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "completed_with_issues"
  | "failed";

export type CodeTaskExecutionQueueV1 = Readonly<{
  version: typeof CODE_TASK_EXECUTION_QUEUE_VERSION;
  projectId: string;
  selectedCodeTaskIds: readonly string[];
  currentIndex: number;
  status: CodeTaskExecutionQueueStatus;
  stopOnFailure?: boolean;
  createdAt: string;
  updatedAt: string;
}>;

const QUEUE_STATUSES = new Set<CodeTaskExecutionQueueStatus>([
  "idle",
  "running",
  "paused",
  "completed",
  "completed_with_issues",
  "failed",
]);

export function parseCodeTaskExecutionQueueV1(raw: unknown): CodeTaskExecutionQueueV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== CODE_TASK_EXECUTION_QUEUE_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  const status = String(o.status ?? "").trim() as CodeTaskExecutionQueueStatus;
  const createdAt = String(o.createdAt ?? "").trim();
  const updatedAt = String(o.updatedAt ?? "").trim();
  const currentIndex = Number(o.currentIndex);
  if (!projectId || !QUEUE_STATUSES.has(status) || !createdAt || !updatedAt) return null;
  if (!Number.isFinite(currentIndex) || currentIndex < 0) return null;
  const selectedCodeTaskIds = Array.isArray(o.selectedCodeTaskIds)
    ? (o.selectedCodeTaskIds as unknown[]).map(String).map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    version: CODE_TASK_EXECUTION_QUEUE_VERSION,
    projectId,
    selectedCodeTaskIds,
    currentIndex,
    status,
    createdAt,
    updatedAt,
    ...(o.stopOnFailure === true ? { stopOnFailure: true } : {}),
  };
}

/** Process Task 선택 → 해당 하위 CodeTask ID 목록(플랜 순서) */
export function expandProcessTaskIdsToCodeTaskIds(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly processTaskIds: readonly string[];
}): readonly string[] {
  const parents = new Set(input.processTaskIds.map((id) => id.trim()).filter(Boolean));
  if (!parents.size) return [];
  return input.codeTaskPlan.tasks
    .filter((t) => parents.has(t.parentTaskId))
    .map((t) => t.codeTaskId);
}

export function resolveSelectedCodeTaskIdsForQueue(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null | undefined;
  readonly explicitCodeTaskIds?: readonly string[] | null;
  readonly processTaskIds?: readonly string[] | null;
}): readonly string[] {
  const explicit = (input.explicitCodeTaskIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  if (explicit.length) return [...new Set(explicit)];

  const plan = input.codeTaskPlan;
  if (plan && (input.processTaskIds?.length ?? 0) > 0) {
    const expanded = expandProcessTaskIdsToCodeTaskIds({
      codeTaskPlan: plan,
      processTaskIds: input.processTaskIds ?? [],
    });
    if (expanded.length) return expanded;
  }

  return [];
}

export function resolveQueueFinalStatusFromRunStatuses(
  statuses: readonly CodeTaskExecutionRunStatus[],
): Extract<CodeTaskExecutionQueueStatus, "completed" | "completed_with_issues"> {
  const hasIssue = statuses.some((status) => isQueueIssueRunStatus(status));
  return hasIssue ? "completed_with_issues" : "completed";
}

export function startCodeTaskExecutionQueue(input: {
  readonly projectId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly stopOnFailure?: boolean;
  readonly nowIso?: string;
}): CodeTaskExecutionQueueV1 | null {
  const ids = input.selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
  if (!ids.length) return null;
  const now = input.nowIso ?? new Date().toISOString();
  return {
    version: CODE_TASK_EXECUTION_QUEUE_VERSION,
    projectId: input.projectId.trim(),
    selectedCodeTaskIds: ids,
    currentIndex: 0,
    status: "running",
    createdAt: now,
    updatedAt: now,
    ...(input.stopOnFailure ? { stopOnFailure: true } : {}),
  };
}

export function getCurrentQueueCodeTaskId(
  queue: CodeTaskExecutionQueueV1 | null | undefined,
): string | null {
  if (!queue || queue.status !== "running") return null;
  return queue.selectedCodeTaskIds[queue.currentIndex] ?? null;
}

export type AdvanceCodeTaskExecutionQueueResult = Readonly<{
  readonly queue: CodeTaskExecutionQueueV1;
  readonly nextCodeTaskId: string | null;
  readonly finished: boolean;
}>;

export function advanceCodeTaskExecutionQueue(input: {
  readonly queue: CodeTaskExecutionQueueV1;
  readonly lastRunStatus: CodeTaskExecutionRunV1["status"];
  readonly processedRunStatuses?: readonly CodeTaskExecutionRunV1["status"];
  readonly nowIso?: string;
}): AdvanceCodeTaskExecutionQueueResult {
  const now = input.nowIso ?? new Date().toISOString();
  const { queue } = input;

  if (input.lastRunStatus === "failed" && queue.stopOnFailure) {
    return {
      queue: { ...queue, status: "failed", updatedAt: now },
      nextCodeTaskId: null,
      finished: true,
    };
  }

  if (!isQueueContinueAfterRunStatus(input.lastRunStatus)) {
    return { queue, nextCodeTaskId: getCurrentQueueCodeTaskId(queue), finished: false };
  }

  const nextIndex = queue.currentIndex + 1;
  if (nextIndex >= queue.selectedCodeTaskIds.length) {
    const statuses =
      input.processedRunStatuses?.length
        ? input.processedRunStatuses
        : [input.lastRunStatus];
    const finalStatus = resolveQueueFinalStatusFromRunStatuses(statuses);
    return {
      queue: { ...queue, currentIndex: nextIndex, status: finalStatus, updatedAt: now },
      nextCodeTaskId: null,
      finished: true,
    };
  }

  return {
    queue: { ...queue, currentIndex: nextIndex, status: "running", updatedAt: now },
    nextCodeTaskId: queue.selectedCodeTaskIds[nextIndex] ?? null,
    finished: false,
  };
}

export function shouldAdvanceQueueAfterRun(
  run: CodeTaskExecutionRunV1 | null | undefined,
): boolean {
  return Boolean(run && isTerminalCodeTaskExecutionRunStatus(run.status));
}
