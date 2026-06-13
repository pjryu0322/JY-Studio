import { describe, expect, it } from "vitest";
import {
  analyzeImplementationBranchTopology,
  resolveIntegrationSourceBranchForTopology,
} from "@/lib/prototype/implementationBranchTopology";
import {
  buildImplementationCodeTaskSummaryCounts,
  listVisibleImplementationCodeTaskIds,
} from "@/lib/prototype/implementationCodeTaskSummary";
import { runIntegrationConflictPrecheck } from "@/lib/prototype/integrationConflictPrecheck";
import {
  formatImplementationExecutionOverviewLines,
  buildImplementationExecutionOverview,
} from "@/lib/prototype/implementationExecutionOverview";
import { buildImplementationExecutionBoardFromRequirementsState } from "@/lib/prototype/implementationExecutionBoard";
import { summarizeCodeTaskExecutionQueueRuns } from "@/lib/prototype/codeTaskExecutionRunUi";
import { buildVerifiedCodeTaskGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import { INTEGRATION_WIRING_CODE_TASK_ID } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { selectAllVisibleCodeTaskIdsInPlan } from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const CHAIN_HEAD = "wip/screen/workspace";
const NOW = "2026-06-03T12:00:00.000Z";

function linearChainBranchPlan(): NonNullable<ImplementationCodeTaskPlanV1["implementationBranchPlanV1"]> {
  const branches = [
    { groupId: "foundation" as const, workBranch: "wip/foundation/app-shell", baseBranch: "main" },
    { groupId: "data" as const, workBranch: "wip/data/sample-data", baseBranch: "wip/foundation/app-shell" },
    { groupId: "common" as const, workBranch: "wip/common/components", baseBranch: "wip/data/sample-data" },
    { groupId: "feature" as const, workBranch: "wip/feature/core-flow", baseBranch: "wip/common/components" },
    { groupId: "screen" as const, workBranch: CHAIN_HEAD, baseBranch: "wip/feature/core-flow" },
  ];
  return {
    version: "implementation_branch_plan_v1",
    baseBranch: "main",
    executionOrder: ["foundation", "data", "common", "feature", "screen", "integration"],
    groups: branches.map((b) => ({
      groupId: b.groupId,
      workBranch: b.workBranch,
      baseBranch: b.baseBranch,
    })),
  };
}

function codeTask(id: string, group: string, workBranch: string, baseBranch: string) {
  return {
    codeTaskId: id,
    parentTaskId: `DEV-${id}`,
    title: id,
    description: "",
    changeType: "feature" as const,
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    candidateFiles: [],
    branchPlan: {
      branchGroup: group,
      workBranch,
      baseBranch,
      executionMode: "sequential" as const,
    },
  };
}

function planWithIntegrationWiring(): ImplementationCodeTaskPlanV1 {
  const impl = linearChainBranchPlan();
  const visibleIds = ["CT-1", "CT-2", "CT-3", "CT-4", "CT-5"];
  const groups = ["foundation", "data", "common", "feature", "screen"] as const;
  const branches = impl.groups!;
  const tasks = visibleIds.map((id, i) =>
    codeTask(id, groups[i]!, branches[i]!.workBranch!, branches[i]!.baseBranch!),
  );
  tasks.push({
    codeTaskId: INTEGRATION_WIRING_CODE_TASK_ID,
    parentTaskId: "DEV-INTEGRATION-001",
    title: "최종 연결/통합 Wiring",
    description: "",
    changeType: "integration",
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    candidateFiles: [],
    branchPlan: {
      branchGroup: "integration",
      workBranch: "wip/integration/wiring",
      baseBranch: CHAIN_HEAD,
      executionMode: "integration_only" as const,
    },
  });
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    codeTaskCount: 5,
    tasks,
    implementationBranchPlanV1: impl,
  };
}

function verifiedRun(codeTaskId: string, changedFiles: readonly string[]): CodeTaskExecutionRunV1 {
  return {
    runId: `run-${codeTaskId}`,
    projectId: "p1",
    processTaskId: "DEV-X",
    workItemId: "wi",
    codeTaskId,
    status: "github_verified",
    workBranch: "wip/x",
    commitSha: "abc",
    branchHeadCommitSha: "abc",
    changedFiles: [...changedFiles],
    githubOutcome: buildVerifiedCodeTaskGithubOutcome({
      checkedAt: NOW,
      workBranch: "wip/x",
      commitSha: "abc",
    }),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function sampleList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [],
    roleSummary: { developer: 0, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("P3-M65 CodeTask summary counts", () => {
  it("excludes integration wiring from visible total (6 plan tasks → 5 visible)", () => {
    const plan = planWithIntegrationWiring();
    expect(plan.tasks).toHaveLength(6);
    expect(listVisibleImplementationCodeTaskIds(plan)).toHaveLength(5);
    const summary = buildImplementationCodeTaskSummaryCounts({
      codeTaskPlan: plan,
      selectedCodeTaskIds: [...listVisibleImplementationCodeTaskIds(plan), INTEGRATION_WIRING_CODE_TASK_ID],
      runs: [],
    });
    expect(summary.totalCodeTaskCount).toBe(5);
    expect(summary.selectedCodeTaskCount).toBe(5);
    expect(summary.removedStaleSelectedIds).toContain(INTEGRATION_WIRING_CODE_TASK_ID);
  });

  it("shows completed ratio against visible total only", () => {
    const plan = planWithIntegrationWiring();
    const visible = listVisibleImplementationCodeTaskIds(plan);
    const runs = visible.map((id) => verifiedRun(id, [`src/${id}.ts`]));
    const summary = buildImplementationCodeTaskSummaryCounts({
      codeTaskPlan: plan,
      selectedCodeTaskIds: visible,
      runs,
    });
    expect(summary.completedCodeTaskCount).toBe(5);
    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: "p1",
      orchestration: { implementationTaskListV1: sampleList() },
    })!;
    const overview = buildImplementationExecutionOverview({
      board,
      codeTaskPlan: plan,
      selectedCodeTaskIds: visible,
      codeTaskRuns: runs,
    });
    const text = formatImplementationExecutionOverviewLines(overview, {
      selectedCodeTaskCount: summary.selectedCodeTaskCount,
      selectedCompletedCount: summary.completedCodeTaskCount,
    }).join("\n");
    expect(text).toContain("전체 CodeTask: 5개");
    expect(text).toContain("완료 CodeTask: 5 / 5");
  });

  it("select all uses visible CodeTask ids only", () => {
    const plan = planWithIntegrationWiring();
    const selected = selectAllVisibleCodeTaskIdsInPlan({ selectAll: true, codeTaskPlan: plan });
    expect(selected).toHaveLength(5);
    expect(selected).not.toContain(INTEGRATION_WIRING_CODE_TASK_ID);
  });

  it("counts verified over stale failed latest run", () => {
    const plan = planWithIntegrationWiring();
    const id = "CT-1";
    const failed: CodeTaskExecutionRunV1 = {
      ...verifiedRun(id, []),
      runId: "run-failed",
      status: "failed",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      githubOutcome: undefined,
    };
    const verified = verifiedRun(id, ["a.ts"]);
    const summary = buildImplementationCodeTaskSummaryCounts({
      codeTaskPlan: plan,
      selectedCodeTaskIds: [id],
      runs: [failed, verified],
    });
    expect(summary.completedCodeTaskCount).toBe(1);
    const queueSummary = summarizeCodeTaskExecutionQueueRuns({
      runs: [failed, verified],
      selectedCodeTaskIds: [id],
    });
    expect(queueSummary.completed).toBe(1);
    expect(queueSummary.failed).toBe(0);
  });
});

describe("P3-M65 branch topology and conflict precheck", () => {
  it("detects linear chain and chain head", () => {
    const plan = planWithIntegrationWiring();
    const topology = analyzeImplementationBranchTopology({ codeTaskPlan: plan });
    expect(topology.kind).toBe("linear_chain");
    if (topology.kind === "linear_chain") {
      expect(topology.chainHead).toBe(CHAIN_HEAD);
      expect(topology.orderedBranches).toHaveLength(5);
    }
    expect(resolveIntegrationSourceBranchForTopology({ topology })).toBe(CHAIN_HEAD);
  });

  it("linear chain overlap is info not blocking", () => {
    const plan = planWithIntegrationWiring();
    const visible = listVisibleImplementationCodeTaskIds(plan);
    const sharedFile = "src/App.tsx";
    const included = visible.map((codeTaskId, i) => ({
      codeTaskId,
      taskId: `DEV-${codeTaskId}`,
      workBranch: plan.implementationBranchPlanV1!.groups![i]!.workBranch!,
      commitSha: "sha",
      title: codeTaskId,
      status: "completed",
      source: "runtime_run" as const,
    }));
    const runs = visible.map((id) => verifiedRun(id, [sharedFile]));
    const precheck = runIntegrationConflictPrecheck({
      included,
      codeTaskPlan: plan,
      codeTaskRuns: runs,
    });
    expect(precheck.status).toBe("info");
    expect(precheck.cumulativeOverlap).toBe(true);
    expect(precheck.overlapFiles.length).toBeGreaterThan(0);
    expect(precheck.message).toContain("선형 Branch Plan");
  });
});
