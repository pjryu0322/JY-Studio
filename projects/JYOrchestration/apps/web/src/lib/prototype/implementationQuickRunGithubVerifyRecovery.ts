import type { CodeTaskExecutionQueueV1 } from "@/lib/prototype/codeTaskExecutionQueue";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import type { QuickRunGithubAdvanceDispatch } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import { parseImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import {
  buildQuickRunStuckGithubVerifyDedupeKey,
  buildGithubVerifyExecutionForCodeTask,
  mergeCodeTaskRunsWithDbRuntime,
  resolveQuickRunStuckGithubVerifyTarget,
} from "@/lib/prototype/implementationQuickRunStuckGithubRecovery";
import {
  findLatestRunForCodeTask,
  CODE_TASK_EXECUTION_RUN_VERSION,
  parseCodeTaskExecutionRunsV1,
} from "@/lib/prototype/codeTaskExecutionRun";
import {
  applyTaskCursorGithubVerifyApiResult,
  buildTaskCursorGithubVerifyRequestBody,
  postTaskCursorGithubVerify,
  resolveTaskCursorGithubVerifyUserNotice,
} from "@/lib/prototype/taskCursorGithubVerifyClient";
import { resolveFirstIncompleteSelectedCodeTaskId } from "@/lib/prototype/codeTaskExecutionQueue";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import type { PrototypeExecutionOrchestrationPersistInput } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  formatGithubVerifyCheckingToast,
  resolveGithubVerifyToastTaskLabel,
} from "@/lib/prototype/taskCursorGithubVerifyDisplay";
import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  resolveManualGithubRecheckPayload,
  type CodeTaskManualGithubRecheckPayloadV1,
} from "@/lib/prototype/codeTaskManualGithubRecheckPayload";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  buildImplementationToastDedupeKey,
  recordImplementationToastDedupe,
  shouldSuppressDuplicateImplementationToast,
} from "@/lib/prototype/implementationToastDedupe";

export type QuickRunGithubVerifyRecoveryInput = Readonly<{
  readonly projectId: string;
  readonly state: RequirementsStateJson;
  readonly effectiveQueue: CodeTaskExecutionQueueV1 | null;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly stuckVerifyDedupeRef: { current: string | null };
  readonly continuationTriggerRef: { current: string | null };
  readonly enrichPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput,
  ) => PrototypeExecutionOrchestrationPersistInput;
  readonly applyOrchestrationPatch: (patch: PrototypeExecutionOrchestrationPersistInput) => void;
  readonly onNextQuickRunDispatch: (dispatch: QuickRunGithubAdvanceDispatch) => void;
  readonly showToast: (message: string) => void;
  readonly onFailureNotice?: (message: string) => void;
  readonly refreshRuntime?: () => void | Promise<void>;
  /** 사용자 수동 재확인 — dedupe 무시 */
  readonly force?: boolean;
  readonly toastDedupeKeyRef?: { current: string | null };
  readonly toastDedupeAtRef?: { current: number };
}>;

/** Quick Run stuck 시 GitHub verify + 서버 advance. 대상 없으면 false. */
export async function runQuickRunStuckGithubVerifyRecovery(
  input: QuickRunGithubVerifyRecoveryInput,
): Promise<boolean> {
  const pid = input.projectId.trim();
  if (!pid) return false;

  const quickRun = parseImplementationQuickRunV1(input.state.implementationQuickRunV1);
  const queue = input.effectiveQueue;
  const runs = parseCodeTaskExecutionRunsV1(input.state.codeTaskExecutionRunsV1) ?? [];
  const execution = resolveQuickRunStuckGithubVerifyTarget({
    projectId: pid,
    quickRun,
    queue,
    runs,
    codeTaskPlan: input.state.implementationCodeTaskPlanV1,
    taskCursorExecution: parseTaskCursorExecutionV1(input.state.taskCursorExecutionV1),
    taskCursorExecutionHistory: input.state.taskCursorExecutionHistoryV1,
    dbBundle: input.dbBundle,
  });
  if (!execution || !queue) return false;

  const codeTaskId =
    resolveFirstIncompleteSelectedCodeTaskId({ queue, runs }) ??
    String(queue.selectedCodeTaskIds[queue.currentIndex] ?? "").trim();
  if (!codeTaskId) return false;

  const dedupe = buildQuickRunStuckGithubVerifyDedupeKey(execution, codeTaskId);
  if (!input.force && input.stuckVerifyDedupeRef.current === dedupe) return false;
  if (input.force) {
    input.stuckVerifyDedupeRef.current = null;
  }
  input.stuckVerifyDedupeRef.current = dedupe;

  const codeTaskPlan = parseImplementationCodeTaskPlanV1(input.state.implementationCodeTaskPlanV1);
  const toastLabel = resolveGithubVerifyToastTaskLabel({
    executionTaskId: execution.taskId,
    codeTaskId,
    codeTaskPlan,
  });
  const checkingToast = formatGithubVerifyCheckingToast(toastLabel.label);
  const toastKey = buildImplementationToastDedupeKey({
    taskId: toastLabel.label,
    status: execution.status,
    message: checkingToast,
  });
  const keyRef = input.toastDedupeKeyRef ?? { current: null };
  const atRef = input.toastDedupeAtRef ?? { current: 0 };
  if (
    input.force ||
    !shouldSuppressDuplicateImplementationToast({
      key: toastKey,
      lastKeyRef: keyRef,
      lastAtRef: atRef,
    })
  ) {
    recordImplementationToastDedupe({ key: toastKey, lastKeyRef: keyRef, lastAtRef: atRef });
    input.showToast(checkingToast);
    if (toastLabel.clearedStaleMock) {
      input.applyOrchestrationPatch(
        input.enrichPatch({
          promptTimeline: [
            buildImplementationExecutionLogTimelineEntry({
              action: "task_cursor_stale_mock_polling_cleared",
              orchestrationTraceGroup: "task_cursor_execution",
              routingDecision: toastLabel.label,
              fields: {
                projectId: pid,
                fromTaskId: execution.taskId,
                toTaskId: toastLabel.label,
                codeTaskId,
              },
            }),
          ],
        }),
      );
    }
  }
  try {
    const json = await postTaskCursorGithubVerify(
      buildTaskCursorGithubVerifyRequestBody({
        projectId: pid,
        execution,
        state: input.state,
        codeTaskId,
      }),
    );
    const ok = applyTaskCursorGithubVerifyApiResult({
      json,
      enrichPatch: input.enrichPatch,
      applyOrchestrationPatch: input.applyOrchestrationPatch,
      shouldApplyNextDispatch: (next) => input.continuationTriggerRef.current !== next.triggerKey,
      onNextQuickRunDispatch: (next) => {
        input.continuationTriggerRef.current = next.triggerKey;
        input.onNextQuickRunDispatch(next);
      },
    });
    void input.refreshRuntime?.();
    const notice = resolveTaskCursorGithubVerifyUserNotice(json);
    const transientPending =
      !ok &&
      (json.verify?.detailReason === "branch_not_found" ||
        json.verify?.detailReason === "commit_not_found" ||
        json.verify?.reason === "commit_not_created");
    if (!ok && !transientPending) {
      input.stuckVerifyDedupeRef.current = null;
      input.onFailureNotice?.(notice);
    }
    if (ok || !transientPending) {
      input.showToast(notice);
    }
    return ok;
  } catch (error) {
    input.stuckVerifyDedupeRef.current = null;
    const message = error instanceof Error ? error.message : String(error);
    input.showToast(`GitHub 확인 오류: ${message}`);
    return false;
  }
}

export type CodeTaskGithubVerifyRecheckInput = Readonly<{
  readonly projectId: string;
  readonly codeTaskId: string;
  readonly state: RequirementsStateJson;
  readonly dbBundle?: ImplementationRuntimeBundleView | null;
  readonly executionSetup?: Readonly<{
    readonly gitRepoUrl?: string | null;
    readonly gitRepoName?: string | null;
    readonly gitRepoProvider?: string | null;
    readonly baseBranch?: string | null;
  }> | null;
  readonly taskList?: ImplementationTaskListV1 | null;
  readonly executionUnits?: readonly ImplementationExecutionUnitV1[] | null;
  readonly rowPayload?: CodeTaskManualGithubRecheckPayloadV1 | null;
  readonly continuationTriggerRef: { current: string | null };
  readonly enrichPatch: (
    patch: PrototypeExecutionOrchestrationPersistInput,
  ) => PrototypeExecutionOrchestrationPersistInput;
  readonly applyOrchestrationPatch: (patch: PrototypeExecutionOrchestrationPersistInput) => void;
  readonly onNextQuickRunDispatch: (dispatch: QuickRunGithubAdvanceDispatch) => void;
  readonly showToast: (message: string) => void;
  readonly onFailureNotice?: (message: string) => void;
  readonly refreshRuntime?: () => void | Promise<void>;
}>;

/** CodeTask row GitHub 재확인 — poll dedupe 없이 verify-github 1회 */
export async function runCodeTaskGithubVerifyRecheck(
  input: CodeTaskGithubVerifyRecheckInput,
): Promise<boolean> {
  const pid = input.projectId.trim();
  const codeTaskId = input.codeTaskId.trim();
  if (!pid || !codeTaskId) return false;

  const resolved = resolveManualGithubRecheckPayload({
    projectId: pid,
    codeTaskId,
    requirementsState: input.state,
    dbBundle: input.dbBundle,
    executionSetup: input.executionSetup,
    taskList: input.taskList,
    cursorWorkItems: input.state.cursorWorkItemsV1,
    executionUnits: input.executionUnits,
    hints: input.rowPayload ?? undefined,
  });

  const codeTaskPlan = resolved.codeTaskPlan;
  const manualPayload = resolved.payload;
  const jsonRuns = parseCodeTaskExecutionRunsV1(input.state.codeTaskExecutionRunsV1) ?? [];
  const mergedRuns = mergeCodeTaskRunsWithDbRuntime({
    jsonRuns,
    dbBundle: input.dbBundle,
    codeTaskPlan,
  });

  const execution = buildGithubVerifyExecutionForCodeTask({
    projectId: pid,
    codeTaskId,
    runs: mergedRuns,
    codeTaskPlan,
    taskCursorExecution: parseTaskCursorExecutionV1(input.state.taskCursorExecutionV1),
    taskCursorExecutionHistory: input.state.taskCursorExecutionHistoryV1,
    dbBundle: input.dbBundle,
    manualPayload,
  });

  const workBranch = String(manualPayload?.workBranch ?? execution?.workBranch ?? "").trim();
  if (!execution || !workBranch) {
    input.applyOrchestrationPatch(
      input.enrichPatch({
        promptTimeline: [
          buildImplementationExecutionLogTimelineEntry({
            action: "manual_github_commit_recheck_missing_execution_info",
            orchestrationTraceGroup: "task_cursor_execution",
            routingDecision: codeTaskId,
            fields: {
              projectId: pid,
              codeTaskId,
              missing: resolved.missing.join(",") || "workBranch",
            },
          }),
          buildImplementationExecutionLogTimelineEntry({
            action: "manual_github_commit_recheck_failed",
            orchestrationTraceGroup: "task_cursor_execution",
            routingDecision: codeTaskId,
            fields: {
              projectId: pid,
              codeTaskId,
              workBranch: workBranch || undefined,
              reason: "execution_context_unavailable",
            },
          }),
        ],
      }),
    );
    input.onFailureNotice?.(
      "GitHub 확인에 필요한 작업 브랜치 정보를 찾지 못했습니다. 작업 정보를 새로고침한 뒤 다시 확인해 주세요.",
    );
    return false;
  }

  if (manualPayload) {
    input.applyOrchestrationPatch(
      input.enrichPatch({
        promptTimeline: [
          buildImplementationExecutionLogTimelineEntry({
            action: "manual_github_commit_recheck_payload_resolved",
            orchestrationTraceGroup: "task_cursor_execution",
            routingDecision: codeTaskId,
            fields: {
              projectId: pid,
              codeTaskId,
              repository: manualPayload.repositoryFullName,
              branch: manualPayload.workBranch,
              baseBranch: manualPayload.baseBranch,
              taskId: manualPayload.taskId,
            },
          }),
        ],
      }),
    );
  }

  let runsForVerify = [...mergedRuns];
  if (!findLatestRunForCodeTask(runsForVerify, codeTaskId)) {
    const planTask = codeTaskPlan?.tasks.find((t) => t.codeTaskId === codeTaskId);
    const parentTaskId = planTask?.parentTaskId?.trim() ?? "";
    if (parentTaskId) {
      runsForVerify = [
        ...runsForVerify,
        {
          version: CODE_TASK_EXECUTION_RUN_VERSION,
          runId: `manual-recheck-${codeTaskId}`,
          projectId: pid,
          processTaskId: parentTaskId,
          workItemId: "",
          codeTaskId,
          status: "github_verifying" as const,
          attemptNo: 1,
          cursorRunId: execution.cursorRunId,
          workBranch: execution.workBranch,
          baseBranch: execution.baseBranch,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    }
  }

  const stateForVerify: RequirementsStateJson = {
    ...input.state,
    codeTaskExecutionRunsV1: runsForVerify,
  };

  input.applyOrchestrationPatch(
    input.enrichPatch({
      promptTimeline: [
        buildImplementationExecutionLogTimelineEntry({
          action: "manual_github_commit_recheck_started",
          orchestrationTraceGroup: "task_cursor_execution",
          routingDecision: codeTaskId,
          fields: {
            projectId: pid,
            codeTaskId,
            workBranch,
            taskId: execution.taskId,
          },
        }),
      ],
    }),
  );

  const toastLabel = resolveGithubVerifyToastTaskLabel({
    executionTaskId: execution.taskId,
    codeTaskId,
    codeTaskPlan,
  });
  input.showToast(formatGithubVerifyCheckingToast(toastLabel.label));

  const manualRecheckFailureNotice =
    "GitHub commit을 아직 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.";

  try {
    const json = await postTaskCursorGithubVerify(
      buildTaskCursorGithubVerifyRequestBody({
        projectId: pid,
        execution: { ...execution, status: "github_verifying" },
        state: stateForVerify,
        codeTaskId,
        manualGithubRecheck: true,
        manualRecheckPayload: manualPayload ?? undefined,
      }),
    );
    const ok = applyTaskCursorGithubVerifyApiResult({
      json,
      enrichPatch: input.enrichPatch,
      applyOrchestrationPatch: input.applyOrchestrationPatch,
      shouldApplyNextDispatch: (next) => input.continuationTriggerRef.current !== next.triggerKey,
      onNextQuickRunDispatch: (next) => {
        input.continuationTriggerRef.current = next.triggerKey;
        input.onNextQuickRunDispatch(next);
      },
    });
    await input.refreshRuntime?.();
    const notice = resolveTaskCursorGithubVerifyUserNotice(json);
    const transientPending =
      !ok &&
      (json.verify?.detailReason === "branch_not_found" ||
        json.verify?.detailReason === "commit_not_found" ||
        json.verify?.reason === "commit_not_created");
    const commitSha = String(json.verify?.verifiedCommitSha ?? json.commitSha ?? "").trim();
    const followUpTimeline = ok
      ? [
          buildImplementationExecutionLogTimelineEntry({
            action: "github_branch_head_commit_found",
            orchestrationTraceGroup: "task_cursor_execution",
            routingDecision: codeTaskId,
            fields: { codeTaskId, workBranch, commitSha },
          }),
          buildImplementationExecutionLogTimelineEntry({
            action: "github_outcome_saved",
            orchestrationTraceGroup: "task_cursor_execution",
            routingDecision: codeTaskId,
            fields: { codeTaskId, commitSha },
          }),
          buildImplementationExecutionLogTimelineEntry({
            action: "codetask_completed",
            orchestrationTraceGroup: "task_cursor_execution",
            routingDecision: codeTaskId,
            fields: { codeTaskId, status: "completed", progress: "completed" },
          }),
        ]
      : !transientPending
        ? [
            buildImplementationExecutionLogTimelineEntry({
              action: "manual_github_commit_recheck_failed",
              orchestrationTraceGroup: "task_cursor_execution",
              routingDecision: codeTaskId,
              fields: {
                codeTaskId,
                workBranch,
                reason: "branch_head_commit_not_found",
              },
            }),
          ]
        : [];
    if (followUpTimeline.length) {
      input.applyOrchestrationPatch(
        input.enrichPatch({ promptTimeline: followUpTimeline }),
      );
    }
    if (!ok && !transientPending) {
      input.onFailureNotice?.(manualRecheckFailureNotice);
    }
    if (ok || !transientPending) {
      input.showToast(notice);
    }
    return ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    input.showToast(`GitHub 확인 오류: ${message}`);
    return false;
  }
}
