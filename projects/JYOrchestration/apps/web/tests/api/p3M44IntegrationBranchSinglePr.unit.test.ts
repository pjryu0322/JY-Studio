import { describe, expect, it } from "vitest";
import {
  buildCodeTaskIntegrationPlanDraft,
  buildIntegrationBranchName,
  orderIntegrationTargets,
  CODE_TASK_INTEGRATION_PLAN_VERSION,
} from "@/lib/prototype/implementationIntegrationPlan";
import {
  canCreateIntegrationPullRequest,
  canMergeIntegrationPullRequest,
  integrationPlanHasConflict,
} from "@/lib/prototype/implementationIntegrationConflict";
import type { CompletedCodeTaskIntegrationTarget } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const NOW = "2026-06-03T12:00:00.000Z";

function target(codeTaskId: string, orderHint?: string): CompletedCodeTaskIntegrationTarget {
  return {
    codeTaskId,
    taskId: "DEV-1",
    title: codeTaskId,
    status: "completed",
    commitSha: "sha",
    workBranch: `wip/cursor/${codeTaskId}`,
    source: "runtime_run",
  };
}

describe("P3-M44 integration branch single PR", () => {
  it("names integration branch with project short id and timestamp", () => {
    const name = buildIntegrationBranchName({
      projectId: "cmphxk7y10015unj0wjms1uch",
      now: new Date("2026-06-03T09:30:00.000Z"),
    });
    expect(name).toMatch(/^integration\/cmphxk7y100/);
    expect(name).toContain("20260603-0930");
  });

  it("orders included CodeTasks by selected queue order", () => {
    const included = [target("CT-B"), target("CT-A"), target("CT-C")];
    const ordered = orderIntegrationTargets({
      included,
      codeTaskPlan: null,
      selectedCodeTaskIds: ["CT-C", "CT-A", "CT-B"],
    });
    expect(ordered.map((r) => r.codeTaskId)).toEqual(["CT-C", "CT-A", "CT-B"]);
  });

  it("does not allow PR creation when plan has merge conflict", () => {
    const draft = buildCodeTaskIntegrationPlanDraft({
      projectId: "p1",
      targetRepository: "https://github.com/o/r",
      baseBranch: "main",
      included: [target("CT-1")],
      excluded: [],
      codeTaskPlan: null,
      nowIso: NOW,
    });
    const conflictPlan = {
      ...draft,
      status: "conflict" as const,
      mergeResults: [
        {
          codeTaskId: "CT-1",
          workBranch: "wip/a",
          commitSha: "sha",
          status: "conflict" as const,
        },
      ],
      checkResult: { status: "passed" as const, checks: [{ id: "branch_exists", status: "passed" as const }] },
    };
    expect(integrationPlanHasConflict(conflictPlan)).toBe(true);
    expect(canCreateIntegrationPullRequest(conflictPlan)).toBe(false);
    expect(canMergeIntegrationPullRequest(conflictPlan)).toBe(false);
  });

  it("allows merge only when pr_ready with PR metadata", () => {
    const draft = buildCodeTaskIntegrationPlanDraft({
      projectId: "p1",
      targetRepository: "https://github.com/o/r",
      baseBranch: "main",
      included: [target("CT-1")],
      excluded: [],
      codeTaskPlan: null,
      nowIso: NOW,
    });
    const prReady = {
      ...draft,
      status: "pr_ready" as const,
      pullRequestUrl: "https://github.com/o/r/pull/1",
      pullRequestNumber: 1,
      mergeResults: [
        {
          codeTaskId: "CT-1",
          workBranch: "wip/a",
          commitSha: "sha",
          status: "merged" as const,
        },
      ],
      checkResult: { status: "passed" as const, checks: [{ id: "branch_exists", status: "passed" as const }] },
    };
    expect(canMergeIntegrationPullRequest(prReady)).toBe(true);
    expect(canCreateIntegrationPullRequest(prReady)).toBe(true);
  });

  it("draft plan uses code_task_integration_plan_v1", () => {
    const plan = buildCodeTaskIntegrationPlanDraft({
      projectId: "p1",
      targetRepository: "https://github.com/o/r",
      baseBranch: "main",
      included: [],
      excluded: [],
      codeTaskPlan: {
        version: "implementation_code_task_plan_v1",
        tasks: [],
      } as ImplementationCodeTaskPlanV1,
      nowIso: NOW,
    });
    expect(plan.version).toBe(CODE_TASK_INTEGRATION_PLAN_VERSION);
    expect(plan.baseBranch).toBe("main");
  });
});
