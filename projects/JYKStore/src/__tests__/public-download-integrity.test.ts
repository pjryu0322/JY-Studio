import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { InMemoryPayloadStorage } from "../lib/distribution/in-memory-payload-storage.ts";
import { PayloadServiceError } from "../lib/distribution/payload-errors.ts";
import { sha256Hex } from "../lib/distribution/payload-checksum.ts";
import {
  readAndVerifyPayloadObject,
  readAndVerifyStoredObject,
} from "../lib/distribution/payload-object-integrity.ts";
import {
  normalizePublicPackDisplayName,
  normalizeSourceFileDisplayName,
} from "../lib/public-pack-display-name.ts";
import { resolvePublicPackContentType } from "../lib/public-pack-content-type.ts";
import {
  resolvePublicPackDownloadInfo,
  resolvePublicPackSourceInfo,
} from "../lib/public-pack-detail-info.ts";

function readSource(rel: string) {
  return readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
}

function putObject(
  storage: InMemoryPayloadStorage,
  objectKey: string,
  bytes: Uint8Array,
  mimeType: string,
) {
  return storage.put({
    objectKey,
    bytes,
    checksumSha256: sha256Hex(bytes),
    mimeType,
    originalFileName: objectKey.split("/").pop() ?? "file.bin",
    packId: "pack",
    versionId: "ver",
    payloadId: "payload",
  });
}

describe("readAndVerifyStoredObject", () => {
  it("returns verified bytes when size and checksum match", async () => {
    const storage = new InMemoryPayloadStorage();
    const bytes = new TextEncoder().encode("hello-public-download");
    const checksum = sha256Hex(bytes);
    await putObject(
      storage,
      "packs/a/source.docx",
      bytes,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    const verified = await readAndVerifyStoredObject({
      storage,
      objectKey: "packs/a/source.docx",
      expectedChecksumSha256: checksum,
      expectedFileSize: bytes.byteLength,
    });
    assert.equal(verified.actualFileSize, bytes.byteLength);
    assert.equal(verified.actualChecksumSha256, checksum);
    assert.deepEqual(Buffer.from(verified.bytes), Buffer.from(bytes));
  });

  it("rejects checksum mismatch with 502", async () => {
    const storage = new InMemoryPayloadStorage();
    const bytes = new TextEncoder().encode("clean-bytes");
    await putObject(storage, "packs/a/tampered.bin", bytes, "application/octet-stream");

    await assert.rejects(
      () =>
        readAndVerifyStoredObject({
          storage,
          objectKey: "packs/a/tampered.bin",
          expectedChecksumSha256: "0".repeat(64),
          expectedFileSize: bytes.byteLength,
        }),
      (error: unknown) =>
        error instanceof PayloadServiceError &&
        error.code === "PAYLOAD_OBJECT_CHECKSUM_MISMATCH" &&
        error.httpStatus === 502,
    );
  });

  it("rejects size mismatch with 502", async () => {
    const storage = new InMemoryPayloadStorage();
    const bytes = new TextEncoder().encode("abc");
    const checksum = sha256Hex(bytes);
    await putObject(storage, "packs/a/size.bin", bytes, "application/octet-stream");

    await assert.rejects(
      () =>
        readAndVerifyStoredObject({
          storage,
          objectKey: "packs/a/size.bin",
          expectedChecksumSha256: checksum,
          expectedFileSize: bytes.byteLength + 10,
        }),
      (error: unknown) =>
        error instanceof PayloadServiceError &&
        error.code === "PAYLOAD_OBJECT_SIZE_MISMATCH" &&
        error.httpStatus === 502,
    );
  });

  it("keeps payload wrapper compatible", async () => {
    const storage = new InMemoryPayloadStorage();
    const bytes = new TextEncoder().encode("zip-bytes");
    const checksum = sha256Hex(bytes);
    await putObject(storage, "packs/a/package.zip", bytes, "application/zip");
    const verified = await readAndVerifyPayloadObject({
      storage,
      objectKey: "packs/a/package.zip",
      expectedChecksumSha256: checksum,
      expectedFileSize: bytes.byteLength,
    });
    assert.equal(verified.checksumSha256, checksum);
  });
});

describe("public download source integrity contracts", () => {
  it("public download route uses dynamic Content-Type", () => {
    const route = readSource("app/api/v1/packs/[packId]/payload/download/route.ts");
    assert.match(route, /"Content-Type": result\.mimeType/);
    assert.match(route, /"Content-Length": String\(result\.fileSize\)/);
    assert.equal(route.includes('"Content-Type": "application/zip"'), false);
  });

  it("external import download verifies stored object bytes", () => {
    const service = readSource("lib/distribution/payload-service.ts");
    assert.match(service, /readAndVerifyStoredObject/);
    assert.match(service, /artifactKind: "SOURCE_ORIGINAL"/);
    assert.match(service, /artifactKind: "KNOWLEDGE_PACKAGE"/);
    assert.equal(
      service.includes("got = await storage.get({ objectKey: sourceFile.storageKey })"),
      false,
    );
  });
});

describe("display name safety", () => {
  it("preserves product and version digits", () => {
    for (const name of ["OAuth2", "GPT-4", "Java 17", "React 19", "Vue 3", "Spring Boot 3", "OpenAPI 3"]) {
      assert.equal(normalizePublicPackDisplayName(name), name);
    }
  });

  it("still softens filename-like pack titles and copy markers", () => {
    assert.equal(
      normalizePublicPackDisplayName("(2025년_개정판)_SW사업_대가산정_가이드"),
      "2025년 개정판 SW사업 대가산정 가이드",
    );
    assert.equal(normalizePublicPackDisplayName("문서 (1).docx"), "문서");
  });

  it("keeps _01 in pack display names; file helper may soften separately", () => {
    assert.equal(normalizePublicPackDisplayName("가이드_01"), "가이드 01");
    assert.match(normalizeSourceFileDisplayName("문서 (1).docx"), /문서/);
  });
});

describe("content type document priority", () => {
  it("treats document source + features-only as DOCUMENT", () => {
    assert.equal(
      resolvePublicPackContentType({
        hasDocumentSource: true,
        downloadReady: true,
        apiReady: false,
        features: ["1장 개요", "2장 기준"],
        supportedEnvironments: [],
        useCases: [],
      }),
      "DOCUMENT",
    );
  });

  it("treats document source with environments and use cases as MIXED", () => {
    assert.equal(
      resolvePublicPackContentType({
        hasDocumentSource: true,
        downloadReady: true,
        features: ["목차"],
        supportedEnvironments: ["PDF Viewer"],
        useCases: ["견적"],
      }),
      "MIXED",
    );
  });

  it("infers PRODUCT from product-shaped signals", () => {
    assert.equal(
      resolvePublicPackContentType({
        categoryName: "UI Components",
        tags: ["component"],
        features: ["표"],
        supportedEnvironments: ["React"],
        useCases: [],
      }),
      "PRODUCT",
    );
  });
});

describe("source publisher separation", () => {
  it("does not invent publisher from provider identity", () => {
    const info = resolvePublicPackSourceInfo({
      distributionMetadata: {
        visibility: "PUBLIC",
        allowDownload: true,
        sourceTitle: "SW사업 대가산정 가이드",
        sourceUrl: "https://example.com/guide",
        licenseName: "public",
      },
    });
    assert.ok(info);
    assert.equal(info?.publisherName, null);
    assert.equal(info?.sourceTitle, "SW사업 대가산정 가이드");
  });

  it("marks SOURCE_ORIGINAL vs KNOWLEDGE_PACKAGE download artifacts", () => {
    const source = resolvePublicPackDownloadInfo({
      payload: null,
      distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
      doclingImportBundles: [
        {
          id: "b1",
          isActive: true,
          status: "REVIEW_READY",
          storageStatus: "ACTIVE",
          deletedAt: null,
          normalizedDocuments: [{ id: "n1", isActive: true }],
          files: [
            {
              role: "SOURCE_ORIGINAL",
              originalFileName: "guide.docx",
              mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              fileSize: 12,
              checksumSha256: "a".repeat(64),
            },
          ],
        },
      ],
    });
    assert.equal(source?.artifactKind, "SOURCE_ORIGINAL");

    const zip = resolvePublicPackDownloadInfo({
      payload: {
        id: "p1",
        validationStatus: "VALID",
        originalFileName: "pack.zip",
        mimeType: "application/zip",
        fileSize: 99,
        checksumSha256: "b".repeat(64),
      },
      distributionMetadata: { visibility: "PUBLIC", allowDownload: true },
      doclingImportBundles: [],
    });
    assert.equal(zip?.artifactKind, "KNOWLEDGE_PACKAGE");
  });
});

describe("download UI copy", () => {
  it("distinguishes package vs original document labels", () => {
    const section = readSource("components/PackDownloadInfoSection.tsx");
    assert.match(section, /지식팩 패키지 다운로드/);
    assert.match(section, /원본문서 다운로드/);
    assert.match(section, /표준 지식팩 ZIP Package가 제공됩니다/);
  });
});
