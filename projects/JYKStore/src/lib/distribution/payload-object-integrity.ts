import { sha256Hex } from "@/lib/distribution/payload-checksum";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { PayloadStorage } from "@/lib/distribution/payload-storage";

/**
 * Read payload bytes from Object Storage and verify SHA-256 against DB value.
 */
export async function readAndVerifyPayloadObject(input: {
  storage: PayloadStorage;
  objectKey: string;
  expectedChecksumSha256: string;
  expectedFileSize?: number;
}): Promise<{ bytes: Uint8Array; checksumSha256: string }> {
  const head = await input.storage.head({ objectKey: input.objectKey });
  if (!head.exists) {
    throw new PayloadServiceError(
      "PAYLOAD_OBJECT_INTEGRITY_FAILED",
      "Payload 객체를 찾을 수 없습니다.",
      503,
    );
  }
  if (
    input.expectedFileSize != null &&
    head.contentLength != null &&
    head.contentLength !== input.expectedFileSize
  ) {
    throw new PayloadServiceError(
      "PAYLOAD_OBJECT_INTEGRITY_FAILED",
      "Payload 크기 검증에 실패했습니다.",
      503,
    );
  }
  if (
    head.checksumSha256Metadata &&
    head.checksumSha256Metadata !== input.expectedChecksumSha256
  ) {
    throw new PayloadServiceError(
      "PAYLOAD_OBJECT_INTEGRITY_FAILED",
      "Payload 메타데이터 Checksum 검증에 실패했습니다.",
      503,
    );
  }

  const got = await input.storage.get({ objectKey: input.objectKey });
  const actual = sha256Hex(got.bytes);
  if (actual !== input.expectedChecksumSha256) {
    throw new PayloadServiceError(
      "PAYLOAD_OBJECT_INTEGRITY_FAILED",
      "Payload 무결성 검증에 실패했습니다.",
      503,
    );
  }
  return { bytes: got.bytes, checksumSha256: actual };
}
