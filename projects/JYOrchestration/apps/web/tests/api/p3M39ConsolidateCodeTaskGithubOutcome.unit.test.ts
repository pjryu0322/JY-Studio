import { describe, expect, it } from "vitest";
import {
  buildGithubOutcomeFromVerifyResult,
  normalizeCodeTaskGithubOutcomeFromRun,
  parseCodeTaskGithubOutcomeV1,
  runHasVerifiedGithubOutcome,
} from "@/lib/prototype/codeTaskGithubOutcome";
import { parseCodeTaskExecutionRunV1, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { deriveCodeTaskExecutionFlowPhase } from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import { selectCompletedCodeTasksForIntegration } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import { shouldBlockQuickRunDispatchForInFlightTaskCursor } from "@/lib/prototype/taskCursorQuickRunInflightPolicy";
import { resolveTaskCursorGithubVerifyProgressLabelKo } from "@/lib/prototype/taskCursorGithubVerifyView";
import { buildTaskCursorGithubBranchCandidates } from "@/lib/prototype/taskCursorGithubBranchCandidates";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

function baseRun(partial: Partial<CodeTaskExecutionRunV1>): CodeTaskExecutionRunV1 {
  return {
    runId: "run-1",
    projectId: "p1",
    processTaskId: "DEV-MOCK-001",
    workItemId: "wi-1",
    codeTaskId: "CODE-DEV-MOCK-001-001",
    status: "github_verifying",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
    ...partial,
  };
}

describe("P3-M39 githubOutcome parse/normalize", () => {
  it("parses run without githubOutcome", () => {
    const run = parseCodeTaskExecutionRunV1({
      runId: "r1",
      projectId: "p1",
      processTaskId: "T1",
      workItemId: "w1",
      codeTaskId: "C1",
      status: "cursor_running",
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
    });
    expect(run?.githubOutcome).toBeUndefined();
  });

  it("normalizes legacy commitSha to verified outcome", () => {
    const outcome = normalizeCodeTaskGithubOutcomeFromRun(
      baseRun({
        commitSha: "abc123def456",
        workBranch: "wip/cursor/code-dev-sample-data-001-001",
      }),
    );
    expect(outcome?.status).toBe("verified");
    if (outcome?.status === "verified") {
      expect(outcome.commitSha).toBe("abc123def456");
    }
  });

  it("failed outcome uses machine-readable reason", () => {
    const parsed = parseCodeTaskGithubOutcomeV1({
      status: "failed",
      checkedAt: "2026-06-04T00:00:00.000Z",
      reason: "github_branch_missing",
      retryable: true,
    });
    expect(parsed?.status).toBe("failed");
    if (parsed?.status === "failed") {
      expect(parsed.reason).toBe("github_branch_missing");
    }
  });
});

describe("P3-M39 UI phase / labels", () => {
  it("uses github_verified when run outcome verified despite stale cursor", () => {
    const phase = deriveCodeTaskExecutionFlowPhase({
      parentTaskId: "DEV-MOCK-001",
      taskCursorExecution: {
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        status: "github_verifying",
      } as TaskCursorExecutionV1,
      latestRun: baseRun({
        status: "github_verifying",
        githubOutcome: {
          status: "verified",
          checkedAt: "2026-06-04T00:00:00.000Z",
          workBranch: "wip/cursor/code-dev-sample-data-001-001",
          commitSha: "0cd4d65abc12",
          source: "github_rest",
        },
      }),
    });
    expect(phase).toBe("github_verified");
  });

  it("progress label is commit confirmed when run outcome verified", () => {
    const label = resolveTaskCursorGithubVerifyProgressLabelKo({
      execution: { status: "github_verifying" } as TaskCursorExecutionV1,
      run: baseRun({
        githubOutcome: {
          status: "verified",
          checkedAt: "2026-06-04T00:00:00.000Z",
          workBranch: "wip/cursor/code-dev-sample-data-001-001",
          commitSha: "0cd4d65abc12",
          source: "github_rest",
        },
      }),
    });
    expect(label).toBe("GitHub commit 확인 완료");
  });
});

describe("P3-M39 continuation in-flight", () => {
  it("does not block dispatch when run has verified github outcome", () => {
    const runs = [
      baseRun({
        status: "github_verifying",
        githubOutcome: {
          status: "verified",
          checkedAt: "2026-06-04T00:00:00.000Z",
          workBranch: "wip/cursor/code-dev-sample-data-001-001",
          commitSha: "0cd4d65abc12",
          source: "github_rest",
        },
      }),
    ];
    const blocked = shouldBlockQuickRunDispatchForInFlightTaskCursor({
      taskCursor: {
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        status: "github_verifying",
      } as TaskCursorExecutionV1,
      nextParentTaskId: "DEV-MOCK-002",
      completedTaskId: "DEV-MOCK-001",
      completedCodeTaskId: "CODE-DEV-MOCK-001-001",
      runs,
    });
    expect(blocked).toBe(false);
  });
});

describe("P3-M39 integration selector", () => {
  it("includes quality_gate passed run and excludes pending github outcome", () => {
    const plan = {
      version: "implementation_code_task_plan_v1",
      projectId: "p1",
      tasks: [
        {
          codeTaskId: "CODE-DEV-MOCK-001-001",
          parentTaskId: "DEV-MOCK-001",
          title: "샘플 데이터 구현",
          description: "",
          changeType: "feature",
        },
      ],
    } as never;

    const passed = selectCompletedCodeTasksForIntegration({
      codeTaskPlan: plan,
      taskList: null,
      codeTaskRuns: [
        baseRun({
          status: "completed",
          commitSha: "abc123",
          workBranch: "wip/cursor/code-dev-sample-data-001-001",
        }),
      ],
      autoQualityGate: {
        version: "implementation_auto_quality_gate_v1",
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        status: "passed",
        sourceCommitSha: "abc123",
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:00.000Z",
      },
    });
    expect(passed.included).toHaveLength(1);

    const pending = selectCompletedCodeTasksForIntegration({
      codeTaskPlan: plan,
      taskList: null,
      codeTaskRuns: [
        baseRun({
          status: "github_verifying",
          githubOutcome: { status: "pending", workBranch: "wip/cursor/x" },
        }),
      ],
    });
    expect(pending.included).toHaveLength(0);
    expect(pending.excluded[0]?.reason).toBe("github_verifying");
  });

  it("does not include verified-only run without gate or completed status", () => {
    expect(
      runHasVerifiedGithubOutcome(
        baseRun({
          githubOutcome: {
            status: "verified",
            checkedAt: "2026-06-04T00:00:00.000Z",
            workBranch: "wip/cursor/x",
            commitSha: "abc",
            source: "github_rest",
          },
        }),
      ),
    ).toBe(true);
  });
});

describe("P3-M39 sample-data branch candidates", () => {
  it("includes sample-data and legacy mock branch slugs", () => {
    const candidates = buildTaskCursorGithubBranchCandidates({
      codeTaskId: "CODE-DEV-MOCK-001-001",
      runWorkBranch: "wip/cursor/code-dev-mock-001-001",
    });
    expect(candidates).toContain("wip/cursor/code-dev-sample-data-001-001");
    expect(candidates).toContain("wip/cursor/code-dev-mock-001-001");
  });

  it("records repair on verified outcome build", () => {
    const outcome = buildGithubOutcomeFromVerifyResult({
      verify: {
        ok: true,
        message: "ok",
        verifiedCommitSha: "deadbeef1234",
        resolvedBranch: "wip/cursor/code-dev-sample-data-001-001",
      } as never,
      nowIso: "2026-06-04T00:00:00.000Z",
      previousWorkBranch: "wip/cursor/code-dev-mock-001-001",
      resolvedWorkBranch: "wip/cursor/code-dev-sample-data-001-001",
    });
    expect(outcome.status).toBe("verified");
    if (outcome.status === "verified") {
      expect(outcome.repairedWorkBranch).toBe(true);
      expect(outcome.previousWorkBranch).toBe("wip/cursor/code-dev-mock-001-001");
    }
  });
});
