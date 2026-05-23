import { describe, expect, it } from "vitest";
import { projectServiceFlowResultToSingleChatSlots } from "@/lib/requirements/singleChatSlotResultProjection";
import { initialOrchestrationStateFromDefinitions, normalizeSlotStatus } from "@/lib/requirements/singleChatOrchestrationSlots";
import {
  createDefaultSlotDefinitions,
  createSampleServiceFlow,
  ORCHESTRATION_REGRESSION_NOW,
} from "../orchestration/helpers/orchestrationRegressionHarness";

function findSlot(
  state: ReturnType<typeof initialOrchestrationStateFromDefinitions>,
  suffix: string,
) {
  const key = Object.keys(state.slots).find((k) => k.endsWith(suffix));
  return key ? state.slots[key] : null;
}

describe("singleChatSlotResultProjection", () => {
  const definitions = createDefaultSlotDefinitions();

  it("projects generated service flow into analysis slots as candidates", () => {
    const emptyOrchestration = initialOrchestrationStateFromDefinitions(definitions, ORCHESTRATION_REGRESSION_NOW);
    const flow = createSampleServiceFlow({
      steps: [
        {
          id: "s1",
          title: "Upload",
          purpose: "p",
          order: 1,
          primaryActorId: "a1",
          secondaryActorIds: [],
          approved: false,
          updatedAt: ORCHESTRATION_REGRESSION_NOW,
        },
        {
          id: "s2",
          title: "Analyze",
          purpose: "p",
          order: 2,
          primaryActorId: "a2",
          secondaryActorIds: [],
          approved: false,
          updatedAt: ORCHESTRATION_REGRESSION_NOW,
        },
        {
          id: "s3",
          title: "Summarize",
          purpose: "p",
          order: 3,
          primaryActorId: "a2",
          secondaryActorIds: [],
          approved: false,
          updatedAt: ORCHESTRATION_REGRESSION_NOW,
        },
      ],
    });

    const next = projectServiceFlowResultToSingleChatSlots({
      orchestration: emptyOrchestration,
      definitions,
      flow,
      source: "flow_draft",
      nowIso: ORCHESTRATION_REGRESSION_NOW,
    });

    expect(next).not.toBeNull();
    const actors = findSlot(next!, ".flow.actorTypes");
    const serviceFlow = findSlot(next!, ".flow.serviceFlow");
    expect(actors?.status).toMatch(/candidate|partial/);
    expect(serviceFlow?.status).toMatch(/candidate|partial/);
    expect(normalizeSlotStatus(String(actors?.status))).not.toBe("confirmed");
  });
});
