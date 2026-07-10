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

describe("provider final review submit version scope", () => {
  it("uses latest version only for source docs and active chunks", () => {
    const service = readSource("src/lib/auto-pipeline/provider-final-review-submit-service.ts");
    const snapshot = readSource("src/lib/provider-review-submit-snapshot.ts");

    assert.ok(service.includes("const submittedVersion = pack.versions[0]"));
    assert.ok(service.includes("submittedVersion.sourceDocuments.map"));
    assert.ok(service.includes("versionId: submittedVersionId"));
    assert.ok(!service.includes("pack.versions.flatMap"));
    assert.ok(snapshot.includes("submittedVersionId: string"));
    assert.ok(snapshot.includes("submittedVersionId: input.submittedVersionId"));
  });
});
