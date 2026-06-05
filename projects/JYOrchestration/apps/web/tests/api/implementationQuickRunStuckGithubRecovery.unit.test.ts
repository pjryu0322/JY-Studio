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
    const launched = new Date(Date.now() - 120_000).toISOString();
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-DEV-FRAME-001-001"],
      nowIso: launched,
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
        createdAt: launched,
        updatedAt: launched,
      },
    ];
    const history = [
      {
        projectId: "p1",
        taskId: "DEV-FRAME-001",
        status: "cursor_completed",
        cursorRunId: "bc-agent",
        workBranch: "wip/cursor/dev-frame-001",
      } as TaskCursorExecutionV1,
    ];
    const target = resolveQuickRunStuckGithubVerifyTarget({
      projectId: "p1",
      quickRun: { ...quickRun, startedAt: launched },
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

  it("allows github verify when cursor_running >1m and GitHub branch exists", () => {
    const launched = new Date(Date.now() - 120_000).toISOString();
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-DEV-FRAME-001-001"],
      nowIso: launched,
    });
    const runs: CodeTaskExecutionRunV1[] = [
      {
        runId: "r1",
        projectId: "p1",
        processTaskId: "DEV-FRAME-001",
        workItemId: "w1",
        codeTaskId: "CODE-DEV-FRAME-001-001",
        status: "cursor_running",
        cursorRunId: "bc-49cadb9f-e6fe-4b08-8f52-85e4642eeda9",
        workBranch: "wip/cursor/code-dev-frame-001-001",
        createdAt: launched,
        updatedAt: new Date().toISOString(),
      } as CodeTaskExecutionRunV1,
    ];
    const target = resolveQuickRunStuckGithubVerifyTarget({
      projectId: "p1",
      quickRun: { ...quickRun, startedAt: launched },
      queue,
      runs,
      codeTaskPlan: plan,
      taskCursorExecution: {
        projectId: "p1",
        taskId: "DEV-FRAME-001",
        status: "cursor_running",
        cursorRunId: "bc-49cadb9f-e6fe-4b08-8f52-85e4642eeda9",
        workBranch: "wip/cursor/code-dev-frame-001-001",
        createdAt: launched,
        updatedAt: new Date().toISOString(),
      } as TaskCursorExecutionV1,
      taskCursorExecutionHistory: [],
    });
    expect(target?.workBranch).toBe("wip/cursor/code-dev-frame-001-001");
  });

  it("recovers when JSON run is queued but DB runtime is cursor_running", () => {
    const launched = new Date(Date.now() - 120_000).toISOString();
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-DEV-FRAME-001-001"],
      nowIso: launched,
    });
    const runs: CodeTaskExecutionRunV1[] = [
      {
        runId: "r1",
        projectId: "p1",
        processTaskId: "DEV-FRAME-001",
        workItemId: "w1",
        codeTaskId: "CODE-DEV-FRAME-001-001",
        status: "queued",
        createdAt: launched,
        updatedAt: launched,
      } as CodeTaskExecutionRunV1,
    ];
    const target = resolveQuickRunStuckGithubVerifyTarget({
      projectId: "p1",
      quickRun,
      queue,
      runs,
      codeTaskPlan: plan,
      taskCursorExecution: {
        projectId: "p1",
        taskId: "DEV-FRAME-001",
        status: "cursor_running",
        cursorRunId: "bc-49cadb9f-e6fe-4b08-8f52-85e4642eeda9",
        workBranch: "wip/cursor/code-dev-frame-001-001",
        createdAt: launched,
        updatedAt: launched,
      } as TaskCursorExecutionV1,
      taskCursorExecutionHistory: [],
      dbBundle: {
        job: {
          id: "job-1",
          projectId: "p1",
          status: "running",
          currentCodeTaskId: "CODE-DEV-FRAME-001-001",
          selectedCodeTaskIds: ["CODE-DEV-FRAME-001-001"],
          failureReason: null,
          startedAt: launched,
          completedAt: null,
          updatedAt: launched,
        },
        currentRun: {
          id: "db-run-1",
          projectId: "p1",
          jobId: "job-1",
          codeTaskId: "CODE-DEV-FRAME-001-001",
          runtimeState: "cursor_running",
          cursorAgentId: "bc-49cadb9f-e6fe-4b08-8f52-85e4642eeda9",
          branchName: "wip/cursor/code-dev-frame-001-001",
          commitSha: null,
          pullRequestUrl: null,
          failureReason: null,
          lastHeartbeatAt: launched,
          startedAt: launched,
          completedAt: null,
          updatedAt: launched,
          taskCursorJobId: "tcj-1",
          nextPollAt: launched,
          pollCount: 0,
          lastPollAt: null,
        },
        runs: [
          {
            id: "db-run-1",
            projectId: "p1",
            jobId: "job-1",
            codeTaskId: "CODE-DEV-FRAME-001-001",
            runtimeState: "cursor_running",
            cursorAgentId: "bc-49cadb9f-e6fe-4b08-8f52-85e4642eeda9",
            branchName: "wip/cursor/code-dev-frame-001-001",
            commitSha: null,
            pullRequestUrl: null,
            failureReason: null,
            lastHeartbeatAt: launched,
            startedAt: launched,
            completedAt: null,
            updatedAt: launched,
            taskCursorJobId: "tcj-1",
            nextPollAt: launched,
            pollCount: 0,
            lastPollAt: null,
          },
        ],
      },
    });
    expect(target?.workBranch).toBe("wip/cursor/code-dev-frame-001-001");
  });

  it("targets DB current CodeTask when task 1 JSON incomplete but job is on task 2", () => {
    const launched = new Date(Date.now() - 360_000).toISOString();
    const screenLaunched = new Date(Date.now() - 360_000).toISOString();
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-DEV-FRAME-001-001", "CODE-DEV-SCREEN-001-001"],
      nowIso: launched,
    });
    queue.currentIndex = 1;
    const runs: CodeTaskExecutionRunV1[] = [
      {
        runId: "r1",
        projectId: "p1",
        processTaskId: "DEV-FRAME-001",
        workItemId: "w1",
        codeTaskId: "CODE-DEV-FRAME-001-001",
        status: "cursor_running",
        cursorRunId: "bc-frame",
        workBranch: "wip/cursor/code-dev-frame-001-001",
        createdAt: launched,
        updatedAt: launched,
      } as CodeTaskExecutionRunV1,
      {
        runId: "r2",
        projectId: "p1",
        processTaskId: "DEV-SCREEN-001",
        workItemId: "w2",
        codeTaskId: "CODE-DEV-SCREEN-001-001",
        status: "cursor_running",
        cursorRunId: "bc-screen",
        workBranch: "wip/cursor/code-dev-screen-001-001",
        createdAt: screenLaunched,
        updatedAt: screenLaunched,
      } as CodeTaskExecutionRunV1,
    ];
    const target = resolveQuickRunStuckGithubVerifyTarget({
      projectId: "p1",
      quickRun,
      queue,
      runs,
      codeTaskPlan: {
        ...plan,
        tasks: [
          plan.tasks[0]!,
          {
            codeTaskId: "CODE-DEV-SCREEN-001-001",
            parentTaskId: "DEV-SCREEN-001",
            title: "screen",
            description: "d",
            acceptanceCriteria: [],
            dependencies: [],
          },
        ],
      },
      taskCursorExecution: {
        projectId: "p1",
        taskId: "DEV-SCREEN-001",
        status: "cursor_running",
        cursorRunId: "bc-screen",
        workBranch: "wip/cursor/code-dev-screen-001-001",
        createdAt: screenLaunched,
        updatedAt: screenLaunched,
      } as TaskCursorExecutionV1,
      taskCursorExecutionHistory: [],
      dbBundle: {
        job: {
          id: "job-1",
          projectId: "p1",
          status: "running",
          currentCodeTaskId: "CODE-DEV-SCREEN-001-001",
          selectedCodeTaskIds: ["CODE-DEV-FRAME-001-001", "CODE-DEV-SCREEN-001-001"],
          failureReason: null,
          startedAt: launched,
          completedAt: null,
          updatedAt: screenLaunched,
        },
        currentRun: {
          id: "db-run-2",
          projectId: "p1",
          jobId: "job-1",
          codeTaskId: "CODE-DEV-SCREEN-001-001",
          runtimeState: "cursor_running",
          cursorAgentId: "bc-screen",
          branchName: "wip/cursor/code-dev-screen-001-001",
          commitSha: null,
          pullRequestUrl: null,
          failureReason: null,
          lastHeartbeatAt: screenLaunched,
          startedAt: screenLaunched,
          completedAt: null,
          updatedAt: screenLaunched,
          taskCursorJobId: "tcj-2",
          nextPollAt: screenLaunched,
          pollCount: 0,
          lastPollAt: null,
        },
        runs: [
          {
            id: "db-run-1",
            projectId: "p1",
            jobId: "job-1",
            codeTaskId: "CODE-DEV-FRAME-001-001",
            runtimeState: "completed",
            cursorAgentId: "bc-frame",
            branchName: "wip/cursor/code-dev-frame-001-001",
            commitSha: "sha-frame",
            pullRequestUrl: null,
            failureReason: null,
            lastHeartbeatAt: launched,
            startedAt: launched,
            completedAt: launched,
            updatedAt: launched,
            taskCursorJobId: null,
            nextPollAt: null,
            pollCount: 1,
            lastPollAt: launched,
          },
          {
            id: "db-run-2",
            projectId: "p1",
            jobId: "job-1",
            codeTaskId: "CODE-DEV-SCREEN-001-001",
            runtimeState: "cursor_running",
            cursorAgentId: "bc-screen",
            branchName: "wip/cursor/code-dev-screen-001-001",
            commitSha: null,
            pullRequestUrl: null,
            failureReason: null,
            lastHeartbeatAt: screenLaunched,
            startedAt: screenLaunched,
            completedAt: null,
            updatedAt: screenLaunched,
            taskCursorJobId: "tcj-2",
            nextPollAt: screenLaunched,
            pollCount: 0,
            lastPollAt: null,
          },
        ],
      },
    });
    expect(target?.workBranch).toBe("wip/cursor/code-dev-screen-001-001");
    expect(target?.cursorRunId).toBe("bc-screen");
  });

  it("uses CodeTask work branch when run has no workBranch", () => {
    const launched = new Date(Date.now() - 120_000).toISOString();
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-DEV-FRAME-001-001"],
      nowIso: launched,
    });
    const runs: CodeTaskExecutionRunV1[] = [
      {
        runId: "r1",
        projectId: "p1",
        processTaskId: "DEV-FRAME-001",
        workItemId: "w1",
        codeTaskId: "CODE-DEV-FRAME-001-001",
        status: "cursor_completed",
        cursorRunId: "bc-agent",
        createdAt: launched,
        updatedAt: launched,
      },
    ];
    const target = resolveQuickRunStuckGithubVerifyTarget({
      projectId: "p1",
      quickRun: { ...quickRun, startedAt: launched },
      queue,
      runs,
      codeTaskPlan: plan,
      taskCursorExecution: null,
      taskCursorExecutionHistory: [],
    });
    expect(target?.workBranch).toBe("wip/cursor/code-dev-frame-001-001");
  });
});
