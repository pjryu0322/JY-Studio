import { describe, expect, it } from "vitest";
import {
  resolveSampleDataArtifactGitRef,
  resolveSampleDataCodeTaskFromPlan,
} from "@/lib/prototype/sampleDataArtifactsFetchService";
import { SAMPLE_DATA_CODE_TASK_ID, SAMPLE_DATA_WORK_BRANCH } from "@/lib/prototype/sampleDataCodeTaskPlanner";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

function minimalPlan(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: "2026-06-09T00:00:00.000Z",
    updatedAt: "2026-06-09T00:00:00.000Z",
    source: "implementation_task_list",
    parentTaskCount: 1,
    codeTaskCount: 1,
    readiness: { ready: true, missing: [] },
    tasks: [
      {
        codeTaskId: SAMPLE_DATA_CODE_TASK_ID,
        parentTaskId: "DEV-MOCK-001",
        title: "샘플 데이터 구현",
        description: "sample",
        changeType: "data",
        targetHints: ["data"],
        dependencies: [],
        acceptanceCriteria: ["ok"],
        verificationHints: ["verify"],
        forbiddenPaths: ["forbidden"],
        priority: "P0",
        status: "ready",
        blockers: [],
        branchPlan: {
          branchGroup: "data",
          workBranch: SAMPLE_DATA_WORK_BRANCH,
          baseBranch: "wip/foundation/app-shell",
          executionMode: "sequential",
        },
      },
    ],
  };
}

describe("sampleDataArtifactsFetchService", () => {
  it("resolves sample data task from plan", () => {
    const task = resolveSampleDataCodeTaskFromPlan(minimalPlan(), null);
    expect(task?.codeTaskId).toBe(SAMPLE_DATA_CODE_TASK_ID);
  });

  it("maps legacy sample data code task id to plan task", () => {
    const task = resolveSampleDataCodeTaskFromPlan(minimalPlan(), "CODE-DEV-SAMPLE-DATA-001-001");
    expect(task?.codeTaskId).toBe(SAMPLE_DATA_CODE_TASK_ID);
  });

  it("builds stub from wip/data/sample-data run when plan entry missing", () => {
    const task = resolveSampleDataCodeTaskFromPlan(null, "CODE-DEV-SAMPLE-DATA-001-001", [
      {
        version: "code_task_execution_run_v1",
        runId: "r1",
        projectId: "p1",
        processTaskId: "DEV-SAMPLE-DATA-001",
        workItemId: "w1",
        codeTaskId: "CODE-DEV-SAMPLE-DATA-001-001",
        status: "completed",
        attemptNo: 1,
        workBranch: "wip/data/sample-data",
        commitSha: "deadbeef",
        createdAt: "2026-06-12T00:00:00.000Z",
        updatedAt: "2026-06-12T00:00:00.000Z",
        githubOutcome: {
          version: "code_task_github_outcome_v1",
          status: "verified",
          commitSha: "deadbeef",
          verifiedAt: "2026-06-12T00:00:00.000Z",
        },
      },
    ]);
    expect(task?.branchPlan?.workBranch).toBe("wip/data/sample-data");
  });

  it("prefers run work branch and commit for git ref", () => {
    const plan = minimalPlan();
    const task = plan.tasks[0]!;
    const ref = resolveSampleDataArtifactGitRef({
      codeTask: task,
      runs: [
        {
          version: "code_task_execution_run_v1",
          runId: "r1",
          projectId: "p1",
          processTaskId: "DEV-MOCK-001",
          workItemId: "w1",
          codeTaskId: SAMPLE_DATA_CODE_TASK_ID,
          status: "completed",
          attemptNo: 1,
          workBranch: "wip/data/sample-data",
          commitSha: "abc123def456",
          createdAt: "2026-06-12T00:00:00.000Z",
          updatedAt: "2026-06-12T00:00:00.000Z",
          githubOutcome: {
            version: "code_task_github_outcome_v1",
            status: "verified",
            commitSha: "abc123def456",
            verifiedAt: "2026-06-12T00:00:00.000Z",
          },
        },
      ],
    });
    expect(ref.workBranch).toBe("wip/data/sample-data");
    expect(ref.gitRef).toBe("abc123def456");
  });
});
