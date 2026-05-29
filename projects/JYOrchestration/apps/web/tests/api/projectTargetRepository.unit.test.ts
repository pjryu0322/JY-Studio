import { describe, expect, it } from "vitest";
import {
  evaluateCursorBridgeSourceGenerationGate,
  resolveProjectTargetRepository,
  resolveProjectTargetRepositoryFromExecutionSetup,
} from "@/lib/prototype/projectTargetRepository";
import { getCursorBridgeAvailability } from "@/lib/prototype/cursorBridgeRuntime";
import {
  evaluateExecutionSetupSourceGenerationReadiness,
  resolveSourceGenerationWorkspaceRoot,
} from "@/lib/prototype/executionSetupSourceGeneration";

describe("resolveProjectTargetRepositoryFromExecutionSetup", () => {
  it('gitRepoName "pjryu0322/aiproject" → owner/repo 파싱', () => {
    const repo = resolveProjectTargetRepositoryFromExecutionSetup({
      gitRepoName: "pjryu0322/aiproject",
      gitRepoUrl: "https://github.com/pjryu0322/aiproject",
      baseBranch: "main",
    });
    expect(repo).toMatchObject({
      owner: "pjryu0322",
      repo: "aiproject",
      repoFullName: "pjryu0322/aiproject",
      defaultBranch: "main",
      gitRepoUrl: "https://github.com/pjryu0322/aiproject",
    });
  });

  it('gitRepoUrl "https://github.com/pjryu0322/aiproject.git" → owner/repo 파싱', () => {
    const repo = resolveProjectTargetRepositoryFromExecutionSetup({
      gitRepoUrl: "https://github.com/pjryu0322/aiproject.git",
    });
    expect(repo?.owner).toBe("pjryu0322");
    expect(repo?.repo).toBe("aiproject");
  });

  it("baseBranch 없으면 main", () => {
    const repo = resolveProjectTargetRepositoryFromExecutionSetup({
      gitRepoName: "o/r",
      gitRepoUrl: "https://github.com/o/r",
    });
    expect(repo?.defaultBranch).toBe("main");
  });

  it("invalid repo returns null", () => {
    expect(resolveProjectTargetRepositoryFromExecutionSetup({ gitRepoName: "invalid" })).toBeNull();
  });
});

describe("resolveProjectTargetRepository", () => {
  it("resolves owner/repo from environment settings", () => {
    const repo = resolveProjectTargetRepository({
      envSettings: {
        gitRepoName: "pjryu0322/aiproject",
        gitRepoUrl: "https://github.com/pjryu0322/aiproject",
        baseBranch: "main",
      },
    });
    expect(repo?.repoFullName).toBe("pjryu0322/aiproject");
  });

  it("returns null when no target repo", () => {
    expect(resolveProjectTargetRepository({})).toBeNull();
  });
});

describe("resolveSourceGenerationWorkspaceRoot", () => {
  it("executionSetup.workspacePath가 있으면 env workspace보다 우선", () => {
    const resolved = resolveSourceGenerationWorkspaceRoot({
      workspacePath: "C:/workspace/aiproject",
      env: { GIT_APPLY_WORKDIR: "/env/root" },
    });
    expect(resolved?.workspaceRoot).toBe("C:/workspace/aiproject");
    expect(resolved?.source).toBe("execution_setup");
  });

  it("workspacePath 없고 env 있으면 fallback", () => {
    const resolved = resolveSourceGenerationWorkspaceRoot({
      workspacePath: "",
      env: { GIT_APPLY_WORKDIR: "/env/root" },
    });
    expect(resolved?.source).toBe("env_fallback");
    expect(resolved?.workspaceRoot).toBe("/env/root");
  });

  it("둘 다 없으면 null", () => {
    expect(resolveSourceGenerationWorkspaceRoot({ workspacePath: "" })).toBeNull();
  });
});

describe("evaluateExecutionSetupSourceGenerationReadiness", () => {
  const baseSetup = {
    gitRepoName: "pjryu0322/aiproject",
    gitRepoUrl: "https://github.com/pjryu0322/aiproject",
    baseBranch: "main",
    workspacePath: "C:/workspace/aiproject",
    autoCommit: true,
    autoPush: true,
    autoPr: false,
    cursorApiUrl: "https://api.cursor.com",
    hasCursorToken: true,
    hasGithubAccessToken: true,
  };

  it("target repo exists but cursor bridge missing → blocked when no cursor api", () => {
    const readiness = evaluateExecutionSetupSourceGenerationReadiness({
      setup: { ...baseSetup, hasCursorToken: false, cursorApiUrl: "" },
      env: { CURSOR_BRIDGE_ENABLED: "false" },
    });
    expect(readiness.ok).toBe(false);
  });

  it("missing workspace and env fallback blocks", () => {
    const readiness = evaluateExecutionSetupSourceGenerationReadiness({
      setup: { ...baseSetup, workspacePath: "" },
      env: { CURSOR_BRIDGE_ENABLED: "true", CURSOR_BRIDGE_ENDPOINT: "http://localhost:1" },
    });
    expect(readiness.ok).toBe(false);
  });
});

describe("evaluateCursorBridgeSourceGenerationGate", () => {
  const target = resolveProjectTargetRepositoryFromExecutionSetup({
    gitRepoName: "pjryu0322/aiproject",
    baseBranch: "main",
  })!;

  it("target repo exists but cursor bridge missing → blocked", () => {
    const availability = getCursorBridgeAvailability({ env: { CURSOR_BRIDGE_ENABLED: "false" } });
    const gate = evaluateCursorBridgeSourceGenerationGate({
      targetRepository: target,
      bridgeAvailable: availability.available,
      workspaceRoot: "C:/ws",
      hasCursorApi: false,
    });
    expect(gate.ok).toBe(false);
  });
});
