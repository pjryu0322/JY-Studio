import { describe, expect, it } from "vitest";
import { selectCompletedCodeTasksForIntegration } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-03T12:00:00.000Z";

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
}

function run(overrides: Partial<CodeTaskExecutionRunV1> & Pick<CodeTaskExecutionRunV1, "codeTaskId" | "status">): CodeTaskExecutionRunV1 {
  return {
    version: "code_task_execution_run_v1",
    runId: `run-${overrides.codeTaskId}`,
    projectId: "p1",
    processTaskId: "DEV-A",
    workItemId: "wi-1",
    codeTaskId: overrides.codeTaskId,
    status: overrides.status,
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("selectCompletedCodeTasksForIntegration", () => {
  const basePlan = plan([
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
      codeTaskId: "CT-INPUT",
      parentTaskId: "DEV-A",
      title: "입력 화면 화면 구현",
      description: "input",
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
      title: "결과 화면 화면 구현",
      description: "result",
      changeType: "screen",
      acceptanceCriteria: ["ok"],
      verificationHints: [],
      forbiddenPaths: [],
      candidateFiles: [],
      candidateFileHints: [],
    },
  ]);

  it("includes completed runs with commitSha", () => {
    const result = selectCompletedCodeTasksForIntegration({
      codeTaskPlan: basePlan,
      taskList: taskList(),
      codeTaskRuns: [
        run({ codeTaskId: "CT-SHELL", status: "completed", commitSha: "sha-shell" }),
        run({ codeTaskId: "CT-INPUT", status: "completed", commitSha: "sha-input" }),
        run({ codeTaskId: "CT-PENDING", status: "prompt_ready" }),
      ],
    });
    expect(result.included.map((r) => r.codeTaskId).sort()).toEqual(["CT-INPUT", "CT-SHELL"]);
    expect(result.excluded.map((r) => r.codeTaskId)).toEqual(["CT-PENDING"]);
    expect(result.canIntegrate).toBe(true);
    expect(result.hasAppShell).toBe(true);
    expect(result.hasAnyScreenTask).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("excludes prompt_ready and cursor_running", () => {
    const result = selectCompletedCodeTasksForIntegration({
      codeTaskPlan: plan([
        {
          codeTaskId: "CT-1",
          parentTaskId: "DEV-A",
          title: "로딩 상태 공통 기능",
          description: "",
          changeType: "feature",
          acceptanceCriteria: [],
          verificationHints: [],
          forbiddenPaths: [],
          candidateFiles: [],
          candidateFileHints: [],
        },
        {
          codeTaskId: "CT-2",
          parentTaskId: "DEV-A",
          title: "입력 화면 화면 구현",
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
        run({ codeTaskId: "CT-1", status: "prompt_ready" }),
        run({ codeTaskId: "CT-2", status: "cursor_running" }),
      ],
    });
    expect(result.included).toHaveLength(0);
    expect(result.canIntegrate).toBe(false);
    expect(result.excluded[0]?.reason).toBe("prompt_ready");
    expect(result.excluded[1]?.reason).toBe("cursor_running");
  });

  it("includes when run completed with quality outcome on run", () => {
    const result = selectCompletedCodeTasksForIntegration({
      codeTaskPlan: plan([
        {
          codeTaskId: "CT-1",
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
      ]),
      taskList: taskList(),
      codeTaskRuns: [
        run({
          codeTaskId: "CT-1",
          status: "completed",
          commitSha: "sha-gate",
          qualityOutcome: { status: "passed", checkedAt: NOW },
        }),
      ],
    });
    expect(result.included).toHaveLength(1);
    expect(result.included[0]?.source).toBe("quality_gate");
  });

  it("warns when app shell missing but integration allowed", () => {
    const result = selectCompletedCodeTasksForIntegration({
      codeTaskPlan: plan([
        {
          codeTaskId: "CT-1",
          parentTaskId: "DEV-A",
          title: "입력 화면 화면 구현",
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
      codeTaskRuns: [run({ codeTaskId: "CT-1", status: "completed", commitSha: "sha-1" })],
    });
    expect(result.canIntegrate).toBe(true);
    expect(result.warnings.some((w) => w.includes("앱 Shell"))).toBe(true);
  });

  it("warns when no screen task completed", () => {
    const result = selectCompletedCodeTasksForIntegration({
      codeTaskPlan: plan([
        {
          codeTaskId: "CT-1",
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
      ]),
      taskList: taskList(),
      codeTaskRuns: [run({ codeTaskId: "CT-1", status: "completed", commitSha: "sha-1" })],
    });
    expect(result.canIntegrate).toBe(true);
    expect(result.warnings.some((w) => w.includes("화면 CodeTask"))).toBe(true);
  });
});
