import { describe, expect, it, vi } from "vitest";
import { orchestrateImplementationStageAction } from "@/lib/prototype/implementationStageActionOrchestrator";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";

const NOW = "2026-05-28T00:00:00.000Z";

function makeSeed(lifecycle: ImplementationSeedV1["lifecycleStatus"], ready: boolean): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_slots_and_artifacts",
    lifecycleStatus: lifecycle,
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

function baseState(overrides?: {
  readonly seed?: ImplementationSeedV1 | null;
  readonly draft?: ImplementationWorkPlanDraftV1 | null;
}) {
  return resolveEffectiveImplementationState({
    parsedRequirementsState: {
      implementationSeedV1: overrides?.seed ?? makeSeed("confirmed", true),
      implementationWorkPlanDraftV1: overrides?.draft ?? null,
      implementationTaskPlanV1: null,
    },
    pendingPatch: {},
    envOk: true,
    designOk: true,
  });
}

describe("orchestrateImplementationStageAction", () => {
  it("does not call executor when gate is blocked", async () => {
    const execute = vi.fn(() => ({ outcome: "executed" as const }));
    const state = baseState({ seed: makeSeed("candidate", true) });
    const run = await orchestrateImplementationStageAction({
      projectId: "p1",
      actionId: "GENERATE_IMPLEMENTATION_WORK_PLAN",
      source: "cta",
      effectiveState: state,
      execute,
      nowIso: NOW,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(run.status).toBe("blocked");
    expect(run.gateResult).toEqual({ ok: false, message: expect.any(String) });
  });

  it("records routed + blocked timeline on gate failure", async () => {
    const state = baseState({ seed: makeSeed("candidate", true) });
    const run = await orchestrateImplementationStageAction({
      projectId: "p1",
      actionId: "GENERATE_IMPLEMENTATION_WORK_PLAN",
      source: "cta",
      effectiveState: state,
      execute: () => ({ outcome: "executed" }),
      nowIso: NOW,
    });
    expect(run.timelineEntries.map((e) => e.action)).toEqual([
      "implementation_stage_action_routed",
      "implementation_stage_action_blocked",
    ]);
    expect(run.timelineEntries[0]?.responseText).toContain(`runId=${run.runId}`);
    expect(run.timelineEntries[1]?.responseText).toContain(`runId=${run.runId}`);
  });

  it("returns succeeded when executor returns executed", async () => {
    const run = await orchestrateImplementationStageAction({
      projectId: "p1",
      actionId: "SHOW_ARTIFACTS",
      source: "cta",
      effectiveState: baseState(),
      execute: () => ({ outcome: "executed" }),
      nowIso: NOW,
    });
    expect(run.status).toBe("succeeded");
    expect(run.timelineEntries.map((e) => e.action)).toEqual([
      "implementation_stage_action_routed",
      "implementation_stage_action_executed",
    ]);
    expect(run.timelineEntries[0]?.responseText).toContain(`runId=${run.runId}`);
    expect(run.timelineEntries[1]?.responseText).toContain(`runId=${run.runId}`);
  });

  it("returns no_op when executor returns no_op", async () => {
    const state = baseState({ draft: makeDraft() });
    const run = await orchestrateImplementationStageAction({
      projectId: "p1",
      actionId: "GENERATE_IMPLEMENTATION_WORK_PLAN",
      source: "cta",
      effectiveState: state,
      execute: () => ({ outcome: "no_op", message: "already_exists" }),
      nowIso: NOW,
    });
    expect(run.status).toBe("no_op");
    expect(run.timelineEntries[1]?.action).toBe("implementation_stage_action_blocked");
  });

  it("returns failed when executor throws", async () => {
    const run = await orchestrateImplementationStageAction({
      projectId: "p1",
      actionId: "SHOW_ARTIFACTS",
      source: "cta",
      effectiveState: baseState(),
      execute: () => {
        throw new Error("boom");
      },
      nowIso: NOW,
    });
    expect(run.status).toBe("failed");
    expect(run.message).toBe("boom");
    expect(run.timelineEntries[1]?.action).toBe("implementation_stage_action_blocked");
  });
});
