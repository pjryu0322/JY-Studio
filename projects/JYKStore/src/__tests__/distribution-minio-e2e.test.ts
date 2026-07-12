/**
 * Real Distribution E2E against PostgreSQL + MinIO.
 *
 * Requires:
 *   JYKSTORE_RUN_DISTRIBUTION_E2E=1
 *   DATABASE_URL
 *   JYKSTORE_PAYLOAD_S3_* (endpoint, bucket, keys, …)
 *   JYKSTORE_ANONYMOUS_ID_SECRET
 *   JYKSTORE_TRUST_PROXY=true
 *
 * Prefer: npm run test:distribution-e2e:full
 * Without the flag this suite is SKIPPED (never reported as PASS).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, it } from "node:test";
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { PackStatus } from "@prisma/client";

import { acceptPackReview, approvePackReview } from "../lib/admin-review-service.ts";
import { DISTRIBUTION_MANIFEST_SCHEMA_VERSION } from "../lib/distribution/payload-types.ts";
import { upsertProviderPackDistribution } from "../lib/distribution/distribution-metadata-service.ts";
import { isPayloadServiceError } from "../lib/distribution/payload-errors.ts";
import {
  readPublicCatalogPayloadBytes,
  uploadProviderPackPayload,
} from "../lib/distribution/payload-service.ts";
import {
  getConfiguredPayloadStorage,
  resetPayloadStorageCache,
} from "../lib/distribution/payload-storage-factory.ts";
import {
  probePayloadObjectStorage,
  S3PayloadStorage,
} from "../lib/distribution/s3-payload-storage.ts";
import { sha256Hex } from "../lib/distribution/payload-checksum.ts";
import {
  addPackInstallationForClient,
  listActiveMyPacksForClient,
} from "../lib/my-packs-service.ts";
import {
  getPublishedPackById,
  listPublishedPacks,
} from "../lib/pack-catalog-service.ts";
import { prisma } from "../lib/prisma.ts";
import {
  createProviderPackForClient,
  createProviderPackVersionForClient,
  submitProviderPackForReview,
} from "../lib/provider-pack-service.ts";
import { ensureProviderProfileForAccount } from "../lib/provider-profile-service.ts";
import { GET as publicPayloadDownloadGET } from "../app/api/v1/packs/[packId]/payload/download/route.ts";
import { assertSafeE2ETargets } from "../../test/distribution-e2e-safety.mjs";

const runE2E =
  process.env.JYKSTORE_RUN_DISTRIBUTION_E2E === "1" &&
  Boolean(process.env.DATABASE_URL?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_ENDPOINT?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_BUCKET?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY?.trim()) &&
  Boolean(process.env.JYKSTORE_ANONYMOUS_ID_SECRET?.trim());

if (runE2E) {
  assertSafeE2ETargets(process.env);
}

const CATEGORY_ID = "e2e-dist-api";
const runId = `e2e${Date.now().toString(36)}`;

type Actors = {
  providerUserId: string;
  providerClientId: string;
  adminUserId: string;
  adminClientId: string;
  consumerClientId: string;
  userIds: string[];
  packIds: string[];
};

const actors: Actors = {
  providerUserId: "",
  providerClientId: `e2e-prov-${runId}`,
  adminUserId: "",
  adminClientId: `e2e-adm-${runId}`,
  consumerClientId: `e2e-usr-${runId}`,
  userIds: [],
  packIds: [],
};

async function buildDoclingZip(label: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "payload/chunks.jsonl",
    [
      JSON.stringify({ text: `E2E ${label} chunk alpha about distribution payloads` }),
      JSON.stringify({ text: `E2E ${label} chunk beta for MinIO verification` }),
      "",
    ].join("\n"),
  );
  return zip.generateAsync({ type: "uint8array" });
}

async function cleanupPack(packId: string) {
  const payloads = await prisma.knowledgePayload.findMany({
    where: { packId },
    select: { storagePath: true },
  });
  try {
    const storage = getConfiguredPayloadStorage();
    for (const row of payloads) {
      try {
        await storage.delete({ objectKey: row.storagePath });
      } catch {
        // best-effort MinIO cleanup
      }
    }
  } catch {
    // storage may be unavailable during teardown
  }

  await prisma.apiUsageLog.deleteMany({ where: { packId } });
  await prisma.knowledgePayload.deleteMany({ where: { packId } });
  await prisma.packDistributionMetadata.deleteMany({ where: { packId } });
  await prisma.knowledgePack.deleteMany({ where: { packId } });
}

async function publishDistributionPack(input: {
  name: string;
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  version?: string;
  packId?: string;
}): Promise<{
  packId: string;
  checksumSha256: string;
  objectKey: string;
  zipBytes: Uint8Array;
  versionId: string;
}> {
  const created = await createProviderPackForClient(
    actors.providerUserId,
    actors.providerClientId,
    {
      name: input.name,
      categoryId: CATEGORY_ID,
      description: `${input.name} — Distribution E2E pack for visibility ${input.visibility}`,
      shortDescription: `${input.name} e2e`,
      tags: ["e2e", "distribution"],
      version: input.version ?? "1.0.0",
      packId: input.packId,
    },
  );
  if ("error" in created) {
    throw new Error(`createProviderPackForClient failed: ${JSON.stringify(created)}`);
  }
  const packId = created.pack.packId;
  actors.packIds.push(packId);

  const zipBytes = await buildDoclingZip(`${input.visibility}-${packId}`);
  const uploaded = await uploadProviderPackPayload({
    userId: actors.providerUserId,
    clientId: actors.providerClientId,
    packId,
    fileName: "e2e-docling.zip",
    mimeType: "application/zip",
    bytes: zipBytes,
    profile: "docling-chunks-v1",
  });

  await upsertProviderPackDistribution({
    userId: actors.providerUserId,
    clientId: actors.providerClientId,
    packId,
    body: {
      sourceTitle: "E2E Distribution Source",
      sourceUrl: "https://example.com/e2e-source",
      licenseName: "MIT",
      usageTerms: "E2E only",
      visibility: input.visibility,
      allowDownload: true,
    },
  });

  const payloadRow = await prisma.knowledgePayload.findUnique({
    where: { id: uploaded.payload.id },
  });
  assert.ok(payloadRow);
  assert.equal(payloadRow.validationStatus, "VALID");
  assert.ok(payloadRow.manifestJson);
  const manifest = payloadRow.manifestJson as { schemaVersion?: string };
  assert.equal(manifest.schemaVersion, DISTRIBUTION_MANIFEST_SCHEMA_VERSION);

  const storage = getConfiguredPayloadStorage();
  const head = await storage.head({ objectKey: payloadRow.storagePath });
  assert.equal(head.exists, true);
  assert.equal(head.checksumSha256Metadata, payloadRow.checksumSha256);

  const submitted = await submitProviderPackForReview(
    actors.providerUserId,
    actors.providerClientId,
    packId,
  );
  if ("error" in submitted) {
    throw new Error(`submit failed: ${JSON.stringify(submitted)}`);
  }

  const packAfterSubmit = await prisma.knowledgePack.findUnique({ where: { packId } });
  assert.equal(packAfterSubmit?.status, PackStatus.REVIEWING);

  const accepted = await acceptPackReview({
    packId,
    reviewerClientId: actors.adminClientId,
    reviewerUserId: actors.adminUserId,
  });
  if ("error" in accepted) {
    throw new Error(`accept failed: ${JSON.stringify(accepted)}`);
  }

  const approved = await approvePackReview({
    packId,
    reviewerClientId: actors.adminClientId,
    reviewerUserId: actors.adminUserId,
  });
  if ("error" in approved) {
    throw new Error(`approve failed: ${JSON.stringify(approved)}`);
  }

  const published = await prisma.knowledgePack.findUnique({ where: { packId } });
  assert.ok(
    published?.status === PackStatus.PUBLISHED || published?.status === PackStatus.VERIFIED,
  );

  return {
    packId,
    checksumSha256: payloadRow.checksumSha256,
    objectKey: payloadRow.storagePath,
    zipBytes,
    versionId: uploaded.payload.versionId,
  };
}

async function reopenAsDraftAndPublishLatestVersion(input: {
  packId: string;
  version: string;
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
}) {
  await prisma.knowledgePack.update({
    where: { packId: input.packId },
    data: { status: PackStatus.DRAFT },
  });

  const versioned = await createProviderPackVersionForClient(
    actors.providerUserId,
    actors.providerClientId,
    input.packId,
    { version: input.version },
  );
  if ("error" in versioned) {
    throw new Error(`create version failed: ${JSON.stringify(versioned)}`);
  }

  const zipBytes = await buildDoclingZip(`${input.visibility}-${input.version}`);
  const uploaded = await uploadProviderPackPayload({
    userId: actors.providerUserId,
    clientId: actors.providerClientId,
    packId: input.packId,
    fileName: "e2e-docling-v2.zip",
    mimeType: "application/zip",
    bytes: zipBytes,
    profile: "docling-chunks-v1",
  });

  await upsertProviderPackDistribution({
    userId: actors.providerUserId,
    clientId: actors.providerClientId,
    packId: input.packId,
    body: {
      sourceTitle: "E2E Distribution Source v2",
      licenseName: "MIT",
      visibility: input.visibility,
      allowDownload: true,
    },
  });

  const submitted = await submitProviderPackForReview(
    actors.providerUserId,
    actors.providerClientId,
    input.packId,
  );
  if ("error" in submitted) {
    throw new Error(`resubmit failed: ${JSON.stringify(submitted)}`);
  }

  const accepted = await acceptPackReview({
    packId: input.packId,
    reviewerClientId: actors.adminClientId,
    reviewerUserId: actors.adminUserId,
  });
  if ("error" in accepted) {
    throw new Error(`re-accept failed: ${JSON.stringify(accepted)}`);
  }

  const approved = await approvePackReview({
    packId: input.packId,
    reviewerClientId: actors.adminClientId,
    reviewerUserId: actors.adminUserId,
  });
  if ("error" in approved) {
    throw new Error(`re-approve failed: ${JSON.stringify(approved)}`);
  }

  return { checksumSha256: uploaded.payload.checksumSha256, zipBytes };
}

describe("Distribution MinIO E2E", { skip: !runE2E }, () => {
  before(async () => {
    assertSafeE2ETargets(process.env);
    process.env.JYKSTORE_PAYLOAD_STORAGE_DRIVER = "s3";
    process.env.JYKSTORE_TRUST_PROXY = process.env.JYKSTORE_TRUST_PROXY || "true";
    resetPayloadStorageCache();

    await prisma.$connect();
    const probe = await probePayloadObjectStorage();
    assert.equal(probe.ok, true, `MinIO probe failed: ${probe.errors.join("; ")}`);

    await prisma.packCategory.upsert({
      where: { categoryId: CATEGORY_ID },
      create: {
        categoryId: CATEGORY_ID,
        name: "E2E Distribution",
        description: "Category for Distribution E2E",
        icon: "🧪",
      },
      update: { name: "E2E Distribution" },
    });

    const provider = await prisma.user.create({
      data: {
        email: `provider-${runId}@e2e.local`,
        name: "E2E Provider",
        accountRole: "PROVIDER",
      },
    });
    const admin = await prisma.user.create({
      data: {
        email: `admin-${runId}@e2e.local`,
        name: "E2E Admin",
        accountRole: "ADMIN",
      },
    });
    actors.providerUserId = provider.id;
    actors.adminUserId = admin.id;
    actors.userIds.push(provider.id, admin.id);

    const ensured = await ensureProviderProfileForAccount({
      userId: provider.id,
      clientId: actors.providerClientId,
    });
    assert.equal(ensured.ok, true);
  });

  after(async () => {
    for (const packId of [...actors.packIds].reverse()) {
      try {
        await cleanupPack(packId);
      } catch (error) {
        console.warn(`cleanup pack ${packId} failed`, error);
      }
    }
    if (actors.userIds.length) {
      await prisma.providerProfile.deleteMany({
        where: { userId: { in: actors.userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: actors.userIds } } });
    }
    await prisma.$disconnect();
    resetPayloadStorageCache();
  });

  it("PUBLIC: create → upload → review → catalog → install → download → usage", async () => {
    const published = await publishDistributionPack({
      name: `E2E Public ${runId}`,
      visibility: "PUBLIC",
      packId: `e2e_pub_${runId}`,
    });

    const listed = await listPublishedPacks();
    assert.ok(listed.some((p) => p.packId === published.packId));

    const detail = await getPublishedPackById(published.packId);
    assert.ok(detail);

    const install = await addPackInstallationForClient(
      actors.consumerClientId,
      published.packId,
    );
    assert.ok(!("error" in install));

    const myPacks = await listActiveMyPacksForClient(actors.consumerClientId);
    assert.ok(myPacks.some((p) => p.packId === published.packId));

    const downloaded = await readPublicCatalogPayloadBytes({ packId: published.packId });
    assert.equal(downloaded.checksumSha256, published.checksumSha256);
    assert.equal(sha256Hex(downloaded.bytes), published.checksumSha256);
    assert.equal(createHash("sha256").update(downloaded.bytes).digest("hex"), published.checksumSha256);

    const request = new NextRequest(
      `http://localhost/api/v1/packs/${published.packId}/payload/download`,
      {
        headers: {
          "x-forwarded-for": `203.0.113.${(Date.now() % 200) + 1}`,
        },
      },
    );
    const response = await publicPayloadDownloadGET(request, {
      params: Promise.resolve({ packId: published.packId }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-JYKStore-SHA256"), published.checksumSha256);

    const usage = await prisma.apiUsageLog.findFirst({
      where: {
        packId: published.packId,
        endpoint: "/api/v1/packs/:packId/payload/download",
        statusCode: 200,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(usage);
  });

  it("PRIVATE: hidden from catalog, detail, install, and public download", async () => {
    const published = await publishDistributionPack({
      name: `E2E Private ${runId}`,
      visibility: "PRIVATE",
      packId: `e2e_prv_${runId}`,
    });

    const listed = await listPublishedPacks();
    assert.ok(!listed.some((p) => p.packId === published.packId));

    const detail = await getPublishedPackById(published.packId);
    assert.equal(detail, null);

    const install = await addPackInstallationForClient(
      actors.consumerClientId,
      published.packId,
    );
    assert.equal("error" in install && install.error, "NOT_INSTALLABLE");

    await assert.rejects(
      () => readPublicCatalogPayloadBytes({ packId: published.packId }),
      (error: unknown) =>
        isPayloadServiceError(error) &&
        (error.code === "NOT_FOUND" || error.code === "PAYLOAD_NOT_FOUND") &&
        error.httpStatus === 404,
    );
  });

  it("UNLISTED: catalog hidden, detail/install/download allowed", async () => {
    const published = await publishDistributionPack({
      name: `E2E Unlisted ${runId}`,
      visibility: "UNLISTED",
      packId: `e2e_unl_${runId}`,
    });

    const listed = await listPublishedPacks();
    assert.ok(!listed.some((p) => p.packId === published.packId));

    const detail = await getPublishedPackById(published.packId);
    assert.ok(detail);

    const install = await addPackInstallationForClient(
      `${actors.consumerClientId}-unl`,
      published.packId,
    );
    assert.ok(!("error" in install));

    const downloaded = await readPublicCatalogPayloadBytes({ packId: published.packId });
    assert.equal(downloaded.checksumSha256, published.checksumSha256);
  });

  it("latest version visibility wins (PUBLIC→PRIVATE and PRIVATE→PUBLIC)", async () => {
    const publicFirst = await publishDistributionPack({
      name: `E2E Flip Pub ${runId}`,
      visibility: "PUBLIC",
      packId: `e2e_flip_a_${runId}`,
    });

    await addPackInstallationForClient(`${actors.consumerClientId}-flip`, publicFirst.packId);

    await reopenAsDraftAndPublishLatestVersion({
      packId: publicFirst.packId,
      version: "2.0.0",
      visibility: "PRIVATE",
    });

    assert.ok(!(await listPublishedPacks()).some((p) => p.packId === publicFirst.packId));
    assert.equal(await getPublishedPackById(publicFirst.packId), null);
    const blockedInstall = await addPackInstallationForClient(
      `${actors.consumerClientId}-flip-new`,
      publicFirst.packId,
    );
    assert.equal("error" in blockedInstall && blockedInstall.error, "NOT_INSTALLABLE");
    const myAfterPrivate = await listActiveMyPacksForClient(`${actors.consumerClientId}-flip`);
    assert.ok(!myAfterPrivate.some((p) => p.packId === publicFirst.packId));
    await assert.rejects(
      () => readPublicCatalogPayloadBytes({ packId: publicFirst.packId }),
      (error: unknown) => isPayloadServiceError(error) && error.httpStatus === 404,
    );

    const privateFirst = await publishDistributionPack({
      name: `E2E Flip Prv ${runId}`,
      visibility: "PRIVATE",
      packId: `e2e_flip_b_${runId}`,
    });
    await reopenAsDraftAndPublishLatestVersion({
      packId: privateFirst.packId,
      version: "2.0.0",
      visibility: "PUBLIC",
    });
    assert.ok((await listPublishedPacks()).some((p) => p.packId === privateFirst.packId));
    const allowed = await addPackInstallationForClient(
      `${actors.consumerClientId}-flip-b`,
      privateFirst.packId,
    );
    assert.ok(!("error" in allowed));
    await readPublicCatalogPayloadBytes({ packId: privateFirst.packId });
  });

  it("S3: missing object is PAYLOAD_NOT_FOUND; wrong bucket probe is unavailable", async () => {
    const published = await publishDistributionPack({
      name: `E2E S3 Err ${runId}`,
      visibility: "PUBLIC",
      packId: `e2e_s3_${runId}`,
    });

    const storage = getConfiguredPayloadStorage();
    await storage.delete({ objectKey: published.objectKey });

    await assert.rejects(
      () => readPublicCatalogPayloadBytes({ packId: published.packId }),
      (error: unknown) =>
        isPayloadServiceError(error) &&
        error.code === "PAYLOAD_NOT_FOUND" &&
        error.httpStatus === 404,
    );

    const badBucketEnv = {
      ...process.env,
      JYKSTORE_PAYLOAD_S3_BUCKET: `missing-bucket-${runId}`,
    };
    const badProbe = await probePayloadObjectStorage(badBucketEnv);
    assert.equal(badProbe.ok, false);
    assert.equal(badProbe.bucketOk, false);
    assert.ok(
      badProbe.errors.some((msg) => /bucket not found|unavailable|access denied/i.test(msg)),
    );

    const badStorage = new S3PayloadStorage({
      driver: "s3",
      endpoint: process.env.JYKSTORE_PAYLOAD_S3_ENDPOINT,
      region: process.env.JYKSTORE_PAYLOAD_S3_REGION?.trim() || "ap-northeast-2",
      bucket: `missing-bucket-${runId}`,
      accessKeyId: process.env.JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY!,
      forcePathStyle: true,
      prefix: "payloads",
      serverSideEncryption: undefined,
    });
    await assert.rejects(
      () => badStorage.headBucket(),
      (error: unknown) => {
        // HeadBucket throws raw AWS error; classify via probe path above.
        return Boolean(error);
      },
    );
  });

  it("My Packs DTO keeps full version history across 3 versions", async () => {
    const published = await publishDistributionPack({
      name: `E2E Hist ${runId}`,
      visibility: "PUBLIC",
      packId: `e2e_hist_${runId}`,
      version: "1.0.0",
    });

    await reopenAsDraftAndPublishLatestVersion({
      packId: published.packId,
      version: "2.0.0",
      visibility: "PUBLIC",
    });
    await reopenAsDraftAndPublishLatestVersion({
      packId: published.packId,
      version: "3.0.0",
      visibility: "PUBLIC",
    });

    const clientId = `${actors.consumerClientId}-hist`;
    const install = await addPackInstallationForClient(clientId, published.packId);
    assert.ok(!("error" in install));
    assert.equal(install.pack.version, "3.0.0");
    assert.equal(install.pack.versionHistory.length, 3);
    assert.deepEqual(
      install.pack.versionHistory.map((entry) => entry.version),
      ["3.0.0", "2.0.0", "1.0.0"],
    );

    const listed = await listActiveMyPacksForClient(clientId);
    const row = listed.find((pack) => pack.packId === published.packId);
    assert.ok(row);
    assert.equal(row.versionHistory.length, 3);
  });

  it("INVALID_DISTRIBUTION: payload/metadata mismatch is fail-closed", async () => {
    const published = await publishDistributionPack({
      name: `E2E Invalid ${runId}`,
      visibility: "PUBLIC",
      packId: `e2e_inv_${runId}`,
    });

    const metaOnlyPackId = `e2e_inv_meta_${runId}`;

    // Case A: strip metadata from a published pack (keep payload object).
    await prisma.packDistributionMetadata.deleteMany({ where: { packId: published.packId } });
    assert.ok(!(await listPublishedPacks()).some((p) => p.packId === published.packId));
    assert.equal(await getPublishedPackById(published.packId), null);
    const blockedInstall = await addPackInstallationForClient(
      `${actors.consumerClientId}-inv`,
      published.packId,
    );
    assert.equal("error" in blockedInstall && blockedInstall.error, "NOT_INSTALLABLE");
    await assert.rejects(
      () => readPublicCatalogPayloadBytes({ packId: published.packId }),
      (error: unknown) => isPayloadServiceError(error) && error.httpStatus === 404,
    );

    // Case B: publish another pack then delete payload row (and object) while keeping metadata.
    const metaOnly = await publishDistributionPack({
      name: `E2E Invalid Meta ${runId}`,
      visibility: "PUBLIC",
      packId: metaOnlyPackId,
    });
    const storage = getConfiguredPayloadStorage();
    await storage.delete({ objectKey: metaOnly.objectKey });
    await prisma.knowledgePayload.deleteMany({ where: { packId: metaOnly.packId } });

    assert.ok(!(await listPublishedPacks()).some((p) => p.packId === metaOnly.packId));
    assert.equal(await getPublishedPackById(metaOnly.packId), null);
    const blockedMeta = await addPackInstallationForClient(
      `${actors.consumerClientId}-inv-meta`,
      metaOnly.packId,
    );
    assert.equal("error" in blockedMeta && blockedMeta.error, "NOT_INSTALLABLE");
    await assert.rejects(
      () => readPublicCatalogPayloadBytes({ packId: metaOnly.packId }),
      (error: unknown) => isPayloadServiceError(error) && error.httpStatus === 404,
    );
  });
});

describe("Distribution MinIO E2E skip gate", () => {
  it(
    runE2E
      ? "E2E env present — suite above executes"
      : "skipped without JYKSTORE_RUN_DISTRIBUTION_E2E=1 and DB/MinIO env",
    (t) => {
      if (!runE2E) {
        t.skip(
          "Set JYKSTORE_RUN_DISTRIBUTION_E2E=1 with DATABASE_URL, MinIO S3 env, and JYKSTORE_ANONYMOUS_ID_SECRET",
        );
      }
    },
  );
});
