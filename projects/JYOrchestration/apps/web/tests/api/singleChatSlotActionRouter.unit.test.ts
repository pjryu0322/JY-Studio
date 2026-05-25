import { describe, expect, it } from "vitest";
import { routeSingleChatSlotAction } from "@/lib/requirements/singleChatSlotActionRouter";
import { initialOrchestrationStateFromDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import { SLOT_ACTION_DEFAULT_LABEL, slotActionWire } from "@/lib/requirements/singleChatSlotActionTypes";
import { createDefaultSlotDefinitions, ORCHESTRATION_REGRESSION_NOW } from "../orchestration/helpers/orchestrationRegressionHarness";

describe("singleChatSlotActionRouter", () => {
  const definitions = createDefaultSlotDefinitions();
  const orchestration = initialOrchestrationStateFromDefinitions(definitions, ORCHESTRATION_REGRESSION_NOW);

  it("routes CONFIRM_PLANNING_CORE as slot action in Project SingleChat", () => {
    const route = routeSingleChatSlotAction({
      executionScope: "project_single_chat",
      slotAction: slotActionWire({
        id: "CONFIRM_PLANNING_CORE",
        label: SLOT_ACTION_DEFAULT_LABEL.CONFIRM_PLANNING_CORE,
        focusArea: "planning",
        ownerAgent: "planner",
        definitions,
      }),
      orchestration,
      definitions,
    });

    expect(route.shouldRunSlotAction).toBe(true);
    expect(route.focusArea).toBe("planning");
    expect(route.ownerAgent).toBe("planner");
  });

  it("does not fall into general_advice no-op for 서비스 정의 핵심 정리 label", () => {
    const route = routeSingleChatSlotAction({
      executionScope: "project_single_chat",
      directSlotActionId: "CONFIRM_PLANNING_CORE",
      quickActionLabel: SLOT_ACTION_DEFAULT_LABEL.CONFIRM_PLANNING_CORE,
      orchestration,
      definitions,
    });

    expect(route.shouldRunSlotAction).toBe(true);
    expect(route.slotActionId).toBe("CONFIRM_PLANNING_CORE");
  });
});
