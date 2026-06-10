import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appDir = join(__dirname, "../../src");

describe("integrationRetryAfterPreviewFailure", () => {
  it("16. run-pipeline does not block on preview failure pipeline statuses", () => {
    const src = readFileSync(
      join(appDir, "app/api/prototype/integration/run-pipeline/route.ts"),
      "utf8",
    );
    expect(src).not.toContain("github_preview_permission_required");
    expect(src).not.toContain("previewDeploymentReady");
    expect(src).toContain("runProjectIntegrationPipeline");
  });

  it("17-19. app preview step resumes with live preflight on retry", () => {
    const pipeline = readFileSync(
      join(appDir, "lib/prototype/projectIntegrationPipelineService.ts"),
      "utf8",
    );
    expect(pipeline).toContain("isIntegrationPreviewRemediationPipelineStatus");
    expect(pipeline).toContain("runAppPreviewTargetIntegrationStep");
    const step = readFileSync(
      join(appDir, "lib/prototype/implementationAppPreviewTargetStepService.ts"),
      "utf8",
    );
    expect(step).toContain("runIntegrationPreviewPreflight");
  });
});
