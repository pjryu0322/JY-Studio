import { describe, expect, it } from "vitest";
import {
  patchRunWithGithubOutcome,
  resolveRunStatusAfterGithubOutcome,
} from "@/lib/prototype/codeTaskGithubOutcome";
import { parseCodeTaskExecutionRunV1, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  buildCodeTaskExecutionFlowSteps,
  deriveCodeTaskExecutionFlowPhase,
  enrichCodeTaskRunForFlowPhase,
} from "@/lib/prototype/implementationCodeTaskExecutionFlow";
import { shouldAutoStartImplementationQualityGate } from "@/lib/prototype/implementationAutoQualityGate";
import { selectCompletedCodeTasksForIntegration } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
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

const verifiedOutcome = {
  status: "verified" as const,
  checkedAt: "2026-06-04T00:00:00.000Z",
  workBranch: "wip/cursor/code-dev-sample-data-001-001",
  commitSha: "abc123def456",
  source: "github_rest" as const,
};

describe("P3-M40 resolveRunStatusAfterGithubOutcome", () => {
  it("promotes github_verifying to github_verified", () => {
    expect(
      resolveRunStatusAfterGithubOutcome({
        currentStatus: "github_verifying",
        githubOutcome: verifiedOutcome,
      }),
    ).toBe("github_verified");
  });

  it("promotes cursor_running to github_verified", () => {
    expect(
      resolveRunStatusAfterGithubOutcome({
        currentStatus: "cursor_running",
        githubOutcome: verifiedOutcome,
      }),
    ).toBe("github_verified");
  });

  it("preserves quality_gate_passed", () => {
    expect(
      resolveRunStatusAfterGithubOutcome({
        currentStatus: "quality_gate_passed",
        githubOutcome: verifiedOutcome,
      }),
    ).toBe("quality_gate_passed");
  });

  it("preserves completed", () => {
    expect(
      resolveRunStatusAfterGithubOutcome({
        currentStatus: "completed",
        githubOutcome: verifiedOutcome,
      }),
    ).toBe("completed");
  });
});

describe("P3-M40 patchRunWithGithubOutcome", () => {
  it("does not keep github_verifying after verified outcome", () => {
    const patch = patchRunWithGithubOutcome({
      run: baseRun({ status: "github_verifying" }),
      githubOutcome: verifiedOutcome,
      nowIso: "2026-06-04T00:00:00.000Z",
    });
    expect(patch.status).toBe("github_verified");
    expect(patch.commitSha).toBe("abc123def456");
  });
});

describe("P3-M40 parse normalizes stale status", () => {
  it("upgrades github_verifying when githubOutcome verified in JSON", () => {
    const run = parseCodeTaskExecutionRunV1({
      version: "code_task_execution_run_v1",
      runId: "r1",
      projectId: "p1",
      processTaskId: "DEV-MOCK-001",
      workItemId: "w1",
      codeTaskId: "CODE-DEV-MOCK-001-001",
      status: "github_verifying",
      attemptNo: 1,
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
      githubOutcome: verifiedOutcome,
    });
    expect(run?.status).toBe("github_verified");
  });
});

describe("P3-M40 UI flow steps", () => {
  it("marks GitHub step done and auto gate active after github_verified phase", () => {
    const steps = buildCodeTaskExecutionFlowSteps({
      phase: "github_verified",
      policy: { reviewRequired: false, securityRequired: false } as never,
    });
    const github = steps.find((s) => s.id === "github_verifying");
    const gate = steps.find((s) => s.id === "lightweight_checking");
    expect(github?.state).toBe("done");
    expect(gate?.state).toBe("active");
  });

  it("enrich does not downgrade verified outcome run to github_verifying", () => {
    const enriched = enrichCodeTaskRunForFlowPhase({
      run: baseRun({
        status: "github_verified",
        githubOutcome: verifiedOutcome,
        commitSha: "abc123def456",
      }),
      execution: {
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        status: "github_verifying",
      } as TaskCursorExecutionV1,
    });
    expect(enriched?.status).toBe("github_verified");
  });

  it("phase stays github_verified with stale cursor", () => {
    const phase = deriveCodeTaskExecutionFlowPhase({
      parentTaskId: "DEV-MOCK-001",
      taskCursorExecution: {
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        status: "github_verifying",
      } as TaskCursorExecutionV1,
      latestRun: baseRun({
        status: "github_verified",
        githubOutcome: verifiedOutcome,
        commitSha: "abc123def456",
      }),
    });
    expect(phase).toBe("github_verified");
  });
});

describe("P3-M40 auto quality gate entry", () => {
  it("allows gate when run is github_verified with verified outcome despite stale cursor", () => {
    const ok = shouldAutoStartImplementationQualityGate({
      taskCursorExecution: {
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        status: "github_verifying",
        commitSha: "abc123def456",
      } as TaskCursorExecutionV1,
      autoGate: null,
      codeTaskRun: baseRun({
        status: "github_verified",
        githubOutcome: verifiedOutcome,
        commitSha: "abc123def456",
      }),
    });
    expect(ok).toBe(true);
  });
});

describe("P3-M40 integration", () => {
  it("excludes github_verified-only run from integration included", () => {
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

    const result = selectCompletedCodeTasksForIntegration({
      codeTaskPlan: plan,
      taskList: null,
      codeTaskRuns: [
        baseRun({
          status: "github_verified",
          githubOutcome: verifiedOutcome,
          commitSha: "abc123def456",
        }),
      ],
    });
    expect(result.included).toHaveLength(0);
  });
});
