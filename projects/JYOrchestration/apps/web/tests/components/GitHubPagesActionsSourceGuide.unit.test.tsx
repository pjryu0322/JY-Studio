import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IntegrationPreviewRemediationPanel } from "@/components/preview/IntegrationPreviewRemediationPanel";
import { getIntegrationPreviewRemediationGuide } from "@/lib/prototype/integrationPreviewRemediationGuide";

describe("GitHubPagesActionsSourceGuide", () => {
  it("16-19. remediation guide uses GitHub Actions source wording", () => {
    const guide = getIntegrationPreviewRemediationGuide("github_pages_setup_required");
    expect(guide?.actionLines.join("\n")).toContain("GitHub Actions");
    expect(guide?.actionLines.join("\n")).not.toContain("gh-pages");
    expect(guide?.actionLines.join("\n")).not.toMatch(/integration\//);
    expect(guide?.actionLines.join("\n")).not.toMatch(/\bdist\b|\bout\b|\bbuild\b/);
  });

  it("integration preflight user message avoids gh-pages branch", () => {
    const src = readFileSync(
      join(__dirname, "../../src/lib/prototype/integrationPreviewPreflightService.ts"),
      "utf8",
    );
    expect(src).toContain("Source를 GitHub Actions");
    expect(src).not.toContain("gh-pages branch");
  });

  it("pages setup panel renders without gh-pages in markup", () => {
    const html = renderToStaticMarkup(
      createElement(IntegrationPreviewRemediationPanel, {
        pipelineStatus: "github_pages_setup_required",
        gitRepoUrl: "https://github.com/o/r",
      }),
    );
    expect(html.toLowerCase()).not.toContain("gh-pages");
    expect(html).toContain("GitHub Pages");
  });
});
