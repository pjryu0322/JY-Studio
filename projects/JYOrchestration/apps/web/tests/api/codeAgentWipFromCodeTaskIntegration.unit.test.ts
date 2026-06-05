import { describe, expect, it } from "vitest";
import { resolveCodeAgentWipForFinalScmIntegratedStage } from "@/lib/prototype/codeAgentWipFromCodeTaskIntegration";
import { isRealCursorSourceGenerationCompleted } from "@/lib/prototype/codeAgentWipExecution";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

describe("resolveCodeAgentWipForFinalScmIntegratedStage", () => {
  it("synthesizes wip from completed code task runs when legacy wip is missing", () => {
    const runs: CodeTaskExecutionRunV1[] = [
      {
        runId: "run-1",
        projectId: "p1",
        processTaskId: "DEV-SCREEN-002",
        workItemId: "wi-1",
        codeTaskId: "CODE-DEV-SCREEN-002-001",
        status: "completed",
        commitSha: "abc123def",
        workBranch: "wip/cursor/code-dev-screen-002-001",
        changedFiles: ["apps/web/src/page.tsx"],
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:00.000Z",
      },
    ];
    const execution = {
      projectId: "p1",
      taskId: "DEV-SCREEN-002",
      status: "scm_pending",
      commitSha: "abc123def",
      workBranch: "wip/cursor/code-dev-screen-002-001",
      workItemIds: ["wi-1"],
      targetRepository: "acme/repo",
      baseBranch: "main",
      changedFiles: ["apps/web/src/page.tsx"],
    } as TaskCursorExecutionV1;

    const resolved = resolveCodeAgentWipForFinalScmIntegratedStage({
      projectId: "p1",
      existingWip: null,
      taskList: {
        version: "implementation_task_list_v1",
        projectId: "p1",
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:00.000Z",
        tasks: [{ id: "DEV-SCREEN-002", title: "결과 화면", status: "active" }],
      },
      codeTaskPlan: {
        version: "implementation_code_task_plan_v1",
        projectId: "p1",
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:00.000Z",
        tasks: [
          {
            codeTaskId: "CODE-DEV-SCREEN-002-001",
            parentTaskId: "DEV-SCREEN-002",
            title: "화면 구현",
            order: 1,
          },
        ],
      },
      codeTaskRuns: runs,
      taskCursorExecution: execution,
      executionSetup: {
        gitRepoUrl: "https://github.com/acme/repo",
        gitRepoName: "acme/repo",
        baseBranch: "main",
      },
      autoQualityGate: {
        version: "implementation_auto_quality_gate_v1",
        projectId: "p1",
        taskId: "DEV-SCREEN-002",
        status: "passed",
        sourceCommitSha: "abc123def",
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:00.000Z",
      },
    });

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.synthesized).toBe(true);
    expect(isRealCursorSourceGenerationCompleted(resolved.wip)).toBe(true);
    expect(resolved.wip.commitSha).toBe("abc123def");
  });
});
