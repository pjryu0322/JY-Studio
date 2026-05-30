import {
  buildInitialCodeAgentWipExecution,
  type CodeAgentWipExecutionV1,
} from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import type { PlatformScmExecutionV1 } from "@/lib/prototype/platformScmExecution";

export const platformScmWipFixturePlan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});

export const platformScmWipFixtureWorkItems =
  buildCursorWorkItemsFromImplementationTaskPlan(platformScmWipFixturePlan);

export type PlatformScmWipFixturePreset =
  | "minimal_real_cursor"
  | "developer_approved"
  | "push_ready"
  | "merge_ready";

const FIXTURE_NOW = "2026-05-30T00:00:00.000Z";

function baseRealCursorCommit() {
  const taskId = platformScmWipFixtureWorkItems[0]!.taskId;
  const workItemId = platformScmWipFixtureWorkItems[0]!.id;
  return {
    sha: "abc1234567890abcdef",
    provider: "cursor" as const,
    branchName: "wip/cursor/dev-1",
    commitMessage: "wip",
    taskId,
    workItemId,
    changedFiles: ["src/App.tsx"],
    diffSummary: [],
    testResults: [],
    unresolvedIssues: [],
    createdAt: FIXTURE_NOW,
  };
}

function basePlatformScmExecution(
  pushStatus: PlatformScmExecutionV1["pushStatus"],
  extra?: Partial<PlatformScmExecutionV1>,
): PlatformScmExecutionV1 {
  const taskId = platformScmWipFixtureWorkItems[0]!.taskId;
  return {
    version: "platform_scm_execution_v1",
    projectId: "p1",
    selectedTaskId: taskId,
    sourceCommitSha: "abc1234567890abcdef",
    sourceBranchName: "wip/cursor/dev-1",
    targetRepository: "owner/repo",
    pushStatus,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...extra,
  };
}

function buildBaseWip(): CodeAgentWipExecutionV1 {
  return buildInitialCodeAgentWipExecution({
    projectId: "p1",
    plan: platformScmWipFixturePlan,
    workItems: platformScmWipFixtureWorkItems,
    executionMode: "cursor_api",
    bridgeExecutionStatus: "bridge_completed",
    bridgeAdapter: "cursor_api",
    selectedTaskId: platformScmWipFixtureWorkItems[0]!.taskId,
  });
}

export function buildPlatformScmWipFixture(input?: {
  readonly preset?: PlatformScmWipFixturePreset;
  readonly overrides?: Partial<CodeAgentWipExecutionV1>;
}): CodeAgentWipExecutionV1 {
  const preset = input?.preset ?? "minimal_real_cursor";
  const commit = baseRealCursorCommit();

  let wip = buildBaseWip();

  switch (preset) {
    case "minimal_real_cursor":
      wip = {
        ...wip,
        commits: [commit],
        branchName: "wip/cursor/dev-1",
        commitSha: commit.sha,
      };
      break;
    case "developer_approved":
      wip = {
        ...wip,
        status: "developer_approved",
        commits: [commit],
        branchName: "wip/cursor/dev-1",
        commitSha: commit.sha,
      };
      break;
    case "push_ready":
      wip = {
        ...wip,
        status: "scm_commit_pending",
        branchName: "wip/cursor/dev-1",
        baseBranch: "main",
        targetRepoFullName: "owner/repo",
        workspacePath: "C:/workspace/repo",
        commitSha: commit.sha,
        commits: [commit],
        platformScmExecutionV1: basePlatformScmExecution("push_requested"),
      };
      break;
    case "merge_ready":
      wip = {
        ...wip,
        status: "scm_commit_pending",
        branchName: "wip/cursor/dev-1",
        commitSha: commit.sha,
        commits: [commit],
        platformScmExecutionV1: basePlatformScmExecution("pr_completed", {
          prNumber: 42,
          prUrl: "https://github.com/owner/repo/pull/42",
          mergeStatus: "merge_pending",
        }),
      };
      break;
  }

  return input?.overrides ? { ...wip, ...input.overrides } : wip;
}

/** @deprecated Use `buildPlatformScmWipFixture({ preset: "push_ready" })` */
export function buildRealCursorWipForPlatformScmPush(
  overrides?: Partial<CodeAgentWipExecutionV1>,
): CodeAgentWipExecutionV1 {
  return buildPlatformScmWipFixture({ preset: "push_ready", overrides });
}

/** @deprecated Use `buildPlatformScmWipFixture({ preset: "merge_ready" })` */
export function buildRealCursorWipForPlatformScmMerge(
  overrides?: Partial<CodeAgentWipExecutionV1>,
): CodeAgentWipExecutionV1 {
  return buildPlatformScmWipFixture({ preset: "merge_ready", overrides });
}
