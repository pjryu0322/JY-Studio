import { describe, expect, it } from "vitest";
import { deriveRuntimeFailureActions, normalizePlanningExecutionActions } from "../../src/components/planningExecution/planningExecutionActionModel";

describe("planning execution action model normalization", () => {
  it("dedupes available actions and keeps primary/secondary ordered", () => {
    const n = normalizePlanningExecutionActions({
      primaryAction: "VIEW_RUN_STATUS",
      secondaryAction: "VIEW_RUN_STATUS",
      availableActions: ["VIEW_RUN_STATUS", "REFRESH_STATUS", "REFRESH_STATUS", "EDIT_INPUT"],
    });
    expect(n.primaryAction).toBe("VIEW_RUN_STATUS");
    expect(n.secondaryAction).toBeNull();
    expect(n.availableActions[0]).toBe("VIEW_RUN_STATUS");
    expect(n.availableActions).toEqual(["VIEW_RUN_STATUS", "REFRESH_STATUS", "EDIT_INPUT"]);
  });

  it("uses contract flags to prefer inspect/retry on runtime failure", () => {
    const base = normalizePlanningExecutionActions({
      primaryAction: "VIEW_RUN_STATUS",
      secondaryAction: "REFRESH_STATUS",
      availableActions: ["VIEW_RUN_STATUS", "REFRESH_STATUS", "EDIT_INPUT"],
    });
    const a = deriveRuntimeFailureActions({ baseActions: base, canInspect: true, canRetry: true });
    expect(a.primaryAction).toBe("INSPECT_FAILURE");
    expect(a.secondaryAction).toBe("RETRY_EXECUTION");
    expect(a.availableActions).toContain("INSPECT_FAILURE");
    expect(a.availableActions).toContain("RETRY_EXECUTION");
  });
});

