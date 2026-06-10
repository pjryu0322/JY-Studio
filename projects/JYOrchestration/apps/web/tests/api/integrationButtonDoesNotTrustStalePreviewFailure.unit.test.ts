import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateIntegrationPipelineButtonFromSnapshot } from "@/lib/prototype/implementationIntegrationButtonPolicy";

const appDir = join(__dirname, "../../src");

describe("integrationButtonDoesNotTrustStalePreviewFailure", () => {
  it("11. previewDeploymentReady=false does not disable integration when autoGenerationReady", () => {
    const button = evaluateIntegrationPipelineButtonFromSnapshot(
      {
        codeTask: { selected: 2, completed: 2, failed: 0, inconsistent: 0 },
        integration: {
          finalWiringStatus: "pending",
          integrationBranchStatus: "pending",
          buildStatus: "pending",
          appPreviewTargetStatus: "pending",
        },
        preview: { integratedAppPreviewReady: false },
      } as never,
      { autoGenerationReady: true },
    );
    expect(button.enabled).toBe(true);
  });

  it("12. autoGenerationReady=false disables integration button", () => {
    const button = evaluateIntegrationPipelineButtonFromSnapshot(
      {
        codeTask: { selected: 2, completed: 2, failed: 0, inconsistent: 0 },
        integration: {
          finalWiringStatus: "pending",
          integrationBranchStatus: "pending",
          buildStatus: "pending",
          appPreviewTargetStatus: "pending",
        },
        preview: { integratedAppPreviewReady: false },
      } as never,
      { autoGenerationReady: false },
    );
    expect(button.enabled).toBe(false);
  });

  it("13. run-pipeline route does not gate on previewDeploymentReady", () => {
    const src = readFileSync(
      join(appDir, "app/api/prototype/integration/run-pipeline/route.ts"),
      "utf8",
    );
    expect(src).not.toContain("resolvePreviewDeploymentReadyFromCapabilityJson");
    expect(src).toContain("resolveAutoGenerationReadyFromCapabilityJson");
  });
});
