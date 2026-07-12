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
import { toKnowledgePackDto, type PrismaKnowledgePackWithVersion } from "../lib/pack-dto.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function versionRow(input: {
  id: string;
  version: string;
  createdAt: Date;
  visibility?: "PUBLIC" | "PRIVATE" | "UNLISTED";
}) {
  return {
    id: input.id,
    version: input.version,
    createdAt: input.createdAt,
    overview: `overview ${input.version}`,
    features: [],
    includedKnowledge: [],
    supportedEnvironments: [],
    targetUsers: [],
    useCases: [],
    versionSummary: `summary ${input.version}`,
    packId: "pack_hist",
    updatedAt: input.createdAt,
    ...(input.visibility
      ? {
          payload: { id: `pay_${input.id}`, validationStatus: "VALID" },
          distributionMetadata: {
            visibility: input.visibility,
            allowDownload: true,
          },
        }
      : {}),
  };
}

function packWithVersions(
  versions: ReturnType<typeof versionRow>[],
): PrismaKnowledgePackWithVersion {
  return {
    id: "cuid",
    packId: "pack_hist",
    name: "History Pack",
    categoryId: "api",
    providerName: "E2E",
    providerType: "COMMUNITY",
    providerProfileId: null,
    status: "PUBLISHED",
    pricing: "FREE",
    icon: "📦",
    shortDescription: "short",
    description: "desc",
    tags: [],
    rating: 0,
    usageCount: 0,
    isVerified: false,
    publishedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-03"),
    category: {
      id: "cat",
      categoryId: "api",
      name: "API",
      description: "api",
      icon: "🔌",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    versions: versions as PrismaKnowledgePackWithVersion["versions"],
  } as PrismaKnowledgePackWithVersion;
}

describe("My Packs version history", () => {
  it("DTO keeps full versionHistory while version uses latest label", () => {
    const dto = toKnowledgePackDto(
      packWithVersions([
        versionRow({
          id: "v3",
          version: "3.0.0",
          createdAt: new Date("2026-03-01"),
          visibility: "PUBLIC",
        }),
        versionRow({
          id: "v2",
          version: "2.0.0",
          createdAt: new Date("2026-02-01"),
          visibility: "PUBLIC",
        }),
        versionRow({
          id: "v1",
          version: "1.0.0",
          createdAt: new Date("2026-01-01"),
          visibility: "PUBLIC",
        }),
      ]),
    );

    assert.equal(dto.version, "3.0.0");
    assert.equal(dto.versionHistory.length, 3);
    assert.deepEqual(
      dto.versionHistory.map((entry) => entry.version),
      ["3.0.0", "2.0.0", "1.0.0"],
    );
  });

  it("visibility follows latest version only", () => {
    const previousPublicLatestPrivate = resolveLatestDistributionState(
      versionRow({
        id: "v3",
        version: "3.0.0",
        createdAt: new Date("2026-03-01"),
        visibility: "PRIVATE",
      }),
    );
    assert.equal(canShowInstalledPackInMyPacks(previousPublicLatestPrivate), false);
    assert.equal(canInstallLatestDistributionPack(previousPublicLatestPrivate), false);

    const previousPrivateLatestPublic = resolveLatestDistributionState(
      versionRow({
        id: "v3",
        version: "3.0.0",
        createdAt: new Date("2026-03-01"),
        visibility: "PUBLIC",
      }),
    );
    assert.equal(canShowInstalledPackInMyPacks(previousPrivateLatestPublic), true);

    const dto = toKnowledgePackDto(
      packWithVersions([
        versionRow({
          id: "v3",
          version: "3.0.0",
          createdAt: new Date("2026-03-01"),
          visibility: "PUBLIC",
        }),
        versionRow({
          id: "v2",
          version: "2.0.0",
          createdAt: new Date("2026-02-01"),
          visibility: "PRIVATE",
        }),
        versionRow({
          id: "v1",
          version: "1.0.0",
          createdAt: new Date("2026-01-01"),
          visibility: "PRIVATE",
        }),
      ]),
    );
    assert.equal(dto.versionHistory.length, 3);
  });

  it("my-packs service loads all versions without take: 1", () => {
    const service = readSource("src/lib/my-packs-service.ts");
    assert.ok(!/take:\s*1/.test(service));
    assert.ok(service.includes("distributionVersionAccessInclude"));
    assert.ok(service.includes("orderBy: latestKnowledgePackVersionOrderBy"));
  });
});
