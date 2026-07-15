import { AuditAction, PackStatus } from "@prisma/client";
import { Readable } from "node:stream";
import { selectPublicArtifact } from "@/lib/artifact-state/select-public-artifact";
import {
  distributionVersionAccessInclude,
  latestKnowledgePackVersionOrderBy,
} from "@/lib/distribution/latest-distribution-state";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";

export async function readPublicCatalogPayloadBytes(input: {
  packId: string;
  storage?: import("@/lib/object-storage/object-storage").ObjectStorageBackend;
}): Promise<{
  bytes: Uint8Array;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  checksumSha256: string;
  payloadId: string;
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
  artifactKind: "SOURCE_ORIGINAL";
}> {
  const streamed = await openPublicCatalogSourceOriginalStream(input);
  const raw = streamed.stream;
  const nodeStream =
    typeof (raw as ReadableStream).getReader === "function"
      ? Readable.fromWeb(raw as import("node:stream/web").ReadableStream)
      : (raw as NodeJS.ReadableStream);
  const chunks: Buffer[] = [];
  for await (const chunk of nodeStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const bytes = new Uint8Array(Buffer.concat(chunks));
  return {
    bytes,
    originalFileName: streamed.originalFileName,
    mimeType: streamed.mimeType,
    fileSize: streamed.fileSize,
    checksumSha256: streamed.checksumSha256,
    payloadId: streamed.payloadId,
    visibility: streamed.visibility,
    artifactKind: "SOURCE_ORIGINAL",
  };
}

/**
 * Public download: Docling SOURCE_ORIGINAL only, streamed (no full buffer).
 * Integrity checksum was verified at import; response headers carry stored SHA-256.
 */
export async function openPublicCatalogSourceOriginalStream(input: {
  packId: string;
  storage?: import("@/lib/object-storage/object-storage").ObjectStorageBackend;
}): Promise<{
  stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  checksumSha256: string;
  payloadId: string;
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
  artifactKind: "SOURCE_ORIGINAL";
}> {
  const { getConfiguredObjectStorage } = await import(
    "@/lib/object-storage/object-storage-factory"
  );
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: input.packId },
    include: {
      versions: {
        orderBy: latestKnowledgePackVersionOrderBy,
        take: 1,
        include: {
          distributionMetadata: true,
          doclingImportBundles: distributionVersionAccessInclude.doclingImportBundles,
        },
      },
    },
  });
  if (!pack || (pack.status !== PackStatus.PUBLISHED && pack.status !== PackStatus.VERIFIED)) {
    throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }

  const version = pack.versions[0];
  if (!version) {
    throw new PayloadServiceError("PAYLOAD_NOT_FOUND", "등록된 자료가 없습니다.", 404);
  }

  const selected = selectPublicArtifact(version);
  if (selected.kind !== "SOURCE_ORIGINAL") {
    throw new PayloadServiceError("NOT_FOUND", "다운로드가 허용되지 않은 지식팩입니다.", 404);
  }
  if (selected.visibility === "PRIVATE") {
    throw new PayloadServiceError("NOT_FOUND", "다운로드가 허용되지 않은 지식팩입니다.", 404);
  }

  const { assertServiceChannelEnabled } = await import(
    "@/lib/distribution/service-channel-policy"
  );
  const meta = version.distributionMetadata;
  const channelCheck = assertServiceChannelEnabled("DOWNLOAD", {
    allowApi: meta?.allowApi ?? true,
    allowMcp: meta?.allowMcp ?? true,
    allowDownload: selected.allowDownload,
    serviceEndsAt: meta?.serviceEndsAt ?? null,
  });
  if (!channelCheck.ok) {
    throw new PayloadServiceError(
      channelCheck.code === "SERVICE_ENDED" ? "SERVICE_ENDED" : "SERVICE_CHANNEL_DISABLED",
      channelCheck.message,
      403,
    );
  }

  let objectKey = selected.objectKey;
  let artifactId = selected.artifactId;
  let originalFileName = selected.originalFileName;
  let mimeType = selected.mimeType;
  let expectedChecksum = selected.checksumSha256;
  let expectedSize = selected.fileSize;

  if (!objectKey || !expectedChecksum) {
    const sourceFile = await prisma.knowledgePackFile.findFirst({
      where: {
        packId: pack.packId,
        versionId: version.id,
        role: "SOURCE_ORIGINAL",
        bundle: { deletedAt: null, isActive: true },
      },
    });
    if (!sourceFile) {
      throw new PayloadServiceError(
        "PAYLOAD_NOT_FOUND",
        "다운로드 가능한 원본 자료가 없습니다.",
        404,
      );
    }
    objectKey = sourceFile.storageKey;
    artifactId = sourceFile.id;
    originalFileName = sourceFile.originalFileName;
    mimeType = sourceFile.mimeType || "application/octet-stream";
    expectedChecksum = sourceFile.checksumSha256;
    expectedSize = Number(sourceFile.fileSize);
  }

  const storage = input.storage ?? getConfiguredObjectStorage();
  const head = await storage.headObject({ objectKey }).catch(() => null);
  if (!head) {
    throw new PayloadServiceError("PAYLOAD_NOT_FOUND", "원본 객체를 찾을 수 없습니다.", 404);
  }
  if (expectedSize > 0 && head.contentLength !== expectedSize) {
    throw new PayloadServiceError(
      "PAYLOAD_OBJECT_SIZE_MISMATCH",
      "원본 파일 크기가 메타데이터와 일치하지 않습니다.",
      409,
    );
  }

  const streamed = await storage.getObjectStream({ objectKey });

  await recordProviderAudit({
    action: AuditAction.PAYLOAD_DOWNLOADED,
    entityType: "KnowledgePackFile",
    entityId: artifactId,
    metadata: {
      packId: pack.packId,
      versionId: version.id,
      fileId: artifactId,
      role: "SOURCE_ORIGINAL",
      artifactKind: "SOURCE_ORIGINAL",
      bytes: expectedSize,
      checksumSha256: expectedChecksum,
      actor: "catalog",
      artifact: "EXTERNAL_IMPORT",
      streamed: true,
    },
  });

  return {
    stream: streamed.body,
    originalFileName,
    mimeType: mimeType || "application/octet-stream",
    fileSize: expectedSize,
    checksumSha256: expectedChecksum,
    payloadId: artifactId,
    visibility: selected.visibility,
    artifactKind: "SOURCE_ORIGINAL",
  };
}

export async function findLatestPayloadForPack(packId: string) {
  const version = await prisma.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: latestKnowledgePackVersionOrderBy,
    include: { distributionMetadata: true },
  });
  return version;
}
