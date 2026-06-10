import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoGenerationSplitPreflightPanel } from "@/components/settings/AutoGenerationSplitPreflightPanel";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

describe("AutoGenerationBasicEnvcheckPanel", () => {
  it("shows passed envcheck rows from evidence", () => {
    const connectionTest = normalizeAutoGenerationConnectionTestResult({
      settingsConnectionTestOnly: true,
      checkedAt: new Date().toISOString(),
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
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, {
        connectionTest,
        connectionTestAttempted: true,
      }),
    );
    expect(html).toContain("정상");
    expect(html).toContain("envcheck branch가 생성되었습니다");
    expect(html).not.toContain("Preview 배포 사전점검");
  });
});
