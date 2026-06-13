import { describe, expect, it } from "vitest";
import { INTEGRATION_FINAL_WIRING_STEP_ID, INTEGRATION_FINAL_WIRING_WORK_BRANCH } from "@/lib/prototype/implementationIntegrationStep";
import {
  hasFinalWiringReadyTimelineEvent,
  resolveFinalWiringReadyState,
} from "@/lib/prototype/implementationFinalWiringReadyResolver";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";

function step(status: string) {
  return {
    stepId: INTEGRATION_FINAL_WIRING_STEP_ID,
    kind: "final_wiring" as const,
    title: "Final wiring",
    status: status as "pending",
    order: 1,
    workBranch: INTEGRATION_FINAL_WIRING_WORK_BRANCH,
  };
}

describe("resolveFinalWiringReadyState", () => {
  it("resolves finalWiringReady true when implementation_integration_final_wiring_ready event exists", () => {
    const timeline: RequirementsPromptTimelineEntry[] = [
      {
        stage: "feature-planning",
        action: "implementation_integration_final_wiring_ready",
        source: "system",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ];
    const state = resolveFinalWiringReadyState({
      integrationSteps: [step("pending")],
      promptTimeline: timeline,
      sourceUnitCount: 0,
    });
    expect(state.ready).toBe(true);
    expect(state.reason).toBe("ready_event_found");
    expect(hasFinalWiringReadyTimelineEvent(timeline)).toBe(true);
  });

  it("resolves finalWiringReady true when final wiring step and source units exist", () => {
    const state = resolveFinalWiringReadyState({
      integrationSteps: [step("pending")],
      promptTimeline: [],
      sourceUnitCount: 15,
    });
    expect(state.ready).toBe(true);
    expect(state.reason).toBe("branch_and_sources_ready");
    expect(state.finalWiringStepId).toBe(INTEGRATION_FINAL_WIRING_STEP_ID);
    expect(state.finalWiringWorkBranch).toBe(INTEGRATION_FINAL_WIRING_WORK_BRANCH);
  });

  it("resolves false when step missing and no ready event", () => {
    const state = resolveFinalWiringReadyState({
      integrationSteps: [],
      promptTimeline: [],
      sourceUnitCount: 15,
    });
    expect(state.ready).toBe(false);
    expect(state.reason).toBe("missing_final_wiring_step");
  });
});
