import { describe, expect, it } from "vitest";
import {
  appendReworkRequest,
  parseImplementationExecutionBoardStateV1,
} from "@/lib/prototype/implementationExecutionBoardState";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  enrichCursorWorkItemsWithBoardReworkContext,
  mergeCursorWorkItemsByTask,
  mergeCursorWorkItemsWithMissingCodeTaskPlanTasks,
  validateTaskScopedWorkItems,
  type CursorWorkItem,
} from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationQualityGateResultV1 } from "@/lib/prototype/implementationQualityGate";

const NOW = "2026-05-28T12:00:00.000Z";

const baseWorkItem: CursorWorkItem = {
  id: "wi-1",
  taskId: "dev-1",
  title: "작업",
  prompt: "base prompt",
  requiredFilesHint: [],
  expectedOutput: [],
  testCommands: ["npm test"],
  forbiddenPaths: ["/node_modules"],
  blocked: false,
  blockers: [],
  qualityGate: { score: 1, promptReady: true, missing: [] },
};

describe("mergeCursorWorkItemsWithMissingCodeTaskPlanTasks", () => {
  const sampleId = CANONICAL_SAMPLE_DATA_CODE_TASK_ID;

  it("appends work item for sample CodeTask when plan grew but cursorWorkItems did not", () => {
    const plan: ImplementationCodeTaskPlanV1 = {
      version: 1,
      projectId: "p1",
      parentTaskCount: 1,
      codeTaskCount: 2,
      tasks: [
        {
          codeTaskId: "CODE-FRAME-001",
          parentTaskId: "TASK-FRAME",
          title: "Frame",
          description: "desc",
          changeType: "component",
          status: "ready",
          targetHints: ["apps/web"],
          acceptanceCriteria: ["ok"],
          verificationHints: ["pnpm test"],
          forbiddenPaths: ["node_modules"],
        },
        {
          codeTaskId: sampleId,
          parentTaskId: "TASK-DATA",
          title: "Sample data",
          description: "desc",
          changeType: "data",
          status: "ready",
          targetHints: ["apps/web"],
          acceptanceCriteria: ["ok"],
          verificationHints: ["pnpm test"],
          forbiddenPaths: ["node_modules"],
        },
      ],
    };
    const existing: CursorWorkItem[] = [
      {
        ...baseWorkItem,
        id: "cursor-wi-CODE-FRAME-001",
        taskId: "TASK-FRAME",
        codeTaskId: "CODE-FRAME-001",
      },
    ];
    const merged = mergeCursorWorkItemsWithMissingCodeTaskPlanTasks({
      projectId: "p1",
      codeTaskPlan: plan,
      existingWorkItems: existing,
      nowIso: NOW,
    });
    expect(merged.appendedCodeTaskIds).toEqual([sampleId]);
    expect(merged.cursorWorkItems).toHaveLength(2);
    expect(merged.cursorWorkItems.some((w) => w.codeTaskId === sampleId)).toBe(true);
  });
});

describe("mergeCursorWorkItemsByTask", () => {
  const workItem = (
    id: string,
    taskId: string,
    refinementStatus: CursorWorkItem["refinementStatus"] = "draft",
  ): CursorWorkItem => ({
    ...baseWorkItem,
    id,
    taskId,
    refinementStatus,
  });

  it("preserves other task work items when updating one task", () => {
    const existing = [
      workItem("A-1", "TASK-A", "draft"),
      workItem("B-1", "TASK-B", "draft"),
      workItem("C-1", "TASK-C", "draft"),
    ];
    const updated = [workItem("B-1", "TASK-B", "preflight_passed")];

    const merged = mergeCursorWorkItemsByTask({
      existingWorkItems: existing,
      updatedWorkItems: updated,
      taskId: "TASK-B",
    });

    expect(merged.map((item) => item.id).sort()).toEqual(["A-1", "B-1", "C-1"]);
    expect(merged.find((item) => item.id === "A-1")?.refinementStatus).toBe("draft");
    expect(merged.find((item) => item.id === "B-1")?.refinementStatus).toBe("preflight_passed");
    expect(merged.find((item) => item.id === "C-1")?.refinementStatus).toBe("draft");
  });

  it("keeps full array on preflight failure with only failed task updated", () => {
    const existing = [
      workItem("A-1", "TASK-A", "draft"),
      workItem("B-1", "TASK-B", "draft"),
      workItem("C-1", "TASK-C", "draft"),
    ];
    const updated = [workItem("B-1", "TASK-B", "preflight_failed")];

    const merged = mergeCursorWorkItemsByTask({
      existingWorkItems: existing,
      updatedWorkItems: updated,
      taskId: "TASK-B",
    });

    expect(merged).toHaveLength(3);
    expect(merged.find((item) => item.id === "B-1")?.refinementStatus).toBe("preflight_failed");
    expect(merged.find((item) => item.id === "A-1")?.refinementStatus).toBe("draft");
    expect(merged.find((item) => item.id === "C-1")?.refinementStatus).toBe("draft");
  });

  it("keeps full array on preflight pass with only passed task updated", () => {
    const existing = [
      workItem("A-1", "TASK-A", "draft"),
      workItem("B-1", "TASK-B", "draft"),
      workItem("C-1", "TASK-C", "source_refined"),
    ];
    const updated = [workItem("B-1", "TASK-B", "preflight_passed")];

    const merged = mergeCursorWorkItemsByTask({
      existingWorkItems: existing,
      updatedWorkItems: updated,
      taskId: "TASK-B",
    });

    expect(merged).toHaveLength(3);
    expect(merged.find((item) => item.id === "B-1")?.refinementStatus).toBe("preflight_passed");
    expect(merged.find((item) => item.id === "A-1")?.refinementStatus).toBe("draft");
    expect(merged.find((item) => item.id === "C-1")?.refinementStatus).toBe("source_refined");
  });

  it("returns existing items unchanged when taskId is empty", () => {
    const existing = [workItem("A-1", "TASK-A")];
    const merged = mergeCursorWorkItemsByTask({
      existingWorkItems: existing,
      updatedWorkItems: [workItem("B-1", "TASK-B", "preflight_passed")],
      taskId: "",
    });
    expect(merged).toEqual(existing);
  });

  it("appends new work item ids for the same task", () => {
    const existing = [workItem("B-1", "TASK-B", "draft")];
    const updated = [
      workItem("B-1", "TASK-B", "preflight_passed"),
      workItem("B-2", "TASK-B", "preflight_passed"),
    ];
    const merged = mergeCursorWorkItemsByTask({
      existingWorkItems: existing,
      updatedWorkItems: updated,
      taskId: "TASK-B",
    });
    expect(merged.map((item) => item.id).sort()).toEqual(["B-1", "B-2"]);
  });
});

describe("validateTaskScopedWorkItems", () => {
  it("passes when all workItems match selectedTaskId", () => {
    const result = validateTaskScopedWorkItems({
      selectedTaskId: "dev-1",
      selectedWorkItems: [baseWorkItem],
    });
    expect(result.ok).toBe(true);
  });

  it("fails when any workItem taskId differs", () => {
    const result = validateTaskScopedWorkItems({
      selectedTaskId: "dev-1",
      selectedWorkItems: [{ ...baseWorkItem, taskId: "dev-2" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("일치하지 않습니다");
  });
});

describe("enrichCursorWorkItemsWithBoardReworkContext", () => {
  it("active rework request is injected into selected workItem prompt", () => {
    const boardState = appendReworkRequest({
      state: null,
      projectId: "p1",
      taskId: "dev-1",
      targetRole: "developer",
      reason: "다운로드 버튼 보완",
      nowIso: NOW,
      requestId: "rw-1",
    });
    const [enriched] = enrichCursorWorkItemsWithBoardReworkContext({
      workItems: [baseWorkItem],
      boardState,
    });
    expect(enriched?.prompt).toContain("## 재작업/보완 지시");
    expect(enriched?.prompt).toContain("다운로드 버튼 보완");
  });

  it("cancelled rework request is not injected", () => {
    const boardState = parseImplementationExecutionBoardStateV1({
      version: "implementation_execution_board_state_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      userConfirmations: [],
      reworkRequests: [
        {
          requestId: "rw-cancel",
          taskId: "dev-1",
          targetRole: "developer",
          reason: "무시",
          status: "cancelled",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    });
    const [enriched] = enrichCursorWorkItemsWithBoardReworkContext({
      workItems: [baseWorkItem],
      boardState,
    });
    expect(enriched?.prompt).toBe("base prompt");
  });

  it("reviewer failedTaskIds inject reviewer failure context", () => {
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "reviewer",
        status: "failed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "DEV-001 검수 실패",
        checks: [
          {
            id: "c1",
            title: "다운로드 처리",
            status: "failed",
            detail: "빈 파일 처리 미흡",
            targetTaskIds: ["dev-1"],
          },
        ],
        failedTaskIds: ["dev-1"],
      },
    ];
    const [enriched] = enrichCursorWorkItemsWithBoardReworkContext({
      workItems: [baseWorkItem],
      qualityGateResults,
    });
    expect(enriched?.prompt).toContain("AI 검수자");
    expect(enriched?.prompt).toContain("빈 파일 처리 미흡");
  });

  it("security failedTaskIds inject security failure context", () => {
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "security",
        status: "failed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "입력값 검증 누락",
        checks: [],
        failedTaskIds: ["dev-1"],
      },
    ];
    const [enriched] = enrichCursorWorkItemsWithBoardReworkContext({
      workItems: [baseWorkItem],
      qualityGateResults,
    });
    expect(enriched?.prompt).toContain("AI 보안관");
    expect(enriched?.prompt).toContain("입력값 검증 누락");
  });

  it("unrelated task failure is not injected", () => {
    const qualityGateResults: readonly ImplementationQualityGateResultV1[] = [
      {
        version: "implementation_quality_gate_result_v1",
        role: "reviewer",
        status: "failed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "다른 작업 실패",
        checks: [],
        failedTaskIds: ["dev-2"],
      },
    ];
    const [enriched] = enrichCursorWorkItemsWithBoardReworkContext({
      workItems: [baseWorkItem],
      qualityGateResults,
    });
    expect(enriched?.prompt).toBe("base prompt");
  });
});
