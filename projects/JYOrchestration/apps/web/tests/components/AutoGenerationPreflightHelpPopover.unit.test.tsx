import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsHelpPopoverContentView } from "@/components/settings/SettingsHelpPopover";
import { getGithubPreflightHelpContent } from "@/lib/prototype/githubProviderPreflightHelp";

describe("AutoGenerationPreflightHelpPopover", () => {
  it("shows owner/repo guidance for GitHub repository help", () => {
    const content = getGithubPreflightHelpContent("repo");
    const html = renderToStaticMarkup(createElement(SettingsHelpPopoverContentView, content));
    expect(html).toContain("GitHub 저장소 확인 방법");
    expect(html).toContain("owner/repo");
    expect(html).toContain("pjryu0322");
  });

  it("shows Actions/Workflows guidance for workflow dispatch help", () => {
    const content = getGithubPreflightHelpContent("actions_workflow_dispatch");
    const html = renderToStaticMarkup(createElement(SettingsHelpPopoverContentView, content));
    expect(html).toContain("GitHub Actions 실행 권한");
    expect(html).toContain("Actions");
    expect(html).toContain("Workflows");
  });

  it("shows Pages settings steps for pages_status_read help", () => {
    const content = getGithubPreflightHelpContent("pages_status_read");
    const html = renderToStaticMarkup(createElement(SettingsHelpPopoverContentView, content));
    expect(html).toContain("GitHub Pages 설정 방법");
    expect(html).toContain("Pages");
    expect(html).toContain("gh-pages");
  });

  it("does not expose raw API errors or full tokens in help content", () => {
    for (const key of ["repo", "token", "actions_workflow_dispatch", "pages_status_read"] as const) {
      const content = getGithubPreflightHelpContent(key);
      const serialized = JSON.stringify(content);
      expect(serialized).not.toMatch(/github_pat_/i);
      expect(serialized).not.toContain("Authorization");
      expect(serialized).not.toContain("stack trace");
    }
  });
});
