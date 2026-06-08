import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  continueSelectedCodeTaskQueueAfterAutoGate,
  type ServerQuickRunContinuationResult,
} from "@/lib/prototype/serverQuickRunContinuationService";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export function buildExecutionSchedulerRequestedTimelineEntry(input: {
  readonly projectId: string;
  readonly completedCodeTaskId: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: "implementation_execution_scheduler_requested",
    orchestrationTraceGroup: "implementation_orchestration",
    fields: {
      projectId: input.projectId,
      completedCodeTaskId: input.completedCodeTaskId,
    },
    nowIso: input.nowIso,
  });
}

export function buildExecutionSchedulerOutcomeTimelineEntries(input: {
  readonly projectId: string;
  readonly result: ServerQuickRunContinuationResult;
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  const nowIso = input.nowIso ?? new Date().toISOString();
  if (input.result.ok && input.result.outcome === "dispatched") {
    return [
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_next_unit_dispatched",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: input.projectId,
          nextCodeTaskId: input.result.nextCodeTaskId ?? "",
        },
        nowIso,
      }),
    ];
  }
  if (input.result.outcome === "no_next_task") {
    return [
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_no_next_unit_complete",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: { projectId: input.projectId },
        nowIso,
      }),
    ];
  }
  if (input.result.outcome === "already_in_flight" || input.result.outcome === "skipped") {
    return [
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_in_flight_noop",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: input.projectId,
          reason: input.result.reason ?? input.result.outcome,
        },
        nowIso,
      }),
    ];
  }
  return [];
}

/** P3-M70 — verified → scheduler → dispatch (replaces queued fallback recovery). */
export async function scheduleNextExecutionUnitAfterVerified(input: {
  readonly projectId: string;
  readonly completedTaskId: string;
  readonly completedCodeTaskId: string;
  readonly sourceCommitSha?: string | null;
  readonly requirementsOverlay?: Partial<RequirementsStateJson> | null;
  readonly nowIso?: string;
}): Promise<
  Readonly<{
    readonly result: ServerQuickRunContinuationResult;
    readonly timeline: readonly RequirementsPromptTimelineEntry[];
  }>
> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const timeline: RequirementsPromptTimelineEntry[] = [
    buildExecutionSchedulerRequestedTimelineEntry({
      projectId: input.projectId,
      completedCodeTaskId: input.completedCodeTaskId,
      nowIso,
    }),
  ];
  const result = await continueSelectedCodeTaskQueueAfterAutoGate({
    projectId: input.projectId,
    completedTaskId: input.completedTaskId,
    completedCodeTaskId: input.completedCodeTaskId,
    sourceCommitSha: input.sourceCommitSha,
    requirementsOverlay: input.requirementsOverlay,
    nowIso,
  });
  timeline.push(...buildExecutionSchedulerOutcomeTimelineEntries({ projectId: input.projectId, result, nowIso }));
  timeline.push(...result.timelineEntries);
  return { result, timeline };
}
