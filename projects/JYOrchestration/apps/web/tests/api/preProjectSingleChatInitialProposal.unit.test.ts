import { describe, expect, it } from "vitest";
import {
  buildPreProjectSeededSingleChatOrchestration,
  buildPreProjectSingleChatInitialProposalMessage,
  resolveInitialProposalQuickReplyAction,
  safeBuildPreProjectInitialProposalSeed,
} from "@/lib/requirements/preProjectSingleChatInitialProposal";
import { buildPreProjectPlanningSummaryFromWorkspaceState } from "@/lib/requirements/preProjectPlanningSummary";
import {
  buildDynamicServicePlanningSlotDefinitions,
  singleChatOrchestrationWeightedProgress,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("preProjectSingleChatInitialProposal", () => {
  it("builds slot-based initial proposal message from existing orchestration slots", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectName: "회의록 자동 정리",
      projectDescription: "녹취 파일을 회의록과 TODO로 정리하는 웹서비스",
    });

    const orchestration = buildPreProjectSeededSingleChatOrchestration({
      projectName: "회의록 자동 정리",
      projectDescription: "녹취 파일을 회의록과 TODO로 정리하는 웹서비스",
      state: parseRequirementsStateJson({
        priorityFeatures: "음성 인식\n발화자 분류\n주제 요약\nTODO 추출",
        openIssues: "검수 절차 필요",
      }),
      definitions,
    });

    const msg = buildPreProjectSingleChatInitialProposalMessage({
      projectName: "회의록 자동 정리",
      orchestration,
      definitions,
    });

    expect(msg.bodyText).toContain("1차 서비스 정의");
    expect(msg.bodyText).toContain("확정에 가까운 내용");
    expect(msg.bodyText).toContain("현재까지 추정된 기획 후보");
    expect(msg.bodyText).not.toContain("후보로 볼 내용");
    expect(msg.bodyText).toContain("아직 정해야 할 것");
    expect(msg.bodyText).toContain("AI기획자 제안");
    expect(msg.bodyText).toContain("아래 버튼에서 다음 동작을 선택해 주세요.");
    expect(msg.bodyText).toContain(
      '먼저 "액터부터 정의하기"를 선택하면 이후 서비스 흐름과 화면 구성을 더 정확하게 정리할 수 있습니다.',
    );
    expect(msg.bodyText).not.toContain("1. 액터부터 정의하기");
    expect(msg.interviewSuggestions).toEqual([
      "액터부터 정의하기",
      "서비스 흐름 초안 만들기",
      "화면 구성부터 보기",
      "MVP 기능 범위 정리하기",
    ]);
  });

  it("creates non-zero weighted progress for pre-project seeded candidates", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectName: "회의록 자동 정리",
      projectDescription: "녹취 파일을 회의록과 TODO로 정리하는 웹서비스",
    });

    const orchestration = buildPreProjectSeededSingleChatOrchestration({
      projectName: "회의록 자동 정리",
      projectDescription: "녹취 파일을 회의록과 TODO로 정리하는 웹서비스",
      state: parseRequirementsStateJson({
        priorityFeatures: "음성 인식\n발화자 분류",
      }),
      definitions,
    });

    const progress = singleChatOrchestrationWeightedProgress(orchestration);
    expect(progress.candidate + progress.partial + progress.confirmed).toBeGreaterThan(0);
    expect(progress.percent).toBeGreaterThan(0);
  });

  it("falls back to legacy planning summary when slot proposal generation fails", () => {
    const legacy = buildPreProjectPlanningSummaryFromWorkspaceState({
      projectName: "테스트",
      projectDescription: "설명",
      state: parseRequirementsStateJson({ priorityFeatures: "기능 A" }),
    });

    const result = safeBuildPreProjectInitialProposalSeed({
      projectName: "테스트",
      projectDescription: "설명",
      state: parseRequirementsStateJson({ priorityFeatures: "기능 A" }),
      definitions: [],
      projectId: "proj-fallback",
      regenerated: false,
    });

    expect(result.mode).toBe("legacy");
    expect(result.bodyText).toContain("1차 기획 요약");
    expect(result.bodyText).toBe(legacy);
    expect(result.promptTrace.promptText).toContain("type=pre_project_planning_summary");
    expect(result.promptTrace.promptText).not.toContain("mode=slot_based_initial_proposal");
  });

  it("maps initial proposal quick reply to actor_definition action", () => {
    const action = resolveInitialProposalQuickReplyAction("액터부터 정의하기");
    expect(action).not.toBeNull();
    expect(action?.stageIntent).toBe("service_flow");
    expect(action?.serviceFlowSubIntent).toBe("actor_definition");
  });

  it("maps screen planning quick reply label", () => {
    const action = resolveInitialProposalQuickReplyAction("화면 구성부터 보기");
    expect(action?.stageIntent).toBe("screen_planning");
    expect(action?.serviceFlowSubIntent).toBeUndefined();
  });
});
