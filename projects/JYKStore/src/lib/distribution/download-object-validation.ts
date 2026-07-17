import { createHash } from "node:crypto";
import { getConfiguredObjectStorage } from "@/lib/object-storage/object-storage-factory";

export type DownloadObjectValidationResult =
  | {
      ok: true;
      fileId: string;
      fileName: string;
      mimeType: string | null;
      fileSize: number;
      checksumSha256: string;
      actualSize: number;
      actualChecksumSha256: string;
      latencyMs: number;
    }
  | { ok: false; code: string; message: string; latencyMs: number };

/**
 * Verify SOURCE_ORIGINAL against Object Storage via HEAD + streaming SHA-256.
 * Does not buffer the full object in memory.
 */
export async function validateDownloadObjectIntegrity(input: {
  fileId: string;
  objectKey: string;
  originalFileName: string;
  mimeType: string | null;
  expectedFileSize: number | bigint;
  expectedChecksumSha256: string;
}): Promise<DownloadObjectValidationResult> {
  const started = Date.now();
  const expectedSize = Number(input.expectedFileSize);
  const expectedChecksum = input.expectedChecksumSha256.trim().toLowerCase();
  if (!Number.isFinite(expectedSize) || expectedSize <= 0 || !expectedChecksum) {
    return {
      ok: false,
      code: "DOWNLOAD_VALIDATION_FAILED",
      message: "원본문서 무결성 정보가 없습니다.",
      latencyMs: Date.now() - started,
    };
  }

  const storage = getConfiguredObjectStorage();
  let head;
  try {
    head = await storage.headObject({ objectKey: input.objectKey });
  } catch (error) {
    const message =
      error && typeof error === "object" && "code" in error && error.code === "PAYLOAD_STORAGE_UNAVAILABLE"
        ? "Object Storage에 연결할 수 없습니다. MinIO/S3가 실행 중인지 확인해 주세요."
        : "원본문서 Object Storage HEAD에 실패했습니다.";
    return {
      ok: false,
      code: "DOWNLOAD_OBJECT_STREAM_FAILED",
      message,
      latencyMs: Date.now() - started,
    };
  }
  if (!head.exists) {
    return {
      ok: false,
      code: "DOWNLOAD_OBJECT_NOT_FOUND",
      message: "Object Storage에서 원본문서를 찾을 수 없습니다.",
      latencyMs: Date.now() - started,
    };
  }
  if (head.contentLength != null && head.contentLength !== expectedSize) {
    return {
      ok: false,
      code: "DOWNLOAD_OBJECT_SIZE_MISMATCH",
      message: "Object Storage 파일 크기가 DB와 일치하지 않습니다.",
      latencyMs: Date.now() - started,
    };
  }

  let streamed;
  try {
    streamed = await storage.getObjectStream({ objectKey: input.objectKey });
  } catch {
    return {
      ok: false,
      code: "DOWNLOAD_OBJECT_STREAM_FAILED",
      message: "원본문서 Object Storage Stream open에 실패했습니다.",
      latencyMs: Date.now() - started,
    };
  }

  if (!input.mimeType?.trim()) {
    return {
      ok: false,
      code: "DOWNLOAD_MIME_MISMATCH",
      message: "원본문서 MIME이 없습니다.",
      latencyMs: Date.now() - started,
    };
  }

  const hash = createHash("sha256");
  let actualSize = 0;
  try {
    for await (const chunk of streamed.body) {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      actualSize += buf.byteLength;
      hash.update(buf);
    }
  } catch {
    return {
      ok: false,
      code: "DOWNLOAD_OBJECT_STREAM_FAILED",
      message: "원본문서 Stream 읽기에 실패했습니다.",
      latencyMs: Date.now() - started,
    };
  }

  if (actualSize !== expectedSize) {
    return {
      ok: false,
      code: "DOWNLOAD_OBJECT_SIZE_MISMATCH",
      message: "Stream으로 읽은 파일 크기가 DB와 일치하지 않습니다.",
      latencyMs: Date.now() - started,
    };
  }

  const actualChecksumSha256 = hash.digest("hex");
  if (actualChecksumSha256 !== expectedChecksum) {
    return {
      ok: false,
      code: "DOWNLOAD_OBJECT_CHECKSUM_MISMATCH",
      message: "원본문서 SHA-256이 DB와 일치하지 않습니다.",
      latencyMs: Date.now() - started,
    };
  }

  return {
    ok: true,
    fileId: input.fileId,
    fileName: input.originalFileName,
    mimeType: input.mimeType,
    fileSize: expectedSize,
    checksumSha256: expectedChecksum,
    actualSize,
    actualChecksumSha256,
    latencyMs: Date.now() - started,
  };
}
