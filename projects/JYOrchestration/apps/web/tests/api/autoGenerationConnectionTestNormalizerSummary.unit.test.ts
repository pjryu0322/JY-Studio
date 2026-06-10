import { describe, expect, it } from "vitest";
import { buildBasicConnectionSectionSummary, buildEnvcheckSectionSummary } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

describe("autoGenerationConnectionTestNormalizerSummary", () => {
  it("returns basic ok summary when all basic rows passed", () => {
    const summary = buildBasicConnectionSectionSummary([
      { key: "github_repository", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      { key: "github_token", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      { key: "cursor_api", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
    ]);
    expect(summary).toBe("기본 연결이 정상입니다.");
  });

  it("does not return repository warning when repository passed and token unknown", () => {
    const summary = buildBasicConnectionSectionSummary([
      { key: "github_repository", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      { key: "github_token", status: "unknown", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "check_token" },
      { key: "cursor_api", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
    ]);
    expect(summary).toBe("GitHub Token 권한을 확인해 주세요.");
    expect(summary).not.toContain("GitHub 저장소");
  });

  it("returns envcheck ok summary when all envcheck passed", () => {
    const summary = buildEnvcheckSectionSummary([
      { key: "branch_create", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      { key: "file_write", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      { key: "pull_request_create_or_update", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
    ]);
    expect(summary).toBe("자동 생성 기본 점검이 정상입니다.");
  });
});
