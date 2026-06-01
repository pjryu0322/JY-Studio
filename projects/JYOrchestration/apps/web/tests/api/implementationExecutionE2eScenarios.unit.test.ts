import { describe, expect, it } from "vitest";
import {
  evaluateImplementationCodeTaskQualityGate,
  type ImplementationCodeTaskQualityGateV1,
} from "@/lib/prototype/implementationCodeTaskQualityGate";
import {
  updateImplementationCodeTaskExecutionFeedback,
} from "@/lib/prototype/implementationCodeTaskExecutionFeedback";
import {
  buildImplementationPlanningReadinessPatch,
  buildImplementationExecutionBlockedByPlanningGateTimelineEntry,
  evaluateImplementationPlanningExecutionGate,
  IMPLEMENTATION_PLANNING_CODE_TASK_QUALITY_FAILED_MESSAGE,
  IMPLEMENTATION_PLANNING_MISSING_CODE_TASK_QUALITY_MESSAGE,
} from "@/lib/prototype/implementationPlanningReadiness";
import { buildImplementationPlanningReadinessCardVM } from "@/lib/prototype/implementationPlanningReadinessUi";
import {
  buildImplementationCodeTaskReworkVm,
  formatCodeTaskReworkBoardSummaryLine,
  resolveCodeTaskReworkRecommendedAction,
} from "@/lib/prototype/implementationCodeTaskReworkVm";
import {
  buildTaskCursorFailedOrchestrationPatch,
  buildTaskCursorGithubVerifyTimeline,
  buildTaskCursorOrchestrationPatch,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import { mergeOrchestrationPatchIntoRequirementsState } from "@/lib/prototype/taskCursorJobStateSync";
import { resolveTaskCursorAutoChainDecision } from "@/lib/prototype/implementationTaskCursorAutoChain";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { resolveTaskCursorFailurePolicy } from "@/lib/prototype/taskCursorFailurePolicy";
import {
  IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
  type ImplementationCodeTaskPlanV1,
  type ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import { TASK_CURSOR_EXECUTION_VERSION } from "@/lib/prototype/taskCursorExecution";

const NOW = "2026-05-28T12:00:00.000Z";
const PROJECT_ID = "p-e2e-feedback";

function developerTask(taskId: string, deps: string[] = []): ImplementationTaskV1 {
  return {
    taskId,
    title: taskId,
    description: taskId,
    taskType: "screen",
    ownerRole: "developer",
    priority: "medium",
    status: "ready",
    dependencies: deps,
    acceptanceCriteria: [`${taskId} acceptance`],
    sourceRefs: [],
  };
}

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: PROJECT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks: [developerTask("DEV-SCREEN-001"), developerTask("DEV-SCREEN-002")],
    roleSummary: { developer: 2, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

function healthyCodeTask(overrides?: Partial<ImplementationCodeTaskV1>): ImplementationCodeTaskV1 {
  return {
    codeTaskId: "CODE-DEV-SCREEN-001-001",
    parentTaskId: "DEV-SCREEN-001",
    title: "Screen component",
    description: "Implement screen UI component",
    changeType: "component",
    targetHints: ["components"],
    candidateFileHints: ["dir:apps/web/src/components/screen"],
    dependencies: [],
    parentTaskDependencies: [],
    codeTaskDependencies: [],
    acceptanceCriteria: ["Screen renders primary layout"],
    verificationHints: ["pnpm test screen"],
    forbiddenPaths: ["package.json"],
    priority: "P1",
    status: "ready",
    blockers: [],
    ...overrides,
  };
}

function healthyTestCodeTask(): ImplementationCodeTaskV1 {
  return {
    ...healthyCodeTask({
      codeTaskId: "CODE-DEV-SCREEN-001-002",
      changeType: "test",
      title: "Screen test",
      description: "Add screen component test",
      candidateFileHints: ["dir:apps/web/tests"],
      acceptanceCriteria: ["Screen test passes"],
      verificationHints: ["pnpm test screen.spec"],
    }),
  };
}

function samplePlan(tasks: readonly ImplementationCodeTaskV1[]): ImplementationCodeTaskPlanV1 {
  return {
    version: IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
    projectId: PROJECT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_task_list",
    parentTaskCount: 1,
    codeTaskCount: tasks.length,
    tasks,
    readiness: { ready: true, missing: [] },
    validationReport: { status: "passed", checkedAt: NOW, errors: [], warnings: [] },
  };
}

function workItem(codeTaskId: string, id: string, taskId = "DEV-SCREEN-001"): CursorWorkItem {
  return {
    id,
    taskId,
    codeTaskId,
    title: id,
    prompt: "prompt",
    requiredFilesHint: [],
    expectedOutput: [],
    testCommands: [],
    forbiddenPaths: [],
    blocked: false,
    blockers: [],
    qualityGate: { score: 1, promptReady: true, missing: [] },
    originStage: "planning",
  };
}

describe("implementation execution e2e scenarios", () => {
  it("1-1 passes planning gate and stores passed feedback after github verify success", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const gate = evaluateImplementationPlanningExecutionGate({
      codeTaskPlan: readiness.implementationCodeTaskPlanV1,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
      codeTaskQualityGate: readiness.implementationCodeTaskQualityGateV1,
    });
    expect(gate.ok).toBe(true);

    const selected = [workItem("CODE-A", "wi-a")];
    const execution = {
      version: TASK_CURSOR_EXECUTION_VERSION,
      projectId: PROJECT_ID,
      taskId: "DEV-SCREEN-001",
      workItemIds: ["wi-a"],
      status: "review_pending",
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/dev",
      commitSha: "abc123",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const patch = buildTaskCursorOrchestrationPatch({
      execution,
      cursorWorkItems: selected,
      timelineEntries: [
        buildTaskCursorGithubVerifyTimeline({ execution, ok: true, nowIso: NOW }),
      ],
    });
    expect(patch.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.status).toBe(
      "passed",
    );
    expect(patch.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.lastCommitSha).toBe(
      "abc123",
    );
    expect(
      patch.promptTimeline.some((entry) => entry.action === "task_cursor_github_verified"),
    ).toBe(true);
  });

  it("1-2 blocks cursor launch on preflight failure and stores feedback/diagnosis", () => {
    const selected = [workItem("CODE-A", "wi-a"), workItem("CODE-B", "wi-b")];
    const execution = {
      version: TASK_CURSOR_EXECUTION_VERSION,
      projectId: PROJECT_ID,
      taskId: "DEV-SCREEN-001",
      workItemIds: ["wi-a", "wi-b"],
      status: "requested",
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/dev",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const patch = buildTaskCursorFailedOrchestrationPatch({
      execution,
      message: "preflight failed",
      reason: "work_item_preflight_failed",
      cursorWorkItems: selected,
      nowIso: NOW,
    });
    expect(patch.taskCursorExecutionV1.status).toBe("cursor_failed");
    expect(patch.taskCursorExecutionV1.failureReason).toBe("work_item_preflight_failed");
    expect(patch.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.status).toBe(
      "failed",
    );
    expect(
      patch.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.lastCauseLayer,
    ).toBe("work_item_preflight");
    expect(
      patch.promptTimeline.some(
        (entry) => entry.action === "implementation_code_task_failure_diagnosed",
      ),
    ).toBe(true);
    expect(
      resolveTaskCursorFailurePolicy({ failureReason: "work_item_preflight_failed" })
        .canContinueIndependentTasks,
    ).toBe(true);
  });

  it("1-3 stores github verify failure feedback and allows independent task continuation", () => {
    const selected = [workItem("CODE-A", "wi-a")];
    const execution = {
      version: TASK_CURSOR_EXECUTION_VERSION,
      projectId: PROJECT_ID,
      taskId: "DEV-SCREEN-001",
      workItemIds: ["wi-a"],
      status: "github_verify_failed",
      failureReason: "github_verify_failed",
      errorMessage: "branch missing",
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/dev",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const patch = buildTaskCursorOrchestrationPatch({
      execution,
      cursorWorkItems: selected,
      timelineEntries: [
        buildTaskCursorGithubVerifyTimeline({
          execution,
          ok: false,
          reason: "branch missing",
          nowIso: NOW,
        }),
      ],
      nowIso: NOW,
    });
    expect(patch.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.status).toBe(
      "failed",
    );
    expect(
      patch.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.lastCauseLayer,
    ).toBe("github_verify");

    const dependentList: ImplementationTaskListV1 = {
      ...sampleTaskList(),
      tasks: [
        developerTask("DEV-SCREEN-001"),
        developerTask("DEV-SCREEN-002", ["DEV-SCREEN-001"]),
      ],
      roleSummary: { developer: 2, designer: 0, reviewer: 0, security: 0, scm: 0 },
    };
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: PROJECT_ID,
      orchestration: { implementationTaskListV1: dependentList },
    })!;
    const decision = resolveTaskCursorAutoChainDecision({
      board,
      taskCursorExecution: execution,
      autoGate: null,
    });
    expect(decision.kind).toBe("continue_after_failure");
    if (decision.kind !== "continue_after_failure") return;
    expect(decision.blockedTaskIds).toContain("DEV-SCREEN-002");

    const rework = buildImplementationCodeTaskReworkVm({
      feedback: patch.implementationCodeTaskExecutionFeedbackV1,
      codeTaskPlan: samplePlan([healthyCodeTask(), healthyTestCodeTask()]),
    });
    expect(rework?.candidates[0]?.recommendedAction).toBe("check_github");
    expect(formatCodeTaskReworkBoardSummaryLine(rework)).toContain("재작업 후보 1개");
  });

  it("1-4 blocks execution when quality gate failed", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const failedQualityGate: ImplementationCodeTaskQualityGateV1 = {
      ...readiness.implementationCodeTaskQualityGateV1,
      status: "failed",
      errorCount: 1,
      issues: [
        {
          codeTaskId: "CODE-1",
          parentTaskId: "DEV-SCREEN-001",
          severity: "error",
          issueCode: "too_broad",
          message: "too broad",
        },
      ],
    };
    const gate = evaluateImplementationPlanningExecutionGate({
      codeTaskPlan: readiness.implementationCodeTaskPlanV1,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
      codeTaskQualityGate: failedQualityGate,
    });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.reason).toBe("code_task_quality_failed");
    expect(gate.message).toBe(IMPLEMENTATION_PLANNING_CODE_TASK_QUALITY_FAILED_MESSAGE);
    expect(
      buildImplementationExecutionBlockedByPlanningGateTimelineEntry({
        projectId: PROJECT_ID,
        reason: gate.reason,
      }).action,
    ).toBe("implementation_execution_blocked_by_code_task_quality");
  });

  it("1-5 allows execution when quality gate is warning", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const warningGate: ImplementationCodeTaskQualityGateV1 = {
      ...readiness.implementationCodeTaskQualityGateV1,
      status: "warning",
      warningCount: 1,
      issueCount: 1,
      issues: [
        {
          codeTaskId: readiness.implementationCodeTaskPlanV1.tasks[0]?.codeTaskId ?? "CODE-1",
          parentTaskId: "DEV-SCREEN-001",
          severity: "warning",
          issueCode: "missing_test_task",
          message: "test task missing",
        },
      ],
    };
    const gate = evaluateImplementationPlanningExecutionGate({
      codeTaskPlan: readiness.implementationCodeTaskPlanV1,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
      codeTaskQualityGate: warningGate,
    });
    expect(gate.ok).toBe(true);
    const vm = buildImplementationPlanningReadinessCardVM({
      codeTaskPlan: readiness.implementationCodeTaskPlanV1,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
      codeTaskQualityGate: warningGate,
    });
    expect(vm?.executionReady).toBe(true);
    expect(vm?.overallLabel).toBe("준비됨 · 경고 있음");
    expect(vm?.attentionItems.length).toBeGreaterThan(0);
    expect(vm?.supplementReasons.some((reason) => reason.includes("test task missing"))).toBe(false);
  });

  it("1-6 blocks execution when quality gate is missing", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const gate = evaluateImplementationPlanningExecutionGate({
      codeTaskPlan: readiness.implementationCodeTaskPlanV1,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
      codeTaskQualityGate: null,
    });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.reason).toBe("missing_code_task_quality");
    expect(gate.message).toBe(IMPLEMENTATION_PLANNING_MISSING_CODE_TASK_QUALITY_MESSAGE);
  });
});

describe("worker terminal feedback preservation", () => {
  it("preserves prior failed feedback when auto-chain patch merges with existing feedback", () => {
    const selectedA = [workItem("CODE-A", "wi-a", "DEV-SCREEN-001")];
    const failedExecution = {
      version: TASK_CURSOR_EXECUTION_VERSION,
      projectId: PROJECT_ID,
      taskId: "DEV-SCREEN-001",
      workItemIds: ["wi-a"],
      status: "github_verify_failed",
      failureReason: "github_verify_failed",
      errorMessage: "verify failed",
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/dev",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const terminalPatch = buildTaskCursorOrchestrationPatch({
      execution: failedExecution,
      cursorWorkItems: selectedA,
      timelineEntries: [
        buildTaskCursorGithubVerifyTimeline({
          execution: failedExecution,
          ok: false,
          reason: "verify failed",
          nowIso: NOW,
        }),
      ],
    });
    const stateAfterTerminal = mergeOrchestrationPatchIntoRequirementsState({}, terminalPatch);
    expect(
      stateAfterTerminal.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]
        ?.lastCauseLayer,
    ).toBe("github_verify");

    const selectedB = [workItem("CODE-B", "wi-b", "DEV-SCREEN-002")];
    const nextExecution = {
      version: TASK_CURSOR_EXECUTION_VERSION,
      projectId: PROJECT_ID,
      taskId: "DEV-SCREEN-002",
      workItemIds: ["wi-b"],
      status: "requested",
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/dev-2",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const autoChainPatch = buildTaskCursorOrchestrationPatch({
      execution: nextExecution,
      cursorWorkItems: selectedB,
      existingCodeTaskExecutionFeedback:
        stateAfterTerminal.implementationCodeTaskExecutionFeedbackV1 ?? null,
      timelineEntries: [],
    });
    const merged = mergeOrchestrationPatchIntoRequirementsState(stateAfterTerminal, autoChainPatch);
    expect(merged.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.status).toBe(
      "failed",
    );
    expect(
      merged.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.lastCauseLayer,
    ).toBe("github_verify");
    expect(merged.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-B"]?.status).toBe(
      "not_started",
    );
  });

  it("preserves passed feedback after terminal github_verified merge", () => {
    const selected = [workItem("CODE-A", "wi-a")];
    const passedExecution = {
      version: TASK_CURSOR_EXECUTION_VERSION,
      projectId: PROJECT_ID,
      taskId: "DEV-SCREEN-001",
      workItemIds: ["wi-a"],
      status: "review_pending",
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/dev",
      commitSha: "abc123",
      createdAt: NOW,
      updatedAt: NOW,
    };
    const patch = buildTaskCursorOrchestrationPatch({
      execution: passedExecution,
      cursorWorkItems: selected,
      timelineEntries: [
        buildTaskCursorGithubVerifyTimeline({ execution: passedExecution, ok: true, nowIso: NOW }),
      ],
    });
    const merged = mergeOrchestrationPatchIntoRequirementsState({}, patch);
    expect(merged.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.status).toBe(
      "passed",
    );
    expect(merged.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.lastCommitSha).toBe(
      "abc123",
    );
  });
});

describe("implementation code task rework vm", () => {
  it("maps cause layers to recommended actions", () => {
    expect(resolveCodeTaskReworkRecommendedAction("work_item_preflight")).toBe("fix_work_items");
    expect(resolveCodeTaskReworkRecommendedAction("github_verify")).toBe("check_github");
    expect(resolveCodeTaskReworkRecommendedAction("cursor_execution")).toBe("rerun_task");
    expect(resolveCodeTaskReworkRecommendedAction("code_task_quality")).toBe("sync_planning_readiness");
    expect(resolveCodeTaskReworkRecommendedAction(undefined)).toBe("manual_review");
  });

  it("builds rework candidates from failed feedback entries", () => {
    const codeTaskId = "CODE-DEV-SCREEN-001-001";
    const feedback = updateImplementationCodeTaskExecutionFeedback({
      projectId: PROJECT_ID,
      selectedWorkItems: [workItem(codeTaskId, "wi-a")],
      execution: {
        version: TASK_CURSOR_EXECUTION_VERSION,
        projectId: PROJECT_ID,
        taskId: "DEV-SCREEN-001",
        workItemIds: ["wi-a"],
        status: "github_verify_failed",
        failureReason: "github_verify_failed",
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/dev",
        createdAt: NOW,
        updatedAt: NOW,
      },
      diagnosis: {
        causeLayer: "github_verify",
        message: "GitHub 검증 실패",
        affectedCodeTaskIds: [codeTaskId],
      },
      nowIso: NOW,
    });
    const vm = buildImplementationCodeTaskReworkVm({
      feedback,
      codeTaskPlan: samplePlan([healthyCodeTask(), healthyTestCodeTask()]),
    });
    expect(vm?.candidateCount).toBe(1);
    expect(vm?.candidates[0]?.recommendedAction).toBe("check_github");
    expect(vm?.candidates[0]?.title).toBe("Screen component");
  });
});

describe("quality gate warning-only readiness card", () => {
  it("uses warning-only gate from evaluateImplementationCodeTaskQualityGate", () => {
    const gate = evaluateImplementationCodeTaskQualityGate({
      projectId: PROJECT_ID,
      codeTaskPlan: samplePlan([healthyCodeTask()]),
      nowIso: NOW,
    });
    expect(gate.status).toBe("warning");
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const vm = buildImplementationPlanningReadinessCardVM({
      codeTaskPlan: readiness.implementationCodeTaskPlanV1,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
      codeTaskQualityGate: gate,
    });
    expect(vm?.executionReady).toBe(true);
    expect(vm?.overallLabel).toBe("준비됨 · 경고 있음");
    expect(vm?.qualityWarningCount).toBeGreaterThan(0);
  });
});
