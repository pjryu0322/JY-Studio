import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImplementationExecutionBoardPanel } from "@/components/preview/ImplementationExecutionBoardPanel";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: "2026-05-30T12:00:00.000Z",
    updatedAt: "2026-05-30T12:00:00.000Z",
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-MOCK-001",
        title: "Mock 데이터 구조 정의",
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

describe("ImplementationExecutionBoardPanel", () => {
  it("does not render separate next-task card", () => {
    const taskList = sampleTaskList();
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: taskList },
    })!;
    const effective = resolveEffectiveImplementationState({
      parsedRequirementsState: { implementationTaskListV1: taskList },
      envOk: true,
      designOk: true,
      latestRun: null,
    });
    const html = renderToStaticMarkup(
      createElement(ImplementationExecutionBoardPanel, {
        board,
        taskList,
        effectiveImplementationState: effective,
        boardInput: {
          projectId: "p1",
          taskList,
        },
        onAction: () => {},
      }),
    );
    expect(html).not.toContain("implementation-next-task-card");
    expect(html).toContain("implementation-current-task-block");
    expect(html).toContain("implementation-task-tree-section");
    expect(html).toContain("작업 트리");
    expect(html).not.toContain("implementation-env-details");
    expect(html).not.toContain("상세 로그 보기");
  });
});
