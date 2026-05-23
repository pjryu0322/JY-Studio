import { describe, expect, it } from "vitest";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  isProjectSeededFromPreProjectChat,
  shouldSuppressInitialServiceFlowOnProjectEntry,
  shouldSeedPreProjectPlanningSummaryOnWorkspaceEntry,
  buildOnboardingPlanningSummaryFlightKey,
  shouldRegeneratePlanningSummaryAfterConversationReset,
  shouldSuppressInitialServiceFlowVisibleMessage,
  shouldSuppressInitialVisibleServiceFlowRun,
  buildPreProjectPlanningSummaryMessage,
  buildPreProjectPlanningSummarySeedPromptTrace,
} from "@/lib/requirements/preProjectPlanningSummary";

describe("preProjectInitialSeedPolicy", () => {
  it("detects pre-project seeded project from explicit flag", () => {
    const state = parseRequirementsStateJson({
      originalProjectDescription: "녹취 파일을 회의록으로 정리하는 웹서비스",
      seededFromPreProjectChat: true,
    });
    expect(isProjectSeededFromPreProjectChat(state)).toBe(true);
  });

  it("does not treat general project with mirrored description as pre-project", () => {
    const state = parseRequirementsStateJson({
      originalProjectDescription: "녹취 파일을 회의록으로 정리하는 웹서비스",
    });
    expect(isProjectSeededFromPreProjectChat(state)).toBe(false);
  });

  it("detects legacy pre-project from draft-derived openIssues", () => {
    const state = parseRequirementsStateJson({
      originalProjectDescription: "회의록 서비스",
      openIssues: "다국어는 1차 범위에서 제외",
    });
    expect(isProjectSeededFromPreProjectChat(state)).toBe(true);
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

  it("shouldSuppressInitialServiceFlowOnProjectEntry when pre-project and no persisted flow", () => {
    const state = parseRequirementsStateJson({ seededFromPreProjectChat: true });
    expect(shouldSuppressInitialServiceFlowOnProjectEntry(state, 0)).toBe(true);
    expect(shouldSuppressInitialServiceFlowOnProjectEntry(state, 2)).toBe(false);
  });

  it("forceRegenerate allows planning summary seed when applied or existing flags would normally block", () => {
    expect(
      shouldSeedPreProjectPlanningSummaryOnWorkspaceEntry({
        conversationStatus: "loaded",
        hasProject: true,
        loadedConversationProjectMatches: true,
        alreadyApplied: true,
        hasExistingPlanningSummary: true,
        existingMessageCount: 3,
        seededFromPreProject: true,
        forceRegenerate: true,
      })
    ).toBe(true);
  });

  it("forceRegenerate does not seed non pre-project projects", () => {
    expect(
      shouldSeedPreProjectPlanningSummaryOnWorkspaceEntry({
        conversationStatus: "loaded",
        hasProject: true,
        loadedConversationProjectMatches: true,
        alreadyApplied: true,
        hasExistingPlanningSummary: true,
        existingMessageCount: 3,
        seededFromPreProject: false,
        forceRegenerate: true,
      })
    ).toBe(false);
  });

  it("buildOnboardingPlanningSummaryFlightKey isolates reset nonce flights", () => {
    expect(
      buildOnboardingPlanningSummaryFlightKey({
        onboardingKey: "pid:abc",
        forceRegenerate: true,
        resetNonce: 2,
      })
    ).toBe("pid:abc:reset:2");
    expect(
      buildOnboardingPlanningSummaryFlightKey({
        onboardingKey: "pid:abc",
        forceRegenerate: false,
        resetNonce: 2,
      })
    ).toBe("pid:abc");
  });

  it("shouldRegeneratePlanningSummaryAfterConversationReset when nonce not consumed", () => {
    expect(
      shouldRegeneratePlanningSummaryAfterConversationReset({
        resetNonce: 1,
        consumedResetNonce: null,
        seededFromPreProject: true,
      })
    ).toBe(true);

    expect(
      shouldRegeneratePlanningSummaryAfterConversationReset({
        resetNonce: 1,
        consumedResetNonce: 1,
        seededFromPreProject: true,
      })
    ).toBe(false);
  });

  it("buildPreProjectPlanningSummarySeedPromptTrace uses platform provider", () => {
    const trace = buildPreProjectPlanningSummarySeedPromptTrace({
      projectId: "proj-1",
      regenerated: true,
    });
    expect(trace.provider).toBe("platform");
    expect(trace.model).toBe("deterministic");
    expect(trace.action).toBe("pre_project_planning_summary_seed");
    expect(trace.promptText).toContain("regenerated=true");
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
