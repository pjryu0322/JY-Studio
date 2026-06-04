import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImplementationExecutionBoardTaskTree } from "@/components/preview/ImplementationExecutionBoardTaskTree";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import { buildImplementationTaskTreeNodes } from "@/lib/prototype/implementationExecutionBoardPanelView";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-01T00:00:00.000Z";

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-COMMON-001",
        title: "로딩 상태 공통 기능 구현",
        description: "d",
        taskType: "common",
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

describe("ImplementationExecutionBoardTaskTree", () => {
  it("removes flow title, hides process task count, and filters noisy meta labels in codetask detail", () => {
    const taskList = sampleTaskList();
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: taskList },
    })!;
    const codeTaskPlan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: "p1",
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const selectedCodeTaskId = codeTaskPlan.tasks[0]!.codeTaskId;
    const nodes = buildImplementationTaskTreeNodes({
      board,
      codeTaskPlan,
      selectedCodeTaskId,
      checkedCodeTaskIds: [selectedCodeTaskId],
    });

    const html = renderToStaticMarkup(
      createElement(ImplementationExecutionBoardTaskTree, {
        nodes,
        selectedCodeTaskId,
        allChecked: false,
        onSelectCodeTask: () => {},
        onToggleCodeTaskChecked: () => {},
        onToggleSelectAll: () => {},
      }),
    );

    expect(html).toContain("CodeTask");
    expect(html).toContain("선택됨");
    expect(html).not.toContain("Process Task");
    expect(html).not.toContain("실행 흐름");
    expect(html).toContain("implementation-code-task-tree-item-");
    expect(html).not.toContain("implementation-task-tree-meta");
    expect(html).toContain("implementation-code-task-detail-");
    expect(html).toContain("개발 프롬프트 생성");
  });
});

