import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ResolveNextSelectedCodeTaskResultV1 } from "@/lib/prototype/resolveNextSelectedCodeTaskAfterVerified";

function baseFields(input: {
  readonly projectId: string;
  readonly currentCodeTaskId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly completedCodeTaskCount: number;
  readonly reason?: string;
  readonly nextCodeTaskId?: string | null;
  readonly runId?: string | null;
  readonly previousCommitSha?: string | null;
  readonly previousWorkBranch?: string | null;
  readonly nextBaseBranch?: string | null;
  readonly nextWorkBranch?: string | null;
}): Record<string, string | number | boolean | undefined | null> {
  return {
    projectId: input.projectId,
    currentCodeTaskId: input.currentCodeTaskId,
    selectedCodeTaskIds: input.selectedCodeTaskIds.join(","),
    selectedCodeTaskCount: input.selectedCodeTaskIds.length,
    completedCodeTaskCount: input.completedCodeTaskCount,
    ...(input.nextCodeTaskId ? { nextCodeTaskId: input.nextCodeTaskId } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    ...(input.previousCommitSha ? { previousCommitSha: input.previousCommitSha.slice(0, 12) } : {}),
    ...(input.previousWorkBranch ? { previousWorkBranch: input.previousWorkBranch } : {}),
    ...(input.nextBaseBranch ? { nextBaseBranch: input.nextBaseBranch } : {}),
    ...(input.nextWorkBranch ? { nextWorkBranch: input.nextWorkBranch } : {}),
  };
}

export function buildQuickRunContinuationRequestedTimelineEntry(input: {
  readonly projectId: string;
  readonly currentCodeTaskId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly completedCodeTaskCount: number;
  readonly reason: string;
  readonly runId?: string | null;
  readonly previousCommitSha?: string | null;
  readonly previousWorkBranch?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_continuation_requested",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: baseFields(input),
    nowIso: input.nowIso,
  });
}

export function buildQuickRunNextCodeTaskResolvedTimelineEntry(input: {
  readonly projectId: string;
  readonly currentCodeTaskId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly completedCodeTaskCount: number;
  readonly resolved: ResolveNextSelectedCodeTaskResultV1;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const nextCodeTaskId =
    input.resolved.status === "next_ready"
      ? input.resolved.codeTaskId
      : input.resolved.status === "blocked_by_dependency"
        ? input.resolved.codeTaskId
        : input.resolved.status === "blocked_by_failed_previous"
          ? input.resolved.codeTaskId
          : null;
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_next_code_task_resolved",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      ...baseFields({
        projectId: input.projectId,
        currentCodeTaskId: input.currentCodeTaskId,
        selectedCodeTaskIds: input.selectedCodeTaskIds,
        completedCodeTaskCount: input.completedCodeTaskCount,
        nextCodeTaskId,
        reason: input.resolved.status,
      }),
      resolveStatus: input.resolved.status,
    },
    nowIso: input.nowIso,
  });
}

export function buildQuickRunNextCodeTaskBlockedTimelineEntry(input: {
  readonly projectId: string;
  readonly currentCodeTaskId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly completedCodeTaskCount: number;
  readonly resolved: ResolveNextSelectedCodeTaskResultV1;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry | null {
  if (
    input.resolved.status !== "blocked_by_dependency" &&
    input.resolved.status !== "blocked_by_failed_previous"
  ) {
    return null;
  }
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_next_code_task_blocked",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: baseFields({
      projectId: input.projectId,
      currentCodeTaskId: input.currentCodeTaskId,
      selectedCodeTaskIds: input.selectedCodeTaskIds,
      completedCodeTaskCount: input.completedCodeTaskCount,
      nextCodeTaskId: input.resolved.codeTaskId,
      reason: input.resolved.status,
    }),
    nowIso: input.nowIso,
  });
}

export function buildQuickRunNextCodeTaskDispatchRequestedTimelineEntry(input: {
  readonly projectId: string;
  readonly currentCodeTaskId: string;
  readonly nextCodeTaskId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly completedCodeTaskCount: number;
  readonly reason: string;
  readonly nextBaseBranch?: string | null;
  readonly nextWorkBranch?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_next_code_task_dispatch_requested",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: baseFields(input),
    nowIso: input.nowIso,
  });
}

export function buildQuickRunNextCodeTaskDispatchedTimelineEntry(input: {
  readonly projectId: string;
  readonly currentCodeTaskId: string;
  readonly nextCodeTaskId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly completedCodeTaskCount: number;
  readonly reason: string;
  readonly nextBaseBranch?: string | null;
  readonly nextWorkBranch?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_next_code_task_dispatched",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: baseFields(input),
    nowIso: input.nowIso,
  });
}

export function buildQuickRunAllSelectedCodeTasksCompletedTimelineEntry(input: {
  readonly projectId: string;
  readonly currentCodeTaskId: string;
  readonly selectedCodeTaskIds: readonly string[];
  readonly completedCodeTaskCount: number;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_all_selected_code_tasks_completed",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: baseFields({
      ...input,
      reason: "all_selected_completed",
    }),
    nowIso: input.nowIso,
  });
}

export function buildQuickRunContinuationNoopTimelineEntry(input: {
  readonly projectId: string;
  readonly currentCodeTaskId?: string | null;
  readonly selectedCodeTaskIds: readonly string[];
  readonly reason: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_continuation_noop",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      ...(input.currentCodeTaskId ? { currentCodeTaskId: input.currentCodeTaskId } : {}),
      selectedCodeTaskIds: input.selectedCodeTaskIds.join(","),
      selectedCodeTaskCount: input.selectedCodeTaskIds.length,
      reason: input.reason,
    },
    nowIso: input.nowIso,
  });
}
