import type {
  EffectiveImplementationState,
  ImplementationStageActionId,
} from "@/lib/prototype/effectiveImplementationState";
import {
  buildStageActionRunCompletionTimelineEntries,
  evaluateImplementationStageActionGate,
  type ImplementationStageActionRunResult,
} from "@/lib/prototype/implementationStageActionPipeline";
import type { ImplementationStageActionTimelineSource } from "@/lib/prototype/implementationIntentTimeline";
import {
  completeImplementationStageActionRun,
  createImplementationStageActionRun,
  type ImplementationStageActionRun,
  type ImplementationStageActionRunSource,
} from "@/lib/prototype/implementationStageActionRun";

export async function orchestrateImplementationStageAction(input: {
  readonly projectId: string;
  readonly actionId: ImplementationStageActionId;
  readonly source: ImplementationStageActionRunSource;
  readonly effectiveState: EffectiveImplementationState;
  readonly execute: () => ImplementationStageActionRunResult | Promise<ImplementationStageActionRunResult>;
  readonly nowIso?: string;
}): Promise<ImplementationStageActionRun> {
  const timelineSource = input.source as ImplementationStageActionTimelineSource;
  const run = createImplementationStageActionRun({
    projectId: input.projectId,
    actionId: input.actionId,
    source: input.source,
    nowIso: input.nowIso,
  });

  const gate = evaluateImplementationStageActionGate(input.actionId, input.effectiveState);
  if (!gate.ok) {
    const timelineEntries = buildStageActionRunCompletionTimelineEntries(
      input.actionId,
      { outcome: "blocked", message: gate.message },
      timelineSource,
      run.runId,
    );
    return completeImplementationStageActionRun({
      run,
      gateResult: gate,
      runResult: { outcome: "blocked", message: gate.message },
      timelineEntries,
      completedAt: input.nowIso,
    });
  }

  try {
    const runResult = await input.execute();
    const timelineEntries = buildStageActionRunCompletionTimelineEntries(
      input.actionId,
      runResult,
      timelineSource,
      run.runId,
    );
    return completeImplementationStageActionRun({
      run,
      gateResult: gate,
      runResult,
      timelineEntries,
      completedAt: input.nowIso,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "구현단계 action 실행 중 오류가 발생했습니다.";
    const failedResult = { outcome: "blocked" as const, message };
    const timelineEntries = buildStageActionRunCompletionTimelineEntries(
      input.actionId,
      failedResult,
      timelineSource,
      run.runId,
    );
    return completeImplementationStageActionRun({
      run,
      gateResult: gate,
      runResult: failedResult,
      status: "failed",
      message,
      timelineEntries,
      completedAt: input.nowIso,
    });
  }
}
