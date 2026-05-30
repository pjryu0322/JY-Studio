import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import {
  evaluatePlatformScmQualityGateMergePolicy,
  validatePlatformScmPrDiffGate,
} from "@/lib/prototype/platformScmDiffGateValidator";
import { IMPLEMENTATION_QUALITY_GATE_RESULT_VERSION } from "@/lib/prototype/implementationQualityGate";

vi.mock("@/lib/service/githubEnvTestMergeService", () => ({
  fetchEnvTestPullDetail: vi.fn(),
  fetchEnvTestPullFiles: vi.fn(),
}));

import { fetchEnvTestPullDetail, fetchEnvTestPullFiles } from "@/lib/service/githubEnvTestMergeService";

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

describe("platformScmDiffGateValidator", () => {
  beforeEach(() => {
    vi.mocked(fetchEnvTestPullDetail).mockReset();
    vi.mocked(fetchEnvTestPullFiles).mockReset();
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
    vi.mocked(fetchEnvTestPullDetail).mockResolvedValue({
      ok: true,
      pr: { head: { sha: "abc1234567890abcdef" } },
    });
    vi.mocked(fetchEnvTestPullFiles).mockResolvedValue({
      ok: true,
      files: [{ filename: "src/App.tsx" }],
    });

    const wip = realCursorWip();
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
