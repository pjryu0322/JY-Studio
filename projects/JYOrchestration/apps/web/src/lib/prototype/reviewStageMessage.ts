import {
  REVIEW_STAGE_ADD_FEEDBACK_CHIP,
  REVIEW_STAGE_COMPLETE_TEST_CHIP,
  REVIEW_STAGE_OPEN_PREVIEW_CHIP,
  REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP,
  REVIEW_STAGE_START_USER_TEST_CHIP,
  REVIEW_STAGE_VIEW_FEEDBACK_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import {
  getActiveReviewFeedbackItems,
  summarizeReviewStageUserFeedback,
  type ReviewStageUserFeedbackListV1,
} from "@/lib/prototype/reviewStageUserFeedback";
import {
  isReviewStageEntryReady,
  type ReviewStageUserTestSessionV1,
} from "@/lib/prototype/reviewStageUserTest";
import type { ImplementationReviewStageReadyV1 } from "@/lib/prototype/implementationReviewStageReady";

export const REVIEW_STAGE_ENTRY_MESSAGE_INTERNAL_TYPE = "REVIEW_STAGE_ENTRY_V1" as const;

export type ReviewStageActionId =
  | "REVIEW_STAGE_OPEN_PREVIEW"
  | "REVIEW_STAGE_START_USER_TEST"
  | "REVIEW_STAGE_ADD_FEEDBACK"
  | "REVIEW_STAGE_VIEW_FEEDBACK"
  | "REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION"
  | "REVIEW_STAGE_COMPLETE_TEST";

const SESSION_STATUS_LABEL: Readonly<Record<string, string>> = {
  not_started: "시작 전",
  in_progress: "사용자 테스트 진행 중",
  feedback_registered: "피드백 등록됨",
  completed: "검토 완료",
  returned_to_implementation: "구현단계 보완 진행 중",
};

export function mapReviewStageChipToAction(label: string): ReviewStageActionId | null {
  const chip = label.trim();
  switch (chip) {
    case REVIEW_STAGE_OPEN_PREVIEW_CHIP:
      return "REVIEW_STAGE_OPEN_PREVIEW";
    case REVIEW_STAGE_START_USER_TEST_CHIP:
      return "REVIEW_STAGE_START_USER_TEST";
    case REVIEW_STAGE_ADD_FEEDBACK_CHIP:
      return "REVIEW_STAGE_ADD_FEEDBACK";
    case REVIEW_STAGE_VIEW_FEEDBACK_CHIP:
      return "REVIEW_STAGE_VIEW_FEEDBACK";
    case REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP:
      return "REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION";
    case REVIEW_STAGE_COMPLETE_TEST_CHIP:
      return "REVIEW_STAGE_COMPLETE_TEST";
    default:
      return null;
  }
}

function formatSessionStatus(session?: ReviewStageUserTestSessionV1 | null): string {
  if (!session) return "시작 전";
  return SESSION_STATUS_LABEL[session.status] ?? session.status;
}

export function deriveReviewStageInterviewChips(input: {
  readonly entryReady: boolean;
  readonly feedbackList?: ReviewStageUserFeedbackListV1 | null;
  readonly session?: ReviewStageUserTestSessionV1 | null;
}): readonly string[] {
  if (!input.entryReady) return [];
  const summary = summarizeReviewStageUserFeedback(input.feedbackList);
  const chips: string[] = [];

  if (input.session?.status === "completed") {
    if (summary.active > 0) {
      chips.push(REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP);
    }
    chips.push(REVIEW_STAGE_OPEN_PREVIEW_CHIP);
    if (summary.total > 0) {
      chips.push(REVIEW_STAGE_VIEW_FEEDBACK_CHIP);
    }
    chips.push(REVIEW_STAGE_ADD_FEEDBACK_CHIP);
    return chips;
  }

  if (summary.active > 0) {
    chips.push(REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP);
    chips.push(REVIEW_STAGE_VIEW_FEEDBACK_CHIP);
    chips.push(REVIEW_STAGE_ADD_FEEDBACK_CHIP);
    if (summary.blocking === 0) {
      chips.push(REVIEW_STAGE_COMPLETE_TEST_CHIP);
    }
    chips.push(REVIEW_STAGE_OPEN_PREVIEW_CHIP);
    return chips;
  }
  if (input.session?.status === "not_started" || !input.session) {
    chips.push(REVIEW_STAGE_START_USER_TEST_CHIP);
  }
  chips.push(REVIEW_STAGE_OPEN_PREVIEW_CHIP);
  chips.push(REVIEW_STAGE_ADD_FEEDBACK_CHIP);
  if (input.session?.status === "in_progress" || input.session?.status === "feedback_registered") {
    chips.push(REVIEW_STAGE_COMPLETE_TEST_CHIP);
  }
  return chips;
}

export function buildReviewStageEntryMessage(input: {
  readonly entryReady: boolean;
  readonly implementationReviewStageReadyV1?: ImplementationReviewStageReadyV1 | null;
  readonly previewReady?: boolean;
  readonly session?: ReviewStageUserTestSessionV1 | null;
  readonly feedbackList?: ReviewStageUserFeedbackListV1 | null;
  readonly previewUrl?: string;
  readonly nowIso?: string;
}): RequirementsMessage {
  const now = input.nowIso ?? new Date().toISOString();
  const entryReady =
    input.entryReady ||
    isReviewStageEntryReady({
      implementationReviewStageReadyV1: input.implementationReviewStageReadyV1,
      previewReady: input.previewReady,
    });

  if (!entryReady) {
    const blockedBody = [
      "아직 검토단계를 시작할 수 없습니다.",
      "구현단계에서 통합 정리, 통합 검수, 통합 보안, 최종 SCM, Preview 준비가 완료되어야 합니다.",
      input.previewReady === false
        ? "현재 Preview 준비 상태를 확인한 뒤 다시 시도해 주세요."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    return newRequirementsMessage({
      role: "ai",
      content: blockedBody,
      meta: {
        stage: "REQUIREMENTS",
        internalType: REVIEW_STAGE_ENTRY_MESSAGE_INTERNAL_TYPE,
        interviewSuggestions: [],
        interviewAllowCustomInput: true,
      },
      createdAt: now,
    });
  }

  const previewUrl =
    input.previewUrl?.trim() ||
    input.session?.previewUrl?.trim() ||
    "(Preview URL 없음 — 프로토타입 열기로 확인)";
  const summary = summarizeReviewStageUserFeedback(input.feedbackList);
  const activeItems = getActiveReviewFeedbackItems(input.feedbackList);
  const feedbackLines =
    activeItems.length === 0
      ? ["- (등록된 미처리 피드백 없음)"]
      : activeItems.slice(0, 8).map(
          (item) =>
            `- [${item.severity}] ${item.title}${item.targetTaskId ? ` (${item.targetTaskId})` : ""}`,
        );

  const body = [
    "프로토타입 검토단계입니다.",
    "",
    "검토 대상:",
    `- Preview URL: ${previewUrl}`,
    `- 상태: ${formatSessionStatus(input.session)}`,
    "",
    "사용자 테스트 항목:",
    "1. 주요 화면이 의도대로 보이는지 확인",
    "2. 핵심 기능 흐름이 이어지는지 확인",
    "3. 문구/버튼/빈 상태/오류 메시지가 적절한지 확인",
    "4. 수정이 필요한 내용을 피드백으로 등록",
    "",
    "등록된 피드백:",
    `- 전체 ${summary.total}건`,
    `- 미처리 ${summary.active}건`,
    `- blocking ${summary.blocking}건`,
    ...feedbackLines,
    "",
    "다음 작업을 선택해 주세요.",
  ].join("\n");

  return newRequirementsMessage({
    role: "ai",
    content: body,
    meta: {
      stage: "REQUIREMENTS",
      internalType: REVIEW_STAGE_ENTRY_MESSAGE_INTERNAL_TYPE,
      interviewSuggestions: deriveReviewStageInterviewChips({
        entryReady: true,
        feedbackList: input.feedbackList,
        session: input.session,
      }),
      interviewAllowCustomInput: true,
    },
    createdAt: now,
  });
}

export const REVIEW_STAGE_ADD_FEEDBACK_GUIDE =
  "아래 입력란에 수정이 필요한 내용을 적어 주세요.\n예: \"결과 화면에서 다운로드 버튼 위치가 눈에 잘 띄지 않습니다.\"";

export function buildReviewStageViewFeedbackMessage(input: {
  readonly feedbackList?: ReviewStageUserFeedbackListV1 | null;
  readonly nowIso?: string;
}): RequirementsMessage {
  const now = input.nowIso ?? new Date().toISOString();
  const active = getActiveReviewFeedbackItems(input.feedbackList);
  const lines =
    active.length === 0
      ? ["등록된 미처리 피드백이 없습니다.", "피드백 등록 chip으로 새 항목을 추가할 수 있습니다."]
      : [
          `미처리 피드백 ${active.length}건:`,
          ...active.map(
            (item, index) =>
              `${index + 1}. [${item.category}/${item.severity}] ${item.title}${
                item.detail && item.detail !== item.title ? ` — ${item.detail}` : ""
              }`,
          ),
        ];
  return newRequirementsMessage({
    role: "ai",
    content: lines.join("\n"),
    meta: {
      stage: "REQUIREMENTS",
      internalType: "REVIEW_STAGE_FEEDBACK_LIST_V1",
      interviewSuggestions: deriveReviewStageInterviewChips({
        entryReady: true,
        feedbackList: input.feedbackList,
      }),
      interviewAllowCustomInput: true,
    },
    createdAt: now,
  });
}
