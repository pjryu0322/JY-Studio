import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  executePlatformScmMerge,
  validatePlatformScmMergeReadiness,
} from "@/lib/prototype/platformScmMergeExecutor";
import { buildPlatformScmWipFixture } from "../fixtures/platformScmWipFixture";

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

describe("platformScmMergeExecutor", () => {
  beforeEach(() => {
    vi.mocked(isAutoMergeEnabled).mockReturnValue(true);
    vi.mocked(autoMergePullRequest).mockReset();
  });

  it("validatePlatformScmMergeReadiness blocks without PR", () => {
    const wip = { ...buildPlatformScmWipFixture({ preset: "merge_ready" }), platformScmExecutionV1: undefined };
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
      wip: buildPlatformScmWipFixture({ preset: "merge_ready" }),
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
      wip: buildPlatformScmWipFixture({ preset: "merge_ready" }),
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
