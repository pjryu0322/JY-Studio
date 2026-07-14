/**
 * Large Docling upload E2E — dynamically generates oversized fixtures (no git binaries).
 *
 * Skip unless:
 *   JYKSTORE_LARGE_UPLOAD_E2E=1
 *   DATABASE_URL
 *   JYKSTORE_PAYLOAD_S3_*
 *   JYKSTORE_ANONYMOUS_ID_SECRET
 *
 * Run: npm run test:docling-large-upload-e2e
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, open, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
  DoclingBundleStorageStatus,
  DoclingImportBundleStatus,
  KnowledgePackFileRole,
  PackStatus,
} from "@prisma/client";

import {
  getConfiguredPayloadStorage,
  resetPayloadStorageCache,
} from "../lib/distribution/payload-storage-factory.ts";
import { probePayloadObjectStorage } from "../lib/distribution/s3-payload-storage.ts";
import { validateAndNormalizeBundle } from "../lib/docling-import/docling-import-service.ts";
import { getDoclingUploadPolicy } from "../lib/docling-import/docling-upload-policy.ts";
import { buildPackFileObjectKey } from "../lib/distribution/payload-storage-config.ts";
import { prisma } from "../lib/prisma.ts";
import { createProviderPackForClient } from "../lib/provider-pack-service.ts";
import { ensureProviderProfileForAccount } from "../lib/provider-profile-service.ts";
import { assertSafeE2ETargets } from "../../test/distribution-e2e-safety.mjs";
import { sha256Hex } from "../lib/object-storage/checksum.ts";
import type { ObjectStorageBackend } from "../lib/object-storage/object-storage.ts";
import { DOCLING_ADAPTER_TYPE, DOCLING_ADAPTER_VERSION } from "../lib/adapters/docling/docling-types.ts";

const runE2E =
  process.env.JYKSTORE_LARGE_UPLOAD_E2E === "1" &&
  Boolean(process.env.DATABASE_URL?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_ENDPOINT?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_BUCKET?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID?.trim()) &&
  Boolean(process.env.JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY?.trim()) &&
  Boolean(process.env.JYKSTORE_ANONYMOUS_ID_SECRET?.trim());

if (runE2E) {
  assertSafeE2ETargets(process.env);
}

const CATEGORY_ID = "e2e-docling-large";
const runId = `e2elrg${Date.now().toString(36)}`;

function id24(): string {
  return randomUUID().replace(/-/g, "").slice(0, 24);
}

function rssMb(): number {
  return process.memoryUsage().rss / (1024 * 1024);
}

function pdfBytes(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
}

async function writeLargeMarkdown(filePath: string, minBytes: number): Promise<number> {
  const paragraph =
    "Hello world sample content for Docling markdown large upload stress test. ".repeat(20) +
    "\n\n";
  const stream = createWriteStream(filePath);
  stream.write("# Large Sample\n\n");
  let written = Buffer.byteLength("# Large Sample\n\n");
  while (written < minBytes) {
    const ok = stream.write(paragraph);
    written += Buffer.byteLength(paragraph);
    if (!ok) await new Promise<void>((r) => stream.once("drain", r));
  }
  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });
  return (await stat(filePath)).size;
}

async function writeLargeDoclingJson(filePath: string, minBytes: number): Promise<number> {
  const fakeB64 = "B".repeat(256 * 1024);
  const stream = createWriteStream(filePath);
  const header =
    `{"schema_name":"DoclingDocument","version":"1.10.0","name":"LargeSample",` +
    `"origin":{"filename":"sample.pdf","mimetype":"application/pdf"},` +
    `"body":{"self_ref":"#/body","children":[{"$ref":"#/texts/0"}]},"texts":[`;
  stream.write(header);
  let written = Buffer.byteLength(header);
  let i = 0;
  const textSeed = "Hello world sample content ".repeat(100);
  while (written < minBytes - 1024 * 1024) {
    const item = `${i > 0 ? "," : ""}{"self_ref":"#/texts/${i}","text":${JSON.stringify(textSeed + i)},"label":"paragraph"}`;
    const ok = stream.write(item);
    written += Buffer.byteLength(item);
    i += 1;
    if (!ok) await new Promise<void>((r) => stream.once("drain", r));
  }
  const picture =
    `],"tables":[],"pictures":[{"self_ref":"#/pictures/0","caption":"x","image":{"base64":"${fakeB64}"}}],"groups":[]}`;
  stream.write(picture);
  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });
  return (await stat(filePath)).size;
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function putFileMultipart(
  storage: ObjectStorageBackend,
  objectKey: string,
  filePath: string,
  partSize: number,
  mimeType: string,
): Promise<{ size: number; checksum: string; parts: number }> {
  const size = (await stat(filePath)).size;
  const checksum = await hashFile(filePath);
  const { uploadId } = await storage.createMultipartUpload({ objectKey, mimeType });
  const parts: Array<{ partNumber: number; etag: string }> = [];
  let partNumber = 1;
  let offset = 0;
  const fh = await open(filePath, "r");
  try {
    while (offset < size) {
      const len = Math.min(partSize, size - offset);
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, offset);
      const presigned = await storage.presignUploadPart({
        objectKey,
        uploadId,
        partNumber,
        expiresInSeconds: 900,
      });
      const res = await fetch(presigned.url, {
        method: "PUT",
        body: new Uint8Array(buf),
        headers: { "Content-Type": "application/octet-stream" },
      });
      if (!res.ok) {
        throw new Error(`part upload failed ${partNumber}: ${res.status} ${await res.text()}`);
      }
      const etag = res.headers.get("etag");
      if (!etag) throw new Error(`missing etag for part ${partNumber}`);
      parts.push({ partNumber, etag });
      offset += len;
      partNumber += 1;
    }
    await storage.completeMultipartUpload({ objectKey, uploadId, parts });
  } catch (error) {
    await storage.abortMultipartUpload({ objectKey, uploadId }).catch(() => undefined);
    throw error;
  } finally {
    await fh.close();
  }
  return { size, checksum, parts: parts.length };
}

describe("docling-large-upload-e2e", { skip: !runE2E }, () => {
  const actors = {
    providerUserId: "",
    providerClientId: `e2e-lrg-prov-${runId}`,
    userIds: [] as string[],
    packIds: [] as string[],
    tempDir: "",
  };

  before(async () => {
    resetPayloadStorageCache();
    process.env.JYKSTORE_TRUST_PROXY = "true";
    actors.tempDir = await mkdtemp(join(tmpdir(), "jykstore-large-docling-"));

    const probe = await probePayloadObjectStorage(getConfiguredPayloadStorage());
    if (!probe.ok) {
      throw new Error(`Object storage probe failed: ${probe.message}`);
    }

    await prisma.category.upsert({
      where: { id: CATEGORY_ID },
      create: {
        id: CATEGORY_ID,
        name: "Docling Large E2E",
        description: "Large upload e2e",
        icon: "📄",
        sortOrder: 9997,
      },
      update: { name: "Docling Large E2E" },
    });

    const provider = await prisma.user.create({
      data: {
        email: `docling-lrg-${runId}@example.com`,
        name: "Docling Large E2E Provider",
        role: "PROVIDER",
      },
    });
    actors.providerUserId = provider.id;
    actors.userIds.push(provider.id);
    await ensureProviderProfileForAccount(actors.providerUserId, actors.providerClientId, {
      displayName: "Docling Large E2E Provider",
      providerType: "INDIVIDUAL",
    });
  });

  after(async () => {
    for (const packId of actors.packIds) {
      await prisma.normalizedDocument.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePackFile.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.doclingProcessingLog.deleteMany({
        where: { bundle: { packId } },
      }).catch(() => undefined);
      await prisma.doclingImportBundle.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePackVersion.deleteMany({ where: { packId } }).catch(() => undefined);
      await prisma.knowledgePack.deleteMany({ where: { packId } }).catch(() => undefined);
    }
    for (const userId of actors.userIds) {
      await prisma.providerProfile.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    if (actors.tempDir) {
      await rm(actors.tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
  });

  it("multipart large fixtures → validateAndNormalizeBundle → NORMALIZED", async () => {
    const t0 = Date.now();
    const rssSamples: number[] = [rssMb()];
    const policy = getDoclingUploadPolicy();
    const partSize = policy.multipartPartBytes;

    const mdPath = join(actors.tempDir, "large.md");
    const jsonPath = join(actors.tempDir, "large.json");
    const mdSize = await writeLargeMarkdown(mdPath, 20 * 1024 * 1024);
    const jsonSize = await writeLargeDoclingJson(jsonPath, 260 * 1024 * 1024);
    rssSamples.push(rssMb());

    console.log(
      `[large-e2e] fixtures md=${(mdSize / 1e6).toFixed(1)}MB json=${(jsonSize / 1e6).toFixed(1)}MB partSize=${partSize} rss=${rssSamples.at(-1)?.toFixed(0)}MB`,
    );
    assert.ok(mdSize >= 20 * 1024 * 1024);
    assert.ok(jsonSize >= 260 * 1024 * 1024);

    const created = await createProviderPackForClient(
      actors.providerUserId,
      actors.providerClientId,
      {
        name: `Docling Large ${runId}`,
        categoryId: CATEGORY_ID,
        shortDescription: "Large upload e2e",
        description: "Large Docling upload e2e pack",
        version: "1.0.0",
      },
    );
    if ("error" in created) {
      throw new Error(`create pack failed: ${JSON.stringify(created)}`);
    }
    const packId = created.pack.packId;
    actors.packIds.push(packId);

    const version = await prisma.knowledgePackVersion.findFirst({
      where: { packId },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(version);

    const storage = getConfiguredPayloadStorage() as ObjectStorageBackend;
    const prefix =
      typeof (storage as { prefix?: string }).prefix === "string"
        ? (storage as { prefix: string }).prefix
        : "payloads";

    const bundleId = id24();
    const sourceFileId = id24();
    const jsonFileId = id24();
    const mdFileId = id24();

    const pdf = pdfBytes();
    const sourceKey = buildPackFileObjectKey({
      prefix,
      packId,
      versionId: version.id,
      bundleId,
      fileId: sourceFileId,
      role: "SOURCE_ORIGINAL",
      extension: ".pdf",
    });
    const jsonKey = buildPackFileObjectKey({
      prefix,
      packId,
      versionId: version.id,
      bundleId,
      fileId: jsonFileId,
      role: "DOCLING_JSON",
      extension: ".json",
    });
    const mdKey = buildPackFileObjectKey({
      prefix,
      packId,
      versionId: version.id,
      bundleId,
      fileId: mdFileId,
      role: "DOCLING_MARKDOWN",
      extension: ".md",
    });

    await storage.put({
      packId,
      versionId: version.id,
      payloadId: sourceFileId,
      originalFileName: "sample.pdf",
      mimeType: "application/pdf",
      bytes: pdf,
      checksumSha256: sha256Hex(pdf),
      objectKey: sourceKey,
    });

    const tJson = Date.now();
    const jsonPut = await putFileMultipart(
      storage,
      jsonKey,
      jsonPath,
      partSize,
      "application/json",
    );
    console.log(
      `[large-e2e] json multipart parts=${jsonPut.parts} in ${Date.now() - tJson}ms rss=${rssMb().toFixed(0)}MB`,
    );
    rssSamples.push(rssMb());

    const tMd = Date.now();
    const mdPut = await putFileMultipart(storage, mdKey, mdPath, partSize, "text/markdown");
    console.log(
      `[large-e2e] md multipart parts=${mdPut.parts} in ${Date.now() - tMd}ms rss=${rssMb().toFixed(0)}MB`,
    );
    rssSamples.push(rssMb());

    await prisma.doclingImportBundle.create({
      data: {
        id: bundleId,
        packId,
        versionId: version.id,
        status: DoclingImportBundleStatus.UPLOADED,
        isActive: false,
        adapterType: DOCLING_ADAPTER_TYPE,
        adapterVersion: DOCLING_ADAPTER_VERSION,
        storageStatus: DoclingBundleStorageStatus.ACTIVE,
        stagingReason: "large_upload_e2e",
        uploadedByUserId: actors.providerUserId,
        files: {
          create: [
            {
              id: sourceFileId,
              packId,
              versionId: version.id,
              role: KnowledgePackFileRole.SOURCE_ORIGINAL,
              originalFileName: "sample.pdf",
              mimeType: "application/pdf",
              fileExtension: ".pdf",
              fileSize: BigInt(pdf.byteLength),
              checksumSha256: sha256Hex(pdf),
              storageKey: sourceKey,
              storageProvider: "S3",
            },
            {
              id: jsonFileId,
              packId,
              versionId: version.id,
              role: KnowledgePackFileRole.DOCLING_JSON,
              originalFileName: "large.json",
              mimeType: "application/json",
              fileExtension: ".json",
              fileSize: BigInt(jsonPut.size),
              checksumSha256: jsonPut.checksum,
              storageKey: jsonKey,
              storageProvider: "S3",
            },
            {
              id: mdFileId,
              packId,
              versionId: version.id,
              role: KnowledgePackFileRole.DOCLING_MARKDOWN,
              originalFileName: "large.md",
              mimeType: "text/markdown",
              fileExtension: ".md",
              fileSize: BigInt(mdPut.size),
              checksumSha256: mdPut.checksum,
              storageKey: mdKey,
              storageProvider: "S3",
            },
          ],
        },
      },
    });

    const tVal = Date.now();
    const result = await validateAndNormalizeBundle(bundleId, { storage });
    console.log(
      `[large-e2e] validate+normalize ${Date.now() - tVal}ms status=${result.status} rss=${rssMb().toFixed(0)}MB`,
    );
    rssSamples.push(rssMb());

    assert.equal(result.status, DoclingImportBundleStatus.NORMALIZED);
    console.log(
      `[large-e2e] done total=${Date.now() - t0}ms md=${mdSize} json=${jsonSize} partSize=${partSize} rss=${rssSamples.map((n) => n.toFixed(0)).join(",")}`,
    );

    const pack = await prisma.knowledgePack.findUnique({ where: { packId } });
    assert.equal(pack?.status, PackStatus.DRAFT);
  });
});
