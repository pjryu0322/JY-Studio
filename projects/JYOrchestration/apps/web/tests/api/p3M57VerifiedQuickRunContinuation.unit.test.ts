import { describe, expect, it } from "vitest";
import { advanceQuickRunOrchestrationAfterGithubVerify } from "@/lib/prototype/implementationQuickRunGithubAdvanceService";
import { buildVerifiedCodeTaskGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import { resolveNextSelectedCodeTaskAfterVerified } from "@/lib/prototype/resolveNextSelectedCodeTaskAfterVerified";
import { isCodeTaskRunnableByBranchPlan } from "@/lib/prototype/implementationBranchPlanBuilder";
import { planQuickRunContinuationAfterVerifiedGithubOutcome } from "@/lib/prototype/implementationQuickRunCodeTaskContinuation";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const FRAME = "CODE-DEV-FRAME-001-001";
const SAMPLE = "CODE-DEV-SAMPLE-DATA-001-001";

function sampleCodeTaskPlanRaw() {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
    codeTaskCount: 2,
    tasks: [
      {
        codeTaskId: FRAME,
        parentTaskId: "DEV-FRAME-001",
        title: "Frame",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        branchPlan: {
          branchGroup: "foundation",
          workBranch: "wip/foundation/app-shell",
          baseBranch: "main",
          executionMode: "sequential",
        },
      },
      {
        codeTaskId: SAMPLE,
        parentTaskId: "DEV-SAMPLE-DATA-001",
        title: "Sample",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        branchPlan: {
          branchGroup: "data",
          workBranch: "wip/data/sample-data",
          baseBranch: "wip/foundation/app-shell",
          executionMode: "sequential",
        },
      },
    ],
    implementationBranchPlanV1: {
      version: "implementation_branch_plan_v1",
      baseBranch: "main",
      executionOrder: ["foundation", "data", "common", "integration"],
      groups: [],
    },
  };
}

function verifiedRun(codeTaskId: string, processTaskId: string): CodeTaskExecutionRunV1 {
  const now = "2026-06-07T00:00:00.000Z";
  return {
    runId: `run-${codeTaskId}`,
    projectId: "p1",
    processTaskId,
    workItemId: "wi-1",
    codeTaskId,
    status: "github_verified",
    workBranch: codeTaskId === FRAME ? "wip/foundation/app-shell" : "wip/data/sample-data",
    commitSha: "abc1234567890abcdef",
    branchHeadCommitSha: "abc1234567890abcdef",
    githubOutcome: buildVerifiedCodeTaskGithubOutcome({
      checkedAt: now,
      workBranch: codeTaskId === FRAME ? "wip/foundation/app-shell" : "wip/data/sample-data",
      commitSha: "abc1234567890abcdef",
    }),
    createdAt: now,
    updatedAt: now,
  };
}

describe("P3-M57 dispatch next selected CodeTask after verified outcome", () => {
  it("resolves sample-data as next_ready after frame verified", () => {
    const runs = [verifiedRun(FRAME, "DEV-FRAME-001")];
    const resolved = resolveNextSelectedCodeTaskAfterVerified({
      selectedCodeTaskIds: [FRAME, SAMPLE],
      currentCodeTaskId: FRAME,
      executionRuns: runs,
      codeTaskPlan: {
        version: "implementation_code_task_plan_v1",
        codeTaskCount: 2,
        tasks: [
          {
            codeTaskId: FRAME,
            parentTaskId: "DEV-FRAME-001",
            branchPlan: {
              branchGroup: "foundation",
              workBranch: "wip/foundation/app-shell",
              baseBranch: "main",
              executionMode: "sequential",
            },
          },
          {
            codeTaskId: SAMPLE,
            parentTaskId: "DEV-SAMPLE-DATA-001",
            branchPlan: {
              branchGroup: "data",
              workBranch: "wip/data/sample-data",
              baseBranch: "wip/foundation/app-shell",
              executionMode: "sequential",
            },
          },
        ],
        implementationBranchPlanV1: {
          version: "implementation_branch_plan_v1",
          baseBranch: "main",
          executionOrder: ["foundation", "data", "common", "integration"],
          groups: [],
        },
      },
    });
    expect(resolved.status).toBe("next_ready");
    if (resolved.status === "next_ready") {
      expect(resolved.codeTaskId).toBe(SAMPLE);
    }
  });

  it("allows data task when foundation run is github_verified only", () => {
    const runs = [verifiedRun(FRAME, "DEV-FRAME-001")];
    const runnable = isCodeTaskRunnableByBranchPlan({
      codeTaskPlan: {
        version: "implementation_code_task_plan_v1",
        codeTaskCount: 2,
        tasks: [
          {
            codeTaskId: FRAME,
            parentTaskId: "DEV-FRAME-001",
            branchPlan: {
              branchGroup: "foundation",
              workBranch: "wip/foundation/app-shell",
              baseBranch: "main",
              executionMode: "sequential",
            },
          },
          {
            codeTaskId: SAMPLE,
            parentTaskId: "DEV-SAMPLE-DATA-001",
            branchPlan: {
              branchGroup: "data",
              workBranch: "wip/data/sample-data",
              baseBranch: "wip/foundation/app-shell",
              executionMode: "sequential",
            },
          },
        ],
        implementationBranchPlanV1: {
          version: "implementation_branch_plan_v1",
          baseBranch: "main",
          executionOrder: ["foundation", "data", "common", "integration"],
          groups: [],
        },
      },
      selectedCodeTaskIds: [FRAME, SAMPLE],
      codeTaskId: SAMPLE,
      runs,
    });
    expect(runnable).toBe(true);
  });

  it("plans continuation patch for verified frame task", () => {
    const codeTaskPlanRaw = sampleCodeTaskPlanRaw();
    const codeTaskPlan = parseImplementationCodeTaskPlanV1(codeTaskPlanRaw);
    expect(codeTaskPlan).not.toBeNull();
    const taskList = parseImplementationTaskListV1({
      version: "implementation_task_list_v1",
      projectId: "p1",
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
      source: "implementation_seed",
      tasks: [
        {
          taskId: "DEV-FRAME-001",
          title: "Frame",
          description: "d",
          taskType: "feature",
          ownerRole: "developer",
          priority: "medium",
          dependencies: [],
          acceptanceCriteria: [],
          status: "ready",
        },
        {
          taskId: "DEV-SAMPLE-DATA-001",
          title: "Sample",
          description: "d",
          taskType: "feature",
          ownerRole: "developer",
          priority: "medium",
          dependencies: [],
          acceptanceCriteria: [],
          status: "ready",
        },
      ],
      roleSummary: { developer: 2, designer: 0, reviewer: 0, security: 0, scm: 0 },
    });
    const runs = [verifiedRun(FRAME, "DEV-FRAME-001")];
    const plan = planQuickRunContinuationAfterVerifiedGithubOutcome({
      projectId: "p1",
      verifiedCodeTaskId: FRAME,
      quickRun: {
        version: "implementation_quick_run_v1",
        projectId: "p1",
        status: "running",
        updatedAt: "2026-06-07T00:00:00.000Z",
      },
      taskCursorExecution: {
        version: "task_cursor_execution_v1",
        projectId: "p1",
        taskId: "DEV-FRAME-001",
        status: "review_pending",
        commitSha: "abc1234567890abcdef",
        workItemIds: ["wi-frame"],
        createdAt: "2026-06-07T00:00:00.000Z",
        updatedAt: "2026-06-07T00:00:00.000Z",
      } as TaskCursorExecutionV1,
      runs,
      codeTaskPlan,
      taskList,
      cursorWorkItems: [
        { id: "wi-frame", taskId: "DEV-FRAME-001", codeTaskId: FRAME, title: "Frame WI" },
        { id: "wi-sample", taskId: "DEV-SAMPLE-DATA-001", codeTaskId: SAMPLE, title: "Sample WI" },
      ],
      dbBundle: {
        job: { id: "job-1", status: "running", selectedCodeTaskIds: [FRAME, SAMPLE], currentCodeTaskId: FRAME },
        runs: [],
        currentRun: null,
      } as import("@/lib/runtime/implementationRuntime/implementationRuntimeTypes").ImplementationRuntimeBundleView,
      baseState: {},
    });
    expect(plan).not.toBeNull();
    expect(plan?.nextCodeTaskId).toBe(SAMPLE);
  });

  it("advanceQuickRunOrchestrationAfterGithubVerify accepts github verify ok with verified run in state", () => {
    const execution = {
      version: "task_cursor_execution_v1",
      projectId: "p1",
      taskId: "DEV-FRAME-001",
      status: "review_pending",
      commitSha: "abc1234567890abcdef",
      workItemIds: ["wi-1"],
      workBranch: "wip/foundation/app-shell",
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
    } as TaskCursorExecutionV1;
    const runs = [verifiedRun(FRAME, "DEV-FRAME-001")];
    const result = advanceQuickRunOrchestrationAfterGithubVerify({
      projectId: "p1",
      githubVerifyOk: true,
      basePatch: {
        taskCursorExecutionV1: execution,
        codeTaskExecutionRunsV1: runs,
        implementationCodeTaskPlanV1: sampleCodeTaskPlanRaw(),
        implementationTaskListV1: {
          version: "implementation_task_list_v1",
          projectId: "p1",
          createdAt: "2026-06-07T00:00:00.000Z",
          updatedAt: "2026-06-07T00:00:00.000Z",
          source: "implementation_seed",
          tasks: [
            {
              taskId: "DEV-FRAME-001",
              title: "Frame",
              description: "d",
              taskType: "feature",
              ownerRole: "developer",
              priority: "medium",
              dependencies: [],
              acceptanceCriteria: [],
              status: "ready",
            },
            {
              taskId: "DEV-SAMPLE-DATA-001",
              title: "Sample",
              description: "d",
              taskType: "feature",
              ownerRole: "developer",
              priority: "medium",
              dependencies: [],
              acceptanceCriteria: [],
              status: "ready",
            },
          ],
          roleSummary: { developer: 2, designer: 0, reviewer: 0, security: 0, scm: 0 },
        },
      },
      quickRun: {
        version: "implementation_quick_run_v1",
        projectId: "p1",
        status: "running",
        updatedAt: "2026-06-07T00:00:00.000Z",
      },
      cursorWorkItemsV1: [
        { id: "wi-frame", taskId: "DEV-FRAME-001", codeTaskId: FRAME, title: "Frame WI" },
        { id: "wi-sample", taskId: "DEV-SAMPLE-DATA-001", codeTaskId: SAMPLE, title: "Sample WI" },
      ],
      dbBundle: {
        job: {
          id: "job-1",
          status: "running",
          selectedCodeTaskIds: [FRAME, SAMPLE],
          currentCodeTaskId: FRAME,
        },
        runs: [],
        currentRun: null,
      } as import("@/lib/runtime/implementationRuntime/implementationRuntimeTypes").ImplementationRuntimeBundleView,
    });
    expect(result.orchestrationPatch).toBeDefined();
    if (result.nextDispatch) {
      expect(result.nextDispatch.codeTaskId).toBe(SAMPLE);
    }
  });
});
