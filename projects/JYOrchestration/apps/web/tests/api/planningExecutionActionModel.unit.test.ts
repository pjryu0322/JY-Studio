import { describe, expect, it } from "vitest";
import {
  normalizePlanningExecutionActions,
  resolvePlanningExecutionActionBarActions,
  resolvePlanningExecutionPrimaryAction,
} from "../../src/components/planningExecution/planningExecutionActionModel";

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
    const a = resolvePlanningExecutionPrimaryAction({
      responseStatus: "EXECUTION_STARTED",
      baseActions: base,
      runStatus: { status: "FAILED", canInspect: true, canRetry: true },
    });
    expect(a.primaryAction).toBe("INSPECT_FAILURE");
    expect(a.secondaryAction).toBe("RETRY_EXECUTION");
    expect(a.availableActions).toContain("INSPECT_FAILURE");
    expect(a.availableActions).toContain("RETRY_EXECUTION");
  });

  it("removes VIEW_RUN_STATUS from global actions once run-status is present", () => {
    const base = normalizePlanningExecutionActions({
      primaryAction: "VIEW_RUN_STATUS",
      secondaryAction: "REFRESH_STATUS",
      availableActions: ["VIEW_RUN_STATUS", "REFRESH_STATUS", "EDIT_INPUT"],
    });
    const a = resolvePlanningExecutionPrimaryAction({
      responseStatus: "EXECUTION_STARTED",
      baseActions: base,
      runStatus: { status: "RUNNING", canInspect: true, canRetry: false },
    });
    expect(a.availableActions).not.toContain("VIEW_RUN_STATUS");
    expect(a.primaryAction).toBe("EDIT_INPUT");
    expect(a.availableActions).toContain("REFRESH_STATUS");
  });

  it("ActionBar stays flow-only (no VIEW_RUN_STATUS / no REFRESH_STATUS)", () => {
    const base = normalizePlanningExecutionActions({
      primaryAction: "VIEW_RUN_STATUS",
      secondaryAction: "REFRESH_STATUS",
      availableActions: ["VIEW_RUN_STATUS", "REFRESH_STATUS", "EDIT_INPUT", "START_EXECUTION"],
    });
    const a = resolvePlanningExecutionActionBarActions({
      responseStatus: "EXECUTION_STARTED",
      baseActions: base,
      runStatus: { status: "RUNNING", canInspect: true, canRetry: false },
    });
    expect(a.availableActions).not.toContain("VIEW_RUN_STATUS");
    expect(a.availableActions).not.toContain("REFRESH_STATUS");
    expect(a.availableActions).toEqual(["EDIT_INPUT", "START_EXECUTION"]);
  });
});

