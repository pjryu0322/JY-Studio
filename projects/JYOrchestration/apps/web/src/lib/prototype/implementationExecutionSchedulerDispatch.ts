import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  dispatchNextExecutionUnitOnServer,
  mapDispatchNextExecutionUnitToServerResult,
  type DispatchNextExecutionUnitResultV1,
} from "@/lib/prototype/implementationExecutionUnitDispatchService";
import type { ServerQuickRunContinuationResult } from "@/lib/prototype/serverQuickRunContinuationService";
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
  readonly result: DispatchNextExecutionUnitResultV1 | ServerQuickRunContinuationResult;
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const outcome =
    "outcome" in input.result && input.result.outcome === "dispatched"
      ? input.result.outcome
      : input.result.outcome;
  const ok = input.result.ok;
  const nextCodeTaskId =
    "nextCodeTaskId" in input.result ? input.result.nextCodeTaskId : null;

  if (ok && outcome === "dispatched") {
    return [
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_next_unit_dispatched",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: input.projectId,
          nextCodeTaskId: nextCodeTaskId ?? "",
        },
        nowIso,
      }),
    ];
  }
  if (outcome === "no_next_task") {
    return [
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_no_next_unit_complete",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: { projectId: input.projectId },
        nowIso,
      }),
    ];
  }
  if (outcome === "already_in_flight" || outcome === "in_flight" || outcome === "skipped") {
    return [
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_execution_in_flight_noop",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: input.projectId,
          reason: input.result.reason ?? String(outcome),
        },
        nowIso,
      }),
    ];
  }
  return [];
}

/** P3-M71 — verified → direct ExecutionUnit scheduler (no legacy continuation). */
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
  const direct = await dispatchNextExecutionUnitOnServer({
    projectId: input.projectId,
    completedTaskId: input.completedTaskId,
    completedCodeTaskId: input.completedCodeTaskId,
    sourceCommitSha: input.sourceCommitSha,
    requirementsOverlay: input.requirementsOverlay,
    nowIso,
  });
  const result = mapDispatchNextExecutionUnitToServerResult(direct);
  timeline.push(...buildExecutionSchedulerOutcomeTimelineEntries({ projectId: input.projectId, result: direct, nowIso }));
  timeline.push(...direct.timelineEntries);
  return { result, timeline };
}
