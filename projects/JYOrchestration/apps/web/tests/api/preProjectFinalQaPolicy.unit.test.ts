import { describe, expect, it } from "vitest";
import {
  PRE_PROJECT_PLANNING_SUMMARY_INTERNAL_TYPE,
  buildPreProjectPlanningSummaryMessage,
  hasPreProjectPlanningSummaryMessage,
  shouldSuppressInitialVisibleServiceFlowRun,
} from "@/lib/requirements/preProjectPlanningSummary";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";

/**
 * Final QA policy checks (Scenario A–D code-level expectations).
 * Manual UI verification: see JYOrchestration_PreProject_Initial_Seed_Final_QA_Cursor_Prompt.md
 */
describe("preProjectFinalQaPolicy", () => {
  it("Scenario A: planning summary shape and forbidden phrases", () => {
    const text = buildPreProjectPlanningSummaryMessage({
      projectName: "회의록 자동 정리",
      projectDescription: "녹취 파일을 발화자별로 정리하고 TODO를 관리하는 웹서비스",
      constraints: ["다국어는 1차 범위에서 제외"],
    });
    expect(text.startsWith("프로젝트 생성 전 대화를 바탕으로 1차 기획 요약")).toBe(true);
    expect(text).toContain("현재 아이디어");
    expect(text).not.toContain("추천안 적용");
    expect(text).not.toContain("서비스 흐름 초안을 정리했습니다");
  });

  it("Scenario A: idempotent detection by internalType", () => {
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

  it("Scenario B: silent auto service-flow boot is suppressed", () => {
    expect(
      shouldSuppressInitialVisibleServiceFlowRun({
        suppressInitialAutoServiceFlowVisibleMessage: true,
        silentUserAppend: true,
        quickActionId: null,
        quickActionLabel: null,
        userMessageText: "서비스 흐름 인터뷰 시작",
      })
    ).toBe(true);
  });

  it("Scenario C: explicit user service-flow request is not suppressed", () => {
    expect(
      shouldSuppressInitialVisibleServiceFlowRun({
        suppressInitialAutoServiceFlowVisibleMessage: true,
        silentUserAppend: false,
        quickActionId: null,
        quickActionLabel: null,
        userMessageText: "서비스 흐름 정리해줘",
      })
    ).toBe(false);
  });
});
