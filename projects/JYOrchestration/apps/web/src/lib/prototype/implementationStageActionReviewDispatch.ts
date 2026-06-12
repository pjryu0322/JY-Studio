import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationStageActionId } from "@/lib/prototype/effectiveImplementationState";
import { buildImplementationReviewStageReadyMarker } from "@/lib/prototype/implementationReviewStageReady";
import {
  buildImplementationExecutionBoardFromRequirementsState,
  isImplementationReadyForReviewStage,
  pickFirstExecutableDeveloperTaskId,
  type ImplementationRequirementsBoardOrchestrationSlice,
} from "@/lib/prototype/implementationExecutionBoard";
import {
  buildImplementationExecutionBoardMessage,
  tryAppendImplementationUserConfirmationBoardMessage,
} from "@/lib/prototype/implementationExecutionBoardMessage";
import { resolveIntegratedAppPreviewReadyFromOrchestration } from "@/lib/prototype/implementationPreviewReadiness";
import { resolveAllPendingUserConfirmations } from "@/lib/prototype/implementationExecutionBoardState";
import {
  buildReviewFeedbackConvertNotice,
  canCompleteReviewStage,
  convertReviewFeedbackToImplementationRework,
  getActiveReviewFeedbackItems,
} from "@/lib/prototype/reviewStageUserFeedback";
import {
  buildInitialReviewStageUserTestSession,
  markReviewStageReturnedToImplementation,
  markReviewStageUserTestCompleted,
  markReviewStageUserTestStarted,
} from "@/lib/prototype/reviewStageUserTest";
import {
  buildReviewStageEntryMessage,
  buildReviewStageViewFeedbackMessage,
  REVIEW_STAGE_ADD_FEEDBACK_GUIDE,
} from "@/lib/prototype/reviewStageMessage";
import {
  buildImplementationStageActionFocusComposerResult,
  type ImplementationStageActionExecutionResult,
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
    result: ImplementationStageActionExecutionResult,
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
    case "MOVE_TO_REVIEW_STAGE": {
      const pid = deps.projectId.trim();
      const board = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: deps.parsedRequirementsState,
      });
      const integratedAppPreviewReady = resolveIntegratedAppPreviewReadyFromOrchestration({
        projectId: pid,
        orchestration: deps.parsedRequirementsState,
      });
      if (
        !board ||
        !isImplementationReadyForReviewStage({
          board,
          previewReady: integratedAppPreviewReady,
          integratedAppPreviewReady,
        })
      ) {
        const message = !integratedAppPreviewReady
          ? "실제 앱 Preview가 준비되지 않아 검토단계로 이동할 수 없습니다. 최종 Wiring·통합·build 검증을 완료해 주세요."
          : "구현 실행 보드가 완료되지 않아 검토단계로 이동할 수 없습니다.";
        return { outcome: "blocked", message };
      }
      const reviewMarker = buildImplementationReviewStageReadyMarker({
        previewReady: integratedAppPreviewReady,
        nowIso: new Date().toISOString(),
      });
      const previewUrlForReview =
        deps.previewUrl ?? deps.prototypeRunSyncSnapshot.previewUrl ?? undefined;
      const session =
        deps.parsedRequirementsState.reviewStageUserTestSessionV1 ??
        buildInitialReviewStageUserTestSession({
          projectId: pid,
          previewUrl: previewUrlForReview,
        });
      void deps.persistChatToDb(undefined, {
        implementationReviewStageReadyV1: reviewMarker,
        reviewStageUserTestSessionV1: session,
      });
      deps.appendImplementationTaskListAiMessage(
        buildReviewStageEntryMessage({
          entryReady: true,
          implementationReviewStageReadyV1: reviewMarker,
          previewReady: integratedAppPreviewReady,
          session,
          feedbackList: deps.parsedRequirementsState.reviewStageUserFeedbackListV1,
          previewUrl: previewUrlForReview,
        }),
      );
      const message =
        "검토단계로 이동할 수 있습니다. 좌측 [검토] 메뉴에서 프로토타입 사용자 테스트를 진행하세요.";
      deps.appendAiNoticeForImplementation(message);
      return { outcome: "executed" };
    }
    case "REVIEW_STAGE_OPEN_PREVIEW": {
      const url = deps.previewUrl ?? deps.prototypeRunSyncSnapshot.previewUrl;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return { outcome: "executed" };
      }
      return { outcome: "blocked", message: "Preview URL이 아직 없습니다." };
    }
    case "REVIEW_STAGE_START_USER_TEST": {
      const pid = deps.projectId.trim();
      const previewUrlForReview =
        deps.previewUrl ?? deps.prototypeRunSyncSnapshot.previewUrl ?? undefined;
      const session = markReviewStageUserTestStarted({
        session: deps.parsedRequirementsState.reviewStageUserTestSessionV1,
        projectId: pid,
        previewUrl: previewUrlForReview,
      });
      void deps.persistChatToDb(undefined, { reviewStageUserTestSessionV1: session });
      deps.appendImplementationTaskListAiMessage(
        buildReviewStageEntryMessage({
          entryReady: true,
          implementationReviewStageReadyV1: deps.parsedRequirementsState.implementationReviewStageReadyV1,
          previewReady: deps.prototypeRunSyncSnapshot.previewReady,
          session,
          feedbackList: deps.parsedRequirementsState.reviewStageUserFeedbackListV1,
          previewUrl: previewUrlForReview,
        }),
      );
      const notice = "사용자 테스트를 시작했습니다. Preview에서 화면·흐름·문구를 확인해 주세요.";
      deps.appendAiNoticeForImplementation(notice);
      return { outcome: "executed" };
    }
    case "REVIEW_STAGE_ADD_FEEDBACK": {
      deps.applyImplementationStageActionExecutionResult(
        buildImplementationStageActionFocusComposerResult(REVIEW_STAGE_ADD_FEEDBACK_GUIDE),
      );
      return { outcome: "executed" };
    }
    case "REVIEW_STAGE_VIEW_FEEDBACK": {
      deps.appendImplementationTaskListAiMessage(
        buildReviewStageViewFeedbackMessage({
          feedbackList: deps.parsedRequirementsState.reviewStageUserFeedbackListV1,
        }),
      );
      return { outcome: "executed" };
    }
    case "REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION": {
      const pid = deps.projectId.trim();
      const board = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: deps.parsedRequirementsState,
      });
      if (!board) {
        const message = "구현 작업 보드가 없어 보완 요청을 등록할 수 없습니다.";
        return { outcome: "blocked", message };
      }
      const active = getActiveReviewFeedbackItems(
        deps.parsedRequirementsState.reviewStageUserFeedbackListV1,
      );
      const feedback = active[0];
      if (!feedback) {
        const message = "구현단계로 전환할 미처리 피드백이 없습니다.";
        return { outcome: "blocked", message };
      }
      const fallbackTaskId =
        pickFirstExecutableDeveloperTaskId(board) ??
        board.taskRows.find((row) => row.developerStatus !== "skipped")?.taskId ??
        "";
      if (!fallbackTaskId) {
        const message = "보완 요청을 연결할 developer 작업이 없습니다.";
        return { outcome: "blocked", message };
      }
      const feedbackList = deps.parsedRequirementsState.reviewStageUserFeedbackListV1;
      if (!feedbackList) {
        const message = "피드백 목록이 없습니다.";
        return { outcome: "blocked", message };
      }
      const converted = convertReviewFeedbackToImplementationRework({
        feedbackList,
        boardState: deps.parsedRequirementsState.implementationExecutionBoardStateV1,
        projectId: pid,
        feedbackId: feedback.feedbackId,
        fallbackTaskId,
      });
      const session = markReviewStageReturnedToImplementation({
        session:
          deps.parsedRequirementsState.reviewStageUserTestSessionV1 ??
          buildInitialReviewStageUserTestSession({ projectId: pid }),
      });
      void deps.persistChatToDb(undefined, {
        reviewStageUserFeedbackListV1: converted.feedbackList,
        implementationExecutionBoardStateV1: converted.boardState,
        reviewStageUserTestSessionV1: session,
      });
      const nextBoard = buildImplementationExecutionBoardFromRequirementsState({
        projectId: pid,
        orchestration: {
          ...deps.parsedRequirementsState,
          implementationExecutionBoardStateV1: converted.boardState,
          reviewStageUserFeedbackListV1: converted.feedbackList,
          reviewStageUserTestSessionV1: session,
        } as ImplementationRequirementsBoardOrchestrationSlice,
      });
      if (nextBoard) {
        deps.appendImplementationTaskListAiMessage(
          buildImplementationExecutionBoardMessage({
            board: nextBoard,
            nowIso: new Date().toISOString(),
            previewReady: deps.prototypeRunSyncSnapshot.previewReady,
            executionSetup: deps.executionSetupRow,
          }),
        );
      }
      const notice = buildReviewFeedbackConvertNotice({
        feedbackId: converted.feedbackId,
        targetTaskId: converted.targetTaskId,
        reworkRequestId: converted.reworkRequestId,
      });
      deps.appendAiNoticeForImplementation(notice);
      return { outcome: "executed" };
    }
    case "REVIEW_STAGE_COMPLETE_TEST": {
      const completeGate = canCompleteReviewStage({
        feedbackList: deps.parsedRequirementsState.reviewStageUserFeedbackListV1,
      });
      if (!completeGate.ok) {
        return { outcome: "blocked", message: completeGate.message };
      }
      const session = deps.parsedRequirementsState.reviewStageUserTestSessionV1;
      if (!session) {
        const message = "사용자 테스트 세션이 없습니다. 먼저 사용자 테스트를 시작해 주세요.";
        return { outcome: "blocked", message };
      }
      const completed = markReviewStageUserTestCompleted({ session });
      void deps.persistChatToDb(undefined, { reviewStageUserTestSessionV1: completed });
      deps.appendImplementationTaskListAiMessage(
        buildReviewStageEntryMessage({
          entryReady: true,
          implementationReviewStageReadyV1: deps.parsedRequirementsState.implementationReviewStageReadyV1,
          previewReady: deps.prototypeRunSyncSnapshot.previewReady,
          session: completed,
          feedbackList: deps.parsedRequirementsState.reviewStageUserFeedbackListV1,
          previewUrl: deps.previewUrl ?? deps.prototypeRunSyncSnapshot.previewUrl ?? undefined,
        }),
      );
      const notice = "프로토타입 사용자 테스트 검토를 완료했습니다.";
      deps.appendAiNoticeForImplementation(notice);
      return { outcome: "executed" };
    }
    default:
      return null;
  }
}
