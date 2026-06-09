import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoGenerationPreflightPanel } from "@/components/settings/AutoGenerationPreflightPanel";
import type { GithubProviderPreflightResultV1 } from "@/lib/prototype/githubProviderPreflightTypes";

function preflightWithFailed(key: string): GithubProviderPreflightResultV1 {
  return {
    ok: false,
    level: "blocked",
    targetRepository: "o/r",
    defaultBranch: "main",
    checks: [
      {
        key: key as GithubProviderPreflightResultV1["checks"][number]["key"],
        status: "failed",
        required: true,
        userSafeMessage: "user-safe only",
        operatorMessage: "raw HTTP 403 forbidden",
        remediationCode: "enable_actions_permission",
      },
    ],
    userSummary: "blocked",
    blockedReasons: ["actions"],
    warnings: [],
    operatorDiagnosticsId: "diag-1",
    checkedAt: "2026-06-01T00:00:00.000Z",
  };
}

describe("AutoGenerationSettingsPreflightPanel", () => {
  it("shows 권한 필요 for actions_workflow_dispatch failure", () => {
    const html = renderToStaticMarkup(
      createElement(AutoGenerationPreflightPanel, {
        preflight: preflightWithFailed("actions_workflow_dispatch"),
      }),
    );
    expect(html).toContain("권한 필요");
    expect(html).not.toContain("raw HTTP");
  });

  it("shows 권한 필요 for workflow_file_write failure", () => {
    const pf = preflightWithFailed("workflow_file_write");
    const html = renderToStaticMarkup(createElement(AutoGenerationPreflightPanel, { preflight: pf }));
    expect(html).toContain("Workflow 파일 생성 권한");
    expect(html).toContain("권한 필요");
  });

  it("shows 설정 필요 for pages_status_read failure", () => {
    const pf: GithubProviderPreflightResultV1 = {
      ...preflightWithFailed("pages_status_read"),
      checks: [
        {
          key: "pages_status_read",
          status: "failed",
          required: true,
          userSafeMessage: "Pages 설정 확인",
          operatorMessage: null,
          remediationCode: "enable_pages",
        },
      ],
    };
    const html = renderToStaticMarkup(createElement(AutoGenerationPreflightPanel, { preflight: pf }));
    expect(html).toContain("설정 필요");
  });

  it("shows remediation buttons when blocked", () => {
    const html = renderToStaticMarkup(
      createElement(AutoGenerationPreflightPanel, {
        preflight: preflightWithFailed("actions_workflow_dispatch"),
      }),
    );
    expect(html).toContain("GitHub Token 재설정");
    expect(html).toContain("권한 설정 가이드");
    expect(html).toContain("연결 테스트 다시 실행");
  });
});
