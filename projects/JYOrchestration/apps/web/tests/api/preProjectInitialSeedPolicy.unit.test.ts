import { describe, expect, it } from "vitest";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  isProjectSeededFromPreProjectChat,
  shouldSeedPreProjectPlanningSummaryOnWorkspaceEntry,
  shouldSuppressInitialServiceFlowVisibleMessage,
  shouldSuppressInitialVisibleServiceFlowRun,
  buildPreProjectPlanningSummaryMessage,
} from "@/lib/requirements/preProjectPlanningSummary";

describe("preProjectInitialSeedPolicy", () => {
  it("detects pre-project seeded project from original description", () => {
    const state = parseRequirementsStateJson({
      originalProjectDescription: "녹취 파일을 회의록으로 정리하는 웹서비스",
    });
    expect(
      isProjectSeededFromPreProjectChat(state, {
        description: "녹취 파일을 회의록으로 정리하는 웹서비스",
      })
    ).toBe(true);
  });

  it("builds summary without quick action phrases", () => {
    const text = buildPreProjectPlanningSummaryMessage({
      projectName: "회의록 자동 정리",
      projectDescription: "녹취 파일을 발화자별로 정리하고 TODO를 관리하는 웹서비스",
    });

    expect(text).toContain("프로젝트 생성 전 대화를 바탕으로 1차 기획 요약");
    expect(text).not.toContain("추천안 적용");
    expect(text).not.toContain("일부 수정");
    expect(text).not.toContain("다른 대안 보기");
    expect(text).not.toContain("서비스 흐름 초안을 정리했습니다");
  });

  it("suppresses initial service-flow visible message only for non-user initiated initial run", () => {
    expect(
      shouldSuppressInitialServiceFlowVisibleMessage({
        isInitialProjectEntry: true,
        userInitiated: false,
        quickActionId: null,
      })
    ).toBe(true);

    expect(
      shouldSuppressInitialServiceFlowVisibleMessage({
        isInitialProjectEntry: true,
        userInitiated: true,
        quickActionId: null,
      })
    ).toBe(false);

    expect(
      shouldSuppressInitialServiceFlowVisibleMessage({
        isInitialProjectEntry: true,
        userInitiated: false,
        quickActionId: "APPLY_PROPOSAL",
      })
    ).toBe(false);
  });

  it("suppresses silent auto service-flow run when initial entry flag is set", () => {
    expect(
      shouldSuppressInitialVisibleServiceFlowRun({
        suppressInitialAutoServiceFlowVisibleMessage: true,
        silentUserAppend: true,
        quickActionId: null,
        quickActionLabel: null,
        userMessageText: "서비스 흐름 인터뷰 시작",
      })
    ).toBe(true);

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

  it("shouldSeedPreProjectPlanningSummaryOnWorkspaceEntry when pre-project and empty room", () => {
    expect(
      shouldSeedPreProjectPlanningSummaryOnWorkspaceEntry({
        conversationStatus: "loaded",
        hasProject: true,
        loadedConversationProjectMatches: true,
        alreadyApplied: false,
        hasExistingPlanningSummary: false,
        existingMessageCount: 0,
        seededFromPreProject: true,
      })
    ).toBe(true);

    expect(
      shouldSeedPreProjectPlanningSummaryOnWorkspaceEntry({
        conversationStatus: "loaded",
        hasProject: true,
        loadedConversationProjectMatches: true,
        alreadyApplied: false,
        hasExistingPlanningSummary: false,
        existingMessageCount: 0,
        seededFromPreProject: false,
      })
    ).toBe(false);
  });
});
