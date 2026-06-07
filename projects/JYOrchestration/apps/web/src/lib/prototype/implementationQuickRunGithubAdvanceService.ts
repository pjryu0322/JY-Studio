import {
  applyAutoGateOutcomeToRunsList,
  applyQualityGateRunningToRunsList,
} from "@/lib/prototype/codeTaskQualityOutcome";
import { findLatestRunForCodeTask, parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
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
  planQuickRunContinuationAfterVerifiedGithubOutcome,
  shouldPlanQuickRunCodeTaskContinuationAfterAutoGate,
} from "@/lib/prototype/implementationQuickRunCodeTaskContinuation";
import {
  resolveNextQuickRunCodeTaskId,
  resolveSelectedCodeTaskIdsForContinuationContext,
} from "@/lib/prototype/implementationSelectedCodeTaskSequence";
import { resolveNextSelectedCodeTaskAfterVerified } from "@/lib/prototype/resolveNextSelectedCodeTaskAfterVerified";
import { isRunSuccessTerminalForSelectedQueueContinuation } from "@/lib/prototype/codeTaskQuickRunContinuationTerminal";
import {
  buildQuickRunAllSelectedCodeTasksCompletedTimelineEntry,
  buildQuickRunContinuationNoopTimelineEntry,
  buildQuickRunContinuationRequestedTimelineEntry,
  buildQuickRunSelectedQueueReconciledTimelineEntry,
  buildQuickRunNextCodeTaskBlockedTimelineEntry,
  buildQuickRunNextCodeTaskDispatchRequestedTimelineEntry,
  buildQuickRunNextCodeTaskResolvedTimelineEntry,
} from "@/lib/prototype/quickRunVerifiedContinuationTimeline";
import { resolveStaleTaskCursorAfterQualityGatePassed } from "@/lib/prototype/taskCursorQuickRunInflightPolicy";
import {
  parseImplementationQuickRunV1,
  syncImplementationQuickRunWithExecution,
  shouldAllowTaskCursorAutoChain,
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
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { runHasVerifiedGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
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
  readonly codeTaskExecutionQueueV1?: unknown;
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
      codeTaskExecutionQueueV1: input.codeTaskExecutionQueueV1,
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

  const taskList =
    parseImplementationTaskListV1(state.implementationTaskListV1) ??
    parseImplementationTaskListV1(input.implementationTaskListV1);
  if (!taskList && !input.githubVerifyOk) {
    return {
      orchestrationPatch: mergeOrchestrationPatches(input.basePatch, quickRunSync),
      nextDispatch: null,
    };
  }

  let patches: PrototypeExecutionOrchestrationPersistInput[] = [input.basePatch, quickRunSync];
  let autoGatePassed = false;

  state = mergeRequirementsStateJson(state, input.basePatch as Partial<RequirementsStateJson>);

  const dbBundle = input.dbBundle ?? null;

  const autoGateBefore = parseImplementationAutoQualityGateV1(state.implementationAutoQualityGateV1);
  const executionForGate =
    parseTaskCursorExecutionV1(state.taskCursorExecutionV1) ?? execution;
  const runsForGate = parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [];
  const codeTaskIdForGate =
    dbBundle?.currentRun?.codeTaskId?.trim() ||
    dbBundle?.job?.currentCodeTaskId?.trim() ||
    "";
  const runForGate = codeTaskIdForGate
    ? findLatestRunForCodeTask(runsForGate, codeTaskIdForGate)
    : runsForGate[runsForGate.length - 1] ?? null;

  const shouldRunGate =
    !input.githubVerifyOk &&
    (shouldAutoStartImplementationQualityGate({
      taskCursorExecution: executionForGate,
      autoGate: autoGateBefore,
      codeTaskRun: runForGate,
    }) ||
      shouldResumeImplementationAutoQualityGate({
        taskCursorExecution: executionForGate,
        autoGate: autoGateBefore,
      }));

  if (shouldRunGate && runForGate && runHasVerifiedGithubOutcome(runForGate)) {
    const runsRunning = applyQualityGateRunningToRunsList({
      runs: parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [],
      codeTaskId: runForGate.codeTaskId,
      nowIso,
    });
    const runningPatch: PrototypeExecutionOrchestrationPersistInput = {
      codeTaskExecutionRunsV1: runsRunning,
    };
    patches.push(runningPatch);
    state = mergeRequirementsStateJson(state, runningPatch as Partial<RequirementsStateJson>);

    const gateRequestTimeline = buildImplementationExecutionLogTimelineEntry({
      action: "code_task_github_verified_auto_gate_requested",
      orchestrationTraceGroup: "implementation_orchestration",
      routingDecision: runForGate.processTaskId,
      fields: {
        runId: runForGate.runId,
        codeTaskId: runForGate.codeTaskId,
        workBranch: runForGate.workBranch ?? null,
        commitSha: String(runForGate.commitSha ?? "").trim().slice(0, 12),
      },
      nowIso,
    });
    const timelinePatch: PrototypeExecutionOrchestrationPersistInput = {
      promptTimeline: appendPromptTimeline(state.promptTimeline ?? [], gateRequestTimeline),
    };
    patches.push(timelinePatch);
    state = mergeRequirementsStateJson(state, timelinePatch as Partial<RequirementsStateJson>);
  }

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
        const runsBefore = parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [];
        const codeTaskIdForQuality = runForGate?.codeTaskId?.trim() || codeTaskIdForGate.trim();
        if (codeTaskIdForQuality && runsBefore.length) {
          const runsWithQuality = applyAutoGateOutcomeToRunsList({
            runs: runsBefore,
            codeTaskId: codeTaskIdForQuality,
            autoGate: outcome.autoGate,
            nowIso,
          });
          const qualityPatch: PrototypeExecutionOrchestrationPersistInput = {
            codeTaskExecutionRunsV1: runsWithQuality,
          };
          patches.push(qualityPatch);
          state = mergeRequirementsStateJson(state, qualityPatch as Partial<RequirementsStateJson>);
        }
      }
    }
  } else {
    autoGatePassed = isAutoGatePassedForExecution(
      parseTaskCursorExecutionV1(state.taskCursorExecutionV1)!,
      parseImplementationAutoQualityGateV1(state.implementationAutoQualityGateV1),
    );
  }

  let nextDispatch: QuickRunGithubAdvanceDispatch | null = null;

  if (autoGatePassed) {
    const postExecutionForRepair = parseTaskCursorExecutionV1(state.taskCursorExecutionV1);
    if (postExecutionForRepair) {
      const repairedCursor = resolveStaleTaskCursorAfterQualityGatePassed({
        taskCursor: postExecutionForRepair,
        completedTaskId: postExecutionForRepair.taskId,
        autoGateRaw: state.implementationAutoQualityGateV1,
        runs: parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [],
        completedCodeTaskId: codeTaskIdForGate || runForGate?.codeTaskId,
        nowIso,
      });
      if (repairedCursor) {
        const repairPatch: PrototypeExecutionOrchestrationPersistInput = {
          taskCursorExecutionV1: repairedCursor,
        };
        patches.push(repairPatch);
        state = mergeRequirementsStateJson(state, repairPatch as Partial<RequirementsStateJson>);
      }
    }

    const postQuickRun = parseImplementationQuickRunV1(state.implementationQuickRunV1);
    const postExecution = parseTaskCursorExecutionV1(state.taskCursorExecutionV1);
    const postAutoGate = parseImplementationAutoQualityGateV1(state.implementationAutoQualityGateV1);
    const runs = parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [];

    if (
      postQuickRun &&
      postExecution &&
      postAutoGate &&
      shouldPlanQuickRunCodeTaskContinuationAfterAutoGate({
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

      if (plan) {
        const continuationPatch: PrototypeExecutionOrchestrationPersistInput = {
          ...plan.orchestrationPatch,
          promptTimeline: appendPromptTimeline(state.promptTimeline ?? [], plan.timelineEntry),
        };
        patches.push(continuationPatch);
        state = mergeRequirementsStateJson(state, continuationPatch as Partial<RequirementsStateJson>);
        nextDispatch = {
          codeTaskId: plan.dispatch.codeTaskId,
          parentTaskId: plan.dispatch.parentTaskId,
          workItemId: plan.dispatch.workItemId,
          triggerKey: plan.triggerKey,
        };
      }
    }
  }

    if (!nextDispatch && input.githubVerifyOk) {
    const runsNow = parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [];
    let verifiedCodeTaskId =
      codeTaskIdForGate.trim() || String(runForGate?.codeTaskId ?? "").trim();
    if (!verifiedCodeTaskId || !runHasVerifiedGithubOutcome(findLatestRunForCodeTask(runsNow, verifiedCodeTaskId))) {
      const fromRuns = runsNow.find((r) => runHasVerifiedGithubOutcome(r));
      verifiedCodeTaskId = fromRuns?.codeTaskId?.trim() ?? verifiedCodeTaskId;
    }
    const verifiedRun = verifiedCodeTaskId
      ? findLatestRunForCodeTask(runsNow, verifiedCodeTaskId)
      : null;
    const postQuickRun = parseImplementationQuickRunV1(state.implementationQuickRunV1);
    const postExecution = parseTaskCursorExecutionV1(state.taskCursorExecutionV1);
    const selection = resolveSelectedCodeTaskIdsForContinuationContext({
      dbBundle,
      codeTaskExecutionQueueV1: state.codeTaskExecutionQueueV1,
    });
    const selectedCodeTaskIds = selection.selectedCodeTaskIds;
    const codeTaskPlanParsed = parseImplementationCodeTaskPlanV1(state.implementationCodeTaskPlanV1);
    const quickRunActive = shouldAllowTaskCursorAutoChain({
      quickRun: postQuickRun,
      taskCursorExecution: postExecution,
    });

    if (
      verifiedCodeTaskId &&
      verifiedRun &&
      runHasVerifiedGithubOutcome(verifiedRun) &&
      postQuickRun &&
      postExecution &&
      quickRunActive
    ) {
      let completedCodeTaskCount = 0;
      for (const id of selectedCodeTaskIds) {
        const run = findLatestRunForCodeTask(runsNow, id);
        if (isRunSuccessTerminalForSelectedQueueContinuation(run)) completedCodeTaskCount += 1;
      }

      const continuationTimeline: RequirementsPromptTimelineEntry[] = [];
      if (
        selection.source === "reconciled" ||
        (selection.dbSelectedCount === 0 && selection.runtimeSelectedCount > 0)
      ) {
        continuationTimeline.push(
          buildQuickRunSelectedQueueReconciledTimelineEntry({
            projectId: pid,
            dbSelectedCount: selection.dbSelectedCount,
            runtimeSelectedCount: selection.runtimeSelectedCount,
            resolvedSelectedCount: selection.resolvedSelectedCount,
            source: selection.source,
            nowIso,
          }),
        );
      }
      continuationTimeline.push(
        buildQuickRunContinuationRequestedTimelineEntry({
          projectId: pid,
          currentCodeTaskId: verifiedCodeTaskId,
          selectedCodeTaskIds,
          completedCodeTaskCount,
          reason: "previous_github_outcome_verified",
          runId: verifiedRun.runId,
          previousCommitSha: verifiedRun.commitSha ?? verifiedRun.branchHeadCommitSha,
          previousWorkBranch: verifiedRun.workBranch,
          nowIso,
        }),
      );

      const resolved = resolveNextSelectedCodeTaskAfterVerified({
        selectedCodeTaskIds,
        currentCodeTaskId: verifiedCodeTaskId,
        codeTaskPlan: codeTaskPlanParsed,
        executionRuns: runsNow,
      });

      continuationTimeline.push(
        buildQuickRunNextCodeTaskResolvedTimelineEntry({
          projectId: pid,
          currentCodeTaskId: verifiedCodeTaskId,
          selectedCodeTaskIds,
          completedCodeTaskCount,
          resolved,
          nowIso,
        }),
      );

      if (resolved.status === "next_ready") {
        const nextTask = codeTaskPlanParsed?.tasks.find((t) => t.codeTaskId === resolved.codeTaskId);
      const plan = planQuickRunContinuationAfterVerifiedGithubOutcome({
        projectId: pid,
        verifiedCodeTaskId,
        quickRun: postQuickRun,
        taskCursorExecution: postExecution,
        runs: runsNow,
        codeTaskPlan: codeTaskPlanParsed,
        taskList: taskList ?? null,
        cursorWorkItems: state.cursorWorkItemsV1,
        dbBundle,
        baseState: state as Record<string, unknown>,
        nowIso,
      });
        if (plan) {
          continuationTimeline.push(
            buildQuickRunNextCodeTaskDispatchRequestedTimelineEntry({
              projectId: pid,
              currentCodeTaskId: verifiedCodeTaskId,
              nextCodeTaskId: plan.nextCodeTaskId,
              selectedCodeTaskIds,
              completedCodeTaskCount,
              reason: "previous_github_outcome_verified",
              nextBaseBranch: nextTask?.branchPlan?.baseBranch ?? null,
              nextWorkBranch: nextTask?.branchPlan?.workBranch ?? null,
              nowIso,
            }),
          );
          const continuationPatch: PrototypeExecutionOrchestrationPersistInput = {
            ...plan.orchestrationPatch,
            promptTimeline: appendPromptTimeline(state.promptTimeline ?? [], [
              ...continuationTimeline,
              plan.timelineEntry,
            ]),
          };
          patches.push(continuationPatch);
          state = mergeRequirementsStateJson(state, continuationPatch as Partial<RequirementsStateJson>);
          nextDispatch = {
            codeTaskId: plan.dispatch.codeTaskId,
            parentTaskId: plan.dispatch.parentTaskId,
            workItemId: plan.dispatch.workItemId,
            triggerKey: plan.triggerKey,
          };
        } else {
          patches.push({
            promptTimeline: appendPromptTimeline(state.promptTimeline ?? [], continuationTimeline),
          });
        }
      } else if (resolved.status === "all_completed") {
        continuationTimeline.push(
          buildQuickRunAllSelectedCodeTasksCompletedTimelineEntry({
            projectId: pid,
            currentCodeTaskId: verifiedCodeTaskId,
            selectedCodeTaskIds,
            completedCodeTaskCount,
            nowIso,
          }),
        );
        patches.push({
          promptTimeline: appendPromptTimeline(state.promptTimeline ?? [], continuationTimeline),
        });
      } else {
        const blocked = buildQuickRunNextCodeTaskBlockedTimelineEntry({
          projectId: pid,
          currentCodeTaskId: verifiedCodeTaskId,
          selectedCodeTaskIds,
          completedCodeTaskCount,
          resolved,
          nowIso,
        });
        if (blocked) continuationTimeline.push(blocked);
        patches.push({
          promptTimeline: appendPromptTimeline(state.promptTimeline ?? [], continuationTimeline),
        });
      }
    } else if (input.githubVerifyOk && shouldAllowTaskCursorAutoChain({ quickRun: postQuickRun, taskCursorExecution: postExecution })) {
      patches.push({
        promptTimeline: appendPromptTimeline(state.promptTimeline ?? [], [
          buildQuickRunContinuationNoopTimelineEntry({
            projectId: pid,
            currentCodeTaskId: verifiedCodeTaskId || null,
            selectedCodeTaskIds,
            reason: verifiedCodeTaskId ? "verified_run_not_ready_for_continuation" : "verified_code_task_unresolved",
            nowIso,
          }),
        ]),
      });
    }
  }

  return {
    orchestrationPatch: mergeOrchestrationPatches(...patches),
    nextDispatch,
  };
}
