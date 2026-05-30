import { describe, expect, it } from "vitest";
import { applyCursorBridgeResultToWipExecution } from "@/lib/prototype/prototypeExecutionCursorBridgeActions";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import {
  buildPlatformScmPullRequestBody,
  buildPlatformScmPullRequestTitle,
} from "@/lib/prototype/platformScmGitHub";
import {
  buildWipPlatformScmPushRequestPatch,
  platformScmStatusLabel,
} from "@/lib/prototype/platformScmExecution";
import { buildScmOfficialCommitRequestResult } from "@/lib/prototype/prototypeExecutionCodeAgentWipActions";
import { buildPlatformScmOrchestrationResult } from "@/lib/prototype/prototypeExecutionPlatformScmActions";
import { validatePlatformScmPushReadiness } from "@/lib/prototype/platformScmReadiness";
import { evaluatePlatformScmQualityGateMergePolicy } from "@/lib/prototype/platformScmDiffGateValidator";
import { buildPlatformScmWipFixture } from "../fixtures/platformScmWipFixture";

const plan = buildImplementationTaskPlan({
  projectId: "p1",
  projectArtifacts: [],
  featureDraftTitles: ["upload"],
  envOk: true,
  designOk: true,
});
const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);

describe("platformScmPushPrMergeFlow", () => {
  it("cursor completion seeds platformScmExecutionV1 pending", () => {
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      selectedTaskId: workItems[0]!.taskId,
      provider: "cursor",
    });
    const updated = applyCursorBridgeResultToWipExecution({
      wip,
      bridgeResult: {
        ok: true,
        provider: "cursor",
        status: "completed",
        selectedTaskId: workItems[0]!.taskId,
        targetRepository: "owner/repo",
        branchName: "wip/cursor/dev-1",
        commitSha: "abc123def4567890",
        changedFiles: ["src/App.tsx"],
      },
      commitTitle: "feat: screen",
      nowIso: "2026-05-30T00:00:00.000Z",
    });
    expect(updated.platformScmExecutionV1?.pushStatus).toBe("pending");
    expect(platformScmStatusLabel(updated.platformScmExecutionV1)).toBe("Push/PR 대기");
  });

  it("SCM request transitions to push_requested and records timeline", () => {
    const wip = buildPlatformScmWipFixture({ preset: "developer_approved" });
    const result = buildScmOfficialCommitRequestResult({
      requirementsStateJson: {},
      wip,
      nowIso: "2026-05-30T00:00:00.000Z",
    });
    expect(result.kind).toBe("pending");
    if (result.kind !== "pending") return;
    expect(result.orchestrationPatch.codeAgentWipExecutionV1.platformScmExecutionV1?.pushStatus).toBe(
      "push_requested",
    );
    expect(
      result.orchestrationPatch.promptTimeline?.some((entry) => entry.action === "platform_scm_push_requested"),
    ).toBe(true);
  });

  it("push readiness blocks before developer approval", () => {
    const wip = buildPlatformScmWipFixture({ preset: "push_ready" });
    const readiness = validatePlatformScmPushReadiness({
      wip: { ...wip, status: "developer_reviewing" },
      setup: { githubAccessToken: "token", gitRepoName: "owner/repo", baseBranch: "main" },
    });
    expect(readiness.ok).toBe(false);
  });

  it("orchestration result records push/pr timeline and merge_pending", () => {
    const wip = buildPlatformScmWipFixture({ preset: "developer_approved" });
    const scm = buildWipPlatformScmPushRequestPatch({ wip }).platformScmExecutionV1!;
    const result = buildPlatformScmOrchestrationResult({
      requirementsStateJson: {},
      wip: { ...wip, platformScmExecutionV1: scm },
      executorResult: {
        ok: true,
        status: "completed",
        message: "done",
        prNumber: 12,
        prUrl: "https://github.com/owner/repo/pull/12",
        platformScmExecutionV1: {
          ...scm,
          pushStatus: "pr_completed",
          prNumber: 12,
          prUrl: "https://github.com/owner/repo/pull/12",
          mergeStatus: "merge_pending",
        },
      },
      nowIso: "2026-05-30T00:00:00.000Z",
    });
    const actions = result.orchestrationPatch?.promptTimeline?.map((entry) => entry.action) ?? [];
    expect(actions).toContain("platform_scm_push_started");
    expect(actions).toContain("platform_scm_push_completed");
    expect(actions).toContain("platform_scm_pr_requested");
    expect(actions).toContain("platform_scm_pr_created");
    expect(result.orchestrationPatch?.codeAgentWipExecutionV1.platformScmExecutionV1?.mergeStatus).toBe(
      "merge_pending",
    );
  });

  it("merge policy blocks when reviewer gate failed", () => {
    const policy = evaluatePlatformScmQualityGateMergePolicy({
      qualityGateResults: [
        {
          version: "implementation_quality_gate_result_v1",
          role: "reviewer",
          status: "failed",
          createdAt: "2026-05-30T00:00:00.000Z",
          updatedAt: "2026-05-30T00:00:00.000Z",
          source: "mock_local_gate",
          summary: "failed",
          checks: [],
          failedTaskIds: [],
        },
      ],
    });
    expect(policy.ok).toBe(false);
  });

  it("PR metadata includes changed files and project context", () => {
    const title = buildPlatformScmPullRequestTitle({
      selectedTaskId: "DEV-1",
      taskTitle: "입력 화면 구현",
    });
    expect(title).toBe("[DEV-1] 입력 화면 구현");
    const body = buildPlatformScmPullRequestBody({
      projectId: "p1",
      selectedTaskId: "DEV-1",
      branchName: "wip/cursor/dev-1",
      commitSha: "abc123def4567890",
      targetRepository: "owner/repo",
      changedFiles: ["src/App.tsx"],
      diffSummary: ["added App"],
      testResults: ["vitest passed"],
    });
    expect(body).toContain("projectId=p1");
    expect(body).toContain("src/App.tsx");
    expect(body).toContain("vitest passed");
  });

  /**
   * Manual GitHub E2E checklist (operational verification):
   * 1. Cursor 실행 완료 후 실제 commitSha 생성
   * 2. 내부 worktree HEAD === commitSha
   * 3. SCM 반영 요청 → POST /api/prototype/platform-scm/execute
   * 4. GitHub 원격에 작업 branch 생성
   * 5. PR 생성 및 head/base 정확성
   * 6. 검수/보안 gate 미통과 시 merge 차단
   * 7. token 원문이 log/DB/timeline에 남지 않음
   */
  describe("github e2e checklist (automated preconditions)", () => {
    it("1-2: real commitSha and wip branch are present after cursor completion", () => {
      const wip = buildPlatformScmWipFixture({ preset: "push_ready" });
      expect(wip.commits[0]?.sha).toMatch(/^abc123/);
      expect(wip.branchName).toMatch(/^wip\//);
      expect(wip.platformScmExecutionV1?.sourceCommitSha).not.toMatch(/^wip-stub/);
    });

    it("3: SCM request routes to push_requested state", () => {
      const wip = buildPlatformScmWipFixture({ preset: "developer_approved" });
      const result = buildScmOfficialCommitRequestResult({
        requirementsStateJson: {},
        wip,
        nowIso: "2026-05-30T00:00:00.000Z",
      });
      expect(result.kind).toBe("pending");
    });

    it("6-7: merge blocked before quality gate; PR body excludes raw tokens", () => {
      const policy = evaluatePlatformScmQualityGateMergePolicy({
        qualityGateResults: [
          {
            version: "implementation_quality_gate_result_v1",
            role: "security",
            status: "failed",
            createdAt: "2026-05-30T00:00:00.000Z",
            updatedAt: "2026-05-30T00:00:00.000Z",
            source: "mock_local_gate",
            summary: "failed",
            checks: [],
            failedTaskIds: [],
          },
        ],
      });
      expect(policy.ok).toBe(false);
      const body = buildPlatformScmPullRequestBody({
        projectId: "p1",
        selectedTaskId: "DEV-1",
        branchName: "wip/cursor/dev-1",
        commitSha: "abc123def4567890",
        targetRepository: "owner/repo",
        changedFiles: ["src/App.tsx"],
      });
      expect(body).not.toMatch(/gh[pousr]_/);
      expect(body).not.toMatch(/github_pat_/);
    });
  });
});
