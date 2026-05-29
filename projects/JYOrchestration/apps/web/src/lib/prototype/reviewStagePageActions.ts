import {
  buildImplementationExecutionBoard,
  buildImplementationExecutionBoardFromRequirementsState,
  pickFirstExecutableDeveloperTaskId,
} from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationExecutionBoardStateV1 } from "@/lib/prototype/implementationExecutionBoardState";
import {
  appendReviewStageUserFeedback,
  buildReviewFeedbackConvertNotice,
  buildReviewFeedbackDraftFromUserText,
  canCompleteReviewStage,
  convertReviewFeedbackToImplementationRework,
  getActiveReviewFeedbackItems,
  type ReviewStageUserFeedbackListV1,
} from "@/lib/prototype/reviewStageUserFeedback";
import { buildReviewStageViewFeedbackMessage } from "@/lib/prototype/reviewStageMessage";
import {
  buildInitialReviewStageUserTestSession,
  markReviewStageReturnedToImplementation,
  markReviewStageUserTestCompleted,
  markReviewStageUserTestFeedbackRegistered,
  markReviewStageUserTestStarted,
  type ReviewStageUserTestSessionV1,
} from "@/lib/prototype/reviewStageUserTest";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ReviewStageActionId } from "@/lib/prototype/reviewStageMessage";

export type ReviewStageRequirementsPatch = Pick<
  RequirementsStateJson,
  | "reviewStageUserTestSessionV1"
  | "reviewStageUserFeedbackListV1"
  | "implementationExecutionBoardStateV1"
>;

export type ReviewStagePageActionResult =
  | {
      readonly ok: true;
      readonly patch: ReviewStageRequirementsPatch;
      readonly notice?: string;
      readonly feedbackCaptureMode?: boolean;
      readonly viewFeedbackLines?: readonly string[];
    }
  | { readonly ok: false; readonly message: string };

function resolveFallbackTaskId(
  projectId: string,
  orchestration: RequirementsStateJson,
): string {
  const board = buildImplementationExecutionBoardFromRequirementsState({
    projectId,
    orchestration,
  });
  if (!board) return "";
  return (
    pickFirstExecutableDeveloperTaskId(board) ??
    board.taskRows.find((row) => row.developerStatus !== "skipped")?.taskId ??
    ""
  );
}

export function registerReviewStageUserFeedbackFromText(input: {
  readonly projectId: string;
  readonly text: string;
  readonly feedbackList?: ReviewStageUserFeedbackListV1 | null;
  readonly session?: ReviewStageUserTestSessionV1 | null;
  readonly previewUrl?: string;
  readonly nowIso?: string;
}):
  | {
      readonly ok: true;
      readonly patch: ReviewStageRequirementsPatch;
      readonly feedbackId: string;
    }
  | { readonly ok: false; readonly message: string } {
  const draft = buildReviewFeedbackDraftFromUserText({ text: input.text });
  if ("ok" in draft) {
    return { ok: false, message: draft.message };
  }
  const now = input.nowIso ?? new Date().toISOString();
  const feedbackList = appendReviewStageUserFeedback({
    list: input.feedbackList,
    projectId: input.projectId,
    title: draft.title,
    detail: draft.detail,
    category: draft.category,
    severity: draft.severity,
    nowIso: now,
  });
  const feedbackId = feedbackList.items[feedbackList.items.length - 1]?.feedbackId ?? "";
  const sessionBase =
    input.session ??
    buildInitialReviewStageUserTestSession({
      projectId: input.projectId,
      previewUrl: input.previewUrl,
      nowIso: now,
    });
  const session = markReviewStageUserTestFeedbackRegistered({ session: sessionBase, nowIso: now });
  return {
    ok: true,
    patch: {
      reviewStageUserFeedbackListV1: feedbackList,
      reviewStageUserTestSessionV1: session,
    },
    feedbackId,
  };
}

export function runReviewStagePageAction(input: {
  readonly actionId: ReviewStageActionId;
  readonly projectId: string;
  readonly orchestration: RequirementsStateJson;
  readonly previewUrl?: string;
  readonly nowIso?: string;
}): ReviewStagePageActionResult {
  const pid = input.projectId.trim();
  const session = input.orchestration.reviewStageUserTestSessionV1;
  const feedbackList = input.orchestration.reviewStageUserFeedbackListV1;
  const now = input.nowIso ?? new Date().toISOString();

  switch (input.actionId) {
    case "REVIEW_STAGE_OPEN_PREVIEW": {
      const url = input.previewUrl?.trim();
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return { ok: true, patch: {} };
    }
    case "REVIEW_STAGE_START_USER_TEST": {
      const nextSession = markReviewStageUserTestStarted({
        session,
        projectId: pid,
        previewUrl: input.previewUrl,
        nowIso: now,
      });
      return {
        ok: true,
        patch: { reviewStageUserTestSessionV1: nextSession },
        notice: "사용자 테스트를 시작했습니다. 프로토타입을 직접 확인하며 사용자 피드백을 등록해 주세요.",
      };
    }
    case "REVIEW_STAGE_ADD_FEEDBACK": {
      return {
        ok: true,
        patch: {},
        feedbackCaptureMode: true,
        notice:
          "다음 채팅 메시지는 사용자 피드백으로 저장됩니다. (AI개선안과 별도)\n예: \"다운로드 버튼 위치가 눈에 잘 안 보입니다.\"",
      };
    }
    case "REVIEW_STAGE_VIEW_FEEDBACK": {
      const message = buildReviewStageViewFeedbackMessage({ feedbackList, nowIso: now });
      return {
        ok: true,
        patch: {},
        viewFeedbackLines: message.content.split("\n"),
      };
    }
    case "REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION": {
      const active = getActiveReviewFeedbackItems(feedbackList);
      const feedback = active[0];
      if (!feedback) {
        return { ok: false, message: "구현단계로 전환할 미처리 사용자 피드백이 없습니다." };
      }
      const list = feedbackList;
      if (!list) {
        return { ok: false, message: "사용자 피드백 목록이 없습니다." };
      }
      const fallbackTaskId = resolveFallbackTaskId(pid, input.orchestration);
      if (!fallbackTaskId) {
        return { ok: false, message: "보완 요청을 연결할 developer 작업이 없습니다." };
      }
      const converted = convertReviewFeedbackToImplementationRework({
        feedbackList: list,
        boardState: input.orchestration.implementationExecutionBoardStateV1,
        projectId: pid,
        feedbackId: feedback.feedbackId,
        fallbackTaskId,
        nowIso: now,
      });
      const nextSession = markReviewStageReturnedToImplementation({
        session: session ?? buildInitialReviewStageUserTestSession({ projectId: pid, nowIso: now }),
        nowIso: now,
      });
      return {
        ok: true,
        patch: {
          reviewStageUserFeedbackListV1: converted.feedbackList,
          implementationExecutionBoardStateV1: converted.boardState,
          reviewStageUserTestSessionV1: nextSession,
        },
        notice: buildReviewFeedbackConvertNotice({
          feedbackId: converted.feedbackId,
          targetTaskId: converted.targetTaskId,
          reworkRequestId: converted.reworkRequestId,
        }),
      };
    }
    case "REVIEW_STAGE_COMPLETE_TEST": {
      const gate = canCompleteReviewStage({ feedbackList });
      if (!gate.ok) {
        return { ok: false, message: gate.message };
      }
      if (!session) {
        return {
          ok: false,
          message: "사용자 테스트 세션이 없습니다. 먼저 사용자 테스트를 시작해 주세요.",
        };
      }
      const completed = markReviewStageUserTestCompleted({ session, nowIso: now });
      return {
        ok: true,
        patch: { reviewStageUserTestSessionV1: completed },
        notice: "프로토타입 사용자 테스트 검토를 완료했습니다.",
      };
    }
    default:
      return { ok: false, message: "지원하지 않는 검토단계 작업입니다." };
  }
}

export function buildReviewStagePageActionBoardPreview(input: {
  readonly projectId: string;
  readonly orchestration: RequirementsStateJson;
  readonly boardState?: ImplementationExecutionBoardStateV1;
}): ReturnType<typeof buildImplementationExecutionBoard> | null {
  const taskList = input.orchestration.implementationTaskListV1;
  if (!taskList) return null;
  return buildImplementationExecutionBoard({
    projectId: input.projectId,
    taskList,
    boardState: input.boardState ?? input.orchestration.implementationExecutionBoardStateV1,
  });
}
