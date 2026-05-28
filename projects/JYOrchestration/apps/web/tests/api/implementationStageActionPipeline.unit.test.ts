import { describe, expect, it } from "vitest";
import {
  buildImplementationStageActionBlockedResult,
  evaluateImplementationStageActionGate,
  IMPLEMENTATION_WORK_PLAN_SEED_GATE_BLOCKED_MESSAGE,
  isImplementationSeedReadyForWorkPlanGeneration,
  stageActionExecutionResultFromGate,
} from "@/lib/prototype/implementationStageActionPipeline";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import { defaultImplementationDbStrategy } from "@/lib/prototype/implementationDbStrategy";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

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

function makeTaskPlan(createdAt: string): ImplementationTaskPlanV1 {
  return {
    version: "implementation_task_plan_v1",
    projectId: "p1",
    createdAt,
    source: "implementation_orchestration",
    items: [],
    readiness: { ready: true, missing: [] },
  };
}

function makeSeed(
  lifecycleStatus: ImplementationSeedV1["lifecycleStatus"],
  ready: boolean,
): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    source: "planning_slots_and_artifacts",
    lifecycleStatus,
    readiness: { ready, missing: [], warnings: [] },
    processImplementationItems: [],
    screenImplementationItems: [],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [],
    dataModelSeed: { entities: [], relationships: [] },
    assumptions: [],
    gaps: [],
  };
}

function baseState(
  overrides: {
    readonly parsedRequirementsState?: {
      readonly implementationSeedV1?: ImplementationSeedV1 | null;
      readonly implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
      readonly implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
      readonly implementationDbStrategyV1?: ReturnType<typeof defaultImplementationDbStrategy> | null;
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

describe("isImplementationSeedReadyForWorkPlanGeneration", () => {
  it("allows confirmed seed with readiness.ready", () => {
    expect(isImplementationSeedReadyForWorkPlanGeneration(makeSeed("confirmed", true))).toBe(true);
  });

  it("blocks candidate seed even when readiness.ready", () => {
    expect(isImplementationSeedReadyForWorkPlanGeneration(makeSeed("candidate", true))).toBe(false);
  });
});

describe("evaluateImplementationStageActionGate", () => {
  describe("GENERATE_IMPLEMENTATION_WORK_PLAN", () => {
    it("blocks when designOk is false", () => {
      const state = baseState({
        parsedRequirementsState: { implementationSeedV1: makeSeed("confirmed", true) },
        designOk: false,
      });
      expect(evaluateImplementationStageActionGate("GENERATE_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(false);
    });

    it("blocks when envOk is false", () => {
      const state = baseState({
        parsedRequirementsState: { implementationSeedV1: makeSeed("confirmed", true) },
        envOk: false,
      });
      expect(evaluateImplementationStageActionGate("GENERATE_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(false);
    });

    it("blocks candidate seed with policy A message", () => {
      const state = baseState({
        parsedRequirementsState: { implementationSeedV1: makeSeed("candidate", true) },
      });
      const gate = evaluateImplementationStageActionGate("GENERATE_IMPLEMENTATION_WORK_PLAN", state);
      expect(gate.ok).toBe(false);
      if (!gate.ok) {
        expect(gate.message).toBe(IMPLEMENTATION_WORK_PLAN_SEED_GATE_BLOCKED_MESSAGE);
      }
    });

    it("allows confirmed ready seed with design and env ok", () => {
      const state = baseState({
        parsedRequirementsState: { implementationSeedV1: makeSeed("confirmed", true) },
      });
      expect(evaluateImplementationStageActionGate("GENERATE_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(true);
    });
  });

  describe("CONFIRM_IMPLEMENTATION_WORK_PLAN", () => {
    it("allows pending draft when designOk is true", () => {
      const pending = makeDraft("pending");
      const state = baseState({
        parsedRequirementsState: { implementationWorkPlanDraftV1: null },
        pendingPatch: { implementationWorkPlanDraftV1: pending },
      });
      expect(evaluateImplementationStageActionGate("CONFIRM_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(true);
    });

    it("blocks when designOk is false", () => {
      const state = baseState({
        parsedRequirementsState: { implementationWorkPlanDraftV1: makeDraft("d") },
        designOk: false,
      });
      expect(evaluateImplementationStageActionGate("CONFIRM_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(false);
    });
  });

  describe("REVIEW_DB_INTEGRATION", () => {
    it("allows when task plan exists", () => {
      const state = baseState({
        parsedRequirementsState: { implementationTaskPlanV1: makeTaskPlan("2026-01-02T00:00:00.000Z") },
      });
      expect(evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", state).ok).toBe(true);
    });

    it("allows when work plan draft exists", () => {
      const state = baseState({
        parsedRequirementsState: { implementationWorkPlanDraftV1: makeDraft("draft") },
      });
      expect(evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", state).ok).toBe(true);
    });

    it("blocks when draft and task plan are missing", () => {
      expect(evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", baseState()).ok).toBe(false);
    });
  });

  describe("GENERATE_DATA_MODEL_DRAFT", () => {
    it("allows when dbDecisionRequested is true", () => {
      const state = baseState({
        parsedRequirementsState: {
          implementationDbStrategyV1: { ...defaultImplementationDbStrategy("2026-01-01T00:00:00.000Z"), dbDecisionRequested: true },
        },
      });
      expect(evaluateImplementationStageActionGate("GENERATE_DATA_MODEL_DRAFT", state).ok).toBe(true);
    });

    it("blocks without task plan or db decision", () => {
      expect(evaluateImplementationStageActionGate("GENERATE_DATA_MODEL_DRAFT", baseState()).ok).toBe(false);
    });
  });

  describe("CONFIRM_MOCK_IMPLEMENTATION", () => {
    it("allows when task plan exists", () => {
      const state = baseState({
        parsedRequirementsState: { implementationTaskPlanV1: makeTaskPlan("2026-01-02T00:00:00.000Z") },
      });
      expect(evaluateImplementationStageActionGate("CONFIRM_MOCK_IMPLEMENTATION", state).ok).toBe(true);
    });

    it("blocks when draft and task plan are missing", () => {
      expect(evaluateImplementationStageActionGate("CONFIRM_MOCK_IMPLEMENTATION", baseState()).ok).toBe(false);
    });
  });

  describe("REQUEST_CODE_AGENT_WIP", () => {
    it("blocks without task plan", () => {
      const gate = evaluateImplementationStageActionGate("REQUEST_CODE_AGENT_WIP", baseState());
      expect(gate.ok).toBe(false);
      if (!gate.ok) {
        expect(gate.message).toContain("구현 작업안 확정");
      }
    });

    it("blocks when envOk is false", () => {
      const state = baseState({
        parsedRequirementsState: { implementationTaskPlanV1: makeTaskPlan("2026-01-02T00:00:00.000Z") },
        envOk: false,
      });
      expect(evaluateImplementationStageActionGate("REQUEST_CODE_AGENT_WIP", state).ok).toBe(false);
    });

    it("allows when task plan and envOk are set", () => {
      const state = baseState({
        parsedRequirementsState: { implementationTaskPlanV1: makeTaskPlan("2026-01-02T00:00:00.000Z") },
      });
      expect(evaluateImplementationStageActionGate("REQUEST_CODE_AGENT_WIP", state).ok).toBe(true);
    });
  });

  describe("always allowed actions", () => {
    const alwaysAllowed = [
      "OPEN_ENV_SETTINGS",
      "SHOW_ARTIFACTS",
      "SHOW_ROLE_CHECK",
      "SHOW_SCM_CHECK",
      "SHOW_ENV_CHECK",
      "EDIT_IMPLEMENTATION_SCOPE",
    ] as const;

    it.each(alwaysAllowed)("allows %s", (actionId) => {
      expect(evaluateImplementationStageActionGate(actionId, baseState()).ok).toBe(true);
    });
  });
});

describe("stageActionExecutionResultFromGate", () => {
  it("returns blocked result when gate fails", () => {
    const gate = evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", baseState());
    expect(stageActionExecutionResultFromGate(gate)).toEqual(
      buildImplementationStageActionBlockedResult(
        gate.ok ? "" : gate.message,
      ),
    );
  });

  it("returns null when gate passes", () => {
    const state = baseState({
      parsedRequirementsState: { implementationWorkPlanDraftV1: makeDraft("d") },
    });
    const gate = evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", state);
    expect(stageActionExecutionResultFromGate(gate)).toBeNull();
  });
});
