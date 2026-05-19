import { describe, expect, it } from "vitest";
import {
  normalizeQuickRepliesToActions,
  quickActionIdToProposalDecision,
  resolveProposalDecisionFromQuickActionInput,
  resolveQuickActionIdFromLegacyLabel,
} from "@/lib/requirements/requirementsQuickActionRegistry";
import { filterQuickActionsForStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { applyRequirementsOrchestrationTransition } from "@/lib/requirements/requirementsTransitionEngine";
import { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";

const now = "2026-05-19T12:00:00.000Z";

describe("requirementsQuickActionRegistry", () => {
  it("approve flow via actionId — label change does not matter", () => {
    const decision = resolveProposalDecisionFromQuickActionInput({
      quickActionId: "APPROVE_FLOW",
      quickActionLabel: "흐름 확정",
    });
    expect(decision).toBe("FLOW_APPROVE");
  });

  it("legacy string maps to actionId for display-only compat", () => {
    expect(resolveQuickActionIdFromLegacyLabel("흐름 승인하기")).toBe("APPROVE_FLOW");
    const decision = resolveProposalDecisionFromQuickActionInput({
      quickActionLabel: "흐름 승인하기",
    });
    expect(decision).toBe("FLOW_APPROVE");
  });

  it("FEATURE_DETAIL obsolete filtering by actionId", () => {
    const actions = normalizeQuickRepliesToActions([
      { id: "APPROVE_FLOW", label: "흐름 승인하기" },
      { id: "EDIT_FEATURES", label: "기능 수정" },
      { id: "REVIEW_FLOW", label: "흐름 검토" },
    ]);
    const filtered = filterQuickActionsForStage("FEATURE_DETAIL", actions, {
      allowedActionIds: ["EDIT_FEATURES", "DEFINE_SCREEN", "DEFINE_API", "GENERATE_DOCUMENT"],
      obsoleteActionIds: ["APPROVE_FLOW", "REVIEW_FLOW", "APPLY_PROPOSAL", "NEXT_STAGE", "GENERATE_ALTERNATIVE"],
    });
    expect(filtered.map((a) => a.id)).toEqual(["EDIT_FEATURES"]);
  });

  it("applyRequirementsOrchestrationTransition uses quickActionId", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "t",
      projectDescription: "",
      projectType: null,
      servicePlanningAgentCatalogKeys: null,
    });
    const flow = {
      createdAt: now,
      updatedAt: now,
      actors: [{ id: "a1", name: "U", kind: "human" as const, description: "" }],
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
          primaryActorId: "a1",
          secondaryActorIds: [],
          approved: false,
          updatedAt: now,
        },
      ],
      conversationState: "APPROVED" as const,
      proposalAcceptedAt: now,
    };
    const r = applyRequirementsOrchestrationTransition({
      state: { serviceFlowV1: flow },
      currentFlow: flow,
      proposalDecision: null,
      quickActionId: "NEXT_STAGE",
      quickActionLabel: "다음 단계 진행",
      slotDefinitions: defs,
    });
    expect(r.transitionResult).toBe("applied");
    expect(r.signal?.type).toBe("NEXT_STAGE");
  });

  it("normalizeQuickRepliesToActions from wire object", () => {
    const actions = normalizeQuickRepliesToActions([
      { id: "APPROVE_FLOW", label: "커스텀 승인 라벨" },
    ]);
    expect(actions[0]?.label).toBe("커스텀 승인 라벨");
    expect(quickActionIdToProposalDecision(actions[0]!.id)).toBe("FLOW_APPROVE");
  });

  it("unknown legacy string does not invent transition decision", () => {
    expect(
      resolveProposalDecisionFromQuickActionInput({
        quickActionLabel: "완전히 새로운 문장",
      }),
    ).toBeNull();
  });
});
