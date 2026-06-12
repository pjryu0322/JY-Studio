import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildGithubPagesPreviewPath,
  computeGithubPagesPreviewUrl,
  DEFAULT_GITHUB_PAGES_BRANCH,
} from "@/lib/prototype/githubPagesPreviewDeployment";

const __dirname = dirname(fileURLToPath(import.meta.url));
const deployServicePath = join(
  __dirname,
  "../../src/lib/prototype/githubPagesPreviewDeploymentService.ts",
);
const stepServicePath = join(
  __dirname,
  "../../src/lib/prototype/implementationAppPreviewTargetStepService.ts",
);
const pipelinePath = join(
  __dirname,
  "../../src/lib/prototype/projectIntegrationPipelineService.ts",
);

describe("P3-Runtime-Core-05 GitHub Pages preview deployment", () => {
  it("6. computes githubPagesUrl from owner/repo/projectId", () => {
    const url = computeGithubPagesPreviewUrl({
      owner: "pjryu0322",
      repo: "aiprogect",
      projectId: "cmphxk7y10015unj0wjms1uch",
    });
    expect(url).toBe(
      "https://pjryu0322.github.io/aiprogect/previews/cmphxk7y10015unj0wjms1uch/",
    );
  });

  it("uses gh-pages branch and previews path by default", () => {
    expect(DEFAULT_GITHUB_PAGES_BRANCH).toBe("gh-pages");
    expect(buildGithubPagesPreviewPath("abc")).toBe("previews/abc/");
  });

  it("deployment service exposes deployIntegratedPreviewToGitHubPages and timeline actions", () => {
    const src = readFileSync(deployServicePath, "utf8");
    expect(src).toContain("deployIntegratedPreviewToGitHubPages");
    expect(src).toContain("github_pages_preview_deploy_started");
    expect(src).toContain("github_pages_preview_deployed");
    expect(src).toContain("runJyoPreviewPagesWorkflowDeploy");
    expect(src).not.toMatch(/Authorization:\s*`Bearer\s+\$\{input\.githubToken/);
    expect(src).toContain("preview_deploy_build_only");
    expect(src).toContain("legacy_preview_sample_wiring_skipped");
    expect(src).toContain("isLegacyPreviewSampleWiringEnabled");
  });

  it("app preview step invokes GitHub Pages deploy when branch-only", () => {
    const src = readFileSync(stepServicePath, "utf8");
    expect(src).toContain("deployIntegratedPreviewToGitHubPages");
    expect(src).not.toContain("buildPreviewFromCompletedCodeTasks");
  });

  it("pipeline maps static and pages-not-configured statuses", () => {
    const src = readFileSync(pipelinePath, "utf8");
    expect(src).toContain("static_preview_artifact_missing");
    expect(src).toContain("github_pages_not_configured");
    expect(src).toContain("configure_github_pages");
    expect(src).toContain("generate_static_artifact");
    expect(src).toContain("await runAppPreviewTargetIntegrationStep");
  });
});
