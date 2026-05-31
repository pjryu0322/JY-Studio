import { describe, expect, it } from "vitest";
import type { ImplementationExecutionBoardTaskRowV1 } from "@/lib/prototype/implementationExecutionBoard";
import {
  collectAncestorTaskIds,
  computeTaskTreeDependencyViews,
  formatTaskTreeDependencyLabel,
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

  it("auto-selects ancestor tasks when checking a child", () => {
    expect(
      resolveTaskTreeSelectionToggle({
        taskId: "DEV-3",
        checked: true,
        selectedTaskIds: [],
        taskRows,
      }),
    ).toEqual(["DEV-1", "DEV-2", "DEV-3"]);
  });

  it("orders task rows with parents before children", () => {
    const shuffled = [row("DEV-3", ["DEV-2"]), row("DEV-1"), row("DEV-2", ["DEV-1"])];
    expect(orderTaskRowsForTreeDisplay(shuffled).map((item) => item.taskId)).toEqual([
      "DEV-1",
      "DEV-2",
      "DEV-3",
    ]);
  });

  it("builds dependency labels and depth", () => {
    const views = computeTaskTreeDependencyViews(taskRows);
    expect(views.get("DEV-3")).toEqual({
      depth: 2,
      parentTaskIds: ["DEV-2"],
      parentLabels: ["DEV-2 DEV-2"],
    });
    expect(formatTaskTreeDependencyLabel(views.get("DEV-3"))).toBe("선행: DEV-2 DEV-2");
    expect(collectAncestorTaskIds("DEV-3", taskRows)).toEqual(["DEV-1", "DEV-2"]);
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
