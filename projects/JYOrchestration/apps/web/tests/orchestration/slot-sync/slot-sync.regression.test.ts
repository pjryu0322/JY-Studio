import { describe, expect, it } from "vitest";
import {
  createDefaultSlotDefinitions,
  createSampleServiceFlow,
  ORCHESTRATION_REGRESSION_NOW,
} from "../helpers/orchestrationRegressionHarness";
import {
  initialOrchestrationStateFromDefinitions,
  singleChatOrchestrationWeightedProgress,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { syncServiceFlowToOrchestrationSlots } from "@/lib/requirements/serviceFlowOrchestrationSync";

describe("orchestration regression — slot sync", () => {
  const defs = createDefaultSlotDefinitions();

  it("APPLY proposal promotes empty slots toward partial and increases weighted progress", () => {
    const flow = createSampleServiceFlow({
      lastProposalDecision: "APPLY",
      actors: [
        { id: "a1", name: "Editor", kind: "human", description: "" },
        { id: "a2", name: "Reviewer", kind: "human", description: "" },
        { id: "a3", name: "System", kind: "system", description: "" },
      ],
      steps: [
        {
          id: "s1",
          title: "Upload",
          purpose: "",
          order: 1,
          primaryActorId: "a1",
          secondaryActorIds: [],
          approved: false,
          updatedAt: ORCHESTRATION_REGRESSION_NOW,
        },
        {
          id: "s2",
          title: "Review",
          purpose: "",
          order: 2,
          primaryActorId: "a2",
          secondaryActorIds: [],
          approved: false,
          updatedAt: ORCHESTRATION_REGRESSION_NOW,
        },
        {
          id: "s3",
          title: "Finalize",
          purpose: "",
          order: 3,
          primaryActorId: "a1",
          secondaryActorIds: [],
          approved: false,
          updatedAt: ORCHESTRATION_REGRESSION_NOW,
        },
      ],
    });

    const emptyOrch = initialOrchestrationStateFromDefinitions(defs, ORCHESTRATION_REGRESSION_NOW);
    const sync = syncServiceFlowToOrchestrationSlots({
      flow,
      definitions: defs,
      orchestration: emptyOrch,
      nowIso: ORCHESTRATION_REGRESSION_NOW,
    });

    expect(sync).not.toBeNull();
    expect(sync!.slotSyncMode).toBe("service_flow_apply");
    expect(sync!.progressAfter.weightedScore).toBeGreaterThan(sync!.progressBefore.weightedScore);

    const actorKey = defs.find((d) => d.slotKey.includes(".flow.actorTypes"))!.slotKey;
    const before = emptyOrch.slots[actorKey]?.status ?? "empty";
    const after = sync!.state.slots[actorKey]?.status;
    expect(before === "empty" || before === "candidate").toBe(true);
    expect(after === "partial" || after === "candidate").toBe(true);
  });

  it("confirmed planner slot is not overwritten by APPLY sync", () => {
    const flow = createSampleServiceFlow({ lastProposalDecision: "APPLY" });
    const base = initialOrchestrationStateFromDefinitions(defs, ORCHESTRATION_REGRESSION_NOW);
    const actorKey = defs.find((d) => d.slotKey.includes(".flow.actorTypes"))!.slotKey;
    base.slots[actorKey] = {
      ...base.slots[actorKey],
      status: "confirmed",
      value: "planner-confirmed",
      derivedFrom: "planner",
    };

    const sync = syncServiceFlowToOrchestrationSlots({
      flow,
      definitions: defs,
      orchestration: base,
    });

    expect(sync?.state.slots[actorKey]?.status).toBe("confirmed");
    expect(singleChatOrchestrationWeightedProgress(sync!.state).percent).toBeGreaterThanOrEqual(0);
  });
});
