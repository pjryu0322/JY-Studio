import { describe, expect, it } from "vitest";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  buildServiceFlowApplyTransitionMessage,
  buildServiceFlowStateSummaryMessage,
  classifyServiceFlowProposalDecision,
  shouldBlockServiceFlowProposalReplay,
  tryServiceFlowProposalDecisionFastPath,
} from "@/lib/requirements/serviceFlowProposalDecision";
import { mergeServiceFlowUserFacingMessage } from "@/lib/requirements/serviceFlowAnalyzeValidation";

const now = "2026-05-19T00:00:00.000Z";

function sampleFlow(): RequirementsServiceFlowV1 {
  return {
    createdAt: now,
    updatedAt: now,
    actors: [
      { id: "a1", name: "사용자", kind: "human", description: "" },
      { id: "a2", name: "시스템", kind: "system", description: "" },
    ],
    steps: [
      {
        id: "s1",
        title: "녹취 업로드",
        purpose: "p",
        order: 1,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s2",
        title: "발화 정리",
        purpose: "p",
        order: 2,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s3",
        title: "요약 생성",
        purpose: "p",
        order: 3,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
    ],
  };
}

describe("serviceFlowProposalDecision", () => {
  it("classifyServiceFlowProposalDecision — chip 매핑", () => {
    expect(classifyServiceFlowProposalDecision("추천안 적용")).toBe("APPLY");
    expect(classifyServiceFlowProposalDecision("흐름 검토하기")).toBe("REVIEW_FLOW");
    expect(classifyServiceFlowProposalDecision("흐름 승인하기")).toBe("APPLY");
    expect(classifyServiceFlowProposalDecision("단계 수정하기")).toBe("PARTIAL_EDIT");
  });

  it("tryServiceFlowProposalDecisionFastPath — APPLY LLM skip", () => {
    const r = tryServiceFlowProposalDecisionFastPath({
      decision: "APPLY",
      currentFlow: sampleFlow(),
      projectName: "테스트",
    });
    expect(r?.llmCallSkipped).toBe(true);
    expect(r?.routingDecision).toBe("proposal_decision_apply_fast_path");
    expect(r?.assistantMessage).toContain("추천안을 서비스 흐름 초안으로 반영했습니다");
    expect(r?.assistantMessage).toContain("녹취 업로드");
    expect(r?.updatedFlow.acceptedProposalSnapshot).toBeTruthy();
  });

  it("tryServiceFlowProposalDecisionFastPath — REVIEW_FLOW state summary", () => {
    const r = tryServiceFlowProposalDecisionFastPath({
      decision: "REVIEW_FLOW",
      currentFlow: sampleFlow(),
    });
    expect(r?.llmCallSkipped).toBe(true);
    expect(r?.routingDecision).toBe("flow_summary_from_state");
    expect(r?.assistantMessage).toContain("액터");
    expect(r?.assistantMessage).toContain("흐름");
    expect(r?.assistantMessage).toContain("1. 녹취 업로드");
    expect(r?.quickReplies).toContain("흐름 승인하기");
  });

  it("shouldBlockServiceFlowProposalReplay — APPLY 후 동일 proposal", () => {
    const flow = {
      ...sampleFlow(),
      acceptedProposalSnapshot: buildServiceFlowStateSummaryMessage({ flow: sampleFlow() }),
      acceptedProposalFingerprint: "abc",
    };
    const dup = `회의록 흐름 초안입니다.

예상 액터
- 사용자
- 시스템

예상 흐름
1. 녹취 업로드
2. 발화 정리
3. 요약 생성`;
    expect(
      shouldBlockServiceFlowProposalReplay({
        flow,
        proposalDecision: "APPLY",
        candidateAssistantMessage: dup,
      }),
    ).toBe(true);
    expect(buildServiceFlowApplyTransitionMessage({ flow: sampleFlow() })).toContain("추천안을");
  });

  it("mergeServiceFlowUserFacingMessage — 동일 CTA 1회만", () => {
    const cta = "다음: 이 초안을 기준으로 진행할지 선택·수정해 주세요.";
    const assistant = `초안입니다.\n\n${cta}\n\n${cta}`;
    const merged = mergeServiceFlowUserFacingMessage(assistant, cta);
    expect(merged.match(/다음:/g)?.length).toBe(1);
  });
});
