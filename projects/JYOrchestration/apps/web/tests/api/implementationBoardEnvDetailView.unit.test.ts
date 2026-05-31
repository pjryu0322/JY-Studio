import { describe, expect, it } from "vitest";
import {
  buildImplementationBoardEnvDetailLines,
  evaluateTaskCursorExecutionSetupReadiness,
  formatTaskCursorSetupReadinessPillValue,
  resolveTaskCursorExecutionEnvGate,
} from "@/lib/prototype/implementationBoardEnvDetailView";

describe("implementationBoardEnvDetailView", () => {
  it("reports missing setup when execution setup is absent", () => {
    const readiness = evaluateTaskCursorExecutionSetupReadiness({ setup: null });
    expect(readiness.ready).toBe(false);
    expect(readiness.status).toBe("missing_setup");
    expect(readiness.blockingIssues).toContain("환경설정 없음");
    expect(buildImplementationBoardEnvDetailLines({ setup: null }).join("\n")).toContain("missing_setup");
  });

  it("marks ready when validated setup uses default Cloud Agents API URL", () => {
    const readiness = evaluateTaskCursorExecutionSetupReadiness({
      setup: {
        gitRepoUrl: "https://github.com/org/repo",
        gitRepoName: "org/repo",
        gitRepoProvider: "github",
        baseBranch: "main",
        hasCursorToken: true,
        hasGithubAccessToken: true,
        status: "validated",
        repoConnectionOk: true,
        cursorApiConnectionOk: true,
        executorConnectionOk: true,
      },
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.status).toBe("ready");
    expect(formatTaskCursorSetupReadinessPillValue(readiness)).toBe("준비됨");
    expect(readiness.warnings.some((w) => w.includes("Cloud Agents API"))).toBe(true);
  });

  it("marks ready when validated setup uses custom bridge URL", () => {
    const readiness = evaluateTaskCursorExecutionSetupReadiness({
      setup: {
        gitRepoUrl: "https://github.com/org/repo",
        gitRepoName: "org/repo",
        gitRepoProvider: "github",
        baseBranch: "main",
        cursorApiUrl: "https://cursor-bridge.example.com",
        hasCursorToken: true,
        hasGithubAccessToken: true,
        status: "validated",
        repoConnectionOk: true,
        cursorApiConnectionOk: true,
        executorConnectionOk: true,
      },
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.status).toBe("ready");
    expect(formatTaskCursorSetupReadinessPillValue(readiness)).toBe("준비됨");
  });

  it("includes repo, branch, and validation lines in diagnostic output", () => {
    const lines = buildImplementationBoardEnvDetailLines({
      setup: {
        gitRepoUrl: "https://github.com/org/repo",
        gitRepoName: "org/repo",
        gitRepoProvider: "github",
        baseBranch: "develop",
        hasCursorToken: true,
        hasGithubAccessToken: true,
        status: "invalid",
        lastValidationError: "Cursor API 연결 실패",
        repoConnectionOk: false,
      },
    });
    const text = lines.join("\n");
    expect(text).toContain("org/repo");
    expect(text).toContain("develop");
    expect(text).toContain("Cursor API 연결 실패");
    expect(text).toContain("Task Cursor 정책");
  });

  it("resolveTaskCursorExecutionEnvGate blocks unvalidated setup with guidance message", () => {
    expect(
      resolveTaskCursorExecutionEnvGate({
        setup: {
          gitRepoUrl: "https://github.com/org/repo",
          gitRepoName: "org/repo",
          gitRepoProvider: "github",
          baseBranch: "main",
          hasCursorToken: true,
          hasGithubAccessToken: true,
          status: "draft",
        },
      }),
    ).toEqual({
      blocked: true,
      message:
        "환경설정 실행 검증이 완료되지 않았습니다. [환경설정] → 환경 검증을 완료한 뒤 Task를 실행해 주세요.",
    });
  });

  it("resolveTaskCursorExecutionEnvGate allows validated setup", () => {
    expect(
      resolveTaskCursorExecutionEnvGate({
        setup: {
          gitRepoUrl: "https://github.com/org/repo",
          gitRepoName: "org/repo",
          gitRepoProvider: "github",
          baseBranch: "main",
          hasCursorToken: true,
          hasGithubAccessToken: true,
          status: "validated",
          repoConnectionOk: true,
          cursorApiConnectionOk: true,
          executorConnectionOk: true,
        },
      }),
    ).toEqual({ blocked: false });
  });
});
