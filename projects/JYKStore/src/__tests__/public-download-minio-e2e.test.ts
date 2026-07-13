/**
 * Real public download E2E against PostgreSQL + MinIO.
 *
 * Requires:
 *   JYKSTORE_RUN_PUBLIC_DOWNLOAD_E2E=1 (or JYKSTORE_RUN_DISTRIBUTION_E2E=1)
 *   DATABASE_URL
 *   JYKSTORE_PAYLOAD_S3_*
 *   JYKSTORE_ANONYMOUS_ID_SECRET
 *
 * Prefer: npm run test:public-download-e2e:full
 * Without the flag this suite is SKIPPED (never reported as PASS).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { PackStatus } from "@prisma/client";

import { acceptPackReview, approvePackReview } from "../lib/admin-review-service.ts";
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
import { probePayloadObjectStorage } from "../lib/distribution/s3-payload-storage.ts";
import { sha256Hex } from "../lib/distribution/payload-checksum.ts";
import { uploadDoclingImportBundle } from "../lib/docling-import/docling-import-service.ts";
import { getPublishedPackById } from "../lib/pack-catalog-service.ts";
import { prisma } from "../lib/prisma.ts";
import {
  createProviderPackForClient,
  submitProviderPackForReview,
} from "../lib/provider-pack-service.ts";
import { ensureProviderProfileForAccount } from "../lib/provider-profile-service.ts";
import { GET as publicPayloadDownloadGET } from "../app/api/v1/packs/[packId]/payload/download/route.ts";
import { GET as publicDownloadAliasGET } from "../app/api/v1/packs/[packId]/download/route.ts";
import { assertSafeE2ETargets } from "../../test/distribution-e2e-safety.mjs";

const runE2E =
  (process.env.JYKSTORE_RUN_PUBLIC_DOWNLOAD_E2E === "1" ||
    process.env.JYKSTORE_RUN_DISTRIBUTION_E2E === "1") &&
  Boolean(process.env.DATABASE_URL?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_ENDPOINT?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_BUCKET?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY?.trim()) &&
  Boolean(process.env.JYKSTORE_ANONYMOUS_ID_SECRET?.trim());

if (runE2E) {
  assertSafeE2ETargets(process.env);
}

const CATEGORY_ID = "e2e-pub-dl";
const runId = `e2epdl${Date.now().toString(36)}`;

type Actors = {
  providerUserId: string;
  providerClientId: string;
  adminUserId: string;
  adminClientId: string;
  userIds: string[];
  packIds: string[];
};

const actors: Actors = {
  providerUserId: "",
  providerClientId: `e2e-pdl-prov-${runId}`,
  adminUserId: "",
  adminClientId: `e2e-pdl-adm-${runId}`,
  userIds: [],
  packIds: [],
};

const MINIMAL_DOCLING = {
  schema_name: "DoclingDocument",
  version: "1.10.0",
  name: "Sample",
  origin: { filename: "guide.pdf", mimetype: "application/pdf" },
  body: { children: [], self_ref: "#/body" },
  texts: [],
  tables: [],
  pictures: [],
};

function pdfBytes(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
}

function jsonBytes(): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(MINIMAL_DOCLING));
}

function mdBytes(): Uint8Array {
  return new TextEncoder().encode("# Sample\n\nPublic download e2e\n");
}

async function buildZip(label: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "payload/chunks.jsonl",
    [
      JSON.stringify({ text: `Public download E2E ${label} chunk alpha` }),
      JSON.stringify({ text: `Public download E2E ${label} chunk beta` }),
      "",
    ].join("\n"),
  );
  return zip.generateAsync({ type: "uint8array" });
}

async function publishPack(input: {
  name: string;
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED";
  packId?: string;
  withZip?: boolean;
  withDocling?: boolean;
  primaryArtifactType?: "SOURCE_ORIGINAL" | "KNOWLEDGE_PACKAGE" | null;
  allowDownload?: boolean;
  contentType?: "DOCUMENT" | "PRODUCT" | null;
  sourcePublisherName?: string;
}): Promise<{ packId: string; zipBytes: Uint8Array | null; sourceBytes: Uint8Array | null }> {
  const created = await createProviderPackForClient(
    actors.providerUserId,
    actors.providerClientId,
    {
      name: input.name,
      categoryId: CATEGORY_ID,
      description: `${input.name} public download e2e`,
      shortDescription: `${input.name} e2e`,
      tags: ["e2e", "public-download"],
      version: "1.0.0",
      packId: input.packId,
    },
  );
  if ("error" in created) {
    throw new Error(`create failed: ${JSON.stringify(created)}`);
  }
  const packId = created.pack.packId;
  actors.packIds.push(packId);

  let zipBytes: Uint8Array | null = null;
  if (input.withZip !== false) {
    zipBytes = await buildZip(packId);
    await uploadProviderPackPayload({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
      fileName: "e2e-pack.zip",
      mimeType: "application/zip",
      bytes: zipBytes,
      profile: "docling-chunks-v1",
    });
  }

  let sourceBytes: Uint8Array | null = null;
  if (input.withDocling) {
    sourceBytes = pdfBytes();
    const uploaded = await uploadDoclingImportBundle({
      userId: actors.providerUserId,
      clientId: actors.providerClientId,
      packId,
      source: {
        fileName: "guide.pdf",
        mimeType: "application/pdf",
        bytes: sourceBytes,
      },
      json: {
        fileName: "guide.json",
        mimeType: "application/json",
        bytes: jsonBytes(),
      },
      markdown: {
        fileName: "guide.md",
        mimeType: "text/markdown",
        bytes: mdBytes(),
      },
    });
    assert.equal(uploaded.bundle.status, "REVIEW_READY");
  }

  await upsertProviderPackDistribution({
    userId: actors.providerUserId,
    clientId: actors.providerClientId,
    packId,
    body: {
      sourceTitle: "Public Download E2E Source",
      sourceUrl: "https://example.com/public-download-e2e",
      sourcePublisherName: input.sourcePublisherName ?? "E2E Publisher",
      licenseName: "MIT",
      visibility: input.visibility,
      allowDownload: input.allowDownload !== false,
      primaryArtifactType: input.primaryArtifactType ?? null,
      contentType: input.contentType ?? null,
    },
  });

  const submitted = await submitProviderPackForReview(
    actors.providerUserId,
    actors.providerClientId,
    packId,
  );
  if ("error" in submitted) {
    throw new Error(`submit failed: ${JSON.stringify(submitted)}`);
  }

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

  return { packId, zipBytes, sourceBytes };
}

describe("Public download MinIO E2E", { skip: !runE2E }, () => {
  before(async () => {
    assertSafeE2ETargets(process.env);
    process.env.JYKSTORE_PAYLOAD_STORAGE_DRIVER = "s3";
    process.env.JYKSTORE_TRUST_PROXY = "true";
    resetPayloadStorageCache();

    const probe = await probePayloadObjectStorage(getConfiguredPayloadStorage());
    if (!probe.ok) {
      throw new Error(`Object storage probe failed: ${probe.message}`);
    }

    await prisma.packCategory.upsert({
      where: { categoryId: CATEGORY_ID },
      create: {
        categoryId: CATEGORY_ID,
        name: "Public Download E2E",
        description: "E2E",
        icon: "file",
      },
      update: { name: "Public Download E2E" },
    });

    const provider = await prisma.user.create({
      data: {
        email: `e2e-pdl-prov-${runId}@example.com`,
        name: "Public Download E2E Provider",
        role: "PROVIDER",
      },
    });
    const admin = await prisma.user.create({
      data: {
        email: `e2e-pdl-adm-${runId}@example.com`,
        name: "Public Download E2E Admin",
        role: "ADMIN",
      },
    });
    actors.providerUserId = provider.id;
    actors.adminUserId = admin.id;
    actors.userIds.push(provider.id, admin.id);

    await ensureProviderProfileForAccount(actors.providerUserId, actors.providerClientId, {
      displayName: "Public Download E2E Provider",
      providerType: "INDIVIDUAL",
    });
  });

  after(async () => {
    for (const packId of actors.packIds) {
      const payloads = await prisma.knowledgePayload.findMany({
        where: { packId },
        select: { storagePath: true },
      });
      const files = await prisma.knowledgePackFile.findMany({
        where: { packId },
        select: { storageKey: true },
      });
      try {
        const storage = getConfiguredPayloadStorage();
        for (const row of payloads) {
          await storage.delete({ objectKey: row.storagePath }).catch(() => undefined);
        }
        for (const row of files) {
          await storage.delete({ objectKey: row.storageKey }).catch(() => undefined);
        }
      } catch {
        // best-effort
      }
      await prisma.apiUsageLog.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.packReview.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.normalizedDocument.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePackFile.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.doclingImportBundle.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePayload.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.packDistributionMetadata.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePackVersion.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePack.deleteMany({ where: { packId } }).catch(() => undefined);
    }
    for (const userId of actors.userIds) {
      await prisma.providerProfile.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
  });

  it("ZIP package: DTO kind matches HTTP download bytes and nosniff", async () => {
    const published = await publishPack({
      name: `PDL ZIP ${runId}`,
      visibility: "PUBLIC",
      packId: `e2e_pdl_zip_${runId}`,
      withZip: true,
      withDocling: false,
      contentType: "DOCUMENT",
    });

    const detail = await getPublishedPackById(published.packId);
    assert.ok(detail);
    assert.equal(detail.downloadInfo?.artifactKind, "KNOWLEDGE_PACKAGE");
    assert.equal(detail.contentType, "DOCUMENT");
    assert.equal(detail.sourceInfo?.publisherName, "E2E Publisher");

    const downloaded = await readPublicCatalogPayloadBytes({ packId: published.packId });
    assert.equal(downloaded.artifactKind, "KNOWLEDGE_PACKAGE");
    assert.equal(downloaded.mimeType, "application/zip");
    assert.ok(published.zipBytes);
    assert.equal(sha256Hex(downloaded.bytes), sha256Hex(published.zipBytes));

    const response = await publicPayloadDownloadGET(
      new NextRequest(`http://localhost/api/v1/packs/${published.packId}/payload/download`, {
        headers: { "x-forwarded-for": "198.51.100.10" },
      }),
      { params: Promise.resolve({ packId: published.packId }) },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "application/zip");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(response.headers.get("X-JYKStore-SHA256"), downloaded.checksumSha256);

    const alias = await publicDownloadAliasGET(
      new NextRequest(`http://localhost/api/v1/packs/${published.packId}/download`, {
        headers: { "x-forwarded-for": "198.51.100.11" },
      }),
      { params: Promise.resolve({ packId: published.packId }) },
    );
    assert.equal(alias.status, 200);
    assert.equal(alias.headers.get("X-Content-Type-Options"), "nosniff");
  });

  it("External Import PDF: DTO and HTTP return original document", async () => {
    const published = await publishPack({
      name: `PDL PDF ${runId}`,
      visibility: "PUBLIC",
      packId: `e2e_pdl_pdf_${runId}`,
      withZip: false,
      withDocling: true,
    });

    const detail = await getPublishedPackById(published.packId);
    assert.ok(detail);
    assert.equal(detail.downloadInfo?.artifactKind, "SOURCE_ORIGINAL");
    assert.match(detail.downloadInfo?.mimeType ?? "", /pdf/);

    const downloaded = await readPublicCatalogPayloadBytes({ packId: published.packId });
    assert.equal(downloaded.artifactKind, "SOURCE_ORIGINAL");
    assert.ok(published.sourceBytes);
    assert.deepEqual(Buffer.from(downloaded.bytes), Buffer.from(published.sourceBytes));

    const response = await publicPayloadDownloadGET(
      new NextRequest(`http://localhost/api/v1/packs/${published.packId}/payload/download`, {
        headers: { "x-forwarded-for": "198.51.100.12" },
      }),
      { params: Promise.resolve({ packId: published.packId }) },
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type") ?? "", /pdf/);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.match(response.headers.get("Content-Disposition") ?? "", /guide\.pdf/);
  });

  it("dual artifacts: primary ZIP and SOURCE keep DTO/download aligned", async () => {
    const zipPrimary = await publishPack({
      name: `PDL Dual Zip ${runId}`,
      visibility: "PUBLIC",
      packId: `e2e_pdl_dz_${runId}`,
      withZip: true,
      withDocling: true,
      primaryArtifactType: "KNOWLEDGE_PACKAGE",
    });
    const zipDetail = await getPublishedPackById(zipPrimary.packId);
    assert.equal(zipDetail?.downloadInfo?.artifactKind, "KNOWLEDGE_PACKAGE");
    const zipDl = await readPublicCatalogPayloadBytes({ packId: zipPrimary.packId });
    assert.equal(zipDl.artifactKind, "KNOWLEDGE_PACKAGE");
    assert.equal(zipDl.mimeType, "application/zip");

    const sourcePrimary = await publishPack({
      name: `PDL Dual Src ${runId}`,
      visibility: "PUBLIC",
      packId: `e2e_pdl_ds_${runId}`,
      withZip: true,
      withDocling: true,
      primaryArtifactType: "SOURCE_ORIGINAL",
    });
    const sourceDetail = await getPublishedPackById(sourcePrimary.packId);
    assert.equal(sourceDetail?.downloadInfo?.artifactKind, "SOURCE_ORIGINAL");
    const sourceDl = await readPublicCatalogPayloadBytes({ packId: sourcePrimary.packId });
    assert.equal(sourceDl.artifactKind, "SOURCE_ORIGINAL");
    assert.ok(sourcePrimary.sourceBytes);
    assert.deepEqual(Buffer.from(sourceDl.bytes), Buffer.from(sourcePrimary.sourceBytes));
  });

  it("object tamper returns 502 checksum mismatch without leaking bytes", async () => {
    const published = await publishPack({
      name: `PDL Tamper ${runId}`,
      visibility: "PUBLIC",
      packId: `e2e_pdl_tmp_${runId}`,
      withZip: true,
      withDocling: false,
    });
    const payload = await prisma.knowledgePayload.findFirst({
      where: { packId: published.packId },
    });
    assert.ok(payload);

    const storage = getConfiguredPayloadStorage();
    const tampered = new TextEncoder().encode("tampered-payload-bytes");
    await storage.put({
      objectKey: payload.storagePath,
      bytes: tampered,
      checksumSha256: sha256Hex(tampered),
      mimeType: "application/zip",
      originalFileName: "e2e-pack.zip",
      packId: published.packId,
      versionId: payload.versionId,
      payloadId: payload.id,
    });

    await assert.rejects(
      () => readPublicCatalogPayloadBytes({ packId: published.packId }),
      (error: unknown) =>
        isPayloadServiceError(error) &&
        error.code === "PAYLOAD_OBJECT_CHECKSUM_MISMATCH" &&
        error.httpStatus === 502,
    );

    const response = await publicPayloadDownloadGET(
      new NextRequest(`http://localhost/api/v1/packs/${published.packId}/payload/download`, {
        headers: { "x-forwarded-for": "198.51.100.13" },
      }),
      { params: Promise.resolve({ packId: published.packId }) },
    );
    assert.equal(response.status, 502);
    const body = (await response.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "PAYLOAD_OBJECT_CHECKSUM_MISMATCH");
  });

  it("PRIVATE and allowDownload=false block public download", async () => {
    const privatePack = await publishPack({
      name: `PDL Private ${runId}`,
      visibility: "PRIVATE",
      packId: `e2e_pdl_prv_${runId}`,
      withZip: true,
    });
    await assert.rejects(
      () => readPublicCatalogPayloadBytes({ packId: privatePack.packId }),
      (error: unknown) => isPayloadServiceError(error) && error.httpStatus === 404,
    );

    const noDl = await publishPack({
      name: `PDL NoDL ${runId}`,
      visibility: "PUBLIC",
      packId: `e2e_pdl_nodl_${runId}`,
      withZip: true,
      allowDownload: false,
    });
    await assert.rejects(
      () => readPublicCatalogPayloadBytes({ packId: noDl.packId }),
      (error: unknown) => isPayloadServiceError(error) && error.httpStatus === 404,
    );
  });

  it("UNLISTED allows direct download", async () => {
    const published = await publishPack({
      name: `PDL Unlisted ${runId}`,
      visibility: "UNLISTED",
      packId: `e2e_pdl_unl_${runId}`,
      withZip: true,
    });
    const downloaded = await readPublicCatalogPayloadBytes({ packId: published.packId });
    assert.equal(downloaded.artifactKind, "KNOWLEDGE_PACKAGE");
    assert.equal(downloaded.visibility, "UNLISTED");
  });
});

describe("Public download MinIO E2E skip gate", () => {
  it(
    runE2E
      ? "E2E env present — suite above executes"
      : "skipped without JYKSTORE_RUN_PUBLIC_DOWNLOAD_E2E=1 and DB/MinIO env",
    (t) => {
      if (!runE2E) {
        t.skip(
          "Set JYKSTORE_RUN_PUBLIC_DOWNLOAD_E2E=1 with DATABASE_URL, MinIO S3 env, and JYKSTORE_ANONYMOUS_ID_SECRET",
        );
      }
    },
  );
});
