import { describe, expect, it, vi, beforeEach } from "vitest";
import { verifyTaskCursorGithubResult } from "@/lib/prototype/taskCursorGithubVerify";
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
