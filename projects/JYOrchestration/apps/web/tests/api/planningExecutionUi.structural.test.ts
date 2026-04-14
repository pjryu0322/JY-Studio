/**
 * Structural checks for planning-execution UI fixtures (no DOM / no live API).
 */
import { describe, expect, it } from "vitest";
import { demoPlanningExecutionScreenViewModel } from "../../src/components/planningExecution/planningExecutionDemoSamples";
import type { PlanningOriginatedExecutionStatus } from "@jy-orch/application/public";

const FORBIDDEN = [
  "bundle",
  "handoff",
  "ExecutionPreparationBundle",
  "ExecutionBridgePayload",
  "screens",
  "tasks",
] as const;

function assertNoForbiddenJsonKeys(json: string): void {
  for (const k of FORBIDDEN) {
    expect(json).not.toContain(`"${k}"`);
  }
}

describe("Planning execution UI structural (demo screen)", () => {
  const statuses: PlanningOriginatedExecutionStatus[] = [
    "BLOCKED",
    "NEEDS_CONFIRMATION",
    "READY_FOR_EXECUTION",
    "EXECUTION_STARTED",
    "EXECUTION_START_FAILED",
  ];

  it.each(statuses)("status %s — action bar last, status banner present", (status) => {
    const screen = demoPlanningExecutionScreenViewModel(status);
    const v = screen.visibleSections;
    expect(v[v.length - 1]).toBe("ACTION_BAR");
    expect(v.includes("STATUS_BANNER")).toBe(true);
    expect(v.includes("INPUT_PANEL")).toBe(true);
    expect(screen.viewModel.actions.primaryAction).toBeTruthy();
    expect(screen.viewModel.actions.availableActions.length).toBeGreaterThan(0);
    assertNoForbiddenJsonKeys(JSON.stringify(screen));
  });

  it("READY exposes metrics + task sections", () => {
    const screen = demoPlanningExecutionScreenViewModel("READY_FOR_EXECUTION");
    expect(screen.visibleSections).toContain("METRICS_ROW");
    expect(screen.visibleSections).toContain("TASK_SCREEN_SUMMARY_PANEL");
    expect(screen.viewModel.counts).not.toBeNull();
    expect(screen.viewModel.counts!.taskCount).toBeGreaterThan(0);
  });

  it("BLOCKED hides metrics row", () => {
    const screen = demoPlanningExecutionScreenViewModel("BLOCKED");
    expect(screen.visibleSections).not.toContain("METRICS_ROW");
    expect(screen.viewModel.counts).toBeNull();
  });

  it("EXECUTION_STARTED provides refresh + edit path (no dead-end)", () => {
    const screen = demoPlanningExecutionScreenViewModel("EXECUTION_STARTED");
    expect(screen.viewModel.actions.availableActions).toContain("REFRESH_STATUS");
    expect(screen.viewModel.actions.availableActions).toContain("EDIT_INPUT");
  });
});
