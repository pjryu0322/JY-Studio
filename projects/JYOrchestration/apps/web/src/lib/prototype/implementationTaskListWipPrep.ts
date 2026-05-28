import { defaultImplementationDbStrategy } from "@/lib/prototype/implementationDbStrategy";
import { buildCursorWorkItemsFromImplementationTaskList } from "@/lib/prototype/implementationCursorWorkItems";
import {
  buildImplementationDbSlotsTimelineEntry,
  buildImplementationSlotsFromContext,
  buildImplementationSlotsTimelineEntry,
  type ImplementationSlotsV1,
} from "@/lib/prototype/implementationSlots";
import { buildImplementationTaskPlanFromTaskList } from "@/lib/prototype/implementationTaskPlan";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
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
