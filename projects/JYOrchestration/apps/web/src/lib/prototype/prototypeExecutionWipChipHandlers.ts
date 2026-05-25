import {
  buildCodeAgentWipTimelineEntry,
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
import type { PrototypeExecutionChipHandlers } from "@/lib/prototype/prototypeExecutionImplementationChips";
import {
  appendPromptTimeline,
  type PrototypeExecutionOrchestrationPersistInput,
} from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export type WipChipHandlerDeps = Readonly<{
  readonly projectId: string;
  readonly requirementsStateJson: unknown;
  readonly parsedState: Pick<
    RequirementsStateJson,
    | "implementationTaskPlanV1"
    | "cursorWorkItemsV1"
    | "codeAgentWipExecutionV1"
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

function persistWipResult(
  deps: WipChipHandlerDeps,
  result: {
    readonly chatPatch: CodeAgentWipChatPatch;
    readonly orchestrationPatch: PrototypeExecutionOrchestrationPersistInput & {
      readonly codeAgentWipExecutionV1: NonNullable<PrototypeExecutionOrchestrationPersistInput["codeAgentWipExecutionV1"]>;
      readonly promptTimeline: NonNullable<PrototypeExecutionOrchestrationPersistInput["promptTimeline"]>;
    };
  },
): void {
  deps.applyMessages(result.chatPatch.messages);
  deps.persistOrchestration(result.chatPatch, result.orchestrationPatch);
}

function appendBlockedNotice(deps: WipChipHandlerDeps, title: string, missing: readonly string[]): void {
  deps.appendNotice([title, "", ...missing.map((m) => `- ${m}`)].join("\n"));
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
      const pid = deps.projectId.trim();
      const plan = deps.parsedState.implementationTaskPlanV1;
      const workItems = deps.parsedState.cursorWorkItemsV1;
      if (!pid || !plan || !workItems?.length) {
        deps.showToast("먼저 [구현 작업안 확정]을 완료해 주세요.");
        return;
      }
      const result = buildRequestCodeAgentWipWorkResult({
        projectId: pid,
        requirementsStateJson: deps.requirementsStateJson,
        plan,
        workItems,
        existingWip: deps.parsedState.codeAgentWipExecutionV1,
        promptTimeline: deps.parsedState.promptTimeline,
      });
      if (result.kind === "already_active") {
        deps.showToast("이미 Code Agent WIP 작업이 진행 중입니다.");
        return;
      }
      persistWipResult(deps, result);
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
        appendBlockedNotice(deps, "구현 결과 승인 조건이 충족되지 않았습니다.", result.missing);
        return;
      }
      persistWipResult(deps, result);
    },
    discardWipWork: () => {
      const wip = deps.parsedState.codeAgentWipExecutionV1;
      if (!wip) return;
      deps.persistOrchestration(undefined, { codeAgentWipExecutionV1: { ...wip, status: "failed" } });
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
      persistWipResult(deps, result);
    },
    canApproveDeveloperResult: () => {
      const gate = evaluateDeveloperApprovalGate(deps.parsedState.codeAgentWipExecutionV1);
      if (!gate.allowed) {
        appendBlockedNotice(deps, "구현 결과 승인 전 확인이 필요합니다.", gate.missing);
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
