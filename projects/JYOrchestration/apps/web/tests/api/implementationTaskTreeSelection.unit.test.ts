import { describe, expect, it } from "vitest";
import type { ImplementationExecutionBoardTaskRowV1 } from "@/lib/prototype/implementationExecutionBoard";
import {
  collectAncestorTaskIds,
  computeTaskTreeDependencyViews,
  isTaskTreeFullySelected,
  orderTaskRowsForTreeDisplay,
  resolveTaskTreeSelectionToggle,
} from "@/lib/prototype/implementationTaskTreeSelection";

function row(
  taskId: string,
  dependencies: readonly string[] = [],
): ImplementationExecutionBoardTaskRowV1 {
  return {
    taskId,
    title: taskId,
    priority: "P1",
    dependencies,
    currentRole: "developer",
    developerStatus: "ready",
    reviewerStatus: "not_started",
    securityStatus: "not_started",
    scmStatus: "not_started",
    reviewerResultStatus: "none",
    securityResultStatus: "none",
    qualityGateFailedTaskIds: [],
    userConfirmation: "none",
    failureReason: "none",
    reworkCount: 0,
    canContinueWithoutUserConfirmation: true,
    statusLabel: "ready",
  };
}

describe("implementationTaskTreeSelection", () => {
  const taskRows = [
    row("DEV-1"),
    row("DEV-2", ["DEV-1"]),
    row("DEV-3", ["DEV-2"]),
  ];

  it("checks only the toggled task (no ancestor auto-select)", () => {
    expect(
      resolveTaskTreeSelectionToggle({
        taskId: "DEV-3",
        checked: true,
        selectedTaskIds: [],
        taskRows,
      }),
    ).toEqual(["DEV-3"]);
  });

  it("preserves input order for tree display", () => {
    const shuffled = [row("DEV-3", ["DEV-2"]), row("DEV-1"), row("DEV-2", ["DEV-1"])];
    expect(orderTaskRowsForTreeDisplay(shuffled).map((item) => item.taskId)).toEqual([
      "DEV-3",
      "DEV-1",
      "DEV-2",
    ]);
  });

  it("uses flat depth (dependency layout disabled)", () => {
    const views = computeTaskTreeDependencyViews(taskRows);
    expect(views.get("DEV-3")).toEqual({
      depth: 0,
      parentTaskIds: [],
      parentLabels: [],
    });
    expect(collectAncestorTaskIds("DEV-3", taskRows)).toEqual([]);
  });

  it("detects full selection", () => {
    expect(
      isTaskTreeFullySelected({
        selectedTaskIds: ["DEV-1", "DEV-2", "DEV-3"],
        taskRows,
      }),
    ).toBe(true);
    expect(
      isTaskTreeFullySelected({
        selectedTaskIds: ["DEV-1"],
        taskRows,
      }),
    ).toBe(false);
  });
});
