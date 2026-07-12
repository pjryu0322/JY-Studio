import { parsePayloadStorageConfig } from "@/lib/distribution/payload-storage-config";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { S3PayloadStorage } from "@/lib/distribution/s3-payload-storage";
import type { PayloadStorage } from "@/lib/distribution/payload-storage";

let cached: PayloadStorage | null = null;

/**
 * Production/default storage: S3 only. No local filesystem fallback.
 */
export function getConfiguredPayloadStorage(
  env: NodeJS.ProcessEnv = process.env,
): PayloadStorage {
  if (cached) return cached;
  const parsed = parsePayloadStorageConfig(env);
  if (!parsed.ok) {
    throw new PayloadServiceError(
      "PAYLOAD_STORAGE_NOT_CONFIGURED",
      "Object Storage가 구성되지 않았습니다.",
      503,
    );
  }
  cached = new S3PayloadStorage(parsed.config);
  return cached;
}

/** Test helper — reset cached client between suites. */
export function resetPayloadStorageCache(): void {
  cached = null;
}

export function setPayloadStorageForTests(storage: PayloadStorage | null): void {
  cached = storage;
}
