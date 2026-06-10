import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getIntegrationPreviewRemediationGuide } from "@/lib/prototype/integrationPreviewRemediationGuide";

describe("GitHubPagesAutoConfigureGuide", () => {
  it("17-18. permission vs manual setup guides", () => {
    const admin = getIntegrationPreviewRemediationGuide("github_pages_setup_required", {
      remediationCode: "add_pages_admin_permissions",
    });
    expect(admin?.actionLines.join("\n")).toContain("Pages");
    expect(admin?.actionLines.join("\n")).toContain("Administration");
    expect(admin?.actionLines.join("\n")).not.toContain("gh-pages");

    const manual = getIntegrationPreviewRemediationGuide("github_pages_setup_required");
    expect(manual?.actionLines.join("\n")).toContain("GitHub Actions");
    expect(manual?.actionLines.join("\n")).not.toContain("gh-pages");
  });

  it("14-16. preflight tries auto configure before user action", () => {
    const src = readFileSync(
      join(__dirname, "../../src/lib/prototype/integrationPreviewPreflightService.ts"),
      "utf8",
    );
    expect(src).toContain("tryAutoConfigureGitHubPagesActionsSource");
    expect(src).toContain("ensureGitHubPagesActionsSource");
    expect(src).not.toContain("gh-pages branch");
  });

  it("deploy service calls ensureGitHubPagesActionsSource", () => {
    const src = readFileSync(
      join(__dirname, "../../src/lib/prototype/githubPagesPreviewDeploymentService.ts"),
      "utf8",
    );
    expect(src).toContain("ensureGitHubPagesActionsSource");
    expect(src).not.toContain("ensureGhPagesBranchHead");
  });
});
