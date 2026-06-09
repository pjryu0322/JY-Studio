import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoGenerationSplitPreflightPanel } from "@/components/settings/AutoGenerationSplitPreflightPanel";
import { normalizeAutoGenerationConnectionTestResult } from "@/lib/prototype/autoGenerationConnectionTestNormalizer";

describe("AutoGenerationPreflightFallbackRows", () => {
  it("renders envcheck rows after attempted test without stored result", () => {
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, {
        connectionTest: null,
        connectionTestAttempted: true,
      }),
    );
    expect(html).toContain("auto-gen-envcheck-row-branch_create");
    expect(html).not.toContain("연결 테스트를 실행하면 결과가 표시됩니다.");
  });

  it("renders preview rows with skipped status when envcheck blocked", () => {
    const connectionTest = normalizeAutoGenerationConnectionTestResult({
      basicConnection: [
        { key: "github_repository", status: "failed", required: true, userSafeMessage: "fail", operatorMessage: null, remediationCode: "check_repository" },
        { key: "github_token", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
        { key: "cursor_api", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      ],
      checkedAt: "2026-06-01T00:00:00.000Z",
    });
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, {
        connectionTest,
        connectionTestAttempted: true,
      }),
    );
    expect(html).toContain("건너뜀");
    expect(html).toContain("auto-gen-preview-preflight-row-actions_workflow_dispatch");
  });

  it("includes help button on each row", () => {
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, {
        connectionTest: null,
        connectionTestAttempted: true,
      }),
    );
    expect(html.match(/aria-label="[^"]+ 도움말"/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });
});
