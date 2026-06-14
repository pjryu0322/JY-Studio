import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationStageActionId } from "@/lib/prototype/effectiveImplementationState";
import {
  buildImplementationExecutionBoardFromRequirementsState,
} from "@/lib/prototype/implementationExecutionBoard";
import { tryAppendImplementationUserConfirmationBoardMessage } from "@/lib/prototype/implementationExecutionBoardMessage";
import { resolveAllPendingUserConfirmations } from "@/lib/prototype/implementationExecutionBoardState";
import {
  type ImplementationStageActionRunResult,
} from "@/lib/prototype/implementationStageActionPipeline";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import type { deriveImplementationPrototypeRunSyncSnapshot } from "@/lib/prototype/implementationPrototypeRunSync";

export type ImplementationStageActionReviewDispatchDeps = Readonly<{
  readonly projectId: string;
  readonly parsedRequirementsState: RequirementsStateJson;
  readonly previewUrl: string | null | undefined;
  readonly prototypeRunSyncSnapshot: ReturnType<typeof deriveImplementationPrototypeRunSyncSnapshot>;
  readonly executionSetupRow: ExecutionSetupSourceGenerationRow | null;
  readonly persistChatToDb: (
    chat?: unknown,
    patch?: unknown,
  ) => void | Promise<void>;
  readonly appendAiNoticeForImplementation: (text: string) => void;
  readonly appendUserNotice: (message: string) => void;
  readonly appendImplementationTaskListAiMessage: (message: RequirementsMessage) => void;
  readonly applyImplementationStageActionExecutionResult: (
    result: import("@/lib/prototype/implementationStageActionPipeline").ImplementationStageActionExecutionResult,
  ) => void;
}>;

export function dispatchReviewAndConfirmationStageAction(
  actionId: ImplementationStageActionId,
  deps: ImplementationStageActionReviewDispatchDeps,
): ImplementationStageActionRunResult | null {
  switch (actionId) {
    case "RESOLVE_USER_CONFIRMATION": {
      const pid = deps.projectId.trim();
      const nextBoardState = resolveAllPendingUserConfirmations({
        state: deps.parsedRequirementsState.implementationExecutionBoardStateV1,
        projectId: pid,
      });
      void deps.persistChatToDb(undefined, {
        implementationExecutionBoardStateV1: nextBoardState,
      });
      const notice = "사용자 확인 항목을 처리했습니다. 후속 작업을 이어갈 수 있습니다.";
      deps.appendAiNoticeForImplementation(notice);
      return { outcome: "executed" };
    }
    case "SHOW_USER_CONFIRMATION_ITEMS": {
      const pid = deps.projectId.trim();
      const result = tryAppendImplementationUserConfirmationBoardMessage({
        board: buildImplementationExecutionBoardFromRequirementsState({
          projectId: pid,
          orchestration: deps.parsedRequirementsState,
        }),
        nowIso: new Date().toISOString(),
        appendAiMessage: deps.appendImplementationTaskListAiMessage,
        appendUserNotice: deps.appendUserNotice,
      });
      if (result.kind === "appended") return { outcome: "executed" };
      return { outcome: "blocked", message: result.message };
    }
    default:
      return null;
  }
}
