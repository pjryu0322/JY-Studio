import { describe, expect, it } from "vitest";
import { startCodeTaskExecutionQueue } from "@/lib/prototype/codeTaskExecutionQueue";
import {
  formatImplementationExecutionOverviewLines,
  resolveSelectedCodeTaskExecutionProgress,
} from "@/lib/prototype/implementationExecutionOverview";
import { buildImplementationExecutionOverview } from "@/lib/prototype/implementationExecutionOverview";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-03T12:00:00.000Z";

function sampleList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-A",
        title: "A",
        description: "d",
        taskType: "feature",
        ownerRole: "developer",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("resolveSelectedCodeTaskExecutionProgress", () => {
  it("uses queue selected ids length not full plan count", () => {
    const selected = ["ct-1", "ct-2", "ct-3", "ct-4"];
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: selected,
      nowIso: NOW,
    });
    expect(queue?.selectedCodeTaskIds).toEqual(selected);
    const progress = resolveSelectedCodeTaskExecutionProgress({
      selectedCodeTaskIds: selected,
      queue,
      runs: [],
    });
    expect(progress).toEqual({ done: 1, total: 4 });
  });
});

describe("formatImplementationExecutionOverviewLines queue alignment", () => {
  it("shows waiting state when selections exist but queue idle", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleList() },
    })!;
    const overview = buildImplementationExecutionOverview({ board });
    const text = formatImplementationExecutionOverviewLines(overview, {
      selectedCodeTaskCount: 4,
    }).join("\n");
    expect(text).toContain("선택 CodeTask: 4개");
    expect(text).toContain("선택한 CodeTask 실행 대기");
  });
});

describe("buildImplementationExecutionOverview stale failed runtime", () => {
  it("shows GitHub 확인 필요 when DB failed but active run has commit", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleList() },
    })!;
    const overview = buildImplementationExecutionOverview({
      board,
      dbRuntimeState: "failed",
      activeCodeTaskRun: { commitSha: "abc123" },
    });
    expect(overview.runtimeStateLabel).toBe("GitHub commit 확인 중");
    expect(overview.isRunning).toBe(true);
  });
});
