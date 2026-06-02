import { describe, expect, it } from "vitest";
import { startCodeTaskExecutionQueue } from "@/lib/prototype/codeTaskExecutionQueue";
import {
  buildCodeTaskRowView,
  summarizeCodeTaskRowViewsForProcess,
} from "@/lib/prototype/codeTaskExecutionRunView";
import {
  buildCodeTaskInlineExecutionDetail,
  CODE_TASK_INLINE_SCOPE_LABEL,
} from "@/lib/prototype/implementationCodeTaskInlineExecution";
import { buildImplementationProcessTaskTreeNodes } from "@/lib/prototype/implementationTaskTreeView";
import {
  isProcessTaskCodeTasksFullySelected,
  normalizeSelectedCodeTaskIds,
  resolveProcessTaskCodeTaskSelectionToggle,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import {
  formatImplementationExecutionOverviewLines,
  buildImplementationExecutionOverview,
} from "@/lib/prototype/implementationExecutionOverview";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { buildCodeTaskCursorExecutionRequest } from "@/lib/prototype/codeTaskExecutionRequest";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { IMPLEMENTATION_QUICK_RUN_CHIP } from "@/lib/requirements/implementationUxLabels";

const NOW = "2026-06-01T12:00:00.000Z";

function samplePlan(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    tasks: [
      {
        codeTaskId: "CODE-A-1",
        parentTaskId: "DEV-COMMON-001",
        title: "UI component",
        description: "d",
        changeType: "feature",
        acceptanceCriteria: ["ok"],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        candidateFileHints: [],
        targetHints: [],
      },
      {
        codeTaskId: "CODE-A-2",
        parentTaskId: "DEV-COMMON-001",
        title: "Logic component",
        description: "d",
        changeType: "feature",
        acceptanceCriteria: ["ok"],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        candidateFileHints: [],
        targetHints: [],
      },
      {
        codeTaskId: "CODE-A-3",
        parentTaskId: "DEV-COMMON-001",
        title: "Hook",
        description: "d",
        changeType: "feature",
        acceptanceCriteria: ["ok"],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        candidateFileHints: [],
        targetHints: [],
      },
      {
        codeTaskId: "CODE-A-4",
        parentTaskId: "DEV-COMMON-001",
        title: "Test",
        description: "d",
        changeType: "feature",
        acceptanceCriteria: ["ok"],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        candidateFileHints: [],
        targetHints: [],
      },
    ],
  };
}

function sampleList(): ImplementationTaskListV1 {
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

describe("codeTask primary execution UX", () => {
  it("process task checkbox selects all child code tasks", () => {
    const plan = samplePlan();
    const next = resolveProcessTaskCodeTaskSelectionToggle({
      parentTaskId: "DEV-COMMON-001",
      checked: true,
      selectedCodeTaskIds: [],
      codeTaskPlan: plan,
    });
    expect(next).toEqual(["CODE-A-1", "CODE-A-2", "CODE-A-3", "CODE-A-4"]);
    expect(
      isProcessTaskCodeTasksFullySelected({
        parentTaskId: "DEV-COMMON-001",
        selectedCodeTaskIds: next,
        codeTaskPlan: plan,
      }),
    ).toBe(true);
  });

  it("single code task run builds queue with one id", () => {
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-A-1"],
      nowIso: NOW,
    });
    expect(queue?.selectedCodeTaskIds).toEqual(["CODE-A-1"]);
  });

  it("multi code task selection builds queue with all selected ids", () => {
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["CODE-A-1", "CODE-A-2", "CODE-A-3"],
      nowIso: NOW,
    });
    expect(queue?.selectedCodeTaskIds).toEqual(["CODE-A-1", "CODE-A-2", "CODE-A-3"]);
  });

  it("cursor request includes codeTaskId", () => {
    const built = buildCodeTaskCursorExecutionRequest({
      projectId: "p1",
      run: {
        version: "code_task_execution_run_v1",
        runId: "r1",
        projectId: "p1",
        processTaskId: "DEV-COMMON-001",
        workItemId: "wi-1",
        codeTaskId: "CODE-A-1",
        status: "queued",
        attemptNo: 1,
        developerPrompt: "p",
        createdAt: NOW,
        updatedAt: NOW,
      },
      codeTask: samplePlan().tasks[0]!,
      workItem: {
        id: "wi-1",
        taskId: "DEV-COMMON-001",
        codeTaskId: "CODE-A-1",
        role: "developer",
        title: "t",
        status: "ready",
        requiredFilesHint: [],
      },
      targetRepository: {
        repoFullName: "org/repo",
        defaultBranch: "main",
        provider: "github",
      },
      baseBranch: "main",
    });
    expect(built.requestBody.codeTaskId).toBe("CODE-A-1");
  });

  it("uses code-task scope label instead of process-task wording", () => {
    const detail = buildCodeTaskInlineExecutionDetail({
      progress: {
        status: "idle",
        statusLabel: "대기",
        selectedTaskId: "OTHER",
        compactSteps: [],
      },
      parentTaskId: "DEV-COMMON-001",
      isSelected: true,
    });
    expect(detail?.scopeLine).toBe(CODE_TASK_INLINE_SCOPE_LABEL);
    expect(detail?.scopeLine).not.toContain("Process Task");
  });

  it("exposes quick run chip label for selected code tasks", () => {
    expect(IMPLEMENTATION_QUICK_RUN_CHIP).toBe("선택한 CodeTask 실행");
  });

  it("formats overview with code task progress lines", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleList() },
    })!;
    const overview = buildImplementationExecutionOverview({
      board,
      codeTaskPlan: samplePlan(),
      activeCodeTaskTitle: "UI component",
    });
    const text = formatImplementationExecutionOverviewLines(overview, {
      selectedCodeTaskCount: 2,
    }).join("\n");
    expect(text).toContain("CodeTask 진행:");
    expect(text).toContain("현재 CodeTask:");
    expect(text).toContain("선택됨: 2개");
    expect(text).not.toMatch(/^현재: /m);
  });

  it("aggregates process task summary from child code task rows", () => {
    const plan = samplePlan();
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleList() },
    })!;
    const views = plan.tasks.map((codeTask) => buildCodeTaskRowView({ codeTask, codeTaskPlan: plan }));
    views[0] = { ...views[0]!, statusTone: "success", collapsedSummary: "완료" };
    views[1] = { ...views[1]!, statusTone: "running", collapsedSummary: "실행 중" };
    const summary = summarizeCodeTaskRowViewsForProcess(views);
    expect(summary).toContain("CodeTask 4개");
    expect(summary).toContain("완료 1");
    expect(summary).toContain("실행 중 1");

    const nodes = buildImplementationProcessTaskTreeNodes({
      board,
      codeTaskPlan: plan,
      checkedCodeTaskIds: normalizeSelectedCodeTaskIds({ codeTaskPlan: plan }),
    });
    expect(nodes[0]?.collapsedSummary).toContain("CodeTask 4개");
    expect(nodes[0]?.canRestart).toBe(false);
  });
});
