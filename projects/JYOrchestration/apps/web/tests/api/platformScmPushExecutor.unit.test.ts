import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import {
  executePlatformScmPushAndPr,
  validatePlatformScmPushReadiness,
} from "@/lib/prototype/platformScmPushExecutor";

vi.mock("@/lib/prototype/cursorBridgeGit", () => ({
  pushWorktreeBranch: vi.fn(),
}));

vi.mock("@/lib/prototype/platformScmGitHub", () => ({
  buildPlatformScmPullRequestTitle: vi.fn(() => "title"),
  buildPlatformScmPullRequestBody: vi.fn(() => "body"),
  createPlatformScmPullRequest: vi.fn(),
}));

import { pushWorktreeBranch } from "@/lib/prototype/cursorBridgeGit";
import { createPlatformScmPullRequest } from "@/lib/prototype/platformScmGitHub";

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
    baseBranch: "main",
    targetRepoFullName: "owner/repo",
    workspacePath: "C:/workspace/repo",
    commitSha: "abc1234567890abcdef",
    platformScmExecutionV1: {
      version: "platform_scm_execution_v1" as const,
      projectId: "p1",
      selectedTaskId: workItems[0]!.taskId,
      sourceCommitSha: "abc1234567890abcdef",
      sourceBranchName: "wip/cursor/dev-1",
      targetRepository: "owner/repo",
      pushStatus: "push_requested" as const,
      createdAt: "2026-05-30T00:00:00.000Z",
      updatedAt: "2026-05-30T00:00:00.000Z",
    },
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
  };
}

describe("platformScmPushExecutor", () => {
  beforeEach(() => {
    vi.mocked(pushWorktreeBranch).mockReset();
    vi.mocked(createPlatformScmPullRequest).mockReset();
  });

  it("validatePlatformScmPushReadiness blocks without github token", () => {
    const result = validatePlatformScmPushReadiness({
      wip: realCursorWip(),
      setup: { gitRepoName: "owner/repo", baseBranch: "main" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("GitHub Access Token");
  });

  it("executePlatformScmPushAndPr completes push and PR", async () => {
    vi.mocked(pushWorktreeBranch).mockResolvedValue({ pushed: true, log: ["ok"] });
    vi.mocked(createPlatformScmPullRequest).mockResolvedValue({
      ok: true,
      prNumber: 42,
      prUrl: "https://github.com/owner/repo/pull/42",
      reusedExisting: false,
    });

    const result = await executePlatformScmPushAndPr({
      projectId: "p1",
      wip: realCursorWip(),
      setup: {
        gitRepoName: "owner/repo",
        gitRepoUrl: "https://github.com/owner/repo",
        baseBranch: "main",
        githubAccessToken: "gh-token",
      },
      nowIso: "2026-05-30T01:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    expect(result.platformScmExecutionV1?.pushStatus).toBe("pr_completed");
    expect(result.prNumber).toBe(42);
    expect(pushWorktreeBranch).toHaveBeenCalledWith({
      workdir: "C:/workspace/repo",
      branchName: "wip/cursor/dev-1",
    });
  });

  it("executePlatformScmPushAndPr returns failed when push fails", async () => {
    vi.mocked(pushWorktreeBranch).mockResolvedValue({
      pushed: false,
      errorMessage: "denied",
      log: ["fail"],
    });

    const result = await executePlatformScmPushAndPr({
      projectId: "p1",
      wip: realCursorWip(),
      setup: {
        gitRepoName: "owner/repo",
        gitRepoUrl: "https://github.com/owner/repo",
        baseBranch: "main",
        githubAccessToken: "gh-token",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.platformScmExecutionV1?.pushStatus).toBe("push_failed");
  });
});
