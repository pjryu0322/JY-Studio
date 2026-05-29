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
  buildImplementationExecutionBoardSummaryView,
  collapseImplementationBoardChatMessagesForPanelView,
  dedupeImplementationStageNextActions,
  hasImplementationExecutionBoardOrchestrationData,
  isLongImplementationBoardChatMessage,
  resolveImplementationExecutionBoardSelectedTaskId,
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
    expect(summary.cursorAvailability.status).toBe("missing_workspace");
    expect(summary.envPills.some((pill) => pill.label === "Cursor")).toBe(true);
    expect(summary.envDiagnosticLines.length).toBeGreaterThan(0);
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
    expect(actions.some((action) => action.actionId === "REQUEST_CODE_AGENT_WIP")).toBe(true);
    expect(actions[0]?.actionId).toBeTruthy();
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
});
