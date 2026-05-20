import { describe, expect, it } from "vitest";
import { appendOrchestrationTransitionTimelineExtras } from "@/lib/requirements/requirementsOrchestrationTimeline";
import { buildQuickReplyProjection } from "@/lib/requirements/requirementsOrchestrationProjection";
import { seedFeatureDetailSlotsFromServiceFlow } from "@/lib/requirements/featureDetailSlots";
import {
  filterQuickActionsForStage,
  getOrchestrationStageDefinition,
} from "@/lib/requirements/requirementsOrchestrationRegistry";
import {
  getQuickActionDefinition,
  normalizeQuickRepliesToActions,
  quickActionsForConversationState,
  resolveProposalDecisionFromQuickActionInput,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import { applyRequirementsOrchestrationTransition } from "@/lib/requirements/requirementsTransitionEngine";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { tryServiceFlowOrchestrationTransitionFastPath } from "@/lib/requirements/serviceFlowStageTransition";

const now = "2026-05-19T12:00:00.000Z";

function sampleApprovedFlow(): RequirementsServiceFlowV1 {
  return {
    createdAt: now,
    updatedAt: now,
    actors: [
      { id: "a1", name: "U", kind: "human", description: "" },
      { id: "a2", name: "S", kind: "system", description: "" },
    ],
    steps: [
      {
        id: "s1",
        title: "Step",
        purpose: "p",
        order: 1,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s2",
        title: "Step2",
        purpose: "p",
        order: 2,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
    ],
    conversationState: "REVIEW",
  };
}

describe("actionId transition validation", () => {
  it("Test A — renamed label with same actionId still approves flow", () => {
    expect(getQuickActionDefinition("APPROVE_FLOW").defaultLabel).toBe("흐름 확정");

    const decision = resolveProposalDecisionFromQuickActionInput({
      quickActionId: "APPROVE_FLOW",
      quickActionLabel: "흐름 확정",
    });
    expect(decision).toBe("FLOW_APPROVE");

    const r = tryServiceFlowOrchestrationTransitionFastPath({
      proposalDecision: "FLOW_APPROVE",
      quickActionId: "APPROVE_FLOW",
      currentFlow: sampleApprovedFlow(),
    });
    expect(r?.transitionMeta?.transitionTriggered).toBe(true);
    expect(r?.updatedFlow.flowApproved).toBe(true);
    expect(r?.quickReplies).toContain("다음 단계 진행");

    const eng = applyRequirementsOrchestrationTransition({
      state: { serviceFlowV1: sampleApprovedFlow() },
      currentFlow: sampleApprovedFlow(),
      proposalDecision: null,
      quickActionId: "APPROVE_FLOW",
      quickActionLabel: "흐름 확정",
    });
    expect(eng.transitionResult).toBe("applied");
    expect(eng.transitionTriggered).toBe(true);

    const timeline = appendOrchestrationTransitionTimelineExtras({
      base: { quickActionId: "APPROVE_FLOW", quickActionLabel: "흐름 확정" },
      transitionMeta: r?.transitionMeta ?? null,
      transitionEngine: eng,
    });
    expect(timeline.quickActionId).toBe("APPROVE_FLOW");
    expect(timeline.quickActionLabel).toBe("흐름 확정");
    expect(timeline.transitionSignal).toBe("FLOW_APPROVE");
    expect(timeline.transitionTriggered).toBe(true);
  });

  it("Test B — FEATURE_DETAIL projection removes obsolete stage actions", () => {
    const def = getOrchestrationStageDefinition("FEATURE_DETAIL");
    const polluted = [
      ...quickActionsForConversationState("FEATURE_DETAIL"),
      ...normalizeQuickRepliesToActions([
        { id: "APPROVE_FLOW", label: "흐름 확정" },
        { id: "REVIEW_FLOW", label: "흐름 검토하기" },
        { id: "APPLY_PROPOSAL", label: "추천안 적용" },
        { id: "GENERATE_ALTERNATIVE", label: "다른 대안 보기" },
        { id: "NEXT_STAGE", label: "다음 단계 진행" },
      ]),
    ];
    const filtered = filterQuickActionsForStage("FEATURE_DETAIL", polluted);
    expect(filtered.map((a) => a.id)).toEqual([
      "EDIT_FEATURES",
      "DEFINE_SCREEN",
      "DEFINE_API",
      "GENERATE_DOCUMENT",
    ]);
    expect(def.obsoleteActionIds).toContain("APPROVE_FLOW");
    expect(def.obsoleteActionIds).toContain("GENERATE_ALTERNATIVE");

    const flow = { ...sampleApprovedFlow(), conversationState: "FEATURE_DETAIL" as const };
    const gatedProjection = buildQuickReplyProjection({
      state: {
        serviceFlowV1: flow,
        featureDetailSlotsV1: seedFeatureDetailSlotsFromServiceFlow(flow, now),
        requirementsOrchestrationStageV1: {
          currentStage: "FEATURE_DETAIL",
          completedStages: ["SERVICE_FLOW_REVIEW"],
          activePhase: "feature_detail_bootstrap",
          updatedAt: now,
        },
      },
      authoritativeStage: "FEATURE_DETAIL",
    });
    expect(gatedProjection.quickReplies).toEqual(["기능 수정", "문서 생성"]);

    const detailSeed = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    const projection = buildQuickReplyProjection({
      state: {
        serviceFlowV1: flow,
        featureDetailSlotsV1: {
          ...detailSeed,
          slots: detailSeed.slots.map((s) => ({ ...s, status: "confirmed" as const, updatedAt: now })),
        },
        requirementsOrchestrationStageV1: {
          currentStage: "FEATURE_DETAIL",
          completedStages: ["SERVICE_FLOW_REVIEW"],
          activePhase: "feature_detail_bootstrap",
          updatedAt: now,
        },
      },
      authoritativeStage: "FEATURE_DETAIL",
    });
    expect(projection.quickReplies).toEqual(["기능 수정", "화면 정의", "API 정의", "문서 생성"]);
    expect(projection.quickReplies).not.toContain("흐름 확정");
    expect(projection.quickReplies).not.toContain("추천안 적용");
    expect(projection.quickReplies).not.toContain("다른 대안 보기");
  });
});
