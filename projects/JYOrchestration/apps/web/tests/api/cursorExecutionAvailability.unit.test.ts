import { describe, expect, it } from "vitest";
import {
  evaluateCursorExecutionAvailability,
  formatCursorExecutionAvailabilityDiagnosticLines,
} from "@/lib/prototype/cursorExecutionAvailability";

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
  });

  it("missing workspace returns none/missing_workspace", () => {
    const availability = evaluateCursorExecutionAvailability({
      setup: {
        gitRepoUrl: "https://github.com/o/r",
        gitRepoName: "o/r",
        cursorApiUrl: "http://localhost:9999",
        hasCursorToken: true,
      },
    });
    expect(availability.mode).toBe("none");
    expect(availability.status).toBe("missing_workspace");
  });

  it("missing cursor api returns none/missing_cursor_api", () => {
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

  it("board diagnostic shows cursor_api and masks token", () => {
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
    expect(text).toContain("Cursor Token: 설정됨");
    expect(text).not.toContain("sk-");
  });
});
