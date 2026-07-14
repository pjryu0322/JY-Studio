import { parseObjectStorageConfig } from "@/lib/object-storage/object-storage-config";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { S3ObjectStorage } from "@/lib/object-storage/s3-object-storage";
import type { ObjectStorageBackend } from "@/lib/object-storage/object-storage";

let cached: ObjectStorageBackend | null = null;

/**
 * Production/default storage: S3 only. No local filesystem fallback.
 */
export function getConfiguredObjectStorage(
  env: NodeJS.ProcessEnv = process.env,
): ObjectStorageBackend {
  if (cached) return cached;
  const parsed = parseObjectStorageConfig(env);
  if (!parsed.ok) {
    throw new PayloadServiceError(
      "PAYLOAD_STORAGE_NOT_CONFIGURED",
      "Object Storage가 구성되지 않았습니다.",
      503,
    );
  }
  cached = new S3ObjectStorage(parsed.config);
  return cached;
}

/** @deprecated Prefer getConfiguredObjectStorage. */
export const getConfiguredPayloadStorage = getConfiguredObjectStorage;

/** Test helper — reset cached client between suites. */
export function resetObjectStorageCache(): void {
  cached = null;
}

/** @deprecated Prefer resetObjectStorageCache. */
export const resetPayloadStorageCache = resetObjectStorageCache;

export function setObjectStorageForTests(storage: ObjectStorageBackend | null): void {
  cached = storage;
}

/** @deprecated Prefer setObjectStorageForTests. */
export const setPayloadStorageForTests = setObjectStorageForTests;
