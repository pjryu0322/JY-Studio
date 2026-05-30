import { describe, expect, it } from "vitest";
import {
  formatGitRepoAutoWorkspaceRoot,
  resolveDefaultGitWorkspaceCloneRoot,
  resolveSourceGenerationWorkspaceRoot,
} from "@/lib/prototype/gitRepoAutoWorkspace";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";

const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
  gitRepoName: "pjryu0322/aiproject",
  gitRepoUrl: "https://github.com/pjryu0322/aiproject",
  baseBranch: "main",
})!;

describe("gitRepoAutoWorkspace", () => {
  it("derives workspace from git repo when workspacePath is absent", () => {
    const resolved = resolveSourceGenerationWorkspaceRoot({
      workspacePath: "",
      targetRepository,
    });
    expect(resolved?.source).toBe("git_repo_auto");
    expect(resolved?.workspaceRoot).toBe(
      formatGitRepoAutoWorkspaceRoot(
        resolveDefaultGitWorkspaceCloneRoot(),
        targetRepository,
      ),
    );
  });

  it("prefers explicit executionSetup workspacePath", () => {
    const resolved = resolveSourceGenerationWorkspaceRoot({
      workspacePath: "C:/workspace/aiproject",
      targetRepository,
    });
    expect(resolved?.source).toBe("execution_setup");
    expect(resolved?.workspaceRoot).toBe("C:/workspace/aiproject");
  });

  it("uses env clone root when provided without git repo auto path override", () => {
    const resolved = resolveSourceGenerationWorkspaceRoot({
      workspacePath: "",
      env: { GIT_APPLY_WORKDIR: "/env/root" },
    });
    expect(resolved?.source).toBe("env_fallback");
    expect(resolved?.workspaceRoot).toBe("/env/root");
  });
});
