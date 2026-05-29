import { describe, expect, it } from "vitest";
import {
  appendImplementationQualityGateResult,
  buildMockImplementationQualityGateResult,
  executeImplementationQualityGateCheck,
  getLatestImplementationQualityGateResultForRole,
  parseImplementationQualityGateResultsV1,
} from "@/lib/prototype/implementationQualityGate";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markPostDeveloperReviewTasksQueued,
  summarizeImplementationTaskExecutionItems,
} from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-29T12:00:00.000Z";

function taskListWithRoles(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "dev-1",
        title: "개발",
        description: "d",
        taskType: "feature",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "rev-1",
        title: "검수",
        description: "d",
        taskType: "validation",
        ownerRole: "reviewer",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
      {
        taskId: "sec-1",
        title: "보안",
        description: "d",
        taskType: "security",
        ownerRole: "security",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 1, security: 1, scm: 0 },
  };
}

function executionWithDeveloperDone() {
  let state = buildInitialImplementationTaskExecutionStateFromTaskList({
    projectId: "p1",
    taskList: taskListWithRoles(),
    nowIso: NOW,
  });
  state = {
    ...state,
    items: state.items.map((item) =>
      item.ownerRole === "developer" ? { ...item, status: "done" as const, completedAt: NOW } : item,
    ),
    summary: summarizeImplementationTaskExecutionItems(
      state.items.map((item) =>
        item.ownerRole === "developer" ? { ...item, status: "done" as const, completedAt: NOW } : item,
      ),
    ),
  };
  return markPostDeveloperReviewTasksQueued({ state, nowIso: NOW });
}

describe("buildMockImplementationQualityGateResult", () => {
  it("reviewer passes when developer done and no failed", () => {
    const result = buildMockImplementationQualityGateResult({
      role: "reviewer",
      taskList: taskListWithRoles(),
      executionState: executionWithDeveloperDone(),
      nowIso: NOW,
    });
    expect(result.status).toBe("passed");
  });

  it("reviewer fails when developer failed", () => {
    let state = executionWithDeveloperDone();
    state = {
      ...state,
      items: state.items.map((item) =>
        item.ownerRole === "developer" ? { ...item, status: "failed" as const } : item,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        state.items.map((item) =>
          item.ownerRole === "developer" ? { ...item, status: "failed" as const } : item,
        ),
      ),
    };
    const result = buildMockImplementationQualityGateResult({
      role: "reviewer",
      taskList: taskListWithRoles(),
      executionState: state,
      nowIso: NOW,
    });
    expect(result.status).toBe("failed");
  });

  it("security passes with developer done", () => {
    const result = buildMockImplementationQualityGateResult({
      role: "security",
      taskList: taskListWithRoles(),
      executionState: executionWithDeveloperDone(),
      nowIso: NOW,
    });
    expect(result.status).toBe("passed");
  });
});

describe("parseImplementationQualityGateResultsV1", () => {
  it("skips invalid rows", () => {
    const parsed = parseImplementationQualityGateResultsV1([
      { version: "wrong", role: "reviewer" },
      {
        version: "implementation_quality_gate_result_v1",
        role: "reviewer",
        status: "passed",
        createdAt: NOW,
        updatedAt: NOW,
        source: "mock_local_gate",
        summary: "ok",
        checks: [],
        failedTaskIds: [],
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed?.[0]?.role).toBe("reviewer");
  });
});

describe("executeImplementationQualityGateCheck", () => {
  it("transitions reviewer queued to done on pass", () => {
    const outcome = executeImplementationQualityGateCheck({
      role: "reviewer",
      taskList: taskListWithRoles(),
      executionState: executionWithDeveloperDone(),
      projectId: "p1",
      nowIso: NOW,
    });
    expect("blocked" in outcome).toBe(false);
    if ("blocked" in outcome) return;
    expect(outcome.passed).toBe(true);
    expect(outcome.executionState.items.find((i) => i.ownerRole === "reviewer")?.status).toBe("done");
    expect(outcome.qualityGateResults).toHaveLength(1);
  });

  it("transitions reviewer queued to failed on fail", () => {
    let state = executionWithDeveloperDone();
    state = {
      ...state,
      items: state.items.map((item) =>
        item.ownerRole === "developer" ? { ...item, status: "failed" as const } : item,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        state.items.map((item) =>
          item.ownerRole === "developer" ? { ...item, status: "failed" as const } : item,
        ),
      ),
    };
    const outcome = executeImplementationQualityGateCheck({
      role: "reviewer",
      taskList: taskListWithRoles(),
      executionState: state,
      projectId: "p1",
      nowIso: NOW,
    });
    if ("blocked" in outcome) throw new Error("expected outcome");
    expect(outcome.passed).toBe(false);
    expect(outcome.executionState.items.find((i) => i.ownerRole === "reviewer")?.status).toBe("failed");
  });

  it("appends quality gate results", () => {
    const first = executeImplementationQualityGateCheck({
      role: "reviewer",
      taskList: taskListWithRoles(),
      executionState: executionWithDeveloperDone(),
      projectId: "p1",
      nowIso: NOW,
    });
    if ("blocked" in first) throw new Error("expected outcome");
    const second = executeImplementationQualityGateCheck({
      role: "security",
      taskList: taskListWithRoles(),
      executionState: first.executionState,
      qualityGateResults: first.qualityGateResults,
      projectId: "p1",
      nowIso: NOW,
    });
    if ("blocked" in second) throw new Error("expected outcome");
    expect(second.qualityGateResults).toHaveLength(2);
    expect(getLatestImplementationQualityGateResultForRole(second.qualityGateResults, "security")?.status).toBe(
      "passed",
    );
  });
});

describe("buildMockImplementationQualityGateResult with targetTaskIds", () => {
  it("scopes failedTaskIds to target tasks only", () => {
    const execution = executionWithDeveloperDone();
    const result = buildMockImplementationQualityGateResult({
      role: "reviewer",
      taskList: taskListWithRoles(),
      executionState: execution,
      targetTaskIds: ["dev-1"],
      nowIso: NOW,
    });
    expect(result.failedTaskIds).toEqual([]);
    expect(result.status).toBe("passed");
  });

  it("executeImplementationQualityGateCheck blocks when targetTaskIds empty", () => {
    const outcome = executeImplementationQualityGateCheck({
      role: "reviewer",
      taskList: taskListWithRoles(),
      executionState: executionWithDeveloperDone(),
      projectId: "p1",
      targetTaskIds: [],
      nowIso: NOW,
    });
    expect("blocked" in outcome).toBe(true);
  });

  it("task-scoped reviewer check does not mark reviewer role tasks failed", () => {
    const execution = executionWithDeveloperDone();
    const beforeReviewer = execution.items.find((i) => i.ownerRole === "reviewer")?.status;
    const outcome = executeImplementationQualityGateCheck({
      role: "reviewer",
      taskList: taskListWithRoles(),
      executionState: execution,
      projectId: "p1",
      targetTaskIds: ["dev-1"],
      nowIso: NOW,
    });
    if ("blocked" in outcome) throw new Error("expected outcome");
    expect(outcome.executionState.items.find((i) => i.ownerRole === "reviewer")?.status).toBe(
      beforeReviewer,
    );
    expect(outcome.qualityGateResults).toHaveLength(1);
  });

  it("task-scoped security check failedTaskIds contains only target task", () => {
    let state = executionWithDeveloperDone();
    state = {
      ...state,
      items: state.items.map((item) =>
        item.taskId === "dev-1" ? { ...item, status: "failed" as const } : item,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        state.items.map((item) =>
          item.taskId === "dev-1" ? { ...item, status: "failed" as const } : item,
        ),
      ),
    };
    const outcome = executeImplementationQualityGateCheck({
      role: "security",
      taskList: taskListWithRoles(),
      executionState: state,
      projectId: "p1",
      targetTaskIds: ["dev-1"],
      nowIso: NOW,
    });
    if ("blocked" in outcome) throw new Error("expected outcome");
    expect(outcome.qualityGateResult.failedTaskIds).toEqual(["dev-1"]);
    expect(outcome.executionState.items.find((i) => i.ownerRole === "security")?.status).toBe(
      "queued",
    );
  });

  it("global reviewer check still updates reviewer role status", () => {
    const outcome = executeImplementationQualityGateCheck({
      role: "reviewer",
      taskList: taskListWithRoles(),
      executionState: executionWithDeveloperDone(),
      projectId: "p1",
      nowIso: NOW,
    });
    if ("blocked" in outcome) throw new Error("expected outcome");
    expect(outcome.executionState.items.find((i) => i.ownerRole === "reviewer")?.status).toBe("done");
  });
});

describe("appendImplementationQualityGateResult", () => {
  it("appends to existing results", () => {
    const base = buildMockImplementationQualityGateResult({
      role: "reviewer",
      taskList: taskListWithRoles(),
      executionState: executionWithDeveloperDone(),
      nowIso: NOW,
    });
    const next = appendImplementationQualityGateResult({
      existing: [base],
      result: { ...base, role: "security", updatedAt: NOW },
    });
    expect(next).toHaveLength(2);
  });
});
