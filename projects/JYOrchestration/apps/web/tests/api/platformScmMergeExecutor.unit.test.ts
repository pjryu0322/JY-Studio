import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import {
  executePlatformScmMerge,
  validatePlatformScmMergeReadiness,
} from "@/lib/prototype/platformScmMergeExecutor";

vi.mock("@/lib/prototype/platformScmDiffGateValidator", () => ({
  evaluatePlatformScmQualityGateMergePolicy: vi.fn(() => ({
    ok: true,
    message: "ok",
    requiresDiffValidation: false,
  })),
  validatePlatformScmPrDiffGate: vi.fn(async () => ({
    ok: true,
    status: "validated",
    message: "validated",
  })),
}));

vi.mock("@/lib/service/githubAutoMergeService", () => ({
  isAutoMergeEnabled: vi.fn(() => true),
  autoMergePullRequest: vi.fn(),
}));

import { autoMergePullRequest, isAutoMergeEnabled } from "@/lib/service/githubAutoMergeService";

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);

function realCursorWip() {
  const wip = buildInitialCodeAgentWipExecution({
    projectId: "p1",
    plan,
    workItems,
    executionMode: "cursor_api",
    bridgeExecutionStatus: "bridge_completed",
    selectedTaskId: workItems[0]!.taskId,
  });
  return {
    ...wip,
    status: "scm_commit_pending" as const,
    branchName: "wip/cursor/dev-1",
    commitSha: "abc1234567890abcdef",
    commits: [
      {
        sha: "abc1234567890abcdef",
        provider: "cursor" as const,
        branchName: "wip/cursor/dev-1",
        commitMessage: "wip",
        taskId: workItems[0]!.taskId,
        workItemId: workItems[0]!.id,
        changedFiles: ["src/App.tsx"],
        diffSummary: [],
        testResults: [],
        unresolvedIssues: [],
        createdAt: "2026-05-30T00:00:00.000Z",
      },
    ],
    platformScmExecutionV1: {
      version: "platform_scm_execution_v1" as const,
      projectId: "p1",
      selectedTaskId: workItems[0]!.taskId,
      sourceCommitSha: "abc1234567890abcdef",
      sourceBranchName: "wip/cursor/dev-1",
      targetRepository: "owner/repo",
      pushStatus: "pr_completed" as const,
      prNumber: 42,
      prUrl: "https://github.com/owner/repo/pull/42",
      mergeStatus: "merge_pending" as const,
      createdAt: "2026-05-30T00:00:00.000Z",
      updatedAt: "2026-05-30T00:00:00.000Z",
    },
  };
}

describe("platformScmMergeExecutor", () => {
  beforeEach(() => {
    vi.mocked(isAutoMergeEnabled).mockReturnValue(true);
    vi.mocked(autoMergePullRequest).mockReset();
  });

  it("validatePlatformScmMergeReadiness blocks without PR", () => {
    const wip = { ...realCursorWip(), platformScmExecutionV1: undefined };
    const result = validatePlatformScmMergeReadiness({
      wip,
      setup: { githubAccessToken: "token", gitRepoName: "owner/repo", baseBranch: "main" },
    });
    expect(result.ok).toBe(false);
  });

  it("executePlatformScmMerge completes when auto-merge succeeds", async () => {
    vi.mocked(autoMergePullRequest).mockResolvedValue({
      ok: true,
      merged: true,
      pullRequest: { owner: "owner", repo: "repo", number: 42, url: "https://github.com/owner/repo/pull/42" },
    });

    const result = await executePlatformScmMerge({
      projectId: "p1",
      wip: realCursorWip(),
      setup: {
        githubAccessToken: "token",
        gitRepoName: "owner/repo",
        gitRepoUrl: "https://github.com/owner/repo",
        baseBranch: "main",
      },
      nowIso: "2026-05-30T02:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(result.merged).toBe(true);
    expect(result.platformScmExecutionV1?.mergeStatus).toBe("merge_completed");
  });

  it("executePlatformScmMerge returns pending when auto-merge disabled and autoMergeOnly", async () => {
    vi.mocked(isAutoMergeEnabled).mockReturnValue(false);

    const result = await executePlatformScmMerge({
      projectId: "p1",
      wip: realCursorWip(),
      setup: {
        githubAccessToken: "token",
        gitRepoName: "owner/repo",
        gitRepoUrl: "https://github.com/owner/repo",
        baseBranch: "main",
      },
      autoMergeOnly: true,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("pending");
    expect(result.merged).toBe(false);
    expect(result.platformScmExecutionV1?.mergeStatus).toBe("merge_pending");
  });
});
