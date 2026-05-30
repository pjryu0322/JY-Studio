import { describe, expect, it } from "vitest";
import {
  evaluateCursorExecutionAvailability,
  formatCursorExecutionAvailabilityDiagnosticLines,
  resolveEffectiveCursorApiUrlFromSetup,
} from "@/lib/prototype/cursorExecutionAvailability";
import { DEFAULT_CURSOR_API_BASE } from "@/lib/executionSetup/cursorApiValidation";

describe("cursorExecutionAvailability", () => {
  it("returns cursor_api mode when ExecutionSetup has cursor API and workspace", () => {
    const availability = evaluateCursorExecutionAvailability({
      setup: {
        gitRepoUrl: "https://github.com/o/r",
        gitRepoName: "o/r",
        gitRepoProvider: "github",
        baseBranch: "main",
        workspacePath: "C:/workspace/r",
        cursorApiUrl: "http://localhost:9999",
        hasCursorToken: true,
        hasGithubAccessToken: true,
      },
    });
    expect(availability.mode).toBe("cursor_api");
    expect(availability.status).toBe("ready");
    expect(availability.ready).toBe(true);
  });

  it("cursor_api is ready when env bridge is disabled", () => {
    const availability = evaluateCursorExecutionAvailability({
      setup: {
        gitRepoUrl: "https://github.com/o/r",
        gitRepoName: "o/r",
        cursorApiUrl: "http://localhost:9999",
        hasCursorToken: true,
        workspacePath: "C:/workspace/r",
      },
    });
    expect(availability.mode).toBe("cursor_api");
    expect(availability.ready).toBe(true);
  });

  it("missing cursor token returns none/missing_cursor_token", () => {
    const availability = evaluateCursorExecutionAvailability({
      setup: {
        gitRepoUrl: "https://github.com/o/r",
        gitRepoName: "o/r",
        cursorApiUrl: "http://localhost:9999",
        hasCursorToken: false,
        workspacePath: "C:/workspace/r",
      },
    });
    expect(availability.mode).toBe("none");
    expect(availability.status).toBe("missing_cursor_token");
    expect(availability.ready).toBe(false);
    expect(availability.hasGitRepo).toBe(true);
  });

  it("git repo without explicit workspacePath is ready via git_repo_auto workspace", () => {
    const availability = evaluateCursorExecutionAvailability({
      setup: {
        gitRepoUrl: "https://github.com/o/r",
        gitRepoName: "o/r",
        cursorApiUrl: "http://localhost:9999",
        hasCursorToken: true,
        hasGithubAccessToken: true,
      },
    });
    expect(availability.mode).toBe("cursor_api");
    expect(availability.status).toBe("ready");
    expect(availability.ready).toBe(true);
    expect(availability.hasWorkspace).toBe(true);
    expect(availability.workspaceAutoFromGit).toBe(true);
    expect(availability.workspacePath).toContain("o-r");
  });

  it("gitRepoName owner/repo resolves targetRepository without gitRepoUrl", () => {
    const availability = evaluateCursorExecutionAvailability({
      setup: {
        gitRepoName: "pjryu0322/aiproject",
        gitRepoProvider: "github",
        baseBranch: "main",
        hasCursorToken: true,
        workspacePath: "C:/workspace/r",
      },
    });
    expect(availability.hasGitRepo).toBe(true);
    expect(availability.targetRepository?.defaultBranch).toBe("main");
    expect(availability.usesDefaultCursorApiUrl).toBe(true);
    expect(availability.status).toBe("ready");
  });

  it("token with no explicit URL uses default Cursor API base (option 2)", () => {
    const effective = resolveEffectiveCursorApiUrlFromSetup({
      hasCursorToken: true,
    });
    expect(effective.url).toBe(DEFAULT_CURSOR_API_BASE);
    expect(effective.usesDefault).toBe(true);

    const availability = evaluateCursorExecutionAvailability({
      setup: {
        gitRepoName: "o/r",
        gitRepoProvider: "github",
        hasCursorToken: true,
        hasGithubAccessToken: true,
        workspacePath: "C:/workspace/r",
      },
    });
    expect(availability.hasCursorApiUrl).toBe(true);
    expect(availability.usesDefaultCursorApiUrl).toBe(true);
    expect(availability.status).toBe("ready");
  });

  it("missing cursor api returns none/missing_cursor_api when setup is null", () => {
    const availability = evaluateCursorExecutionAvailability({ setup: null });
    expect(availability.mode).toBe("none");
    expect(availability.status).toBe("missing_cursor_api");
    expect(availability.ready).toBe(false);
  });

  it("does not select http_bridge when env bridge endpoint exists", () => {
    const availability = evaluateCursorExecutionAvailability({ setup: null });
    expect(availability.mode).toBe("none");
    expect(availability.mode).not.toBe("http_bridge");
  });

  it("does not select local_runner when env local bridge is configured", () => {
    const availability = evaluateCursorExecutionAvailability({
      setup: {
        gitRepoUrl: "https://github.com/o/r",
        gitRepoName: "o/r",
      },
    });
    expect(availability.mode).toBe("none");
    expect(availability.mode).not.toBe("local_runner");
  });

  it("board diagnostic shows cursor_api and Cursor API Key label", () => {
    const lines = formatCursorExecutionAvailabilityDiagnosticLines({
      setup: {
        gitRepoUrl: "https://github.com/o/r",
        gitRepoName: "o/r",
        cursorApiUrl: "http://localhost:9999",
        hasCursorToken: true,
        workspacePath: "C:/workspace/r",
      },
    });
    const text = lines.join("\n");
    expect(text).toContain("Mode: cursor_api");
    expect(text).not.toContain("Status: disabled");
    expect(text).toContain("Cursor API URL: 설정됨");
    expect(text).toContain("Cursor API Key: 설정됨");
    expect(text).not.toContain("sk-");
  });

  it("board diagnostic shows 기본값 사용 when default URL policy applies", () => {
    const lines = formatCursorExecutionAvailabilityDiagnosticLines({
      setup: {
        gitRepoName: "o/r",
        gitRepoProvider: "github",
        hasCursorToken: true,
        workspacePath: "C:/workspace/r",
      },
    });
    const text = lines.join("\n");
    expect(text).toContain("Cursor API URL: 기본값 사용");
    expect(text).toContain("Cursor API Key: 설정됨");
  });
});
