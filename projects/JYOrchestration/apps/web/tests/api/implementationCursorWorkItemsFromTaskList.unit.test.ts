import { describe, expect, it } from "vitest";
import { buildCursorWorkItemsFromImplementationTaskList } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-28T00:00:00.000Z";

function makeTaskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-002",
        title: "낮은 우선순위 개발 작업",
        description: "dev low",
        taskType: "feature",
        ownerRole: "developer",
        priority: "low",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "ready",
      },
      {
        taskId: "REV-001",
        title: "검수 작업",
        description: "review",
        taskType: "validation",
        ownerRole: "reviewer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "ready",
      },
      {
        taskId: "DEV-001",
        title: "높은 우선순위 개발 작업",
        description: "dev high",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        dependencies: ["DEV-002"],
        acceptanceCriteria: ["ok-1", "ok-2"],
        status: "ready",
      },
      {
        taskId: "DEV-003",
        title: "진행 중 개발 작업(제외)",
        description: "dev in progress",
        taskType: "api",
        ownerRole: "developer",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "in_progress",
      },
    ],
    roleSummary: { developer: 3, designer: 0, reviewer: 1, security: 0, scm: 0 },
  };
}

describe("buildCursorWorkItemsFromImplementationTaskList", () => {
  it("builds work items for ready developer tasks only, sorted by priority", () => {
    const workItems = buildCursorWorkItemsFromImplementationTaskList({
      projectId: "p1",
      taskList: makeTaskList(),
      nowIso: NOW,
    });

    expect(workItems.length).toBe(2);
    expect(workItems[0]?.taskId).toBe("DEV-001");
    expect(workItems[1]?.taskId).toBe("DEV-002");
  });

  it("includes required prompt fields and WIP policy", () => {
    const [first] = buildCursorWorkItemsFromImplementationTaskList({
      projectId: "p1",
      taskList: makeTaskList(),
      nowIso: NOW,
    });
    expect(first?.title).toContain("[DEV-001]");
    expect(first?.prompt).toContain("Implementation Task List 기준 작업");
    expect(first?.prompt).toContain("작업 ID: DEV-001");
    expect(first?.prompt).toContain("완료 기준:");
    expect(first?.prompt).toContain("- ok-1");
    expect(first?.prompt).toContain("## WIP 작업 정책");
    expect(first?.testCommands?.length ?? 0).toBeGreaterThan(0);
    expect(first?.forbiddenPaths?.length ?? 0).toBeGreaterThan(0);
    expect(first?.expectedOutput?.length ?? 0).toBeGreaterThan(0);
    expect(typeof first?.qualityGate?.score).toBe("number");
  });
});

