import { describe, expect, it, vi } from "vitest";
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
  buildImplementationTaskTreeNodes,
  buildTaskCursorPollStatusLabel,
  findLatestTaskCursorPollTickForTask,
  buildMobileBoardEnvPills,
  buildTaskRowCardView,
  collapseImplementationBoardChatMessagesForPanelView,
  filterImplementationDashboardChatMessages,
  isImplementationDashboardInterventionMessage,
  shouldShowImplementationDashboardChatMessage,
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
    expect(partitioned.primary?.actionId).toBe("START_IMPLEMENTATION_QUICK_RUN");
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
    expect(buildCompactBoardSummaryLine(board)).toContain("2/2");
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
    expect(collapsed.some((m) => m.id === compact.id)).toBe(false);
    expect(collapsed.some((m) => m.id === "u1")).toBe(true);
  });

  it("keeps intervention AI messages when dashboard panel is active", () => {
    const failureNotice = newRequirementsMessage({
      id: "fail1",
      role: "ai",
      content: "Task Cursor 실행 오류: 서버 연결이 끊어졌습니다.",
      createdAt: NOW,
      meta: { internalType: "PROTOTYPE_EXECUTION_NOTICE" },
    });
    const previewComplete = newRequirementsMessage({
      id: "done1",
      role: "ai",
      content: "프로토타입 생성이 완료되었습니다.\nPreview URL에서 결과를 확인할 수 있습니다.",
      createdAt: NOW,
      meta: { internalType: "IMPLEMENTATION_TASK_LIST_READY_V1" },
    });
    const filtered = filterImplementationDashboardChatMessages(
      [failureNotice, previewComplete],
      true,
    );
    expect(filtered.map((m) => m.id)).toEqual(["fail1", "done1"]);
    expect(
      isImplementationDashboardInterventionMessage("자동실행이 중단되었습니다. 보안 점검에서 수정 필요"),
    ).toBe(true);
    expect(
      shouldShowImplementationDashboardChatMessage(
        newRequirementsMessage({
          id: "routine",
          role: "ai",
          content: "구현 작업 보드가 준비되었습니다.",
          createdAt: NOW,
          meta: { internalType: "IMPLEMENTATION_TASK_LIST_READY_V1" },
        }),
      ),
    ).toBe(false);
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

  it("derives poll status label from latest task_cursor_poll_tick timeline entry", () => {
    const timeline = [
      {
        id: "log-1",
        action: "task_cursor_poll_tick",
        createdAt: "2026-05-31T10:04:00.000Z",
        responseText: "type=task_cursor_poll_tick taskId=DEV-FEATURE-004 round=4 agentStatus=RUNNING executionStatus=cursor_running",
      },
    ];
    expect(findLatestTaskCursorPollTickForTask(timeline, "DEV-FEATURE-004")).toEqual({
      round: 4,
      agentStatus: "RUNNING",
      executionStatus: "cursor_running",
      updatedAt: "2026-05-31T10:04:00.000Z",
    });
    const label = buildTaskCursorPollStatusLabel({
      taskId: "DEV-FEATURE-004",
      taskCursorExecution: {
        version: "task_cursor_execution_v1",
        projectId: "p1",
        taskId: "DEV-FEATURE-004",
        workItemIds: ["wi-1"],
        status: "cursor_running",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-feature-004",
        cursorRunId: "bc-12345678-1234-1234-1234-123456789012",
        createdAt: "2026-05-31T10:00:00.000Z",
        updatedAt: "2026-05-31T10:04:00.000Z",
      },
      promptTimeline: timeline,
      developerStatus: "in_progress",
    });
    expect(label).toContain("Cloud Agent 결과 확인 중");
    expect(label).toContain("4회");
    expect(label).toContain("RUNNING");
  });

  it("shows poll status and stop capability on active task tree node", () => {
    vi.stubEnv("NEXT_PUBLIC_TASK_CURSOR_POLLING_MODE", "client");
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleTaskList() },
    })!;
    const nodes = buildImplementationTaskTreeNodes({
      board,
      activeTaskId: "DEV-SCREEN-002",
      taskCursorExecution: {
        version: "task_cursor_execution_v1",
        projectId: "p1",
        taskId: "DEV-SCREEN-002",
        workItemIds: ["wi-1"],
        status: "cursor_running",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-screen-002",
        cursorRunId: "bc-abcdef12-3456-7890-abcd-ef1234567890",
        createdAt: NOW,
        updatedAt: NOW,
      },
      promptTimeline: [
        {
          id: "log-2",
          action: "task_cursor_poll_tick",
          createdAt: NOW,
          responseText:
            "type=task_cursor_poll_tick taskId=DEV-SCREEN-002 round=2 agentStatus=RUNNING executionStatus=cursor_running",
        },
      ],
    });
    const node = nodes.find((item) => item.taskId === "DEV-SCREEN-002");
    expect(node?.pollStatusLabel).toContain("2회");
    expect(node?.canStop).toBe(true);
    expect(node?.restartBlockedReason).toBeUndefined();
  });
});
