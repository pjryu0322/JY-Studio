import { describe, expect, it } from "vitest";
import { buildExecutionUnitsFromLegacyState } from "@/lib/prototype/implementationExecutionUnitBuilder";
import {
  reconcileSelectedExecutionUnitIds,
  resolveNextExecutableUnit,
} from "@/lib/prototype/implementationExecutionScheduler";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { evaluateExecutionUnitGithubVerifyOutcome } from "@/lib/prototype/implementationExecutionUnitGitHubVerify";
import { INTEGRATION_WIRING_CODE_TASK_ID } from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { resolveNextSelectedCodeTaskAfterVerified } from "@/lib/prototype/resolveNextSelectedCodeTaskAfterVerified";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { CODE_TASK_EXECUTION_RUN_VERSION } from "@/lib/prototype/codeTaskExecutionRun";
import { runHasVerifiedGithubOutcome } from "@/lib/prototype/codeTaskGithubOutcome";
import { isCodeTaskCompletedForSummary } from "@/lib/prototype/implementationCodeTaskSummary";

const SCREEN_1 = "CODE-DEV-SCREEN-001-001";
const SCREEN_2 = "CODE-DEV-SCREEN-002-001";

function screenTask(id: string, parent: string, workBranch: string, deps: string[] = []) {
  return {
    codeTaskId: id,
    parentTaskId: parent,
    title: id,
    description: "",
    changeType: "feature" as const,
    dependencies: deps,
    codeTaskDependencies: deps,
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    candidateFiles: [],
    branchPlan: {
      branchGroup: "screen" as const,
      workBranch,
      baseBranch: "wip/feature/core-flow",
      executionMode: "sequential" as const,
    },
  };
}

function planWithTwoScreens(): ImplementationCodeTaskPlanV1 {
  const tasks = [
    screenTask(SCREEN_1, "DEV-SCREEN-001", "wip/screen/workspace"),
    screenTask(SCREEN_2, "DEV-SCREEN-002", "wip/screen/workspace", [SCREEN_1]),
    {
      codeTaskId: INTEGRATION_WIRING_CODE_TASK_ID,
      parentTaskId: "DEV-INTEGRATION-001",
      title: "최종 연결/통합 Wiring",
      description: "",
      changeType: "integration" as const,
      acceptanceCriteria: [],
      verificationHints: [],
      forbiddenPaths: [],
      candidateFiles: [],
      branchPlan: {
        branchGroup: "integration" as const,
        workBranch: "wip/integration/final",
        baseBranch: "wip/screen/workspace",
        executionMode: "integration_only" as const,
      },
    },
  ];
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    generatedAt: "2026-06-03T00:00:00.000Z",
    tasks,
  };
}

function verifiedRun(codeTaskId: string, sha: string): CodeTaskExecutionRunV1 {
  return {
    version: CODE_TASK_EXECUTION_RUN_VERSION,
    runId: `run-${codeTaskId}`,
    projectId: "p1",
    processTaskId: "DEV",
    workItemId: "wi",
    codeTaskId,
    status: "github_verified",
    attemptNo: 1,
    createdAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T01:00:00.000Z",
    githubOutcome: {
      status: "verified",
      checkedAt: "2026-06-03T01:00:00.000Z",
      workBranch: "wip/screen/workspace",
      commitSha: sha,
      source: "github_rest",
      headSha: sha,
      baseHeadSha: "base-sha",
    },
  };
}

describe("P3-M68 ExecutionUnit build", () => {
  it("creates one unit per executable CodeTask (wiring integration_only excluded)", () => {
    const { units, audit } = buildExecutionUnitsFromLegacyState({
      codeTaskPlan: planWithTwoScreens(),
      workItemCount: 16,
    });
    expect(units).toHaveLength(2);
    expect(audit.unitCount).toBe(2);
    expect(audit.workItemCount).toBe(16);
    expect(audit.excludedPseudoCount).toBeGreaterThan(0);
  });
});

describe("P3-M68 resolveNextExecutableUnit", () => {
  it("selects next ready unit after verified screen-001", () => {
    const { units } = buildExecutionUnitsFromLegacyState({
      codeTaskPlan: planWithTwoScreens(),
      runs: [verifiedRun(SCREEN_1, "sha-a")],
    });
    const selected = units.map((u) => u.unitId);
    const next = resolveNextExecutableUnit({ units, selectedUnitIds: selected });
    expect(next.status).toBe("next");
    if (next.status === "next") {
      expect(next.unit.codeTaskId).toBe(SCREEN_2);
    }
  });

  it("returns complete when all selected units are verified", () => {
    const { units } = buildExecutionUnitsFromLegacyState({
      codeTaskPlan: planWithTwoScreens(),
      runs: [verifiedRun(SCREEN_1, "sha-a"), verifiedRun(SCREEN_2, "sha-b")],
    });
    const selected = units.map((u) => u.unitId);
    const next = resolveNextExecutableUnit({ units, selectedUnitIds: selected });
    expect(next.status).toBe("complete");
  });

  it("blocks new dispatch while verifying", () => {
    const { units } = buildExecutionUnitsFromLegacyState({
      codeTaskPlan: planWithTwoScreens(),
      runs: [
        verifiedRun(SCREEN_1, "sha-a"),
        {
          ...verifiedRun(SCREEN_2, "sha-b"),
          status: "github_verifying",
          githubOutcome: { status: "pending" },
        },
      ],
    });
    const selected = units.map((u) => u.unitId);
    const next = resolveNextExecutableUnit({ units, selectedUnitIds: selected });
    expect(next.status).toBe("in_flight");
  });
});

describe("P3-M68 summary counts", () => {
  it("uses verified ExecutionUnit for completed count", () => {
    const summary = buildImplementationExecutionSummaryCounts({
      codeTaskPlan: planWithTwoScreens(),
      selectedCodeTaskIds: [SCREEN_1, SCREEN_2],
      runs: [verifiedRun(SCREEN_1, "sha-a")],
      workItemCount: 16,
    });
    expect(summary.totalCodeTaskCount).toBe(2);
    expect(summary.selectedCodeTaskCount).toBe(2);
    expect(summary.completedCodeTaskCount).toBe(1);
  });

  it("does not count toast-only github_verified without persisted outcome", () => {
    const run: CodeTaskExecutionRunV1 = {
      ...verifiedRun(SCREEN_1, "sha-a"),
      githubOutcome: undefined,
      status: "github_verified",
    };
    expect(isCodeTaskCompletedForSummary(run)).toBe(false);
    expect(runHasVerifiedGithubOutcome(run)).toBe(false);
  });
});

describe("P3-M68 same workBranch verify", () => {
  it("verified when afterHeadSha differs from beforeHeadSha", () => {
    const outcome = evaluateExecutionUnitGithubVerifyOutcome({
      beforeHeadSha: "aaa",
      afterHeadSha: "bbb",
    });
    expect(outcome.status).toBe("verified");
  });

  it("failed when head unchanged without noCodeChange evidence", () => {
    const outcome = evaluateExecutionUnitGithubVerifyOutcome({
      beforeHeadSha: "aaa",
      afterHeadSha: "aaa",
    });
    expect(outcome.status).toBe("failed_commit_not_created");
  });
});

describe("P3-M68 screen continuation resolve", () => {
  it("resolves SCREEN-002 after SCREEN-001 verified", () => {
    const resolved = resolveNextSelectedCodeTaskAfterVerified({
      selectedCodeTaskIds: [SCREEN_1, SCREEN_2],
      currentCodeTaskId: SCREEN_1,
      codeTaskPlan: planWithTwoScreens(),
      executionRuns: [verifiedRun(SCREEN_1, "sha-a")],
    });
    expect(resolved.status).toBe("next_ready");
    if (resolved.status === "next_ready") {
      expect(resolved.codeTaskId).toBe(SCREEN_2);
    }
  });
});

describe("P3-M68 selection reconcile", () => {
  it("drops stale selected unit ids", () => {
    const { units } = buildExecutionUnitsFromLegacyState({ codeTaskPlan: planWithTwoScreens() });
    const { selectedUnitIds, removedIds } = reconcileSelectedExecutionUnitIds({
      selectedUnitIds: [SCREEN_1, "stale-id"],
      units,
    });
    expect(selectedUnitIds).toEqual([SCREEN_1]);
    expect(removedIds).toEqual(["stale-id"]);
  });
});
