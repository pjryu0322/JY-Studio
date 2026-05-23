import { describe, expect, it } from "vitest";
import {
  buildServiceFlowDescriptionProposalSkeletonPack,
  buildServiceFlowProposalFallbackSynthesisUserPrompt,
} from "@/lib/requirements/serviceFlowProposalFallbackSynthesis";
import {
  detectQuestionFirstUx,
  hasProposalFirstStructure,
} from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import { validateServiceFlowAnalyzeResponse } from "@/lib/requirements/serviceFlowAnalyzeValidation";

describe("serviceFlowProposalFallbackSynthesis", () => {
  it("includes flow_step_definition context in fallback user prompt", () => {
    const p = buildServiceFlowProposalFallbackSynthesisUserPrompt({
      projectName: "P",
      projectDescription: "D",
      userMessage: "단계 정리",
      currentFlow: null,
      recentMessages: "",
      failureIssues: ["flow_step_definition_missing_steps"],
      serviceFlowSubIntent: "flow_step_definition",
      responsePolicy: { mode: "flow_update", serviceFlowSubIntent: "flow_step_definition" },
    });
    expect(p).toContain("serviceFlowSubIntent=flow_step_definition");
    expect(p).toContain("기능 범위 정리가 아니다");
    expect(p).toContain("step.description을 쓰지 않는다");
  });

  it("buildServiceFlowProposalFallbackSynthesisUserPrompt는 proposal-first 재생성 지시를 포함한다", () => {
    const p = buildServiceFlowProposalFallbackSynthesisUserPrompt({
      projectName: "회의록 자동화",
      projectDescription: "녹취 업로드 후 요약",
      userMessage: "서비스 흐름 인터뷰 시작",
      currentFlow: null,
      recentMessages: "",
      failureIssues: ["question_first_without_proposal", "insufficient_flow_actors"],
    });
    expect(p).toContain("proposal-first");
    expect(p).toContain("question-first 금지");
    expect(p).toContain("updatedFlow");
    expect(p).toContain("insufficient_flow_actors");
  });

  it("description proposal skeleton은 question-only가 아니고 validation을 통과한다", () => {
    const pack = buildServiceFlowDescriptionProposalSkeletonPack({
      projectName: "회의록 자동화",
      projectDescription: "녹취 업로드 후 STT·요약",
      nowIso: "2026-05-19T00:00:00.000Z",
    });
    expect(pack.updatedFlow.actors.length).toBeGreaterThanOrEqual(2);
    expect(pack.updatedFlow.steps.length).toBeGreaterThanOrEqual(3);
    expect(hasProposalFirstStructure(pack.assistantMessage)).toBe(true);
    expect(
      detectQuestionFirstUx(pack.assistantMessage) && !hasProposalFirstStructure(pack.assistantMessage),
    ).toBe(false);
    expect(pack.assistantMessage).not.toContain("첫 단계는 무엇입니까");
    expect(pack.quickReplies).toEqual(["추천안 적용", "일부 수정", "다른 대안 보기"]);

    const v = validateServiceFlowAnalyzeResponse({
      parsed: pack,
      userMessage: "서비스 흐름 인터뷰 시작",
      currentFlow: null,
    });
    expect(v.ok).toBe(true);
  });
});
