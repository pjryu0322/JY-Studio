import { describe, expect, it } from "vitest";
import {
  appendReworkRequest,
  parseImplementationExecutionBoardStateV1,
} from "@/lib/prototype/implementationExecutionBoardState";
import {
  enrichCursorWorkItemsWithBoardReworkContext,
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
