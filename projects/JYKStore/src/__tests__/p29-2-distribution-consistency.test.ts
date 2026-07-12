import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  isLatestVersionCatalogVisible,
  resolveLatestDistributionState,
} from "../lib/distribution/latest-distribution-state.ts";
import { detectSubmitSnapshotDrift } from "../lib/admin-review-decision.ts";
import type { AdminReviewDetailDto } from "../lib/admin-review-dto.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("P29.2 distribution consistency", () => {
  it("latest version visibility hides previous PUBLIC when latest is PRIVATE", () => {
    const latest = resolveLatestDistributionState({
      payload: { id: "pay_1", validationStatus: "VALID" },
      distributionMetadata: { visibility: "PRIVATE", allowDownload: true },
    });
    assert.equal(isLatestVersionCatalogVisible(latest, "list"), false);
    assert.equal(isLatestVersionCatalogVisible(latest, "detail"), false);
  });

  it("UNLISTED is detail-only", () => {
    const latest = resolveLatestDistributionState({
      payload: { id: "pay_1", validationStatus: "VALID" },
      distributionMetadata: { visibility: "UNLISTED", allowDownload: true },
    });
    assert.equal(isLatestVersionCatalogVisible(latest, "list"), false);
    assert.equal(isLatestVersionCatalogVisible(latest, "detail"), true);
  });

  it("detects distribution fingerprint and visibility drift", () => {
    const detail = {
      pack: { status: "REVIEWING" },
      versions: [{ id: "ver-1" }],
      payload: {
        id: "pay-1",
        profile: "docling-chunks-v1",
        checksumSha256: "a".repeat(64),
        validationStatus: "VALID",
      },
      currentManifestFingerprint: "fp-current",
      distribution: {
        visibility: "PUBLIC",
        allowDownload: true,
        sourceTitle: "Docs",
        licenseName: "MIT",
      },
      latestReview: {
        submitSnapshot: {
          mode: "DISTRIBUTION",
          submittedAt: "2026-07-12T00:00:00.000Z",
          submittedVersionId: "ver-1",
          payloadId: "pay-1",
          payloadProfile: "docling-chunks-v1",
          checksumSha256: "a".repeat(64),
          validationStatus: "VALID",
          manifestSchemaVersion: "jyk-distribution-0.2",
          manifestFingerprint: "fp-old",
          sourceTitle: "Docs",
          licenseName: "MIT",
          visibility: "PRIVATE",
          allowDownload: true,
        },
      },
    } as unknown as AdminReviewDetailDto;

    const drift = detectSubmitSnapshotDrift(detail);
    assert.equal(drift.changed, true);
    assert.ok(drift.reasons.some((r) => /Manifest/.test(r)));
    assert.ok(drift.reasons.some((r) => /공개범위/.test(r)));
  });

  it("provider payload tab exposes new version CTA", () => {
    const ui = readSource("src/components/provider-distribution/ProviderPayloadTab.tsx");
    assert.ok(ui.includes("보완용 새 버전 생성"));
    assert.ok(ui.includes("createProviderPackVersionApi"));
    const api = readSource("src/lib/provider-center-api.ts");
    assert.ok(api.includes("createProviderPackVersionApi"));
  });

  it("anonymous quota has no hardcoded fallback secret", () => {
    const quota = readSource("src/lib/distribution/payload-download-quota.ts");
    assert.ok(!quota.includes("jykstore-anonymous-fallback"));
    assert.ok(!quota.includes("JYKSTORE_API_KEY_SECRET"));
    assert.ok(quota.includes("PAYLOAD_DOWNLOAD_IDENTITY_NOT_CONFIGURED"));
  });
});
