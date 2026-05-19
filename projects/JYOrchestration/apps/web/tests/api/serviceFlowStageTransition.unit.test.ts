import { describe, expect, it } from "vitest";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { quickRepliesForConversationState } from "@/lib/requirements/serviceFlowConversationState";
import { classifyServiceFlowProposalDecision } from "@/lib/requirements/serviceFlowProposalDecision";
import {
  buildContextAwareFeatureDetailBootstrapMessage,
  resolveServiceFlowTransitionSignal,
  tryServiceFlowOrchestrationTransitionFastPath,
} from "@/lib/requirements/serviceFlowStageTransition";

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
        purpose: "업로드",
        order: 1,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s2",
        title: "발화 내용 분석",
        purpose: "분석",
        order: 2,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s3",
        title: "자동 요약 생성",
        purpose: "요약",
        order: 3,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
    ],
    conversationState: "APPROVED",
    proposalAcceptedAt: now,
  };
}

describe("serviceFlowStageTransition", () => {
  it("resolveServiceFlowTransitionSignal — legacy label maps to actionId signal", () => {
    expect(resolveServiceFlowTransitionSignal({ label: "다음 단계 진행" })).toBe("NEXT_STAGE");
    expect(resolveServiceFlowTransitionSignal({ label: "문서화 완료" })).toBe("DOCUMENTATION_COMPLETE");
    expect(resolveServiceFlowTransitionSignal({ label: "흐름 승인하기" })).toBe("APPROVE_FLOW");
    expect(resolveServiceFlowTransitionSignal({ label: "세부 기능 정리" })).toBe("FEATURE_DETAIL_START");
    expect(resolveServiceFlowTransitionSignal({ label: "완전히 새로운 문장" })).toBeNull();
  });

  it("classifyServiceFlowProposalDecision — NEXT_STAGE / DOCUMENTATION_COMPLETE", () => {
    expect(classifyServiceFlowProposalDecision("다음 단계 진행")).toBe("NEXT_STAGE");
    expect(classifyServiceFlowProposalDecision("문서화 완료")).toBe("DOCUMENTATION_COMPLETE");
  });

  it("NEXT_STAGE → FEATURE_DETAIL with context-aware bootstrap", () => {
    const r = tryServiceFlowOrchestrationTransitionFastPath({
      proposalDecision: "NEXT_STAGE",
      quickActionId: "NEXT_STAGE",
      currentFlow: sampleFlow(),
    });
    expect(r?.conversationStateAfter).toBe("FEATURE_DETAIL");
    expect(r?.transitionMeta?.toStage).toBe("FEATURE_DETAIL");
    expect(r?.transitionMeta?.transitionTriggered).toBe(true);
    expect(r?.assistantMessage).toContain("세부 기능 정의");
    expect(r?.assistantMessage).toContain("녹취 파일 업로드");
    expect(r?.assistantMessage).not.toContain("다음 단계를 진행합니다");
    expect(r?.requirementsStatePatch?.featurePlanningSlotsV1?.slots?.length).toBeGreaterThan(0);
    expect(r?.requirementsStatePatch?.requirementsOrchestrationStageV1?.currentStage).toBe("FEATURE_DETAIL");
    expect(r?.quickReplies).toEqual([...quickRepliesForConversationState("FEATURE_DETAIL")]);
    expect(r?.quickReplies).not.toContain("흐름 승인하기");
  });

  it("FLOW_APPROVE sets approval metadata", () => {
    const r = tryServiceFlowOrchestrationTransitionFastPath({
      proposalDecision: "FLOW_APPROVE",
      quickActionId: "APPROVE_FLOW",
      currentFlow: { ...sampleFlow(), conversationState: "REVIEW" },
    });
    expect(r?.updatedFlow.flowApproved).toBe(true);
    expect(r?.updatedFlow.flowApprovedAt).toBeTruthy();
    expect(r?.conversationStateAfter).toBe("APPROVED");
    expect(r?.assistantMessage).toContain("승인 상태로 반영");
  });

  it("DOCUMENTATION_COMPLETE sets documentation metadata", () => {
    const r = tryServiceFlowOrchestrationTransitionFastPath({
      proposalDecision: "DOCUMENTATION_COMPLETE",
      quickActionId: "COMPLETE_DOCUMENTATION",
      currentFlow: sampleFlow(),
    });
    expect(r?.updatedFlow.documentationStatus).toBe("completed");
    expect(r?.updatedFlow.documentationCompletedAt).toBeTruthy();
    expect(r?.updatedFlow.documentationSnapshot).toBeTruthy();
    expect(r?.transitionMeta?.toStage).toBe("DOCUMENTATION_COMPLETE");
  });

  it("buildContextAwareFeatureDetailBootstrapMessage uses first step", () => {
    const msg = buildContextAwareFeatureDetailBootstrapMessage(sampleFlow());
    expect(msg).toContain("우선 **녹취 파일 업로드**");
    expect(msg).toContain("- 입력 데이터");
  });
});
