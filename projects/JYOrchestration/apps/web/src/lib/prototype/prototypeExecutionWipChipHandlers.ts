import {
  buildCodeAgentWipTimelineEntry,
  describeDeveloperApprovalPrecheck,
  evaluateDeveloperApprovalGate,
} from "@/lib/prototype/codeAgentWipExecution";
import {
  buildDeveloperApproveWipResult,
  buildRefactorRequestWipState,
  buildRequestCodeAgentWipWorkResult,
  buildScmOfficialCommitRequestResult,
  formatWipChangesView,
  REFACTOR_REQUEST_PROMPT,
  type CodeAgentWipChatPatch,
} from "@/lib/prototype/prototypeExecutionCodeAgentWipActions";
import {
  validateTaskScopedWorkItems,
  type CursorWorkItem,
} from "@/lib/prototype/implementationCursorWorkItems";
import {
  markDeveloperTasksInProgressForWip,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksInProgress,
  syncDeveloperTaskExecutionFromCodeAgentWip,
  type ImplementationTaskExecutionStateV1,
} from "@/lib/prototype/implementationTaskExecutionState";
import { hasImplementationTaskListReady } from "@/lib/requirements/implementationTaskList";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { PrototypeExecutionChipHandlers } from "@/lib/prototype/prototypeExecutionImplementationChips";
import {
  appendPromptTimeline,
  type PrototypeExecutionOrchestrationPersistInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import {
  buildImplementationExecutionBoardFromRequirementsState,
  buildNextDeveloperTaskContinuationNotice,
} from "@/lib/prototype/implementationExecutionBoard";
import { markReworkRequestsDoneForTask } from "@/lib/prototype/implementationExecutionBoardState";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type WipChipHandlerDeps = Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly parsedState: Pick<
    RequirementsStateJson,
    | "implementationTaskPlanV1"
    | "implementationTaskListV1"
    | "cursorWorkItemsV1"
    | "codeAgentWipExecutionV1"
    | "implementationTaskExecutionStateV1"
    | "implementationIntegratedExecutionStateV1"
    | "implementationExecutionBoardStateV1"
    | "implementationQualityGateResultsV1"
    | "promptTimeline"
  >;
  readonly applyMessages: (messages: CodeAgentWipChatPatch["messages"]) => void;
  readonly appendNotice: (text: string) => void;
  readonly persistOrchestration: (
    chat?: CodeAgentWipChatPatch,
    orch?: PrototypeExecutionOrchestrationPersistInput,
  ) => void;
  readonly focusComposer: () => void;
  readonly showToast: (message: string) => void;
}>;

export type ExecuteCodeAgentWipWorkRequestResult =
  | Readonly<{
      readonly kind: "created";
      readonly developerTaskCount: number;
      readonly selectedTaskId?: string;
      readonly selectedWorkItemIds?: readonly string[];
      readonly chatMessages: CodeAgentWipChatPatch["messages"];
      readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput & {
        readonly codeAgentWipExecutionV1: NonNullable<PrototypeExecutionOrchestrationPersistInput["codeAgentWipExecutionV1"]>;
        readonly promptTimeline: NonNullable<PrototypeExecutionOrchestrationPersistInput["promptTimeline"]>;
      };
      readonly executionState?: ImplementationTaskExecutionStateV1;
    }>
  | Readonly<{ readonly kind: "already_active" }>
  | Readonly<{ readonly kind: "blocked"; readonly message: string }>;

function persistWipResult(
  deps: WipChipHandlerDeps,
  result: {
    readonly chatPatch: CodeAgentWipChatPatch;
    readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput & {
      readonly codeAgentWipExecutionV1: NonNullable<PrototypeExecutionOrchestrationPersistInput["codeAgentWipExecutionV1"]>;
      readonly promptTimeline: NonNullable<PrototypeExecutionOrchestrationPersistInput["promptTimeline"]>;
    };
    readonly executionState?: ImplementationTaskExecutionStateV1;
  },
): void {
  deps.persistOrchestration(result.chatPatch, {
    ...result.orchestrationPatch,
    ...(result.executionState !== undefined
      ? { implementationTaskExecutionStateV1: result.executionState }
      : {}),
  });
}

function appendBlockedNotice(deps: WipChipHandlerDeps, title: string, missing: readonly string[]): void {
  deps.appendNotice([title, "", ...missing.map((m) => `- ${m}`)].join("\n"));
}

function resolveExecutionStateAfterWipChange(
  deps: WipChipHandlerDeps,
  wip: NonNullable<WipChipHandlerDeps["parsedState"]["codeAgentWipExecutionV1"]>,
): ImplementationTaskExecutionStateV1 | null | undefined {
  const workItems = deps.parsedState.cursorWorkItemsV1;
  if (!workItems?.length) return deps.parsedState.implementationTaskExecutionStateV1;
  return (
    syncDeveloperTaskExecutionFromCodeAgentWip({
      state: deps.parsedState.implementationTaskExecutionStateV1,
      taskList: deps.parsedState.implementationTaskListV1,
      cursorWorkItems: workItems,
      codeAgentWipExecutionV1: wip,
      projectId: deps.projectId,
    }) ?? undefined
  );
}

function resolveExecutionStateAfterWipWithPatch(
  deps: WipChipHandlerDeps,
  wip: NonNullable<WipChipHandlerDeps["parsedState"]["codeAgentWipExecutionV1"]>,
  patch?: (state: ImplementationTaskExecutionStateV1) => ImplementationTaskExecutionStateV1,
): ImplementationTaskExecutionStateV1 | undefined {
  const base =
    resolveExecutionStateAfterWipChange(deps, wip) ??
    deps.parsedState.implementationTaskExecutionStateV1 ??
    undefined;
  if (!base || !patch) return base;
  return patch(base);
}

export function executeCodeAgentWipWorkRequest(
  deps: WipChipHandlerDeps,
  runtime: {
    readonly plan: ImplementationTaskPlanV1;
    readonly workItems: readonly CursorWorkItem[];
    readonly taskList?: ImplementationTaskListV1;
    readonly executionState?: ImplementationTaskExecutionStateV1 | null;
    readonly selectedTaskId?: string | null;
    readonly selectedWorkItemIds?: readonly string[];
    readonly totalCandidateCount?: number;
  },
): ExecuteCodeAgentWipWorkRequestResult {
  const pid = deps.projectId.trim();
  if (!pid || !runtime.plan || !runtime.workItems.length) {
    return {
      kind: "blocked",
      message: "먼저 구현 작업목록 또는 작업 계획을 준비해 주세요.",
    };
  }

  const selectedTaskId = runtime.selectedTaskId?.trim() || runtime.workItems[0]?.taskId?.trim() || "";
  if (selectedTaskId) {
    const validation = validateTaskScopedWorkItems({
      selectedTaskId,
      selectedWorkItems: runtime.workItems,
    });
    if (!validation.ok) {
      return { kind: "blocked", message: validation.message };
    }
  }

  const result = buildRequestCodeAgentWipWorkResult({
    projectId: pid,
    requirementsStateJson: deps.requirementsStateJson,
    plan: runtime.plan,
    workItems: runtime.workItems,
    existingWip: deps.parsedState.codeAgentWipExecutionV1,
    promptTimeline: deps.parsedState.promptTimeline,
    selectedTaskId: runtime.selectedTaskId,
    selectedWorkItemIds: runtime.selectedWorkItemIds,
    totalCandidateCount: runtime.totalCandidateCount,
  });

  if (result.kind === "already_active") {
    return { kind: "already_active" };
  }
  if (result.kind === "blocked") {
    return { kind: "blocked", message: result.message };
  }

  const wip = result.orchestrationPatch.codeAgentWipExecutionV1;
  const wipExecutionId = `${wip.projectId}-${wip.requestedAt}`;

  let executionState = runtime.executionState ?? deps.parsedState.implementationTaskExecutionStateV1 ?? null;
  let developerTaskCount = 0;

  if (runtime.taskList) {
    executionState = markDeveloperTasksInProgressForWip({
      state: executionState,
      taskList: runtime.taskList,
      cursorWorkItems: runtime.workItems,
      projectId: pid,
      codeAgentWipExecutionId: wipExecutionId,
    });
    developerTaskCount = executionState.items.filter((i) => i.status === "in_progress").length;
  }

  persistWipResult(deps, {
    chatPatch: result.chatPatch,
    orchestrationPatch: result.orchestrationPatch,
    executionState: executionState ?? undefined,
  });

  const orchestrationPatch = {
    codeAgentWipExecutionV1: result.orchestrationPatch.codeAgentWipExecutionV1,
    promptTimeline: result.orchestrationPatch.promptTimeline,
    ...(executionState !== undefined ? { implementationTaskExecutionStateV1: executionState } : {}),
  };

  return {
    kind: "created",
    developerTaskCount,
    chatMessages: result.chatPatch.messages,
    orchestrationPatch,
    ...(executionState != null ? { executionState } : {}),
    ...(wip.selectedTaskId ? { selectedTaskId: wip.selectedTaskId } : {}),
    ...(wip.selectedWorkItemIds?.length ? { selectedWorkItemIds: [...wip.selectedWorkItemIds] } : {}),
  } satisfies Extract<ExecuteCodeAgentWipWorkRequestResult, { kind: "created" }>;
}

export function buildWipChipHandlerSlice(deps: WipChipHandlerDeps): Pick<
  PrototypeExecutionChipHandlers,
  | "requestCodeAgentWipWork"
  | "viewWipChanges"
  | "requestRefactor"
  | "requestAdditionalEdit"
  | "approveDeveloperResult"
  | "discardWipWork"
  | "requestScmOfficialCommit"
  | "canApproveDeveloperResult"
  | "canRequestScmOfficialCommit"
> {
  return {
    requestCodeAgentWipWork: () => {
      const plan = deps.parsedState.implementationTaskPlanV1;
      const workItems = deps.parsedState.cursorWorkItemsV1;
      if (!plan || !workItems?.length) {
        const taskListReady = hasImplementationTaskListReady(deps.parsedState.implementationTaskListV1);
        deps.showToast(
          taskListReady
            ? "구현 작업목록 기준 Code Agent WIP 후보를 먼저 준비해 주세요."
            : "구현 작업목록 또는 작업 계획을 먼저 준비해 주세요.",
        );
        return;
      }
      const result = executeCodeAgentWipWorkRequest(deps, {
        plan,
        workItems,
        executionState: deps.parsedState.implementationTaskExecutionStateV1,
      });
      if (result.kind === "blocked") {
        deps.showToast(result.message);
        return;
      }
      if (result.kind === "already_active") {
        deps.showToast("이미 Code Agent WIP 작업이 진행 중입니다.");
        return;
      }
      if (result.developerTaskCount > 0) {
        deps.showToast(
          `TaskList 기준 개발자 작업 ${result.developerTaskCount}건을 Code Agent WIP 요청으로 전환했습니다.`,
        );
      }
    },
    viewWipChanges: () => {
      const wip = deps.parsedState.codeAgentWipExecutionV1;
      if (!wip?.commits.length) {
        deps.showToast("표시할 WIP commit이 없습니다.");
        return;
      }
      deps.appendNotice(formatWipChangesView(wip));
    },
    requestRefactor: () => {
      const wip = deps.parsedState.codeAgentWipExecutionV1;
      if (!wip) {
        deps.showToast("먼저 코드 에이전트 WIP 작업을 요청해 주세요.");
        return;
      }
      const updated = buildRefactorRequestWipState({ wip });
      const timeline = appendPromptTimeline(
        deps.parsedState.promptTimeline,
        buildCodeAgentWipTimelineEntry({
          action: "refactor_requested",
          wip: updated,
          actor: "ai_developer",
        }),
      );
      deps.persistOrchestration(undefined, { codeAgentWipExecutionV1: updated, promptTimeline: timeline });
      deps.showToast(REFACTOR_REQUEST_PROMPT);
      deps.focusComposer();
    },
    requestAdditionalEdit: () => {
      deps.showToast("추가 수정 요청 내용을 아래 입력란에 적고 전송해 주세요.");
      deps.focusComposer();
    },
    approveDeveloperResult: () => {
      const wip = deps.parsedState.codeAgentWipExecutionV1;
      if (!wip) {
        deps.showToast("WIP 검토 대상이 없습니다.");
        return;
      }
      const result = buildDeveloperApproveWipResult({
        requirementsStateJson: deps.requirementsStateJson,
        wip,
        promptTimeline: deps.parsedState.promptTimeline,
      });
      if (result.kind === "blocked") {
        const precheck = describeDeveloperApprovalPrecheck(wip);
        appendBlockedNotice(deps, precheck.title, [...precheck.lines, ...result.missing]);
        return;
      }
      const approvedWip = result.orchestrationPatch.codeAgentWipExecutionV1;
      const executionState = resolveExecutionStateAfterWipWithPatch(deps, approvedWip, (state) =>
        markPostDeveloperReviewTasksQueued({ state }),
      );
      persistWipResult(deps, {
        ...result,
        executionState,
      });
      const reworkTaskId = approvedWip.selectedTaskId?.trim();
      if (reworkTaskId) {
        const boardStatePatch = markReworkRequestsDoneForTask({
          state: deps.parsedState.implementationExecutionBoardStateV1,
          projectId: deps.projectId,
          taskId: reworkTaskId,
        });
        deps.persistOrchestration(undefined, {
          implementationExecutionBoardStateV1: boardStatePatch,
        });
        deps.appendNotice(`${reworkTaskId} 작업의 재작업 요청을 완료 처리했습니다.`);
      }
      const taskList = deps.parsedState.implementationTaskListV1;
      if (taskList && executionState) {
        const board = buildImplementationExecutionBoardFromRequirementsState({
          projectId: deps.projectId,
          orchestration: deps.parsedState,
        });
        if (!board) return;
        const notice = buildNextDeveloperTaskContinuationNotice(board);
        if (notice) deps.appendNotice(notice);
      }
    },
    discardWipWork: () => {
      const wip = deps.parsedState.codeAgentWipExecutionV1;
      if (!wip) return;
      const failedWip = { ...wip, status: "failed" as const };
      const executionState = resolveExecutionStateAfterWipChange(deps, failedWip);
      deps.persistOrchestration(undefined, {
        codeAgentWipExecutionV1: failedWip,
        ...(executionState !== undefined
          ? { implementationTaskExecutionStateV1: executionState }
          : {}),
      });
      deps.showToast("WIP 작업을 폐기했습니다.");
    },
    requestScmOfficialCommit: () => {
      const wip = deps.parsedState.codeAgentWipExecutionV1;
      if (!wip) {
        deps.showToast("WIP 승인 상태가 없습니다.");
        return;
      }
      const result = buildScmOfficialCommitRequestResult({
        requirementsStateJson: deps.requirementsStateJson,
        wip,
        promptTimeline: deps.parsedState.promptTimeline,
      });
      if (result.kind === "blocked") {
        deps.showToast(result.reason);
        return;
      }
      const scmWip = result.orchestrationPatch.codeAgentWipExecutionV1;
      persistWipResult(deps, {
        ...result,
        executionState: resolveExecutionStateAfterWipWithPatch(deps, scmWip, (state) =>
          markRoleTasksInProgress({
            state,
            ownerRole: "scm",
            resultSummary: "SCM 공식 반영 요청됨",
          }),
        ),
      });
    },
    canApproveDeveloperResult: () => {
      const wip = deps.parsedState.codeAgentWipExecutionV1;
      const precheck = describeDeveloperApprovalPrecheck(wip);
      const gate = evaluateDeveloperApprovalGate(wip);
      if (!gate.allowed) {
        appendBlockedNotice(deps, precheck.title, [...precheck.lines, ...gate.missing]);
        return false;
      }
      return true;
    },
    canRequestScmOfficialCommit: () => {
      if (deps.parsedState.codeAgentWipExecutionV1?.status !== "developer_approved") {
        deps.showToast("AI개발자 [구현 결과 승인] 후 SCM 공식 반영을 요청할 수 있습니다.");
        return false;
      }
      return true;
    },
  };
}
