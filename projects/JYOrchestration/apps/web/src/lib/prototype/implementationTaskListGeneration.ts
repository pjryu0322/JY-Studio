import { buildImplementationPlanningReadinessPatch, buildImplementationPlanningReadinessPatchWithLlm } from "@/lib/prototype/implementationPlanningReadiness";
import type { ImplementationWorkItemPreflightSummaryV1 } from "@/lib/prototype/implementationPlanningReadiness";
import type { ImplementationCodeTaskQualityGateV1 } from "@/lib/prototype/implementationCodeTaskQualityGate";
import { shouldRefreshImplementationPlanningReadiness } from "@/lib/prototype/implementationPlanningReadinessReuse";
import type { LlmCodeTaskRefinementCaller } from "@/lib/prototype/implementationCodeTaskPlanLlmRefinement";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
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
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";

export type GenerateImplementationTaskListResult =
  | {
      readonly ok: true;
      readonly taskList: ImplementationTaskListV1;
      readonly patch: Partial<RequirementsStateJson>;
      readonly messages: readonly RequirementsMessage[];
      readonly alreadyExisted: boolean;
      readonly syncedArtifacts?: boolean;
      readonly userMessage?: string;
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
  readonly codeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly seed?: ImplementationSeedV1 | null;
  readonly integratedExecutionState?: RequirementsStateJson["implementationIntegratedExecutionStateV1"];
  readonly boardState?: RequirementsStateJson["implementationExecutionBoardStateV1"];
  readonly qualityGateResults?: RequirementsStateJson["implementationQualityGateResultsV1"];
  readonly preflightSummary?: RequirementsStateJson["implementationWorkItemPreflightSummaryV1"];
}): RequirementsStateJson {
  return {
    implementationTaskListV1: input.taskList,
    implementationTaskExecutionStateV1: input.executionState ?? undefined,
    cursorWorkItemsV1: input.cursorWorkItems ? [...input.cursorWorkItems] : undefined,
    implementationCodeTaskPlanV1: input.codeTaskPlan ?? undefined,
    implementationWorkItemPreflightSummaryV1: input.preflightSummary ?? undefined,
    implementationSeedV1: input.seed ?? undefined,
    implementationIntegratedExecutionStateV1: input.integratedExecutionState,
    implementationExecutionBoardStateV1: input.boardState,
    implementationQualityGateResultsV1: input.qualityGateResults,
  };
}

function needsPlanningReadinessSync(input: {
  readonly existingCodeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly existingCursorWorkItems?: readonly CursorWorkItem[] | null;
}): boolean {
  const hasWorkItems = (input.existingCursorWorkItems?.length ?? 0) > 0;
  const hasCodeTaskPlan = Boolean(input.existingCodeTaskPlan?.tasks?.length);
  return !hasCodeTaskPlan || !hasWorkItems;
}

function buildPlanningReadinessReuseTimelineEntry(input: {
  readonly action: "implementation_planning_readiness_reused" | "implementation_planning_readiness_refresh_requested";
  readonly projectId: string;
  readonly reason: string;
  readonly nowIso: string;
}): RequirementsPromptTimelineEntry {
  return buildImplementationExecutionLogTimelineEntry({
    action: input.action,
    orchestrationTraceGroup: "implementation_planning_readiness",
    fields: {
      projectId: input.projectId,
      mode: "planning",
      reason: input.reason,
    },
    nowIso: input.nowIso,
  });
}

async function appendPlanningReadinessToPatchWithLlm(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly patch: Partial<RequirementsStateJson>;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly priorTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso: string;
  readonly includeTaskListCreatedEvent?: boolean;
  readonly syncMode?: "created" | "synced";
  readonly llmCaller?: LlmCodeTaskRefinementCaller;
  readonly forceLlm?: boolean;
  readonly enableLlmCodeTaskRefinement?: boolean;
}): Promise<Partial<RequirementsStateJson>> {
  const { createProjectLlmCodeTaskRefinementCaller } = await import(
    "@/lib/prototype/implementationCodeTaskPlanLlmRefinementClient"
  );
  const readiness = await buildImplementationPlanningReadinessPatchWithLlm({
    projectId: input.projectId,
    taskList: input.taskList,
    projectArtifacts: input.projectArtifacts,
    implementationSeedV1: input.implementationSeedV1,
    envOk: input.envOk,
    designOk: input.designOk,
    priorTimeline: input.priorTimeline,
    nowIso: input.nowIso,
    includeTaskListCreatedEvent: input.includeTaskListCreatedEvent,
    syncMode: input.syncMode,
    llmCaller: input.llmCaller ?? createProjectLlmCodeTaskRefinementCaller(input.projectId),
    forceLlm: input.forceLlm,
    enableLlmCodeTaskRefinement: input.enableLlmCodeTaskRefinement,
  });
  return {
    ...input.patch,
    implementationCodeTaskPlanV1: readiness.implementationCodeTaskPlanV1,
    implementationCodeTaskQualityGateV1: readiness.implementationCodeTaskQualityGateV1,
    cursorWorkItemsV1: [...readiness.cursorWorkItemsV1],
    implementationWorkItemPreflightSummaryV1: readiness.implementationWorkItemPreflightSummaryV1,
    promptTimeline: readiness.promptTimeline,
  };
}

function appendPlanningReadinessToPatch(input: {
  readonly projectId: string;
  readonly taskList: ImplementationTaskListV1;
  readonly patch: Partial<RequirementsStateJson>;
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly priorTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly nowIso: string;
  readonly includeTaskListCreatedEvent?: boolean;
  readonly syncMode?: "created" | "synced";
}): Partial<RequirementsStateJson> {
  const readiness = buildImplementationPlanningReadinessPatch({
    projectId: input.projectId,
    taskList: input.taskList,
    projectArtifacts: input.projectArtifacts,
    envOk: input.envOk,
    designOk: input.designOk,
    priorTimeline: input.priorTimeline,
    nowIso: input.nowIso,
    includeTaskListCreatedEvent: input.includeTaskListCreatedEvent,
    syncMode: input.syncMode,
  });
  return {
    ...input.patch,
    implementationCodeTaskPlanV1: readiness.implementationCodeTaskPlanV1,
    implementationCodeTaskQualityGateV1: readiness.implementationCodeTaskQualityGateV1,
    cursorWorkItemsV1: [...readiness.cursorWorkItemsV1],
    implementationWorkItemPreflightSummaryV1: readiness.implementationWorkItemPreflightSummaryV1,
    promptTimeline: readiness.promptTimeline,
  };
}

export function buildGenerateImplementationTaskListFromSeedResult(input: {
  readonly projectId: string;
  readonly seed: ImplementationSeedV1 | null | undefined;
  readonly existingTaskList?: ImplementationTaskListV1 | null;
  readonly existingCodeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
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
    const existingCodeTaskPlan = input.existingCodeTaskPlan ?? null;
    if (needsPlanningReadinessSync({
      existingCodeTaskPlan,
      existingCursorWorkItems: input.existingCursorWorkItems,
    })) {
      const executionState =
        input.existingExecutionState ??
        buildInitialImplementationTaskExecutionStateFromTaskList({
          projectId: pid,
          taskList,
          nowIso: now,
        });
      let patch: Partial<RequirementsStateJson> = {
        implementationTaskExecutionStateV1: executionState,
      };
      patch = appendPlanningReadinessToPatch({
        projectId: pid,
        taskList,
        patch,
        projectArtifacts: input.projectArtifacts,
        envOk: input.envOk,
        designOk: input.designOk,
        priorTimeline: input.priorTimeline,
        nowIso: now,
        syncMode: "synced",
      });
      const messages = buildPostGenerateMessages({
        projectId: pid,
        taskList,
        orchestration: buildOrchestrationSlice({
          taskList,
          executionState: patch.implementationTaskExecutionStateV1 ?? executionState,
          cursorWorkItems: patch.cursorWorkItemsV1 ?? input.existingCursorWorkItems,
          codeTaskPlan: patch.implementationCodeTaskPlanV1 ?? existingCodeTaskPlan,
          seed: input.seed,
          preflightSummary: patch.implementationWorkItemPreflightSummaryV1,
        }),
        envOk: input.envOk,
        previewReady: input.previewReady === true,
        nowIso: now,
        includeTaskSummary: false,
      });
      return {
        ok: true,
        taskList,
        patch,
        messages,
        alreadyExisted: true,
        syncedArtifacts: true,
        userMessage: "구현 준비 산출물을 동기화했습니다.",
      };
    }
    const messages = buildPostGenerateMessages({
      projectId: pid,
      taskList,
      orchestration: buildOrchestrationSlice({
        taskList,
        executionState: input.existingExecutionState,
        cursorWorkItems: input.existingCursorWorkItems,
        codeTaskPlan: existingCodeTaskPlan,
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
      userMessage: "구현 준비 산출물이 이미 있습니다. 작업 보드를 표시합니다.",
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

  let patch: Partial<RequirementsStateJson> = {
    implementationTaskListV1: taskList,
    implementationTaskExecutionStateV1: executionState,
  };

  patch = appendPlanningReadinessToPatch({
    projectId: pid,
    taskList,
    patch,
    projectArtifacts: input.projectArtifacts,
    envOk: input.envOk,
    designOk: input.designOk,
    priorTimeline: input.priorTimeline,
    nowIso: now,
    includeTaskListCreatedEvent: true,
    syncMode: "created",
  });

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
      priorTimeline: patch.promptTimeline ?? input.priorTimeline,
      priorExecutionState: executionState,
      nowIso: now,
    });
    patch = {
      ...patch,
      implementationTaskPlanV1: derived.plan,
      implementationSlotsV1: derived.slots,
      implementationDbStrategyV1: derived.dbStrategy,
      implementationTaskExecutionStateV1: derived.executionState,
      promptTimeline: derived.promptTimeline,
    };
  }

  const messages = buildPostGenerateMessages({
    projectId: pid,
    taskList,
    orchestration: buildOrchestrationSlice({
      taskList,
      executionState: patch.implementationTaskExecutionStateV1 ?? executionState,
      cursorWorkItems: patch.cursorWorkItemsV1,
      codeTaskPlan: patch.implementationCodeTaskPlanV1,
      seed: input.seed,
      integratedExecutionState: patch.implementationIntegratedExecutionStateV1,
      boardState: patch.implementationExecutionBoardStateV1,
      qualityGateResults: patch.implementationQualityGateResultsV1,
      preflightSummary: patch.implementationWorkItemPreflightSummaryV1,
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
    userMessage: "구현 준비 산출물을 생성했습니다.",
  };
}

export async function buildGenerateImplementationTaskListFromSeedResultWithLlm(input: {
  readonly projectId: string;
  readonly seed: ImplementationSeedV1 | null | undefined;
  readonly existingTaskList?: ImplementationTaskListV1 | null;
  readonly existingCodeTaskPlan?: ImplementationCodeTaskPlanV1 | null;
  readonly existingExecutionState?: ImplementationTaskExecutionStateV1 | null;
  readonly existingCursorWorkItems?: readonly CursorWorkItem[] | null;
  readonly existingPreflightSummary?: ImplementationWorkItemPreflightSummaryV1 | null;
  readonly existingQualityGate?: ImplementationCodeTaskQualityGateV1 | null;
  readonly priorTimeline?: readonly RequirementsPromptTimelineEntry[];
  readonly projectArtifacts?: readonly ProjectArtifact[];
  readonly artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly envCursorBadge?: "ok" | "needs" | "error" | "loading";
  readonly previewReady?: boolean;
  readonly nowIso?: string;
  readonly forceRefresh?: boolean;
  readonly llmCaller?: LlmCodeTaskRefinementCaller;
  readonly forceLlm?: boolean;
  readonly enableLlmCodeTaskRefinement?: boolean;
}): Promise<GenerateImplementationTaskListResult> {
  const base = buildGenerateImplementationTaskListFromSeedResult(input);
  if (!base.ok || !base.taskList?.tasks?.length) {
    return base;
  }

  const now = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();

  if (base.alreadyExisted) {
    const effectivePlan =
      base.patch.implementationCodeTaskPlanV1 ?? input.existingCodeTaskPlan ?? null;
    const effectiveWorkItems =
      base.patch.cursorWorkItemsV1 ?? input.existingCursorWorkItems ?? null;
    const effectivePreflight =
      base.patch.implementationWorkItemPreflightSummaryV1 ??
      input.existingPreflightSummary ??
      null;
    const effectiveQualityGate =
      base.patch.implementationCodeTaskQualityGateV1 ?? input.existingQualityGate ?? null;

    const refreshDecision = shouldRefreshImplementationPlanningReadiness({
      existingCodeTaskPlan: effectivePlan,
      existingCursorWorkItems: effectiveWorkItems,
      existingPreflightSummary: effectivePreflight,
      forceRefresh: input.forceRefresh,
    });

    if (!refreshDecision.refresh) {
      const priorTimeline = base.patch.promptTimeline ?? input.priorTimeline ?? [];
      const promptTimeline = appendPromptTimeline(
        priorTimeline,
        buildPlanningReadinessReuseTimelineEntry({
          action: "implementation_planning_readiness_reused",
          projectId: pid,
          reason: refreshDecision.reason,
          nowIso: now,
        }),
      );
      return {
        ...base,
        patch: {
          ...base.patch,
          implementationCodeTaskPlanV1: effectivePlan ?? undefined,
          implementationCodeTaskQualityGateV1: effectiveQualityGate ?? undefined,
          cursorWorkItemsV1: effectiveWorkItems ? [...effectiveWorkItems] : undefined,
          implementationWorkItemPreflightSummaryV1: effectivePreflight ?? undefined,
          promptTimeline,
        },
        userMessage:
          base.userMessage ??
          "구현 준비 산출물이 이미 있습니다. 작업 보드를 표시합니다.",
      };
    }
  }

  const priorTimelineForRefresh = base.patch.promptTimeline ?? input.priorTimeline ?? [];
  const refreshTimeline = appendPromptTimeline(
    priorTimelineForRefresh,
    buildPlanningReadinessReuseTimelineEntry({
      action: "implementation_planning_readiness_refresh_requested",
      projectId: pid,
      reason: base.alreadyExisted ? "sync_refresh" : "created",
      nowIso: now,
    }),
  );

  const llmPatch = await appendPlanningReadinessToPatchWithLlm({
    projectId: pid,
    taskList: base.taskList,
    patch: { ...base.patch, promptTimeline: refreshTimeline },
    projectArtifacts: input.projectArtifacts,
    implementationSeedV1: input.seed,
    envOk: input.envOk,
    designOk: input.designOk,
    priorTimeline: refreshTimeline,
    nowIso: now,
    includeTaskListCreatedEvent: !base.alreadyExisted,
    syncMode: base.alreadyExisted ? "synced" : "created",
    llmCaller: input.llmCaller,
    forceLlm: input.forceLlm,
    enableLlmCodeTaskRefinement: input.enableLlmCodeTaskRefinement,
  });

  const messages = buildPostGenerateMessages({
    projectId: pid,
    taskList: base.taskList,
    orchestration: buildOrchestrationSlice({
      taskList: base.taskList,
      executionState: llmPatch.implementationTaskExecutionStateV1 ?? base.patch.implementationTaskExecutionStateV1,
      cursorWorkItems: llmPatch.cursorWorkItemsV1,
      codeTaskPlan: llmPatch.implementationCodeTaskPlanV1,
      seed: input.seed,
      preflightSummary: llmPatch.implementationWorkItemPreflightSummaryV1,
    }),
    envOk: input.envOk,
    previewReady: input.previewReady === true,
    nowIso: now,
    includeTaskSummary: !base.alreadyExisted,
  });

  return {
    ...base,
    patch: {
      ...base.patch,
      ...llmPatch,
    },
    messages: messages.length ? messages : base.messages,
    userMessage: "구현준비 산출물을 생성했습니다.",
  };
}
