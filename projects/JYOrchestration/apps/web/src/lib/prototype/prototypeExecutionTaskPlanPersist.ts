import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { summarizeTaskPlanExecutionStats } from "@/lib/prototype/implementationTaskPlanSummary";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { ImplementationDbStrategyV1 } from "@/lib/prototype/implementationDbStrategy";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";
import type { ImplementationUserFeedbackPatchV1 } from "@/lib/prototype/implementationUserFeedback";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";
import type { ImplementationIntegratedExecutionStateV1 } from "@/lib/prototype/implementationIntegratedExecutionState";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationReviewStageReadyV1 } from "@/lib/prototype/implementationReviewStageReady";
import type { ReviewStageUserFeedbackListV1 } from "@/lib/prototype/reviewStageUserFeedback";
import type { ReviewStageUserTestSessionV1 } from "@/lib/prototype/reviewStageUserTest";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationSlotsV1 } from "@/lib/prototype/implementationSlots";
import type { ImplementationStageActionRunLogV1 } from "@/lib/prototype/implementationStageActionRun";
import { buildPrototypeExecutionSingleChatPersistPatch } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import type { PrototypeExecutionInterviewSlot } from "@/lib/prototype/prototypeExecutionSingleChatTypes";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsPromptTimelineEntry,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";

export function buildImplementationTaskPlanTimelineEntry(input: {
  readonly plan: ImplementationTaskPlanV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const sourceArtifacts = [
    ...new Set(input.plan.items.flatMap((i) => i.sourceArtifactTypes)),
  ].join(",");
  const stats = summarizeTaskPlanExecutionStats(input.plan, input.workItems);
  const qualityScores = input.workItems.map((w) => w.qualityGate.score.toFixed(2)).join(",");
  const testCommands = stats.primaryTestCommands.join("|");
  const candidateDirectories = [
    ...new Set(input.plan.items.flatMap((i) => i.executionHints.candidateDirectories)),
  ]
    .slice(0, 8)
    .join("|");
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_task_plan",
    source: "system",
    responseText: [
      "type=implementation_task_plan",
      "type=implementation_cursor_prompt_quality",
      "mode=implementation",
      `taskCount=${stats.taskCount}`,
      `cursorWorkItemCount=${stats.workItemCount}`,
      `promptReadyCount=${stats.promptReadyCount}`,
      `blockedCount=${stats.blockedCount}`,
      `qualityScores=${qualityScores || "none"}`,
      `testCommands=${testCommands || "none"}`,
      `candidateDirectories=${candidateDirectories || "none"}`,
      `sourceArtifacts=${sourceArtifacts || "none"}`,
      `envOk=${input.envOk}`,
      `designOk=${input.designOk}`,
    ].join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export { appendPromptTimeline } from "@/lib/requirements/promptTimelineState";

export type PrototypeExecutionOrchestrationPersistInput = Readonly<{
  readonly chat?: {
    readonly messages: readonly RequirementsMessage[];
    readonly slots: readonly PrototypeExecutionInterviewSlot[];
    readonly answers: Readonly<Record<string, string>>;
    readonly currentSlotKey: string | null;
  };
  readonly implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
  readonly implementationSlotsV1?: ImplementationSlotsV1 | null;
  readonly implementationDbStrategyV1?: ImplementationDbStrategyV1 | null;
  readonly implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
  readonly implementationUserFeedbackPatchesV1?: readonly ImplementationUserFeedbackPatchV1[] | null;
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
  readonly taskCursorExecutionV1?: TaskCursorExecutionV1 | null;
  readonly taskCursorExecutionHistoryV1?: readonly TaskCursorExecutionV1[] | null;
  readonly implementationStageActionRunLogV1?: ImplementationStageActionRunLogV1 | null;
  readonly implementationTaskExecutionStateV1?: ImplementationTaskExecutionStateV1 | null;
  readonly implementationQualityGateResultsV1?: readonly ImplementationQualityGateResultV1[] | null;
  readonly implementationAutoQualityGateV1?: ImplementationAutoQualityGateV1 | null;
  readonly implementationAutoQualityGateHistoryV1?: readonly ImplementationAutoQualityGateV1[] | null;
  readonly implementationIntegratedExecutionStateV1?: ImplementationIntegratedExecutionStateV1 | null;
  readonly implementationExecutionBoardStateV1?: ImplementationExecutionBoardStateV1 | null;
  readonly implementationReviewStageReadyV1?: ImplementationReviewStageReadyV1 | null;
  readonly reviewStageUserTestSessionV1?: ReviewStageUserTestSessionV1 | null;
  readonly reviewStageUserFeedbackListV1?: ReviewStageUserFeedbackListV1 | null;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[];
}>;

export function buildPrototypeExecutionOrchestrationPersistPatch(
  requirementsStateJson: unknown,
  input: PrototypeExecutionOrchestrationPersistInput,
): RequirementsStateJson {
  let base = parseRequirementsStateJson(requirementsStateJson);
  if (input.chat) {
    base = parseRequirementsStateJson(buildPrototypeExecutionSingleChatPersistPatch(requirementsStateJson, input.chat));
  }
  return mergeRequirementsStateJson(base, {
    ...(input.implementationTaskPlanV1 !== undefined
      ? { implementationTaskPlanV1: input.implementationTaskPlanV1 }
      : {}),
    ...(input.cursorWorkItemsV1 !== undefined ? { cursorWorkItemsV1: input.cursorWorkItemsV1 } : {}),
    ...(input.implementationSlotsV1 !== undefined
      ? { implementationSlotsV1: input.implementationSlotsV1 }
      : {}),
    ...(input.implementationDbStrategyV1 !== undefined
      ? { implementationDbStrategyV1: input.implementationDbStrategyV1 }
      : {}),
    ...(input.implementationWorkPlanDraftV1 !== undefined
      ? { implementationWorkPlanDraftV1: input.implementationWorkPlanDraftV1 }
      : {}),
    ...(input.implementationUserFeedbackPatchesV1 !== undefined
      ? {
          implementationUserFeedbackPatchesV1:
            input.implementationUserFeedbackPatchesV1 === null
              ? null
              : [...input.implementationUserFeedbackPatchesV1],
        }
      : {}),
    ...(input.implementationSeedV1 !== undefined ? { implementationSeedV1: input.implementationSeedV1 } : {}),
    ...(input.codeAgentWipExecutionV1 !== undefined
      ? { codeAgentWipExecutionV1: input.codeAgentWipExecutionV1 }
      : {}),
    ...(input.taskCursorExecutionV1 !== undefined
      ? { taskCursorExecutionV1: input.taskCursorExecutionV1 }
      : {}),
    ...(input.taskCursorExecutionHistoryV1 !== undefined
      ? {
          taskCursorExecutionHistoryV1:
            input.taskCursorExecutionHistoryV1 === null
              ? null
              : [...input.taskCursorExecutionHistoryV1],
        }
      : {}),
    ...(input.implementationStageActionRunLogV1 !== undefined
      ? { implementationStageActionRunLogV1: input.implementationStageActionRunLogV1 }
      : {}),
    ...(input.implementationTaskExecutionStateV1 !== undefined
      ? { implementationTaskExecutionStateV1: input.implementationTaskExecutionStateV1 }
      : {}),
    ...(input.implementationQualityGateResultsV1 !== undefined
      ? {
          implementationQualityGateResultsV1:
            input.implementationQualityGateResultsV1 === null
              ? null
              : [...input.implementationQualityGateResultsV1],
        }
      : {}),
    ...(input.implementationAutoQualityGateV1 !== undefined
      ? { implementationAutoQualityGateV1: input.implementationAutoQualityGateV1 }
      : {}),
    ...(input.implementationAutoQualityGateHistoryV1 !== undefined
      ? {
          implementationAutoQualityGateHistoryV1:
            input.implementationAutoQualityGateHistoryV1 === null
              ? null
              : [...input.implementationAutoQualityGateHistoryV1],
        }
      : {}),
    ...(input.implementationIntegratedExecutionStateV1 !== undefined
      ? { implementationIntegratedExecutionStateV1: input.implementationIntegratedExecutionStateV1 }
      : {}),
    ...(input.implementationExecutionBoardStateV1 !== undefined
      ? { implementationExecutionBoardStateV1: input.implementationExecutionBoardStateV1 }
      : {}),
    ...(input.implementationReviewStageReadyV1 !== undefined
      ? { implementationReviewStageReadyV1: input.implementationReviewStageReadyV1 }
      : {}),
    ...(input.reviewStageUserTestSessionV1 !== undefined
      ? { reviewStageUserTestSessionV1: input.reviewStageUserTestSessionV1 }
      : {}),
    ...(input.reviewStageUserFeedbackListV1 !== undefined
      ? { reviewStageUserFeedbackListV1: input.reviewStageUserFeedbackListV1 }
      : {}),
    ...(input.promptTimeline !== undefined ? { promptTimeline: [...input.promptTimeline] } : {}),
    lastSavedAt: new Date().toISOString(),
  });
}
