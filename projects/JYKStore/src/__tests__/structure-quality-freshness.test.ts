import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeStructureQualityFreshness } from "@/lib/structure-quality/structure-quality-freshness";

const versionId = "ver-1";
const templateKey = "GENERIC_PRODUCT";
const checkedAt = "2026-01-01T00:00:00.000Z";

function baseReports() {
  return {
    latestVersionId: versionId,
    coverageReport: {
      versionId,
      templateKey,
      checkedAt,
    },
    qualityReport: {
      versionId,
      checkedAt,
    },
    latestSourceDocumentUpdatedAt: "2025-12-31T23:59:00.000Z",
    latestSourceValidationCheckedAt: "2025-12-31T23:59:00.000Z",
    currentTemplateKey: templateKey,
  };
}

describe("computeStructureQualityFreshness", () => {
  it("returns MISSING when reports are absent", () => {
    const result = computeStructureQualityFreshness({
      ...baseReports(),
      coverageReport: null,
      qualityReport: null,
    });
    assert.equal(result.status, "MISSING");
    assert.equal(result.reasonCode, "MISSING_REPORT");
  });

  it("returns STALE on versionId mismatch", () => {
    const result = computeStructureQualityFreshness({
      ...baseReports(),
      latestVersionId: "ver-new",
    });
    assert.equal(result.status, "STALE");
    assert.equal(result.reasonCode, "VERSION_MISMATCH");
  });

  it("returns STALE when source document updated after report checkedAt", () => {
    const result = computeStructureQualityFreshness({
      ...baseReports(),
      latestSourceDocumentUpdatedAt: "2026-01-01T00:00:02.000Z",
    });
    assert.equal(result.status, "STALE");
    assert.equal(result.reasonCode, "SOURCE_CHANGED");
  });

  it("returns STALE when source validation checked after report checkedAt", () => {
    const result = computeStructureQualityFreshness({
      ...baseReports(),
      latestSourceValidationCheckedAt: "2026-01-01T00:00:02.000Z",
    });
    assert.equal(result.status, "STALE");
    assert.equal(result.reasonCode, "VALIDATION_CHANGED");
  });

  it("returns STALE when templateKey does not match current template", () => {
    const result = computeStructureQualityFreshness({
      ...baseReports(),
      currentTemplateKey: "AUTH_INTEGRATION",
    });
    assert.equal(result.status, "STALE");
    assert.equal(result.reasonCode, "TEMPLATE_CHANGED");
  });

  it("returns CURRENT when all criteria match", () => {
    const result = computeStructureQualityFreshness(baseReports());
    assert.equal(result.status, "CURRENT");
    assert.equal(result.reasonCode, null);
  });
});
