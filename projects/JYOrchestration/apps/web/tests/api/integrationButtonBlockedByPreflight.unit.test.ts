import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("integrationButtonBlockedByPreflight", () => {
  it("run-pipeline route no longer blocks on previewDeploymentReady", () => {
    const routePath = join(
      process.cwd(),
      "src/app/api/prototype/integration/run-pipeline/route.ts",
    );
    const src = readFileSync(routePath, "utf8");
    expect(src).not.toContain("resolvePreviewDeploymentReadyFromCapabilityJson");
    expect(src).not.toContain("Preview 배포 사전점검을 완료");
  });
});
