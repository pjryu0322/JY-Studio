import { describe, expect, it } from "vitest";
import {
  canConfirmImplementationWorkPlanFromEffectiveState,
  mapImplementationChipToAction,
  mergePendingImplementationPatch,
  resolveEffectiveImplementationState,
} from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";
import { WORK_PLAN_DRAFT_GENERATE_CHIP } from "@/lib/prototype/implementationWorkPlanDraft";

function makeDraft(id: string): ImplementationWorkPlanDraftV1 {
  return {
    version: "implementation_work_plan_draft_v1",
    projectId: "p1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: id,
    source: "planning_artifacts",
    referenceArtifacts: [],
    implementationScope: ["scope"],
    implementationApproach: [],
    assumptions: [],
    blockers: [],
    status: "draft",
  };
}

describe("resolveEffectiveImplementationState", () => {
  it("prefers pending implementation work plan draft over persisted state", () => {
    const persisted = makeDraft("persisted");
    const pending = makeDraft("pending");

    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: null,
        implementationWorkPlanDraftV1: persisted,
        implementationTaskPlanV1: null,
      },
      pendingPatch: {
        implementationWorkPlanDraftV1: pending,
      },
      envOk: true,
      designOk: true,
    });

    expect(state.implementationWorkPlanDraftV1).toBe(pending);
  });

  it("uses persisted draft when pending patch is empty", () => {
    const persisted = makeDraft("persisted");

    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: null,
        implementationWorkPlanDraftV1: persisted,
        implementationTaskPlanV1: null,
      },
      pendingPatch: {},
      envOk: true,
      designOk: true,
    });

    expect(state.implementationWorkPlanDraftV1).toBe(persisted);
  });
});

describe("canConfirmImplementationWorkPlanFromEffectiveState", () => {
  it("allows confirm when parsed draft is missing but pending draft is ready", () => {
    const pending = makeDraft("pending");
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationWorkPlanDraftV1: null,
        implementationTaskPlanV1: null,
      },
      pendingPatch: { implementationWorkPlanDraftV1: pending },
      envOk: true,
      designOk: true,
    });

    expect(canConfirmImplementationWorkPlanFromEffectiveState(state)).toEqual({ ok: true });
  });

  it("blocks confirm when no draft in effective state", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationWorkPlanDraftV1: null,
        implementationTaskPlanV1: null,
      },
      pendingPatch: {},
      envOk: true,
      designOk: true,
    });

    expect(canConfirmImplementationWorkPlanFromEffectiveState(state).ok).toBe(false);
  });
});

describe("mergePendingImplementationPatch", () => {
  it("merges orchestration patch fields into pending patch", () => {
    const draft = makeDraft("new");
    const merged = mergePendingImplementationPatch(
      {},
      { implementationWorkPlanDraftV1: draft },
    );
    expect(merged.implementationWorkPlanDraftV1).toBe(draft);
  });
});

describe("mapImplementationChipToAction", () => {
  it("maps work plan chips to stage action ids", () => {
    expect(mapImplementationChipToAction(WORK_PLAN_DRAFT_GENERATE_CHIP)).toBe(
      "GENERATE_IMPLEMENTATION_WORK_PLAN",
    );
    expect(mapImplementationChipToAction("구현 작업안 확정")).toBe("CONFIRM_IMPLEMENTATION_WORK_PLAN");
    expect(mapImplementationChipToAction("unknown")).toBeNull();
  });
});
