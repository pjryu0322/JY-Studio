import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  evaluateTaskCursorGithubVerifyReadiness,
  isTransientTaskCursorGithubVerifyMiss,
  verifyTaskCursorGithubResult,
} from "@/lib/prototype/taskCursorGithubVerify";
import { buildInitialTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";

describe("verifyTaskCursorGithubResult", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/git/ref/heads/main")) {
          return new Response(JSON.stringify({ object: { sha: "base0000000001" } }), { status: 200 });
        }
        if (url.includes("/compare/")) {
          return new Response(
            JSON.stringify({
              ahead_by: 1,
              status: "ahead",
              files: [{ filename: "src/App.tsx" }],
              commits: [{ sha: "abc123def4567890" }],
            }),
            { status: 200 },
          );
        }
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

  it("verifies branch head when HEAD commit message lacks task id but branch is ahead of base", async () => {
    const headSha = "headbad0000000001";
    const goodSha = "goodcommit000001";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/git/ref/heads/main")) {
          return new Response(JSON.stringify({ object: { sha: "base0000000001" } }), { status: 200 });
        }
        if (url.includes("/compare/")) {
          return new Response(
            JSON.stringify({
              ahead_by: 1,
              status: "ahead",
              files: [{ filename: "src/App.tsx" }],
              commits: [{ sha: goodSha }],
            }),
            { status: 200 },
          );
        }
        if (url.includes("code-dev-sample-data-001-001")) {
          return new Response(JSON.stringify({ object: { sha: "abc123def4567890" } }), {
            status: 200,
          });
        }
        if (url.includes("/git/ref/heads/")) {
          return new Response(JSON.stringify({ object: { sha: headSha } }), { status: 200 });
        }
        if (url.includes("/commits?")) {
          return new Response(
            JSON.stringify([{ sha: headSha }, { sha: goodSha }]),
            { status: 200 },
          );
        }
        if (url.includes(`/commits/${headSha}`)) {
          return new Response(
            JSON.stringify({
              sha: headSha,
              commit: { message: "chore: merge fixup" },
              files: [{ filename: "src/App.tsx" }],
            }),
            { status: 200 },
          );
        }
        if (url.includes(`/commits/${goodSha}`)) {
          return new Response(
            JSON.stringify({
              sha: goodSha,
              commit: { message: "wip(cursor): [DEV-MOCK-001]" },
              files: [{ filename: "src/App.tsx" }],
            }),
            { status: 200 },
          );
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
        taskId: "DEV-MOCK-001",
        workItemIds: ["wi-1"],
        targetRepository: "owner/repo",
        baseBranch: "main",
        workBranch: "wip/cursor/run-without-task-slug",
      }),
      status: "cursor_completed" as const,
      pushed: true,
    };
    const result = await verifyTaskCursorGithubResult({
      execution,
      targetRepository,
      githubToken: "gh-token",
      allowedPathGlobs: ["src/**"],
    });
    expect(result.ok).toBe(true);
    expect(result.verifiedCommitSha).toBe(headSha);
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

describe("isTransientTaskCursorGithubVerifyMiss", () => {
  it("treats missing branch/commit as transient", () => {
    expect(
      isTransientTaskCursorGithubVerifyMiss({ ok: false, detailReason: "branch_not_found" }),
    ).toBe(true);
    expect(
      isTransientTaskCursorGithubVerifyMiss({ ok: false, reason: "commit_not_created" }),
    ).toBe(true);
    expect(
      isTransientTaskCursorGithubVerifyMiss({ ok: false, reason: "github_verify_failed" }),
    ).toBe(false);
    expect(
      isTransientTaskCursorGithubVerifyMiss({ ok: false, detailReason: "changed_files_empty" }),
    ).toBe(true);
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
