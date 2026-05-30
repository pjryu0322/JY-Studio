import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  evaluatePlatformScmQualityGateMergePolicy,
  validatePlatformScmPrDiffGate,
} from "@/lib/prototype/platformScmDiffGateValidator";
import { IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION } from "@/lib/prototype/implementationQualityGate";
import { buildPlatformScmWipFixture } from "../fixtures/platformScmWipFixture";

vi.mock("@/lib/service/githubPullRequestOps", () => ({
  fetchGithubPullRequestDetail: vi.fn(),
  fetchGithubPullRequestFiles: vi.fn(),
}));

import {
  fetchGithubPullRequestDetail,
  fetchGithubPullRequestFiles,
} from "@/lib/service/githubPullRequestOps";

describe("platformScmDiffGateValidator", () => {
  beforeEach(() => {
    vi.mocked(fetchGithubPullRequestDetail).mockReset();
    vi.mocked(fetchGithubPullRequestFiles).mockReset();
  });

  it("evaluatePlatformScmQualityGateMergePolicy passes when reviewer/security passed", () => {
    const result = evaluatePlatformScmQualityGateMergePolicy({
      qualityGateResults: [
        {
          version: IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION,
          role: "reviewer",
          status: "passed",
          createdAt: "2026-05-30T00:00:00.000Z",
          updatedAt: "2026-05-30T00:00:00.000Z",
          source: "mock_local_gate",
          summary: "ok",
          checks: [],
          failedTaskIds: [],
        },
        {
          version: IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION,
          role: "security",
          status: "passed",
          createdAt: "2026-05-30T00:00:00.000Z",
          updatedAt: "2026-05-30T00:00:00.000Z",
          source: "mock_local_gate",
          summary: "ok",
          checks: [],
          failedTaskIds: [],
        },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.requiresDiffValidation).toBe(false);
  });

  it("evaluatePlatformScmQualityGateMergePolicy requires diff validation when engine pending", () => {
    const result = evaluatePlatformScmQualityGateMergePolicy({
      qualityGateResults: [
        {
          version: IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION,
          role: "reviewer",
          status: "failed",
          engineConnectionStatus: "pending_engine_connection",
          createdAt: "2026-05-30T00:00:00.000Z",
          updatedAt: "2026-05-30T00:00:00.000Z",
          source: "mock_local_gate",
          summary: "pending",
          checks: [],
          failedTaskIds: [],
        },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.requiresDiffValidation).toBe(true);
  });

  it("validatePlatformScmPrDiffGate validates PR files against WIP changed files", async () => {
    vi.mocked(fetchGithubPullRequestDetail).mockResolvedValue({
      ok: true,
      pr: { head: { sha: "abc1234567890abcdef" } },
    });
    vi.mocked(fetchGithubPullRequestFiles).mockResolvedValue({
      ok: true,
      files: [{ filename: "src/App.tsx" }],
    });

    const wip = buildPlatformScmWipFixture({ preset: "merge_ready" });
    const result = await validatePlatformScmPrDiffGate({
      wip,
      scm: wip.platformScmExecutionV1!,
      repoUrl: "https://github.com/owner/repo",
      githubAccessToken: "token",
      requireDiffValidation: true,
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("validated");
    expect(result.matchedFileCount).toBe(1);
  });
});
