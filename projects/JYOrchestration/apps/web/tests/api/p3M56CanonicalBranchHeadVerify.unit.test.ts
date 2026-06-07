import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildTaskCursorGithubBranchCandidates,
  resolveBranchSourceForCandidate,
} from "@/lib/prototype/taskCursorGithubBranchCandidates";
import { branchHeadDiffIndicatesNewCommit } from "@/lib/prototype/githubBranchHead";
import {
  buildGithubOutcomeFromVerifyResult,
  mapVerifyResultToGithubOutcomeFailureReason,
} from "@/lib/prototype/codeTaskGithubOutcome";
import { verifyTaskCursorGithubResult, isTransientTaskCursorGithubVerifyMiss } from "@/lib/prototype/taskCursorGithubVerify";
import { buildInitialTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";

const BASE_SHA = "base0000000000000000000000000000000001";
const HEAD_SHA = "head1111111111111111111111111111111111";

function stubGithubFetchForHeadAdvance(input?: { readonly emptyCompareFiles?: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/git/ref/heads/main")) {
        return new Response(JSON.stringify({ object: { sha: BASE_SHA } }), { status: 200 });
      }
      if (url.includes("/git/ref/heads/wip%2Ffoundation%2Fapp-shell")) {
        return new Response(JSON.stringify({ object: { sha: HEAD_SHA } }), { status: 200 });
      }
      if (url.includes("/compare/main...wip%2Ffoundation%2Fapp-shell")) {
        return new Response(
          JSON.stringify({
            ahead_by: 1,
            status: "ahead",
            files: input?.emptyCompareFiles ? [] : [{ filename: "app/index.html" }],
            commits: [{ sha: HEAD_SHA }],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/git/ref/heads/")) {
        return new Response(JSON.stringify({ object: { sha: HEAD_SHA } }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }),
  );
}

describe("P3-M56 canonical branch head verify", () => {
  describe("buildTaskCursorGithubBranchCandidates", () => {
    it("prefers branchPlan.workBranch over run.workBranch", () => {
      const candidates = buildTaskCursorGithubBranchCandidates({
        codeTaskId: "CODE-DEV-FRAME-001-001",
        branchPlanWorkBranch: "wip/foundation/app-shell",
        runWorkBranch: "wip/cursor/code-dev-frame-001-001",
      });
      expect(candidates[0]).toBe("wip/foundation/app-shell");
      expect(candidates).toContain("wip/cursor/code-dev-frame-001-001");
    });

    it("resolves branch source", () => {
      expect(
        resolveBranchSourceForCandidate({
          branch: "wip/foundation/app-shell",
          branchPlanWorkBranch: "wip/foundation/app-shell",
          runWorkBranch: "wip/cursor/x",
        }),
      ).toBe("branch_plan");
    });
  });

  describe("branchHeadDiffIndicatesNewCommit", () => {
    it("treats head !== base as new commit", () => {
      expect(
        branchHeadDiffIndicatesNewCommit({
          headSha: HEAD_SHA,
          baseHeadSha: BASE_SHA,
          compare: null,
        }),
      ).toBe(true);
    });

    it("uses ahead_by when head equals base but compare says ahead", () => {
      expect(
        branchHeadDiffIndicatesNewCommit({
          headSha: BASE_SHA,
          baseHeadSha: BASE_SHA,
          compare: { aheadBy: 1, status: "ahead", changedFiles: [], tipCommitSha: HEAD_SHA },
        }),
      ).toBe(true);
    });
  });

  describe("verifyTaskCursorGithubResult head advance", () => {
    beforeEach(() => {
      stubGithubFetchForHeadAdvance();
    });

    it("verifies foundation branch when compare files empty but head ahead of base", async () => {
      stubGithubFetchForHeadAdvance({ emptyCompareFiles: true });
      const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
        gitRepoUrl: "https://github.com/owner/repo",
        gitRepoName: "owner/repo",
        baseBranch: "main",
      })!;
      const execution = {
        ...buildInitialTaskCursorExecution({
          projectId: "p1",
          taskId: "FRAME-001",
          workItemIds: ["wi-1"],
          targetRepository: "owner/repo",
          baseBranch: "main",
          workBranch: "wip/foundation/app-shell",
        }),
        status: "cursor_completed" as const,
      };
      const result = await verifyTaskCursorGithubResult({
        execution,
        targetRepository,
        githubToken: "gh-token",
        allowedPathGlobs: ["app/**"],
        codeTaskId: "CODE-DEV-FRAME-001-001",
        branchPlanWorkBranch: "wip/foundation/app-shell",
        branchCandidates: ["wip/foundation/app-shell", "wip/cursor/code-dev-frame-001-001"],
      });
      expect(result.ok).toBe(true);
      expect(result.resolvedBranch).toBe("wip/foundation/app-shell");
      expect(result.verifyQuality).toBe("verified_with_empty_file_diff");
      expect(result.verifiedCommitSha).toBe(HEAD_SHA);
      expect(result.headSha).toBe(HEAD_SHA);
      expect(result.baseHeadSha).toBe(BASE_SHA);
    });

    it("maps no_new_commit to github_no_new_commit outcome (non-transient)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url.includes("/git/ref/heads/")) {
            return new Response(JSON.stringify({ object: { sha: BASE_SHA } }), { status: 200 });
          }
          return new Response("not found", { status: 404 });
        }),
      );
      const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
        gitRepoUrl: "https://github.com/owner/repo",
        gitRepoName: "owner/repo",
        baseBranch: "main",
      })!;
      const execution = {
        ...buildInitialTaskCursorExecution({
          projectId: "p1",
          taskId: "FRAME-001",
          workItemIds: ["wi-1"],
          targetRepository: "owner/repo",
          baseBranch: "main",
          workBranch: "wip/foundation/app-shell",
        }),
        status: "cursor_completed" as const,
      };
      const result = await verifyTaskCursorGithubResult({
        execution,
        targetRepository,
        githubToken: "gh-token",
        allowedPathGlobs: ["app/**"],
        branchCandidates: ["wip/foundation/app-shell"],
      });
      expect(result.ok).toBe(false);
      expect(result.detailReason).toBe("no_new_commit");
      expect(
        isTransientTaskCursorGithubVerifyMiss({ ok: false, detailReason: "no_new_commit" }),
      ).toBe(false);
      const outcome = buildGithubOutcomeFromVerifyResult({
        verify: result,
        nowIso: new Date().toISOString(),
        resolvedWorkBranch: "wip/foundation/app-shell",
      });
      expect(outcome.status).toBe("failed");
      if (outcome.status === "failed") {
        expect(outcome.reason).toBe("github_no_new_commit");
        expect(outcome.retryable).toBe(false);
      }
    });
  });

  describe("outcome reason mapping", () => {
    it("maps base_head_missing", () => {
      expect(
        mapVerifyResultToGithubOutcomeFailureReason({
          ok: false,
          detailReason: "base_head_missing",
        }),
      ).toBe("github_base_head_missing");
    });
  });
});
