import { parseObjectStorageConfig } from "@/lib/object-storage/object-storage-config";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { S3ObjectStorage } from "@/lib/object-storage/s3-object-storage";
import type { ObjectStorageBackend } from "@/lib/object-storage/object-storage";

/**
 * Production/default storage: S3 only. No local filesystem fallback.
 * Cache key bumps when client construction options that affect upload
 * (e.g. checksum defaults) change so hot reload recreates the client.
 */
const STORAGE_CACHE_GENERATION = 2;
let cached: { generation: number; storage: ObjectStorageBackend } | null = null;

export function getConfiguredObjectStorage(
  env: NodeJS.ProcessEnv = process.env,
): ObjectStorageBackend {
  if (cached && cached.generation === STORAGE_CACHE_GENERATION) {
    return cached.storage;
  }
  const parsed = parseObjectStorageConfig(env);
  if (!parsed.ok) {
    throw new PayloadServiceError(
      "PAYLOAD_STORAGE_NOT_CONFIGURED",
      "Object Storage가 구성되지 않았습니다.",
      503,
    );
  }
  cached = {
    generation: STORAGE_CACHE_GENERATION,
    storage: new S3ObjectStorage(parsed.config),
  };
  return cached.storage;
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
  cached = storage
    ? { generation: STORAGE_CACHE_GENERATION, storage }
    : null;
}

/** @deprecated Prefer setObjectStorageForTests. */
export const setPayloadStorageForTests = setObjectStorageForTests;
