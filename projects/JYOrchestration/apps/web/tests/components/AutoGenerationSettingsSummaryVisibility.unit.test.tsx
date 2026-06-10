import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoGenerationSplitPreflightPanel } from "@/components/settings/AutoGenerationSplitPreflightPanel";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

function allPassedConnectionTest() {
  return normalizeAutoGenerationConnectionTestResult({
    settingsConnectionTestOnly: true,
    checkedAt: new Date().toISOString(),
    basicConnection: [
      { key: "github_repository", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      { key: "github_token", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      { key: "cursor_api", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
    ],
    envcheck: [
      { key: "branch_create", status: "passed", required: true, userSafeMessage: "ok", operatorMessage: null, remediationCode: "none" },
      { key: "file_write", status: "passed", required: true, userSafeMessage: "ok", operatorMessage: null, remediationCode: "none" },
      { key: "pull_request_create_or_update", status: "passed", required: true, userSafeMessage: "ok", operatorMessage: null, remediationCode: "none" },
    ],
  });
}

describe("AutoGenerationSettingsSummaryVisibility", () => {
  it("hides summary cards when basic and envcheck are all passed", () => {
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, {
        connectionTest: allPassedConnectionTest(),
        connectionTestAttempted: true,
      }),
    );
    expect(html).not.toContain("auto-gen-split-status-messages");
    expect(html).not.toContain("기본 연결 상태:");
    expect(html).not.toContain("자동 생성 기본 점검:");
  });

  it("shows envcheck summary card when envcheck failed", () => {
    const connectionTest = normalizeAutoGenerationConnectionTestResult({
      settingsConnectionTestOnly: true,
      checkedAt: new Date().toISOString(),
      basicConnection: [
        { key: "github_repository", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "github_token", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "cursor_api", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      envcheck: [
        { key: "branch_create", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "file_write", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        {
          key: "pull_request_create_or_update",
          status: "failed",
          required: true,
          userSafeMessage: "PR 생성/갱신에 실패했습니다.",
          operatorMessage: null,
          remediationCode: "enable_pull_request_permission",
        },
      ],
    });
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, {
        connectionTest,
        connectionTestAttempted: true,
      }),
    );
    expect(html).toContain("자동 생성 기본 점검:");
    expect(html).not.toContain("기본 연결 상태:");
  });
});
