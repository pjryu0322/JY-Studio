import { describe, expect, it } from "vitest";
import { computeStrictIntegrationCanIntegrate } from "@/lib/prototype/implementationIntegrationGate";
import { selectCompletedCodeTasksForIntegration } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-03T12:00:00.000Z";

describe("computeStrictIntegrationCanIntegrate", () => {
  it("requires all tasks included", () => {
    expect(
      computeStrictIntegrationCanIntegrate({ totalCount: 15, includedCount: 15, excludedCount: 0 }),
    ).toBe(true);
    expect(
      computeStrictIntegrationCanIntegrate({ totalCount: 15, includedCount: 14, excludedCount: 1 }),
    ).toBe(false);
    expect(
      computeStrictIntegrationCanIntegrate({ totalCount: 0, includedCount: 0, excludedCount: 0 }),
    ).toBe(false);
  });
});

describe("selectCompletedCodeTasksForIntegration strict gate", () => {
  function plan(tasks: ImplementationCodeTaskPlanV1["tasks"]): ImplementationCodeTaskPlanV1 {
    return {
      version: "implementation_code_task_plan_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      tasks,
    };
  }

  function taskList(): ImplementationTaskListV1 {
    return {
      version: "implementation_task_list_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      tasks: [{ taskId: "DEV-A", title: "A", ownerRole: "developer", priority: "P1", status: "ready", description: "" }],
    };
  }

  function run(codeTaskId: string, status: CodeTaskExecutionRunV1["status"], commitSha?: string): CodeTaskExecutionRunV1 {
    return {
      version: "code_task_execution_run_v1",
      runId: `run-${codeTaskId}`,
      projectId: "p1",
      processTaskId: "DEV-A",
      workItemId: "wi",
      codeTaskId,
      status,
      attemptNo: 1,
      createdAt: NOW,
      updatedAt: NOW,
      ...(commitSha ? { commitSha } : {}),
    };
  }

  it("canIntegrate when every plan task has merge-ready run", () => {
    const result = selectCompletedCodeTasksForIntegration({
      codeTaskPlan: plan([
        {
          codeTaskId: "CT-1",
          parentTaskId: "DEV-A",
          title: "Shell",
          description: "",
          changeType: "screen",
          acceptanceCriteria: [],
          verificationHints: [],
          forbiddenPaths: [],
          candidateFiles: [],
          candidateFileHints: [],
        },
        {
          codeTaskId: "CT-2",
          parentTaskId: "DEV-A",
          title: "Input",
          description: "",
          changeType: "screen",
          acceptanceCriteria: [],
          verificationHints: [],
          forbiddenPaths: [],
          candidateFiles: [],
          candidateFileHints: [],
        },
      ]),
      taskList: taskList(),
      codeTaskRuns: [
        run("CT-1", "completed", "sha-1"),
        run("CT-2", "completed", "sha-2"),
      ],
    });
    expect(result.canIntegrate).toBe(true);
    expect(result.excluded).toHaveLength(0);
  });
});
