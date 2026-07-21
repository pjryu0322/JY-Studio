/**
 * P7.3: storage for the Provider-submitted "지식데이터 생성 요청" ZIP.
 *
 * The Provider only ATTACHES a ZIP and requests generation — they never run the
 * Worker. This module persists that requested ZIP (plus a small sidecar metadata
 * JSON) to Object Storage under a stable per-version key so an Admin can later
 * download it and execute the Worker from the Admin review screen.
 *
 * No schema change: request state is approximated from (a) the stored object's
 * presence + metadata and (b) existing PipelineRun history. A formal request
 * status column is a P8 follow-up (see docs/python-worker-zip-import.md).
 */
import { createHash } from "node:crypto";
import type { ObjectStorageBackend } from "@/lib/object-storage/object-storage";
import { getConfiguredObjectStorage } from "@/lib/object-storage/object-storage-factory";
import { buildWorkerRequestSourceZipObjectKey } from "@/lib/python-worker/worker-output-object-keys";

const DEFAULT_OBJECT_STORAGE_PREFIX = "payloads";

export type WorkerZipRequestMetadata = {
  originalFileName: string;
  fileSize: number;
  checksumSha256: string;
  /** ISO 8601 timestamp of the request submission. */
  uploadedAt: string;
  uploadedByUserId: string;
};

export type WorkerZipRequestLocator = {
  packId: string;
  packVersionId: string;
  env?: NodeJS.ProcessEnv;
  storage?: ObjectStorageBackend;
};

function resolveStorage(locator: {
  env?: NodeJS.ProcessEnv;
  storage?: ObjectStorageBackend;
}): ObjectStorageBackend {
  return locator.storage ?? getConfiguredObjectStorage(locator.env);
}

function zipKeyFor(packId: string, packVersionId: string): string {
  return buildWorkerRequestSourceZipObjectKey({
    prefix: DEFAULT_OBJECT_STORAGE_PREFIX,
    packId,
    packVersionId,
  });
}

function metaKeyFor(zipKey: string): string {
  return zipKey.replace(/source\.zip$/, "request.json");
}

export type StoreWorkerZipRequestInput = WorkerZipRequestLocator & {
  bytes: Uint8Array;
  originalFileName: string;
  uploadedByUserId: string;
  now?: () => Date;
};

export type StoredWorkerZipRequest = WorkerZipRequestMetadata & { objectKey: string };

/** Persist the requested ZIP + metadata sidecar. Overwrites any prior request. */
export async function storeWorkerZipRequest(
  input: StoreWorkerZipRequestInput,
): Promise<StoredWorkerZipRequest> {
  const storage = resolveStorage(input);
  const objectKey = zipKeyFor(input.packId, input.packVersionId);
  const checksumSha256 = createHash("sha256").update(input.bytes).digest("hex");

  await storage.putSmallObject({
    packId: input.packId,
    versionId: input.packVersionId,
    payloadId: "worker-request",
    originalFileName: input.originalFileName,
    mimeType: "application/zip",
    bytes: input.bytes,
    checksumSha256,
    objectKey,
  });

  const metadata: WorkerZipRequestMetadata = {
    originalFileName: input.originalFileName,
    fileSize: input.bytes.byteLength,
    checksumSha256,
    uploadedAt: (input.now?.() ?? new Date()).toISOString(),
    uploadedByUserId: input.uploadedByUserId,
  };
  const metaBytes = new TextEncoder().encode(JSON.stringify(metadata));
  await storage.putSmallObject({
    packId: input.packId,
    versionId: input.packVersionId,
    payloadId: "worker-request-meta",
    originalFileName: "request.json",
    mimeType: "application/json",
    bytes: metaBytes,
    checksumSha256: createHash("sha256").update(metaBytes).digest("hex"),
    objectKey: metaKeyFor(objectKey),
  });

  return { ...metadata, objectKey };
}

/** Read the request metadata sidecar, or null when no request exists. */
export async function getWorkerZipRequestMetadata(
  locator: WorkerZipRequestLocator,
): Promise<WorkerZipRequestMetadata | null> {
  const storage = resolveStorage(locator);
  const objectKey = zipKeyFor(locator.packId, locator.packVersionId);
  try {
    const res = await storage.getObject({ objectKey: metaKeyFor(objectKey) });
    const parsed = JSON.parse(new TextDecoder().decode(res.bytes)) as WorkerZipRequestMetadata;
    if (parsed && typeof parsed.originalFileName === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Read the requested ZIP bytes for Admin execution, or null when absent. */
export async function getWorkerZipRequestBytes(
  locator: WorkerZipRequestLocator,
): Promise<Uint8Array | null> {
  const storage = resolveStorage(locator);
  const objectKey = zipKeyFor(locator.packId, locator.packVersionId);
  try {
    const res = await storage.getObject({ objectKey });
    return res.bytes;
  } catch {
    return null;
  }
}

/**
 * Remove the requested ZIP + metadata sidecar (Provider "요청 회수"). Best-effort:
 * a missing object is treated as already gone rather than an error.
 */
export async function deleteWorkerZipRequest(
  locator: WorkerZipRequestLocator,
): Promise<void> {
  const storage = resolveStorage(locator);
  const objectKey = zipKeyFor(locator.packId, locator.packVersionId);
  await Promise.all([
    storage.deleteObject({ objectKey }).catch(() => undefined),
    storage.deleteObject({ objectKey: metaKeyFor(objectKey) }).catch(() => undefined),
  ]);
}
