import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildTaskCursorGithubBranchCandidates } from "@/lib/prototype/taskCursorGithubBranchCandidates";
import { verifyTaskCursorGithubResult } from "@/lib/prototype/taskCursorGithubVerify";
import { buildInitialTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import { resolveGithubVerifyStuckEscalation } from "@/lib/prototype/taskCursorGithubVerifyTimeoutPolicy";
import { mapManualGithubVerifyApiStatus } from "@/lib/prototype/taskCursorGithubVerifyCandidateFlow";
import { patchTaskCursorExecution, TASK_CURSOR_FAILURE_MESSAGES, type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

describe("P3-M38 repair GitHub verify sync", () => {
  describe("buildTaskCursorGithubBranchCandidates", () => {
    it("includes sample-data and legacy mock aliases", () => {
      const candidates = buildTaskCursorGithubBranchCandidates({
        codeTaskId: "CODE-DEV-SAMPLE-DATA-001-001",
      });
      expect(candidates.some((b) => b.includes("code-dev-sample-data-001-001"))).toBe(true);
      expect(candidates.some((b) => b.includes("code-dev-mock-001-001"))).toBe(true);
    });

    it("prefers run.workBranch and dedupes", () => {
      const primary = "wip/cursor/code-dev-mock-001-001";
      const candidates = buildTaskCursorGithubBranchCandidates({
        codeTaskId: "CODE-DEV-SAMPLE-DATA-001-001",
        runWorkBranch: primary,
        executionWorkBranch: primary,
      });
      expect(candidates[0]).toBe(primary);
      expect(new Set(candidates).size).toBe(candidates.length);
    });
  });

  describe("verifyTaskCursorGithubResult branch repair", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url.includes("code-dev-sample-data-001-001")) {
            return new Response(JSON.stringify({ object: { sha: "abc123def4567890" } }), {
              status: 200,
            });
          }
          if (url.includes("/git/ref/heads/")) {
            return new Response("not found", { status: 404 });
          }
          if (url.includes("/commits/")) {
            return new Response(
              JSON.stringify({
                sha: "abc123def4567890",
                commit: { message: "wip(cursor): [CODE-DEV-SAMPLE-DATA-001-001]" },
                files: [{ filename: "src/App.tsx" }],
              }),
              { status: 200 },
            );
          }
          return new Response("not found", { status: 404 });
        }),
      );
    });

    it("verifies via sample-data branch when execution still points at mock branch", async () => {
      const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
        gitRepoUrl: "https://github.com/owner/repo",
        gitRepoName: "owner/repo",
        baseBranch: "main",
      })!;
      const execution = {
        ...buildInitialTaskCursorExecution({
          projectId: "p1",
          taskId: "DEV-MOCK-001",
          workItemIds: ["wi-1"],
          targetRepository: "owner/repo",
          baseBranch: "main",
          workBranch: "wip/cursor/code-dev-mock-001-001",
        }),
        status: "cursor_completed" as const,
        pushed: true,
      };
      const result = await verifyTaskCursorGithubResult({
        execution,
        targetRepository,
        githubToken: "gh-token",
        allowedPathGlobs: ["src/**"],
        codeTaskId: "CODE-DEV-SAMPLE-DATA-001-001",
      });
      expect(result.ok).toBe(true);
      expect(result.resolvedBranch).toContain("sample-data");
      expect(result.verifiedCommitSha).toBe("abc123def4567890");
    });

    it("returns github_branch_missing when no candidate branch exists", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("not found", { status: 404 })),
      );
      const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
        gitRepoUrl: "https://github.com/owner/repo",
        gitRepoName: "owner/repo",
        baseBranch: "main",
      })!;
      const execution = {
        ...buildInitialTaskCursorExecution({
          projectId: "p1",
          taskId: "DEV-MOCK-001",
          workItemIds: ["wi-1"],
          targetRepository: "owner/repo",
          baseBranch: "main",
          workBranch: "wip/cursor/code-dev-mock-001-001",
        }),
        status: "github_verifying" as const,
      };
      const result = await verifyTaskCursorGithubResult({
        execution,
        targetRepository,
        githubToken: "gh-token",
        allowedPathGlobs: ["src/**"],
        codeTaskId: "CODE-DEV-SAMPLE-DATA-001-001",
      });
      expect(result.ok).toBe(false);
      expect(result.allBranchesMissing).toBe(true);
      expect(result.uiReason).toBe("github_branch_missing");
    });
  });

  describe("timeout policy", () => {
    it("escalates github_verifying after 10 minutes", () => {
      const createdAt = new Date(Date.now() - 11 * 60 * 1000).toISOString();
      const execution: TaskCursorExecutionV1 = {
        ...buildInitialTaskCursorExecution({
          projectId: "p1",
          taskId: "t1",
          workItemIds: [],
          targetRepository: "o/r",
          baseBranch: "main",
          nowIso: createdAt,
        }),
        status: "github_verifying",
        createdAt,
        updatedAt: new Date().toISOString(),
      };
      const escalation = resolveGithubVerifyStuckEscalation({
        execution,
        verifyDetailReason: "branch_not_found",
        nowMs: Date.now(),
      });
      expect(escalation).toBe("github_branch_missing");
    });
  });

  describe("manual verify API status mapping", () => {
    it("maps state sync failure", () => {
      const execution = patchTaskCursorExecution(
        buildInitialTaskCursorExecution({
          projectId: "p1",
          taskId: "t1",
          workItemIds: [],
          targetRepository: "o/r",
          baseBranch: "main",
        }),
        {
          status: "github_verify_failed",
          failureReason: "github_verify_state_sync_failed",
          errorMessage: TASK_CURSOR_FAILURE_MESSAGES.github_verify_state_sync_failed,
        },
      );
      expect(
        mapManualGithubVerifyApiStatus({
          verify: { ok: true, verifiedCommitSha: "abc" },
          execution,
          stateSyncFailed: true,
        }),
      ).toBe("github_verify_state_sync_failed");
    });
  });
});
