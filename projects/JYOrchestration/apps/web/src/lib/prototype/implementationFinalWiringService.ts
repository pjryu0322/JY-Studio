import { type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { areSelectedExecutionUnitsCompletedWithPersistedOutcomes } from "@/lib/prototype/implementationExecutionSelectedUnits";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { ensurePersistedImplementationIntegrationSteps } from "@/lib/prototype/implementationIntegrationStepBootstrap";
import { findIntegrationStep } from "@/lib/prototype/implementationIntegrationStepMutations";
import {
  loadImplementationIntegrationStepsFromState,
  saveImplementationIntegrationStepsToState,
} from "@/lib/prototype/implementationIntegrationStepStore";
import type { RequirementsPromptTimelineEntry, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { mergeRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";
import { buildIntegrationGateBlockedByFailedCodeTaskLogEntry } from "@/lib/prototype/implementationExecutionLogger";
import { resolveSelectedExecutionUnitIdsForFinalWiringGate } from "@/lib/prototype/implementationFinalWiringSelectedUnits";
import { summarizeCodeTaskBoardGateFromPlanAndUnits } from "@/lib/prototype/implementationIntegrationBoardGateSummary";
import { buildImplementationIntegrationCountSummary } from "@/lib/prototype/implementationIntegrationCountSummary";

export { resolveSelectedExecutionUnitIdsForFinalWiringGate } from "@/lib/prototype/implementationFinalWiringSelectedUnits";

export async function markFinalWiringIntegrationStepReady(input: {
  readonly projectId: string;
  readonly requirementsState: RequirementsStateJson;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1 | null;
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
  readonly nowIso?: string;
}): Promise<
  Readonly<{
    readonly orchestrationPatch: Partial<RequirementsStateJson>;
    readonly timeline: readonly RequirementsPromptTimelineEntry[];
  }>
> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const ensured = ensurePersistedImplementationIntegrationSteps({
    projectId: pid,
    requirementsState: input.requirementsState,
    codeTaskPlan: input.codeTaskPlan,
    nowIso,
  });
  const state = mergeRequirementsStateJson(input.requirementsState, ensured.orchestrationPatch);
  const steps = loadImplementationIntegrationStepsFromState(state);
  const finalWiring = findIntegrationStep(steps, "final_wiring");
  if (!finalWiring || finalWiring.status !== "pending") {
    return { orchestrationPatch: ensured.orchestrationPatch, timeline: ensured.timeline };
  }
  const summary = buildImplementationExecutionSummaryCounts({
    projectId: pid,
    requirementsState: state,
    codeTaskPlan: input.codeTaskPlan,
    runs: input.runs,
  });
  const selectedExecutionUnitIds = resolveSelectedExecutionUnitIdsForFinalWiringGate({
    executionUnits: summary.executionUnits,
    selectedExecutionUnitIds: summary.selectedExecutionUnitIds,
    codeTaskPlan: input.codeTaskPlan,
  });
  const usedSelectionFallback = summary.selectedExecutionUnitIds.length === 0 && selectedExecutionUnitIds.length > 0;
  const completionGate = areSelectedExecutionUnitsCompletedWithPersistedOutcomes({
    units: summary.executionUnits,
    selectedUnitIds: selectedExecutionUnitIds,
    runs: input.runs,
  });
  if (!completionGate.ok) {
    const blockedEntries = [
      buildImplementationExecutionLogTimelineEntry({
        action: "implementation_integration_final_wiring_ready_blocked",
        orchestrationTraceGroup: "implementation_integration",
        fields: {
          projectId: pid,
          selectedCount: completionGate.selectedCount,
          completedCount: completionGate.completedCount,
          pendingCodeTaskIds: completionGate.pendingCodeTaskIds.join(","),
          inconsistentCodeTaskIds: completionGate.inconsistentCodeTaskIds.join(","),
          failedCodeTaskIds: completionGate.failedCodeTaskIds.join(","),
        },
        nowIso,
      }),
    ];
    if (completionGate.failedCodeTaskIds.length > 0) {
      blockedEntries.push(
        buildIntegrationGateBlockedByFailedCodeTaskLogEntry({
          projectId: pid,
          failedCodeTaskIds: completionGate.failedCodeTaskIds,
          failedCount: completionGate.failedCodeTaskIds.length,
          nowIso,
        }),
      );
    }
    return {
      orchestrationPatch: ensured.orchestrationPatch,
      timeline: [...ensured.timeline, ...blockedEntries],
    };
  }
  const nextSteps = steps.map((s) =>
    s.stepId === finalWiring.stepId && s.status === "pending" ? { ...s, status: "ready" as const } : s,
  );
  const stepPatch = saveImplementationIntegrationStepsToState({
    projectId: pid,
    steps: nextSteps,
    reason: "implementation_integration_final_wiring_ready",
    nowIso,
  });
  const boardGate = summarizeCodeTaskBoardGateFromPlanAndUnits({
    codeTaskPlan: input.codeTaskPlan,
    units: summary.executionUnits,
    runs: input.runs ?? [],
  });
  const countSummary =
    boardGate.countSummary ??
    buildImplementationIntegrationCountSummary({
      boardSummary: boardGate,
      planTasks: input.codeTaskPlan?.tasks ?? [],
      executionUnits: summary.executionUnits,
    });
  const timeline: RequirementsPromptTimelineEntry[] = [
    ...ensured.timeline,
    ...(usedSelectionFallback
      ? [
          buildImplementationExecutionLogTimelineEntry({
            action: "implementation_final_wiring_selected_units_fallback_applied",
            orchestrationTraceGroup: "implementation_integration",
            fields: {
              projectId: pid,
              fallbackSelectedCount: selectedExecutionUnitIds.length,
            },
            nowIso,
          }),
        ]
      : []),
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_integration_final_wiring_ready",
      orchestrationTraceGroup: "implementation_integration",
      fields: { projectId: pid, stepId: finalWiring.stepId },
      nowIso,
    }),
    buildImplementationExecutionLogTimelineEntry({
      action: "implementation_codetasks_completed",
      orchestrationTraceGroup: "implementation_orchestration",
      fields: {
        projectId: pid,
        selectedCount: selectedExecutionUnitIds.length,
        verifiedCount: countSummary.verifiedCodeTaskCount,
        verifiedCodeTaskCount: countSummary.verifiedCodeTaskCount,
        integrationReadyCodeTaskCount: countSummary.integrationReadyCodeTaskCount,
        completedCodeTaskCount: countSummary.completedCodeTaskCount,
        executableCodeTaskCount: countSummary.executableCodeTaskCount,
        integrationTaskCount: countSummary.integrationTaskCount,
        totalOrchestrationUnitCount: countSummary.totalOrchestrationUnitCount,
        countModel: countSummary.countModel,
      },
      nowIso,
    }),
  ];
  return {
    orchestrationPatch: mergeOrchestrationPersistPatches(ensured.orchestrationPatch, stepPatch),
    timeline,
  };
}
