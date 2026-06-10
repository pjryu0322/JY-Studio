import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntegrationPreviewRemediationPanel } from "@/components/preview/IntegrationPreviewRemediationPanel";

describe("IntegrationPreviewPermissionGuide", () => {
  it("shows permission remediation guide for github_preview_permission_required", () => {
    const html = renderToStaticMarkup(
      createElement(IntegrationPreviewRemediationPanel, {
        pipelineStatus: "github_preview_permission_required",
      }),
    );
    expect(html).toContain("integration-preview-remediation-panel");
    expect(html).toContain("실제 앱 Preview 배포 권한이 필요합니다");
    expect(html).toContain("integration-preview-permission-guide-button");
  });

  it("shows pages setup guide for github_pages_setup_required", () => {
    const html = renderToStaticMarkup(
      createElement(IntegrationPreviewRemediationPanel, {
        pipelineStatus: "github_pages_setup_required",
        gitRepoUrl: "https://github.com/o/r",
      }),
    );
    expect(html).toContain("GitHub Pages 설정이 필요합니다");
    expect(html).toContain("integration-preview-pages-guide-button");
  });
});
