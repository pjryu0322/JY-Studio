import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoGenerationSplitPreflightPanel } from "@/components/settings/AutoGenerationSplitPreflightPanel";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

describe("AutoGenerationSplitPreflightPanelActions", () => {
  it("hides remediation buttons when all checks passed", () => {
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
        { key: "pull_request_create_or_update", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
    });
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, { connectionTest, connectionTestAttempted: true }),
    );
    expect(html).not.toContain("GitHub Token 재설정");
    expect(html).not.toContain("연결 테스트 다시 실행");
  });

  it("shows GitHub Token reset when token check failed", () => {
    const connectionTest = normalizeAutoGenerationConnectionTestResult({
      settingsConnectionTestOnly: true,
      checkedAt: new Date().toISOString(),
      basicConnection: [
        { key: "github_repository", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "github_token", status: "failed", required: true, userSafeMessage: "fail", operatorMessage: null, remediationCode: "check_token" },
        { key: "cursor_api", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
    });
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, { connectionTest, connectionTestAttempted: true }),
    );
    expect(html).toContain("GitHub Token 재설정");
    expect(html).not.toContain("연결 테스트 다시 실행");
  });
});
