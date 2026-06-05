import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import {
  parseImplementationAutoQualityGateHistoryV1,
  parseImplementationAutoQualityGateV1,
  runImplementationAutoQualityGate,
  shouldAutoStartImplementationQualityGate,
  shouldResumeImplementationAutoQualityGate,
} from "@/lib/prototype/implementationAutoQualityGate";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  isAutoGatePassedForExecution,
  planQuickRunCodeTaskContinuationAfterAutoGate,
  shouldPlanQuickRunCodeTaskContinuationAfterAutoGate,
} from "@/lib/prototype/implementationQuickRunCodeTaskContinuation";
import {
  parseImplementationQuickRunV1,
  syncImplementationQuickRunWithExecution,
} from "@/lib/prototype/implementationQuickRun";
import {
  parseImplementationQualityGateResultsV1,
  type ImplementationQualityGateResultV1,
} from "@/lib/prototype/implementationQualityGate";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { mergeOrchestrationPersistPatches } from "@/lib/prototype/orchestrationPatchMerge";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { parseImplementationTaskExecutionStateV1 } from "@/lib/prototype/implementationTaskExecutionState";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { appendPromptTimeline } from "@/lib/requirements/promptTimelineState";
import { mergeRequirementsStateJson, type RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import { resolveEffectiveCodeTaskExecutionQueue } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueSnapshot";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

export type QuickRunGithubAdvanceDispatch = Readonly<{
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly workItemId: string;
  readonly triggerKey: string;
}>;

export type QuickRunGithubAdvanceResult = Readonly<{
  readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput;
  readonly nextDispatch: QuickRunGithubAdvanceDispatch | null;
}>;

export type QuickRunGithubAdvanceContext = Readonly<{
  readonly projectId: string;
  readonly githubVerifyOk: boolean;
  readonly basePatch: PrototypeExecutionOrchestrationPersistInput;
  readonly quickRun?: unknown;
  readonly implementationTaskListV1?: unknown;
  readonly implementationCodeTaskPlanV1?: unknown;
  readonly codeTaskExecutionRunsV1?: unknown;
  readonly implementationTaskExecutionStateV1?: unknown;
  readonly implementationQualityGateResultsV1?: unknown;
  readonly implementationAutoQualityGateV1?: unknown;
  readonly implementationAutoQualityGateHistoryV1?: unknown;
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[];
  readonly promptTimeline?: readonly RequirementsPromptTimelineEntry[] | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly nowIso?: string;
}>;

function mergeOrchestrationPatches(
  ...patches: readonly (PrototypeExecutionOrchestrationPersistInput | null | undefined)[]
): PrototypeExecutionOrchestrationPersistInput {
  return mergeOrchestrationPersistPatches(...patches);
}

function buildVirtualState(input: QuickRunGithubAdvanceContext): RequirementsStateJson {
  return mergeRequirementsStateJson(
    {
      promptTimeline: input.promptTimeline ?? [],
      implementationQuickRunV1: input.quickRun,
      implementationTaskListV1: input.implementationTaskListV1,
      implementationCodeTaskPlanV1: input.implementationCodeTaskPlanV1,
      codeTaskExecutionRunsV1: input.codeTaskExecutionRunsV1,
      implementationTaskExecutionStateV1: input.implementationTaskExecutionStateV1,
      implementationQualityGateResultsV1: input.implementationQualityGateResultsV1,
      implementationAutoQualityGateV1: input.implementationAutoQualityGateV1,
      implementationAutoQualityGateHistoryV1: input.implementationAutoQualityGateHistoryV1,
      cursorWorkItemsV1: input.cursorWorkItemsV1,
    },
    input.basePatch as Partial<RequirementsStateJson>,
  );
}

/** GitHub verify 성공 후 Quick Run: auto gate + 다음 CodeTask continuation을 서버에서 한 번에 orchestration patch로 합친다. */
export function advanceQuickRunOrchestrationAfterGithubVerify(
  input: QuickRunGithubAdvanceContext,
): QuickRunGithubAdvanceResult {
  const pid = input.projectId.trim();
  if (!input.githubVerifyOk || !pid) {
    return { orchestrationPatch: input.basePatch, nextDispatch: null };
  }

  const quickRun = parseImplementationQuickRunV1(input.quickRun);
  if (!quickRun || quickRun.status !== "running") {
    return { orchestrationPatch: input.basePatch, nextDispatch: null };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  let state = buildVirtualState(input);
  const execution = parseTaskCursorExecutionV1(state.taskCursorExecutionV1);
  if (!execution) {
    return { orchestrationPatch: input.basePatch, nextDispatch: null };
  }

  const quickRunSync: PrototypeExecutionOrchestrationPersistInput = {
    implementationQuickRunV1: syncImplementationQuickRunWithExecution({
      quickRun,
      taskCursorExecution: execution,
      autoGate: parseImplementationAutoQualityGateV1(state.implementationAutoQualityGateV1),
      nowIso,
    }),
  };
  state = mergeRequirementsStateJson(state, quickRunSync as Partial<RequirementsStateJson>);

  const taskList = parseImplementationTaskListV1(state.implementationTaskListV1);
  if (!taskList) {
    return {
      orchestrationPatch: mergeOrchestrationPatches(input.basePatch, quickRunSync),
      nextDispatch: null,
    };
  }

  let patches: PrototypeExecutionOrchestrationPersistInput[] = [input.basePatch, quickRunSync];
  let autoGatePassed = false;

  state = mergeRequirementsStateJson(state, input.basePatch as Partial<RequirementsStateJson>);

  const autoGateBefore = parseImplementationAutoQualityGateV1(state.implementationAutoQualityGateV1);
  const executionForGate =
    parseTaskCursorExecutionV1(state.taskCursorExecutionV1) ?? execution;
  const shouldRunGate =
    shouldAutoStartImplementationQualityGate({
      taskCursorExecution: executionForGate,
      autoGate: autoGateBefore,
    }) ||
    shouldResumeImplementationAutoQualityGate({
      taskCursorExecution: executionForGate,
      autoGate: autoGateBefore,
    });

  if (shouldRunGate) {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: pid,
      orchestration: {
        implementationTaskListV1: taskList,
        implementationTaskExecutionStateV1: parseImplementationTaskExecutionStateV1(
          state.implementationTaskExecutionStateV1,
        ),
        implementationQualityGateResultsV1: parseImplementationQualityGateResultsV1(
          state.implementationQualityGateResultsV1,
        ) as readonly ImplementationQualityGateResultV1[] | null | undefined,
      },
    });
    const outcome = runImplementationAutoQualityGate({
      projectId: pid,
      taskCursorExecution: executionForGate,
      taskList,
      executionState: parseImplementationTaskExecutionStateV1(state.implementationTaskExecutionStateV1),
      qualityGateResults: parseImplementationQualityGateResultsV1(
        state.implementationQualityGateResultsV1,
      ) as readonly ImplementationQualityGateResultV1[] | null | undefined,
      cursorWorkItems: state.cursorWorkItemsV1 ?? [],
      board: board ?? undefined,
      existingTimeline: state.promptTimeline,
      existingAutoQualityGateHistory:
        parseImplementationAutoQualityGateHistoryV1(state.implementationAutoQualityGateHistoryV1) ??
        undefined,
      nowIso,
    });
    if (!("blocked" in outcome)) {
      patches.push(outcome.orchestrationPatch);
      state = mergeRequirementsStateJson(state, outcome.orchestrationPatch as Partial<RequirementsStateJson>);
      if (outcome.ok && outcome.autoGate.status === "passed") {
        autoGatePassed = true;
      }
    }
  } else {
    autoGatePassed = isAutoGatePassedForExecution(
      parseTaskCursorExecutionV1(state.taskCursorExecutionV1)!,
      parseImplementationAutoQualityGateV1(state.implementationAutoQualityGateV1),
    );
  }

  if (!autoGatePassed) {
    return { orchestrationPatch: mergeOrchestrationPatches(...patches), nextDispatch: null };
  }

  const dbBundle = input.dbBundle ?? null;

  const postQuickRun = parseImplementationQuickRunV1(state.implementationQuickRunV1);
  const postExecution = parseTaskCursorExecutionV1(state.taskCursorExecutionV1);
  const postAutoGate = parseImplementationAutoQualityGateV1(state.implementationAutoQualityGateV1);
  const runs = parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [];

  if (
    !postQuickRun ||
    !postExecution ||
    !postAutoGate ||
    !shouldPlanQuickRunCodeTaskContinuationAfterAutoGate({
      quickRun: postQuickRun,
      taskCursorExecution: postExecution,
      autoGate: postAutoGate,
      runs,
      codeTaskPlan: parseImplementationCodeTaskPlanV1(state.implementationCodeTaskPlanV1),
      taskList,
      cursorWorkItems: state.cursorWorkItemsV1,
      dbBundle,
    })
  ) {
    return { orchestrationPatch: mergeOrchestrationPatches(...patches), nextDispatch: null };
  }

  const plan = planQuickRunCodeTaskContinuationAfterAutoGate({
    projectId: pid,
    quickRun: postQuickRun,
    taskCursorExecution: postExecution,
    autoGate: postAutoGate,
    runs,
    codeTaskPlan: parseImplementationCodeTaskPlanV1(state.implementationCodeTaskPlanV1),
    taskList,
    cursorWorkItems: state.cursorWorkItemsV1,
    dbBundle,
    baseState: state as Record<string, unknown>,
    nowIso,
  });

  if (!plan) {
    return { orchestrationPatch: mergeOrchestrationPatches(...patches), nextDispatch: null };
  }

  const continuationPatch: PrototypeExecutionOrchestrationPersistInput = {
    ...plan.orchestrationPatch,
    promptTimeline: appendPromptTimeline(state.promptTimeline ?? [], plan.timelineEntry),
  };
  patches.push(continuationPatch);

  return {
    orchestrationPatch: mergeOrchestrationPatches(...patches),
    nextDispatch: {
      codeTaskId: plan.dispatch.codeTaskId,
      parentTaskId: plan.dispatch.parentTaskId,
      workItemId: plan.dispatch.workItemId,
      triggerKey: plan.triggerKey,
    },
  };
}
