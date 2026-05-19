import { describe, expect, it } from "vitest";
import type { RequirementsServiceFlowV1, RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  applyOrchestrationInvalidationsAfterFlowChange,
  buildServiceFlowStructureFingerprint,
} from "@/lib/requirements/requirementsOrchestrationInvalidation";
import {
  filterQuickActionsForStage,
  isOrchestrationTransitionAllowed,
  resolveAuthoritativeOrchestrationStage,
} from "@/lib/requirements/requirementsOrchestrationRegistry";
import { normalizeQuickRepliesToActions } from "@/lib/requirements/requirementsQuickActionRegistry";
import { projectRequirementsOrchestrationView } from "@/lib/requirements/requirementsOrchestrationProjection";
import { buildCompressedOrchestrationSummaryForLlm } from "@/lib/requirements/requirementsOrchestrationTimeline";
import {
  applyRequirementsOrchestrationTransition,
  resolveRequirementsTransitionSignal,
} from "@/lib/requirements/requirementsTransitionEngine";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { SERVICE_FLOW_SYNC_DERIVED_FROM } from "@/lib/requirements/serviceFlowOrchestrationSync";

const now = "2026-05-19T12:00:00.000Z";

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
        title: "업로드",
        purpose: "p",
        order: 1,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
      {
        id: "s2",
        title: "분석",
        purpose: "p",
        order: 2,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: now,
      },
    ],
    flowApproved: true,
  };
}

describe("requirementsOrchestrationRuntime phase14", () => {
  const defs = buildDynamicServicePlanningSlotDefinitions({
    projectName: "테스트",
    projectDescription: "",
    projectType: null,
    servicePlanningAgentCatalogKeys: null,
  });

  it("resolveAuthoritativeOrchestrationStage prefers requirementsOrchestrationStageV1", () => {
    const st: RequirementsStateJson = {
      requirementsOrchestrationStageV1: {
        currentStage: "FEATURE_DETAIL",
        completedStages: ["SERVICE_FLOW_REVIEW"],
        updatedAt: now,
      },
      serviceFlowV1: { ...sampleFlow(), conversationState: "REVIEW" },
    };
    expect(resolveAuthoritativeOrchestrationStage(st)).toBe("FEATURE_DETAIL");
  });

  it("isOrchestrationTransitionAllowed — SERVICE_FLOW_REVIEW → FEATURE_DETAIL", () => {
    expect(isOrchestrationTransitionAllowed("SERVICE_FLOW_REVIEW", "FEATURE_DETAIL")).toBe(true);
    expect(isOrchestrationTransitionAllowed("IDEATION", "FEATURE_DETAIL")).toBe(false);
  });

  it("filterQuickActionsForStage removes obsolete actionIds in FEATURE_DETAIL", () => {
    const filtered = filterQuickActionsForStage(
      "FEATURE_DETAIL",
      normalizeQuickRepliesToActions([
        { id: "APPROVE_FLOW", label: "흐름 승인하기" },
        { id: "EDIT_FEATURES", label: "기능 수정" },
        { id: "NEXT_STAGE", label: "다음 단계 진행" },
      ]),
    );
    expect(filtered.map((a) => a.id)).toEqual(["EDIT_FEATURES"]);
  });

  it("applyOrchestrationInvalidationsAfterFlowChange — approved flow edit downgrades confirmed", () => {
    const base = initialOrchestrationStateFromDefinitions(defs, now);
    const key = Object.keys(base.slots).find((k) => k.includes("flow")) ?? Object.keys(base.slots)[0];
    base.slots[key] = {
      ...base.slots[key],
      status: "confirmed",
      value: "confirmed flow slot value long enough",
      derivedFrom: SERVICE_FLOW_SYNC_DERIVED_FROM,
    };
    const fp1 = buildServiceFlowStructureFingerprint(sampleFlow());
    const flow2 = {
      ...sampleFlow(),
      steps: [
        ...sampleFlow().steps,
        {
          id: "s3",
          title: "추가",
          purpose: "p",
          order: 3,
          primaryActorId: "a2",
          secondaryActorIds: [],
          approved: false,
          updatedAt: now,
        },
      ],
    };
    const fp2 = buildServiceFlowStructureFingerprint(flow2);
    const inv = applyOrchestrationInvalidationsAfterFlowChange({
      orchestration: base,
      definitions: defs,
      previousFingerprint: fp1,
      currentFingerprint: fp2,
      flowApproved: true,
    });
    expect(inv?.invalidations.some((x) => x.includes("DOWNGRADE_TO_PARTIAL"))).toBe(true);
    expect(inv?.state.slots[key].status).toBe("partial");
  });

  it("projectRequirementsOrchestrationView — projection workspace stage", () => {
    const st: RequirementsStateJson = {
      requirementsOrchestrationStageV1: {
        currentStage: "FEATURE_DETAIL",
        completedStages: [],
        updatedAt: now,
      },
      serviceFlowV1: sampleFlow(),
    };
    const view = projectRequirementsOrchestrationView({ state: st, slotDefinitions: defs });
    expect(view.workspaceStage).toBe("feature-planning");
    expect(view.authoritativeStage).toBe("FEATURE_DETAIL");
  });

  it("applyRequirementsOrchestrationTransition — NEXT_STAGE transition", () => {
    const st: RequirementsStateJson = {
      serviceFlowV1: { ...sampleFlow(), conversationState: "APPROVED", proposalAcceptedAt: now },
    };
    const r = applyRequirementsOrchestrationTransition({
      state: st,
      currentFlow: st.serviceFlowV1 ?? null,
      proposalDecision: null,
      quickActionId: "NEXT_STAGE",
      quickActionLabel: "다음 단계 진행",
      userMessage: "다음 단계 진행",
      slotDefinitions: defs,
    });
    expect(r.transitionResult).toBe("applied");
    expect(r.signal?.targetStage).toBe("FEATURE_DETAIL");
    expect(r.requirementsStatePatch?.requirementsOrchestrationStageV1?.currentStage).toBe("FEATURE_DETAIL");
  });

  it("resolveRequirementsTransitionSignal exposes transitionSignal type", () => {
    const signal = resolveRequirementsTransitionSignal({
      state: { serviceFlowV1: sampleFlow() },
      quickActionId: "APPROVE_FLOW",
      quickActionLabel: "흐름 승인하기",
      proposalDecision: "FLOW_APPROVE",
    });
    expect(signal?.type).toBe("APPROVE_FLOW");
  });

  it("buildCompressedOrchestrationSummaryForLlm — audit-safe digest not full timeline", () => {
    const st: RequirementsStateJson = {
      requirementsOrchestrationStageV1: {
        currentStage: "SERVICE_FLOW_REVIEW",
        completedStages: [],
        updatedAt: now,
      },
      serviceFlowV1: sampleFlow(),
    };
    const summary = buildCompressedOrchestrationSummaryForLlm({ state: st, slotDefinitions: defs });
    expect(summary).toContain("[orchestration-summary]");
    expect(summary).toContain("stage=SERVICE_FLOW_REVIEW");
    expect(summary.length).toBeLessThan(1500);
  });
});
