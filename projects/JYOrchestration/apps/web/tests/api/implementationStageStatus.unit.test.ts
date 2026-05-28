import { describe, expect, it } from "vitest";
import { deriveImplementationStageStatus } from "@/lib/prototype/implementationStageStatus";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";

const NOW = "2026-01-01T00:00:00.000Z";

function makeSeed(ready: boolean): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_slots_and_artifacts",
    lifecycleStatus: "confirmed",
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

function makeDraft(): ImplementationWorkPlanDraftV1 {
  return {
    version: "implementation_work_plan_draft_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_artifacts",
    referenceArtifacts: [],
    implementationScope: ["scope"],
    implementationApproach: [],
    assumptions: [],
    blockers: [],
    status: "draft",
  };
}

function makeTaskPlan(): ImplementationTaskPlanV1 {
  return {
    version: "implementation_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    implementationScope: ["scope"],
    workUnits: [],
    status: "confirmed",
  };
}

describe("deriveImplementationStageStatus", () => {
  it("returns not_ready when design, env, or seed readiness is missing", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: { implementationSeedV1: makeSeed(false) },
      pendingPatch: {},
      envOk: false,
      designOk: true,
    });
    expect(deriveImplementationStageStatus(state)).toBe("not_ready");
  });

  it("returns implementation_ready when seed is ready and env ok even if designOk is false", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: { implementationSeedV1: makeSeed(true) },
      pendingPatch: {},
      envOk: true,
      designOk: false,
    });
    expect(deriveImplementationStageStatus(state)).toBe("implementation_ready");
  });

  it("returns work_plan_drafted when draft exists", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: makeSeed(true),
        implementationWorkPlanDraftV1: makeDraft(),
      },
      pendingPatch: {},
      envOk: true,
      designOk: true,
    });
    expect(deriveImplementationStageStatus(state)).toBe("work_plan_drafted");
  });

  it("returns work_plan_confirmed when task plan exists", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: makeSeed(true),
        implementationWorkPlanDraftV1: makeDraft(),
        implementationTaskPlanV1: makeTaskPlan(),
      },
      pendingPatch: {},
      envOk: true,
      designOk: true,
    });
    expect(deriveImplementationStageStatus(state)).toBe("work_plan_confirmed");
  });
});
