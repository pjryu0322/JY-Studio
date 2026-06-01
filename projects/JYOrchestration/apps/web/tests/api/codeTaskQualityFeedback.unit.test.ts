import { describe, expect, it } from "vitest";
import {
  evaluateImplementationCodeTaskQualityGate,
  type ImplementationCodeTaskQualityGateV1,
} from "@/lib/prototype/implementationCodeTaskQualityGate";
import {
  updateImplementationCodeTaskExecutionFeedback,
  resolveSelectedWorkItemsForExecution,
} from "@/lib/prototype/implementationCodeTaskExecutionFeedback";
import { diagnoseImplementationCodeTaskFailure } from "@/lib/prototype/implementationCodeTaskFailureDiagnosis";
import {
  buildImplementationPlanningReadinessPatch,
  evaluateImplementationPlanningExecutionGate,
  IMPLEMENTATION_PLANNING_CODE_TASK_QUALITY_FAILED_MESSAGE,
  IMPLEMENTATION_PLANNING_MISSING_CODE_TASK_QUALITY_MESSAGE,
} from "@/lib/prototype/implementationPlanningReadiness";
import { buildImplementationPlanningReadinessCardVM } from "@/lib/prototype/implementationPlanningReadinessUi";
import {
  buildImplementationCodeTaskFeedbackSummary,
  buildImplementationCodeTaskFeedbackTaskRows,
} from "@/lib/prototype/implementationCodeTaskFeedbackUi";
import {
  buildTaskCursorFailedOrchestrationPatch,
} from "@/lib/prototype/prototypeExecutionTaskCursorActions";
import {
  IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
  type ImplementationCodeTaskPlanV1,
  type ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import { TASK_CURSOR_EXECUTION_VERSION } from "@/lib/prototype/taskCursorExecution";

const NOW = "2026-05-28T12:00:00.000Z";
const PROJECT_ID = "p-codetask-quality";

function developerTask(taskId: string): ImplementationTaskV1 {
  return {
    taskId,
    title: taskId,
    description: taskId,
    taskType: "screen",
    ownerRole: "developer",
    priority: "medium",
    status: "ready",
    dependencies: [],
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
    tasks: [developerTask("DEV-SCREEN-001")],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
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

function workItem(codeTaskId: string, id: string): CursorWorkItem {
  return {
    id,
    taskId: "DEV-SCREEN-001",
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

describe("evaluateImplementationCodeTaskQualityGate", () => {
  it("passes when component and test tasks have concrete hints", () => {
    const gate = evaluateImplementationCodeTaskQualityGate({
      projectId: PROJECT_ID,
      codeTaskPlan: samplePlan([healthyCodeTask(), healthyTestCodeTask()]),
      nowIso: NOW,
    });
    expect(gate.status).toBe("passed");
    expect(gate.issueCount).toBe(0);
  });

  it("detects too_broad when hints and mixed domains are excessive", () => {
    const gate = evaluateImplementationCodeTaskQualityGate({
      projectId: PROJECT_ID,
      codeTaskPlan: samplePlan([
        healthyCodeTask({
          title: "전체 UI/API/DB/테스트 통합 구현",
          description: "모든 전반 기능을 통합 구현",
          candidateFileHints: [
            "dir:a",
            "dir:b",
            "dir:c",
            "dir:d",
            "dir:e",
            "dir:f",
          ],
          acceptanceCriteria: ["a", "b", "c", "d", "e"],
        }),
      ]),
      nowIso: NOW,
    });
    expect(["warning", "failed"]).toContain(gate.status);
    expect(gate.issues.some((issue) => issue.issueCode === "too_broad")).toBe(true);
  });

  it("warns when parent task has no test code task", () => {
    const gate = evaluateImplementationCodeTaskQualityGate({
      projectId: PROJECT_ID,
      codeTaskPlan: samplePlan([healthyCodeTask()]),
      nowIso: NOW,
    });
    expect(gate.status).toBe("warning");
    expect(gate.issues.some((issue) => issue.issueCode === "missing_test_task")).toBe(true);
  });

  it("treats too_broad with 6 hints alone as warning", () => {
    const gate = evaluateImplementationCodeTaskQualityGate({
      projectId: PROJECT_ID,
      codeTaskPlan: samplePlan([
        healthyCodeTask({
          candidateFileHints: ["dir:a", "dir:b", "dir:c", "dir:d", "dir:e", "dir:f"],
        }),
        healthyTestCodeTask(),
      ]),
      nowIso: NOW,
    });
    const tooBroad = gate.issues.find((issue) => issue.issueCode === "too_broad");
    expect(tooBroad?.severity).toBe("warning");
    expect(gate.status).not.toBe("failed");
  });

  it("warns mixed_change_types when domains >= 3 but hints < 5", () => {
    const gate = evaluateImplementationCodeTaskQualityGate({
      projectId: PROJECT_ID,
      codeTaskPlan: samplePlan([
        healthyCodeTask({
          title: "UI API DB test screen",
          description: "화면 component endpoint schema 테스트 spec",
          candidateFileHints: ["dir:a", "dir:b"],
        }),
        healthyTestCodeTask(),
      ]),
      nowIso: NOW,
    });
    const mixed = gate.issues.find((issue) => issue.issueCode === "mixed_change_types");
    expect(mixed?.severity).toBe("warning");
  });

  it("errors mixed_change_types when domains >= 3 and hints >= 5", () => {
    const gate = evaluateImplementationCodeTaskQualityGate({
      projectId: PROJECT_ID,
      codeTaskPlan: samplePlan([
        healthyCodeTask({
          title: "UI API DB test screen",
          description: "화면 component endpoint schema 테스트 spec",
          candidateFileHints: ["dir:a", "dir:b", "dir:c", "dir:d", "dir:e"],
        }),
        healthyTestCodeTask(),
      ]),
      nowIso: NOW,
    });
    const mixed = gate.issues.find((issue) => issue.issueCode === "mixed_change_types");
    expect(mixed?.severity).toBe("error");
  });

  it("errors when acceptanceCriteria is empty", () => {
    const gate = evaluateImplementationCodeTaskQualityGate({
      projectId: PROJECT_ID,
      codeTaskPlan: samplePlan([
        healthyCodeTask({ acceptanceCriteria: [] }),
        healthyTestCodeTask(),
      ]),
      nowIso: NOW,
    });
    const weak = gate.issues.find((issue) => issue.issueCode === "weak_acceptance_criteria");
    expect(weak?.severity).toBe("error");
  });

  it("warns when acceptanceCriteria is generic only", () => {
    const gate = evaluateImplementationCodeTaskQualityGate({
      projectId: PROJECT_ID,
      codeTaskPlan: samplePlan([
        healthyCodeTask({ acceptanceCriteria: ["완료"] }),
        healthyTestCodeTask(),
      ]),
      nowIso: NOW,
    });
    const weak = gate.issues.find((issue) => issue.issueCode === "weak_acceptance_criteria");
    expect(weak?.severity).toBe("warning");
  });
});

describe("evaluateImplementationPlanningExecutionGate quality", () => {
  it("blocks when quality gate failed", () => {
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
  });

  it("blocks when quality gate is missing", () => {
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

describe("buildImplementationPlanningReadinessCardVM quality", () => {
  it("shows quality status and risky code tasks", () => {
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
    const vm = buildImplementationPlanningReadinessCardVM({
      codeTaskPlan: readiness.implementationCodeTaskPlanV1,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
      codeTaskQualityGate: warningGate,
    });
    expect(vm?.qualityStatus).toBe("warning");
    expect(vm?.qualityIssueCount).toBe(1);
    expect(vm?.riskyCodeTaskIds.length).toBe(1);
    expect(
      vm?.advancedTasks.some((task) =>
        task.qualityIssues?.some((issue) => issue.issueCode === "missing_test_task"),
      ),
    ).toBe(true);
  });
});

describe("implementation code task execution feedback", () => {
  const execution = {
    version: TASK_CURSOR_EXECUTION_VERSION,
    projectId: PROJECT_ID,
    taskId: "DEV-SCREEN-001",
    workItemIds: ["wi-a", "wi-b"],
    status: "github_verify_failed",
    failureReason: "github_verify_failed",
    errorMessage: "verify failed",
    targetRepository: "owner/repo",
    baseBranch: "main",
    workBranch: "wip/dev",
    createdAt: NOW,
    updatedAt: NOW,
  };

  it("stores failed feedback for selected work items", () => {
    const selected = [workItem("CODE-A", "wi-a"), workItem("CODE-B", "wi-b")];
    const feedback = updateImplementationCodeTaskExecutionFeedback({
      projectId: PROJECT_ID,
      selectedWorkItems: selected,
      execution,
      nowIso: NOW,
    });
    expect(feedback.feedbackByCodeTaskId["CODE-A"]?.status).toBe("failed");
    expect(feedback.feedbackByCodeTaskId["CODE-B"]?.status).toBe("failed");
    expect(feedback.feedbackByCodeTaskId["CODE-A"]?.lastFailureReason).toBe("github_verify_failed");
  });

  it("stores passed feedback with commit sha", () => {
    const selected = resolveSelectedWorkItemsForExecution({
      cursorWorkItems: [workItem("CODE-A", "wi-a")],
      workItemIds: ["wi-a"],
    });
    const feedback = updateImplementationCodeTaskExecutionFeedback({
      projectId: PROJECT_ID,
      selectedWorkItems: selected,
      execution: {
        ...execution,
        status: "github_verified",
        failureReason: undefined,
        errorMessage: undefined,
        commitSha: "abc123",
      },
      nowIso: NOW,
    });
    expect(feedback.feedbackByCodeTaskId["CODE-A"]?.status).toBe("passed");
    expect(feedback.feedbackByCodeTaskId["CODE-A"]?.lastCommitSha).toBe("abc123");
  });

  it("stores diagnosis fields when provided", () => {
    const selected = [workItem("CODE-A", "wi-a")];
    const feedback = updateImplementationCodeTaskExecutionFeedback({
      projectId: PROJECT_ID,
      selectedWorkItems: selected,
      execution,
      diagnosis: {
        causeLayer: "github_verify",
        message: "GitHub 검증 실패",
        affectedCodeTaskIds: ["CODE-A"],
      },
      nowIso: NOW,
    });
    expect(feedback.feedbackByCodeTaskId["CODE-A"]?.lastCauseLayer).toBe("github_verify");
    expect(feedback.feedbackByCodeTaskId["CODE-A"]?.lastDiagnosisMessage).toBe("GitHub 검증 실패");
  });
});

describe("buildTaskCursorFailedOrchestrationPatch preflight feedback", () => {
  it("stores preflight failure feedback and diagnosis timeline", () => {
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
    expect(patch.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.status).toBe(
      "failed",
    );
    expect(
      patch.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.lastFailureReason,
    ).toBe("work_item_preflight_failed");
    expect(
      patch.implementationCodeTaskExecutionFeedbackV1?.feedbackByCodeTaskId["CODE-A"]?.lastCauseLayer,
    ).toBe("work_item_preflight");
    expect(
      patch.promptTimeline.some(
        (entry) => entry.action === "implementation_code_task_failure_diagnosed",
      ),
    ).toBe(true);
  });
});

describe("implementation code task feedback ui summary", () => {
  it("returns accurate feedback counts and task rows", () => {
    const feedback = {
      version: "implementation_code_task_execution_feedback_v1" as const,
      projectId: PROJECT_ID,
      updatedAt: NOW,
      feedbackByCodeTaskId: {
        "CODE-A": {
          codeTaskId: "CODE-A",
          parentTaskId: "DEV-SCREEN-001",
          status: "passed" as const,
          workItemIds: ["wi-a"],
          updatedAt: NOW,
        },
        "CODE-B": {
          codeTaskId: "CODE-B",
          parentTaskId: "DEV-SCREEN-001",
          status: "failed" as const,
          lastFailureReason: "github_verify_failed",
          lastCauseLayer: "github_verify" as const,
          workItemIds: ["wi-b"],
          updatedAt: NOW,
        },
        "CODE-C": {
          codeTaskId: "CODE-C",
          parentTaskId: "DEV-SCREEN-001",
          status: "failed" as const,
          lastFailureReason: "cursor_failed",
          lastCauseLayer: "cursor_execution" as const,
          workItemIds: ["wi-c"],
          updatedAt: NOW,
        },
        "CODE-D": {
          codeTaskId: "CODE-D",
          parentTaskId: "DEV-SCREEN-001",
          status: "running" as const,
          workItemIds: ["wi-d"],
          updatedAt: NOW,
        },
      },
    };
    const summary = buildImplementationCodeTaskFeedbackSummary(feedback);
    expect(summary?.passed).toBe(1);
    expect(summary?.failed).toBe(2);
    expect(summary?.running).toBe(1);
    const rows = buildImplementationCodeTaskFeedbackTaskRows(feedback);
    expect(rows.some((row) => row.codeTaskId === "CODE-B" && row.lastCauseLayer === "github_verify")).toBe(
      true,
    );
    const vm = buildImplementationPlanningReadinessCardVM({
      codeTaskPlan: samplePlan([healthyCodeTask(), healthyTestCodeTask()]),
      cursorWorkItems: [workItem("CODE-A", "wi-a")],
      preflightSummary: {
        version: "implementation_work_item_preflight_summary_v1",
        projectId: PROJECT_ID,
        checkedAt: NOW,
        status: "passed",
        workItemCount: 1,
        failedWorkItemIds: [],
        failedReasons: [],
      },
      codeTaskQualityGate: evaluateImplementationCodeTaskQualityGate({
        projectId: PROJECT_ID,
        codeTaskPlan: samplePlan([healthyCodeTask(), healthyTestCodeTask()]),
        nowIso: NOW,
      }),
      codeTaskExecutionFeedback: feedback,
    });
    expect(vm?.feedbackSummary?.passed).toBe(1);
    expect(vm?.feedbackSummary?.failed).toBe(2);
    expect(vm?.feedbackSummary?.running).toBe(1);
    expect(
      vm?.feedbackTaskRows?.some(
        (row) => row.codeTaskId === "CODE-B" && row.lastFailureReason === "github_verify_failed",
      ),
    ).toBe(true);
  });
});

describe("diagnoseImplementationCodeTaskFailure", () => {
  it("maps github verify failure to github_verify layer", () => {
    const diagnosis = diagnoseImplementationCodeTaskFailure({
      failureReason: "github_verify_failed",
      selectedWorkItems: [workItem("CODE-A", "wi-a")],
    });
    expect(diagnosis.causeLayer).toBe("github_verify");
    expect(diagnosis.affectedCodeTaskIds).toContain("CODE-A");
  });
});
