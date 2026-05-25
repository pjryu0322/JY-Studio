import { describe, expect, it } from "vitest";
import { buildDerivedImplementationArtifacts } from "@/lib/prototype/implementationArtifacts";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationSlotsFromContext } from "@/lib/prototype/implementationSlots";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import {
  buildDataModelDraftResult,
  buildDbIntegrationReviewResult,
  buildMockImplementationModeResult,
} from "@/lib/prototype/prototypeExecutionDbStrategyActions";
import { implementationTaskPlanConfirmedChips } from "@/lib/prototype/implementationOrchestrationSummary";

function sampleContext() {
  const plan = buildImplementationTaskPlan({
    projectId: "p1",
    projectArtifacts: [],
    featureDraftTitles: ["회의 요약"],
    envOk: true,
    designOk: true,
  });
  const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
  const slots = buildImplementationSlotsFromContext({
    projectId: "p1",
    projectArtifacts: [],
    implementationTaskPlanV1: plan,
    cursorWorkItemsV1: workItems,
    envOk: true,
    designOk: true,
    envCursorBadge: "ok",
  });
  return { plan, workItems, slots };
}

describe("implementation task plan confirmed chips", () => {
  it("includes DB strategy CTAs after task plan confirm", () => {
    const chips = implementationTaskPlanConfirmedChips();
    expect(chips).toContain("DB 연동 필요성 검토");
    expect(chips).toContain("데이터 모델 초안 생성");
    expect(chips).toContain("Mock 기반 구현 진행");
  });
});

describe("buildDbIntegrationReviewResult", () => {
  it("builds DB integration decision artifact from implementation slots", () => {
    const { plan, slots } = sampleContext();
    const result = buildDbIntegrationReviewResult({
      requirementsStateJson: {},
      implementationSlotsV1: slots,
      implementationTaskPlanV1: plan,
      projectArtifacts: [],
      promptTimeline: [],
    });
    expect(result.kind).toBe("applied");
    if (result.kind !== "applied") return;

    const derived = buildDerivedImplementationArtifacts({
      projectId: "p1",
      implementationTaskPlanV1: plan,
      implementationSlotsV1: result.orchestrationPatch.implementationSlotsV1,
      implementationDbStrategyV1: result.orchestrationPatch.implementationDbStrategyV1,
      projectArtifacts: [],
    });
    const decision = derived.find((d) => d.type === "db-integration-decision");
    expect(decision?.body).toContain("# DB 연동 판단서");
    expect(decision?.body).toContain("Mock 기반");
    expect(result.orchestrationPatch.implementationDbStrategyV1.dbDecisionRequested).toBe(true);
    expect(
      result.orchestrationPatch.promptTimeline.some((e) => e.action === "implementation_db_decision_requested"),
    ).toBe(true);
  });
});

describe("buildDataModelDraftResult", () => {
  it("builds data model draft artifact from data entities", () => {
    const { slots } = sampleContext();
    const result = buildDataModelDraftResult({
      requirementsStateJson: {},
      implementationSlotsV1: slots,
      promptTimeline: [],
    });
    expect(result.kind).toBe("applied");
    if (result.kind !== "applied") return;

    const derived = buildDerivedImplementationArtifacts({
      projectId: "p1",
      implementationSlotsV1: result.orchestrationPatch.implementationSlotsV1,
      implementationDbStrategyV1: result.orchestrationPatch.implementationDbStrategyV1,
    });
    const draft = derived.find((d) => d.type === "data-model-draft");
    expect(draft?.body).toContain("# 데이터 모델 초안");
    expect(
      result.orchestrationPatch.promptTimeline.some(
        (e) => e.action === "implementation_data_model_draft_generated",
      ),
    ).toBe(true);
  });
});

describe("buildMockImplementationModeResult", () => {
  it("confirms mock mode without blocking WIP flow", () => {
    const { slots } = sampleContext();
    const result = buildMockImplementationModeResult({
      requirementsStateJson: {},
      implementationSlotsV1: slots,
      promptTimeline: [],
    });
    expect(result.kind).toBe("applied");
    if (result.kind !== "applied") return;
    const patched = result.orchestrationPatch.implementationSlotsV1;
    expect(patched.slots.find((s) => s.key === "data_persistence_mode")?.value).toBe("mock");
    expect(patched.slots.find((s) => s.key === "db_required")?.value).toBe(false);
    expect(result.orchestrationPatch.implementationDbStrategyV1.mockModeConfirmed).toBe(true);

    const derived = buildDerivedImplementationArtifacts({
      projectId: "p1",
      implementationSlotsV1: patched,
      implementationDbStrategyV1: result.orchestrationPatch.implementationDbStrategyV1,
    });
    expect(derived.some((d) => d.type === "storage-strategy")).toBe(true);
  });
});
