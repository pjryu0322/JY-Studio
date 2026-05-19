import { describe, expect, it } from "vitest";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { quickRepliesForConversationState } from "@/lib/requirements/serviceFlowConversationState";
import { buildServiceFlowReviewPresentation } from "@/lib/requirements/serviceFlowReviewPresentation";
import {
  finalizeServiceFlowAssistantForResponse,
  resolveProposalPresentationVariantMode,
} from "@/lib/requirements/serviceFlowAssistantPresentation";
import { buildAlternativeProposalPayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import {
  buildServiceFlowApprovedTransitionMessage,
  classifyServiceFlowProposalDecision,
  shouldUseApprovedReviewReplayCompact,
  tryServiceFlowProposalDecisionFastPath,
} from "@/lib/requirements/serviceFlowProposalDecision";
import { tryServiceFlowOrchestrationTransitionFastPath } from "@/lib/requirements/serviceFlowStageTransition";

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
        title: "녹취 파일 업로드",
        purpose: "목적: 사용자가 회의 녹취 파일을 등록\n입력: 음성 파일\n처리: 업로드 및 검증\n결과: 분석 대기",
        order: 1,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s2",
        title: "발화자별 내용 정리",
        purpose: "STT 및 화자 분리",
        order: 2,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s3",
        title: "결과를 확인·조정한다",
        purpose: "",
        order: 3,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
    ],
  };
}

describe("serviceFlowProposalDecision phase10", () => {
  it("classifyServiceFlowProposalDecision — FLOW_APPROVE / FEATURE_DETAIL", () => {
    expect(classifyServiceFlowProposalDecision("추천안 적용")).toBe("APPLY");
    expect(classifyServiceFlowProposalDecision("흐름 승인하기")).toBe("FLOW_APPROVE");
    expect(classifyServiceFlowProposalDecision("흐름 검토하기")).toBe("REVIEW_FLOW");
    expect(classifyServiceFlowProposalDecision("흐름 상세 검토")).toBe("REVIEW_FLOW");
    expect(classifyServiceFlowProposalDecision("세부 기능 정리")).toBe("FEATURE_DETAIL");
  });

  it("APPLY fast-path → REVIEW profile (흐름 검토하기 없음)", () => {
    const r = tryServiceFlowProposalDecisionFastPath({
      decision: "APPLY",
      currentFlow: sampleFlow(),
    });
    expect(r?.conversationStateAfter).toBe("REVIEW");
    expect(r?.quickReplies).not.toContain("흐름 검토하기");
    expect(r?.quickReplies).toContain("흐름 승인하기");
    expect(r?.routingDecision).toBe("proposal_apply_enter_review");
  });

  it("APPLY + alternative payload(steps만) — hydrate 후 검토 메시지, 대안 intro 없음", () => {
    const primary = sampleFlow();
    const alt = {
      ...sampleFlow(),
      actors: [
        { id: "a1", name: "편집자", kind: "human" as const, description: "" },
        { id: "a2", name: "요약 생성기", kind: "system" as const, description: "" },
      ],
      steps: [
        {
          id: "s1",
          title: "녹취 업로드",
          purpose: "",
          order: 1,
          primaryActorId: "a1",
          secondaryActorIds: [],
          approved: false,
          updatedAt: now,
        },
      ],
    };
    const payload = buildAlternativeProposalPayload({
      baselineFlow: primary,
      alternativeFlow: alt,
      proposalId: "alt-apply-1",
    });
    const flowWithPayloadOnlySteps: RequirementsServiceFlowV1 = {
      ...alt,
      steps: [],
      proposalVariantMode: "ALTERNATIVE",
      alternativeProposalPayload: payload,
    };
    const r = tryServiceFlowProposalDecisionFastPath({
      decision: "APPLY",
      currentFlow: flowWithPayloadOnlySteps,
    });
    expect(r?.updatedFlow.steps?.length).toBeGreaterThan(0);
    expect(r?.updatedFlow.proposalVariantMode).toBe("PRIMARY");
    expect(r?.updatedFlow.lastProposalDecision).toBe("APPLY");
    expect(r?.assistantMessage).toContain("검토 단계로 반영");
    const presentationMode = resolveProposalPresentationVariantMode({
      proposalDecision: "APPLY",
      flowVariantMode: "ALTERNATIVE",
    });
    const finalized = finalizeServiceFlowAssistantForResponse({
      assistantMessage: r!.assistantMessage,
      nextQuestion: null,
      quickReplies: r!.quickReplies,
      proposalVariantMode: presentationMode,
    });
    expect(finalized).not.toMatch(/기존\s*초안과\s*다른\s*방향의\s*대안을\s*제시/);
  });

  it("FLOW_APPROVE → APPROVED profile (흐름 검토하기 제거)", () => {
    const r = tryServiceFlowOrchestrationTransitionFastPath({
      proposalDecision: "FLOW_APPROVE",
      currentFlow: { ...sampleFlow(), conversationState: "REVIEW" },
    });
    expect(r?.conversationStateAfter).toBe("APPROVED");
    expect(r?.quickReplies).not.toContain("흐름 검토하기");
    expect(r?.quickReplies).toContain("세부 기능 정리");
    expect(r?.assistantMessage).toContain("승인 상태로 반영");
    expect(r?.routingDecision).toBe("flow_approve_transition");
  });

  it("REVIEW_FLOW → detailed review (목적/입력/처리)", () => {
    const r = tryServiceFlowProposalDecisionFastPath({
      decision: "REVIEW_FLOW",
      currentFlow: sampleFlow(),
    });
    expect(r?.reviewDepth).toBe("detailed");
    expect(r?.assistantMessage).toContain("상세 검토");
    expect(r?.assistantMessage).toContain("- 목적:");
    expect(r?.assistantMessage).toContain("녹취 파일 업로드");
    expect(r?.routingDecision).toBe("flow_detailed_review_from_state");
  });

  it("APPROVED + REVIEW_FLOW → compact reminder", () => {
    const approved = {
      ...sampleFlow(),
      conversationState: "APPROVED" as const,
      proposalAcceptedAt: now,
    };
    expect(shouldUseApprovedReviewReplayCompact({ flow: approved, decision: "REVIEW_FLOW" })).toBe(true);
    const r = tryServiceFlowProposalDecisionFastPath({
      decision: "REVIEW_FLOW",
      currentFlow: approved,
    });
    expect(r?.reviewDepth).toBe("compact");
    expect(r?.assistantMessage).toContain("이미 승인");
    expect(r?.routingDecision).toBe("approved_review_replay_compact");
  });

  it("FEATURE_DETAIL transition", () => {
    const r = tryServiceFlowOrchestrationTransitionFastPath({
      proposalDecision: "FEATURE_DETAIL",
      currentFlow: sampleFlow(),
    });
    expect(r?.conversationStateAfter).toBe("FEATURE_DETAIL");
    expect(r?.quickReplies).toContain("기능 수정");
    expect(r?.assistantMessage).toContain("세부 기능 정의");
  });

  it("quickRepliesForConversationState — approved에 흐름 검토하기 없음", () => {
    const approved = quickRepliesForConversationState("APPROVED");
    expect(approved).not.toContain("흐름 검토하기");
    expect(buildServiceFlowApprovedTransitionMessage({ flow: sampleFlow() })).toContain("확정된 흐름");
  });

  it("buildServiceFlowReviewPresentation — detailed from step purpose", () => {
    const detailed = buildServiceFlowReviewPresentation({
      flow: sampleFlow(),
      depth: "detailed",
    });
    expect(detailed).toContain("- 처리:");
    expect(detailed).toContain("업로드 및 검증");
  });
});
