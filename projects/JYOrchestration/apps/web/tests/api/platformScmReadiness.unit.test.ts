import { describe, expect, it } from "vitest";
import {
  isPlatformScmPushPrCompleted,
  shouldAttemptAutoPlatformScmMerge,
  validateFinalScmIntegratedStageReadiness,
  validatePlatformScmMergeReadiness,
  validatePlatformScmMergeStepReadiness,
  validatePlatformScmPushReadiness,
} from "@/lib/prototype/platformScmReadiness";
import {
  buildPlatformScmWipFixture,
  platformScmWipFixtureWorkItems,
} from "../fixtures/platformScmWipFixture";

describe("platformScmReadiness", () => {
  it("validatePlatformScmPushReadiness blocks without github token", () => {
    const result = validatePlatformScmPushReadiness({
      wip: buildPlatformScmWipFixture({ preset: "push_ready" }),
      setup: { gitRepoName: "owner/repo", baseBranch: "main" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("GitHub Access Token");
  });

  it("validatePlatformScmMergeStepReadiness returns noOp when already merged", () => {
    const wip = buildPlatformScmWipFixture({
      preset: "merge_ready",
      overrides: {
        platformScmExecutionV1: {
          ...buildPlatformScmWipFixture({ preset: "merge_ready" }).platformScmExecutionV1!,
          mergeStatus: "merge_completed",
        },
      },
    });
    const result = validatePlatformScmMergeStepReadiness(wip);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.noOp).toBe(true);
  });

  it("validatePlatformScmMergeReadiness composes step checks and setup requirements", () => {
    const result = validatePlatformScmMergeReadiness({
      wip: { ...buildPlatformScmWipFixture({ preset: "merge_ready" }), platformScmExecutionV1: undefined },
      setup: { githubAccessToken: "token", gitRepoName: "owner/repo", baseBranch: "main" },
    });
    expect(result.ok).toBe(false);
  });

  it("validateFinalScmIntegratedStageReadiness requires developer approval before execution", () => {
    const result = validateFinalScmIntegratedStageReadiness(
      buildPlatformScmWipFixture({
        preset: "developer_approved",
        overrides: { status: "developer_reviewing" },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("구현 결과 승인");
  });

  it("isPlatformScmPushPrCompleted detects pr_completed", () => {
    const wip = buildPlatformScmWipFixture({
      preset: "developer_approved",
      overrides: {
        platformScmExecutionV1: {
          version: "platform_scm_execution_v1",
          projectId: "p1",
          selectedTaskId: platformScmWipFixtureWorkItems[0]!.taskId,
          sourceCommitSha: "abc1234567890abcdef",
          sourceBranchName: "wip/cursor/dev-1",
          targetRepository: "owner/repo",
          pushStatus: "pr_completed",
          prNumber: 7,
          createdAt: "2026-05-30T00:00:00.000Z",
          updatedAt: "2026-05-30T01:00:00.000Z",
        },
      },
    });
    expect(isPlatformScmPushPrCompleted(wip)).toBe(true);
  });

  it("shouldAttemptAutoPlatformScmMerge is true when pr_completed and merge pending", () => {
    expect(shouldAttemptAutoPlatformScmMerge(buildPlatformScmWipFixture({ preset: "merge_ready" }))).toBe(true);
  });
});
