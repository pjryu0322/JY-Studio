import { describe, expect, it } from "vitest";
import { planningExecutionActionLabel, type PlanningExecutionStructuralAction } from "@jy-orch/application/public";

describe("planningExecutionActionLabel", () => {
  it("returns user-facing labels (not raw structural ids)", () => {
    const actions: PlanningExecutionStructuralAction[] = [
      "EDIT_INPUT",
      "REVIEW_CONFIRMATION",
      "START_EXECUTION",
      "VIEW_RUN_STATUS",
      "REFRESH_STATUS",
      "RETRY_EXECUTION",
      "INSPECT_FAILURE",
    ];

    for (const a of actions) {
      const label = planningExecutionActionLabel(a);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(a);
      expect(label).not.toMatch(/_/);
    }
  });

  it("makes REFRESH_STATUS semantics explicit (re-evaluation)", () => {
    const label = planningExecutionActionLabel("REFRESH_STATUS");
    expect(label).toContain("재평가");
  });
});

