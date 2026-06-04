import { describe, expect, it } from "vitest";
import { startCodeTaskExecutionQueue } from "@/lib/prototype/codeTaskExecutionQueue";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { resolveQuickRunStuckGithubVerifyTarget } from "@/lib/prototype/implementationQuickRunStuckGithubRecovery";
import type { ImplementationQuickRunV1 } from "@/lib/prototype/implementationQuickRun";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const NOW = "2026-06-04T00:00:00.000Z";

const plan: ImplementationCodeTaskPlanV1 = {
  version: "implementation_code_task_plan_v1",
  projectId: "p1",
  codeTaskCount: 1,
  tasks: [
    {
      codeTaskId: "CODE-DEV-FRAME-001-001",
      parentTaskId: "DEV-FRAME-001",
      title: "frame",
      description: "d",
      acceptanceCriteria: [],
      dependencies: [],
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const quickRun: ImplementationQuickRunV1 = {
  version: "implementation_quick_run_v1",
  projectId: "p1",
  status: "running",
  startedAt: NOW,
  updatedAt: NOW,
};

describe("resolveQuickRunStuckGithubVerifyTarget", () => {
  it("returns history execution when branch exists but run has no commit", () => {
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-DEV-FRAME-001-001"],
      nowIso: NOW,
    });
    const runs: CodeTaskExecutionRunV1[] = [
      {
        runId: "r1",
        projectId: "p1",
        processTaskId: "DEV-FRAME-001",
        workItemId: "w1",
        codeTaskId: "CODE-DEV-FRAME-001-001",
        status: "cursor_running",
        cursorRunId: "bc-agent",
        workBranch: "wip/cursor/dev-frame-001",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];
    const history = [
      {
        projectId: "p1",
        taskId: "DEV-FRAME-001",
        status: "cursor_running",
        cursorRunId: "bc-agent",
        workBranch: "wip/cursor/dev-frame-001",
      } as TaskCursorExecutionV1,
    ];
    const target = resolveQuickRunStuckGithubVerifyTarget({
      projectId: "p1",
      quickRun,
      queue,
      runs,
      codeTaskPlan: plan,
      taskCursorExecution: {
        projectId: "p1",
        taskId: "DEV-OTHER",
        status: "cursor_running",
      } as TaskCursorExecutionV1,
      taskCursorExecutionHistory: history,
    });
    expect(target?.taskId).toBe("DEV-FRAME-001");
    expect(target?.workBranch).toBe("wip/cursor/dev-frame-001");
  });
});
