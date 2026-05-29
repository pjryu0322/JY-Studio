import { describe, expect, it } from "vitest";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  applyExecutionStateItemPatches,
  formatImplementationTaskExecutionSummaryLines,
  markDeveloperTasksDoneForWip,
  markDeveloperTasksFailedForWip,
  markDeveloperTasksInProgressForWip,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksDone,
  markRoleTasksFailed,
  markRoleTasksInProgress,
  parseImplementationTaskExecutionStateV1,
  summarizeImplementationTaskExecutionItems,
  syncDeveloperTaskExecutionFromCodeAgentWip,
} from "@/lib/prototype/implementationTaskExecutionState";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const nowIso = "2026-05-28T12:00:00.000Z";

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p-exec",
    createdAt: nowIso,
    updatedAt: nowIso,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "dev-1",
        title: "화면 A",
        description: "d",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "rev-1",
        title: "검수",
        description: "d",
        taskType: "validation",
        ownerRole: "reviewer",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 1, security: 0, scm: 0 },
  };
}

const workItems: readonly CursorWorkItem[] = [
  {
    id: "wi-1",
    taskId: "dev-1",
    title: "화면 A",
    prompt: "p",
    requiredFilesHint: [],
    expectedOutput: [],
    testCommands: ["npm test"],
    forbiddenPaths: ["/node_modules"],
    blocked: false,
    blockers: [],
    qualityGate: { score: 0.9, promptReady: true, missing: [] },
  },
];

describe("implementationTaskExecutionState", () => {
  it("buildInitialImplementationTaskExecutionStateFromTaskList maps all tasks", () => {
    const state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    expect(state.items).toHaveLength(2);
    expect(state.summary.total).toBe(2);
    expect(state.summary.ready).toBe(2);
  });

  it("markDeveloperTasksInProgressForWip updates only linked developer tasks", () => {
    const initial = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    const updated = markDeveloperTasksInProgressForWip({
      state: initial,
      taskList: sampleTaskList(),
      cursorWorkItems: workItems,
      projectId: "p-exec",
      nowIso,
      codeAgentWipExecutionId: "wip-1",
    });
    const dev = updated.items.find((i) => i.taskId === "dev-1");
    const rev = updated.items.find((i) => i.taskId === "rev-1");
    expect(dev?.status).toBe("in_progress");
    expect(dev?.cursorWorkItemId).toBe("wi-1");
    expect(dev?.startedAt).toBe(nowIso);
    expect(rev?.status).toBe("ready");
    expect(updated.summary.inProgress).toBe(1);
  });

  it("markDeveloperTasksFailedForWip records error without overwriting done", () => {
    const initial = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    const withDone = {
      ...initial,
      items: initial.items.map((i) =>
        i.taskId === "dev-1" ? { ...i, status: "done" as const, completedAt: nowIso } : i,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        initial.items.map((i) =>
          i.taskId === "dev-1" ? { ...i, status: "done" as const, completedAt: nowIso } : i,
        ),
      ),
    };
    const failed = markDeveloperTasksFailedForWip({
      state: withDone,
      cursorWorkItems: workItems,
      nowIso,
      errorMessage: "gate blocked",
    });
    expect(failed.items.find((i) => i.taskId === "dev-1")?.status).toBe("done");
  });

  it("parseImplementationTaskExecutionStateV1 normalizes valid payload", () => {
    const built = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    const parsed = parseImplementationTaskExecutionStateV1(built);
    expect(parsed?.projectId).toBe("p-exec");
    expect(parsed?.items).toHaveLength(2);
  });

  it("parseImplementationTaskExecutionStateV1 skips invalid ownerRole rows", () => {
    const built = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    const parsed = parseImplementationTaskExecutionStateV1({
      ...built,
      items: [
        { taskId: "bad-1", ownerRole: "hacker", status: "ready" },
        ...built.items,
      ],
    });
    expect(parsed?.items).toHaveLength(2);
    expect(parsed?.summary.total).toBe(2);
  });

  it("parseImplementationTaskExecutionStateV1 skips invalid status rows", () => {
    const built = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    const parsed = parseImplementationTaskExecutionStateV1({
      ...built,
      items: [{ taskId: "bad-2", ownerRole: "developer", status: "unknown" }, ...built.items],
    });
    expect(parsed?.items).toHaveLength(2);
    expect(parsed?.summary.ready).toBe(2);
  });

  it("parseImplementationTaskExecutionStateV1 recalculates summary from valid rows only", () => {
    const built = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    const parsed = parseImplementationTaskExecutionStateV1({
      ...built,
      summary: { total: 99, ready: 99, queued: 0, inProgress: 0, done: 0, failed: 0, skipped: 0 },
      items: [
        { taskId: "x", ownerRole: "nope", status: "ready" },
        {
          taskId: "dev-1",
          ownerRole: "developer",
          status: "in_progress",
          startedAt: nowIso,
        },
        ...built.items.filter((i) => i.taskId !== "dev-1"),
      ],
    });
    expect(parsed?.summary.total).toBe(2);
    expect(parsed?.summary.inProgress).toBe(1);
    expect(parsed?.summary.ready).toBe(1);
  });

  it("markDeveloperTasksDoneForWip marks linked developer task done", () => {
    const initial = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    const inProgress = markDeveloperTasksInProgressForWip({
      state: initial,
      taskList: sampleTaskList(),
      cursorWorkItems: workItems,
      projectId: "p-exec",
      nowIso,
    });
    const done = markDeveloperTasksDoneForWip({
      state: inProgress,
      cursorWorkItems: workItems,
      nowIso,
    });
    expect(done.items.find((i) => i.taskId === "dev-1")?.status).toBe("done");
    expect(done.summary.done).toBe(1);
  });

  it("markDeveloperTasksDoneForWip does not overwrite failed/skipped", () => {
    const initial = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    const skipped = {
      ...initial,
      items: initial.items.map((i) =>
        i.taskId === "dev-1" ? { ...i, status: "skipped" as const } : i,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        initial.items.map((i) =>
          i.taskId === "dev-1" ? { ...i, status: "skipped" as const } : i,
        ),
      ),
    };
    const done = markDeveloperTasksDoneForWip({
      state: skipped,
      cursorWorkItems: workItems,
      nowIso,
    });
    expect(done.items.find((i) => i.taskId === "dev-1")?.status).toBe("skipped");
  });

  function minimalWip(status: CodeAgentWipExecutionV1["status"]): CodeAgentWipExecutionV1 {
    return {
      version: "code_agent_wip_execution_v1",
      projectId: "p-exec",
      provider: "cursor",
      status,
      branchName: "wip/p-exec",
      requestedAt: nowIso,
      requestedBy: "ai_developer",
      workItems: ["wi-1"],
      refactorRequests: [],
      commits: [],
    };
  }

  it("syncDeveloperTaskExecutionFromCodeAgentWip maps active WIP to in_progress", () => {
    const synced = syncDeveloperTaskExecutionFromCodeAgentWip({
      state: null,
      taskList: sampleTaskList(),
      cursorWorkItems: workItems,
      codeAgentWipExecutionV1: minimalWip("requested"),
      projectId: "p-exec",
      nowIso,
    });
    expect(synced?.items.find((i) => i.taskId === "dev-1")?.status).toBe("in_progress");
  });

  it("syncDeveloperTaskExecutionFromCodeAgentWip maps approved WIP to done", () => {
    const initial = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    const synced = syncDeveloperTaskExecutionFromCodeAgentWip({
      state: initial,
      taskList: sampleTaskList(),
      cursorWorkItems: workItems,
      codeAgentWipExecutionV1: minimalWip("developer_approved"),
      projectId: "p-exec",
      nowIso,
    });
    expect(synced?.items.find((i) => i.taskId === "dev-1")?.status).toBe("done");
  });

  it("markPostDeveloperReviewTasksQueued moves reviewer/security/scm ready to queued", () => {
    const initial = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: {
        ...sampleTaskList(),
        tasks: [
          ...sampleTaskList().tasks,
          {
            taskId: "sec-1",
            title: "보안",
            description: "d",
            taskType: "validation",
            ownerRole: "security",
            priority: "medium",
            dependencies: [],
            acceptanceCriteria: [],
            status: "ready",
          },
          {
            taskId: "scm-1",
            title: "SCM",
            description: "d",
            taskType: "integration",
            ownerRole: "scm",
            priority: "medium",
            dependencies: [],
            acceptanceCriteria: [],
            status: "ready",
          },
        ],
        roleSummary: { developer: 1, designer: 0, reviewer: 1, security: 1, scm: 1 },
      },
      nowIso,
    });
    const withDevDone = {
      ...initial,
      items: initial.items.map((i) =>
        i.taskId === "dev-1" ? { ...i, status: "done" as const, completedAt: nowIso } : i,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        initial.items.map((i) =>
          i.taskId === "dev-1" ? { ...i, status: "done" as const, completedAt: nowIso } : i,
        ),
      ),
    };
    const queued = markPostDeveloperReviewTasksQueued({ state: withDevDone, nowIso });
    expect(queued.items.find((i) => i.taskId === "dev-1")?.status).toBe("done");
    expect(queued.items.find((i) => i.taskId === "rev-1")?.status).toBe("queued");
    expect(queued.items.find((i) => i.taskId === "sec-1")?.status).toBe("queued");
    expect(queued.items.find((i) => i.taskId === "scm-1")?.status).toBe("queued");
    expect(queued.summary.queued).toBe(3);
  });

  it("markPostDeveloperReviewTasksQueued does not overwrite failed/skipped/in_progress", () => {
    const initial = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    const withSkippedReviewer = {
      ...initial,
      items: initial.items.map((i) =>
        i.ownerRole === "reviewer" ? { ...i, status: "skipped" as const } : i,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        initial.items.map((i) =>
          i.ownerRole === "reviewer" ? { ...i, status: "skipped" as const } : i,
        ),
      ),
    };
    const queued = markPostDeveloperReviewTasksQueued({ state: withSkippedReviewer, nowIso });
    expect(queued.items.find((i) => i.ownerRole === "reviewer")?.status).toBe("skipped");
  });

  it("markRoleTasksInProgress moves scm ready/queued to in_progress", () => {
    const initial = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: {
        ...sampleTaskList(),
        tasks: [
          ...sampleTaskList().tasks,
          {
            taskId: "scm-1",
            title: "SCM",
            description: "d",
            taskType: "integration",
            ownerRole: "scm",
            priority: "medium",
            dependencies: [],
            acceptanceCriteria: [],
            status: "ready",
          },
        ],
        roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 1 },
      },
      nowIso,
    });
    const withScmQueued = {
      ...initial,
      items: initial.items.map((i) =>
        i.taskId === "scm-1" ? { ...i, status: "queued" as const } : i,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        initial.items.map((i) =>
          i.taskId === "scm-1" ? { ...i, status: "queued" as const } : i,
        ),
      ),
    };
    const inProgress = markRoleTasksInProgress({
      state: withScmQueued,
      ownerRole: "scm",
      nowIso,
    });
    expect(inProgress.items.find((i) => i.taskId === "scm-1")?.status).toBe("in_progress");
    expect(inProgress.summary.inProgress).toBe(1);
  });

  it("syncDeveloperTaskExecutionFromCodeAgentWip maps failed WIP to failed", () => {
    const initial = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    const synced = syncDeveloperTaskExecutionFromCodeAgentWip({
      state: initial,
      taskList: sampleTaskList(),
      cursorWorkItems: workItems,
      codeAgentWipExecutionV1: minimalWip("failed"),
      projectId: "p-exec",
      nowIso,
    });
    expect(synced?.items.find((i) => i.taskId === "dev-1")?.status).toBe("failed");
  });

  it("formatImplementationTaskExecutionSummaryLines renders counts", () => {
    const state = markDeveloperTasksInProgressForWip({
      state: null,
      taskList: sampleTaskList(),
      cursorWorkItems: workItems,
      projectId: "p-exec",
      nowIso,
    });
    const lines = formatImplementationTaskExecutionSummaryLines(state);
    expect(lines[0]).toContain("작업 실행 상태");
    expect(lines.some((l) => l.includes("진행 중"))).toBe(true);
  });

  it("applyExecutionStateItemPatches returns same state when no patches apply", () => {
    const state = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: sampleTaskList(),
      nowIso,
    });
    const next = applyExecutionStateItemPatches(state, () => null, "2026-05-29T01:00:00.000Z");
    expect(next).toBe(state);
    expect(next.updatedAt).toBe(nowIso);
  });

  it("markRoleTasksDone marks reviewer in_progress to done", () => {
    const initial = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: {
        ...sampleTaskList(),
        tasks: [
          ...sampleTaskList().tasks,
          {
            taskId: "rev-1",
            title: "검수",
            description: "d",
            taskType: "validation",
            ownerRole: "reviewer",
            priority: "medium",
            dependencies: [],
            acceptanceCriteria: [],
            status: "ready",
          },
        ],
        roleSummary: { developer: 1, designer: 0, reviewer: 1, security: 0, scm: 0 },
      },
      nowIso,
    });
    const inProgress = markRoleTasksInProgress({ state: initial, ownerRole: "reviewer", nowIso });
    const done = markRoleTasksDone({
      state: inProgress,
      ownerRole: "reviewer",
      nowIso,
      resultSummary: "검수 통과",
    });
    expect(done.items.find((i) => i.taskId === "rev-1")?.status).toBe("done");
  });

  it("markRoleTasksFailed does not overwrite terminal done", () => {
    const initial = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-exec",
      taskList: {
        ...sampleTaskList(),
        tasks: [
          ...sampleTaskList().tasks,
          {
            taskId: "sec-1",
            title: "보안",
            description: "d",
            taskType: "security",
            ownerRole: "security",
            priority: "medium",
            dependencies: [],
            acceptanceCriteria: [],
            status: "ready",
          },
        ],
        roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 1, scm: 0 },
      },
      nowIso,
    });
    const withDone = {
      ...initial,
      items: initial.items.map((i) =>
        i.taskId === "sec-1" ? { ...i, status: "done" as const, completedAt: nowIso } : i,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        initial.items.map((i) =>
          i.taskId === "sec-1" ? { ...i, status: "done" as const, completedAt: nowIso } : i,
        ),
      ),
    };
    const failed = markRoleTasksFailed({
      state: withDone,
      ownerRole: "security",
      nowIso,
      errorMessage: "fail",
    });
    expect(failed.items.find((i) => i.taskId === "sec-1")?.status).toBe("done");
  });
});
