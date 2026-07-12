import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("provider release gate primary action", () => {
  it("does not mount inspection release-gate Builder CTAs after freeze", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    const review = readSource("src/components/ProviderPackReviewTab.tsx");
    const releaseGateRoute = readSource(
      "src/app/api/v1/provider/packs/[packId]/release-gate/evaluate/route.ts",
    );

    assert.ok(!editor.includes("ProviderPackInspectionTab"));
    assert.ok(!review.includes("evaluateProviderReleaseGateApi"));
    assert.ok(!review.includes("RUN_RELEASE_GATE"));
    assert.ok(releaseGateRoute.includes("legacyBuilderDisabledBody"));
    assert.ok(releaseGateRoute.includes("status: 410"));
  });
});
