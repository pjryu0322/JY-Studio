import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildCanonicalGithubVerifyBranchOrder,
  fetchGithubBranchByExactName,
  isFatalGithubBranchLookupHttpStatus,
} from "@/lib/prototype/githubBranchLookup";
import { encodeGithubRefBranchPath } from "@/lib/prototype/githubIntegrationBranchService";
import {
  formatGithubVerifyCheckingToast,
  resolveGithubVerifyToastTaskLabel,
} from "@/lib/prototype/taskCursorGithubVerifyDisplay";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { verifyTaskCursorGithubResult } from "@/lib/prototype/taskCursorGithubVerify";
import { buildInitialTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";

const SAMPLE_BRANCH = "wip/data/sample-data";
const BASE_BRANCH = "wip/foundation/app-shell";
const BASE_SHA = "base0000000000000000000000000000000001";
const HEAD_SHA = "head1111111111111111111111111111111111";

function sampleDataRefPath(): string {
  return encodeGithubRefBranchPath(SAMPLE_BRANCH);
}

describe("P3-M64 verify canonical sample data branch", () => {
  it("buildCanonicalGithubVerifyBranchOrder prefers run and branch plan work branches", () => {
    const order = buildCanonicalGithubVerifyBranchOrder({
      runWorkBranch: SAMPLE_BRANCH,
      branchPlanWorkBranch: SAMPLE_BRANCH,
      executionWorkBranch: BASE_BRANCH,
      candidateBranches: [SAMPLE_BRANCH, "wip/cursor/code-dev-mock-001-001"],
    });
    expect(order[0]).toBe(SAMPLE_BRANCH);
  });

  it("encodeGithubRefBranchPath keeps slash segments for nested branch names", () => {
    expect(sampleDataRefPath()).toBe("wip/data/sample-data");
  });

  it("resolveGithubVerifyToastTaskLabel replaces DEV-MOCK with canonical process task id", () => {
    const { label, clearedStaleMock } = resolveGithubVerifyToastTaskLabel({
      executionTaskId: "DEV-MOCK-001",
      codeTaskId: CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
      codeTaskPlan: {
        version: 1,
        tasks: [
          {
            codeTaskId: CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
            parentTaskId: "DEV-MOCK-001",
            title: "샘플 데이터 생성",
            description: "",
            changeType: "data",
            targetHints: [],
            acceptanceCriteria: [],
            verificationHints: [],
            forbiddenPaths: [],
            branchPlan: {
              branchGroup: "data",
              workBranch: SAMPLE_BRANCH,
              baseBranch: BASE_BRANCH,
              executionMode: "sequential",
            },
          },
        ],
      },
    });
    expect(label).toBe("DEV-SAMPLE-DATA-001");
    expect(clearedStaleMock).toBe(true);
    expect(formatGithubVerifyCheckingToast(label)).not.toContain("DEV-MOCK-001");
  });

  it("isFatalGithubBranchLookupHttpStatus flags auth errors", () => {
    expect(isFatalGithubBranchLookupHttpStatus(401)).toBe(true);
    expect(isFatalGithubBranchLookupHttpStatus(404)).toBe(false);
  });

  describe("fetchGithubBranchByExactName retry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("succeeds on second attempt after initial 404", async () => {
      let calls = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          calls += 1;
          if (url.includes(`/git/ref/heads/${sampleDataRefPath()}`) && calls < 2) {
            return new Response("missing", { status: 404 });
          }
          if (url.includes(`/git/ref/heads/${sampleDataRefPath()}`) || url.includes("/branches/wip%2Fdata%2Fsample-data")) {
            return new Response(JSON.stringify({ object: { sha: HEAD_SHA } }), { status: 200 });
          }
          return new Response("missing", { status: 404 });
        }),
      );

      const pending = fetchGithubBranchByExactName({
        gitRepoUrl: "https://github.com/owner/repo",
        branchName: SAMPLE_BRANCH,
        token: "token",
      });
      await vi.advanceTimersByTimeAsync(4000);
      const result = await pending;
      expect(result.status).toBe("found");
      if (result.status === "found") {
        expect(result.headSha).toBe(HEAD_SHA);
        expect(result.lookupAttempts).toBeGreaterThan(1);
      }
    });
  });

  describe("verifyTaskCursorGithubResult sample-data branch", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url.includes("/git/ref/heads/main") || url.includes(`/git/ref/heads/${encodeGithubRefBranchPath(BASE_BRANCH)}`)) {
            return new Response(JSON.stringify({ object: { sha: BASE_SHA } }), { status: 200 });
          }
          if (
            url.includes(`/git/ref/heads/${sampleDataRefPath()}`) ||
            url.includes("/branches/wip%2Fdata%2Fsample-data")
          ) {
            return new Response(JSON.stringify({ object: { sha: HEAD_SHA } }), { status: 200 });
          }
          if (url.includes("/compare/")) {
            return new Response(
              JSON.stringify({
                ahead_by: 4,
                status: "ahead",
                files: [{ filename: "src/data/sample/x.ts" }],
                commits: [{ sha: HEAD_SHA }],
              }),
              { status: 200 },
            );
          }
          return new Response("not found", { status: 404 });
        }),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("finds wip/data/sample-data and verifies without github_branch_missing", async () => {
      const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
        gitRepoUrl: "https://github.com/owner/repo",
        gitRepoName: "owner/repo",
        gitRepoProvider: "github",
        baseBranch: "main",
      })!;
      const execution = buildInitialTaskCursorExecution({
        projectId: "p1",
        taskId: "DEV-SAMPLE-DATA-001",
        workItemIds: ["w1"],
        targetRepository: targetRepository.repoFullName,
        baseBranch: BASE_BRANCH,
        workBranch: SAMPLE_BRANCH,
      });
      const result = await verifyTaskCursorGithubResult({
        execution,
        targetRepository,
        githubToken: "token",
        allowedPathGlobs: ["**/*"],
        codeTaskId: CANONICAL_SAMPLE_DATA_CODE_TASK_ID,
        branchPlanWorkBranch: SAMPLE_BRANCH,
        runWorkBranch: SAMPLE_BRANCH,
      });
      expect(result.ok).toBe(true);
      expect(result.allBranchesMissing).not.toBe(true);
      expect(result.resolvedBranch).toBe(SAMPLE_BRANCH);
    });
  });
});

export function isNonQueuedRuntimeDispatchError(message: string): boolean {
  return /Only queued runs can be dispatched/i.test(String(message ?? ""));
}

describe("P3-M64 fallback duplicate dispatch guard", () => {
  it("detects non-queued runtime dispatch error message", () => {
    expect(isNonQueuedRuntimeDispatchError("Only queued runs can be dispatched (current=cursor_running)")).toBe(
      true,
    );
  });
});
