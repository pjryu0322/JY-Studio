import { describe, expect, it } from "vitest";
import { buildCodeTaskInlineExecutionDetail, CODE_TASK_INLINE_SCOPE_LABEL } from "@/lib/prototype/implementationCodeTaskInlineExecution";
import { buildCodeAgentExecutionProgressView } from "@/lib/prototype/codeAgentExecutionProgressView";
import { formatImplementationExecutionOverviewLines } from "@/lib/prototype/implementationExecutionOverview";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationExecutionOverview } from "@/lib/prototype/implementationExecutionOverview";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-01T00:00:00.000Z";

function sampleList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-1",
        title: "Task",
        description: "d",
        taskType: "feature",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("buildCodeTaskInlineExecutionDetail", () => {
  it("moves idle progress hints to selected code task", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleList() },
    })!;
    const progress = buildCodeAgentExecutionProgressView({ board });
    const detail = buildCodeTaskInlineExecutionDetail({
      progress,
      parentTaskId: "DEV-1",
      isSelected: true,
    });
    expect(detail?.compactLine).toContain("상태:");
    expect(detail?.scopeLine).toBe(CODE_TASK_INLINE_SCOPE_LABEL);
    expect(detail?.nextProcessingHint).toContain("경량검사");
    expect(detail?.executionFlowSteps).toBeUndefined();
  });
});

describe("formatImplementationExecutionOverviewLines", () => {
  it("omits quick-run pitch from top summary", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleList() },
    })!;
    const overview = buildImplementationExecutionOverview({ board });
    const text = formatImplementationExecutionOverviewLines(overview).join("\n");
    expect(text).not.toContain("Quick 실행으로 선택한");
    expect(text).toContain("CodeTask 진행:");
  });
});
