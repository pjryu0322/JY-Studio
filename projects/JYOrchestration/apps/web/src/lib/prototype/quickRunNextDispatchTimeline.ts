import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export function buildQuickRunNextDispatchPlannedTimelineEntry(input: {
  readonly projectId: string;
  readonly completedTaskId: string;
  readonly completedCodeTaskId: string;
  readonly nextTaskId: string;
  readonly nextCodeTaskId: string;
  readonly sourceCommitSha?: string | null;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_next_dispatch_planned",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      completedTaskId: input.completedTaskId,
      completedCodeTaskId: input.completedCodeTaskId,
      nextTaskId: input.nextTaskId,
      nextCodeTaskId: input.nextCodeTaskId,
      sourceCommitSha: input.sourceCommitSha ?? undefined,
    },
    nowIso: input.nowIso,
  });
}

export function buildQuickRunNextDispatchExecutedTimelineEntry(input: {
  readonly projectId: string;
  readonly nextTaskId: string;
  readonly nextCodeTaskId: string;
  readonly workBranch: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_next_dispatch_executed",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      nextTaskId: input.nextTaskId,
      nextCodeTaskId: input.nextCodeTaskId,
      workBranch: input.workBranch,
      outcome: "dispatched",
    },
    nowIso: input.nowIso,
  });
}

export function buildQuickRunNextDispatchSkippedTimelineEntry(input: {
  readonly projectId: string;
  readonly completedTaskId: string;
  readonly completedCodeTaskId: string;
  readonly nextTaskId?: string | null;
  readonly nextCodeTaskId?: string | null;
  readonly reason: string;
  readonly diagnostics?: unknown;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "quick_run_next_dispatch_skipped",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      completedTaskId: input.completedTaskId,
      completedCodeTaskId: input.completedCodeTaskId,
      nextTaskId: input.nextTaskId ?? undefined,
      nextCodeTaskId: input.nextCodeTaskId ?? undefined,
      reason: input.reason,
    },
    detailLines:
      input.diagnostics !== undefined
        ? [`diagnostics=${JSON.stringify(input.diagnostics)}`]
        : undefined,
    nowIso: input.nowIso,
  });
}
