import { describe, expect, it } from "vitest";
import {
  buildImplementationExecutionBoardFromRequirementsState,
  pickFirstExecutableDeveloperTaskId,
} from "@/lib/prototype/implementationExecutionBoard";
import {
  buildCompactImplementationExecutionBoardNoticeMessage,
  buildImplementationExecutionBoardMessage,
} from "@/lib/prototype/implementationExecutionBoardMessage";
import {
  buildCompactBoardSummaryLine,
  buildImplementationExecutionBoardSummaryView,
  buildMobileBoardEnvPills,
  buildTaskRowCardView,
  collapseImplementationBoardChatMessagesForPanelView,
  dedupeImplementationStageNextActions,
  formatMobileCursorEnvPillValue,
  hasImplementationExecutionBoardOrchestrationData,
  isLongImplementationBoardChatMessage,
  partitionMobileBoardActions,
  resolveImplementationExecutionBoardSelectedTaskId,
  resolveNextTaskCardView,
  extractBoardVisibleActionLabels,
  filterBoardDuplicateChatInterviewSuggestions,
} from "@/lib/prototype/implementationExecutionBoardPanelView";
import { deriveImplementationStageNextActions } from "@/lib/prototype/implementationStageNextActions";
import { deriveImplementationStageStatus } from "@/lib/prototype/implementationStageStatus";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import { buildInitialImplementationTaskExecutionStateFromTaskList } from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";

const NOW = "2026-05-28T12:00:00.000Z";

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "quick_design_confirmed",
    tasks: [
      {
        taskId: "DEV-SCREEN-001",
        title: "업로드 화면",
        priority: "P1",
        dependencies: [],
        ownerRole: "developer",
        acceptanceCriteria: [],
        deliverables: [],
      },
      {
        taskId: "DEV-SCREEN-002",
        title: "결과 화면",
        priority: "P2",
        dependencies: ["DEV-SCREEN-001"],
        ownerRole: "developer",
        acceptanceCriteria: [],
        deliverables: [],
      },
    ],
    summary: {
      totalTasks: 2,
      developerTasks: 2,
      reviewerTasks: 0,
      securityTasks: 0,
      scmTasks: 0,
    },
  };
}

describe("implementationExecutionBoardPanelView", () => {
  it("detects orchestration data for board panel visibility", () => {
    const taskList = sampleTaskList();
    expect(
      hasImplementationExecutionBoardOrchestrationData({
        implementationTaskListV1: taskList,
      }),
    ).toBe(true);
  });

  it("builds board from requirements state projection", () => {
    const taskList = sampleTaskList();
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: {
        implementationTaskListV1: taskList,
        implementationTaskExecutionStateV1: buildInitialImplementationTaskExecutionStateFromTaskList({
          projectId: "p1",
          taskList,
          nowIso: NOW,
        }),
      },
    });
    expect(board).not.toBeNull();
    expect(board?.taskRows.length).toBe(2);
  });

  it("uses executionSetupRow availability in board summary", () => {
    const taskList = sampleTaskList();
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: taskList },
    })!;
    const summary = buildImplementationExecutionBoardSummaryView({
      board,
      executionSetup: {
        gitRepoUrl: "https://github.com/org/repo",
        gitRepoName: "repo",
        gitRepoProvider: "github",
        baseBranch: "main",
        hasCursorToken: true,
        hasGithubAccessToken: true,
      },
    });
    expect(summary.cursorAvailability.status).toBe("ready");
    expect(summary.cursorAvailability.workspaceAutoFromGit).toBe(true);
    expect(summary.envPills.some((pill) => pill.label === "Task Cursor")).toBe(true);
    expect(summary.taskCursorSetupReadiness.ready).toBe(false);
  });

  it("resolves selected task from wip execution when board has no current task", () => {
    const taskList = sampleTaskList();
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: taskList },
    })!;
    const boardWithoutCurrent = { ...board, currentTaskId: undefined };
    expect(
      resolveImplementationExecutionBoardSelectedTaskId({
        board: boardWithoutCurrent,
        codeAgentWipExecutionV1: {
          version: "code_agent_wip_execution_v1",
          projectId: "p1",
          branchName: "wip/test",
          requestedAt: NOW,
          provider: "cursor",
          status: "drafting",
          commits: [],
          refactorRequests: [],
          selectedTaskId: "DEV-SCREEN-002",
        },
      }),
    ).toBe("DEV-SCREEN-002");
    expect(pickFirstExecutableDeveloperTaskId(board)).toBe("DEV-SCREEN-001");
  });

  it("matches board panel and chat next action ids", () => {
    const taskList = sampleTaskList();
    const effective = resolveEffectiveImplementationState({
      parsedRequirementsState: { implementationTaskListV1: taskList },
      latestRun: null,
    });
    const boardInput = {
      projectId: "p1",
      taskList,
      executionState: null,
      integratedExecutionState: null,
      boardState: null,
      qualityGateResults: null,
      previewReady: false,
      codeAgentWipExecutionV1: null,
    };
    const actions = dedupeImplementationStageNextActions(
      deriveImplementationStageNextActions(
        deriveImplementationStageStatus(effective, null),
        null,
        null,
        boardInput,
      ),
    );
    const partitioned = partitionMobileBoardActions(actions);
    expect(partitioned.primary?.actionId).toBe("REQUEST_TASK_CURSOR_EXECUTION");
    expect(partitioned.secondary.length).toBeLessThanOrEqual(2);
  });

  it("formats mobile env pill for git-repo auto workspace", () => {
    expect(formatMobileCursorEnvPillValue("missing_workspace")).toBe("Workspace 필요");
    const pills = buildMobileBoardEnvPills({
      executionSetup: {
        gitRepoUrl: "https://github.com/org/repo",
        gitRepoName: "org/repo",
        hasGithubAccessToken: true,
        hasCursorToken: true,
      },
    });
    expect(pills.find((pill) => pill.label === "Task Cursor")?.value).toBe("검증 필요");
    expect(pills.find((pill) => pill.label === "검증")?.value).toBe("필요");
  });

  it("builds compact task row card view", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleTaskList() },
    })!;
    const card = buildTaskRowCardView(board.taskRows[0]!);
    expect(card.taskId).toBeTruthy();
    expect(card.developerStatusLabel).toContain("개발");
    expect(card.reviewerStatusLabel).toContain("검수");
  });

  it("resolves next task card in selection order", () => {
    const taskList = sampleTaskList();
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: taskList },
    })!;
    const fromWip = resolveNextTaskCardView({
      board: { ...board, currentTaskId: undefined },
      codeAgentWipExecutionV1: {
        version: "code_agent_wip_execution_v1",
        projectId: "p1",
        branchName: "wip/test",
        requestedAt: NOW,
        provider: "cursor",
        status: "drafting",
        commits: [],
        refactorRequests: [],
        selectedTaskId: "DEV-SCREEN-002",
      },
    });
    expect(fromWip?.taskId).toBe("DEV-SCREEN-002");
  });

  it("builds compact summary line", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleTaskList() },
    })!;
    expect(buildCompactBoardSummaryLine(board)).toContain("전체 2");
  });

  it("collapses long stale board chat messages when panel is active", () => {
    const longBoard = buildImplementationExecutionBoardMessage({
      board: buildImplementationExecutionBoardFromRequirementsState({
        projectId: "p1",
        orchestration: { implementationTaskListV1: sampleTaskList() },
      })!,
      nowIso: NOW,
    });
    expect(isLongImplementationBoardChatMessage(longBoard.content)).toBe(true);
    const compact = buildCompactImplementationExecutionBoardNoticeMessage({
      board: buildImplementationExecutionBoardFromRequirementsState({
        projectId: "p1",
        orchestration: { implementationTaskListV1: sampleTaskList() },
      })!,
      nowIso: NOW,
    });
    const collapsed = collapseImplementationBoardChatMessagesForPanelView(
      [longBoard, compact, newRequirementsMessage({ id: "u1", role: "user", content: "hi", createdAt: NOW })],
      true,
    );
    expect(collapsed.some((m) => m.id === longBoard.id)).toBe(false);
    expect(collapsed.some((m) => m.id === compact.id)).toBe(true);
    expect(collapsed.some((m) => m.id === "u1")).toBe(true);
  });

  it("extracts board-visible action labels from primary and secondary actions", () => {
    const taskList = sampleTaskList();
    const effective = resolveEffectiveImplementationState({
      parsedRequirementsState: { implementationTaskListV1: taskList },
      latestRun: null,
    });
    const boardInput = {
      projectId: "p1",
      taskList,
      executionState: null,
      integratedExecutionState: null,
      boardState: null,
      qualityGateResults: null,
      previewReady: false,
      codeAgentWipExecutionV1: null,
    };
    const actions = dedupeImplementationStageNextActions(
      deriveImplementationStageNextActions(
        deriveImplementationStageStatus(effective, null),
        null,
        null,
        boardInput,
      ),
    );
    const labels = extractBoardVisibleActionLabels(actions);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThanOrEqual(3);
    expect(labels[0]).toBe(partitionMobileBoardActions(actions).primary?.label);
  });

  it("filters chat interview suggestions duplicated on the board", () => {
    const primaryLabel = "[생성요청]";
    const message = newRequirementsMessage({
      id: "ai1",
      role: "ai",
      content: "다음 단계",
      createdAt: NOW,
      meta: { interviewSuggestions: [primaryLabel, "환경설정 열기"] },
    });
    const filtered = filterBoardDuplicateChatInterviewSuggestions([message], true, [primaryLabel]);
    expect((filtered[0]?.meta as { interviewSuggestions?: string[] }).interviewSuggestions).toEqual([
      "환경설정 열기",
    ]);
  });
});
