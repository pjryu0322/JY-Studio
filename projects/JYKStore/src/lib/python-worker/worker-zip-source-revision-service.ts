/**
 * P1 correction-engine: immutable Worker ZIP source revisions.
 *
 * - New Provider submissions create a checksum-keyed revision with a unique object key.
 * - Same checksum re-upload reuses the existing non-superseded revision (idempotent).
 * - Creating an UPLOADED revision does NOT move KnowledgePackVersion.currentSourceRevisionId.
 * - Legacy stable worker-request/source.zip is mirrored for compatibility and lazy backfill.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { ObjectStorageBackend } from "@/lib/object-storage/object-storage";
import { getConfiguredObjectStorage } from "@/lib/object-storage/object-storage-factory";
import {
  buildWorkerRequestSourceZipObjectKey,
  buildWorkerSourceRevisionZipObjectKey,
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

function resolveStorage(input: {
  env?: NodeJS.ProcessEnv;
  storage?: ObjectStorageBackend;
}): ObjectStorageBackend {
  return input.storage ?? getConfiguredObjectStorage(input.env);
}

function newRevisionId(): string {
  // cuid-compatible enough for object-key id charset (alnum + _ -)
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

/**
 * Store Provider ZIP as an immutable source revision.
 * Same checksum → reuse existing non-SUPERSEDED revision (no new row / no overwrite of prior bytes).
 * Different checksum → new revision; previous UPLOADED (non-current) revisions are SUPERSEDED.
 * Does not update KnowledgePackVersion.currentSourceRevisionId.
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

  const existingSameChecksum = await client.workerZipSourceRevision.findFirst({
    where: {
      versionId: input.versionId,
      checksumSha256,
      status: { in: ["UPLOADED", "PROCESSING", "READY"] },
    },
    orderBy: { revisionNo: "desc" },
  });
  if (existingSameChecksum) {
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

  const latest = await client.workerZipSourceRevision.findFirst({
    where: { versionId: input.versionId },
    orderBy: { revisionNo: "desc" },
    select: { revisionNo: true },
  });
  const revisionNo = (latest?.revisionNo ?? 0) + 1;
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
    if (previousUploaded.length > 0) {
      await tx.workerZipSourceRevision.updateMany({
        where: { id: { in: previousUploaded.map((row) => row.id) } },
        data: { status: "SUPERSEDED", supersededAt: now },
      });
    }
    const supersedesRevisionId = previousUploaded[0]?.id ?? null;
    return tx.workerZipSourceRevision.create({
      data: {
        id: revisionId,
        clientId: input.clientId,
        packId: input.packId,
        versionId: input.versionId,
        revisionNo,
        storageKey,
        checksumSha256,
        sizeBytes: input.bytes.byteLength,
        originalFileName: input.originalFileName,
        submittedById: input.submittedById,
        reason: input.reason ?? "PROVIDER_UPLOAD",
        status: "UPLOADED",
        supersedesRevisionId,
      },
    });
  });

  await writeLegacyMirror({
    storage,
    packId: input.packId,
    versionId: input.versionId,
    bytes: input.bytes,
    checksumSha256,
    originalFileName: input.originalFileName,
    uploadedByUserId: input.submittedById,
    sourceRevisionId: created.id,
    now,
  });

  return mapRevision(created, false);
}

/**
 * If no revision rows exist but the legacy stable ZIP key is present, create revision 1
 * pointing at that legacy storage key (lazy backfill). Does not change current pointer.
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
  if (existing) return mapRevision(existing as WorkerZipSourceRevisionRow, true);

  const storage = resolveStorage(input);
  const legacyZipKey = buildWorkerRequestSourceZipObjectKey({
    prefix: DEFAULT_OBJECT_STORAGE_PREFIX,
    packId: input.packId,
    packVersionId: input.versionId,
  });

  let bytes: Uint8Array;
  let meta: (WorkerZipRequestMetadata & { sourceRevisionId?: string }) | null = null;
  try {
    const zip = await storage.getObject({ objectKey: legacyZipKey });
    bytes = zip.bytes;
  } catch {
    return null;
  }
  try {
    const metaRes = await storage.getObject({
      objectKey: legacyZipKey.replace(/source\.zip$/, "request.json"),
    });
    meta = JSON.parse(new TextDecoder().decode(metaRes.bytes)) as WorkerZipRequestMetadata;
  } catch {
    meta = null;
  }

  const checksumSha256 =
    meta?.checksumSha256 ?? createHash("sha256").update(bytes).digest("hex");
  const revisionId = newRevisionId();
  const created = await table.create({
    data: {
      id: revisionId,
      clientId: input.clientId ?? null,
      packId: input.packId,
      versionId: input.versionId,
      revisionNo: 1,
      // Keep legacy key so existing bytes remain the revision storage target.
      storageKey: legacyZipKey,
      checksumSha256,
      sizeBytes: bytes.byteLength,
      originalFileName: meta?.originalFileName ?? "source.zip",
      submittedById: meta?.uploadedByUserId ?? null,
      reason: "LEGACY_STABLE_KEY_BACKFILL",
      status: "UPLOADED",
    },
  });
  return mapRevision(created as WorkerZipSourceRevisionRow, false);
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

export async function getWorkerZipSourceRevisionBytes(input: {
  revision: Pick<WorkerZipSourceRevisionRecord, "storageKey">;
  packId: string;
  versionId: string;
  env?: NodeJS.ProcessEnv;
  storage?: ObjectStorageBackend;
}): Promise<Uint8Array | null> {
  const storage = resolveStorage(input);
  try {
    const res = await storage.getObject({ objectKey: input.revision.storageKey });
    return res.bytes;
  } catch {
    return null;
  }
}

/** Mark revision PROCESSING when Admin generation starts. */
export async function markWorkerZipSourceRevisionProcessing(input: {
  revisionId: string;
  prismaClient?: PrismaClientLike;
}): Promise<void> {
  const client = input.prismaClient ?? prisma;
  const table = (client as { workerZipSourceRevision?: PrismaClientLike["workerZipSourceRevision"] })
    .workerZipSourceRevision;
  if (!table?.updateMany) return;
  await table.updateMany({
    where: { id: input.revisionId, status: { in: ["UPLOADED", "PROCESSING"] } },
    data: { status: "PROCESSING" },
  });
}

/**
 * After successful import: mark revision READY and set it as the version's current
 * source revision. Does not delete prior revision objects or SourceDocuments.
 */
export async function activateWorkerZipSourceRevision(input: {
  revisionId: string;
  versionId: string;
  prismaClient?: PrismaClientLike;
  now?: () => Date;
}): Promise<void> {
  const client = input.prismaClient ?? prisma;
  const table = (client as { workerZipSourceRevision?: PrismaClientLike["workerZipSourceRevision"] })
    .workerZipSourceRevision;
  if (!table?.update || !client.knowledgePackVersion?.update) return;
  const now = input.now?.() ?? new Date();
  if (typeof client.$transaction === "function") {
    await client.$transaction(async (tx) => {
      const txTable = (tx as { workerZipSourceRevision: typeof table }).workerZipSourceRevision;
      await txTable.update({
        where: { id: input.revisionId },
        data: { status: "READY", readyAt: now },
      });
      await (tx as typeof client).knowledgePackVersion.update({
        where: { id: input.versionId },
        data: { currentSourceRevisionId: input.revisionId },
      });
    });
    return;
  }
  await table.update({
    where: { id: input.revisionId },
    data: { status: "READY", readyAt: now },
  });
  await client.knowledgePackVersion.update({
    where: { id: input.versionId },
    data: { currentSourceRevisionId: input.revisionId },
  });
}
