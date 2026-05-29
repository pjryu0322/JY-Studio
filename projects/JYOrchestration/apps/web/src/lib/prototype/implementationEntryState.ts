import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { buildCursorWorkItemsFromImplementationTaskList } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import {
  detectQuickDesignDraftPresence,
  hasQuickDesignConfirmedInTimeline,
} from "@/lib/prototype/planningArtifactReadiness";
import { collectReferencePlanningArtifacts } from "@/lib/prototype/implementationWorkPlanDraft";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import {
  hasImplementationTaskListReady,
  type ImplementationTaskListV1,
} from "@/lib/requirements/implementationTaskList";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";

export type ImplementationEntryStateStatus =
  | "board_ready"
  | "task_plan_only"
  | "seed_only"
  | "quick_design_confirmed_only"
  | "quick_design_draft_unconfirmed"
  | "missing_planning_artifacts";

export type ImplementationEntryPrimaryAction =
  | "REQUEST_CODE_AGENT_WIP"
  | "GENERATE_IMPLEMENTATION_TASK_LIST"
  | "CONFIRM_QUICK_DESIGN_FOR_IMPLEMENTATION"
  | "CREATE_IMPLEMENTATION_SEED_FROM_QUICK_DESIGN_DRAFT"
  | "RETURN_TO_PLANNING_STAGE";

export type ImplementationEntryState = Readonly<{
  readonly status: ImplementationEntryStateStatus;
  readonly primaryAction: ImplementationEntryPrimaryAction;
  readonly hasImplementationSeed: boolean;
  readonly hasImplementationTaskPlan: boolean;
  readonly hasImplementationTaskList: boolean;
  readonly hasCursorWorkItems: boolean;
  readonly needsCursorWorkItemsRegeneration: boolean;
  readonly taskCount: number;
  readonly developerTaskCount: number;
}>;

export function hasAnyQuickDesignConfirmedSignal(input: {
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly fastPlanDraftV1?: FastPlanDraftStateV1 | null;
  readonly projectArtifacts?: readonly ProjectArtifact[] | null;
}): boolean {
  if (input.fastPlanDraftV1?.status === "confirmed") return true;
  if (hasQuickDesignConfirmedInTimeline(input.promptTimeline)) return true;
  return (input.promptTimeline ?? []).some((entry) =>
    /^quick_design_confirmed/.test(String(entry.action ?? "")),
  );
}

export function deriveImplementationEntryState(input: {
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
  readonly projectArtifacts?: readonly ProjectArtifact[] | null;
  readonly fastPlanDraftV1?: FastPlanDraftStateV1 | null;
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
}): ImplementationEntryState {
  const hasTaskList = hasImplementationTaskListReady(input.implementationTaskListV1);
  const hasCursorWorkItems = (input.cursorWorkItemsV1?.length ?? 0) > 0;
  const taskList = input.implementationTaskListV1;
  const taskCount = taskList?.tasks?.length ?? 0;
  const developerTaskCount = taskList?.roleSummary?.developer ?? 0;

  const baseMeta = {
    hasImplementationSeed: Boolean(input.implementationSeedV1),
    hasImplementationTaskPlan: Boolean(input.implementationTaskPlanV1),
    hasImplementationTaskList: hasTaskList,
    hasCursorWorkItems,
    taskCount,
    developerTaskCount,
  };

  if (hasTaskList || hasCursorWorkItems) {
    return {
      ...baseMeta,
      status: "board_ready",
      primaryAction: "REQUEST_CODE_AGENT_WIP",
      needsCursorWorkItemsRegeneration: hasTaskList && !hasCursorWorkItems,
    };
  }

  if (input.implementationTaskPlanV1) {
    return {
      ...baseMeta,
      status: "task_plan_only",
      primaryAction: "GENERATE_IMPLEMENTATION_TASK_LIST",
      needsCursorWorkItemsRegeneration: false,
    };
  }

  if (input.implementationSeedV1) {
    return {
      ...baseMeta,
      status: "seed_only",
      primaryAction: "GENERATE_IMPLEMENTATION_TASK_LIST",
      needsCursorWorkItemsRegeneration: false,
    };
  }

  const hasConfirmedQuickDesign =
    hasAnyQuickDesignConfirmedSignal(input) ||
    collectReferencePlanningArtifacts(input.projectArtifacts ?? []).length > 0;

  if (hasConfirmedQuickDesign) {
    return {
      ...baseMeta,
      status: "quick_design_confirmed_only",
      primaryAction: "CONFIRM_QUICK_DESIGN_FOR_IMPLEMENTATION",
      needsCursorWorkItemsRegeneration: false,
    };
  }

  if (
    detectQuickDesignDraftPresence({
      fastPlanDraftV1: input.fastPlanDraftV1,
      promptTimeline: input.promptTimeline,
      orchestration: input.orchestration,
      slotDefinitions: input.slotDefinitions,
      implementationTaskListV1: input.implementationTaskListV1,
      cursorWorkItemsV1: input.cursorWorkItemsV1,
    })
  ) {
    return {
      ...baseMeta,
      status: "quick_design_draft_unconfirmed",
      primaryAction: "CONFIRM_QUICK_DESIGN_FOR_IMPLEMENTATION",
      needsCursorWorkItemsRegeneration: false,
    };
  }

  return {
    ...baseMeta,
    status: "missing_planning_artifacts",
    primaryAction: "RETURN_TO_PLANNING_STAGE",
    needsCursorWorkItemsRegeneration: false,
  };
}

export function buildImplementationEntryTimelineEntry(input: {
  readonly projectId: string;
  readonly entryState: ImplementationEntryState;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  const actionByStatus: Readonly<Record<ImplementationEntryStateStatus, string>> = {
    board_ready: input.entryState.hasCursorWorkItems
      ? "implementation_entry_cursor_work_items_detected"
      : input.entryState.needsCursorWorkItemsRegeneration
        ? "implementation_entry_tasklist_detected"
        : "implementation_entry_tasklist_detected",
    task_plan_only: "implementation_entry_tasklist_generated_from_taskplan",
    seed_only: "implementation_entry_seed_only_tasklist_required",
    quick_design_confirmed_only: "implementation_entry_quick_implement_required",
    quick_design_draft_unconfirmed: "implementation_blocked_quick_design_unconfirmed",
    missing_planning_artifacts: "implementation_entry_missing_planning_artifacts",
  };

  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: actionByStatus[input.entryState.status],
    source: "system",
    responseText: [
      `type=${actionByStatus[input.entryState.status]}`,
      `projectId=${input.projectId}`,
      `entryState=${input.entryState.status}`,
      `primaryAction=${input.entryState.primaryAction}`,
      `hasImplementationSeed=${input.entryState.hasImplementationSeed}`,
      `hasImplementationTaskPlan=${input.entryState.hasImplementationTaskPlan}`,
      `hasImplementationTaskList=${input.entryState.hasImplementationTaskList}`,
      `hasCursorWorkItems=${input.entryState.hasCursorWorkItems}`,
      `taskCount=${input.entryState.taskCount}`,
      `developerTaskCount=${input.entryState.developerTaskCount}`,
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationEntryCursorWorkItemsRecovery(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly existingCursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly nowIso?: string;
}): Readonly<{
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly regenerated: boolean;
}> {
  if ((input.existingCursorWorkItems?.length ?? 0) > 0) {
    return { cursorWorkItems: input.existingCursorWorkItems ?? [], regenerated: false };
  }
  const cursorWorkItems = buildCursorWorkItemsFromImplementationTaskList({
    projectId: input.projectId,
    taskList: input.taskList,
    nowIso: input.nowIso,
  });
  return { cursorWorkItems, regenerated: cursorWorkItems.length > 0 };
}

export function buildImplementationEntryCursorWorkItemsRegeneratedTimelineEntry(input: {
  readonly projectId: string;
  readonly taskCount: number;
  readonly developerTaskCount: number;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_entry_cursor_work_items_regenerated",
    source: "system",
    responseText: [
      "type=implementation_entry_cursor_work_items_regenerated",
      `projectId=${input.projectId}`,
      `taskCount=${input.taskCount}`,
      `developerTaskCount=${input.developerTaskCount}`,
      "hasCursorWorkItems=true",
    ].join(" "),
    createdAt: input.nowIso,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}
