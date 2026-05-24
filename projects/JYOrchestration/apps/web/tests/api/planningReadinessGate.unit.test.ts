import { describe, expect, it } from "vitest";
import { evaluatePlanningToGenerationReadiness } from "@/lib/requirements/planningReadinessGate";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";

const nowIso = "2026-05-24T12:00:00.000Z";

describe("planningReadinessGate", () => {
  it("blocks generation stage when required planning slots are not confirmed", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const readiness = evaluatePlanningToGenerationReadiness({ orchestration, definitions });

    expect(readiness.ready).toBe(false);
    expect(readiness.missingRequiredSlotKeys.length).toBeGreaterThan(0);
  });

  it("allows generation preparation after required slots are confirmed", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: "p1",
      projectName: "회의록",
    });
    const base = initialOrchestrationStateFromDefinitions(definitions, nowIso);
    const slots = { ...base.slots };
    const suffixes = [
      ".planning.servicePurpose",
      ".planning.coreUsers",
      ".planning.problem",
      ".planning.expectedOutcome",
      ".flow.actorTypes",
      ".flow.serviceFlow",
      ".design.coreFeatures",
      ".design.requiredScreens",
    ];
    for (const suffix of suffixes) {
      const key = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
      if (!key || !slots[key]) continue;
      slots[key] = {
        ...slots[key],
        status: "confirmed",
        value: `${suffix} 확정 값`,
        updatedAt: nowIso,
      };
    }
    const orchestration = { ...base, slots };

    const readiness = evaluatePlanningToGenerationReadiness({ orchestration, definitions });
    expect(readiness.ready).toBe(true);
  });
});
