import { describe, expect, it } from "vitest";
import {
  buildImplementationStageActionExecutionDecision,
  buildImplementationStageActionOpenArtifactsResult,
  buildImplementationStageActionOpenEnvSettingsResult,
  buildImplementationStageActionShowStatusResult,
  IMPLEMENTATION_WORK_PLAN_SEED_GATE_BLOCKED_MESSAGE,
} from "@/lib/prototype/implementationStageActionPipeline";
import {
  buildImplementationStageActionTimelineEntry,
  buildImplementationStageActionRouteTimelineEntries,
} from "@/lib/prototype/implementationIntentTimeline";
import {
  resolveEffectiveImplementationState,
  shouldClearPendingImplementationPatch,
} from "@/lib/prototype/effectiveImplementationState";
import { evaluateImplementationStageActionGate } from "@/lib/prototype/implementationStageActionPipeline";
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

function makeSeed(lifecycle: ImplementationSeedV1["lifecycleStatus"], ready: boolean): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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

describe("buildImplementationStageActionExecutionDecision", () => {
  it("returns blocked result when gate fails", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: { implementationSeedV1: makeSeed("candidate", true) },
      pendingPatch: {},
      envOk: true,
      designOk: true,
    });
    const result = buildImplementationStageActionExecutionDecision(
      "GENERATE_IMPLEMENTATION_WORK_PLAN",
      state,
    );
    expect(result?.kind).toBe("blocked");
    if (result?.kind === "blocked") {
      expect(result.message).toBe(IMPLEMENTATION_WORK_PLAN_SEED_GATE_BLOCKED_MESSAGE);
      expect(result.timelineEntries?.[0]?.action).toBe("implementation_stage_action_blocked");
    }
  });

  it("returns null when gate passes", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: { implementationSeedV1: makeSeed("confirmed", true) },
      pendingPatch: {},
      envOk: true,
      designOk: true,
    });
    expect(
      buildImplementationStageActionExecutionDecision("GENERATE_IMPLEMENTATION_WORK_PLAN", state),
    ).toBeNull();
  });
});

describe("stage action result factories", () => {
  it("open env/artifacts/status results use expected kinds", () => {
    expect(buildImplementationStageActionOpenEnvSettingsResult().kind).toBe("open_env_settings");
    expect(buildImplementationStageActionOpenArtifactsResult().kind).toBe("open_artifacts");
    expect(buildImplementationStageActionShowStatusResult("scm").kind).toBe("show_status");
  });
});

describe("buildImplementationStageActionTimelineEntry", () => {
  it("includes actionId source and phase in responseText", () => {
    const entry = buildImplementationStageActionTimelineEntry({
      action: "blocked",
      actionId: "GENERATE_IMPLEMENTATION_WORK_PLAN",
      source: "cta",
      message: "seed_not_confirmed",
    });
    expect(entry.action).toBe("implementation_stage_action_blocked");
    expect(entry.responseText).toContain("actionId=GENERATE_IMPLEMENTATION_WORK_PLAN");
    expect(entry.responseText).toContain("source=cta");
    expect(entry.responseText).toContain("action=blocked");
    expect(entry.responseText).toContain("reason=seed_not_confirmed");
  });

  it("builds routed and executed pair", () => {
    const entries = buildImplementationStageActionRouteTimelineEntries({
      actionId: "CONFIRM_IMPLEMENTATION_WORK_PLAN",
    });
    expect(entries.map((e) => e.action)).toEqual([
      "implementation_stage_action_routed",
      "implementation_stage_action_executed",
    ]);
  });
});

describe("confirm after generate regression (unit path)", () => {
  it("allows confirm when pending draft exists after parsed state is empty", () => {
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
    expect(evaluateImplementationStageActionGate("CONFIRM_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(true);
  });

  it("allows confirm from persisted draft after pending cleanup", () => {
    const persisted = makeDraft("persisted");
    const shouldClear = shouldClearPendingImplementationPatch({
      prevPersistedDraftUpdatedAt: null,
      nextPersistedDraftUpdatedAt: persisted.updatedAt,
    });
    expect(shouldClear).toBe(true);

    const stateAfterCleanup = resolveEffectiveImplementationState({
      parsedRequirementsState: { implementationWorkPlanDraftV1: persisted },
      pendingPatch: {},
      envOk: true,
      designOk: true,
    });
    expect(evaluateImplementationStageActionGate("CONFIRM_IMPLEMENTATION_WORK_PLAN", stateAfterCleanup).ok).toBe(
      true,
    );
  });
});
