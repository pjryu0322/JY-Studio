import { describe, expect, it } from "vitest";
import { selectCompletedCodeTasksForIntegration } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import { buildIntegrationEligibilitySummaryLines } from "@/lib/prototype/implementationIntegrationScopeUi";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T00:00:00.000Z";

describe("P3-M35 integration eligibility with stuck github_verifying", () => {
  const plan: ImplementationCodeTaskPlanV1 = {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    tasks: [
      {
        codeTaskId: "CT-SHELL",
        parentTaskId: "DEV-A",
        title: "화면 프레임/앱 Shell 구성",
        description: "",
        changeType: "screen",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        candidateFileHints: [],
      },
      {
        codeTaskId: "CT-MOCK",
        parentTaskId: "DEV-B",
        title: "샘플 데이터 생성",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        candidateFileHints: [],
      },
    ],
  };

  const taskList: ImplementationTaskListV1 = {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    tasks: [
      { taskId: "DEV-A", title: "A", ownerRole: "developer", priority: "P1", status: "ready", description: "" },
      { taskId: "DEV-B", title: "B", ownerRole: "developer", priority: "P1", status: "ready", description: "" },
    ],
  };

  function run(
    codeTaskId: string,
    processTaskId: string,
    status: CodeTaskExecutionRunV1["status"],
    commitSha?: string,
  ): CodeTaskExecutionRunV1 {
    return {
      version: "code_task_execution_run_v1",
      runId: `run-${codeTaskId}`,
      projectId: "p1",
      processTaskId,
      workItemId: "wi",
      codeTaskId,
      status,
      attemptNo: 1,
      createdAt: NOW,
      updatedAt: NOW,
      ...(commitSha ? { commitSha } : {}),
    };
  }

  it("canIntegrate when shell completed and mock stuck on github_verifying", () => {
    const eligibility = selectCompletedCodeTasksForIntegration({
      codeTaskPlan: plan,
      taskList,
      codeTaskRuns: [
        run("CT-SHELL", "DEV-A", "completed", "sha-shell"),
        run("CT-MOCK", "DEV-B", "github_verifying"),
      ],
    });
    expect(eligibility.canIntegrate).toBe(true);
    expect(eligibility.included.map((r) => r.codeTaskId)).toEqual(["CT-SHELL"]);
    expect(eligibility.excluded[0]?.reason).toBe("github_verifying");
    const lines = buildIntegrationEligibilitySummaryLines(eligibility);
    expect(lines[0]).toContain("완료된 CodeTask 1개");
    expect(lines[1]).toContain("실행 중이거나 미완료");
  });
});
