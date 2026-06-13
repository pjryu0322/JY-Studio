import { describe, expect, it, vi } from "vitest";
import {
  resolveImplementationStageActionCodeTaskIds,
  routeImplementationStageControlPlaneAction,
} from "@/lib/prototype/implementationStageActionControlPlaneRouting";

describe("implementationStageActionControlPlaneRouting", () => {
  it("prefers control plane snapshot codeTaskIds", () => {
    const ids = resolveImplementationStageActionCodeTaskIds({
      implementationControlPlaneSnapshot: {
        action: { codeTaskIds: ["A"], primaryAction: "execute_selected_runnable_codetasks" },
        board: { runnableCodeTaskIds: ["B", "C"] },
      } as never,
      selectedCodeTaskIdsFromOptions: ["D"],
      selectedRunnableFromBridge: ["E"],
      allRunnableFromSnapshot: ["B", "C"],
    });
    expect(ids).toEqual(["A"]);
  });

  it("routes execute to executeCodeTasks adapter", async () => {
    const executeCodeTasks = vi.fn(async () => ({ outcome: "executed" as const }));
    const result = await routeImplementationStageControlPlaneAction({
      action: "execute_selected_runnable_codetasks",
      codeTaskIds: ["task-1"],
      startImplementationQuickRun: vi.fn(),
      runIntegrationPipeline: vi.fn(),
      openPreview: vi.fn(),
      executeCodeTasks,
      appendUserNotice: vi.fn(),
    });
    expect(result.outcome).toBe("executed");
    expect(executeCodeTasks).toHaveBeenCalledWith({
      codeTaskIds: ["task-1"],
      source: "stage_action_controller",
    });
  });
});
