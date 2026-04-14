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

  it.each(statuses)("status %s — input→status→action continuous flow", (status) => {
    const screen = demoPlanningExecutionScreenViewModel(status);
    const v = screen.visibleSections;
    expect(v.slice(0, 3)).toEqual(["INPUT_PANEL", "STATUS_BANNER", "ACTION_BAR"]);
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

  it("primary action intent matches each outward state", () => {
    const expected: Record<PlanningOriginatedExecutionStatus, string> = {
      BLOCKED: "EDIT_INPUT",
      NEEDS_CONFIRMATION: "REVIEW_CONFIRMATION",
      READY_FOR_EXECUTION: "START_EXECUTION",
      EXECUTION_STARTED: "VIEW_RUN_STATUS",
      EXECUTION_START_FAILED: "RETRY_EXECUTION",
    };
    for (const s of statuses) {
      const screen = demoPlanningExecutionScreenViewModel(s);
      expect(screen.viewModel.actions.primaryAction).toBe(expected[s]);
    }
  });

  it("keeps planning re-evaluation and run-status viewing distinct on EXECUTION_STARTED", () => {
    const screen = demoPlanningExecutionScreenViewModel("EXECUTION_STARTED");
    expect(screen.viewModel.actions.primaryAction).toBe("VIEW_RUN_STATUS");
    expect(screen.viewModel.actions.availableActions).toContain("REFRESH_STATUS");
  });

  it("NEEDS_CONFIRMATION includes counts + qualitative summary (no refinement bundle)", () => {
    const screen = demoPlanningExecutionScreenViewModel("NEEDS_CONFIRMATION");
    expect(screen.viewModel.confirmationNeededSummary).not.toBeNull();
    expect(screen.viewModel.confirmationNeededSummary!.confirmRequiredCount).toBeGreaterThan(0);
    expect(screen.viewModel.confirmationNeededQualitativeSummary).toBeTruthy();
    assertNoForbiddenJsonKeys(JSON.stringify(screen.viewModel));
  });

  it("status card copy is present and stable for all statuses", () => {
    const statuses: PlanningOriginatedExecutionStatus[] = [
      "BLOCKED",
      "NEEDS_CONFIRMATION",
      "READY_FOR_EXECUTION",
      "EXECUTION_STARTED",
      "EXECUTION_START_FAILED",
    ];
    for (const s of statuses) {
      const screen = demoPlanningExecutionScreenViewModel(s);
      expect(screen.viewModel.statusCard.headline).toBeTruthy();
      expect(screen.viewModel.statusCard.explanation).toBeTruthy();
      expect(screen.viewModel.statusCard.nextStepGuidance).toBeTruthy();
    }
  });
});
