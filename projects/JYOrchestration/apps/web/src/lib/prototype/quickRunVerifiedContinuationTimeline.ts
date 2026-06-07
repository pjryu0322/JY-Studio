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

export function buildQuickRunContinuationPatchPersistedTimelineEntry(input: {
  readonly projectId: string;
  readonly hasNextDispatch: boolean;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_continuation_patch_persisted",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      hasNextDispatch: input.hasNextDispatch,
      status: "persisted",
    },
    nowIso: input.nowIso,
  });
}

export function buildQuickRunSelectedQueueReconciledTimelineEntry(input: {
  readonly projectId: string;
  readonly dbSelectedCount: number;
  readonly runtimeSelectedCount: number;
  readonly resolvedSelectedCount: number;
  readonly source: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_selected_queue_reconciled",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      dbSelectedCount: input.dbSelectedCount,
      runtimeSelectedCount: input.runtimeSelectedCount,
      resolvedSelectedCount: input.resolvedSelectedCount,
      source: input.source,
    },
    nowIso: input.nowIso,
  });
}

export function buildQuickRunQueuedFallbackDispatchRequestedTimelineEntry(input: {
  readonly projectId: string;
  readonly previousCodeTaskId?: string | null;
  readonly previousCommitSha?: string | null;
  readonly reason: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_queued_fallback_dispatch_requested",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      reason: input.reason,
      ...(input.previousCodeTaskId ? { previousCodeTaskId: input.previousCodeTaskId } : {}),
      ...(input.previousCommitSha
        ? { previousCommitSha: input.previousCommitSha.slice(0, 12) }
        : {}),
    },
    nowIso: input.nowIso,
  });
}

export function buildQuickRunQueuedFallbackDispatchDispatchedTimelineEntry(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly reason?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_queued_fallback_dispatch_dispatched",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      codeTaskId: input.codeTaskId,
      status: "dispatched",
      ...(input.reason ? { reason: input.reason } : {}),
    },
    nowIso: input.nowIso,
  });
}

export function buildQuickRunQueuedFallbackDispatchSkippedTimelineEntry(input: {
  readonly projectId: string;
  readonly reason: string;
  readonly codeTaskId?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_queued_fallback_dispatch_skipped",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      reason: input.reason,
      status: "skipped",
      ...(input.codeTaskId ? { codeTaskId: input.codeTaskId } : {}),
    },
    nowIso: input.nowIso,
  });
}

export function buildQuickRunQueuedFallbackDispatchFailedTimelineEntry(input: {
  readonly projectId: string;
  readonly reason: string;
  readonly errorMessage?: string | null;
  readonly codeTaskId?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_queued_fallback_dispatch_failed",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      reason: input.reason,
      status: "failed",
      ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
      ...(input.codeTaskId ? { codeTaskId: input.codeTaskId } : {}),
    },
    nowIso: input.nowIso,
  });
}

export function buildQuickRunQueuedTargetBlockedTimelineEntry(input: {
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly reason: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_queued_target_blocked",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      codeTaskId: input.codeTaskId,
      reason: input.reason,
      status: "blocked",
    },
    nowIso: input.nowIso,
  });
}

export function buildQuickRunQueuedTargetCanonicalizedTimelineEntry(input: {
  readonly projectId: string;
  readonly fromCodeTaskId: string;
  readonly toCodeTaskId: string;
  readonly reason: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_queued_target_canonicalized",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      fromCodeTaskId: input.fromCodeTaskId,
      toCodeTaskId: input.toCodeTaskId,
      reason: input.reason,
      status: "canonicalized",
    },
    nowIso: input.nowIso,
  });
}

export function formatQueuedCodeTaskIdBlockedMessage(input: {
  readonly codeTaskId: string;
  readonly reason?: string | null;
}): string {
  return [
    "queued run의 CodeTask ID가 현재 계획에 존재하지 않습니다.",
    `codeTaskId: ${input.codeTaskId}`,
    input.reason ? `reason: ${input.reason}` : "",
    "조치: queued run을 canonical CodeTask ID로 repair하거나 해당 run을 폐기하세요.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildQuickRunQueuedFallbackTimelineFromServerResult(input: {
  readonly projectId: string;
  readonly serverResult?: import("@/lib/prototype/serverQuickRunContinuationService").ServerQuickRunContinuationResult;
  readonly outcome?: "dispatched" | "skipped" | "failed";
  readonly reason: string;
  readonly codeTaskId?: string | null;
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  const nowIso = input.nowIso;
  const result = input.serverResult;
  if (result?.ok && result.outcome === "dispatched") {
    const codeTaskId = result.nextCodeTaskId ?? result.nextTaskId ?? input.codeTaskId ?? "";
    return [
      buildQuickRunQueuedFallbackDispatchDispatchedTimelineEntry({
        projectId: input.projectId,
        codeTaskId: String(codeTaskId),
        reason: input.reason,
        nowIso,
      }),
    ];
  }
  if (result) {
    if (result.outcome === "execute_request_failed") {
      return [
        buildQuickRunQueuedFallbackDispatchFailedTimelineEntry({
          projectId: input.projectId,
          reason: result.reason ?? input.reason,
          errorMessage: result.reason,
          codeTaskId: result.nextCodeTaskId ?? input.codeTaskId,
          nowIso,
        }),
      ];
    }
    return [
      buildQuickRunQueuedFallbackDispatchSkippedTimelineEntry({
        projectId: input.projectId,
        reason: result.reason ?? input.reason,
        codeTaskId: result.nextCodeTaskId ?? input.codeTaskId,
        nowIso,
      }),
    ];
  }
  const outcome = input.outcome ?? "skipped";
  if (outcome === "failed") {
    return [
      buildQuickRunQueuedFallbackDispatchFailedTimelineEntry({
        projectId: input.projectId,
        reason: input.reason,
        codeTaskId: input.codeTaskId,
        nowIso,
      }),
    ];
  }
  return [
    buildQuickRunQueuedFallbackDispatchSkippedTimelineEntry({
      projectId: input.projectId,
      reason: input.reason,
      codeTaskId: input.codeTaskId,
      nowIso,
    }),
  ];
}
