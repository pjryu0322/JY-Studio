import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyRestMock = vi.fn();
const completeAdvanceMock = vi.fn();
const failVerifyMock = vi.fn();

vi.mock("@/lib/prototype/taskCursorGithubVerify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prototype/taskCursorGithubVerify")>();
  return {
    ...actual,
    verifyTaskCursorGithubResult: (...args: unknown[]) => verifyRestMock(...args),
  };
});

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeRepository", () => ({
  getImplementationRuntimeBundle: vi.fn(async () => ({ job: null, runs: [], currentRun: null })),
}));

vi.mock("@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService", () => ({
  completeImplementationRuntimeGithubVerifyAndAdvance: (...args: unknown[]) =>
    completeAdvanceMock(...args),
  failImplementationRuntimeGithubVerify: (...args: unknown[]) => failVerifyMock(...args),
}));

import {
  applyImplementationRuntimeGithubVerifyResult,
  verifyImplementationRuntimeRunOnGithub,
} from "@/lib/runtime/implementationRuntime/implementationGithubVerificationService";

describe("implementationRuntimeGithubVerificationService", () => {
  beforeEach(() => {
    verifyRestMock.mockReset();
    completeAdvanceMock.mockReset();
    failVerifyMock.mockReset();
    completeAdvanceMock.mockResolvedValue({ job: null, runs: [], currentRun: null });
    failVerifyMock.mockResolvedValue({ job: null, runs: [], currentRun: null });
  });

  it("applyImplementationRuntimeGithubVerifyResult advances on ok without REST", async () => {
    const outcome = await applyImplementationRuntimeGithubVerifyResult({
      projectId: "p1",
      jobId: "job-1",
      runId: "run-1",
      verifyResult: { ok: true, verifiedCommitSha: "sha1" },
    });
    expect(verifyRestMock).not.toHaveBeenCalled();
    expect(completeAdvanceMock).toHaveBeenCalledWith(
      expect.objectContaining({ commitSha: "sha1" }),
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.outcomeType).toBe("github_verified");
  });

  it("does not fail DB runtime when branch is not found yet", async () => {
    const outcome = await applyImplementationRuntimeGithubVerifyResult({
      projectId: "p1",
      jobId: "job-1",
      runId: "run-1",
      verifyResult: {
        ok: false,
        detailReason: "branch_not_found",
        reason: "github_verify_failed",
        message: "branch missing",
      },
    });
    expect(failVerifyMock).not.toHaveBeenCalled();
    expect(outcome.outcomeType).toBe("github_missing");
  });

  it("verifyImplementationRuntimeRunOnGithub calls REST once then applies result", async () => {
    verifyRestMock.mockResolvedValue({ ok: true, verifiedCommitSha: "sha2" });
    await verifyImplementationRuntimeRunOnGithub({
      projectId: "p1",
      jobId: "job-1",
      runId: "run-1",
      verify: {
        execution: {} as never,
        targetRepository: { owner: "o", repo: "r", defaultBranch: "main" },
        githubToken: "ghp_x",
        allowedPathGlobs: [],
      },
    });
    expect(verifyRestMock).toHaveBeenCalledTimes(1);
    expect(completeAdvanceMock).toHaveBeenCalled();
  });
});
