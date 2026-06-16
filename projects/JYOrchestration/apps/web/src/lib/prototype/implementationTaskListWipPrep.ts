import { defaultImplementationDbStrategy } from "@/lib/prototype/implementationDbStrategy";
import { buildCursorWorkItemsFromImplementationTaskList } from "@/lib/prototype/implementationCursorWorkItems";
import {
  buildImplementationDbSlotsTimelineEntry,
  buildImplementationSlotsFromContext,
  buildImplementationSlotsTimelineEntry,
  type ImplementationSlotsV1,
} from "@/lib/prototype/implementationSlots";
import { buildImplementationTaskPlanFromTaskList } from "@/lib/prototype/implementationTaskPlan";
import type { ImplementationTaskPlanItem, ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  resolveLatestWipRequestRequirementsState,
  type PendingImplementationPatch,
} from "@/lib/prototype/effectiveImplementationState";
import { hasImplementationTaskListReady } from "@/lib/requirements/implementationTaskList";
import {
  appendPromptTimeline,
  buildImplementationTaskPlanTimelineEntry,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { buildInitialImplementationTaskExecutionStateFromTaskList } from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsPromptTimelineEntry, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationDbStrategyV1 } from "@/lib/prototype/implementationDbStrategy";

export function canUseTaskListForWipOrchestration(input: {
  readonly taskList: ImplementationTaskListV1 | null | undefined;
  readonly seed: ImplementationSeedV1 | null | undefined;
}): boolean {
  return Boolean(
    input.taskList?.tasks?.length &&
      input.seed?.readiness?.ready &&
      input.seed.lifecycleStatus !== "candidate",
  );
}

export type TaskListDerivedWipOrchestration = Readonly<{
  readonly plan: ImplementationTaskPlanV1;
  readonly workItems: readonly CursorWorkItem[];
  readonly slots: ImplementationSlotsV1;
  readonly dbStrategy: ImplementationDbStrategyV1;
  readonly promptTimeline: readonly RequirementsPromptTimelineEntry[];
  readonly executionState: ImplementationTaskExecutionStateV1;
}>;

export function buildTaskListDerivedWipOrchestration(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly envCursorBadge: "ok" | "needs" | "error" | "loading";
  readonly priorTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly priorExecutionState?: ImplementationTaskExecutionStateV1 | null;
  readonly planningHandoffForImplementationV1?: import("@/lib/planning/planningDataSlotsV1").PlanningHandoffForImplementationV1 | null;
  readonly nowIso?: string;
}): TaskListDerivedWipOrchestration {
  const now = input.nowIso ?? new Date().toISOString();
  const plan = buildImplementationTaskPlanFromTaskList({
    projectId: input.projectId,
    taskList: input.taskList,
    envOk: input.envOk,
    designOk: input.designOk,
    nowIso: now,
  });
  const workItems = buildCursorWorkItemsFromImplementationTaskList({
    projectId: input.projectId,
    taskList: input.taskList,
    nowIso: now,
  });
  const slots = buildImplementationSlotsFromContext({
    projectId: input.projectId,
    projectArtifacts: input.projectArtifacts,
    artifactOrchestrationV1: input.artifactOrchestrationV1,
    implementationTaskPlanV1: plan,
    cursorWorkItemsV1: workItems,
    envOk: input.envOk,
    designOk: input.designOk,
    envCursorBadge: input.envCursorBadge,
    planningHandoffForImplementationV1: input.planningHandoffForImplementationV1 ?? null,
  });
  const dbStrategy = defaultImplementationDbStrategy();

  let timeline = input.priorTimeline;
  timeline = appendPromptTimeline(
    timeline,
    buildImplementationTaskPlanTimelineEntry({
      plan,
      workItems,
      envOk: input.envOk,
      designOk: input.designOk,
    }),
  );
  timeline = appendPromptTimeline(timeline, buildImplementationSlotsTimelineEntry({ slots }));
  timeline = appendPromptTimeline(timeline, buildImplementationDbSlotsTimelineEntry({ slots }));

  const executionState =
    input.priorExecutionState ??
    buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: input.projectId,
      taskList: input.taskList,
      nowIso: now,
    });

  return {
    plan,
    workItems,
    slots,
    dbStrategy,
    promptTimeline: timeline,
    executionState,
  };
}

export function appendPromptTimelineEntries(
  prior: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  entries: readonly RequirementsPromptTimelineEntry[],
): RequirementsPromptTimelineEntry[] {
  let timeline = prior ? [...prior] : [];
  for (const entry of entries) {
    timeline = appendPromptTimeline(timeline, entry);
  }
  return timeline;
}

export function mergeTaskListWipRuntimeState(
  base: RequirementsStateJson,
  derived: TaskListDerivedWipOrchestration,
): RequirementsStateJson {
  return {
    ...base,
    implementationTaskPlanV1: derived.plan,
    cursorWorkItemsV1: [...derived.workItems],
    implementationSlotsV1: derived.slots,
    implementationDbStrategyV1: derived.dbStrategy,
    implementationTaskExecutionStateV1: derived.executionState,
    promptTimeline: [...derived.promptTimeline],
  };
}

export type ImplementationWipGenerationTimelineAction =
  | "implementation_generation_request_received"
  | "implementation_generation_request_tasklist_detected"
  | "implementation_cursor_work_items_missing_before_wip"
  | "implementation_cursor_work_items_regenerated_from_tasklist"
  | "implementation_wip_selected_task_resolved";

export function buildImplementationWipGenerationTimelineEntry(input: {
  readonly action: ImplementationWipGenerationTimelineAction;
  readonly projectId: string;
  readonly hasImplementationTaskList?: boolean;
  readonly hasCursorWorkItems?: boolean;
  readonly selectedTaskId?: string;
  readonly selectedWorkItemCount?: number;
  readonly cursorApiConfigured?: boolean;
  readonly wipStatus?: string;
  readonly taskCount?: number;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: input.action,
    source: "system",
    responseText: [
      `type=${input.action}`,
      `mode=implementation`,
      `source=taskList`,
      `projectId=${input.projectId}`,
      ...(input.hasImplementationTaskList !== undefined
        ? [`hasImplementationTaskList=${input.hasImplementationTaskList}`]
        : []),
      ...(input.hasCursorWorkItems !== undefined
        ? [`hasCursorWorkItems=${input.hasCursorWorkItems}`]
        : []),
      ...(input.selectedTaskId !== undefined ? [`selectedTaskId=${input.selectedTaskId || "none"}`] : []),
      ...(input.selectedWorkItemCount !== undefined
        ? [`selectedWorkItemCount=${input.selectedWorkItemCount}`]
        : []),
      ...(input.cursorApiConfigured !== undefined
        ? [`cursorApiConfigured=${input.cursorApiConfigured}`]
        : []),
      ...(input.wipStatus !== undefined ? [`wipStatus=${input.wipStatus}`] : []),
      ...(input.taskCount !== undefined ? [`taskCount=${input.taskCount}`] : []),
    ].join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function ensureCursorWorkItemsForImplementationTaskList(input: {
  readonly projectId: string;
  readonly implementationTaskListV1: ImplementationTaskListV1;
  readonly nowIso?: string;
}): Readonly<{
  readonly cursorWorkItemsV1: readonly CursorWorkItem[];
  readonly timelineEntry: RequirementsPromptTimelineEntry;
}> {
  const now = input.nowIso ?? new Date().toISOString();
  const cursorWorkItemsV1 = buildCursorWorkItemsFromImplementationTaskList({
    projectId: input.projectId,
    taskList: input.implementationTaskListV1,
    nowIso: now,
  });
  const taskCount = input.implementationTaskListV1.tasks?.length ?? 0;
  return {
    cursorWorkItemsV1,
    timelineEntry: buildImplementationWipGenerationTimelineEntry({
      action: "implementation_cursor_work_items_regenerated_from_tasklist",
      projectId: input.projectId,
      hasImplementationTaskList: true,
      hasCursorWorkItems: cursorWorkItemsV1.length > 0,
      taskCount,
      nowIso: now,
    }),
  };
}

export type TaskListWipRuntimePrepared = Readonly<{
  readonly executionState: ImplementationTaskExecutionStateV1;
  readonly cursorWorkItems: readonly CursorWorkItem[];
  readonly taskPlan: ImplementationTaskPlanV1;
  readonly regeneratedCursorWorkItems: boolean;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
}>;

export function prepareTaskListWipOrchestrationRuntime(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly taskPlan?: ImplementationTaskPlanV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly priorTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly cursorApiConfigured?: boolean;
  readonly nowIso?: string;
}): TaskListWipRuntimePrepared {
  const now = input.nowIso ?? new Date().toISOString();
  const timelineEntries: RequirementsPromptTimelineEntry[] = [];

  timelineEntries.push(
    buildImplementationWipGenerationTimelineEntry({
      action: "implementation_generation_request_received",
      projectId: input.projectId,
      hasImplementationTaskList: true,
      hasCursorWorkItems: (input.cursorWorkItems?.length ?? 0) > 0,
      cursorApiConfigured: input.cursorApiConfigured,
      taskCount: input.taskList.tasks?.length ?? 0,
      nowIso: now,
    }),
  );
  timelineEntries.push(
    buildImplementationWipGenerationTimelineEntry({
      action: "implementation_generation_request_tasklist_detected",
      projectId: input.projectId,
      hasImplementationTaskList: true,
      hasCursorWorkItems: (input.cursorWorkItems?.length ?? 0) > 0,
      taskCount: input.taskList.tasks?.length ?? 0,
      nowIso: now,
    }),
  );

  const executionState =
    input.executionState ??
    buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: input.projectId,
      taskList: input.taskList,
      nowIso: now,
    });

  let cursorWorkItems = input.cursorWorkItems ?? [];
  let regeneratedCursorWorkItems = false;
  if (!cursorWorkItems.length) {
    timelineEntries.push(
      buildImplementationWipGenerationTimelineEntry({
        action: "implementation_cursor_work_items_missing_before_wip",
        projectId: input.projectId,
        hasImplementationTaskList: true,
        hasCursorWorkItems: false,
        taskCount: input.taskList.tasks?.length ?? 0,
        nowIso: now,
      }),
    );
    const ensured = ensureCursorWorkItemsForImplementationTaskList({
      projectId: input.projectId,
      implementationTaskListV1: input.taskList,
      nowIso: now,
    });
    cursorWorkItems = ensured.cursorWorkItemsV1;
    timelineEntries.push(ensured.timelineEntry);
    regeneratedCursorWorkItems = cursorWorkItems.length > 0;
  }

  const taskPlan =
    input.taskPlan ??
    buildImplementationTaskPlanFromTaskList({
      projectId: input.projectId,
      taskList: input.taskList,
      envOk: input.envOk,
      designOk: input.designOk,
      nowIso: now,
    });

  return {
    executionState,
    cursorWorkItems,
    taskPlan,
    regeneratedCursorWorkItems,
    timelineEntries,
  };
}

export function buildMinimalImplementationTaskPlanFromWorkItems(input: {
  readonly projectId: string;
  readonly workItems: readonly CursorWorkItem[];
  readonly nowIso?: string;
}): ImplementationTaskPlanV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const items: ImplementationTaskPlanItem[] = input.workItems.map((item) => ({
    id: item.taskId,
    title: item.title,
    description: item.title,
    priority: "medium",
    sourceArtifactTypes: item.requiredFilesHint.filter((h) => h.startsWith("artifact:")),
    sourceRoles: ["developer"],
    acceptanceCriteria: [],
    securityChecks: [],
    reviewChecks: [],
    executionHints: {
      candidateFiles: item.requiredFilesHint.filter((h) => !h.startsWith("artifact:") && !h.startsWith("dir:")),
      candidateDirectories: item.requiredFilesHint.filter((h) => h.startsWith("dir:")).map((h) => h.slice(4)),
      testCommands: [...item.testCommands],
      forbiddenPaths: [...item.forbiddenPaths],
    },
    cursorPromptDraft: item.prompt,
    status: item.blocked ? "blocked" : "ready",
    blockers: [...item.blockers],
  }));
  return {
    version: "implementation_task_plan_v1",
    projectId: input.projectId.trim(),
    createdAt: now,
    source: "implementation_orchestration",
    items,
    readiness: { ready: true, missing: [] },
  };
}

export type WipRequestRuntimePrepared = Readonly<{
  readonly state: RequirementsStateJson;
  readonly workItems: readonly CursorWorkItem[];
  readonly taskPlan: ImplementationTaskPlanV1;
  readonly executionState: ImplementationTaskExecutionStateV1 | null;
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
  readonly unconfirmedSlotsNote?: string;
}>;

export function prepareWipRequestRuntime(input: {
  readonly projectId: string;
  readonly baseState: RequirementsStateJson;
  readonly pendingPatch?: PendingImplementationPatch | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly cursorApiConfigured?: boolean;
  readonly nowIso?: string;
}): WipRequestRuntimePrepared {
  const merged = resolveLatestWipRequestRequirementsState({
    base: input.baseState,
    pendingPatch: input.pendingPatch,
  });
  const pid = input.projectId.trim();
  const taskList = merged.implementationTaskListV1;
  let workItems = merged.cursorWorkItemsV1 ?? [];
  let taskPlan = merged.implementationTaskPlanV1 ?? null;
  let executionState = merged.implementationTaskExecutionStateV1 ?? null;
  let timelineEntries: RequirementsPromptTimelineEntry[] = [];
  let state = { ...merged };

  if (hasImplementationTaskListReady(taskList) && pid) {
    const prepared = prepareTaskListWipOrchestrationRuntime({
      projectId: pid,
      taskList: taskList!,
      executionState,
      cursorWorkItems: workItems,
      taskPlan,
      envOk: input.envOk,
      designOk: input.designOk,
      priorTimeline: merged.promptTimeline,
      cursorApiConfigured: input.cursorApiConfigured,
      nowIso: input.nowIso,
    });
    executionState = prepared.executionState;
    workItems = prepared.cursorWorkItems;
    taskPlan = prepared.taskPlan;
    timelineEntries = [...prepared.timelineEntries];
    state = {
      ...state,
      implementationTaskExecutionStateV1: executionState,
      cursorWorkItemsV1: workItems,
      implementationTaskPlanV1: taskPlan,
    };
  } else if (workItems.length && pid) {
    if (!taskPlan) {
      taskPlan = buildMinimalImplementationTaskPlanFromWorkItems({
        projectId: pid,
        workItems,
        nowIso: input.nowIso,
      });
      state = { ...state, implementationTaskPlanV1: taskPlan };
    }
    timelineEntries.push(
      buildImplementationWipGenerationTimelineEntry({
        action: "implementation_generation_request_received",
        projectId: pid,
        hasImplementationTaskList: false,
        hasCursorWorkItems: true,
        cursorApiConfigured: input.cursorApiConfigured,
        nowIso: input.nowIso,
      }),
    );
  }

  const unconfirmedSlotsNote =
    (workItems.length || hasImplementationTaskListReady(taskList)) &&
    merged.implementationSlotsV1 &&
    !merged.implementationSlotsV1.readiness?.ready
      ? "참고:\n- 일부 구현 슬롯은 미확정이지만, 생성된 작업목록을 기준으로 WIP 초안을 만들 수 있습니다."
      : undefined;

  return {
    state,
    workItems,
    taskPlan: taskPlan!,
    executionState,
    timelineEntries,
    ...(unconfirmedSlotsNote ? { unconfirmedSlotsNote } : {}),
  };
}
