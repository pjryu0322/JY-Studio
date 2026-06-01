import type { ImplementationCodeTaskFailureCauseLayer } from "@/lib/prototype/implementationCodeTaskFailureDiagnosis";
import type { ImplementationCodeTaskFailureDiagnosisV1 } from "@/lib/prototype/implementationCodeTaskFailureDiagnosis";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { TaskCursorExecutionV1, TaskCursorFailureReason } from "@/lib/prototype/taskCursorExecution";

export const IMPLEMENTATION_CODE_TASK_EXECUTION_FEEDBACK_VERSION =
  "implementation_code_task_execution_feedback_v1" as const;

export type ImplementationCodeTaskExecutionFeedbackStatus =
  | "not_started"
  | "running"
  | "passed"
  | "failed"
  | "blocked";

export type ImplementationCodeTaskExecutionFeedbackEntryV1 = Readonly<{
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly status: ImplementationCodeTaskExecutionFeedbackStatus;
  readonly lastExecutionTaskId?: string;
  readonly lastCursorRunId?: string;
  readonly lastCommitSha?: string;
  readonly lastFailureReason?: string;
  readonly lastErrorMessage?: string;
  readonly lastCauseLayer?: ImplementationCodeTaskFailureCauseLayer;
  readonly lastDiagnosisMessage?: string;
  readonly workItemIds: readonly string[];
  readonly updatedAt: string;
}>;

export type ImplementationCodeTaskExecutionFeedbackV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_CODE_TASK_EXECUTION_FEEDBACK_VERSION;
  readonly projectId: string;
  readonly updatedAt: string;
  readonly feedbackByCodeTaskId: Readonly<Record<string, ImplementationCodeTaskExecutionFeedbackEntryV1>>;
}>;

function mapExecutionStatusToFeedbackStatus(
  execution: TaskCursorExecutionV1,
): ImplementationCodeTaskExecutionFeedbackStatus {
  switch (execution.status) {
    case "github_verified":
    case "review_pending":
    case "security_pending":
    case "scm_pending":
      return "passed";
    case "cursor_failed":
    case "github_verify_failed":
      return "failed";
    case "cursor_running":
    case "cursor_requested":
    case "github_verifying":
      return "running";
    default:
      return execution.status === "requested" || execution.status === "prompt_ready"
        ? "not_started"
        : "blocked";
  }
}

function resolveDiagnosisTargetCodeTaskIds(input: {
  readonly diagnosis?: ImplementationCodeTaskFailureDiagnosisV1 | null;
  readonly selectedWorkItems: readonly CursorWorkItem[];
}): readonly string[] | null {
  if (!input.diagnosis) return null;
  const affected = input.diagnosis.affectedCodeTaskIds.filter(Boolean);
  if (affected.length) return affected;
  return [
    ...new Set(
      input.selectedWorkItems
        .map((item) => String(item.codeTaskId ?? "").trim())
        .filter(Boolean),
    ),
  ];
}

export function updateImplementationCodeTaskExecutionFeedback(input: {
  readonly projectId: string;
  readonly existing?: ImplementationCodeTaskExecutionFeedbackV1 | null;
  readonly selectedWorkItems: readonly CursorWorkItem[];
  readonly execution: TaskCursorExecutionV1;
  readonly diagnosis?: ImplementationCodeTaskFailureDiagnosisV1 | null;
  readonly nowIso?: string;
}): ImplementationCodeTaskExecutionFeedbackV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const feedbackByCodeTaskId: Record<string, ImplementationCodeTaskExecutionFeedbackEntryV1> = {
    ...(input.existing?.feedbackByCodeTaskId ?? {}),
  };

  const status = mapExecutionStatusToFeedbackStatus(input.execution);
  const diagnosisTargetIds = resolveDiagnosisTargetCodeTaskIds({
    diagnosis: input.diagnosis,
    selectedWorkItems: input.selectedWorkItems,
  });
  const grouped = new Map<string, CursorWorkItem[]>();
  for (const workItem of input.selectedWorkItems) {
    const codeTaskId = String(workItem.codeTaskId ?? "").trim();
    if (!codeTaskId) continue;
    const bucket = grouped.get(codeTaskId) ?? [];
    bucket.push(workItem);
    grouped.set(codeTaskId, bucket);
  }

  for (const [codeTaskId, workItems] of grouped.entries()) {
    const parentTaskId = String(workItems[0]?.parentTaskId ?? input.execution.taskId).trim();
    const shouldApplyDiagnosis =
      status === "failed" &&
      input.diagnosis &&
      (!diagnosisTargetIds?.length || diagnosisTargetIds.includes(codeTaskId));
    feedbackByCodeTaskId[codeTaskId] = {
      codeTaskId,
      parentTaskId,
      status,
      lastExecutionTaskId: input.execution.taskId,
      ...(input.execution.cursorRunId ? { lastCursorRunId: input.execution.cursorRunId } : {}),
      ...(input.execution.commitSha ? { lastCommitSha: input.execution.commitSha } : {}),
      ...(input.execution.failureReason
        ? { lastFailureReason: input.execution.failureReason }
        : {}),
      ...(input.execution.errorMessage ? { lastErrorMessage: input.execution.errorMessage } : {}),
      ...(shouldApplyDiagnosis && input.diagnosis?.causeLayer
        ? { lastCauseLayer: input.diagnosis.causeLayer }
        : {}),
      ...(shouldApplyDiagnosis && input.diagnosis?.message
        ? { lastDiagnosisMessage: input.diagnosis.message }
        : {}),
      workItemIds: workItems.map((item) => item.id),
      updatedAt: now,
    };
  }

  return {
    version: IMPLEMENTATION_CODE_TASK_EXECUTION_FEEDBACK_VERSION,
    projectId: pid,
    updatedAt: now,
    feedbackByCodeTaskId,
  };
}

export function parseImplementationCodeTaskExecutionFeedbackV1(
  raw: unknown,
): ImplementationCodeTaskExecutionFeedbackV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== IMPLEMENTATION_CODE_TASK_EXECUTION_FEEDBACK_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  if (!projectId) return null;
  const feedbackRaw =
    o.feedbackByCodeTaskId && typeof o.feedbackByCodeTaskId === "object"
      ? (o.feedbackByCodeTaskId as Record<string, unknown>)
      : {};
  const feedbackByCodeTaskId: Record<string, ImplementationCodeTaskExecutionFeedbackEntryV1> = {};
  for (const [codeTaskId, value] of Object.entries(feedbackRaw)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    feedbackByCodeTaskId[codeTaskId] = {
      codeTaskId: String(row.codeTaskId ?? codeTaskId).trim(),
      parentTaskId: String(row.parentTaskId ?? "").trim(),
      status:
        row.status === "running" ||
        row.status === "passed" ||
        row.status === "failed" ||
        row.status === "blocked"
          ? row.status
          : "not_started",
      ...(typeof row.lastExecutionTaskId === "string"
        ? { lastExecutionTaskId: row.lastExecutionTaskId.trim() }
        : {}),
      ...(typeof row.lastCursorRunId === "string"
        ? { lastCursorRunId: row.lastCursorRunId.trim() }
        : {}),
      ...(typeof row.lastCommitSha === "string" ? { lastCommitSha: row.lastCommitSha.trim() } : {}),
      ...(typeof row.lastFailureReason === "string"
        ? { lastFailureReason: row.lastFailureReason.trim() }
        : {}),
      ...(typeof row.lastErrorMessage === "string"
        ? { lastErrorMessage: row.lastErrorMessage.trim() }
        : {}),
      ...(typeof row.lastCauseLayer === "string" && row.lastCauseLayer.trim()
        ? { lastCauseLayer: row.lastCauseLayer.trim() as ImplementationCodeTaskFailureCauseLayer }
        : {}),
      ...(typeof row.lastDiagnosisMessage === "string"
        ? { lastDiagnosisMessage: row.lastDiagnosisMessage.trim() }
        : {}),
      workItemIds: Array.isArray(row.workItemIds)
        ? row.workItemIds.map((item) => String(item ?? "").trim()).filter(Boolean)
        : [],
      updatedAt: String(row.updatedAt ?? o.updatedAt ?? new Date().toISOString()),
    };
  }
  return {
    version: IMPLEMENTATION_CODE_TASK_EXECUTION_FEEDBACK_VERSION,
    projectId,
    updatedAt: String(o.updatedAt ?? new Date().toISOString()),
    feedbackByCodeTaskId,
  };
}

export function resolveSelectedWorkItemsForExecution(input: {
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly workItemIds: readonly string[];
}): readonly CursorWorkItem[] {
  const ids = new Set(input.workItemIds.map((id) => String(id ?? "").trim()).filter(Boolean));
  return (input.cursorWorkItems ?? []).filter((item) => ids.has(item.id));
}

export type { TaskCursorFailureReason };
