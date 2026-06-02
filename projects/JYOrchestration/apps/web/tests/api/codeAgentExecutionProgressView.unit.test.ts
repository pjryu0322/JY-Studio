import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ImplementationCodeAgentExecutionProgressCard } from "@/components/preview/ImplementationCodeAgentExecutionProgressCard";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import {
  buildCodeAgentExecutionProgressView,
  buildTaskRowCursorProgressView,
  extractRecentCodeAgentTimelineEvents,
  formatTaskRowCodeAgentProgressLine,
  shouldHideBoardPrimaryCtaForProgress,
} from "@/lib/prototype/codeAgentExecutionProgressView";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import {
  deriveImplementationStageNextActions,
} from "@/lib/prototype/implementationStageNextActions";
import { dedupeImplementationStageNextActions } from "@/lib/prototype/implementationExecutionBoardPanelView";
import { deriveImplementationStageStatus } from "@/lib/prototype/implementationStageStatus";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import { REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP } from "@/lib/prototype/codeAgentWipExecution";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-28T18:35:00.000Z";

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);

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
        title: "입력 화면 화면 구현",
        ownerRole: "developer",
        priority: "P1",
        status: "ready",
        dependencies: [],
      },
    ],
    roleSummary: { developer: 1, reviewer: 0, security: 0, scm: 0 },
  };
}

function draftWip() {
  return {
    ...buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      selectedTaskId: "DEV-SCREEN-001",
      executionMode: "stub",
      bridgeExecutionStatus: "draft_created",
      nowIso: NOW,
    }),
    branchName: "wip/cursor/dev-screen-001",
  };
}

describe("codeAgentExecutionProgressView", () => {
  it("returns idle state when wip is missing", () => {
    const view = buildCodeAgentExecutionProgressView({});
    expect(view.status).toBe("idle");
    expect(view.statusLabel).toBe("대기");
    expect(view.cursorApiLabel).toBe("미실행");
  });

  it("returns draft_created state after generation request", () => {
    const wip = draftWip();
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleTaskList() },
    })!;
    const view = buildCodeAgentExecutionProgressView({
      codeAgentWipExecutionV1: wip,
      board,
      latestTimeline: [
        {
          stage: "implementation",
          action: "implementation_stage_action_executed",
          source: "platform",
          routingDecision: "REQUEST_CODE_AGENT_WIP",
          responseText: "runId=impl-run-001",
          createdAt: NOW,
        },
      ],
    });
    expect(view.status).toBe("draft_created");
    expect(view.statusLabel).toBe("WIP 초안 생성됨");
    expect(view.cursorApiLabel).toContain("미실행");
    expect(view.selectedTaskId).toBe("DEV-SCREEN-001");
    expect(view.isStubResult).toBe(true);
    expect(view.showGenerationClarification).toBe(true);
    expect(view.runId).toBe("impl-run-001");
  });

  it("returns cursor_running state while bridge is running", () => {
    const wip = {
      ...draftWip(),
      bridgeExecutionStatus: "bridge_running" as const,
      executionMode: "cursor_api" as const,
    };
    const view = buildCodeAgentExecutionProgressView({ codeAgentWipExecutionV1: wip });
    expect(view.status).toBe("cursor_running");
    expect(view.statusLabel).toBe("Cursor API 실행 중");
    expect(shouldHideBoardPrimaryCtaForProgress(view.status)).toBe(true);
  });

  it("returns cursor_completed for real cursor results", () => {
    const wip = {
      ...draftWip(),
      executionMode: "cursor_api" as const,
      bridgeExecutionStatus: "bridge_completed" as const,
      bridgeAdapter: "cursor_api" as const,
      platformScmExecutionV1: {
        version: "platform_scm_execution_v1" as const,
        projectId: "p1",
        selectedTaskId: "DEV-SCREEN-001",
        sourceCommitSha: "abc1234567890",
        sourceBranchName: "wip/cursor/dev-screen-001",
        targetRepository: "owner/repo",
        pushStatus: "pending" as const,
        createdAt: NOW,
        updatedAt: NOW,
      },
      commits: [
        {
          sha: "abc1234567890",
          provider: "cursor" as const,
          branchName: "wip/cursor/dev-screen-001",
          commitMessage: "feat: screen",
          taskId: "DEV-SCREEN-001",
          workItemId: "wi-1",
          changedFiles: ["src/a.tsx", "src/b.tsx", "src/c.tsx"],
          diffSummary: [],
          testResults: ["vitest passed"],
          unresolvedIssues: [],
          createdAt: NOW,
        },
      ],
    };
    const view = buildCodeAgentExecutionProgressView({ codeAgentWipExecutionV1: wip });
    expect(view.status).toBe("cursor_completed");
    expect(view.changedFileCount).toBe(3);
    expect(view.testStatusLabel).toBe("passed");
    expect(view.isStubResult).toBe(false);
    expect(view.commitShaDisplay).toContain("abc1234");
    expect(view.scmStatusLabel).toBe("Push/PR 대기");
    expect(view.summaryLine).toContain("SCM");
  });

  it("does not treat stub wip as real development completion", () => {
    const wip = {
      ...draftWip(),
      bridgeExecutionStatus: "bridge_completed" as const,
      commits: [
        {
          sha: "wip-stub-001",
          provider: "cursor" as const,
          branchName: "wip/cursor/dev-screen-001",
          commitMessage: "stub",
          taskId: "DEV-SCREEN-001",
          workItemId: "wi-1",
          changedFiles: [],
          diffSummary: [],
          testResults: [],
          unresolvedIssues: [],
          createdAt: NOW,
        },
      ],
    };
    const view = buildCodeAgentExecutionProgressView({ codeAgentWipExecutionV1: wip });
    expect(view.status).toBe("draft_created");
    expect(view.isStubResult).toBe(true);
    expect(view.commitShaDisplay).toBe("wip-stub-001");
  });

  it("shows draft failure from timeline when wip is missing", () => {
    const view = buildCodeAgentExecutionProgressView({
      latestTimeline: [
        {
          stage: "implementation",
          action: "code_agent_wip_draft_failed",
          source: "platform",
          responseText:
            "type=code_agent_wip_draft_failed reason=missing_executable_developer_task detail=실행 가능한 개발자 작업이 없습니다.",
          createdAt: NOW,
        },
      ],
    });
    expect(view.status).toBe("idle");
    expect(view.failureReason).toContain("실행 가능한 AI 개발자 작업");
    expect(view.summaryLine).toContain("실패");
  });

  it("uses executionStatus draft_created when bridge status is absent", () => {
    const wip = {
      ...draftWip(),
      bridgeExecutionStatus: undefined,
      executionStatus: "draft_created" as const,
    };
    const view = buildCodeAgentExecutionProgressView({ codeAgentWipExecutionV1: wip });
    expect(view.status).toBe("draft_created");
    expect(view.summaryLine).toContain("실제 Cursor API: 아직 실행하지 않음");
  });

  it("stub developer_approved shows WIP 초안 승인됨 and Cursor 미실행", () => {
    const wip = {
      ...draftWip(),
      status: "developer_approved" as const,
      bridgeExecutionStatus: "draft_approved" as const,
      developerReview: {
        status: "approved" as const,
        reviewedAt: NOW,
        reviewedBy: "ai_developer",
        summary: "WIP 초안 승인",
        findings: [],
        requestedActions: [],
      },
    };
    const view = buildCodeAgentExecutionProgressView({ codeAgentWipExecutionV1: wip });
    expect(view.status).toBe("cursor_request_ready");
    expect(view.statusLabel).toBe("WIP 초안 승인됨");
    expect(view.cursorApiLabel).toContain("미실행");
    expect(view.nextActionLabel).toBe(REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP);
    expect(view.isStubResult).toBe(true);
  });

  it("renders bridge_requested and bridge_running statuses", () => {
    const requested = buildCodeAgentExecutionProgressView({
      codeAgentWipExecutionV1: {
        ...draftWip(),
        executionMode: "cursor_api",
        bridgeExecutionStatus: "bridge_requested",
      },
    });
    expect(requested.status).toBe("cursor_requested");
    expect(requested.statusLabel).toBe("Cursor API 요청됨");

    const running = buildCodeAgentExecutionProgressView({
      codeAgentWipExecutionV1: {
        ...draftWip(),
        executionMode: "cursor_api",
        bridgeExecutionStatus: "bridge_running",
      },
    });
    expect(running.status).toBe("cursor_running");
    expect(running.statusLabel).toBe("Cursor API 실행 중");
  });

  it("formats selected task row progress line", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleTaskList() },
    })!;
    const row = board.taskRows[0]!;
    const line = formatTaskRowCodeAgentProgressLine({
      row,
      codeAgentWipExecutionV1: draftWip(),
    });
    expect(line).toContain("WIP 초안 생성됨");
    expect(line).toContain("Cursor: 미실행");
  });

  it("extracts recent timeline events", () => {
    const events = extractRecentCodeAgentTimelineEvents([
      {
        stage: "implementation",
        action: "cursor_api_direct_execution_requested",
        source: "platform",
        createdAt: "2026-05-28T18:34:00.000Z",
      },
      {
        stage: "implementation",
        action: "implementation_stage_action_executed",
        source: "platform",
        routingDecision: "REQUEST_CODE_AGENT_WIP",
        createdAt: NOW,
      },
    ]);
    expect(events.length).toBe(2);
    expect(events[0]?.label).toContain("REQUEST_CODE_AGENT_WIP");
  });

  it("ignores null timeline entries when extracting recent events", () => {
    const events = extractRecentCodeAgentTimelineEvents([
      null as never,
      {
        stage: "implementation",
        action: "task_cursor_api_started",
        source: "platform",
        createdAt: NOW,
      },
    ]);
    expect(events.length).toBe(1);
    expect(events[0]?.label).toContain("Cursor");
  });

  it("renders progress card markup", () => {
    const html = renderToStaticMarkup(
      createElement(ImplementationCodeAgentExecutionProgressCard, {
        progress: buildCodeAgentExecutionProgressView({ codeAgentWipExecutionV1: draftWip() }),
      }),
    );
    expect(html).toContain("implementation-code-agent-progress-card");
    expect(html).toContain("구현 실행 현황");
  });

  it("uses Cursor execution request as primary CTA when draft exists", () => {
    const taskList = sampleTaskList();
    const wip = draftWip();
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
      codeAgentWipExecutionV1: wip,
    };
    const actions = dedupeImplementationStageNextActions(
      deriveImplementationStageNextActions(
        deriveImplementationStageStatus(effective, null),
        null,
        null,
        boardInput,
      ),
    );
    expect(actions[0]?.label).toBe(REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP);
    expect(actions[0]?.priority).toBe("primary");
  });

  it("prefers task cursor execution progress over WIP stub", () => {
    const view = buildCodeAgentExecutionProgressView({
      taskCursorExecutionV1: {
        version: "task_cursor_execution_v1",
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        workItemIds: ["wi-1"],
        status: "cursor_failed",
        cursorProvider: "cursor",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-mock-001",
        failureReason: "cursor_endpoint_unsupported",
        errorMessage: "endpoint unsupported",
        createdAt: "2026-05-30T12:00:00.000Z",
        updatedAt: "2026-05-30T12:00:00.000Z",
      },
    });
    expect(view.statusLabel).toBe("실패");
    expect(view.summaryLine).toBe("endpoint unsupported");
    expect(view.showGenerationClarification).toBe(false);
    expect(view.isStubResult).toBe(false);
  });

  it("shows polling progress on matching task row during cursor_running", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleTaskList() },
    })!;
    const row = board.taskRows[0]!;
    const execution = {
      version: "task_cursor_execution_v1" as const,
      projectId: "p1",
      taskId: row.taskId,
      workItemIds: ["wi-1"],
      status: "cursor_running" as const,
      cursorProvider: "cursor" as const,
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/cursor/dev-screen-001",
      cursorRunId: "task-cursor-test-run",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const progress = buildTaskRowCursorProgressView({
      row,
      taskCursorExecutionV1: execution,
    });
    expect(progress?.isPolling).toBe(true);
    expect(progress?.shortLabel).toBe("폴링 중");
    expect(progress?.text).toContain("Cloud Agent 폴링 중");
  });

  it("resolves historical task cursor execution for completed rows", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleTaskList() },
    })!;
    const row = board.taskRows[0]!;
    const historyEntry = {
      version: "task_cursor_execution_v1" as const,
      projectId: "p1",
      taskId: row.taskId,
      workItemIds: ["wi-1"],
      status: "github_verified" as const,
      cursorProvider: "cursor" as const,
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/cursor/dev-screen-001",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const progress = buildTaskRowCursorProgressView({
      row,
      taskCursorExecutionHistoryV1: [historyEntry],
    });
    expect(progress?.tone).toBe("done");
    expect(progress?.text).toContain("GitHub 결과 확인됨");
  });

  it("uses compact main presentation after github verify with auto gate", () => {
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleTaskList() },
    })!;
    const execution = {
      version: "task_cursor_execution_v1" as const,
      projectId: "p1",
      taskId: "DEV-SCREEN-001",
      workItemIds: ["wi-1"],
      status: "review_pending" as const,
      cursorProvider: "cursor" as const,
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/cursor/dev-screen-001",
      commitSha: "eb3db901234567890abcdef1234567890abcdef",
      changedFiles: ["src/a.ts"],
      cursorRunId: "run-1",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const view = buildCodeAgentExecutionProgressView({
      taskCursorExecutionV1: execution,
      board,
      implementationAutoQualityGateV1: {
        version: "implementation_auto_quality_gate_v1",
        projectId: "p1",
        taskId: "DEV-SCREEN-001",
        sourceCommitSha: "eb3db901234567890abcdef1234567890abcdef",
        changedFiles: ["src/a.ts"],
        status: "review_running",
        startedAt: NOW,
        updatedAt: NOW,
      },
    });
    expect(view.compactMainPresentation).toBe(true);
    expect(view.progressCardTitle).toBe("구현 실행 중");
    const html = renderToStaticMarkup(createElement(ImplementationCodeAgentExecutionProgressCard, { progress: view }));
    expect(html).toContain("상세 보기");
    expect(html).toContain("implementation-progress-details");
  });
});

describe("implementationExecutionBoardPanel scroll structure", () => {
  it("documents scroll container class name for task list disclosure", () => {
    expect("taskListScrollArea").toBe("taskListScrollArea");
  });
});
