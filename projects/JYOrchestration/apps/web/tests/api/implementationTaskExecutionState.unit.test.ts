import { describe, expect, it } from "vitest";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  formatImplementationTaskExecutionSummaryLines,
  markDeveloperTasksFailedForWip,
  markDeveloperTasksInProgressForWip,
  parseImplementationTaskExecutionStateV1,
  summarizeImplementationTaskExecutionItems,
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
});
