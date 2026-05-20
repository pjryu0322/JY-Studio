import { describe, expect, it } from "vitest";
import {
  buildFeatureDetailBootstrapMessage,
  deriveFeatureTitleFromStepTitle,
  filterFeatureDetailQuickActions,
  projectFeatureDetailMetrics,
  seedFeatureDetailSlotsFromServiceFlow,
} from "@/lib/requirements/featureDetailSlots";
import { applyRequirementsOrchestrationTransition } from "@/lib/requirements/requirementsTransitionEngine";
import { buildQuickReplyProjection } from "@/lib/requirements/requirementsOrchestrationProjection";
import { resolveAuthoritativeOrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { quickActionsForConversationState } from "@/lib/requirements/requirementsQuickActionRegistry";
import { buildServiceFlowStructureFingerprint } from "@/lib/requirements/requirementsOrchestrationInvalidation";
import { applyOrchestrationInvalidationsAfterFlowChange } from "@/lib/requirements/requirementsOrchestrationInvalidation";
import {
  createDefaultSlotDefinitions,
  createMockOrchestrationState,
  createSampleServiceFlow,
  ORCHESTRATION_REGRESSION_NOW,
} from "../orchestration/helpers/orchestrationRegressionHarness";
import { initialOrchestrationStateFromDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";

const now = ORCHESTRATION_REGRESSION_NOW;

describe("featureDetailSlots", () => {
  it("A: FEATURE_DETAIL entry seeds candidate features from flow steps", () => {
    const flow = createSampleServiceFlow({
      conversationState: "APPROVED",
      proposalAcceptedAt: now,
      flowApproved: true,
    });
    const artifact = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    expect(artifact.slots.length).toBeGreaterThanOrEqual(1);
    expect(artifact.slots.every((s) => s.status === "candidate")).toBe(true);
    expect(artifact.lastMutation?.featureAction).toBe("bootstrap");
  });

  it("B: every feature links linkedStepId to a service flow step", () => {
    const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
    const stepIds = new Set((flow.steps ?? []).map((s) => s.id));
    const artifact = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    for (const slot of artifact.slots) {
      expect(stepIds.has(slot.linkedStepId)).toBe(true);
    }
  });

  it("C: feature status lifecycle values are supported in parse/seed", () => {
    const title = deriveFeatureTitleFromStepTitle("사용자가 회의 녹취 파일을 업로드한다");
    expect(title).toContain("업로드");
    const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
    const artifact = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    const confirmed = {
      ...artifact,
      slots: artifact.slots.map((s, i) => ({
        ...s,
        status: i === 0 ? ("confirmed" as const) : s.status,
        updatedAt: now,
      })),
    };
    const metrics = projectFeatureDetailMetrics(confirmed);
    expect(metrics.confirmedFeatureCount).toBe(1);
    expect(metrics.featureCoverage).toBeGreaterThan(0);
  });

  it("D: gates DEFINE_SCREEN / DEFINE_API until confirmed + coverage", () => {
    const raw = quickActionsForConversationState("FEATURE_DETAIL");
    const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
    const candidateOnly = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    const gated = filterFeatureDetailQuickActions({
      actions: raw,
      metrics: projectFeatureDetailMetrics(candidateOnly),
      stage: "FEATURE_DETAIL",
      activePhase: "feature_detail_bootstrap",
    });
    expect(gated.map((a) => a.id)).not.toContain("DEFINE_SCREEN");
    expect(gated.map((a) => a.id)).not.toContain("DEFINE_API");
    expect(gated.map((a) => a.id)).toContain("EDIT_FEATURES");

    const allConfirmed = {
      ...candidateOnly,
      slots: candidateOnly.slots.map((s) => ({ ...s, status: "confirmed" as const, updatedAt: now })),
    };
    const open = filterFeatureDetailQuickActions({
      actions: raw,
      metrics: projectFeatureDetailMetrics(allConfirmed),
      stage: "FEATURE_DETAIL",
      activePhase: "feature_detail_bootstrap",
    });
    expect(open.map((a) => a.id)).toContain("DEFINE_SCREEN");
    expect(open.map((a) => a.id)).toContain("DEFINE_API");
  });

  it("E: projection rebuild uses featureDetailSlotsV1 for quick actions", () => {
    const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
    const state = {
      ...createMockOrchestrationState({ stage: "FEATURE_DETAIL", flow }),
      featureDetailSlotsV1: seedFeatureDetailSlotsFromServiceFlow(flow, now),
    };
    const projection = buildQuickReplyProjection({
      state,
      authoritativeStage: "FEATURE_DETAIL",
    });
    expect(projection.featureDetail.featureCount).toBeGreaterThan(0);
    expect(projection.quickActions.map((a) => a.id)).not.toContain("DEFINE_SCREEN");
  });

  it("F: FEATURE_DETAIL transition alone does not trigger flow-structure invalidation", () => {
    const defs = createDefaultSlotDefinitions();
    const base = initialOrchestrationStateFromDefinitions(defs, now);
    const flow = createSampleServiceFlow({
      conversationState: "APPROVED",
      proposalAcceptedAt: now,
      flowApproved: true,
    });
    const fp = buildServiceFlowStructureFingerprint(flow);
    const invalidation = applyOrchestrationInvalidationsAfterFlowChange({
      orchestration: base,
      definitions: defs,
      previousFingerprint: fp,
      currentFingerprint: fp,
      flowApproved: true,
    });
    expect(invalidation).toBeNull();
  });

  it("transition engine seeds featureDetailSlotsV1 on FEATURE_DETAIL_START", () => {
    const flow = createSampleServiceFlow({
      conversationState: "APPROVED",
      proposalAcceptedAt: now,
      flowApproved: true,
    });
    const state = createMockOrchestrationState({ stage: "SERVICE_FLOW_REVIEW", flow });
    const result = applyRequirementsOrchestrationTransition({
      state,
      currentFlow: flow,
      proposalDecision: null,
      quickActionId: "START_FEATURE_DETAIL",
      slotDefinitions: createDefaultSlotDefinitions(),
      nowIso: now,
    });
    expect(result.requirementsStatePatch?.featureDetailSlotsV1?.slots.length).toBeGreaterThan(0);
    const msg = String(result.fastPath?.assistantMessage ?? "");
    expect(msg).toContain("기능 후보");
    const merged = {
      ...state,
      ...(result.requirementsStatePatch ?? {}),
      serviceFlowV1: result.updatedFlow ?? flow,
    };
    expect(resolveAuthoritativeOrchestrationStage(merged)).toBe("FEATURE_DETAIL");
    expect(buildFeatureDetailBootstrapMessage(flow, merged.featureDetailSlotsV1!)).toContain(
      String(merged.featureDetailSlotsV1!.slots.length),
    );
  });
});
