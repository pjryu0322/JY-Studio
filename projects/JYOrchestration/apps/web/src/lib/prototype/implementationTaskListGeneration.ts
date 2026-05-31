import { buildCursorWorkItemsFromImplementationTaskList } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationWorkItemsDraftCreatedTimelineEntry } from "@/lib/prototype/implementationWorkItemRefinement";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationExecutionBoardMessage } from "@/lib/prototype/implementationExecutionBoardMessage";
import { deriveImplementationTaskListReadiness } from "@/lib/prototype/implementationTaskListReadiness";
import {
  buildTaskListDerivedWipOrchestration,
  canUseTaskListForWipOrchestration,
} from "@/lib/prototype/implementationTaskListWipPrep";
import { buildInitialImplementationTaskExecutionStateFromTaskList } from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import {
  buildImplementationTaskListFromSeed,
  hasImplementationTaskListReady,
  type ImplementationTaskListV1,
} from "@/lib/requirements/implementationTaskList";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsPromptTimelineEntry, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { appendPromptTimeline } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";

export type GenerateImplementationTaskListResult =
  | {
      readonly ok: true;
      readonly taskList: ImplementationTaskListV1;
      readonly patch: Partial<RequirementsStateJson>;
      readonly messages: readonly RequirementsMessage[];
      readonly alreadyExisted: boolean;
    }
  | { readonly ok: false; readonly message: string };

function buildPostGenerateMessages(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly orchestration: RequirementsStateJson;
  readonly envOk: boolean;
  readonly previewReady: boolean;
  readonly nowIso: string;
  readonly includeTaskSummary: boolean;
}): RequirementsMessage[] {
  const board = buildImplementationExecutionBoardFromRequirementsState({
    projectId: input.projectId,
    orchestration: input.orchestration,
    taskList: input.taskList,
    nowIso: input.nowIso,
  });
  if (!board) return [];
  return [
    buildImplementationExecutionBoardMessage({
      board,
      taskList: input.taskList,
      includeTaskSummary: input.includeTaskSummary,
      envOk: input.envOk,
      nowIso: input.nowIso,
      previewReady: input.previewReady,
      hasExecutionState: Boolean(input.orchestration.implementationTaskExecutionStateV1),
      boardState: input.orchestration.implementationExecutionBoardStateV1,
    }),
  ];
}

function buildOrchestrationSlice(input: {
  readonly taskList: ImplementationTaskListV1;
  readonly executionState?: ImplementationTaskExecutionStateV1 | null;
  readonly cursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly seed?: ImplementationSeedV1 | null;
  readonly integratedExecutionState?: RequirementsStateJson["implementationIntegratedExecutionStateV1"];
  readonly boardState?: RequirementsStateJson["implementationExecutionBoardStateV1"];
  readonly qualityGateResults?: RequirementsStateJson["implementationQualityGateResultsV1"];
}): RequirementsStateJson {
  return {
    implementationTaskListV1: input.taskList,
    implementationTaskExecutionStateV1: input.executionState ?? undefined,
    cursorWorkItemsV1: input.cursorWorkItems ? [...input.cursorWorkItems] : undefined,
    implementationSeedV1: input.seed ?? undefined,
    implementationIntegratedExecutionStateV1: input.integratedExecutionState,
    implementationExecutionBoardStateV1: input.boardState,
    implementationQualityGateResultsV1: input.qualityGateResults,
  };
}

export function buildGenerateImplementationTaskListFromSeedResult(input: {
  readonly projectId: string;
  readonly seed: ImplementationSeedV1 | null | undefined;
  readonly existingTaskList?: ImplementationTaskListV1 | null;
  readonly existingExecutionState?: ImplementationTaskExecutionStateV1 | null;
  readonly existingCursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly priorTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly envCursorBadge?: "ok" | "needs" | "error" | "loading";
  readonly previewReady?: boolean;
  readonly nowIso?: string;
}): GenerateImplementationTaskListResult {
  const now = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  if (!pid) {
    return { ok: false, message: "projectId가 없습니다." };
  }

  const readiness = deriveImplementationTaskListReadiness({
    implementationSeedV1: input.seed,
    implementationTaskListV1: input.existingTaskList,
  });

  if (readiness.status === "task_list_exists" && input.existingTaskList) {
    const taskList = input.existingTaskList;
    const messages = buildPostGenerateMessages({
      projectId: pid,
      taskList,
      orchestration: buildOrchestrationSlice({
        taskList,
        executionState: input.existingExecutionState,
        cursorWorkItems: input.existingCursorWorkItems,
        seed: input.seed,
      }),
      envOk: input.envOk,
      previewReady: input.previewReady === true,
      nowIso: now,
      includeTaskSummary: false,
    });
    return {
      ok: true,
      taskList,
      patch: {},
      messages,
      alreadyExisted: true,
    };
  }

  if (!readiness.canGenerateTaskList || !input.seed) {
    return { ok: false, message: readiness.message };
  }

  const taskList = buildImplementationTaskListFromSeed({
    projectId: pid,
    seed: input.seed,
    nowIso: now,
  });

  if (!hasImplementationTaskListReady(taskList)) {
    return {
      ok: false,
      message: "Implementation Seed에서 생성할 구현 작업이 없습니다. 기획 산출물을 보완해 주세요.",
    };
  }

  const executionState =
    input.existingExecutionState ??
    buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: pid,
      taskList,
      nowIso: now,
    });

  const cursorWorkItems =
    input.existingCursorWorkItems?.length
      ? [...input.existingCursorWorkItems]
      : buildCursorWorkItemsFromImplementationTaskList({
          projectId: pid,
          taskList,
          nowIso: now,
        });

  let patch: Partial<RequirementsStateJson> = {
    implementationTaskListV1: taskList,
    implementationTaskExecutionStateV1: executionState,
    cursorWorkItemsV1: cursorWorkItems,
  };

  if (!input.existingCursorWorkItems?.length && cursorWorkItems.length) {
    patch = {
      ...patch,
      promptTimeline: appendPromptTimeline(
        input.priorTimeline,
        buildImplementationWorkItemsDraftCreatedTimelineEntry({
          projectId: pid,
          taskCount: taskList.tasks.filter((task) => task.ownerRole === "developer").length,
          workItemCount: cursorWorkItems.length,
          originStage: "planning",
          nowIso: now,
        }),
      ),
    };
  }

  if (
    canUseTaskListForWipOrchestration({ taskList, seed: input.seed }) &&
    !input.existingCursorWorkItems?.length
  ) {
    const derived = buildTaskListDerivedWipOrchestration({
      projectId: pid,
      taskList,
      projectArtifacts: input.projectArtifacts ?? [],
      artifactOrchestrationV1: input.artifactOrchestrationV1,
      envOk: input.envOk,
      designOk: input.designOk,
      envCursorBadge: input.envCursorBadge ?? (input.envOk ? "ok" : "needs"),
      priorTimeline: input.priorTimeline,
      priorExecutionState: executionState,
      nowIso: now,
    });
    patch = {
      ...patch,
      implementationTaskPlanV1: derived.plan,
      cursorWorkItemsV1: [...derived.workItems],
      implementationSlotsV1: derived.slots,
      implementationDbStrategyV1: derived.dbStrategy,
      implementationTaskExecutionStateV1: derived.executionState,
      promptTimeline: !input.existingCursorWorkItems?.length
        ? appendPromptTimeline(
            derived.promptTimeline,
            buildImplementationWorkItemsDraftCreatedTimelineEntry({
              projectId: pid,
              taskCount: taskList.tasks.filter((task) => task.ownerRole === "developer").length,
              workItemCount: derived.workItems.length,
              originStage: "planning",
              nowIso: now,
            }),
          )
        : [...derived.promptTimeline],
    };
  }

  const messages = buildPostGenerateMessages({
    projectId: pid,
    taskList,
    orchestration: buildOrchestrationSlice({
      taskList,
      executionState: patch.implementationTaskExecutionStateV1 ?? executionState,
      cursorWorkItems: patch.cursorWorkItemsV1 ?? cursorWorkItems,
      seed: input.seed,
      integratedExecutionState: patch.implementationIntegratedExecutionStateV1,
      boardState: patch.implementationExecutionBoardStateV1,
      qualityGateResults: patch.implementationQualityGateResultsV1,
    }),
    envOk: input.envOk,
    previewReady: input.previewReady === true,
    nowIso: now,
    includeTaskSummary: true,
  });

  return {
    ok: true,
    taskList,
    patch,
    messages,
    alreadyExisted: false,
  };
}
