import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  executePlatformScmPushAndPr,
  validatePlatformScmPushReadiness,
} from "@/lib/prototype/platformScmPushExecutor";
import { buildPlatformScmWipFixture } from "../fixtures/platformScmWipFixture";

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

describe("platformScmPushExecutor", () => {
  beforeEach(() => {
    vi.mocked(pushWorktreeBranch).mockReset();
    vi.mocked(createPlatformScmPullRequest).mockReset();
  });

  it("validatePlatformScmPushReadiness blocks without github token", () => {
    const result = validatePlatformScmPushReadiness({
      wip: buildPlatformScmWipFixture({ preset: "push_ready" }),
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

    const wip = buildPlatformScmWipFixture({ preset: "push_ready" });
    const result = await executePlatformScmPushAndPr({
      projectId: "p1",
      wip,
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
      wip: buildPlatformScmWipFixture({ preset: "push_ready" }),
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
