import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  canInstallLatestDistributionPack,
  canShowInstalledPackInMyPacks,
  resolveLatestDistributionState,
} from "../lib/distribution/latest-distribution-state.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function complete(visibility: "PUBLIC" | "PRIVATE" | "UNLISTED") {
  return {
    distributionMetadata: { visibility, allowDownload: true },
    doclingImportBundles: [
      {
        id: "b1",
        isActive: true,
        status: "REVIEW_READY",
        storageStatus: "ACTIVE",
        deletedAt: null,
        adapterType: "DOCLING",
        normalizedDocuments: [{ id: "nd1", isActive: true }],
      },
    ],
  };
}

describe("My Packs distribution visibility", () => {
  it("allows Legacy, PUBLIC, UNLISTED installs and blocks PRIVATE", () => {
    assert.equal(canInstallLatestDistributionPack(resolveLatestDistributionState(null)), true);
    assert.equal(
      canInstallLatestDistributionPack(resolveLatestDistributionState(complete("PUBLIC"))),
      true,
    );
    assert.equal(
      canInstallLatestDistributionPack(resolveLatestDistributionState(complete("UNLISTED"))),
      true,
    );
    assert.equal(
      canInstallLatestDistributionPack(resolveLatestDistributionState(complete("PRIVATE"))),
      false,
    );
  });

  it("hides installed PRIVATE packs from My Packs list but keeps UNLISTED", () => {
    assert.equal(
      canShowInstalledPackInMyPacks(resolveLatestDistributionState(complete("PRIVATE"))),
      false,
    );
    assert.equal(
      canShowInstalledPackInMyPacks(resolveLatestDistributionState(complete("UNLISTED"))),
      true,
    );
  });

  it("service enforces NOT_INSTALLABLE and filters list by latest visibility", () => {
    const service = readSource("src/lib/my-packs-service.ts");
    assert.ok(service.includes("canInstallLatestDistributionPack"));
    assert.ok(service.includes("NOT_INSTALLABLE"));
    assert.ok(service.includes("canShowInstalledPackInMyPacks"));
    assert.ok(service.includes("distributionVersionAccessInclude"));
    const route = readSource("src/app/api/v1/my-packs/route.ts");
    assert.ok(route.includes("NOT_INSTALLABLE"));
    assert.ok(route.includes("설치 가능한 지식팩을 찾을 수 없습니다."));
  });
});
