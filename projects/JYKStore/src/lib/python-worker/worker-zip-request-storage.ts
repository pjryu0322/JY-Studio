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

/** P7.5: Admin rejection record kept on the request sidecar (no schema change). */
export type WorkerZipRequestRejection = {
  reason: string;
  /** ISO 8601 timestamp of the rejection. */
  rejectedAt: string;
  rejectedByUserId: string;
  /**
   * Set when the Provider confirms they have seen the rejection.
   * Until then, Admin may cancel (undo) the rejection.
   */
  acknowledgedAt?: string;
  acknowledgedByUserId?: string;
  /** PipelineRun ids retired to SKIPPED at reject time (for cancel restore). */
  retiredMarkerIds?: string[];
  /** Marker status before reject — restored on cancel. */
  previousMarkerStatus?: "PENDING" | "RUNNING" | "PASS";
};

/** Admin 사전정리에서 선택한 제외 경로 (request.json sidecar, no schema change). */
export type WorkerZipAdminPreflightExclusionItem = {
  path: string;
  /** Admin이 기재한 제외사유 (필수 저장). */
  reason: string;
};

export type WorkerZipAdminPreflightExclusions = {
  /** Excluded ZIP paths — consumed by Worker generation. */
  paths: string[];
  /** Path → 제외사유. Older sidecars may omit this. */
  reasons?: Record<string, string>;
  /** Structured items (preferred). When present, paths/reasons are derived from it. */
  items?: WorkerZipAdminPreflightExclusionItem[];
  savedAt: string;
  savedByUserId: string;
};

export type WorkerZipRequestMetadata = {
  originalFileName: string;
  fileSize: number;
  checksumSha256: string;
  /** ISO 8601 timestamp of the request submission. */
  uploadedAt: string;
  uploadedByUserId: string;
  /**
   * P7.5: set when an Admin rejects the request. The original ZIP is preserved
   * for audit; a fresh Provider submission overwrites this sidecar (clearing it).
   */
  rejection?: WorkerZipRequestRejection;
  /** Admin 사전정리 제외 선택. Fresh Provider re-upload clears this with the sidecar. */
  adminPreflightExclusions?: WorkerZipAdminPreflightExclusions;
  /** P1: immutable source revision that owns the request ZIP bytes. */
  sourceRevisionId?: string;
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

async function writeRequestMetadata(
  input: WorkerZipRequestLocator & { metadata: WorkerZipRequestMetadata },
): Promise<WorkerZipRequestMetadata> {
  const storage = resolveStorage(input);
  const objectKey = zipKeyFor(input.packId, input.packVersionId);
  const metaBytes = new TextEncoder().encode(JSON.stringify(input.metadata));
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
  return input.metadata;
}

/**
 * P7.5: Admin "자료 반려" — attach a rejection record to the request sidecar while
 * KEEPING the original ZIP (audit/traceability). Returns the updated metadata, or
 * null when there is no request to reject.
 */
export async function markWorkerZipRequestRejected(
  input: WorkerZipRequestLocator & {
    reason: string;
    rejectedByUserId: string;
    now?: () => Date;
    retiredMarkerIds?: string[];
    previousMarkerStatus?: "PENDING" | "RUNNING" | "PASS";
  },
): Promise<WorkerZipRequestMetadata | null> {
  const existing = await getWorkerZipRequestMetadata(input);
  if (!existing) return null;

  const updated: WorkerZipRequestMetadata = {
    ...existing,
    rejection: {
      reason: input.reason,
      rejectedAt: (input.now?.() ?? new Date()).toISOString(),
      rejectedByUserId: input.rejectedByUserId,
      ...(input.retiredMarkerIds?.length
        ? { retiredMarkerIds: [...input.retiredMarkerIds] }
        : {}),
      ...(input.previousMarkerStatus
        ? { previousMarkerStatus: input.previousMarkerStatus }
        : {}),
    },
  };
  return writeRequestMetadata({ ...input, metadata: updated });
}

/**
 * Clear Admin rejection from the sidecar (반려 취소). Keeps the ZIP.
 * Returns updated metadata, or null when no request / no rejection exists.
 */
export async function clearWorkerZipRequestRejection(
  locator: WorkerZipRequestLocator,
): Promise<WorkerZipRequestMetadata | null> {
  const existing = await getWorkerZipRequestMetadata(locator);
  if (!existing?.rejection) return null;
  const { rejection: _removed, ...rest } = existing;
  return writeRequestMetadata({ ...locator, metadata: rest });
}

/**
 * Provider confirms they have read the rejection reason. After this, Admin
 * cannot cancel the rejection.
 */
export async function acknowledgeWorkerZipRequestRejection(
  input: WorkerZipRequestLocator & {
    acknowledgedByUserId: string;
    now?: () => Date;
  },
): Promise<WorkerZipRequestMetadata | null> {
  const existing = await getWorkerZipRequestMetadata(input);
  if (!existing?.rejection) return null;
  if (existing.rejection.acknowledgedAt) return existing;

  const updated: WorkerZipRequestMetadata = {
    ...existing,
    rejection: {
      ...existing.rejection,
      acknowledgedAt: (input.now?.() ?? new Date()).toISOString(),
      acknowledgedByUserId: input.acknowledgedByUserId,
    },
  };
  return writeRequestMetadata({ ...input, metadata: updated });
}

/**
 * Persist Admin 사전정리 exclusion path selections on the request sidecar.
 * Requires an existing request.json (ZIP request). Empty items clear the selection.
 */
export async function saveWorkerZipAdminPreflightExclusions(
  input: WorkerZipRequestLocator & {
    /** @deprecated Prefer `items` with reasons. */
    paths?: readonly string[];
    items?: readonly WorkerZipAdminPreflightExclusionItem[];
    savedByUserId: string;
    now?: () => Date;
  },
): Promise<WorkerZipRequestMetadata | null> {
  const existing = await getWorkerZipRequestMetadata(input);
  if (!existing) return null;

  const rawItems =
    input.items?.map((item) => ({
      path: item.path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim(),
      reason: item.reason.trim(),
    })) ??
    (input.paths ?? []).map((path) => ({
      path: path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim(),
      reason: "",
    }));

  const byPath = new Map<string, string>();
  for (const item of rawItems) {
    if (!item.path) continue;
    byPath.set(item.path, item.reason);
  }
  const normalizedItems = [...byPath.entries()]
    .map(([path, reason]) => ({ path, reason }))
    .sort((a, b) => a.path.localeCompare(b.path, "ko"));
  const normalizedPaths = normalizedItems.map((item) => item.path);
  const reasons: Record<string, string> = {};
  for (const item of normalizedItems) {
    if (item.reason) reasons[item.path] = item.reason;
  }

  const updated: WorkerZipRequestMetadata = {
    ...existing,
    adminPreflightExclusions:
      normalizedItems.length === 0
        ? undefined
        : {
            paths: normalizedPaths,
            items: normalizedItems,
            reasons,
            savedAt: (input.now?.() ?? new Date()).toISOString(),
            savedByUserId: input.savedByUserId,
          },
  };
  if (normalizedItems.length === 0) {
    delete updated.adminPreflightExclusions;
  }
  return writeRequestMetadata({ ...input, metadata: updated });
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
