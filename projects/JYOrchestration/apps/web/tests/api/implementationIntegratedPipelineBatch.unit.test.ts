import { describe, expect, it } from "vitest";
import {
  applyIntegratedPipelineSyncSteps,
  isFinalScmIntegratedStepReady,
  shouldShowIntegrationPipelineButton,
} from "@/lib/prototype/implementationIntegratedPipelineBatch";
import type { ImplementationExecutionBoardV1 } from "@/lib/prototype/implementationExecutionBoard";
import { buildInitialImplementationIntegratedExecutionState } from "@/lib/prototype/implementationIntegratedExecutionState";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T00:00:00.000Z";

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

function integrationOrchestrationFixture(): {
  readonly taskList: ImplementationTaskListV1;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly codeTaskRuns: readonly CodeTaskExecutionRunV1[];
} {
  const taskList: ImplementationTaskListV1 = {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    tasks: [
      {
        taskId: "DEV-A",
        title: "개발 A",
        ownerRole: "developer",
        priority: "P1",
        status: "ready",
        description: "desc",
      },
    ],
  };
  const codeTaskPlan: ImplementationCodeTaskPlanV1 = {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    tasks: [
      {
        codeTaskId: "CT-SHELL",
        parentTaskId: "DEV-A",
        title: "화면 프레임/앱 Shell 구성",
        description: "shell",
        changeType: "screen",
        acceptanceCriteria: ["ok"],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        candidateFileHints: [],
      },
      {
        codeTaskId: "CT-PENDING",
        parentTaskId: "DEV-A",
        title: "결과 화면",
        description: "result",
        changeType: "screen",
        acceptanceCriteria: ["ok"],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        candidateFileHints: [],
      },
    ],
  };
  const codeTaskRuns: CodeTaskExecutionRunV1[] = [
    {
      version: "code_task_execution_run_v1",
      runId: "run-shell",
      projectId: "p1",
      processTaskId: "DEV-A",
      workItemId: "wi-1",
      codeTaskId: "CT-SHELL",
      status: "completed",
      attemptNo: 1,
      createdAt: NOW,
      updatedAt: NOW,
      commitSha: "sha-shell",
    },
    {
      version: "code_task_execution_run_v1",
      runId: "run-pending",
      projectId: "p1",
      processTaskId: "DEV-A",
      workItemId: "wi-2",
      codeTaskId: "CT-PENDING",
      status: "prompt_ready",
      attemptNo: 1,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];
  return { taskList, codeTaskPlan, codeTaskRuns };
}

describe("applyIntegratedPipelineSyncSteps preview wiring", () => {
  it("builds preview runtime after sync steps without final_scm", () => {
    const { taskList, codeTaskPlan, codeTaskRuns } = integrationOrchestrationFixture();
    const batch = applyIntegratedPipelineSyncSteps({
      projectId: "p1",
      orchestration: {
        implementationTaskListV1: taskList,
        implementationCodeTaskPlanV1: codeTaskPlan,
        codeTaskExecutionRunsV1: codeTaskRuns,
        implementationIntegratedExecutionStateV1: buildInitialImplementationIntegratedExecutionState({
          projectId: "p1",
          nowIso: NOW,
        }),
      },
      nowIso: NOW,
    });
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;
    expect(batch.previewBuildOk).toBe(true);
    expect(batch.previewRuntime?.status).toBe("ready");
    expect(batch.previewRuntime?.renderMode).toBe("generated_app_iframe");
    expect(batch.previewRuntime?.appPreviewUrl).toContain("/preview/app");
    expect(batch.previewUrl).toContain("/preview");
    expect(batch.completedSteps).toEqual([
      "refactor_common",
      "integrated_review",
      "integrated_security",
    ]);
    const finalScm = batch.integratedState.items.find((item) => item.step === "final_scm");
    expect(finalScm?.status).not.toBe("done");
  });
});
