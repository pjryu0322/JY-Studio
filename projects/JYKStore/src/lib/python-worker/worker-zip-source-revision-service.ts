/**
 * P1.1 correction-engine: immutable Worker ZIP source revisions.
 *
 * - Authoritative storageKey is always a revision-specific object key (never stable mirror).
 * - Same version+checksum reuses one revision row (including SUPERSEDED).
 * - Creating an UPLOADED revision does NOT move currentSourceRevisionId / currentWorkingCopyId.
 * - Legacy stable worker-request/source.zip is mirrored for compatibility only.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { ObjectStorageBackend } from "@/lib/object-storage/object-storage";
import { getConfiguredObjectStorage } from "@/lib/object-storage/object-storage-factory";
import {
  buildWorkerRequestSourceZipObjectKey,
  buildWorkerSourceRevisionZipObjectKey,
  isWorkerRequestStableZipObjectKey,
} from "@/lib/python-worker/worker-output-object-keys";
import type { WorkerZipRequestMetadata } from "@/lib/python-worker/worker-zip-request-storage";

const DEFAULT_OBJECT_STORAGE_PREFIX = "payloads";

type PrismaClientLike = typeof prisma;

export type WorkerZipSourceRevisionStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "READY"
  | "REJECTED"
  | "SUPERSEDED";

type WorkerZipSourceRevisionRow = {
  id: string;
  clientId: string | null;
  packId: string;
  versionId: string;
  revisionNo: number;
  storageKey: string;
  checksumSha256: string;
  sizeBytes: number;
  originalFileName: string | null;
  submittedById: string | null;
  reason: string | null;
  status: WorkerZipSourceRevisionStatus;
  supersedesRevisionId: string | null;
  createdAt: Date;
  readyAt: Date | null;
  supersededAt: Date | null;
};

export type WorkerZipSourceRevisionRecord = {
  readonly id: string;
  readonly clientId: string | null;
  readonly packId: string;
  readonly versionId: string;
  readonly revisionNo: number;
  readonly storageKey: string;
  readonly checksumSha256: string;
  readonly sizeBytes: number;
  readonly originalFileName: string | null;
  readonly submittedById: string | null;
  readonly reason: string | null;
  readonly status: WorkerZipSourceRevisionStatus;
  readonly supersedesRevisionId: string | null;
  readonly createdAt: Date;
  readonly readyAt: Date | null;
  readonly supersededAt: Date | null;
  readonly reused: boolean;
};

export class WorkerZipSourceRevisionError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 409) {
    super(message);
    this.name = "WorkerZipSourceRevisionError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function resolveStorage(input: {
  env?: NodeJS.ProcessEnv;
  storage?: ObjectStorageBackend;
}): ObjectStorageBackend {
  return input.storage ?? getConfiguredObjectStorage(input.env);
}

function newRevisionId(): string {
  return `srev_${randomBytes(12).toString("hex")}`;
}

function mapRevision(
  row: WorkerZipSourceRevisionRow,
  reused: boolean,
): WorkerZipSourceRevisionRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    packId: row.packId,
    versionId: row.versionId,
    revisionNo: row.revisionNo,
    storageKey: row.storageKey,
    checksumSha256: row.checksumSha256,
    sizeBytes: row.sizeBytes,
    originalFileName: row.originalFileName,
    submittedById: row.submittedById,
    reason: row.reason,
    status: row.status,
    supersedesRevisionId: row.supersedesRevisionId,
    createdAt: row.createdAt,
    readyAt: row.readyAt,
    supersededAt: row.supersededAt,
    reused,
  };
}

async function assertRevisionObjectIntegrity(input: {
  storage: ObjectStorageBackend;
  revision: Pick<WorkerZipSourceRevisionRow, "storageKey" | "checksumSha256" | "sizeBytes">;
}): Promise<void> {
  if (isWorkerRequestStableZipObjectKey(input.revision.storageKey)) {
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_LEGACY_REPAIR_REQUIRED",
      "원본 revision이 가변 stable key를 가리키고 있어 복구가 필요합니다.",
      409,
    );
  }
  const head = await input.storage.headObject({ objectKey: input.revision.storageKey });
  if (!head.exists) {
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_OBJECT_MISSING",
      "원본 revision object를 찾을 수 없습니다.",
      404,
    );
  }
  if (head.contentLength != null && head.contentLength !== input.revision.sizeBytes) {
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_INTEGRITY_MISMATCH",
      "원본 revision 크기가 기록과 다릅니다.",
      409,
    );
  }
  if (
    head.checksumSha256Metadata &&
    head.checksumSha256Metadata !== input.revision.checksumSha256
  ) {
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_INTEGRITY_MISMATCH",
      "원본 revision checksum이 기록과 다릅니다.",
      409,
    );
  }
}

async function writeLegacyMirror(input: {
  storage: ObjectStorageBackend;
  packId: string;
  versionId: string;
  bytes: Uint8Array;
  checksumSha256: string;
  originalFileName: string;
  uploadedByUserId: string;
  sourceRevisionId: string;
  now: Date;
}): Promise<void> {
  const legacyZipKey = buildWorkerRequestSourceZipObjectKey({
    prefix: DEFAULT_OBJECT_STORAGE_PREFIX,
    packId: input.packId,
    packVersionId: input.versionId,
  });
  await input.storage.putSmallObject({
    packId: input.packId,
    versionId: input.versionId,
    payloadId: "worker-request",
    originalFileName: input.originalFileName,
    mimeType: "application/zip",
    bytes: input.bytes,
    checksumSha256: input.checksumSha256,
    objectKey: legacyZipKey,
  });

  const metadata: WorkerZipRequestMetadata & { sourceRevisionId?: string } = {
    originalFileName: input.originalFileName,
    fileSize: input.bytes.byteLength,
    checksumSha256: input.checksumSha256,
    uploadedAt: input.now.toISOString(),
    uploadedByUserId: input.uploadedByUserId,
    sourceRevisionId: input.sourceRevisionId,
  };
  const metaBytes = new TextEncoder().encode(JSON.stringify(metadata));
  await input.storage.putSmallObject({
    packId: input.packId,
    versionId: input.versionId,
    payloadId: "worker-request-meta",
    originalFileName: "request.json",
    mimeType: "application/json",
    bytes: metaBytes,
    checksumSha256: createHash("sha256").update(metaBytes).digest("hex"),
    objectKey: legacyZipKey.replace(/source\.zip$/, "request.json"),
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Store Provider ZIP as an immutable source revision.
 * Same checksum → reuse existing revision (any status except REJECTED when object intact).
 * Does not update KnowledgePackVersion.currentSourceRevisionId / currentWorkingCopyId.
 */
export async function storeWorkerZipSourceRevision(input: {
  packId: string;
  versionId: string;
  clientId: string;
  bytes: Uint8Array;
  originalFileName: string;
  submittedById: string;
  reason?: string | null;
  env?: NodeJS.ProcessEnv;
  storage?: ObjectStorageBackend;
  prismaClient?: PrismaClientLike;
  now?: () => Date;
}): Promise<WorkerZipSourceRevisionRecord> {
  const client = input.prismaClient ?? prisma;
  const storage = resolveStorage(input);
  const now = input.now?.() ?? new Date();
  const checksumSha256 = createHash("sha256").update(input.bytes).digest("hex");
  const sizeBytes = input.bytes.byteLength;

  const existingSameChecksum = await client.workerZipSourceRevision.findFirst({
    where: {
      versionId: input.versionId,
      checksumSha256,
    },
    orderBy: { revisionNo: "asc" },
  });
  if (existingSameChecksum) {
    if (isWorkerRequestStableZipObjectKey(existingSameChecksum.storageKey)) {
      const repaired = await repairUnsafeWorkerZipSourceRevisionStorageKey({
        revisionId: existingSameChecksum.id,
        env: input.env,
        storage,
        prismaClient: client,
      });
      await writeLegacyMirror({
        storage,
        packId: input.packId,
        versionId: input.versionId,
        bytes: input.bytes,
        checksumSha256,
        originalFileName: input.originalFileName,
        uploadedByUserId: input.submittedById,
        sourceRevisionId: repaired.id,
        now,
      });
      return { ...repaired, reused: true };
    }
    await assertRevisionObjectIntegrity({ storage, revision: existingSameChecksum });
    await writeLegacyMirror({
      storage,
      packId: input.packId,
      versionId: input.versionId,
      bytes: input.bytes,
      checksumSha256,
      originalFileName: input.originalFileName,
      uploadedByUserId: input.submittedById,
      sourceRevisionId: existingSameChecksum.id,
      now,
    });
    return mapRevision(existingSameChecksum, true);
  }

  const version = await client.knowledgePackVersion.findUnique({
    where: { id: input.versionId },
    select: { currentSourceRevisionId: true },
  });
  if (!version) {
    throw new Error(`KnowledgePackVersion not found: ${input.versionId}`);
  }

  const revisionId = newRevisionId();
  const storageKey = buildWorkerSourceRevisionZipObjectKey({
    prefix: DEFAULT_OBJECT_STORAGE_PREFIX,
    packId: input.packId,
    packVersionId: input.versionId,
    sourceRevisionId: revisionId,
  });

  await storage.putSmallObject({
    packId: input.packId,
    versionId: input.versionId,
    payloadId: "worker-source-revision",
    originalFileName: input.originalFileName,
    mimeType: "application/zip",
    bytes: input.bytes,
    checksumSha256,
    objectKey: storageKey,
  });

  try {
    const previousUploaded = await client.workerZipSourceRevision.findMany({
      where: {
        versionId: input.versionId,
        status: "UPLOADED",
        ...(version.currentSourceRevisionId
          ? { id: { not: version.currentSourceRevisionId } }
          : {}),
      },
      select: { id: true },
    });

    const created = await client.$transaction(async (tx) => {
      const latest = await tx.workerZipSourceRevision.findFirst({
        where: { versionId: input.versionId },
        orderBy: { revisionNo: "desc" },
        select: { revisionNo: true },
      });
      const revisionNo = (latest?.revisionNo ?? 0) + 1;

      const raced = await tx.workerZipSourceRevision.findFirst({
        where: { versionId: input.versionId, checksumSha256 },
      });
      if (raced) {
        return { raced: true as const, row: raced };
      }

      if (previousUploaded.length > 0) {
        await tx.workerZipSourceRevision.updateMany({
          where: { id: { in: previousUploaded.map((row) => row.id) } },
          data: { status: "SUPERSEDED", supersededAt: now },
        });
      }
      const supersedesRevisionId = previousUploaded[0]?.id ?? null;
      const row = await tx.workerZipSourceRevision.create({
        data: {
          id: revisionId,
          clientId: input.clientId,
          packId: input.packId,
          versionId: input.versionId,
          revisionNo,
          storageKey,
          checksumSha256,
          sizeBytes,
          originalFileName: input.originalFileName,
          submittedById: input.submittedById,
          reason: input.reason ?? "PROVIDER_UPLOAD",
          status: "UPLOADED",
          supersedesRevisionId,
        },
      });
      return { raced: false as const, row };
    });

    if (created.raced) {
      await storage.deleteObject({ objectKey: storageKey }).catch(() => undefined);
      await assertRevisionObjectIntegrity({ storage, revision: created.row });
      await writeLegacyMirror({
        storage,
        packId: input.packId,
        versionId: input.versionId,
        bytes: input.bytes,
        checksumSha256,
        originalFileName: input.originalFileName,
        uploadedByUserId: input.submittedById,
        sourceRevisionId: created.row.id,
        now,
      });
      return mapRevision(created.row, true);
    }

    await writeLegacyMirror({
      storage,
      packId: input.packId,
      versionId: input.versionId,
      bytes: input.bytes,
      checksumSha256,
      originalFileName: input.originalFileName,
      uploadedByUserId: input.submittedById,
      sourceRevisionId: created.row.id,
      now,
    });
    return mapRevision(created.row, false);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      await storage.deleteObject({ objectKey: storageKey }).catch(() => undefined);
      const winner = await client.workerZipSourceRevision.findFirst({
        where: { versionId: input.versionId, checksumSha256 },
      });
      if (winner) {
        await assertRevisionObjectIntegrity({ storage, revision: winner });
        await writeLegacyMirror({
          storage,
          packId: input.packId,
          versionId: input.versionId,
          bytes: input.bytes,
          checksumSha256,
          originalFileName: input.originalFileName,
          uploadedByUserId: input.submittedById,
          sourceRevisionId: winner.id,
          now,
        });
        return mapRevision(winner, true);
      }
    }
    await storage.deleteObject({ objectKey: storageKey }).catch(() => undefined);
    throw error;
  }
}

/**
 * Lazy backfill: copy legacy stable ZIP into a revision-dedicated key, then create the row.
 * Never stores the stable key as authoritative storageKey.
 */
export async function lazyBackfillWorkerZipSourceRevisionFromLegacy(input: {
  packId: string;
  versionId: string;
  clientId?: string | null;
  env?: NodeJS.ProcessEnv;
  storage?: ObjectStorageBackend;
  prismaClient?: PrismaClientLike;
}): Promise<WorkerZipSourceRevisionRecord | null> {
  const client = input.prismaClient ?? prisma;
  const table = (client as { workerZipSourceRevision?: PrismaClientLike["workerZipSourceRevision"] })
    .workerZipSourceRevision;
  if (!table?.findFirst || !table.create) return null;

  const existing = await table.findFirst({
    where: { versionId: input.versionId },
    orderBy: { revisionNo: "desc" },
  });
  if (existing) {
    const row = existing as WorkerZipSourceRevisionRow;
    if (isWorkerRequestStableZipObjectKey(row.storageKey)) {
      return repairUnsafeWorkerZipSourceRevisionStorageKey({
        revisionId: row.id,
        env: input.env,
        storage: input.storage,
        prismaClient: client,
      });
    }
    return mapRevision(row, true);
  }

  const storage = resolveStorage(input);
  if (typeof storage.copyObject !== "function") {
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_OBJECT_MISSING",
      "object storage가 server-side copy를 지원하지 않습니다.",
      503,
    );
  }

  const legacyZipKey = buildWorkerRequestSourceZipObjectKey({
    prefix: DEFAULT_OBJECT_STORAGE_PREFIX,
    packId: input.packId,
    packVersionId: input.versionId,
  });

  const head = await storage.headObject({ objectKey: legacyZipKey });
  if (!head.exists) return null;

  let meta: (WorkerZipRequestMetadata & { sourceRevisionId?: string }) | null = null;
  try {
    const metaRes = await storage.getObject({
      objectKey: legacyZipKey.replace(/source\.zip$/, "request.json"),
    });
    meta = JSON.parse(new TextDecoder().decode(metaRes.bytes)) as WorkerZipRequestMetadata;
  } catch {
    meta = null;
  }

  // Stream actual bytes to verify checksum without assuming sidecar is authoritative alone.
  const streamed = await storage.getObjectStream({ objectKey: legacyZipKey });
  const { createWriteStream } = await import("node:fs");
  const { mkdtemp, rm, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pipeline } = await import("node:stream/promises");
  const dir = await mkdtemp(join(tmpdir(), "jykstore-rev-backfill-"));
  const filePath = join(dir, "source.zip");
  let checksumSha256: string;
  let sizeBytes: number;
  try {
    const hash = createHash("sha256");
    streamed.body.on("data", (chunk: Buffer) => hash.update(chunk));
    await pipeline(streamed.body, createWriteStream(filePath));
    checksumSha256 = hash.digest("hex");
    const bytes = await readFile(filePath);
    sizeBytes = bytes.byteLength;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }

  if (meta?.checksumSha256 && meta.checksumSha256 !== checksumSha256) {
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_INTEGRITY_MISMATCH",
      "legacy ZIP checksum이 sidecar와 다릅니다.",
      409,
    );
  }

  const revisionId = newRevisionId();
  const storageKey = buildWorkerSourceRevisionZipObjectKey({
    prefix: DEFAULT_OBJECT_STORAGE_PREFIX,
    packId: input.packId,
    packVersionId: input.versionId,
    sourceRevisionId: revisionId,
  });

  await storage.copyObject({
    sourceObjectKey: legacyZipKey,
    destinationObjectKey: storageKey,
    expectedSizeBytes: sizeBytes,
    expectedChecksumSha256: checksumSha256,
    metadata: {
      "jyk-pack-id": input.packId,
      "jyk-version-id": input.versionId,
      "jyk-source-revision-id": revisionId,
    },
  });

  try {
    const created = await table.create({
      data: {
        id: revisionId,
        clientId: input.clientId ?? null,
        packId: input.packId,
        versionId: input.versionId,
        revisionNo: 1,
        storageKey,
        checksumSha256,
        sizeBytes,
        originalFileName: meta?.originalFileName ?? "source.zip",
        submittedById: meta?.uploadedByUserId ?? null,
        reason: "LEGACY_STABLE_KEY_BACKFILL",
        status: "UPLOADED",
      },
    });
    return mapRevision(created as WorkerZipSourceRevisionRow, false);
  } catch (error) {
    await storage.deleteObject({ objectKey: storageKey }).catch(() => undefined);
    if (isUniqueConstraintError(error)) {
      const winner = await table.findFirst({
        where: { versionId: input.versionId },
        orderBy: { revisionNo: "asc" },
      });
      if (winner) return mapRevision(winner as WorkerZipSourceRevisionRow, true);
    }
    throw error;
  }
}

/**
 * Repair P1 rows whose storageKey still points at the mutable stable mirror.
 */
export async function repairUnsafeWorkerZipSourceRevisionStorageKey(input: {
  revisionId: string;
  env?: NodeJS.ProcessEnv;
  storage?: ObjectStorageBackend;
  prismaClient?: PrismaClientLike;
}): Promise<WorkerZipSourceRevisionRecord> {
  const client = input.prismaClient ?? prisma;
  const storage = resolveStorage(input);
  const row = await client.workerZipSourceRevision.findUnique({
    where: { id: input.revisionId },
  });
  if (!row) {
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_OBJECT_MISSING",
      "복구할 revision을 찾을 수 없습니다.",
      404,
    );
  }
  if (!isWorkerRequestStableZipObjectKey(row.storageKey)) {
    return mapRevision(row, true);
  }
  if (typeof storage.copyObject !== "function") {
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_LEGACY_REPAIR_REQUIRED",
      "object storage가 server-side copy를 지원하지 않습니다.",
      503,
    );
  }

  const head = await storage.headObject({ objectKey: row.storageKey });
  if (!head.exists) {
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_OBJECT_MISSING",
      "stable ZIP object를 찾을 수 없어 revision을 복구할 수 없습니다.",
      404,
    );
  }

  const streamed = await storage.getObjectStream({ objectKey: row.storageKey });
  const hash = createHash("sha256");
  let sizeBytes = 0;
  for await (const chunk of streamed.body) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(buf);
    sizeBytes += buf.byteLength;
  }
  const actualChecksum = hash.digest("hex");
  if (actualChecksum !== row.checksumSha256 || sizeBytes !== row.sizeBytes) {
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_LEGACY_REPAIR_REQUIRED",
      "stable ZIP bytes가 revision 기록과 달라 자동 복구할 수 없습니다.",
      409,
    );
  }

  const destinationKey = buildWorkerSourceRevisionZipObjectKey({
    prefix: DEFAULT_OBJECT_STORAGE_PREFIX,
    packId: row.packId,
    packVersionId: row.versionId,
    sourceRevisionId: row.id,
  });

  await storage.copyObject({
    sourceObjectKey: row.storageKey,
    destinationObjectKey: destinationKey,
    expectedSizeBytes: row.sizeBytes,
    expectedChecksumSha256: row.checksumSha256,
    metadata: {
      "jyk-pack-id": row.packId,
      "jyk-version-id": row.versionId,
      "jyk-source-revision-id": row.id,
    },
  });

  const updated = await client.workerZipSourceRevision.update({
    where: { id: row.id },
    data: { storageKey: destinationKey },
  });
  return mapRevision(updated, false);
}

export async function getWorkerZipSourceRevisionById(input: {
  revisionId: string;
  clientId?: string | null;
  packId?: string;
  versionId?: string;
  prismaClient?: PrismaClientLike;
  requireSafeStorageKey?: boolean;
}): Promise<WorkerZipSourceRevisionRecord | null> {
  const client = input.prismaClient ?? prisma;
  const row = await client.workerZipSourceRevision.findFirst({
    where: {
      id: input.revisionId,
      ...(input.packId ? { packId: input.packId } : {}),
      ...(input.versionId ? { versionId: input.versionId } : {}),
    },
  });
  if (!row) return null;
  if (
    input.clientId &&
    row.clientId &&
    row.clientId !== input.clientId
  ) {
    return null;
  }
  if (input.requireSafeStorageKey !== false && isWorkerRequestStableZipObjectKey(row.storageKey)) {
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_LEGACY_REPAIR_REQUIRED",
      "원본 revision이 가변 stable key를 가리키고 있어 복구가 필요합니다.",
      409,
    );
  }
  return mapRevision(row, false);
}

export async function getLatestWorkerZipSourceRevision(input: {
  versionId: string;
  prismaClient?: PrismaClientLike;
}): Promise<WorkerZipSourceRevisionRecord | null> {
  const client = input.prismaClient ?? prisma;
  const table = (client as { workerZipSourceRevision?: PrismaClientLike["workerZipSourceRevision"] })
    .workerZipSourceRevision;
  if (!table?.findFirst) return null;
  const row = await table.findFirst({
    where: {
      versionId: input.versionId,
      status: { in: ["UPLOADED", "PROCESSING", "READY"] },
    },
    orderBy: { revisionNo: "desc" },
  });
  return row ? mapRevision(row as WorkerZipSourceRevisionRow, false) : null;
}

/**
 * @deprecated Prefer streaming Working Copy via getObjectStream. Kept for tiny test paths only.
 * Never falls back to the stable mirror key.
 */
export async function getWorkerZipSourceRevisionBytes(input: {
  revision: Pick<WorkerZipSourceRevisionRecord, "storageKey" | "checksumSha256" | "sizeBytes">;
  packId: string;
  versionId: string;
  env?: NodeJS.ProcessEnv;
  storage?: ObjectStorageBackend;
}): Promise<Uint8Array | null> {
  const storage = resolveStorage(input);
  if (isWorkerRequestStableZipObjectKey(input.revision.storageKey)) {
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_LEGACY_REPAIR_REQUIRED",
      "원본 revision이 가변 stable key를 가리키고 있어 복구가 필요합니다.",
      409,
    );
  }
  try {
    await assertRevisionObjectIntegrity({ storage, revision: input.revision });
    const res = await storage.getObject({ objectKey: input.revision.storageKey });
    const checksum = createHash("sha256").update(res.bytes).digest("hex");
    if (checksum !== input.revision.checksumSha256) {
      throw new WorkerZipSourceRevisionError(
        "SOURCE_REVISION_INTEGRITY_MISMATCH",
        "원본 revision checksum이 기록과 다릅니다.",
        409,
      );
    }
    return res.bytes;
  } catch (error) {
    if (error instanceof WorkerZipSourceRevisionError) throw error;
    throw new WorkerZipSourceRevisionError(
      "SOURCE_REVISION_OBJECT_MISSING",
      "원본 revision object를 읽을 수 없습니다.",
      404,
    );
  }
}

/** @deprecated Execution state belongs on Working Copy / PipelineRun (P1.1). No-op retained for callers. */
export async function markWorkerZipSourceRevisionProcessing(_input: {
  revisionId: string;
  prismaClient?: PrismaClientLike;
}): Promise<void> {
  // Intentionally no-op: originals must not store execution PROCESSING state.
}

/**
 * After successful import: mark revision READY and set current source + working copy pointers.
 */
export async function activateWorkerZipSourceRevision(input: {
  revisionId: string;
  versionId: string;
  workingCopyId?: string | null;
  prismaClient?: PrismaClientLike;
  now?: () => Date;
}): Promise<void> {
  const client = input.prismaClient ?? prisma;
  const now = input.now?.() ?? new Date();
  await client.$transaction(async (tx) => {
    await tx.workerZipSourceRevision.update({
      where: { id: input.revisionId },
      data: { status: "READY", readyAt: now },
    });
    await tx.knowledgePackVersion.update({
      where: { id: input.versionId },
      data: {
        currentSourceRevisionId: input.revisionId,
        ...(input.workingCopyId
          ? { currentWorkingCopyId: input.workingCopyId }
          : {}),
      },
    });
    if (input.workingCopyId) {
      await tx.workerZipWorkingCopy.update({
        where: { id: input.workingCopyId },
        data: { status: "SUCCEEDED", finishedAt: now },
      });
    }
  });
}

export { assertRevisionObjectIntegrity, isWorkerRequestStableZipObjectKey };
