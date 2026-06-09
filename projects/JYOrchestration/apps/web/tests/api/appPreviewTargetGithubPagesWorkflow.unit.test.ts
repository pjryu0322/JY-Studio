import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const deployPath = join(
  __dirname,
  "../../src/lib/prototype/githubPagesPreviewDeploymentService.ts",
);
const stepPath = join(
  __dirname,
  "../../src/lib/prototype/implementationAppPreviewTargetStepService.ts",
);

describe("app preview target GitHub Pages workflow", () => {
  it("16–17. deploy tries scaffold/workflow before static_artifact_missing fail", () => {
    const deploySrc = readFileSync(deployPath, "utf8");
    expect(deploySrc).toContain("resolveStaticAppBuildContract");
    expect(deploySrc).toContain("ensureStaticAppBuildContractOnIntegrationBranch");
    expect(deploySrc).toContain("dispatchGithubPagesPreviewWorkflow");
    expect(deploySrc).toContain("github_pages_deploy_pending");
    expect(deploySrc.indexOf("resolveStaticAppBuildContract")).toBeLessThan(
      deploySrc.indexOf('pipelineStatus: "static_preview_artifact_missing"'),
    );
  });

  it("18. preview step handles github_pages_deploy_pending", () => {
    const stepSrc = readFileSync(stepPath, "utf8");
    expect(stepSrc).toContain("github_pages_deploy_pending");
    expect(stepSrc).toContain('status: "pending"');
  });
});
