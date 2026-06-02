import { describe, expect, it } from "vitest";
import { buildCodeTaskCursorExecutionRequest } from "@/lib/prototype/codeTaskExecutionRequest";
import {
  buildCodeTaskRunUserStatus,
  buildCodeTaskStatusCheckUserMessage,
  CODE_TASK_IN_FLIGHT_USER_MESSAGE,
} from "@/lib/prototype/codeTaskExecutionRunView";
import {
  formatCodeTaskExecutionQueueCompletionDetail,
  summarizeCodeTaskExecutionQueueRuns,
} from "@/lib/prototype/codeTaskExecutionRunUi";
import {
  isSelectedCodeTaskRunInFlight,
  prepareSelectedCodeTaskCursorExecution,
} from "@/lib/prototype/selectedCodeTaskCursorExecution";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const NOW = "2026-06-01T12:00:00.000Z";

function sampleRun(overrides: Partial<CodeTaskExecutionRunV1> = {}): CodeTaskExecutionRunV1 {
  return {
    version: "code_task_execution_run_v1",
    runId: "run-1",
    projectId: "p1",
    processTaskId: "DEV-A",
    workItemId: "wi-1",
    codeTaskId: "CT-1",
    status: "queued",
    attemptNo: 1,
    developerPrompt: "prompt",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function samplePlan(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    tasks: [
      {
        codeTaskId: "CT-1",
        parentTaskId: "DEV-A",
        title: "로딩 상태 공통 기능 구현",
        description: "desc",
        changeType: "feature",
        acceptanceCriteria: ["ok"],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        candidateFileHints: [],
      },
    ],
  };
}

describe("buildCodeTaskCursorExecutionRequest", () => {
  it("includes codeTaskId in request body", () => {
    const built = buildCodeTaskCursorExecutionRequest({
      projectId: "p1",
      run: sampleRun(),
      codeTask: samplePlan().tasks[0]!,
      workItem: {
        id: "wi-1",
        taskId: "DEV-A",
        codeTaskId: "CT-1",
        role: "developer",
        title: "t",
        status: "ready",
        requiredFilesHint: [],
      },
      targetRepository: {
        repoFullName: "org/repo",
        defaultBranch: "main",
        provider: "github",
      },
      baseBranch: "main",
    });
    expect(built.requestBody.codeTaskId).toBe("CT-1");
    expect(built.requestBody.taskId).toBe("DEV-A");
    expect(built.requestBody.selectedWorkItemIds).toEqual(["wi-1"]);
  });
});

describe("buildCodeTaskRunUserStatus", () => {
  it.each([
    ["queued", "대기"],
    ["cursor_running", "Cursor 작업 중"],
    ["github_verifying", "GitHub 결과 확인 중"],
    ["completed", "완료"],
    ["no_code_change_completed", "변경 없음"],
    ["rework_required", "재작업 필요"],
    ["status_check_stopped", "상태 확인 중단"],
    ["failed", "실패"],
  ] as const)("maps %s to %s", (status, label) => {
    expect(buildCodeTaskRunUserStatus(sampleRun({ status })).label).toBe(label);
  });
});

describe("buildCodeTaskStatusCheckUserMessage", () => {
  it("does not expose runId, agent, polling, or TaskCursor", () => {
    const message = buildCodeTaskStatusCheckUserMessage({
      codeTaskTitle: "로딩 상태 공통 기능 구현",
      codeTaskId: "CT-1",
      run: sampleRun({ status: "cursor_running" }),
      elapsedMinutes: 12,
    });
    expect(message).toContain("CodeTask:");
    expect(message).toContain("Cursor 작업 중");
    expect(message).not.toMatch(/runId/i);
    expect(message).not.toMatch(/agent/i);
    expect(message).not.toMatch(/polling/i);
    expect(message).not.toMatch(/TaskCursor/i);
  });
});

describe("prepareSelectedCodeTaskCursorExecution", () => {
  it("treats queued run as dispatchable (not in-flight)", () => {
    expect(isSelectedCodeTaskRunInFlight(sampleRun({ status: "queued" }))).toBe(false);
    expect(isSelectedCodeTaskRunInFlight(sampleRun({ status: "cursor_running" }))).toBe(true);
  });

  it("blocks in-flight run without runId in message", () => {
    const result = prepareSelectedCodeTaskCursorExecution({
      projectId: "p1",
      queueDispatch: { codeTaskId: "CT-1", parentTaskId: "DEV-A", workItemId: "wi-1" },
      runs: [sampleRun({ status: "cursor_running" })],
      codeTaskPlan: samplePlan(),
      cursorWorkItems: [
        {
          id: "wi-1",
          taskId: "DEV-A",
          codeTaskId: "CT-1",
          role: "developer",
          title: "t",
          status: "ready",
        },
      ],
      targetRepository: {
        repoFullName: "org/repo",
        defaultBranch: "main",
        provider: "github",
      },
      baseBranch: "main",
      allowedPathGlobs: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBe(CODE_TASK_IN_FLIGHT_USER_MESSAGE);
    expect(result.message).not.toMatch(/runId/i);
  });

  it("blocks cursor dispatch when codeTask dependency is not ready", () => {
    const plan = samplePlan();
    const blockedPlan = {
      ...plan,
      tasks: [
        ...plan.tasks,
        {
          codeTaskId: "CT-2",
          parentTaskId: "DEV-A",
          title: "Second",
          description: "",
          changeType: "feature" as const,
          acceptanceCriteria: [],
          verificationHints: [],
          forbiddenPaths: [],
          candidateFiles: [],
          codeTaskDependencies: ["CT-1"],
        },
      ],
    };
    const result = prepareSelectedCodeTaskCursorExecution({
      projectId: "p1",
      queueDispatch: { codeTaskId: "CT-2", parentTaskId: "DEV-A", workItemId: "wi-2" },
      runs: [
        sampleRun({ codeTaskId: "CT-2", status: "queued" }),
      ],
      codeTaskPlan: blockedPlan,
      cursorWorkItems: [
        {
          id: "wi-2",
          taskId: "DEV-A",
          codeTaskId: "CT-2",
          role: "developer",
          title: "t",
          status: "ready",
        },
      ],
      targetRepository: {
        repoFullName: "org/repo",
        defaultBranch: "main",
        provider: "github",
      },
      baseBranch: "main",
      allowedPathGlobs: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outcome).toBe("blocked");
    expect(result.message).toContain("로딩 상태 공통 기능 구현");
  });
});

describe("queue completion summary", () => {
  it("shows breakdown counts for completed_with_issues", () => {
    const runs = [
      sampleRun({ codeTaskId: "CT-1", status: "completed" }),
      sampleRun({ codeTaskId: "CT-2", runId: "run-2", status: "no_code_change_completed" }),
      sampleRun({ codeTaskId: "CT-3", runId: "run-3", status: "rework_required" }),
      sampleRun({ codeTaskId: "CT-4", runId: "run-4", status: "status_check_stopped" }),
      sampleRun({ codeTaskId: "CT-5", runId: "run-5", status: "failed" }),
    ];
    const summary = summarizeCodeTaskExecutionQueueRuns({
      runs,
      selectedCodeTaskIds: ["CT-1", "CT-2", "CT-3", "CT-4", "CT-5"],
    });
    expect(summary.completed).toBe(1);
    expect(summary.noCodeChange).toBe(1);
    expect(summary.reworkRequired).toBe(1);
    expect(summary.statusCheckStopped).toBe(1);
    expect(summary.failed).toBe(1);
    const detail = formatCodeTaskExecutionQueueCompletionDetail({
      runSummary: summary,
      codeTaskPlan: samplePlan(),
      runs,
      selectedCodeTaskIds: ["CT-1", "CT-2", "CT-3", "CT-4", "CT-5"],
    });
    expect(detail).toContain("완료: 1개");
    expect(detail).toContain("변경 없음: 1개");
    expect(detail).toContain("재작업 필요: 1개");
    expect(detail).toContain("상태 확인 중단: 1개");
    expect(detail).toContain("실패: 1개");
  });
});
