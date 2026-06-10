import { describe, expect, it } from "vitest";
import {
  GITHUB_PAGES_ACTIONS_SOURCE_USER_MESSAGE,
  parseGitHubPagesSourceModeFromApiResponse,
  resolvePagesSourcePreflightForIntegration,
} from "@/lib/prototype/githubPagesSetupProbeService";

describe("githubPagesSourceMode", () => {
  it("11. Pages Source actions is accepted", () => {
    const r = parseGitHubPagesSourceModeFromApiResponse({
      httpStatus: 200,
      body: { build_type: "workflow", source: { branch: "main", path: "/" } },
    });
    expect(r.mode).toBe("actions");
    expect(r.preflightStatus).toBe("passed");
  });

  it("12. disabled returns setup required with GitHub Actions guidance", () => {
    const r = parseGitHubPagesSourceModeFromApiResponse({ httpStatus: 404, body: null });
    expect(r.mode).toBe("disabled");
    expect(r.userSafeMessage).toContain("GitHub Actions");
    const integration = resolvePagesSourcePreflightForIntegration("disabled", {
      disabled: GITHUB_PAGES_ACTIONS_SOURCE_USER_MESSAGE,
      branch: "branch",
      unknown: "unknown",
    });
    expect(integration.status).toBe("failed");
    expect(integration.userSafeMessage).toContain("Source를 GitHub Actions");
  });

  it("13. branch source returns guidance to switch to GitHub Actions", () => {
    const r = parseGitHubPagesSourceModeFromApiResponse({
      httpStatus: 200,
      body: { build_type: "legacy", source: { branch: "gh-pages", path: "/" } },
    });
    expect(r.mode).toBe("branch");
    expect(r.userSafeMessage).toContain("GitHub Actions");
  });
});
