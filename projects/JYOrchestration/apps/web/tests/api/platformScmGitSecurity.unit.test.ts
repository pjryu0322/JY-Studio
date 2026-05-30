import { describe, expect, it, vi, beforeEach } from "vitest";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

vi.mock("node:util", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:util")>();
  return {
    ...actual,
    promisify: (fn: unknown) => fn,
  };
});

import {
  buildGithubAuthenticatedPushUrl,
  maskSecret,
  sanitizeGitErrorMessage,
  validateScmPushBranchName,
} from "@/lib/prototype/platformScmGitSecurity";
import { verifyWorktreeHeadForPlatformScm } from "@/lib/prototype/platformScmWorktreeVerification";

function mockGitSequence(calls: ReadonlyArray<Readonly<{ stdout: string; stderr?: string }> | Error>) {
  let i = 0;
  execFileMock.mockImplementation((...args: unknown[]) => {
    const cb = args.find((a) => typeof a === "function") as
      | ((err: Error | null, stdout: string, stderr: string) => void)
      | undefined;
    const next = calls[i++];
    if (!next) {
      const err = new Error("unexpected git call");
      if (cb) {
        cb(err, "", "");
        return;
      }
      return Promise.reject(err);
    }
    if (next instanceof Error) {
      if (cb) {
        cb(next, "", "");
        return;
      }
      return Promise.reject(next);
    }
    const stdout = next.stdout;
    const stderr = next.stderr ?? "";
    if (cb) {
      cb(null, stdout, stderr);
      return;
    }
    return Promise.resolve({ stdout, stderr });
  });
}

describe("platformScmGitSecurity", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("maskSecret hides middle of token-like values", () => {
    expect(maskSecret("github_pat_abc123xyz")).toBe("gith****xyz");
    expect(maskSecret("short")).toBe("****");
  });

  it("sanitizeGitErrorMessage removes token from git errors", () => {
    const token = "ghp_secretTokenValue123";
    const message = `fatal: unable to access 'https://x-access-token:${token}@github.com/o/r.git': denied`;
    const sanitized = sanitizeGitErrorMessage(message, token);
    expect(sanitized).not.toContain(token);
    expect(sanitized).toContain("x-access-token:****");
  });

  it("buildGithubAuthenticatedPushUrl builds github push URL", () => {
    const url = buildGithubAuthenticatedPushUrl({
      repoFullName: "owner/repo",
      githubAccessToken: "ghp_test_token",
    });
    expect(url).toContain("https://x-access-token:");
    expect(url).toContain("@github.com/owner/repo.git");
    expect(maskSecret(url!)).not.toContain("ghp_test_token");
  });

  it("validateScmPushBranchName blocks main/master/base branch", () => {
    expect(validateScmPushBranchName({ branchName: "main" }).ok).toBe(false);
    expect(validateScmPushBranchName({ branchName: "master" }).ok).toBe(false);
    expect(validateScmPushBranchName({ branchName: "main", baseBranch: "develop" }).ok).toBe(false);
    expect(validateScmPushBranchName({ branchName: "develop", baseBranch: "develop" }).ok).toBe(false);
    expect(validateScmPushBranchName({ branchName: "wip/cursor/dev-1", baseBranch: "main" }).ok).toBe(true);
    expect(validateScmPushBranchName({ branchName: "feature/foo", baseBranch: "main" }).ok).toBe(true);
    expect(validateScmPushBranchName({ branchName: "hotfix/foo", baseBranch: "main" }).ok).toBe(false);
  });

  it("verifyWorktreeHeadForPlatformScm passes when branch and HEAD match", async () => {
    mockGitSequence([
      { stdout: "true" },
      { stdout: "wip/cursor/dev-1" },
      { stdout: "abc1234567890abcdef" },
    ]);

    const result = await verifyWorktreeHeadForPlatformScm({
      workdir: "C:/repo",
      expectedBranchName: "wip/cursor/dev-1",
      expectedCommitSha: "abc1234567890abcdef",
      baseBranch: "main",
    });
    expect(result.ok).toBe(true);
  });

  it("verifyWorktreeHeadForPlatformScm fails when HEAD differs from sourceCommitSha", async () => {
    mockGitSequence([
      { stdout: "true" },
      { stdout: "wip/cursor/dev-1" },
      { stdout: "deadbeef000000000000" },
    ]);

    const result = await verifyWorktreeHeadForPlatformScm({
      workdir: "C:/repo",
      expectedBranchName: "wip/cursor/dev-1",
      expectedCommitSha: "abc1234567890abcdef",
      baseBranch: "main",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("HEAD");
  });

  it("verifyWorktreeHeadForPlatformScm blocks wip-stub sha", async () => {
    const result = await verifyWorktreeHeadForPlatformScm({
      workdir: "C:/repo",
      expectedBranchName: "wip/cursor/dev-1",
      expectedCommitSha: "wip-stub-123",
      baseBranch: "main",
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("wip-stub");
    expect(execFileMock).not.toHaveBeenCalled();
  });
});
