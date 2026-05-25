import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { summarizeTaskPlanExecutionStats } from "@/lib/prototype/implementationTaskPlanSummary";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { ImplementationDbStrategyV1 } from "@/lib/prototype/implementationDbStrategy";
import type { ImplementationSlotsV1 } from "@/lib/prototype/implementationSlots";
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

export function appendPromptTimeline(
  existing: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  entry: RequirementsPromptTimelineEntry,
): RequirementsPromptTimelineEntry[] {
  return [...(existing ?? []), entry].slice(-120);
}

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
  readonly codeAgentWipExecutionV1?: CodeAgentWipExecutionV1 | null;
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
    ...(input.codeAgentWipExecutionV1 !== undefined
      ? { codeAgentWipExecutionV1: input.codeAgentWipExecutionV1 }
      : {}),
    ...(input.promptTimeline !== undefined ? { promptTimeline: [...input.promptTimeline] } : {}),
    lastSavedAt: new Date().toISOString(),
  });
}
