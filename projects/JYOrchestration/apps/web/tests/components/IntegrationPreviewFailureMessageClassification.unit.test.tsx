import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntegrationPreviewRemediationPanel } from "@/components/preview/IntegrationPreviewRemediationPanel";
import { getIntegrationPreviewRemediationGuide } from "@/lib/prototype/integrationPreviewRemediationGuide";

describe("IntegrationPreviewFailureMessageClassification", () => {
  it("19. permission_denied guide shows permission help", () => {
    const guide = getIntegrationPreviewRemediationGuide("github_preview_permission_required");
    expect(guide?.showPermissionGuide).toBe(true);
  });

  it("20. invalid_dispatch_inputs guide does not show permission guide", () => {
    const guide = getIntegrationPreviewRemediationGuide("github_preview_workflow_request_invalid");
    expect(guide?.showPermissionGuide).toBe(false);
    expect(guide?.introLine).toContain("입력값");
  });

  it("21. workflow_not_found guide mentions workflow file", () => {
    const guide = getIntegrationPreviewRemediationGuide("github_preview_workflow_setup_required");
    expect(guide?.actionLines.some((l) => l.includes("workflow"))).toBe(true);
  });

  it("22. remediation panel markup excludes raw token patterns", () => {
    const html = renderToStaticMarkup(
      createElement(IntegrationPreviewRemediationPanel, {
        pipelineStatus: "github_preview_workflow_request_invalid",
      }),
    );
    expect(html).not.toMatch(/ghp_[A-Za-z0-9]+/);
    expect(html).not.toContain("Authorization");
  });
});
