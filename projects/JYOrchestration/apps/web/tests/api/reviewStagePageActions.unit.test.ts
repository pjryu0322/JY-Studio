import { describe, expect, it } from "vitest";
import { buildImplementationReviewStageReadyMarker } from "@/lib/prototype/implementationReviewStageReady";
import {
  registerReviewStageUserFeedbackFromText,
  runReviewStagePageAction,
} from "@/lib/prototype/reviewStagePageActions";
import {
  appendReviewStageUserFeedback,
  buildReviewFeedbackConvertNotice,
  buildReviewFeedbackDraftFromUserText,
  convertReviewFeedbackToImplementationRework,
} from "@/lib/prototype/reviewStageUserFeedback";
import { deriveReviewStageInterviewChips } from "@/lib/prototype/reviewStageMessage";
import { deriveReviewStageNextActions } from "@/lib/prototype/implementationStageNextActions";
import {
  markReviewStageUserTestCompleted,
  markReviewStageUserTestStarted,
} from "@/lib/prototype/reviewStageUserTest";
import {
  REVIEW_STAGE_ADD_FEEDBACK_CHIP,
  REVIEW_STAGE_COMPLETE_TEST_CHIP,
  REVIEW_STAGE_OPEN_PREVIEW_CHIP,
  REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const NOW = "2026-05-29T12:00:00.000Z";
const PROJECT_ID = "p1";

describe("buildReviewFeedbackDraftFromUserText", () => {
  it("rejects empty text", () => {
    expect(buildReviewFeedbackDraftFromUserText({ text: "   " })).toMatchObject({ ok: false });
  });

  it("uses first line as title up to 40 chars", () => {
    const draft = buildReviewFeedbackDraftFromUserText({
      text: "첫 줄 제목\n두 번째 줄 상세",
    });
    expect("ok" in draft).toBe(false);
    if ("ok" in draft) return;
    expect(draft.title).toBe("첫 줄 제목");
    expect(draft.detail).toContain("두 번째 줄 상세");
    expect(draft.category).toBe("other");
    expect(draft.severity).toBe("medium");
  });
});

describe("registerReviewStageUserFeedbackFromText", () => {
  it("appends feedback and sets session to feedback_registered", () => {
    const session = markReviewStageUserTestStarted({
      session: null,
      projectId: PROJECT_ID,
      nowIso: NOW,
    });
    const result = registerReviewStageUserFeedbackFromText({
      projectId: PROJECT_ID,
      text: "버튼이 잘 안 보입니다",
      session,
      nowIso: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.reviewStageUserFeedbackListV1?.items).toHaveLength(1);
    expect(result.patch.reviewStageUserTestSessionV1?.status).toBe("feedback_registered");
  });

  it("feedback_registered when session was completed", () => {
    let session = markReviewStageUserTestStarted({
      session: null,
      projectId: PROJECT_ID,
      nowIso: NOW,
    });
    session = markReviewStageUserTestCompleted({ session, nowIso: NOW });
    const result = registerReviewStageUserFeedbackFromText({
      projectId: PROJECT_ID,
      text: "추가 수정",
      session,
      nowIso: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.reviewStageUserTestSessionV1?.status).toBe("feedback_registered");
  });
});

describe("convertReviewFeedbackToImplementationRework", () => {
  it("returns targetTaskId and feedbackId", () => {
    const list = appendReviewStageUserFeedback({
      list: null,
      projectId: PROJECT_ID,
      title: "t",
      detail: "d",
      feedbackId: "fb-1",
      nowIso: NOW,
    });
    const converted = convertReviewFeedbackToImplementationRework({
      feedbackList: list,
      boardState: null,
      projectId: PROJECT_ID,
      feedbackId: "fb-1",
      fallbackTaskId: "dev-1",
      nowIso: NOW,
    });
    expect(converted.targetTaskId).toBe("dev-1");
    expect(converted.feedbackId).toBe("fb-1");
    const notice = buildReviewFeedbackConvertNotice({
      feedbackId: converted.feedbackId,
      targetTaskId: converted.targetTaskId,
      reworkRequestId: converted.reworkRequestId,
    });
    expect(notice).toContain("fb-1");
    expect(notice).toContain("dev-1");
    expect(notice).toContain(converted.reworkRequestId);
  });
});

describe("completed session CTA policy", () => {
  const marker = buildImplementationReviewStageReadyMarker({ previewReady: true, nowIso: NOW });

  it("deriveReviewStageInterviewChips excludes 검토 완료 when completed", () => {
    const session = markReviewStageUserTestCompleted({
      session: markReviewStageUserTestStarted({ session: null, projectId: PROJECT_ID, nowIso: NOW }),
      nowIso: NOW,
    });
    const chips = deriveReviewStageInterviewChips({
      entryReady: true,
      session,
    });
    expect(chips).toContain(REVIEW_STAGE_OPEN_PREVIEW_CHIP);
    expect(chips).toContain(REVIEW_STAGE_ADD_FEEDBACK_CHIP);
    expect(chips).not.toContain(REVIEW_STAGE_COMPLETE_TEST_CHIP);
  });

  it("deriveReviewStageNextActions excludes REVIEW_STAGE_COMPLETE_TEST when completed", () => {
    const session = markReviewStageUserTestCompleted({
      session: markReviewStageUserTestStarted({ session: null, projectId: PROJECT_ID, nowIso: NOW }),
      nowIso: NOW,
    });
    const actions = deriveReviewStageNextActions({ session });
    expect(actions.some((a) => a.actionId === "REVIEW_STAGE_COMPLETE_TEST")).toBe(false);
    expect(actions[0]?.actionId).toBe("REVIEW_STAGE_OPEN_PREVIEW");
  });

  it("completed with active feedback prioritizes 구현단계 보완 요청", () => {
    const session = markReviewStageUserTestCompleted({
      session: markReviewStageUserTestStarted({ session: null, projectId: PROJECT_ID, nowIso: NOW }),
      nowIso: NOW,
    });
    const feedbackList = appendReviewStageUserFeedback({
      list: null,
      projectId: PROJECT_ID,
      title: "피드백",
      detail: "d",
      nowIso: NOW,
    });
    const actions = deriveReviewStageNextActions({ session, feedbackList });
    expect(actions[0]?.label).toBe(REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP);
  });
});

describe("runReviewStagePageAction", () => {
  it("start user test updates session patch", () => {
    const orchestration: RequirementsStateJson = {
      implementationReviewStageReadyV1: buildImplementationReviewStageReadyMarker({
        previewReady: true,
        nowIso: NOW,
      }),
    };
    const result = runReviewStagePageAction({
      actionId: "REVIEW_STAGE_START_USER_TEST",
      projectId: PROJECT_ID,
      orchestration,
      previewUrl: "https://preview.example/app",
      nowIso: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.reviewStageUserTestSessionV1?.status).toBe("in_progress");
  });

  it("complete review blocks with blocking feedback", () => {
    const feedbackList = appendReviewStageUserFeedback({
      list: null,
      projectId: PROJECT_ID,
      title: "block",
      detail: "d",
      severity: "blocking",
      nowIso: NOW,
    });
    const session = markReviewStageUserTestStarted({
      session: null,
      projectId: PROJECT_ID,
      nowIso: NOW,
    });
    const result = runReviewStagePageAction({
      actionId: "REVIEW_STAGE_COMPLETE_TEST",
      projectId: PROJECT_ID,
      orchestration: { reviewStageUserFeedbackListV1: feedbackList, reviewStageUserTestSessionV1: session },
      nowIso: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("blocking");
  });
});
