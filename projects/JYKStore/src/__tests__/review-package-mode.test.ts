import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { resolveReviewPackageMode } from "../lib/review/review-package-mode.ts";

const projectRoot = join(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(join(projectRoot, relative), "utf8");
}

describe("review-package-mode", () => {
  it("resolves DISTRIBUTION_ZIP for DISTRIBUTION snapshots", () => {
    assert.equal(
      resolveReviewPackageMode({ mode: "DISTRIBUTION" }),
      "DISTRIBUTION_ZIP",
    );
  });

  it("resolves DOCLING_BUNDLE for Docling snapshots", () => {
    assert.equal(
      resolveReviewPackageMode({ mode: "DOCLING_BUNDLE" }),
      "DOCLING_BUNDLE",
    );
  });

  it("defaults to LEGACY_BUILDER", () => {
    assert.equal(resolveReviewPackageMode(null), "LEGACY_BUILDER");
    assert.equal(resolveReviewPackageMode({}), "LEGACY_BUILDER");
    assert.equal(
      resolveReviewPackageMode({
        submittedAt: "2026-01-01T00:00:00.000Z",
      } as { mode?: string }),
      "LEGACY_BUILDER",
    );
  });

  it("approvePackReview branches by package mode and skips release gate for Docling", () => {
    const service = read("src/lib/admin-review-service.ts");
    assert.ok(service.includes("resolveReviewPackageMode"));
    assert.ok(service.includes("DOCLING_BUNDLE"));
    assert.ok(service.includes("DISTRIBUTION_ZIP"));
    assert.ok(service.includes("LEGACY_BUILDER"));
    assert.ok(!service.includes("const isDistributionPack = Boolean(detailBefore.payload)"));

    const approveIdx = service.indexOf("export async function approvePackReview");
    const gateIdx = service.indexOf("evaluateReleaseGateForPack", approveIdx);
    const modeDoclingIdx = service.indexOf('packageMode === "DOCLING_BUNDLE"', approveIdx);
    assert.ok(approveIdx >= 0);
    assert.ok(modeDoclingIdx > approveIdx);
    assert.ok(gateIdx > modeDoclingIdx, "release gate must run only after Docling branch");
  });

  it("getAdminReviewDetail skips release-gate enrichment for Docling snapshots", () => {
    const service = read("src/lib/admin-review-service.ts");
    assert.ok(service.includes("isDoclingBundleReviewSnapshot(snapshot)"));
    const detailFn = service.indexOf("export async function getAdminReviewDetail");
    const doclingEarly =
      service.indexOf("isDoclingBundleReviewSnapshot(snapshot)", detailFn) >= 0;
    assert.ok(doclingEarly);
  });
});
