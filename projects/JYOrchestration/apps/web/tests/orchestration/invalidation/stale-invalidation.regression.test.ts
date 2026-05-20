import { describe, expect, it } from "vitest";
import {
  applyOrchestrationInvalidationsAfterFlowChange,
  buildServiceFlowStructureFingerprint,
} from "@/lib/requirements/requirementsOrchestrationInvalidation";
import {
  createDefaultSlotDefinitions,
  createSampleServiceFlow,
  ORCHESTRATION_REGRESSION_NOW,
} from "../helpers/orchestrationRegressionHarness";
import {
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { SERVICE_FLOW_SYNC_DERIVED_FROM } from "@/lib/requirements/serviceFlowOrchestrationSync";

describe("orchestration regression — stale / invalidation", () => {
  const defs = createDefaultSlotDefinitions();

  it("approved flow structure change downgrades confirmed sync slots to partial", () => {
    const base = initialOrchestrationStateFromDefinitions(defs, ORCHESTRATION_REGRESSION_NOW);
    const slotKey =
      Object.keys(base.slots).find((k) => k.includes("flow")) ?? Object.keys(base.slots)[0]!;
    base.slots[slotKey] = {
      ...base.slots[slotKey],
      status: "confirmed",
      value: "confirmed-by-sync-value-long-enough",
      derivedFrom: SERVICE_FLOW_SYNC_DERIVED_FROM,
    };

    const flow1 = createSampleServiceFlow({ flowApproved: true });
    const flow2 = {
      ...flow1,
      actors: [
        ...flow1.actors,
        { id: "a3", name: "Auditor", kind: "human" as const, description: "" },
      ],
    };

    const inv = applyOrchestrationInvalidationsAfterFlowChange({
      orchestration: base,
      definitions: defs,
      previousFingerprint: buildServiceFlowStructureFingerprint(flow1),
      currentFingerprint: buildServiceFlowStructureFingerprint(flow2),
      flowApproved: true,
    });

    expect(inv).not.toBeNull();
    expect(inv!.staleTriggered).toBe(false);
    expect(inv!.invalidations.some((x) => x.includes("DOWNGRADE_TO_PARTIAL"))).toBe(true);
    expect(inv!.state.slots[slotKey].status).toBe("partial");
  });

  it("structural fingerprint change marks sync-derived slots stale when not approved-confirmed path", () => {
    const base = initialOrchestrationStateFromDefinitions(defs, ORCHESTRATION_REGRESSION_NOW);
    const slotKey =
      Object.keys(base.slots).find((k) => k.includes(".flow.")) ?? Object.keys(base.slots)[0]!;
    base.slots[slotKey] = {
      ...base.slots[slotKey],
      status: "partial",
      value: "partial-value",
      derivedFrom: SERVICE_FLOW_SYNC_DERIVED_FROM,
    };

    const flow1 = createSampleServiceFlow();
    const flow2 = {
      ...flow1,
      steps: [
        ...flow1.steps,
        {
          id: "s3",
          title: "Extra",
          purpose: "p",
          order: 3,
          primaryActorId: "a2",
          secondaryActorIds: [],
          approved: false,
          updatedAt: ORCHESTRATION_REGRESSION_NOW,
        },
      ],
    };

    const inv = applyOrchestrationInvalidationsAfterFlowChange({
      orchestration: base,
      definitions: defs,
      previousFingerprint: buildServiceFlowStructureFingerprint(flow1),
      currentFingerprint: buildServiceFlowStructureFingerprint(flow2),
      flowApproved: false,
    });

    expect(inv?.staleTriggered).toBe(true);
    expect(inv?.state.slots[slotKey].status).toBe("stale");
  });
});
