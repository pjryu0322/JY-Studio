import { describe, expect, it } from "vitest";
import { evaluateImplementationStageActionGate } from "@/lib/prototype/implementationStageActionPipeline";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";

function makeDraft(updatedAt: string): ImplementationWorkPlanDraftV1 {
  return {
    version: "implementation_work_plan_draft_v1",
    projectId: "p1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
    source: "planning_artifacts",
    referenceArtifacts: [],
    implementationScope: ["scope"],
    implementationApproach: [],
    assumptions: [],
    blockers: [],
    status: "draft",
  };
}

function baseState(
  overrides: {
    readonly parsedRequirementsState?: {
      readonly implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
      readonly implementationTaskPlanV1?: import("@/lib/prototype/implementationTaskPlan").ImplementationTaskPlanV1 | null;
      readonly implementationDbStrategyV1?: import("@/lib/prototype/implementationDbStrategy").ImplementationDbStrategyV1 | null;
    };
    readonly pendingPatch?: { readonly implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null };
    readonly envOk?: boolean;
    readonly designOk?: boolean;
  } = {},
) {
  return resolveEffectiveImplementationState({
    parsedRequirementsState: {
      implementationSeedV1: null,
      implementationWorkPlanDraftV1: null,
      implementationTaskPlanV1: null,
      implementationDbStrategyV1: null,
      ...overrides.parsedRequirementsState,
    },
    pendingPatch: overrides.pendingPatch ?? {},
    envOk: overrides.envOk ?? true,
    designOk: overrides.designOk ?? true,
  });
}

describe("evaluateImplementationStageActionGate", () => {
  it("allows OPEN_ENV_SETTINGS without prerequisites", () => {
    const state = baseState();
    expect(evaluateImplementationStageActionGate("OPEN_ENV_SETTINGS", state)).toEqual({ ok: true });
  });

  it("allows REVIEW_DB_INTEGRATION when draft is ready", () => {
    const state = baseState({
      parsedRequirementsState: { implementationWorkPlanDraftV1: makeDraft("draft") },
    });
    expect(evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", state).ok).toBe(true);
  });

  it("blocks REVIEW_DB_INTEGRATION when draft and task plan are missing", () => {
    const state = baseState();
    const gate = evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", state);
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.message).toContain("구현 작업안 초안 생성");
    }
  });

  it("blocks CONFIRM_MOCK_IMPLEMENTATION when draft and task plan are missing", () => {
    const state = baseState();
    expect(evaluateImplementationStageActionGate("CONFIRM_MOCK_IMPLEMENTATION", state).ok).toBe(false);
  });

  it("blocks GENERATE_DATA_MODEL_DRAFT without db review or task plan", () => {
    const state = baseState();
    const gate = evaluateImplementationStageActionGate("GENERATE_DATA_MODEL_DRAFT", state);
    expect(gate.ok).toBe(false);
    if (!gate.ok) {
      expect(gate.message).toContain("DB 연동 필요성 검토");
    }
  });
});
