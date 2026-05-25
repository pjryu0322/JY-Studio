import { describe, expect, it } from "vitest";
import { buildPrototypeExecutionPlanningOrchestrationView } from "@/lib/prototype/prototypeExecutionPlanningOrchestration";
import { initialOrchestrationStateFromDefinitions, buildDynamicServicePlanningSlotDefinitions, hashSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";

describe("buildPrototypeExecutionPlanningOrchestrationView", () => {
  it("exposes artifact hub badge when planning orchestration has progress", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "P",
      projectDescription: "D",
      projectType: null,
      servicePlanningAgentCatalogKeys: null,
    });
    const hash = hashSlotDefinitions(defs);
    const orch = initialOrchestrationStateFromDefinitions(defs, "2026-05-19T00:00:00.000Z");
    const slots = { ...orch.slots };
    const firstKey = Object.keys(slots)[0];
    if (firstKey) {
      slots[firstKey] = { ...slots[firstKey]!, status: "confirmed" };
    }

    const view = buildPrototypeExecutionPlanningOrchestrationView({
      requirementsStateJson: {
        singleChatOrchestrationV1: { ...orch, slots, slotDefinitionsHash: hash },
        deliverableAssets: [
          {
            id: "a1",
            projectId: "proj-1",
            type: "full_plan",
            title: "기획안",
            content: "body",
            version: 1,
            createdAt: new Date().toISOString(),
          },
        ],
      },
      projectId: "proj-1",
      projectName: "P",
      projectDescription: "D",
    });

    expect(view.showArtifactHubBadge).toBe(true);
    expect(view.artifactHubCompletedCount).toBeGreaterThan(0);
    expect(view.orchestrationUi.artifactBadgeHasStale).toBeDefined();
    expect(view.planningProgressUi?.readinessPercent).toBeGreaterThan(0);
  });

  it("hides hub badge when orchestration is empty", () => {
    const view = buildPrototypeExecutionPlanningOrchestrationView({
      requirementsStateJson: {},
      projectId: "proj-2",
      projectName: "Empty",
      projectDescription: "",
    });
    expect(view.showArtifactHubBadge).toBe(false);
    expect(view.planningProgressUi.readinessPercent).toBeGreaterThanOrEqual(0);
  });
});
