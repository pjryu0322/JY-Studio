import { describe, expect, it } from "vitest";
import { resolveIntegrationPreviewUserMessage } from "@/lib/prototype/implementationIntegrationToastPolicy";
import { getIntegrationPreviewRemediationGuide } from "@/lib/prototype/integrationPreviewRemediationGuide";

describe("integrationPreviewUserMessage", () => {
  it("18-19. pages setup and admin permission toasts", () => {
    const pages = resolveIntegrationPreviewUserMessage({
      status: "github_pages_setup_required",
      remediationCode: "set_pages_source_actions",
    });
    expect(pages.toastMessage).toContain("GitHub Actions");
    expect(pages.toastMessage).not.toContain("gh-pages");

    const admin = resolveIntegrationPreviewUserMessage({
      status: "github_pages_setup_required",
      remediationCode: "add_pages_admin_permissions",
    });
    expect(admin.toastMessage).toContain("Pages");
    expect(admin.toastMessage).toContain("Administration");
  });

  it("manual setup guide uses GitHub Actions source", () => {
    const guide = getIntegrationPreviewRemediationGuide("github_pages_setup_required");
    expect(guide?.actionLines.join("\n")).toContain("GitHub Actions");
    expect(guide?.actionLines.join("\n")).not.toContain("gh-pages");
  });

  it("maps sample_data_required without GitHub Pages wording", () => {
    const msg = resolveIntegrationPreviewUserMessage({
      status: "sample_data_required",
      remediationCode: "sample_data_required",
    });
    expect(msg.toastMessage).toContain("샘플데이터");
    expect(msg.toastMessage).not.toMatch(/GitHub Actions|Pages 권한|gh-pages/i);
  });
});
