import { describe, expect, it } from "vitest";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { refineCursorWorkItemsForImplementation } from "@/lib/prototype/implementationWorkItemRefinement";
import {
  runWorkItemPreflight,
  runWorkItemPreflightBatch,
} from "@/lib/prototype/implementationWorkItemPreflight";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-28T00:00:00.000Z";

function taskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-001",
        title: "화면",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "ready",
      },
    ],
    summary: { totalTasks: 1, developerTasks: 1, reviewerTasks: 0, securityTasks: 0, scmTasks: 0 },
  };
}

function baseWorkItem(overrides: Partial<CursorWorkItem> = {}): CursorWorkItem {
  return {
    id: "wi-1",
    taskId: "DEV-001",
    title: "화면",
    prompt: "prompt",
    requiredFilesHint: ["projects/JYOrchestration/apps/web/src/components/preview/Foo.tsx"],
    expectedOutput: ["changed files"],
    testCommands: ["pnpm test"],
    forbiddenPaths: ["../../"],
    blocked: false,
    blockers: [],
    qualityGate: { promptReady: true, missing: [], score: 1 },
    objective: "화면 개선",
    expectedChange: "상태 표시 추가",
    candidateFileHints: ["dir:projects/JYOrchestration/apps/web/src/components/preview"],
    acceptanceCriteria: ["상태가 보인다"],
    verificationHints: ["pnpm test"],
    originStage: "planning",
    refinementStatus: "draft",
    ...overrides,
  };
}

describe("implementationWorkItemPreflight", () => {
  it("fails vague work items missing objective and candidates", () => {
    const result = runWorkItemPreflight({
      workItem: baseWorkItem({
        title: "화면 개선",
        objective: "",
        expectedChange: "",
        prompt: "",
        candidateFiles: undefined,
        candidateFileHints: undefined,
        requiredFilesHint: [],
        acceptanceCriteria: undefined,
        verificationHints: undefined,
        testCommands: [],
        forbiddenPaths: [],
      }),
    });
    expect(result.status).toBe("failed");
    expect(result.failedReasons.join(" ")).toMatch(/objective/);
    expect(result.failedReasons.join(" ")).toMatch(/candidateFiles/);
    expect(result.failedReasons.join(" ")).toMatch(/acceptanceCriteria/);
  });

  it("passes work items with sufficient structured fields", () => {
    const result = runWorkItemPreflightBatch({
      workItems: [baseWorkItem()],
      allowedPathGlobs: ["projects/JYOrchestration/**"],
    });
    expect(result.status).toBe("passed");
  });

  it("removes candidate files outside allowedPathGlobs during refinement", () => {
    const refined = refineCursorWorkItemsForImplementation({
      projectId: "p1",
      taskList: taskList(),
      workItems: [
        baseWorkItem({
          candidateFiles: [
            "projects/JYOrchestration/apps/web/src/Foo.tsx",
            "../other-project/file.ts",
          ],
        }),
      ],
      selectedTaskId: "DEV-001",
      allowedPathGlobs: ["projects/JYOrchestration/**"],
      nowIso: NOW,
    });
    expect(refined.workItems[0]?.candidateFiles).toEqual([
      "projects/JYOrchestration/apps/web/src/Foo.tsx",
    ]);
    expect(refined.timelineEntries.some((entry) => entry.action === "implementation_work_item_refined")).toBe(
      true,
    );
    expect(refined.workItems[0]?.refinementStatus).toBe("source_refined");
  });
});
