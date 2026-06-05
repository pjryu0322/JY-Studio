import { describe, expect, it } from "vitest";
import {
  isFinalScmIntegratedStepReady,
  shouldShowIntegrationPipelineButton,
} from "@/lib/prototype/implementationIntegratedPipelineBatch";
import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";

function boardWithIntegrated(
  rows: ReadonlyArray<{ step: string; status: string }>,
): ImplementationExecutionBoardV1 {
  return {
    version: "implementation_execution_board_v1",
    projectId: "p1",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    source: "implementation_task_list_and_execution_state",
    mode: "sequential",
    taskRows: [],
    integratedRows: rows.map((row) => ({
      step: row.step as "refactor_common",
      status: row.status as "ready",
      ownerRole: "developer" as const,
      label: row.step,
      statusLabel: row.status,
    })),
    summary: {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      failedTasks: 0,
      reworkRequiredTasks: 0,
      userConfirmationRequired: 0,
      blockingUserConfirmation: 0,
      integratedCompleted: 0,
    },
  };
}

describe("shouldShowIntegrationPipelineButton", () => {
  it("shows when integration is eligible and a step is ready", () => {
    const show = shouldShowIntegrationPipelineButton({
      canIntegrate: true,
      board: boardWithIntegrated([{ step: "refactor_common", status: "ready" }]),
    });
    expect(show).toBe(true);
  });

  it("hides when all integrated steps are done", () => {
    const show = shouldShowIntegrationPipelineButton({
      canIntegrate: true,
      board: boardWithIntegrated([
        { step: "refactor_common", status: "done" },
        { step: "integrated_review", status: "done" },
        { step: "integrated_security", status: "done" },
        { step: "final_scm", status: "done" },
      ]),
    });
    expect(show).toBe(false);
  });
});

describe("isFinalScmIntegratedStepReady", () => {
  it("is true when security is done and final_scm is ready", () => {
    const ready = isFinalScmIntegratedStepReady(
      boardWithIntegrated([
        { step: "integrated_security", status: "done" },
        { step: "final_scm", status: "ready" },
      ]),
    );
    expect(ready).toBe(true);
  });
});
