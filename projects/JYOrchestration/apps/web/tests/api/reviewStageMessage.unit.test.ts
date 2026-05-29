import { describe, expect, it } from "vitest";
import { buildImplementationReviewStageReadyMarker } from "@/lib/prototype/implementationReviewStageReady";
import {
  buildReviewStageEntryMessage,
  mapReviewStageChipToAction,
} from "@/lib/prototype/reviewStageMessage";
import { appendReviewStageUserFeedback } from "@/lib/prototype/reviewStageUserFeedback";
import {
  REVIEW_STAGE_ADD_FEEDBACK_CHIP,
  REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP,
} from "@/lib/requirements/implementationUxLabels";

const NOW = "2026-05-29T12:00:00.000Z";

describe("buildReviewStageEntryMessage", () => {
  it("entry not ready message blocks review stage", () => {
    const message = buildReviewStageEntryMessage({ entryReady: false, nowIso: NOW });
    expect(message.content).toContain("아직 검토단계를 시작할 수 없습니다");
    expect(message.meta?.interviewSuggestions).toEqual([]);
  });

  it("entry ready message contains Preview URL", () => {
    const marker = buildImplementationReviewStageReadyMarker({ previewReady: true, nowIso: NOW });
    const message = buildReviewStageEntryMessage({
      entryReady: true,
      implementationReviewStageReadyV1: marker,
      previewReady: true,
      previewUrl: "https://preview.example/app",
      nowIso: NOW,
    });
    expect(message.content).toContain("https://preview.example/app");
    expect(message.content).toContain("프로토타입 검토단계");
  });

  it("message shows active feedback count and chips when feedback exists", () => {
    const marker = buildImplementationReviewStageReadyMarker({ previewReady: true, nowIso: NOW });
    const feedbackList = appendReviewStageUserFeedback({
      list: null,
      projectId: "p1",
      title: "문구",
      detail: "수정",
      nowIso: NOW,
    });
    const message = buildReviewStageEntryMessage({
      entryReady: true,
      implementationReviewStageReadyV1: marker,
      previewReady: true,
      feedbackList,
      nowIso: NOW,
    });
    expect(message.content).toContain("미처리 1건");
    expect(message.meta?.interviewSuggestions).toContain(REVIEW_STAGE_ADD_FEEDBACK_CHIP);
    expect(message.meta?.interviewSuggestions).toContain(REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP);
  });
});

describe("mapReviewStageChipToAction", () => {
  it("maps 피드백 등록 chip", () => {
    expect(mapReviewStageChipToAction(REVIEW_STAGE_ADD_FEEDBACK_CHIP)).toBe("REVIEW_STAGE_ADD_FEEDBACK");
  });
});
