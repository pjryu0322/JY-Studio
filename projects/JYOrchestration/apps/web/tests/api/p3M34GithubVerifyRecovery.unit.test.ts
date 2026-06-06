import { describe, expect, it } from "vitest";
import {
  TASK_CURSOR_GITHUB_VERIFY_HARD_TIMEOUT_MS,
  TASK_CURSOR_GITHUB_VERIFY_SOFT_TIMEOUT_MS,
  resolveGithubVerifyStuckEscalation,
} from "@/lib/prototype/taskCursorGithubVerifyTimeoutPolicy";
import { TASK_CURSOR_EXECUTION_VERSION, type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";
import { applyGithubVerifyStuckEscalationIfNeeded } from "@/lib/prototype/taskCursorGithubVerifyEscalation";
import { shouldBlockQuickRunDispatchForInFlightTaskCursor } from "@/lib/prototype/taskCursorQuickRunInflightPolicy";
import { normalizeCodeTaskDisplayLabel, resolveCodeTaskWorkBranchForPlan } from "@/lib/prototype/codeTaskDisplayNameNormalize";
import {
  buildImplementationToastDedupeKey,
  shouldSuppressDuplicateImplementationToast,
} from "@/lib/prototype/implementationToastDedupe";
import { buildImplementationExecutionOverview } from "@/lib/prototype/implementationExecutionOverview";

function baseExecution(overrides: Partial<TaskCursorExecutionV1> = {}): TaskCursorExecutionV1 {
  const now = new Date().toISOString();
  return {
    version: TASK_CURSOR_EXECUTION_VERSION,
    projectId: "p1",
    taskId: "DEV-MOCK-001",
    workItemIds: [],
    status: "github_verifying",
    cursorProvider: "cursor",
    targetRepository: "o/r",
    baseBranch: "main",
    workBranch: "wip/cursor/code-dev-mock-001-001",
    createdAt: new Date(Date.now() - TASK_CURSOR_GITHUB_VERIFY_HARD_TIMEOUT_MS - 1).toISOString(),
    updatedAt: now,
    ...overrides,
  };
}

describe("P3-M34 github verify timeout", () => {
  it("escalates to github_verify_timeout after hard timeout", () => {
    const escalation = resolveGithubVerifyStuckEscalation({
      execution: baseExecution(),
    });
    expect(escalation).toBe("github_verify_timeout");
  });

  it("apply escalation sets retryable failure", () => {
    const applied = applyGithubVerifyStuckEscalationIfNeeded({
      execution: baseExecution(),
      verifyDetailReason: "branch_not_found",
      codeTaskId: "CODE-DEV-MOCK-001-001",
    });
    expect(applied.execution.status).toBe("github_verify_failed");
    expect(applied.execution.failureReason).toBe("github_verify_timeout");
    expect(applied.timelineEntry?.action).toBe("task_cursor_github_verify_timeout");
  });

  it("branch missing after soft timeout with branch_not_found", () => {
    const escalation = resolveGithubVerifyStuckEscalation({
      execution: baseExecution({
        createdAt: new Date(Date.now() - TASK_CURSOR_GITHUB_VERIFY_SOFT_TIMEOUT_MS - 1).toISOString(),
      }),
      verifyDetailReason: "branch_not_found",
    });
    expect(escalation).toBe("github_branch_missing");
  });
});

describe("P3-M34 already_in_flight", () => {
  it("does not block when completed task passed quality gate", () => {
    const cursor = baseExecution({ taskId: "DEV-COMMON-003", status: "github_verifying" });
    const blocked = shouldBlockQuickRunDispatchForInFlightTaskCursor({
      taskCursor: cursor,
      nextParentTaskId: "DEV-COMMON-004",
      completedTaskId: "DEV-COMMON-003",
      autoGate: { status: "passed", taskId: "DEV-COMMON-003" } as never,
    });
    expect(blocked).toBe(false);
  });
});

describe("P3-M34 mock normalize", () => {
  it("normalizes Mock 데이터 구조 정의", () => {
    expect(normalizeCodeTaskDisplayLabel("Mock 데이터 구조 정의")).toBe("샘플 데이터 생성");
  });

  it("preserves existing work branch for verify", () => {
    expect(
      resolveCodeTaskWorkBranchForPlan("code-dev-mock-001-001", "wip/cursor/code-dev-mock-001-001"),
    ).toBe("wip/cursor/code-dev-mock-001-001");
  });

  it("uses sample-data slug for new mock code task ids", () => {
    expect(resolveCodeTaskWorkBranchForPlan("code-dev-mock-001-001")).toContain("sample-data");
  });
});

describe("P3-M34 toast dedupe", () => {
  it("suppresses duplicate toast within 60s", () => {
    const keyRef = { current: null as string | null };
    const atRef = { current: 0 };
    const key = buildImplementationToastDedupeKey({
      taskId: "T1",
      status: "github_verifying",
      message: "checking",
    });
    record(key, keyRef, atRef, 1000);
    expect(
      shouldSuppressDuplicateImplementationToast({
        key,
        lastKeyRef: keyRef,
        lastAtRef: atRef,
        nowMs: 2000,
      }),
    ).toBe(true);
  });
});

function record(
  key: string,
  keyRef: { current: string | null },
  atRef: { current: number },
  nowMs: number,
): void {
  keyRef.current = key;
  atRef.current = nowMs;
}

describe("P3-M34 execution overview header", () => {
  it("shows needs attention header for timeout phase", () => {
    const overview = buildImplementationExecutionOverview({
      board: {
        taskRows: [],
        summary: { completedTasks: 0, inProgressTasks: 0, reworkRequiredTasks: 0 },
      } as never,
      activeFlowPhase: "github_verify_timeout",
      activeCodeTaskTitle: "샘플 데이터 생성",
    });
    expect(overview.headerTitle).toBe("구현 확인 필요");
    expect(overview.flowPhaseLabel).toBe("GitHub commit 확인 시간 초과");
  });
});
