import { describe, expect, it } from "vitest";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

describe("autoGenerationConnectionTestNormalizer", () => {
  it("returns arrays when groups are undefined", () => {
    const result = normalizeAutoGenerationConnectionTestResult({
      checkedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(result.basicConnection.length).toBe(3);
    expect(result.envcheck.length).toBe(3);
    expect(result.previewDeploymentPreflight.length).toBeGreaterThanOrEqual(4);
  });

  it("creates envcheck skipped rows when basic connection is unknown", () => {
    const result = normalizeAutoGenerationConnectionTestResult({
      basicConnection: [
        { key: "github_repository", status: "unknown", required: true, userSafeMessage: "x", operatorMessage: null, remediationCode: "check_repository" },
        { key: "github_token", status: "unknown", required: true, userSafeMessage: "x", operatorMessage: null, remediationCode: "check_token" },
        { key: "cursor_api", status: "unknown", required: true, userSafeMessage: "x", operatorMessage: null, remediationCode: "check_cursor_api" },
      ],
      checkedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(result.envcheck.every((c) => c.status === "skipped")).toBe(true);
    expect(result.envcheck[0]?.userSafeMessage).toContain("기본 GitHub 연결");
  });

  it("creates preview skipped rows when envcheck failed", () => {
    const result = normalizeAutoGenerationConnectionTestResult({
      basicConnection: [
        { key: "github_repository", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "github_token", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "cursor_api", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      envcheck: [
        { key: "branch_create", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "file_write", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "pull_request_create_or_update", status: "failed", required: true, userSafeMessage: "PR fail", operatorMessage: "raw", remediationCode: "enable_pull_request_permission" },
      ],
      checkedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(result.autoGenerationReady).toBe(false);
    expect(result.previewDeploymentPreflight.some((c) => c.status === "skipped")).toBe(true);
  });

  it("does not put raw error in userSafeMessage when thrownError is set", () => {
    const result = normalizeAutoGenerationConnectionTestResult({
      thrownError: new Error("secret github_pat_abc123 stack at foo.ts"),
      checkedAt: "2026-06-01T00:00:00.000Z",
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("github_pat_");
    expect(serialized).not.toContain("stack at");
    expect(result.basicConnection.some((c) => c.operatorMessage)).toBe(true);
  });

  it("sets autoGenerationReady true and previewDeploymentReady false when envcheck ok and actions failed", () => {
    const result = normalizeAutoGenerationConnectionTestResult({
      basicConnection: [
        { key: "github_repository", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "github_token", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "cursor_api", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      envcheck: [
        { key: "branch_create", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "file_write", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "pull_request_create_or_update", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      previewDeploymentPreflight: [
        { key: "workflow_file_write", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "actions_workflow_dispatch", status: "failed", required: true, userSafeMessage: "GitHub Actions 실행 권한이 필요합니다.", operatorMessage: null, remediationCode: "enable_actions_permission" },
        { key: "gh_pages_branch_write", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "pages_status_read", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      checkedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(result.autoGenerationReady).toBe(true);
    expect(result.previewDeploymentReady).toBe(false);
    expect(result.sectionSummaries.previewDeploymentPreflight).toContain("Actions");
  });

  it("settings scope treats preview as deferred and keeps level ready when envcheck passes", () => {
    const result = normalizeAutoGenerationConnectionTestResult({
      settingsConnectionTestOnly: true,
      basicConnection: [
        { key: "github_repository", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "github_token", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "cursor_api", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      envcheck: [
        { key: "branch_create", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "file_write", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "pull_request_create_or_update", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      previewDeploymentPreflight: [
        { key: "actions_workflow_dispatch", status: "failed", required: true, userSafeMessage: "GitHub Actions 실행 권한이 필요합니다.", operatorMessage: null, remediationCode: "enable_actions_permission" },
      ],
      checkedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(result.autoGenerationReady).toBe(true);
    expect(result.previewDeploymentReady).toBe(true);
    expect(result.level).toBe("ready");
    expect(result.userSummary).toContain("자동 생성 기본 연결이 정상입니다");
  });
});
