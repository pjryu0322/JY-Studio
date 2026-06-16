import { buildImplementationWipDraftLifecycleTimelineEntry } from "@/lib/prototype/codeAgentWipExecution";
import {
  buildCursorBridgeApiBlockedResult,
  buildCursorBridgeOrchestrationResult,
  patchWipForCursorBridgePhase,
} from "@/lib/prototype/prototypeExecutionCursorBridgeActions";
import { evaluateExecutionSetupSourceGenerationReadiness } from "@/lib/prototype/executionSetupSourceGeneration";
import { evaluateCursorExecutionAvailability } from "@/lib/prototype/cursorExecutionAvailability";
import { resolveTaskCursorExecutionEnvGate } from "@/lib/prototype/implementationBoardEnvDetailView";
import {
  buildTargetRepoE2eTimelineEntry,
  buildCursorApiDirectTimelineEntry,
  formatTargetRepoE2eDiagnosticLines,
  isCursorBridgeConfiguredForSourceGeneration,
} from "@/lib/prototype/targetRepoE2eDiagnostics";
import { CURSOR_API_NOT_CONFIGURED_MESSAGE } from "@/lib/prototype/cursorExecutionAvailability";
import { toCodeAgentTargetRepositorySnapshot } from "@/lib/prototype/projectTargetRepository";
import { executeCodeAgentWipWorkRequest } from "@/lib/prototype/prototypeExecutionWipChipHandlers";
import {
  resolveOrchestrationAwareRequirementsState,
  type ImplementationStageActionId,
} from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationStageActionRunResult } from "@/lib/prototype/implementationStageActionPipeline";
import { buildImplementationStageBoardGateContext } from "@/lib/prototype/implementationStageActionPipeline";
import type { MutableRefObject, RefObject } from "react";
import type { QuickRunGithubAdvanceDispatch } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import {
  buildImplementationCursorGateContext,
  evaluateImplementationCursorGate,
  formatImplementationCursorBlockedNotice,
} from "@/lib/prototype/prototypeExecutionTaskPlanActions";
import {
  appendPromptTimeline,
  type PrototypeExecutionOrchestrationPersistInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { sanitizeImplementationConversationMessages } from "@/lib/prototype/implementationOrchestrationSummary";
import {
  buildImplementationExecutionBoardFromRequirementsState,
  countTaskListWipCandidateTasks,
  formatTaskScopedWipExecutionBlockedNotice,
  type ImplementationRequirementsBoardOrchestrationSlice,
  selectCursorWorkItemsForWipExecution,
} from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationExecutionBoardMessage } from "@/lib/prototype/implementationExecutionBoardMessage";
import { markReworkRequestsAcceptedForTask } from "@/lib/prototype/implementationExecutionBoardState";
import {
  markDeveloperTasksFailedForWip,
  syncDeveloperTaskExecutionFromCodeAgentWip,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  hasTaskListForWipOrchestration,
  shouldUseTaskListBoardWipGate,
} from "@/lib/prototype/implementationTaskListBoardWipGate";
import {
  mergeCursorWorkItemsByTask,
  validateTaskScopedWorkItems,
} from "@/lib/prototype/implementationCursorWorkItems";
import {
  buildImplementationExecutionBlockedByPlanningGateTimelineEntry,
  evaluateImplementationPlanningExecutionGate,
  IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE,
} from "@/lib/prototype/implementationPlanningReadiness";
import { refineCursorWorkItemsForImplementation } from "@/lib/prototype/implementationWorkItemRefinement";
import {
  buildWorkItemPreflightTimelineEntry,
  formatWorkItemPreflightBlockedMessage,
  runWorkItemPreflightBatch,
} from "@/lib/prototype/implementationWorkItemPreflight";
import {
  appendPromptTimelineEntries,
  buildImplementationWipGenerationTimelineEntry,
  buildTaskListDerivedWipOrchestration,
  canUseTaskListForWipOrchestration,
  mergeTaskListWipRuntimeState,
  prepareWipRequestRuntime,
} from "@/lib/prototype/implementationTaskListWipPrep";
import { parseStringArrayJson } from "@/lib/executionLoop/loopJsonUtils";
import { readImplementationStageChatMessages } from "@/lib/prototype/implementationStageChatSnapshot";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import {
  buildTaskCursorExecutionRequest,
  buildTaskCursorFailedOrchestrationPatch,
  buildTaskCursorOrchestrationPatch,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import { isTaskCursorExecutePromptPreflightFailure } from "@/lib/prototype/taskCursorExecutePreflightResponse";
import {
  appendCodeTaskExecutionRun,
  findLatestRunForCodeTask,
  parseCodeTaskExecutionRunsV1,
  updateCodeTaskExecutionRun,
} from "@/lib/prototype/codeTaskExecutionRun";
import { prepareSelectedCodeTaskCursorExecution } from "@/lib/prototype/selectedCodeTaskCursorExecution";
import { fetchImplementationRuntime } from "@/lib/runtime/implementationRuntime/implementationRuntimeClient";
import {
  buildCodeTaskRunUserStatus,
  CODE_TASK_IN_FLIGHT_USER_MESSAGE,
} from "@/lib/prototype/codeTaskExecutionRunView";
import {
  parseImplementationQuickRunV1,
  resolveQuickRunAllowedTaskIds,
} from "@/lib/prototype/implementationQuickRun";
import {
  applyTaskCursorGithubVerifyApiResult,
  buildTaskCursorGithubVerifyRequestBody,
  postTaskCursorGithubVerify,
  resolveTaskCursorGithubVerifyUserNotice,
} from "@/lib/prototype/taskCursorGithubVerifyClient";
import {
  buildTaskCursorLaunchTransientFailurePatch,
  formatTransientTaskCursorLaunchErrorMessage,
  isTransientTaskCursorLaunchError,
  postTaskCursorExecuteWithRetry,
} from "@/lib/prototype/taskCursorLaunchRetry";
import { isActiveTaskCursorExecution } from "@/lib/prototype/taskCursorClientPollLoop";
import { parseTaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { resolvePrototypeExecutionSingleChatFromState } from "@/lib/prototype/prototypeExecutionSingleChatWire";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { fetchExecutionSetup } from "@/components/project-spec/apis/executionSetupApi";

export type ImplementationStageActionExecutionDispatchDeps = Readonly<{
  readonly projectId: string;
  readonly parsedRequirementsState: ReturnType<
    typeof import("@/lib/requirements/requirementsStateJson").parseRequirementsStateJson
  >;
  readonly pendingImplementationPatch: import("@/lib/prototype/effectiveImplementationState").PendingImplementationPatch | null;
  readonly effectiveImplementationState: ReturnType<
    typeof import("@/lib/prototype/effectiveImplementationState").resolveEffectiveImplementationState
  >;
  readonly executionSetupRow: import("@/lib/prototype/executionSetupSourceGeneration").ExecutionSetupSourceGenerationRow | null;
  readonly executionArtifacts: ReturnType<
    typeof import("@/lib/prototype/prototypeExecutionEnvSnapshot").pickExecutionStateArtifacts
  >;
  readonly orchestrationAwareRequirementsState: ReturnType<
    typeof resolveOrchestrationAwareRequirementsState
  >;
  readonly requirementsStateJson: unknown;
  readonly persistChatToDb: (
    chat?: unknown,
    patch?: unknown,
  ) => void | Promise<void>;
  readonly appendAiNoticeForImplementation: (text: string) => void;
  readonly appendUserNotice: (message: string) => void;
  readonly appendImplementationTaskListAiMessage: (
    message: import("@/lib/requirements/requirementsMessage").RequirementsMessage,
  ) => void;
  readonly applyImplementationOrchestrationResult: (
    input: {
      readonly messages?: readonly import("@/lib/requirements/requirementsMessage").RequirementsMessage[];
      readonly orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
    },
    options?: { readonly persist?: boolean },
  ) => void;
  readonly applyPendingFromOrchestrationPatch: (patch: unknown) => void;
  readonly implementationCursorGate: unknown;
  readonly prototypeRunSyncSnapshot: ReturnType<
    typeof import("@/lib/prototype/implementationPrototypeRunSync").deriveImplementationPrototypeRunSyncSnapshot
  >;
  readonly previewUrl: string | null | undefined;
  readonly implementationStageBoardGateContext: ReturnType<
    typeof buildImplementationStageBoardGateContext
  > | null;
  readonly boardManualPickTaskIdRef: MutableRefObject<string | null>;
  readonly codeTaskDispatchPreferredTaskIdRef: MutableRefObject<string | null>;
  readonly pendingQuickRunQueueDispatchRef: MutableRefObject<
    import("@/lib/prototype/selectedCodeTaskCursorExecution").CodeTaskQueueDispatchRef | null
  >;
  readonly quickRunCodeTaskContinuationRef: MutableRefObject<string | null>;
  readonly requirementsStateJsonRef: RefObject<unknown>;
  readonly dispatchNextQuickRunFromGithubVerify: (next: QuickRunGithubAdvanceDispatch) => void;
  readonly appendImplementationExecutionNotice: (text: string) => void;
  readonly enrichCodeTaskRunOrchestrationPatch: (patch: unknown) => unknown;
  readonly applyImplementationRuntimeFetch: (fetched: unknown) => void;
  readonly persistedQueueDispatch: import("@/lib/prototype/selectedCodeTaskCursorExecution").CodeTaskQueueDispatchRef | null;
  readonly wipChipHandlers: Record<string, unknown>;
  readonly setExecutionEnvironmentModalOpen: (open: boolean) => void;
}>;

export function dispatchExecutionStageAction(
  actionId: ImplementationStageActionId,
  deps: ImplementationStageActionExecutionDispatchDeps,
): ImplementationStageActionRunResult | null {

  const {
    projectId,
    parsedRequirementsState,
    pendingImplementationPatch,
    effectiveImplementationState,
    executionSetupRow,
    executionArtifacts,
    orchestrationAwareRequirementsState,
    requirementsStateJson,
    persistChatToDb,
    appendAiNoticeForImplementation,
    appendUserNotice,
    appendImplementationTaskListAiMessage,
    applyImplementationOrchestrationResult,
    applyPendingFromOrchestrationPatch,
    implementationCursorGate,
    prototypeRunSyncSnapshot,
    previewUrl,
    implementationStageBoardGateContext,
    boardManualPickTaskIdRef,
    codeTaskDispatchPreferredTaskIdRef,
    pendingQuickRunQueueDispatchRef,
    quickRunCodeTaskContinuationRef,
    requirementsStateJsonRef,
    dispatchNextQuickRunFromGithubVerify,
    appendImplementationExecutionNotice,
    enrichCodeTaskRunOrchestrationPatch,
    applyImplementationRuntimeFetch,
    persistedQueueDispatch,
    wipChipHandlers,
    setExecutionEnvironmentModalOpen,
  } = deps;

  const requirementsJsonFromRef = () =>
    parseRequirementsStateJson(requirementsStateJsonRef.current ?? requirementsStateJson);

  switch (actionId) {
    case "REQUEST_CODE_AGENT_WIP": {
          const pid = projectId.trim();
          const cursorApiReady = evaluateCursorExecutionAvailability({ setup: executionSetupRow }).ready;

          const prepared = prepareWipRequestRuntime({
            projectId: pid,
            baseState: parsedRequirementsState,
            pendingPatch: pendingImplementationPatch,
            envOk: effectiveImplementationState.envOk,
            designOk: effectiveImplementationState.designOk,
            cursorApiConfigured: cursorApiReady,
          });

          let runtimeState = prepared.state;
          let runtimeTaskPlan = prepared.taskPlan;
          let runtimeWorkItems = prepared.workItems;
          let runtimeSlots = runtimeState.implementationSlotsV1 ?? null;
          let runtimeDbStrategy = runtimeState.implementationDbStrategyV1 ?? null;
          let runtimeExecutionState = prepared.executionState;
          let runtimeTimeline = appendPromptTimelineEntries(
            runtimeState.promptTimeline,
            prepared.timelineEntries,
          );
          runtimeState = { ...runtimeState, promptTimeline: runtimeTimeline };

          const taskList = runtimeState.implementationTaskListV1;
          const seed = runtimeState.implementationSeedV1;
          const canUseTaskList = canUseTaskListForWipOrchestration({ taskList, seed });

          if (prepared.unconfirmedSlotsNote) {
            appendAiNoticeForImplementation(prepared.unconfirmedSlotsNote);
          }

          if (!runtimeWorkItems.length) {
            const message = "Code Agent WIP 작업 요청을 위해 구현 작업목록 또는 작업 계획이 필요합니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }

          if (
            !shouldUseTaskListBoardWipGate({ taskList, executionState: runtimeExecutionState }) &&
            pid &&
            canUseTaskList &&
            hasTaskListForWipOrchestration(taskList)
          ) {
            const derived = buildTaskListDerivedWipOrchestration({
              projectId: pid,
              taskList: taskList!,
              projectArtifacts: executionArtifacts.projectArtifacts,
              artifactOrchestrationV1: executionArtifacts.artifactOrchestrationV1,
              envOk: effectiveImplementationState.envOk,
              designOk: effectiveImplementationState.designOk,
              envCursorBadge: effectiveImplementationState.envOk ? "ok" : "needs",
              priorTimeline: runtimeTimeline,
              priorExecutionState: runtimeExecutionState,
              planningHandoffForImplementationV1: runtimeState.planningHandoffForImplementationV1 ?? null,
            });
            runtimeTaskPlan = derived.plan;
            runtimeWorkItems = [...derived.workItems];
            runtimeSlots = derived.slots;
            runtimeDbStrategy = derived.dbStrategy;
            runtimeExecutionState = derived.executionState;
            runtimeState = mergeTaskListWipRuntimeState(runtimeState, derived);
            runtimeTimeline = runtimeState.promptTimeline ?? runtimeTimeline;
          }

          const reGate = evaluateImplementationCursorGate(
            buildImplementationCursorGateContext(
              {
                ...runtimeState,
                cursorWorkItemsV1: runtimeWorkItems,
                implementationTaskPlanV1: runtimeTaskPlan,
                implementationTaskExecutionStateV1: runtimeExecutionState,
              },
              {
                envOk: effectiveImplementationState.envOk,
                designOk: effectiveImplementationState.designOk,
              },
              { projectId: pid },
            ),
          );
          if (!reGate.allowed) {
            const message = formatImplementationCursorBlockedNotice(
              buildImplementationCursorGateContext(
                {
                  ...runtimeState,
                  cursorWorkItemsV1: runtimeWorkItems,
                  implementationTaskPlanV1: runtimeTaskPlan,
                  implementationTaskExecutionStateV1: runtimeExecutionState,
                },
                {
                  envOk: effectiveImplementationState.envOk,
                  designOk: effectiveImplementationState.designOk,
                },
                { projectId: pid },
              ),
            );
            if (runtimeWorkItems.length && runtimeExecutionState && taskList) {
              const failedState = markDeveloperTasksFailedForWip({
                state: runtimeExecutionState,
                cursorWorkItems: runtimeWorkItems,
                errorMessage: message,
              });
              void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
                implementationTaskExecutionStateV1: failedState,
              });
            }
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }

          let workItemsForWip = runtimeWorkItems;
          let scopedTaskId: string | null = null;
          let wipCandidateCount: number | undefined;
          if (taskList && runtimeExecutionState) {
            const board = buildImplementationExecutionBoardFromRequirementsState({
              projectId: pid,
              orchestration: runtimeState,
            })!;
            wipCandidateCount = countTaskListWipCandidateTasks(board);
            const scoped = selectCursorWorkItemsForWipExecution({
              board,
              workItems: runtimeWorkItems,
              boardState: runtimeState.implementationExecutionBoardStateV1,
              qualityGateResults: runtimeState.implementationQualityGateResultsV1,
            });
            scopedTaskId = scoped.selectedTaskId;
            if (scopedTaskId) {
              runtimeTimeline = appendPromptTimelineEntries(runtimeTimeline, [
                buildImplementationWipGenerationTimelineEntry({
                  action: "implementation_wip_selected_task_resolved",
                  projectId: pid,
                  hasImplementationTaskList: true,
                  hasCursorWorkItems: true,
                  selectedTaskId: scopedTaskId,
                  selectedWorkItemCount: scoped.selectedWorkItems.length,
                  cursorApiConfigured: cursorApiReady,
                  nowIso: new Date().toISOString(),
                }),
              ]);
              runtimeState = { ...runtimeState, promptTimeline: runtimeTimeline };
            }
            if (!scoped.selectedWorkItems.length) {
              const message = formatTaskScopedWipExecutionBlockedNotice({
                selectedTaskId: scoped.selectedTaskId,
                blockedReason:
                  scoped.blockedReason ??
                  "실행 가능한 개발자 작업이 없어 Code Agent WIP 요청을 시작하지 못했습니다.",
              });
              appendAiNoticeForImplementation(message);
              return { outcome: "blocked", message };
            }
            if (scopedTaskId) {
              const scopeValidation = validateTaskScopedWorkItems({
                selectedTaskId: scopedTaskId,
                selectedWorkItems: scoped.selectedWorkItems,
              });
              if (!scopeValidation.ok) {
                appendAiNoticeForImplementation(scopeValidation.message);
                return { outcome: "blocked", message: scopeValidation.message };
              }
            }
            workItemsForWip = scoped.selectedWorkItems;
          } else if (runtimeWorkItems.length) {
            scopedTaskId = runtimeWorkItems[0]?.taskId ?? null;
            workItemsForWip = scopedTaskId
              ? runtimeWorkItems.filter((w) => w.taskId === scopedTaskId)
              : runtimeWorkItems.slice(0, 1);
          }

          const wipResult = executeCodeAgentWipWorkRequest(
            {
              projectId: pid,
              requirementsStateJson,
              parsedState: runtimeState,
              applyMessages: () => {},
              appendNotice: (text) => appendAiNoticeForImplementation(text),
              persistOrchestration: () => {
                // Full persist + local merge handled by applyImplementationOrchestrationResult below.
              },
              appendUserNotice,
            },
            {
              plan: runtimeTaskPlan,
              workItems: workItemsForWip,
              taskList: taskList ?? undefined,
              executionState: runtimeExecutionState,
              selectedTaskId: scopedTaskId,
              selectedWorkItemIds: workItemsForWip.map((w) => w.id),
              totalCandidateCount: wipCandidateCount,
              cursorWorkItemsV1: runtimeWorkItems ?? undefined,
              implementationTaskPlanV1: runtimeTaskPlan ?? undefined,
              promptTimeline: runtimeTimeline,
            },
          );

          if (wipResult.kind === "blocked") {
            appendAiNoticeForImplementation(wipResult.message);
            return { outcome: "blocked", message: wipResult.message };
          }
          if (wipResult.kind === "already_active") {
            return { outcome: "executed" };
          }

          const selectedTaskId = wipResult.selectedTaskId ?? scopedTaskId;
          const acceptedBoardState = selectedTaskId
            ? markReworkRequestsAcceptedForTask({
                state: runtimeState.implementationExecutionBoardStateV1,
                projectId: pid,
                taskId: selectedTaskId,
              })
            : runtimeState.implementationExecutionBoardStateV1;
          if (selectedTaskId && acceptedBoardState) {
            applyPendingFromOrchestrationPatch({
              implementationExecutionBoardStateV1: acceptedBoardState,
            });
          }
          const mergedOrchestrationAfterWip = {
            ...runtimeState,
            codeAgentWipExecutionV1: wipResult.orchestrationPatch.codeAgentWipExecutionV1,
            promptTimeline: wipResult.orchestrationPatch.promptTimeline,
            ...(wipResult.executionState
              ? { implementationTaskExecutionStateV1: wipResult.executionState }
              : {}),
            ...(acceptedBoardState ? { implementationExecutionBoardStateV1: acceptedBoardState } : {}),
          };

          const wip = wipResult.orchestrationPatch.codeAgentWipExecutionV1;
          const timelineTaskId = wip.selectedTaskId ?? selectedTaskId ?? "";
          const timelineBase = {
            projectId: pid,
            selectedTaskId: timelineTaskId,
            selectedWorkItemCount: wip.selectedWorkItemIds?.length ?? workItemsForWip.length,
            cursorApiReady,
            hasCodeAgentWipExecutionV1: true,
          };
          let timeline = [
            ...(wipResult.orchestrationPatch.promptTimeline ?? runtimeTimeline ?? []),
          ];
          timeline = appendPromptTimeline(
            timeline,
            buildImplementationWipDraftLifecycleTimelineEntry({
              action: "implementation_wip_draft_created",
              ...timelineBase,
            }),
          );
          timeline = appendPromptTimeline(
            timeline,
            buildImplementationWipDraftLifecycleTimelineEntry({
              action: "implementation_wip_draft_persisted",
              ...timelineBase,
            }),
          );
          timeline = appendPromptTimeline(
            timeline,
            buildImplementationWipDraftLifecycleTimelineEntry({
              action: "implementation_wip_draft_local_state_merged",
              ...timelineBase,
            }),
          );
          timeline = appendPromptTimeline(
            timeline,
            buildImplementationWipDraftLifecycleTimelineEntry({
              action: "legacy_cursor_bridge_diagnostic_removed",
              ...timelineBase,
            }),
          );

          const boardAfterWip = buildImplementationExecutionBoardFromRequirementsState({
            projectId: pid,
            orchestration: mergedOrchestrationAfterWip,
          });
          const boardMessage =
            boardAfterWip &&
            buildImplementationExecutionBoardMessage({
              board: boardAfterWip,
              nowIso: new Date().toISOString(),
              previewReady: prototypeRunSyncSnapshot.previewReady,
              hasExecutionState: true,
              codeAgentWipExecutionV1: wip,
              executionSetup: executionSetupRow,
            });
          if (boardMessage) {
            timeline = appendPromptTimeline(
              timeline,
              buildImplementationWipDraftLifecycleTimelineEntry({
                action: "implementation_wip_draft_board_refreshed",
                ...timelineBase,
              }),
            );
          }

          const staleSanitizeCtx = {
            implementationTaskListV1: runtimeState.implementationTaskListV1,
            cursorWorkItemsV1: runtimeWorkItems,
            implementationSeedV1: runtimeState.implementationSeedV1,
          };
          const baseMessages = wipResult.chatMessages;
          const rawNextMessages = boardMessage ? [...baseMessages, boardMessage] : baseMessages;
          const nextMessages = sanitizeImplementationConversationMessages(rawNextMessages, staleSanitizeCtx);
          applyImplementationOrchestrationResult({
            messages: nextMessages,
            orchestrationPatch: {
              codeAgentWipExecutionV1: wip,
              promptTimeline: timeline,
              ...(wipResult.executionState
                ? { implementationTaskExecutionStateV1: wipResult.executionState }
                : {}),
              ...(runtimeWorkItems?.length ? { cursorWorkItemsV1: [...runtimeWorkItems] } : {}),
              ...(runtimeTaskPlan ? { implementationTaskPlanV1: runtimeTaskPlan } : {}),
              ...(runtimeSlots ? { implementationSlotsV1: runtimeSlots } : {}),
              ...(runtimeDbStrategy ? { implementationDbStrategyV1: runtimeDbStrategy } : {}),
              ...(acceptedBoardState
                ? { implementationExecutionBoardStateV1: acceptedBoardState }
                : {}),
            },
          });

          const integratedWipSummary = Boolean(scopedTaskId && wipCandidateCount !== undefined);
          if (!integratedWipSummary) {
            const devCount = wipResult.developerTaskCount;
            const successNotice =
              devCount > 0
                ? `TaskList 기준 개발자 작업 ${devCount}건을 Code Agent WIP 요청으로 전환했습니다.`
                : "Code Agent WIP 작업 요청을 시작했습니다.";
          } else {
          }
          return { outcome: "executed" };
    }
    case "REQUEST_TASK_CURSOR_EXECUTION": {
          const pid = projectId.trim();
          const board = implementationStageBoardGateContext?.board;
          const workItems = orchestrationAwareRequirementsState.cursorWorkItemsV1 ?? [];
          const codeTaskPlan = orchestrationAwareRequirementsState.implementationCodeTaskPlanV1;
          const taskList = orchestrationAwareRequirementsState.implementationTaskListV1;
          if (!board) {
            const message = "구현 Execution Board가 준비되지 않았습니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const envGate = resolveTaskCursorExecutionEnvGate({ setup: executionSetupRow });
          if (envGate.blocked) {
            const message = envGate.message ?? "환경설정 점검이 필요합니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const parsedInFlight =
            parseTaskCursorExecutionV1(orchestrationAwareRequirementsState.taskCursorExecutionV1) ?? null;
          const inFlightRow = parsedInFlight
            ? board.taskRows.find((row) => row.taskId === parsedInFlight.taskId)
            : null;
          if (
            parsedInFlight &&
            isActiveTaskCursorExecution(parsedInFlight, {
              developerStatus: inFlightRow?.developerStatus ?? null,
            })
          ) {
            const message = CODE_TASK_IN_FLIGHT_USER_MESSAGE;
            appendAiNoticeForImplementation(message);
            return { outcome: "no_op", message };
          }
          const planningGate = evaluateImplementationPlanningExecutionGate({
            codeTaskPlan,
            cursorWorkItems: workItems,
            preflightSummary: orchestrationAwareRequirementsState.implementationWorkItemPreflightSummaryV1,
            codeTaskQualityGate: orchestrationAwareRequirementsState.implementationCodeTaskQualityGateV1,
          });
          if (!planningGate.ok) {
            const nowIso = new Date().toISOString();
            const blockedTimeline = appendPromptTimeline(
              orchestrationAwareRequirementsState.promptTimeline ?? [],
              buildImplementationExecutionBlockedByPlanningGateTimelineEntry({
                projectId: pid,
                reason: planningGate.reason,
                nowIso,
              }),
            );
            void persistChatToDb(resolvePrototypeExecutionSingleChatFromState(requirementsStateJson), {
              promptTimeline: blockedTimeline,
            });
            const message =
              planningGate.message ??
              IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE;
            appendAiNoticeForImplementation(
              `${message} [구현 준비 산출물 동기화] 또는 기획단계 보완 후 다시 시도해 주세요.`,
            );
            return { outcome: "blocked", message };
          }
          const queueDispatch =
            pendingQuickRunQueueDispatchRef.current ?? persistedQueueDispatch;
          pendingQuickRunQueueDispatchRef.current = null;
          if (queueDispatch) {
            const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
              gitRepoUrl: executionSetupRow?.gitRepoUrl,
              gitRepoName: executionSetupRow?.gitRepoName,
              gitRepoProvider: executionSetupRow?.gitRepoProvider,
              baseBranch: executionSetupRow?.baseBranch,
            });
            if (!targetRepository) {
              const message = "GitHub 저장소 설정이 없습니다. 환경설정을 확인해 주세요.";
              appendAiNoticeForImplementation(message);
              return { outcome: "blocked", message };
            }
            const nowIso = new Date().toISOString();
            const allowedPathGlobs = parseStringArrayJson(executionSetupRow?.allowedPathGlobs);
            const prep = prepareSelectedCodeTaskCursorExecution({
              projectId: pid,
              queueDispatch,
              runs:
                parseCodeTaskExecutionRunsV1(
                  requirementsJsonFromRef().codeTaskExecutionRunsV1,
                ) ??
                parseCodeTaskExecutionRunsV1(orchestrationAwareRequirementsState.codeTaskExecutionRunsV1),
              codeTaskPlan,
              taskList,
              cursorWorkItems: workItems,
              targetRepository,
              baseBranch: executionSetupRow?.baseBranch ?? targetRepository.defaultBranch,
              allowedPathGlobs,
              codeTaskPromptContextMapV1:
                orchestrationAwareRequirementsState.codeTaskPromptContextMapV1 ?? null,
              existingTaskCursor:
                parseTaskCursorExecutionV1(orchestrationAwareRequirementsState.taskCursorExecutionV1) ??
                null,
              nowIso,
            });
            if (!prep.ok) {
              appendAiNoticeForImplementation(prep.message);
              return { outcome: prep.outcome, message: prep.message };
            }
            const { prepared } = prep;
            const codeTaskTitle = codeTaskPlan?.tasks.find(
              (t) => t.codeTaskId === prepared.codeTaskId,
            )?.title;
            applyImplementationOrchestrationResult(
              {
        orchestrationPatch: {
                  ...buildTaskCursorOrchestrationPatch({
                    execution: prepared.pendingExecution,
                    history: orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1,
                    timelineEntries: [],
                    existingTimeline: orchestrationAwareRequirementsState.promptTimeline,
                    cursorWorkItems: [...prepared.selectedWorkItems],
                    existingCodeTaskExecutionFeedback:
                      orchestrationAwareRequirementsState.implementationCodeTaskExecutionFeedbackV1,
                    codeTaskQualityGate:
                      orchestrationAwareRequirementsState.implementationCodeTaskQualityGateV1,
                    implementationExecutionJobsV1:
                      orchestrationAwareRequirementsState.implementationExecutionJobsV1,
                    codeTaskExecutionRunsV1: (() => {
                      const existingRuns =
                        parseCodeTaskExecutionRunsV1(
                          orchestrationAwareRequirementsState.codeTaskExecutionRunsV1,
                        ) ?? [];
                      return existingRuns.some((r) => r.runId === prepared.run.runId)
                        ? updateCodeTaskExecutionRun(existingRuns, prepared.run.runId, prepared.run)
                        : appendCodeTaskExecutionRun(existingRuns, prepared.run);
                    })(),
                    activeCodeTaskId: prepared.codeTaskId,
                    activeWorkItemId: prepared.workItem.id,
                  }),
                  cursorWorkItemsV1: mergeCursorWorkItemsByTask({
                    existingWorkItems: orchestrationAwareRequirementsState.cursorWorkItemsV1 ?? [],
                    updatedWorkItems: [...prepared.selectedWorkItems],
                    taskId: prepared.parentTaskId,
                  }),
                },
              },
              { persist: false },
            );
            const pollHistory = orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1;
            const pollTimeline = orchestrationAwareRequirementsState.promptTimeline;
            const pollWorkItems = [...prepared.selectedWorkItems];
            void (async () => {
              try {
                const res = await postTaskCursorExecuteWithRetry({
                  body: prepared.requestBody,
                });
                const json = (await res.json()) as {
                  success?: boolean;
                  message?: string;
                  pollRequired?: boolean;
                  serverPolling?: boolean;
                  phase?: string;
                  failureReason?: string;
                  orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
                };
                const preflightFailure = isTaskCursorExecutePromptPreflightFailure(json);
                if (json.orchestrationPatch) {
                  applyImplementationOrchestrationResult({
        orchestrationPatch: enrichCodeTaskRunOrchestrationPatch(json.orchestrationPatch) as PrototypeExecutionOrchestrationPersistInput,
                  });
                }
                const launchedExecution =
                  parseTaskCursorExecutionV1(json.orchestrationPatch?.taskCursorExecutionV1) ??
                  parseTaskCursorExecutionV1(requirementsJsonFromRef().taskCursorExecutionV1) ??
                  prepared.pendingExecution;
                const userStatus = buildCodeTaskRunUserStatus(
                  findLatestRunForCodeTask(
                    parseCodeTaskExecutionRunsV1(
                      requirementsJsonFromRef().codeTaskExecutionRunsV1,
                    ),
                    prepared.codeTaskId,
                  ),
                );
                if (
                  (json.serverPolling || json.pollRequired) &&
                  launchedExecution.status === "cursor_running"
                ) {
                  return;
                }
                const notice =
                  json.message ??
                  (json.success ? `${userStatus.label} 처리되었습니다.` : "CodeTask 실행에 실패했습니다.");
                if (!json.success && !json.pollRequired && !preflightFailure) {
                  applyImplementationOrchestrationResult({
        orchestrationPatch: buildTaskCursorFailedOrchestrationPatch({
                      execution:
                        parseTaskCursorExecutionV1(json.orchestrationPatch?.taskCursorExecutionV1) ??
                        prepared.pendingExecution,
                      message: notice,
                      history: pollHistory,
                      existingTimeline: pollTimeline,
                    }),
                  });
                }
                if (!preflightFailure) {
                  appendAiNoticeForImplementation(notice);
                }
              } catch (e) {
                const friendly = formatTransientTaskCursorLaunchErrorMessage(e);
                const orchestrationPatch = isTransientTaskCursorLaunchError(friendly)
                  ? buildTaskCursorLaunchTransientFailurePatch({
                      execution: prepared.pendingExecution,
                      message: friendly,
                      history: pollHistory,
                      existingTimeline: pollTimeline,
                    })
                  : buildTaskCursorFailedOrchestrationPatch({
                      execution: prepared.pendingExecution,
                      message: friendly,
                      history: pollHistory,
                      existingTimeline: pollTimeline,
                    });
                applyImplementationOrchestrationResult({
                  messages: readImplementationStageChatMessages(requirementsJsonFromRef()),
                  orchestrationPatch,
                });
                appendAiNoticeForImplementation(`CodeTask 실행 오류: ${friendly}`);
              }
            })();
            return { outcome: "executed" };
          }
          const preferredTaskId = codeTaskDispatchPreferredTaskIdRef.current?.trim() || null;
          codeTaskDispatchPreferredTaskIdRef.current = null;
          const manualTaskId = boardManualPickTaskIdRef.current?.trim() || null;
          boardManualPickTaskIdRef.current = null;
          const explicitTaskId = manualTaskId ?? preferredTaskId;
          const quickRun = parseImplementationQuickRunV1(
            orchestrationAwareRequirementsState.implementationQuickRunV1,
          );
          const allowedTaskIds = resolveQuickRunAllowedTaskIds(quickRun);
          let scoped = selectCursorWorkItemsForWipExecution({
            board,
            workItems,
            boardState: orchestrationAwareRequirementsState.implementationExecutionBoardStateV1,
            qualityGateResults: orchestrationAwareRequirementsState.implementationQualityGateResultsV1,
            allowedTaskIds,
          });
          if (explicitTaskId) {
            const preferredWorkItems = workItems.filter((item) => item.taskId === explicitTaskId);
            if (preferredWorkItems.length) {
              scoped = {
                selectedTaskId: explicitTaskId,
                selectedWorkItems: preferredWorkItems,
              };
            }
          }
          if (!scoped.selectedTaskId || !scoped.selectedWorkItems.length) {
            const message = scoped.blockedReason ?? "실행 가능한 Task를 찾을 수 없습니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
            gitRepoUrl: executionSetupRow?.gitRepoUrl,
            gitRepoName: executionSetupRow?.gitRepoName,
            gitRepoProvider: executionSetupRow?.gitRepoProvider,
            baseBranch: executionSetupRow?.baseBranch,
          });
          if (!targetRepository) {
            const message = "GitHub 저장소 설정이 없습니다. 환경설정을 확인해 주세요.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const nowIso = new Date().toISOString();
          const allowedPathGlobs = parseStringArrayJson(executionSetupRow?.allowedPathGlobs);
          let selectedWorkItems = [...scoped.selectedWorkItems];

          if (!selectedWorkItems.length) {
            const message = scoped.blockedReason ?? "선택 Task에 연결된 WorkItem이 없습니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }

          const refinement = taskList
            ? refineCursorWorkItemsForImplementation({
                projectId: pid,
                taskList,
                workItems: selectedWorkItems,
                selectedTaskId: scoped.selectedTaskId,
                allowedPathGlobs,
                targetRepository,
                nowIso,
              })
            : {
                workItems: selectedWorkItems,
                blockedWorkItemIds: [],
                timelineEntries: [],
              };
          selectedWorkItems = [...refinement.workItems];
          if (!selectedWorkItems.length) {
            const message = "WorkItem 보정 후 실행 가능한 항목이 없습니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }

          const preflight = runWorkItemPreflightBatch({
            workItems: selectedWorkItems,
            allowedPathGlobs,
          });
          let preflightTimeline = orchestrationAwareRequirementsState.promptTimeline ?? [];
          for (const entry of refinement.timelineEntries) {
            preflightTimeline = appendPromptTimeline(preflightTimeline, entry);
          }
          preflightTimeline = appendPromptTimeline(
            preflightTimeline,
            buildWorkItemPreflightTimelineEntry({
              projectId: pid,
              taskId: scoped.selectedTaskId,
              result: preflight,
              nowIso,
            }),
          );

          if (preflight.status === "failed") {
            const message = formatWorkItemPreflightBlockedMessage(preflight);
            const failedRequest = buildTaskCursorExecutionRequest({
              projectId: pid,
              taskId: scoped.selectedTaskId,
              workItemIds: selectedWorkItems.map((item) => item.id),
              workItems: selectedWorkItems,
              targetRepository,
              baseBranch: targetRepository.defaultBranch,
              allowedPathGlobs,
              existing:
                orchestrationAwareRequirementsState.taskCursorExecutionV1?.taskId === scoped.selectedTaskId
                  ? orchestrationAwareRequirementsState.taskCursorExecutionV1
                  : null,
              nowIso,
            });
            applyImplementationOrchestrationResult({
        orchestrationPatch: {
                ...buildTaskCursorFailedOrchestrationPatch({
                  execution: failedRequest,
                  message,
                  reason: "work_item_preflight_failed",
                  history: orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1,
                  existingTimeline: preflightTimeline,
                  nowIso,
                  cursorWorkItems: selectedWorkItems,
                  existingCodeTaskExecutionFeedback:
                    orchestrationAwareRequirementsState.implementationCodeTaskExecutionFeedbackV1,
                  codeTaskQualityGate:
                    orchestrationAwareRequirementsState.implementationCodeTaskQualityGateV1,
                }),
                cursorWorkItemsV1: mergeCursorWorkItemsByTask({
                  existingWorkItems: orchestrationAwareRequirementsState.cursorWorkItemsV1 ?? [],
                  updatedWorkItems: selectedWorkItems.map((item) => ({
                    ...item,
                    refinementStatus: "preflight_failed" as const,
                  })),
                  taskId: scoped.selectedTaskId,
                }),
              },
            });
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }

          selectedWorkItems = selectedWorkItems.map((item) => ({
            ...item,
            refinementStatus: "preflight_passed" as const,
          }));
          scoped = {
            selectedTaskId: scoped.selectedTaskId,
            selectedWorkItems,
          };

          if (!scoped.selectedTaskId) {
            const message = "실행할 developer 작업을 선택할 수 없습니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }

          const pendingExecution = buildTaskCursorExecutionRequest({
            projectId: pid,
            taskId: scoped.selectedTaskId,
            workItemIds: scoped.selectedWorkItems.map((w) => w.id),
            workItems: scoped.selectedWorkItems,
            targetRepository,
            baseBranch: targetRepository.defaultBranch,
            allowedPathGlobs,
            existing:
              orchestrationAwareRequirementsState.taskCursorExecutionV1?.taskId === scoped.selectedTaskId
                ? orchestrationAwareRequirementsState.taskCursorExecutionV1
                : null,
            nowIso,
          });
          const pollHistory = orchestrationAwareRequirementsState.taskCursorExecutionHistoryV1;
          const pollTimeline = orchestrationAwareRequirementsState.promptTimeline;
          const pollWorkItems = scoped.selectedWorkItems;

          void (async () => {
            try {
              const res = await postTaskCursorExecuteWithRetry({
                body: {
                  projectId: pid,
                  taskId: scoped.selectedTaskId,
                  selectedWorkItemIds: scoped.selectedWorkItems.map((w) => w.id),
                  workItems: scoped.selectedWorkItems,
                  verifyGithub: true,
                  launchOnly: true,
                },
              });
              const json = (await res.json()) as {
                success?: boolean;
                message?: string;
                pollRequired?: boolean;
                serverPolling?: boolean;
                jobId?: string;
                phase?: string;
                failureReason?: string;
                execution?: { status?: string; errorMessage?: string; failureReason?: string };
                orchestrationPatch?: PrototypeExecutionOrchestrationPersistInput;
              };
              const preflightFailure = isTaskCursorExecutePromptPreflightFailure(json);
              if (json.orchestrationPatch) {
                applyImplementationOrchestrationResult({
        orchestrationPatch: enrichCodeTaskRunOrchestrationPatch(
                  json.orchestrationPatch,
                ) as PrototypeExecutionOrchestrationPersistInput,
                });
              }
              const launchedExecution =
                parseTaskCursorExecutionV1(json.orchestrationPatch?.taskCursorExecutionV1) ??
                parseTaskCursorExecutionV1(requirementsJsonFromRef().taskCursorExecutionV1) ??
                pendingExecution;

              if (
                (json.serverPolling || json.pollRequired) &&
                launchedExecution.status === "cursor_running"
              ) {
                return;
              }

              const notice =
                json.execution?.errorMessage ??
                json.message ??
                (json.success ? "Task Cursor 실행이 완료되었습니다." : "Task Cursor 실행에 실패했습니다.");
              if (!json.success && !json.pollRequired && !preflightFailure) {
                applyImplementationOrchestrationResult({
        orchestrationPatch: buildTaskCursorFailedOrchestrationPatch({
                    execution:
                      parseTaskCursorExecutionV1(json.orchestrationPatch?.taskCursorExecutionV1) ??
                      pendingExecution,
                    message: notice,
                    history: pollHistory,
                    existingTimeline: pollTimeline,
                  }),
                });
              }
              if (!preflightFailure) {
                appendAiNoticeForImplementation(notice);
              }
            } catch (e) {
              const friendly = formatTransientTaskCursorLaunchErrorMessage(e);
              const orchestrationPatch = isTransientTaskCursorLaunchError(friendly)
                ? buildTaskCursorLaunchTransientFailurePatch({
                    execution: pendingExecution,
                    message: friendly,
                    history: pollHistory,
                    existingTimeline: pollTimeline,
                  })
                : buildTaskCursorFailedOrchestrationPatch({
                    execution: pendingExecution,
                    message: friendly,
                    history: pollHistory,
                    existingTimeline: pollTimeline,
                  });
              applyImplementationOrchestrationResult({
                messages: readImplementationStageChatMessages(requirementsJsonFromRef()),
                orchestrationPatch,
              });
              appendAiNoticeForImplementation(`Task Cursor 실행 오류: ${friendly}`);
            }
          })();
          return { outcome: "executed" };
    }
    case "VERIFY_TASK_CURSOR_GITHUB": {
          const pid = projectId.trim();
          const execution = parseTaskCursorExecutionV1(
            orchestrationAwareRequirementsState.taskCursorExecutionV1,
          );
          if (!execution) {
            return { outcome: "blocked", message: "Task Cursor 실행 상태가 없습니다." };
          }
          void (async () => {
            try {
              const state = requirementsJsonFromRef();
              const json = await postTaskCursorGithubVerify(
                buildTaskCursorGithubVerifyRequestBody({
                  projectId: pid,
                  execution,
                  state,
                }),
              );
              applyTaskCursorGithubVerifyApiResult({
                json,
                enrichPatch: (patch) =>
                  enrichCodeTaskRunOrchestrationPatch(patch) as PrototypeExecutionOrchestrationPersistInput,
                applyOrchestrationPatch: (patch) => {
                  applyImplementationOrchestrationResult({
        orchestrationPatch: patch,
                  });
                },
                shouldApplyNextDispatch: (next) =>
                  quickRunCodeTaskContinuationRef.current !== next.triggerKey,
                onNextQuickRunDispatch: (next) => {
                  quickRunCodeTaskContinuationRef.current = next.triggerKey;
                  dispatchNextQuickRunFromGithubVerify(next);
                },
              });
              const notice = resolveTaskCursorGithubVerifyUserNotice(json);
              appendImplementationExecutionNotice(notice);
              void fetchImplementationRuntime(pid).then((fetched) => {
                if (fetched.success) applyImplementationRuntimeFetch(fetched);
              });
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
            }
          })();
          return { outcome: "executed" };
    }
    case "REQUEST_CURSOR_BRIDGE_EXECUTION": {
          const pid = projectId.trim();
          const wip = orchestrationAwareRequirementsState.codeAgentWipExecutionV1;
          if (!wip) {
            const message =
              "WIP 초안 또는 Cursor 실행 결과가 저장되어 있지 않습니다. 먼저 [생성요청]을 실행해 WIP 초안을 생성해 주세요.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const bridgeStatus = wip.bridgeExecutionStatus;
          if (
            bridgeStatus !== "draft_created" &&
            bridgeStatus !== "draft_approved" &&
            bridgeStatus !== "failed"
          ) {
            const message = `현재 bridge 상태(${bridgeStatus ?? "unknown"})에서는 Cursor 실행 요청을 할 수 없습니다.`;
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const selectedTaskId = wip.selectedTaskId?.trim();
          const selectedWorkItemIds = wip.selectedWorkItemIds ?? [];
          if (!selectedTaskId || !selectedWorkItemIds.length) {
            const message = "WIP 실행 대상 taskId 또는 workItem이 없습니다. [생성요청]을 다시 실행해 주세요.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const bridgeWorkItems = orchestrationAwareRequirementsState.cursorWorkItemsV1 ?? [];
          const workItems = bridgeWorkItems.filter((w) => selectedWorkItemIds.includes(w.id));
          const bridgeTaskList = orchestrationAwareRequirementsState.implementationTaskListV1;
          if (!workItems.length) {
            const message = "선택된 Cursor WorkItem을 찾을 수 없습니다.";
            appendAiNoticeForImplementation(message);
            return { outcome: "blocked", message };
          }
          const stubCommit = wip.commits.find((c) => c.sha?.startsWith("wip-stub"));
          const commitMessage = stubCommit?.commitMessage ?? `wip(cursor): [${selectedTaskId}]`;
          const bridgeRunId = `cursor-bridge-${new Date().toISOString().replace(/[:.]/g, "")}`;

          void (async () => {
            const refTimeline = () =>
              requirementsJsonFromRef().promptTimeline ?? [];

            const applyBridgeFailure = (message: string, openEnv = false) => {
              const blocked = buildCursorBridgeApiBlockedResult({ selectedTaskId, message });
              const orchestration = buildCursorBridgeOrchestrationResult({
                requirementsStateJson: requirementsStateJsonRef.current ?? requirementsStateJson,
                wip: patchWipForCursorBridgePhase({
                  wip,
                  phase: "running",
                  targetRepository: wip.targetRepoFullName ?? wip.targetRepository,
                }),
                bridgeResult: blocked,
                promptTimeline: refTimeline(),
                runId: bridgeRunId,
              });
              if (orchestration.orchestrationPatch) {
                applyImplementationOrchestrationResult({
                  messages: orchestration.chatPatch?.messages ?? readImplementationStageChatMessages(requirementsJsonFromRef()),
                  orchestrationPatch: orchestration.orchestrationPatch,
                });
              } else {
                appendAiNoticeForImplementation(message);
              }
              if (openEnv) setExecutionEnvironmentModalOpen(true);
            };

            const setupRes = await fetchExecutionSetup(pid);
            const executionSetup =
              setupRes.res.ok && setupRes.json.success ? (setupRes.json.data ?? null) : null;
            const readiness = evaluateExecutionSetupSourceGenerationReadiness({
              setup: executionSetup
                ? {
                    gitRepoUrl: executionSetup.gitRepoUrl,
                    gitRepoName: executionSetup.gitRepoName,
                    gitRepoProvider: executionSetup.gitRepoProvider,
                    baseBranch: executionSetup.baseBranch,
                    workspacePath: executionSetup.workspacePath,
                    allowedPathGlobs: executionSetup.allowedPathGlobs,
                    autoCommit: executionSetup.autoCommit,
                    autoPush: executionSetup.autoPush,
                    autoPr: executionSetup.autoPr,
                    cursorApiUrl: executionSetup.cursorApiUrl,
                    hasCursorToken: executionSetup.hasCursorToken,
                    hasGithubAccessToken: executionSetup.hasGithubAccessToken,
                  }
                : null,
            });
            const setupRow = executionSetup
              ? {
                  gitRepoUrl: executionSetup.gitRepoUrl,
                  gitRepoName: executionSetup.gitRepoName,
                  gitRepoProvider: executionSetup.gitRepoProvider,
                  baseBranch: executionSetup.baseBranch,
                  workspacePath: executionSetup.workspacePath,
                  allowedPathGlobs: executionSetup.allowedPathGlobs,
                  autoCommit: executionSetup.autoCommit,
                  autoPush: executionSetup.autoPush,
                  autoPr: executionSetup.autoPr,
                  cursorApiUrl: executionSetup.cursorApiUrl,
                  hasCursorToken: executionSetup.hasCursorToken,
                  hasGithubAccessToken: executionSetup.hasGithubAccessToken,
                }
              : null;

            if (!isCursorBridgeConfiguredForSourceGeneration({ setup: setupRow })) {
              const diagnostic = formatTargetRepoE2eDiagnosticLines({ setup: setupRow, wip }).join("\n");
              applyBridgeFailure(`${CURSOR_API_NOT_CONFIGURED_MESSAGE}\n\n${diagnostic}`, true);
              return;
            }

            const cursorAvailability = evaluateCursorExecutionAvailability({ setup: setupRow });
            const availabilityTimeline = buildCursorApiDirectTimelineEntry({
              action: "cursor_api_availability_checked",
              projectId: pid,
              selectedTaskId,
              repoFullName: setupRow?.gitRepoName ?? undefined,
              workspacePath: setupRow?.workspacePath ?? undefined,
              branchName: wip.branchName,
              status: cursorAvailability.status,
              runId: bridgeRunId,
              nowIso: new Date().toISOString(),
            });

            if (!cursorAvailability.ready) {
              applyBridgeFailure(cursorAvailability.reason, true);
              return;
            }

            if (!readiness.ok) {
              const diagnostic = formatTargetRepoE2eDiagnosticLines({
                setup: setupRow,
                workspaceOriginStatus: "unchecked",
                wip,
              }).join("\n");
              applyBridgeFailure(`${readiness.message}\n\n${diagnostic}`, readiness.missing.some(
                (m) => m.includes("Git") || m.includes("실행환경") || m.includes("Workspace"),
              ));
              return;
            }

            const targetRepository = readiness.context.targetRepository;
            const targetSnapshot = toCodeAgentTargetRepositorySnapshot(targetRepository);

            const e2eDiagnostic = formatTargetRepoE2eDiagnosticLines({
              context: readiness.context,
              workspaceOriginStatus:
                readiness.context.workspaceRootSource === "env_fallback" ? "not_applicable" : "unchecked",
              wip,
            }).join("\n");
            appendAiNoticeForImplementation(
              ["Target Repo 수동 E2E 진단:", "", e2eDiagnostic].join("\n"),
            );
            const readinessTimeline = buildTargetRepoE2eTimelineEntry({
              action: "target_repo_e2e_readiness_checked",
              projectId: pid,
              selectedTaskId,
              repoFullName: targetRepository.repoFullName,
              baseBranch: readiness.context.baseBranch,
              workspacePath: readiness.context.workspaceRoot,
              status: "ready",
              nowIso: new Date().toISOString(),
            });
            const requestedTimeline = buildCursorApiDirectTimelineEntry({
              action: "cursor_api_direct_execution_requested",
              projectId: pid,
              selectedTaskId,
              repoFullName: targetRepository.repoFullName,
              workspacePath: readiness.context.workspaceRoot,
              branchName: wip.branchName,
              status: cursorAvailability.mode,
              runId: bridgeRunId,
              nowIso: new Date().toISOString(),
            });
            const requestedWip = patchWipForCursorBridgePhase({
              wip,
              phase: "requested",
              targetRepository: targetRepository.repoFullName,
              targetRepositorySnapshot: targetSnapshot,
              workspacePath: readiness.context.workspaceRoot,
              baseBranch: readiness.context.baseBranch,
              allowedPathGlobs: readiness.context.allowedPathGlobs,
            });
            applyImplementationOrchestrationResult({
        orchestrationPatch: {
                codeAgentWipExecutionV1: requestedWip,
                promptTimeline: [...refTimeline(), availabilityTimeline, readinessTimeline, requestedTimeline],
              },
            });

            const runningWip = patchWipForCursorBridgePhase({
              wip: requestedWip,
              phase: "running",
            });
            const startedTimeline = buildCursorApiDirectTimelineEntry({
              action: "cursor_api_direct_execution_started",
              projectId: pid,
              selectedTaskId,
              repoFullName: targetRepository.repoFullName,
              workspacePath: readiness.context.workspaceRoot,
              branchName: wip.branchName,
              status: "running",
              runId: bridgeRunId,
              nowIso: new Date().toISOString(),
            });
            applyImplementationOrchestrationResult({
        orchestrationPatch: {
                codeAgentWipExecutionV1: runningWip,
                promptTimeline: [...refTimeline(), startedTimeline],
              },
            });

            try {
              const routeCallingTimeline = buildCursorApiDirectTimelineEntry({
                action: "cursor_bridge_execute_route_calling",
                projectId: pid,
                selectedTaskId,
                repoFullName: targetRepository.repoFullName,
                workspacePath: readiness.context.workspaceRoot,
                branchName: wip.branchName,
                status: "calling",
                runId: bridgeRunId,
                changedFilesCount: workItems.length,
                nowIso: new Date().toISOString(),
              });
              applyImplementationOrchestrationResult({
        orchestrationPatch: {
                  codeAgentWipExecutionV1: runningWip,
                  promptTimeline: [...refTimeline(), routeCallingTimeline],
                },
              });

              const res = await fetch("/api/prototype/cursor-bridge/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  projectId: pid,
                  selectedTaskId,
                  selectedWorkItemIds,
                  workItems,
                  branchName: wip.branchName,
                  commitMessage,
                }),
              });
              const json = (await res.json()) as {
                success?: boolean;
                message?: string;
                result?: import("@/lib/prototype/cursorBridgeExecution").CursorBridgeExecuteResult;
              };
              const bridgeResult =
                json.result ??
                buildCursorBridgeApiBlockedResult({
                  selectedTaskId,
                  message: json.message ?? "Cursor API 응답이 올바르지 않습니다.",
                });
              if (!json.result) {
                if (String(json.message ?? "").includes("일치하지 않습니다")) {
                  applyImplementationOrchestrationResult({
        orchestrationPatch: {
                      promptTimeline: [
                        ...refTimeline(),
                        buildTargetRepoE2eTimelineEntry({
                          action: "target_repo_workspace_origin_mismatch",
                          projectId: pid,
                          selectedTaskId,
                          repoFullName: targetRepository.repoFullName,
                          workspacePath: readiness.context.workspaceRoot,
                          status: "blocked",
                          reason: json.message,
                        }),
                      ],
                    },
                  });
                }
              }
              const orchestration = buildCursorBridgeOrchestrationResult({
                requirementsStateJson: requirementsStateJsonRef.current ?? requirementsStateJson,
                wip: runningWip,
                bridgeResult,
                promptTimeline: refTimeline(),
                runId: bridgeRunId,
              });
              if (orchestration.kind === "blocked" || orchestration.kind === "failed") {
                const mismatchTimeline = String(json.message ?? orchestration.message ?? "").includes(
                  "일치하지 않습니다",
                )
                    ? buildTargetRepoE2eTimelineEntry({
                        action: "target_repo_workspace_origin_mismatch",
                        projectId: pid,
                        selectedTaskId,
                        repoFullName: targetRepository.repoFullName,
                        workspacePath: readiness.context.workspaceRoot,
                        status: "blocked",
                        reason: json.message,
                      })
                    : null;
                if (orchestration.orchestrationPatch) {
                  applyImplementationOrchestrationResult({
                    messages: orchestration.chatPatch?.messages ?? readImplementationStageChatMessages(requirementsJsonFromRef()),
                    orchestrationPatch: {
                      ...orchestration.orchestrationPatch,
                      ...(mismatchTimeline
                        ? {
                            promptTimeline: [
                              ...(orchestration.orchestrationPatch.promptTimeline ?? []),
                              mismatchTimeline,
                            ],
                          }
                        : {}),
                    },
                  });
                } else {
                  appendAiNoticeForImplementation(orchestration.message);
                }
                return;
              }
              if (orchestration.chatPatch && orchestration.orchestrationPatch) {
                const approvedWip = orchestration.orchestrationPatch.codeAgentWipExecutionV1;
                const refState = requirementsJsonFromRef();
                const executionState = syncDeveloperTaskExecutionFromCodeAgentWip({
                  state: refState.implementationTaskExecutionStateV1,
                  taskList: bridgeTaskList ?? undefined,
                  cursorWorkItems: bridgeWorkItems,
                  codeAgentWipExecutionV1: approvedWip,
                  projectId: pid,
                });
                applyImplementationOrchestrationResult({
                  messages: orchestration.chatPatch.messages,
                  orchestrationPatch: {
                    ...orchestration.orchestrationPatch,
                    ...(executionState ? { implementationTaskExecutionStateV1: executionState } : {}),
                  },
                });
                if (selectedTaskId) {
                  const acceptedBoardState = markReworkRequestsAcceptedForTask({
                    state: refState.implementationExecutionBoardStateV1,
                    projectId: pid,
                    taskId: selectedTaskId,
                  });
                  void persistChatToDb(undefined, {
                    implementationExecutionBoardStateV1: acceptedBoardState,
                  });
                }
                const board = buildImplementationExecutionBoardFromRequirementsState({
                  projectId: pid,
                  orchestration: {
                    ...refState,
                    codeAgentWipExecutionV1: approvedWip,
                    implementationTaskExecutionStateV1: executionState ?? undefined,
                  } as ImplementationRequirementsBoardOrchestrationSlice,
                });
                if (board) {
                  appendImplementationTaskListAiMessage(
                    buildImplementationExecutionBoardMessage({
                      board,
                      nowIso: new Date().toISOString(),
                      previewReady: prototypeRunSyncSnapshot.previewReady,
                      codeAgentWipExecutionV1: approvedWip,
                      executionSetup: executionSetupRow,
                    }),
                  );
                }
              }
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              const routeFailedTimeline = buildCursorApiDirectTimelineEntry({
                action: "cursor_bridge_execute_route_failed",
                projectId: pid,
                selectedTaskId,
                repoFullName: targetRepository.repoFullName,
                workspacePath: readiness.context.workspaceRoot,
                branchName: wip.branchName,
                status: "failed",
                runId: bridgeRunId,
                reason: message,
                nowIso: new Date().toISOString(),
              });
              applyImplementationOrchestrationResult({
        orchestrationPatch: {
                  codeAgentWipExecutionV1: runningWip,
                  promptTimeline: [...refTimeline(), routeFailedTimeline],
                },
              });
              applyBridgeFailure(`Cursor API 실행 오류: ${message}`);
            }
          })();

          return { outcome: "executed" };
    }
    default:
      return null;
  }
}
