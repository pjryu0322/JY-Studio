import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImplementationCodeAgentExecutionProgressCard } from "@/components/preview/ImplementationCodeAgentExecutionProgressCard";
import { ImplementationExecutionBoardPanel } from "@/components/preview/ImplementationExecutionBoardPanel";
import { buildCodeAgentExecutionProgressView } from "@/lib/prototype/codeAgentExecutionProgressView";
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
    expect(html).toContain("implementation-execution-overview-card");
    expect(html).toContain("implementation-task-tree-section");
    expect(html).toContain("작업 트리");
    expect(html).not.toContain("implementation-env-details");
    expect(html).not.toContain("상세 로그 보기");
  });

  it("shows Cloud Agent poll cancel button while polling", () => {
    const progress = buildCodeAgentExecutionProgressView({
      taskCursorExecutionV1: {
        version: "task_cursor_execution_v1",
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        workItemIds: ["w1"],
        status: "cursor_running",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-mock-001",
        cursorRunId: "bc-aa13fda9-21e2-4d4b-af82-6006c4fbc40e",
        createdAt: "2026-05-30T12:00:00.000Z",
        updatedAt: "2026-05-30T12:00:00.000Z",
      },
    });
    const html = renderToStaticMarkup(
      createElement(ImplementationCodeAgentExecutionProgressCard, {
        progress,
        onCancelPolling: () => {},
      }),
    );
    expect(html).toContain("task-cursor-cancel-polling-button");
    expect(html).toContain("Cloud Agent 폴링 중단");
  });
});
