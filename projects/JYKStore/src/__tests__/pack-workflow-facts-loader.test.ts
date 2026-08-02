import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

describe("PackWorkflowFactsLoader batch structure", () => {
  it("exports batch + single loaders and avoids per-pack await loops", () => {
    const src = readFileSync(
      join(projectRoot, "src/lib/workflow/pack-workflow-facts-loader.ts"),
      "utf8",
    );
    assert.ok(src.includes("export async function batchLoadPackWorkflowFacts"));
    assert.ok(src.includes("export async function loadPackWorkflowFacts"));
    assert.ok(src.includes("batchResolveStoreWorkflowMarkers"));
    assert.ok(src.includes("Promise.all"));
    assert.ok(src.includes("groupBy"));
    assert.ok(
      !/for\s*\([^)]*of\s+packIds[^)]*\)\s*\{[^}]*await\s+loadPackWorkflowFacts/s.test(
        src,
      ),
    );
  });

  it("inbox APIs attach workflow summaries in batch", () => {
    const zipRoute = readFileSync(
      join(projectRoot, "src/app/api/v1/admin/worker-zip-requests/route.ts"),
      "utf8",
    );
    const reviewService = readFileSync(
      join(projectRoot, "src/lib/admin-review-service.ts"),
      "utf8",
    );
    assert.ok(zipRoute.includes("batchAttachInboxWorkflow"));
    assert.ok(zipRoute.includes("withInboxWorkflow"));
    assert.ok(reviewService.includes("batchAttachInboxWorkflow"));
  });
});
