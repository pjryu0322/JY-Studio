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
      env: { CURSOR_BRIDGE_ENABLED: "false" },
    });
    expect(availability.mode).toBe("cursor_api");
    expect(availability.status).toBe("ready");
    expect(availability.ready).toBe(true);
    expect(availability.status).not.toBe("disabled");
  });

  it("cursor_api is not disabled when env bridge disabled", () => {
    const availability = evaluateCursorExecutionAvailability({
      setup: {
        gitRepoUrl: "https://github.com/o/r",
        gitRepoName: "o/r",
        cursorApiUrl: "http://localhost:9999",
        hasCursorToken: true,
        workspacePath: "C:/workspace/r",
      },
      env: { CURSOR_BRIDGE_ENABLED: "false" },
    });
    expect(availability.mode).toBe("cursor_api");
    expect(availability.ready).toBe(true);
  });

  it("missing cursor token returns missing_cursor_token", () => {
    const availability = evaluateCursorExecutionAvailability({
      setup: {
        gitRepoUrl: "https://github.com/o/r",
        gitRepoName: "o/r",
        cursorApiUrl: "http://localhost:9999",
        hasCursorToken: false,
        workspacePath: "C:/workspace/r",
      },
    });
    expect(availability.status).toBe("missing_cursor_token");
    expect(availability.ready).toBe(false);
  });

  it("missing workspace returns missing_workspace", () => {
    const availability = evaluateCursorExecutionAvailability({
      setup: {
        gitRepoUrl: "https://github.com/o/r",
        gitRepoName: "o/r",
        cursorApiUrl: "http://localhost:9999",
        hasCursorToken: true,
      },
      env: {},
    });
    expect(availability.status).toBe("missing_workspace");
  });

  it("http_bridge used when cursor api missing and endpoint exists", () => {
    const availability = evaluateCursorExecutionAvailability({
      setup: null,
      env: {
        CURSOR_BRIDGE_ENABLED: "true",
        CURSOR_BRIDGE_ENDPOINT: "http://bridge.local",
      },
    });
    expect(availability.mode).toBe("http_bridge");
    expect(availability.ready).toBe(true);
  });

  it("cursor_api beats http_bridge when both configured", () => {
    const availability = evaluateCursorExecutionAvailability({
      setup: {
        gitRepoUrl: "https://github.com/o/r",
        gitRepoName: "o/r",
        cursorApiUrl: "http://localhost:9999",
        hasCursorToken: true,
        workspacePath: "C:/workspace/r",
      },
      env: {
        CURSOR_BRIDGE_ENABLED: "true",
        CURSOR_BRIDGE_ENDPOINT: "http://bridge.local",
      },
    });
    expect(availability.mode).toBe("cursor_api");
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
      env: { CURSOR_BRIDGE_ENABLED: "false" },
    });
    const text = lines.join("\n");
    expect(text).toContain("Mode: cursor_api");
    expect(text).not.toContain("Status: disabled");
    expect(text).toContain("Cursor Token: 설정됨");
    expect(text).not.toContain("sk-");
  });
});
