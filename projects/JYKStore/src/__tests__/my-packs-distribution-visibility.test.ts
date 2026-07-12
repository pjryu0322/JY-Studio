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

describe("My Packs distribution visibility", () => {
  it("allows Legacy, PUBLIC, UNLISTED installs and blocks PRIVATE", () => {
    assert.equal(canInstallLatestDistributionPack(resolveLatestDistributionState(null)), true);
    assert.equal(
      canInstallLatestDistributionPack(
        resolveLatestDistributionState({ distributionMetadata: { visibility: "PUBLIC" } }),
      ),
      true,
    );
    assert.equal(
      canInstallLatestDistributionPack(
        resolveLatestDistributionState({ distributionMetadata: { visibility: "UNLISTED" } }),
      ),
      true,
    );
    assert.equal(
      canInstallLatestDistributionPack(
        resolveLatestDistributionState({ distributionMetadata: { visibility: "PRIVATE" } }),
      ),
      false,
    );
  });

  it("hides installed PRIVATE packs from My Packs list but keeps UNLISTED", () => {
    assert.equal(
      canShowInstalledPackInMyPacks(
        resolveLatestDistributionState({ distributionMetadata: { visibility: "PRIVATE" } }),
      ),
      false,
    );
    assert.equal(
      canShowInstalledPackInMyPacks(
        resolveLatestDistributionState({ distributionMetadata: { visibility: "UNLISTED" } }),
      ),
      true,
    );
  });

  it("service enforces NOT_INSTALLABLE and filters list by latest visibility", () => {
    const service = readSource("src/lib/my-packs-service.ts");
    assert.ok(service.includes("canInstallLatestDistributionPack"));
    assert.ok(service.includes("NOT_INSTALLABLE"));
    assert.ok(service.includes("canShowInstalledPackInMyPacks"));
    assert.ok(service.includes("distributionMetadata: true"));
    const route = readSource("src/app/api/v1/my-packs/route.ts");
    assert.ok(route.includes("NOT_INSTALLABLE"));
    assert.ok(route.includes("설치 가능한 지식팩을 찾을 수 없습니다."));
  });
});
