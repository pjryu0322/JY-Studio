import { describe, expect, it } from "vitest";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";
import { mergeConnectionTestPreservingEnvcheckEvidence } from "@/lib/prototype/autoGenerationSettingsConnectionTest";

describe("autoGenerationConnectionTestNormalizerEvidence", () => {
  it("preserves envcheck passed evidence when server returns skipped envcheck", () => {
    const evidence = normalizeAutoGenerationConnectionTestResult({
      settingsConnectionTestOnly: true,
      checkedAt: "2026-06-01T00:00:00.000Z",
      basicConnection: [
        { key: "github_repository", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "github_token", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "cursor_api", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      envcheck: [
        { key: "branch_create", status: "passed", required: true, userSafeMessage: "envcheck branch가 생성되었습니다.", operatorMessage: null, remediationCode: "none" },
        { key: "file_write", status: "passed", required: true, userSafeMessage: "임시 파일 생성/수정이 완료되었습니다.", operatorMessage: null, remediationCode: "none" },
        { key: "pull_request_create_or_update", status: "passed", required: true, userSafeMessage: "envcheck PR이 생성 또는 갱신되었습니다.", operatorMessage: null, remediationCode: "none" },
      ],
    });

    const server = normalizeAutoGenerationConnectionTestResult({
      settingsConnectionTestOnly: true,
      checkedAt: "2026-06-01T00:00:00.000Z",
      basicConnection: [
        { key: "github_repository", status: "unknown", required: true, userSafeMessage: "x", operatorMessage: null, remediationCode: "check_repository" },
        { key: "github_token", status: "unknown", required: true, userSafeMessage: "x", operatorMessage: null, remediationCode: "check_token" },
        { key: "cursor_api", status: "unknown", required: true, userSafeMessage: "x", operatorMessage: null, remediationCode: "check_cursor_api" },
      ],
    });

    const merged = mergeConnectionTestPreservingEnvcheckEvidence(evidence, server);
    expect(merged.envcheck.find((c) => c.key === "branch_create")?.status).toBe("passed");
    expect(merged.envcheck.find((c) => c.key === "pull_request_create_or_update")?.status).toBe("passed");
  });

  it("does not skip envcheck solely because basic connection is unknown", () => {
    const result = normalizeAutoGenerationConnectionTestResult({
      checkedAt: "2026-06-01T00:00:00.000Z",
      basicConnection: [
        { key: "github_repository", status: "unknown", required: true, userSafeMessage: "x", operatorMessage: null, remediationCode: "check_repository" },
        { key: "github_token", status: "unknown", required: true, userSafeMessage: "x", operatorMessage: null, remediationCode: "check_token" },
        { key: "cursor_api", status: "unknown", required: true, userSafeMessage: "x", operatorMessage: null, remediationCode: "check_cursor_api" },
      ],
      envcheck: [
        { key: "branch_create", status: "passed", required: true, userSafeMessage: "envcheck branch가 생성되었습니다.", operatorMessage: null, remediationCode: "none" },
        { key: "file_write", status: "passed", required: true, userSafeMessage: "임시 파일 생성/수정이 완료되었습니다.", operatorMessage: null, remediationCode: "none" },
        { key: "pull_request_create_or_update", status: "passed", required: true, userSafeMessage: "envcheck PR이 생성 또는 갱신되었습니다.", operatorMessage: null, remediationCode: "none" },
      ],
    });
    expect(result.envcheck.every((c) => c.status === "passed")).toBe(true);
  });
});
