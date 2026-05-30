import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { ImplementationStageActionId } from "@/lib/prototype/effectiveImplementationState";
import { mapImplementationChipToAction } from "@/lib/prototype/effectiveImplementationState";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

export type ImplementationStageActionClickSource = "execution_board" | "more_menu" | "chat_chip";

export type ImplementationStageActionClickInput = Readonly<{
  readonly actionId: ImplementationStageActionId;
  readonly label: string;
  readonly source: ImplementationStageActionClickSource;
  readonly buttonIndex?: number;
}>;

export function resolveImplementationStageActionClick(input: {
  readonly actionId: ImplementationStageActionId;
  readonly label: string;
  readonly wip?: CodeAgentWipExecutionV1 | null;
}): ImplementationStageActionId {
  const mappedFromLabel = mapImplementationChipToAction(input.label.trim());
  if (mappedFromLabel) return mappedFromLabel;
  return input.actionId;
}

export function buildImplementationStageActionClickedTimelineEntry(input: {
  readonly actionId: ImplementationStageActionId;
  readonly label: string;
  readonly source: ImplementationStageActionClickSource;
  readonly buttonIndex?: number;
  readonly selectedTaskId?: string;
  readonly currentBridgeExecutionStatus?: string;
  readonly currentExecutionMode?: string;
  readonly runId?: string;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_stage_action_clicked",
    source: "platform",
    routingDecision: input.actionId,
    responseText: [
      "type=implementation_stage_action_clicked",
      `source=${input.source}`,
      `label=${input.label}`,
      `actionId=${input.actionId}`,
      ...(input.buttonIndex != null ? [`buttonIndex=${input.buttonIndex}`] : []),
      ...(input.selectedTaskId ? [`selectedTaskId=${input.selectedTaskId}`] : []),
      ...(input.currentBridgeExecutionStatus
        ? [`currentBridgeExecutionStatus=${input.currentBridgeExecutionStatus}`]
        : []),
      ...(input.currentExecutionMode ? [`currentExecutionMode=${input.currentExecutionMode}`] : []),
      ...(input.runId ? [`runId=${input.runId}`] : []),
    ].join(" "),
    createdAt: now,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}
