import { describe, expect, it } from "vitest";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { buildImplementationTaskTreeNodes } from "@/lib/prototype/implementationExecutionBoardPanelView";
import {
  stripLeadingTaskIdFromTitle,
} from "@/lib/prototype/implementationTaskTreeView";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
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

function sampleCodeTaskPlan(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_task_list",
    parentTaskCount: 1,
    codeTaskCount: 1,
    tasks: [
      {
        codeTaskId: "DEV-COMMON-001",
        parentTaskId: "DEV-MOCK-001",
        title: "로딩 상태 공통 기능 구현",
        description: "",
        changeType: "component",
        targetHints: [],
        dependencies: [],
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        priority: "P1",
        status: "ready",
        blockers: [],
      },
    ],
    readiness: { ready: true, missing: [] },
  };
}

describe("implementationTaskTreeView", () => {
  it("strips task id prefix from titles", () => {
    expect(stripLeadingTaskIdFromTitle("DEV-MOCK-001", "DEV-MOCK-001 Mock 데이터 구조 정의")).toBe(
      "Mock 데이터 구조 정의",
    );
    expect(stripLeadingTaskIdFromTitle("DEV-COMMON-001", "로딩 상태 공통 기능 구현")).toBe(
      "로딩 상태 공통 기능 구현",
    );
  });

  it("places id in meta lines not in process task title", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleList() },
    })!;
    const nodes = buildImplementationTaskTreeNodes({
      board,
      codeTaskPlan: sampleCodeTaskPlan(),
      selectedCodeTaskId: "DEV-COMMON-001",
    });
    expect(nodes[0]?.title).toBe("Mock 데이터 구조 정의");
    expect(nodes[0]?.metaLines.find((m) => m.label === "ID")?.value).toBe("DEV-MOCK-001");
    expect(nodes[0]?.title).not.toContain("DEV-MOCK-001");
  });

  it("shows execution flow steps when code task selected", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleList() },
    })!;
    const nodes = buildImplementationTaskTreeNodes({
      board,
      codeTaskPlan: sampleCodeTaskPlan(),
      selectedCodeTaskId: "DEV-COMMON-001",
    });
    const codeTask = nodes[0]?.codeTasks[0];
    expect(codeTask?.title).toBe("로딩 상태 공통 기능 구현");
    expect(codeTask?.metaLines.find((m) => m.label === "ID")?.value).toBe("DEV-COMMON-001");
    expect(codeTask?.executionFlowSteps.map((s) => s.label)).toEqual([
      "개발 프롬프트 생성",
      "Cursor 실행",
      "GitHub commit 확인",
      "경량 자동검사",
      "검수 필요 여부 (생략)",
      "보안 필요 여부",
      "완료",
    ]);
  });
});
