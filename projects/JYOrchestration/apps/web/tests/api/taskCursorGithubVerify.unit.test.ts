import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  evaluateTaskCursorGithubVerifyReadiness,
  verifyTaskCursorGithubResult,
} from "@/lib/prototype/taskCursorGithubVerify";
import { buildInitialTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";

describe("verifyTaskCursorGithubResult", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/git/ref/heads/")) {
          return new Response(JSON.stringify({ object: { sha: "abc123def4567890" } }), { status: 200 });
        }
        if (url.includes("/commits/")) {
          return new Response(
            JSON.stringify({
              sha: "abc123def4567890",
              commit: { message: "wip(cursor): [DEV-MOCK-001]" },
              files: [{ filename: "src/App.tsx" }],
            }),
            { status: 200 },
          );
        }
        return new Response("not found", { status: 404 });
      }),
    );
  });

  it("verifies branch, commit, taskId in message, and changed files", async () => {
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
      }),
      status: "cursor_completed" as const,
      commitSha: "abc123def4567890",
      changedFiles: ["src/App.tsx"],
      pushed: true,
    };
    const result = await verifyTaskCursorGithubResult({
      execution,
      targetRepository,
      githubToken: "gh-token",
      allowedPathGlobs: ["src/**"],
    });
    expect(result.ok).toBe(true);
    expect(result.verifiedChangedFiles).toContain("src/App.tsx");
  });

  it("resolves commitSha from branch head when execution has no commitSha", async () => {
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
      }),
      status: "cursor_completed" as const,
      workBranch: "wip/cursor/dev-mock-001",
      pushed: undefined,
    };
    const result = await verifyTaskCursorGithubResult({
      execution,
      targetRepository,
      githubToken: "gh-token",
      allowedPathGlobs: ["src/**"],
    });
    expect(result.ok).toBe(true);
    expect(result.verifiedCommitSha).toBe("abc123def4567890");
  });

  it("reports missing WIP branch with actionable message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ message: "Not Found" }), { status: 404 })),
    );
    const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
      gitRepoUrl: "https://github.com/owner/repo",
      gitRepoName: "owner/repo",
      baseBranch: "main",
    })!;
    const execution = {
      ...buildInitialTaskCursorExecution({
        projectId: "p1",
        taskId: "DEV-SCREEN-002",
        workItemIds: ["wi-1"],
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/dev-screen-002",
      }),
      status: "cursor_completed" as const,
    };
    const result = await verifyTaskCursorGithubResult({
      execution,
      targetRepository,
      githubToken: "gh-token",
      allowedPathGlobs: ["src/**"],
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("wip/cursor/dev-screen-002");
    expect(result.message).toContain("push");
  });

  it("fails without github token", async () => {
    const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
      gitRepoUrl: "https://github.com/owner/repo",
      gitRepoName: "owner/repo",
    })!;
    const execution = buildInitialTaskCursorExecution({
      projectId: "p1",
      taskId: "DEV-MOCK-001",
      workItemIds: ["wi-1"],
      targetRepository: "owner/repo",
      baseBranch: "main",
    });
    const result = await verifyTaskCursorGithubResult({
      execution,
      targetRepository,
      githubToken: "",
      allowedPathGlobs: ["src/**"],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("github_auth_failed");
  });
});

describe("evaluateTaskCursorGithubVerifyReadiness", () => {
  it("does not require Cursor API key when GitHub repo and token are configured", () => {
    const readiness = evaluateTaskCursorGithubVerifyReadiness({
      setup: {
        gitRepoUrl: "https://github.com/owner/repo",
        gitRepoName: "owner/repo",
        baseBranch: "main",
        githubAccessToken: "gh-token",
        hasGithubAccessToken: true,
        hasCursorToken: false,
      },
    });
    expect(readiness.ok).toBe(true);
    if (readiness.ok) {
      expect(readiness.targetRepository.repoFullName).toBe("owner/repo");
    }
  });

  it("fails when GitHub token is missing", () => {
    const readiness = evaluateTaskCursorGithubVerifyReadiness({
      setup: {
        gitRepoUrl: "https://github.com/owner/repo",
        gitRepoName: "owner/repo",
        hasGithubAccessToken: false,
      },
    });
    expect(readiness.ok).toBe(false);
  });
});
