import { describe, expect, it } from "vitest";
import {
  applyFeatureDetailSlotMutation,
  buildFeatureDetailBootstrapMessage,
  confirmFeatureDetailSlot,
  deriveFeatureTitleFromStepTitle,
  featureDetailSlotToEditDraft,
  filterFeatureDetailQuickActions,
  markFeatureDetailSlotPartial,
  projectFeatureDetailMetrics,
  resolveFocusFeatureSlot,
  seedFeatureDetailSlotsFromServiceFlow,
  shouldRecomputeFeatureDetailProjection,
  withFeatureDetailFocus,
} from "@/lib/requirements/featureDetailSlots";
import { tryServiceFlowOrchestrationTransitionFastPath } from "@/lib/requirements/serviceFlowStageTransition";
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

  it("applyFeatureDetailSlotMutation unifies partial/confirm/obsolete", () => {
    const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
    const artifact = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    const slot = artifact.slots[0]!;
    const partial = applyFeatureDetailSlotMutation({
      artifact,
      featureId: slot.id,
      mode: "partial",
      draft: { ...featureDetailSlotToEditDraft(slot), inputData: "only-in" },
      mutationSource: "test_unified",
      nowIso: now,
    });
    expect(partial.artifact.slots.find((s) => s.id === slot.id)?.status).toBe("partial");

    const confirm = applyFeatureDetailSlotMutation({
      artifact: partial.artifact,
      featureId: slot.id,
      mode: "confirm",
      draft: {
        ...featureDetailSlotToEditDraft(slot),
        inputData: "in",
        processRules: "proc",
      },
      mutationSource: "test_unified",
      nowIso: now,
    });
    expect(confirm.artifact.slots.find((s) => s.id === slot.id)?.status).toBe("confirmed");
  });

  it("A: candidate edit → partial 저장", () => {
    const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
    const artifact = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    const slot = artifact.slots[0]!;
    const draft = {
      ...featureDetailSlotToEditDraft(slot),
      inputData: "회의 녹취 파일",
    };
    const next = markFeatureDetailSlotPartial({
      artifact,
      featureId: slot.id,
      draft,
      mutationSource: "test",
      nowIso: now,
    });
    const updated = next.slots.find((s) => s.id === slot.id)!;
    expect(updated.status).toBe("partial");
    expect(updated.inputData).toEqual(["회의 녹취 파일"]);
    expect(next.lastMutation?.featureAction).toBe("partial_edit");
    expect(next.lastMutation?.previousStatus).toBe("candidate");
    expect(next.lastMutation?.nextStatus).toBe("partial");
  });

  it("B: candidate edit → confirmed 승격", () => {
    const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
    const artifact = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    const slot = artifact.slots[0]!;
    const draft = {
      ...featureDetailSlotToEditDraft(slot),
      inputData: "입력 A",
      processRules: "처리 B",
    };
    const { artifact: next, error } = confirmFeatureDetailSlot({
      artifact,
      featureId: slot.id,
      draft,
      mutationSource: "test",
      nowIso: now,
    });
    expect(error).toBeUndefined();
    expect(next.slots.find((s) => s.id === slot.id)?.status).toBe("confirmed");
    expect(next.lastMutation?.featureAction).toBe("confirm");
    expect(next.lastMutation?.nextStatus).toBe("confirmed");
  });

  it("C: confirmed feature 1개 이상 → 화면 정의 버튼 노출", () => {
    const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
    const candidateOnly = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    const oneConfirmed = {
      ...candidateOnly,
      slots: candidateOnly.slots.map((s, i) =>
        i === 0 ?
          {
            ...s,
            status: "confirmed" as const,
            inputData: ["a"],
            processRules: ["b"],
            updatedAt: now,
          }
        : s,
      ),
    };
    const raw = quickActionsForConversationState("FEATURE_DETAIL");
    const open = filterFeatureDetailQuickActions({
      actions: raw,
      metrics: projectFeatureDetailMetrics(oneConfirmed),
      stage: "FEATURE_DETAIL",
      activePhase: "feature_detail_bootstrap",
    });
    expect(open.map((a) => a.id)).toContain("DEFINE_SCREEN");
    expect(open.map((a) => a.id)).toContain("DEFINE_API");
  });

  it("D: gates DEFINE_SCREEN / DEFINE_API until at least one confirmed", () => {
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

    const oneConfirmed = {
      ...candidateOnly,
      slots: candidateOnly.slots.map((s, i) =>
        i === 0 ?
          { ...s, status: "confirmed" as const, inputData: ["x"], processRules: ["y"], updatedAt: now }
        : s,
      ),
    };
    const open = filterFeatureDetailQuickActions({
      actions: raw,
      metrics: projectFeatureDetailMetrics(oneConfirmed),
      stage: "FEATURE_DETAIL",
      activePhase: "feature_detail_bootstrap",
    });
    expect(open.map((a) => a.id)).toContain("DEFINE_SCREEN");
    expect(open.map((a) => a.id)).toContain("DEFINE_API");
  });

  it("E: confirmed feature 0개 → 화면/API 버튼 숨김", () => {
    const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
    const candidateOnly = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    const raw = quickActionsForConversationState("FEATURE_DETAIL");
    const gated = filterFeatureDetailQuickActions({
      actions: raw,
      metrics: projectFeatureDetailMetrics(candidateOnly),
      stage: "FEATURE_DETAIL",
    });
    expect(gated.map((a) => a.id)).not.toContain("DEFINE_SCREEN");
    expect(gated.map((a) => a.id)).not.toContain("DEFINE_API");
  });

  it("F: feature edit 시 flow invalidation 미발생 + timeline metadata", () => {
    const defs = createDefaultSlotDefinitions();
    const base = initialOrchestrationStateFromDefinitions(defs, now);
    const flow = createSampleServiceFlow({
      conversationState: "FEATURE_DETAIL",
      flowApproved: true,
    });
    const artifact = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    const slot = artifact.slots[0]!;
    const fp = buildServiceFlowStructureFingerprint(flow);
    const invalidation = applyOrchestrationInvalidationsAfterFlowChange({
      orchestration: base,
      definitions: defs,
      previousFingerprint: fp,
      currentFingerprint: fp,
      flowApproved: true,
    });
    expect(invalidation).toBeNull();

    const next = markFeatureDetailSlotPartial({
      artifact,
      featureId: slot.id,
      draft: { ...featureDetailSlotToEditDraft(slot), inputData: "only-input" },
      mutationSource: "unit_test",
      nowIso: now,
    });
    expect(next.lastMutation?.featureId).toBe(slot.id);
    expect(next.lastMutation?.mutationSource).toBe("unit_test");
    const updated = next.slots.find((s) => s.id === slot.id)!;
    expect(shouldRecomputeFeatureDetailProjection(slot, updated)).toBe(false);
  });

  it("projection rebuild uses featureDetailSlotsV1 for quick actions", () => {
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

  it("FEATURE_DETAIL transition alone does not trigger flow-structure invalidation", () => {
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

  it("focusFeatureId tracks active feature for bootstrap message", () => {
    const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
    const artifact = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    const second = artifact.slots[1];
    expect(second).toBeDefined();
    const focused = withFeatureDetailFocus(artifact, second!.id);
    expect(focused.focusFeatureId).toBe(second!.id);
    expect(resolveFocusFeatureSlot(focused)?.id).toBe(second!.id);
    expect(buildFeatureDetailBootstrapMessage(flow, focused)).toContain(second!.title);
  });

  it("API_DEFINE_START fast-path requires confirmed feature", () => {
    const flow = createSampleServiceFlow({ conversationState: "FEATURE_DETAIL" });
    const candidateOnly = seedFeatureDetailSlotsFromServiceFlow(flow, now);
    const blocked = tryServiceFlowOrchestrationTransitionFastPath({
      proposalDecision: null,
      quickActionId: "DEFINE_API",
      currentFlow: flow,
      existingFeatureDetail: candidateOnly,
    });
    expect(blocked?.routingDecision).toBe("api_define_gated");

    const oneConfirmed = {
      ...candidateOnly,
      slots: candidateOnly.slots.map((s, i) =>
        i === 0 ?
          { ...s, status: "confirmed" as const, inputData: ["a"], processRules: ["b"], updatedAt: now }
        : s,
      ),
    };
    const ok = tryServiceFlowOrchestrationTransitionFastPath({
      proposalDecision: null,
      quickActionId: "DEFINE_API",
      currentFlow: flow,
      existingFeatureDetail: oneConfirmed,
      existingOrchestrationStage: {
        currentStage: "FEATURE_DETAIL",
        completedStages: ["SERVICE_FLOW_REVIEW"],
        activePhase: "feature_detail_bootstrap",
        updatedAt: now,
      },
    });
    expect(ok?.transitionMeta?.transitionTriggered).toBe(true);
    expect(ok?.requirementsStatePatch?.requirementsOrchestrationStageV1?.activePhase).toBe("api_define");
    expect(String(ok?.assistantMessage ?? "")).toContain("API");
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
