import { sha256Hex } from "@/lib/object-storage/checksum";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { PayloadStorageCompat } from "@/lib/object-storage/object-storage";

const INTEGRITY_USER_MESSAGE = "다운로드 파일 무결성 검증에 실패했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * Read bytes from Object Storage and verify size + SHA-256 against expected values.
 * Does not expose storage keys in error messages.
 */
export async function readAndVerifyStoredObject(input: {
  storage: PayloadStorageCompat;
  objectKey: string;
  expectedChecksumSha256: string;
  expectedFileSize: number;
}): Promise<{
  bytes: Uint8Array;
  actualChecksumSha256: string;
  actualFileSize: number;
}> {
  const expectedSize = Number(input.expectedFileSize);
  if (!Number.isFinite(expectedSize) || expectedSize < 0) {
    throw new PayloadServiceError(
      "PAYLOAD_OBJECT_INTEGRITY_FAILED",
      INTEGRITY_USER_MESSAGE,
      502,
    );
  }

  const head = await input.storage.head({ objectKey: input.objectKey });
  if (!head.exists) {
    throw new PayloadServiceError(
      "PAYLOAD_NOT_FOUND",
      "Object Storage에서 파일을 찾을 수 없습니다.",
      404,
    );
  }
  if (head.contentLength != null && head.contentLength !== expectedSize) {
    throw new PayloadServiceError(
      "PAYLOAD_OBJECT_SIZE_MISMATCH",
      INTEGRITY_USER_MESSAGE,
      502,
    );
  }
  if (
    head.checksumSha256Metadata &&
    head.checksumSha256Metadata !== input.expectedChecksumSha256
  ) {
    throw new PayloadServiceError(
      "PAYLOAD_OBJECT_CHECKSUM_MISMATCH",
      INTEGRITY_USER_MESSAGE,
      502,
    );
  }

  let got;
  try {
    got = await input.storage.get({ objectKey: input.objectKey });
  } catch (error) {
    if (error instanceof PayloadServiceError) throw error;
    throw new PayloadServiceError(
      "PAYLOAD_STORAGE_UNAVAILABLE",
      "저장소에서 파일을 읽지 못했습니다.",
      502,
    );
  }

  const actualFileSize = got.bytes.byteLength;
  if (actualFileSize !== expectedSize) {
    throw new PayloadServiceError(
      "PAYLOAD_OBJECT_SIZE_MISMATCH",
      INTEGRITY_USER_MESSAGE,
      502,
    );
  }

  const actualChecksumSha256 = sha256Hex(got.bytes);
  if (actualChecksumSha256 !== input.expectedChecksumSha256) {
    throw new PayloadServiceError(
      "PAYLOAD_OBJECT_CHECKSUM_MISMATCH",
      INTEGRITY_USER_MESSAGE,
      502,
    );
  }

  return {
    bytes: got.bytes,
    actualChecksumSha256,
    actualFileSize,
  };
}

/**
 * Compatibility wrapper used by provider/admin ZIP payload downloads.
 */
export async function readAndVerifyPayloadObject(input: {
  storage: PayloadStorageCompat;
  objectKey: string;
  expectedChecksumSha256: string;
  expectedFileSize?: number;
}): Promise<{ bytes: Uint8Array; checksumSha256: string }> {
  if (input.expectedFileSize == null) {
    // Legacy callers without size: still verify checksum after GET.
    const head = await input.storage.head({ objectKey: input.objectKey });
    if (!head.exists) {
      throw new PayloadServiceError(
        "PAYLOAD_NOT_FOUND",
        "Object Storage에서 Payload를 찾을 수 없습니다.",
        404,
      );
    }
    const got = await input.storage.get({ objectKey: input.objectKey });
    const actual = sha256Hex(got.bytes);
    if (actual !== input.expectedChecksumSha256) {
      throw new PayloadServiceError(
        "PAYLOAD_OBJECT_CHECKSUM_MISMATCH",
        INTEGRITY_USER_MESSAGE,
        502,
      );
    }
    return { bytes: got.bytes, checksumSha256: actual };
  }

  const verified = await readAndVerifyStoredObject({
    storage: input.storage,
    objectKey: input.objectKey,
    expectedChecksumSha256: input.expectedChecksumSha256,
    expectedFileSize: input.expectedFileSize,
  });
  return { bytes: verified.bytes, checksumSha256: verified.actualChecksumSha256 };
}
