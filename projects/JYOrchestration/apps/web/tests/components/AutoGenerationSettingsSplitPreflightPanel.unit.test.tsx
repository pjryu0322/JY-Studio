import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutoGenerationSplitPreflightPanel } from "@/components/settings/AutoGenerationSplitPreflightPanel";
import type { AutoGenerationSettingsConnectionTestResultV1 } from "@/lib/prototype/autoGenerationSettingsConnectionTest";

function sampleResult(): AutoGenerationSettingsConnectionTestResultV1 {
  return {
    basicConnection: [],
    envcheck: [
      {
        key: "pull_request_create_or_update",
        status: "failed",
        required: true,
        userSafeMessage: "PR 생성/갱신에 실패했습니다. GitHub 저장소 권한 또는 branch 상태를 확인해 주세요.",
        operatorMessage: "raw",
        remediationCode: "enable_pull_request_permission",
      },
      { key: "branch_create", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      { key: "file_write", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
    ],
    previewDeploymentPreflight: [
      {
        key: "actions_workflow_dispatch",
        status: "failed",
        required: true,
        userSafeMessage: "GitHub Actions 실행 권한이 필요합니다.",
        operatorMessage: null,
        remediationCode: "enable_actions_permission",
      },
      { key: "workflow_file_write", status: "passed", required: true, userSafeMessage: null, operatorMessage: null, remediationCode: "none" },
      { key: "gh_pages_branch_write", status: "warning", required: true, userSafeMessage: "확인 필요", operatorMessage: null, remediationCode: "enable_pages" },
      { key: "pages_status_read", status: "warning", required: true, userSafeMessage: "설정 필요", operatorMessage: null, remediationCode: "enable_pages" },
    ],
    autoGenerationReady: false,
    previewDeploymentReady: false,
    level: "blocked",
    userSummary: "자동 생성 기본 연결에 문제가 있습니다.",
    checkedAt: "2026-06-01T00:00:00.000Z",
    sectionSummaries: {
      basicConnection: "기본 연결이 정상입니다.",
      envcheck: "PR 생성/갱신에 실패했습니다.",
      previewDeploymentPreflight: "GitHub Actions 실행 권한이 필요합니다.",
    },
  };
}

describe("AutoGenerationSettingsSplitPreflightPanel", () => {
  it("shows envcheck section only without preview preflight UI", () => {
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, { connectionTest: sampleResult() }),
    );
    expect(html).toContain("자동 생성 기본 점검");
    expect(html).not.toContain("Preview 배포 사전점검");
    expect(html).not.toContain("고급 Preview");
    expect(html).toContain("PR 생성/갱신");
  });

  it("shows PR failure only under envcheck summary", () => {
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, { connectionTest: sampleResult() }),
    );
    expect(html).toContain("자동 생성 기본 점검:");
    expect(html).toContain("PR 생성/갱신에 실패했습니다");
    expect(html).not.toContain("raw");
  });

  it("shows section summaries without preview preflight card by default", () => {
    const html = renderToStaticMarkup(
      createElement(AutoGenerationSplitPreflightPanel, {
        connectionTest: sampleResult(),
        connectionTestAttempted: true,
      }),
    );
    expect(html).toContain("기본 연결 상태:");
    expect(html).not.toContain("Preview 배포 사전점검:");
  });
});
