import { describe, expect, it } from "vitest";
import {
  buildPreProjectPlanningSummaryMessage,
  hasPreProjectPlanningSummaryMessage,
  shouldSuppressInitialServiceFlowVisibleMessage,
  PRE_PROJECT_PLANNING_SUMMARY_INTERNAL_TYPE,
} from "@/lib/requirements/preProjectPlanningSummary";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";

describe("buildPreProjectPlanningSummaryMessage", () => {
  it("builds a single first planning summary without service-flow quick-action wording", () => {
    const text = buildPreProjectPlanningSummaryMessage({
      projectName: "회의록 작성 서비스",
      projectDescription:
        "녹취 파일을 발화자별로 정리하고 주제별 요약과 TODO 관리를 제공하는 웹서비스",
      constraints: ["다국어는 1차 범위에서 제외"],
    });

    expect(text).toContain("프로젝트 생성 전 대화를 바탕으로 1차 기획 요약");
    expect(text).toContain("현재 아이디어");
    expect(text).toContain("초기 핵심 기능 후보");
    expect(text).not.toContain("추천안 적용");
    expect(text).not.toContain("서비스 흐름 초안을 정리했습니다");
    expect(text).not.toContain("초안 JSON");
  });
});

describe("hasPreProjectPlanningSummaryMessage", () => {
  it("detects existing pre-project planning summary message", () => {
    const msg = newRequirementsMessage({
      role: "ai",
      speakerType: "AI",
      speakerId: "ai",
      speakerName: "AI 기획자",
      messageType: "ANSWER",
      content: "프로젝트 생성 전 대화를 바탕으로 1차 기획 요약을 정리했습니다.",
      meta: { internalType: PRE_PROJECT_PLANNING_SUMMARY_INTERNAL_TYPE },
    });
    expect(hasPreProjectPlanningSummaryMessage([msg])).toBe(true);
  });
});

describe("shouldSuppressInitialServiceFlowVisibleMessage", () => {
  it("suppresses initial auto service-flow when user did not initiate", () => {
    expect(
      shouldSuppressInitialServiceFlowVisibleMessage({
        isInitialProjectEntry: true,
        userInitiated: false,
        quickActionId: null,
      })
    ).toBe(true);
  });

  it("allows service-flow when user initiated", () => {
    expect(
      shouldSuppressInitialServiceFlowVisibleMessage({
        isInitialProjectEntry: true,
        userInitiated: true,
        quickActionId: null,
      })
    ).toBe(false);
  });
});
