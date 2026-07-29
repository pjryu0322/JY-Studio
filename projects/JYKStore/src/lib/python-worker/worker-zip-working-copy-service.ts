/**
 * P1.1: per-execution Worker ZIP Working Copies.
 *
 * Originals stay immutable. Each Admin run copies the revision ZIP to a dedicated
 * Working Copy object, freezes Admin preflight exclusions in directiveSnapshot,
 * and streams only the Working Copy into the Worker temp workspace.
 */
import { createHash, randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { prisma } from "@/lib/prisma";
import type { ObjectStorageBackend } from "@/lib/object-storage/object-storage";
import { getConfiguredObjectStorage } from "@/lib/object-storage/object-storage-factory";
import { buildWorkerWorkingCopyZipObjectKey } from "@/lib/python-worker/worker-output-object-keys";
import {
  assertRevisionObjectIntegrity,
  type WorkerZipSourceRevisionRecord,
} from "@/lib/python-worker/worker-zip-source-revision-service";

const DEFAULT_OBJECT_STORAGE_PREFIX = "payloads";
const DIRECTIVE_SCHEMA_VERSION = "worker-working-copy-directives-v1";

type PrismaClientLike = typeof prisma;

export type WorkerZipWorkingCopyPurpose = "INITIAL_GENERATION" | "CORRECTION_REBUILD";
export type WorkerZipWorkingCopyStatus =
  | "CREATING"
  | "READY"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED";

export type AdminPreflightExclusion = {
  path: string;
  reason?: string | null;
};

export type WorkerWorkingCopyDirectiveSnapshot = {
  schemaVersion: typeof DIRECTIVE_SCHEMA_VERSION;
  sourceRevisionId: string;
  sourceArchiveChecksumSha256: string;
  adminPreflightExclusions: AdminPreflightExclusion[];
  correctionDraftId: null;
  createdAt: string;
  createdByUserId: string | null;
};

export type WorkerZipWorkingCopyRecord = {
  readonly id: string;
  readonly clientId: string;
  readonly packId: string;
  readonly versionId: string;
  readonly sourceRevisionId: string;
  readonly purpose: WorkerZipWorkingCopyPurpose;
  readonly status: WorkerZipWorkingCopyStatus;
  readonly storageKey: string;
  readonly checksumSha256: string;
  readonly sizeBytes: number;
  readonly idempotencyKey: string;
  readonly directiveSnapshot: WorkerWorkingCopyDirectiveSnapshot;
  readonly directiveChecksumSha256: string;
  readonly createdById: string | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly createdAt: Date;
  readonly readyAt: Date | null;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly reused: boolean;
};

export class WorkerZipWorkingCopyError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 409) {
    super(message);
    this.name = "WorkerZipWorkingCopyError";
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

function newWorkingCopyId(): string {
  return `swc_${randomBytes(12).toString("hex")}`;
}

function normalizeExclusionPath(raw: string): string {
  const normalized = raw.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (!normalized || normalized.includes("..") || normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    throw new WorkerZipWorkingCopyError(
      "WORKING_COPY_CREATE_FAILED",
      "제외 경로가 올바르지 않습니다.",
      400,
    );
  }
  return normalized;
}

function canonicalizeDirectiveSnapshot(
  snapshot: WorkerWorkingCopyDirectiveSnapshot,
): string {
  const exclusions = [...snapshot.adminPreflightExclusions]
    .map((row) => ({
      path: normalizeExclusionPath(row.path),
      reason: row.reason?.trim() || null,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    sourceRevisionId: snapshot.sourceRevisionId,
    sourceArchiveChecksumSha256: snapshot.sourceArchiveChecksumSha256,
    adminPreflightExclusions: exclusions,
    correctionDraftId: null,
    createdAt: snapshot.createdAt,
    createdByUserId: snapshot.createdByUserId,
  });
}

export function buildWorkerWorkingCopyDirectiveSnapshot(input: {
  sourceRevisionId: string;
  sourceArchiveChecksumSha256: string;
  adminExcludePaths?: string[];
  adminExclusionReasons?: Record<string, string>;
  createdByUserId?: string | null;
  createdAt?: Date;
}): { snapshot: WorkerWorkingCopyDirectiveSnapshot; checksumSha256: string } {
  const createdAt = (input.createdAt ?? new Date()).toISOString();
  const exclusions = (input.adminExcludePaths ?? []).map((path) => ({
    path: normalizeExclusionPath(path),
    reason: input.adminExclusionReasons?.[path]?.trim() || null,
  }));
  const snapshot: WorkerWorkingCopyDirectiveSnapshot = {
    schemaVersion: DIRECTIVE_SCHEMA_VERSION,
    sourceRevisionId: input.sourceRevisionId,
    sourceArchiveChecksumSha256: input.sourceArchiveChecksumSha256,
    adminPreflightExclusions: exclusions,
    correctionDraftId: null,
    createdAt,
    createdByUserId: input.createdByUserId ?? null,
  };
  const canonical = canonicalizeDirectiveSnapshot(snapshot);
  return {
    snapshot: JSON.parse(canonical) as WorkerWorkingCopyDirectiveSnapshot,
    checksumSha256: createHash("sha256").update(canonical).digest("hex"),
  };
}

export function buildWorkerWorkingCopyIdempotencyKey(input: {
  requestMarkerId: string;
  sourceRevisionId: string;
  directiveChecksumSha256: string;
  attemptKey: string;
}): string {
  return [
    input.requestMarkerId,
    input.sourceRevisionId,
    input.directiveChecksumSha256,
    input.attemptKey,
  ].join(":");
}

function mapWorkingCopy(
  row: {
    id: string;
    clientId: string;
    packId: string;
    versionId: string;
    sourceRevisionId: string;
    purpose: WorkerZipWorkingCopyPurpose;
    status: WorkerZipWorkingCopyStatus;
    storageKey: string;
    checksumSha256: string;
    sizeBytes: number;
    idempotencyKey: string;
    directiveSnapshot: unknown;
    directiveChecksumSha256: string;
    createdById: string | null;
    failureCode: string | null;
    failureMessage: string | null;
    createdAt: Date;
    readyAt: Date | null;
    startedAt: Date | null;
    finishedAt: Date | null;
  },
  reused: boolean,
): WorkerZipWorkingCopyRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    packId: row.packId,
    versionId: row.versionId,
    sourceRevisionId: row.sourceRevisionId,
    purpose: row.purpose,
    status: row.status,
    storageKey: row.storageKey,
    checksumSha256: row.checksumSha256,
    sizeBytes: row.sizeBytes,
    idempotencyKey: row.idempotencyKey,
    directiveSnapshot: row.directiveSnapshot as WorkerWorkingCopyDirectiveSnapshot,
    directiveChecksumSha256: row.directiveChecksumSha256,
    createdById: row.createdById,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    createdAt: row.createdAt,
    readyAt: row.readyAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    reused,
  };
}

/**
 * Create (or reuse by idempotency key) a Working Copy from an immutable source revision.
 */
export async function createWorkerZipWorkingCopyFromRevision(input: {
  clientId: string;
  packId: string;
  versionId: string;
  sourceRevision: Pick<
    WorkerZipSourceRevisionRecord,
    "id" | "storageKey" | "checksumSha256" | "sizeBytes" | "packId" | "versionId"
  >;
  purpose?: WorkerZipWorkingCopyPurpose;
  idempotencyKey: string;
  adminExcludePaths?: string[];
  adminExclusionReasons?: Record<string, string>;
  createdById?: string | null;
  env?: NodeJS.ProcessEnv;
  storage?: ObjectStorageBackend;
  prismaClient?: PrismaClientLike;
  now?: () => Date;
}): Promise<WorkerZipWorkingCopyRecord> {
  const client = input.prismaClient ?? prisma;
  const storage = resolveStorage(input);
  const now = input.now?.() ?? new Date();

  if (
    input.sourceRevision.packId !== input.packId ||
    input.sourceRevision.versionId !== input.versionId
  ) {
    throw new WorkerZipWorkingCopyError(
      "REQUEST_SOURCE_REVISION_MISMATCH",
      "요청된 원본 revision이 팩/버전과 일치하지 않습니다.",
      409,
    );
  }

  const existing = await client.workerZipWorkingCopy.findUnique({
    where: {
      versionId_idempotencyKey: {
        versionId: input.versionId,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  if (existing) {
    if (existing.status === "FAILED") {
      throw new WorkerZipWorkingCopyError(
        "WORKING_COPY_CREATE_FAILED",
        "실패한 Working Copy는 재사용할 수 없습니다. 새 실행을 시작하세요.",
        409,
      );
    }
    // P4.3.1: Accept/Inventory bind the version to the READY (or PROCESSING) WC immediately.
    if (existing.status === "READY" || existing.status === "PROCESSING") {
      await client.knowledgePackVersion.update({
        where: { id: input.versionId },
        data: { currentWorkingCopyId: existing.id },
      });
    }
    return mapWorkingCopy(existing, true);
  }

  await assertRevisionObjectIntegrity({
    storage,
    revision: input.sourceRevision,
  });

  const { snapshot, checksumSha256: directiveChecksumSha256 } =
    buildWorkerWorkingCopyDirectiveSnapshot({
      sourceRevisionId: input.sourceRevision.id,
      sourceArchiveChecksumSha256: input.sourceRevision.checksumSha256,
      adminExcludePaths: input.adminExcludePaths,
      adminExclusionReasons: input.adminExclusionReasons,
      createdByUserId: input.createdById ?? null,
      createdAt: now,
    });

  const workingCopyId = newWorkingCopyId();
  const storageKey = buildWorkerWorkingCopyZipObjectKey({
    prefix: DEFAULT_OBJECT_STORAGE_PREFIX,
    packId: input.packId,
    packVersionId: input.versionId,
    sourceRevisionId: input.sourceRevision.id,
    workingCopyId,
  });

  const created = await client.workerZipWorkingCopy.create({
    data: {
      id: workingCopyId,
      clientId: input.clientId,
      packId: input.packId,
      versionId: input.versionId,
      sourceRevisionId: input.sourceRevision.id,
      purpose: input.purpose ?? "INITIAL_GENERATION",
      status: "CREATING",
      storageKey,
      checksumSha256: input.sourceRevision.checksumSha256,
      sizeBytes: input.sourceRevision.sizeBytes,
      idempotencyKey: input.idempotencyKey,
      directiveSnapshot: snapshot,
      directiveChecksumSha256,
      createdById: input.createdById ?? null,
    },
  });

  try {
    if (typeof storage.copyObject !== "function") {
      throw new WorkerZipWorkingCopyError(
        "WORKING_COPY_CREATE_FAILED",
        "object storage가 server-side copy를 지원하지 않습니다.",
        503,
      );
    }
    await storage.copyObject({
      sourceObjectKey: input.sourceRevision.storageKey,
      destinationObjectKey: storageKey,
      expectedSizeBytes: input.sourceRevision.sizeBytes,
      expectedChecksumSha256: input.sourceRevision.checksumSha256,
      metadata: {
        "jyk-pack-id": input.packId,
        "jyk-version-id": input.versionId,
        "jyk-source-revision-id": input.sourceRevision.id,
        "jyk-working-copy-id": workingCopyId,
      },
    });

    const ready = await client.workerZipWorkingCopy.update({
      where: { id: workingCopyId },
      data: { status: "READY", readyAt: now },
    });
    // P4.3.1: Inventory/Generation require version.currentWorkingCopyId after Accept.
    // Pointer flips to SUCCEEDED activation still happen later via activateWorkerZipSourceRevision.
    await client.knowledgePackVersion.update({
      where: { id: input.versionId },
      data: { currentWorkingCopyId: workingCopyId },
    });
    return mapWorkingCopy(ready, false);
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 500) : "Working Copy 생성 실패";
    await client.workerZipWorkingCopy
      .update({
        where: { id: workingCopyId },
        data: {
          status: "FAILED",
          failureCode:
            error instanceof WorkerZipWorkingCopyError
              ? error.code
              : "WORKING_COPY_CREATE_FAILED",
          failureMessage: message,
          finishedAt: now,
        },
      })
      .catch(() => undefined);
    await storage.deleteObject({ objectKey: storageKey }).catch(() => undefined);
    if (error instanceof WorkerZipWorkingCopyError) throw error;
    throw new WorkerZipWorkingCopyError("WORKING_COPY_CREATE_FAILED", message, 500);
  }
}

export async function markWorkerZipWorkingCopyProcessing(input: {
  workingCopyId: string;
  prismaClient?: PrismaClientLike;
  now?: () => Date;
}): Promise<void> {
  const client = input.prismaClient ?? prisma;
  const now = input.now?.() ?? new Date();
  await client.workerZipWorkingCopy.updateMany({
    where: { id: input.workingCopyId, status: { in: ["READY", "PROCESSING"] } },
    data: { status: "PROCESSING", startedAt: now },
  });
}

export async function markWorkerZipWorkingCopyFailed(input: {
  workingCopyId: string;
  failureCode: string;
  failureMessage: string;
  prismaClient?: PrismaClientLike;
  now?: () => Date;
}): Promise<void> {
  const client = input.prismaClient ?? prisma;
  const now = input.now?.() ?? new Date();
  await client.workerZipWorkingCopy.updateMany({
    where: { id: input.workingCopyId, status: { not: "SUCCEEDED" } },
    data: {
      status: "FAILED",
      failureCode: input.failureCode,
      failureMessage: input.failureMessage.slice(0, 500),
      finishedAt: now,
    },
  });
}

/**
 * Stream Working Copy bytes to a temp file while verifying SHA-256.
 * Does not call getObject() (full buffer).
 */
export async function withVerifiedWorkingCopyTempFile<T>(input: {
  workingCopy: Pick<
    WorkerZipWorkingCopyRecord,
    "storageKey" | "checksumSha256" | "sizeBytes" | "id"
  >;
  env?: NodeJS.ProcessEnv;
  storage?: ObjectStorageBackend;
  fn: (inputZipPath: string) => Promise<T>;
}): Promise<T> {
  const storage = resolveStorage(input);
  let streamBody: Readable;
  try {
    const streamed = await storage.getObjectStream({
      objectKey: input.workingCopy.storageKey,
    });
    streamBody = streamed.body;
  } catch {
    throw new WorkerZipWorkingCopyError(
      "WORKING_COPY_STREAM_FAILED",
      "Working Copy object를 스트리밍할 수 없습니다.",
      500,
    );
  }

  const dir = await mkdtemp(join(tmpdir(), "jykstore-wc-"));
  const filePath = join(dir, "source.zip");
  const hash = createHash("sha256");
  let sizeBytes = 0;
  try {
    streamBody.on("data", (chunk: Buffer | string) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      hash.update(buf);
      sizeBytes += buf.byteLength;
    });
    await pipeline(streamBody, createWriteStream(filePath));
    const checksumSha256 = hash.digest("hex");
    if (
      checksumSha256 !== input.workingCopy.checksumSha256 ||
      sizeBytes !== input.workingCopy.sizeBytes
    ) {
      throw new WorkerZipWorkingCopyError(
        "WORKING_COPY_INTEGRITY_MISMATCH",
        "Working Copy checksum이 기록과 다릅니다.",
        409,
      );
    }
    return await input.fn(filePath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function adminExcludePathsFromDirectiveSnapshot(
  snapshot: WorkerWorkingCopyDirectiveSnapshot | null | undefined,
): string[] {
  if (!snapshot?.adminPreflightExclusions?.length) return [];
  return snapshot.adminPreflightExclusions.map((row) => row.path);
}

/**
 * Load Working Copy ZIP bytes for Inventory scan / fingerprint.
 * Prefer streaming paths for Worker execution; this is for metadata scans only.
 */
export async function getWorkerZipWorkingCopyBytes(input: {
  workingCopy: Pick<
    WorkerZipWorkingCopyRecord,
    "storageKey" | "checksumSha256" | "sizeBytes" | "id"
  >;
  env?: NodeJS.ProcessEnv;
  storage?: ObjectStorageBackend;
}): Promise<Uint8Array> {
  const storage = resolveStorage(input);
  try {
    const res = await storage.getObject({ objectKey: input.workingCopy.storageKey });
    const checksum = createHash("sha256").update(res.bytes).digest("hex");
    if (checksum !== input.workingCopy.checksumSha256) {
      throw new WorkerZipWorkingCopyError(
        "WORKING_COPY_INTEGRITY_MISMATCH",
        "Working Copy checksum이 기록과 다릅니다.",
        409,
      );
    }
    if (res.bytes.byteLength !== input.workingCopy.sizeBytes) {
      throw new WorkerZipWorkingCopyError(
        "WORKING_COPY_INTEGRITY_MISMATCH",
        "Working Copy 크기가 기록과 다릅니다.",
        409,
      );
    }
    return res.bytes;
  } catch (error) {
    if (error instanceof WorkerZipWorkingCopyError) throw error;
    throw new WorkerZipWorkingCopyError(
      "WORKING_COPY_OBJECT_MISSING",
      "Working Copy object를 읽을 수 없습니다.",
      404,
    );
  }
}

export async function getWorkerZipWorkingCopyById(input: {
  workingCopyId: string;
  prismaClient?: PrismaClientLike;
}): Promise<WorkerZipWorkingCopyRecord | null> {
  const client = input.prismaClient ?? prisma;
  const row = await client.workerZipWorkingCopy.findUnique({
    where: { id: input.workingCopyId },
  });
  if (!row) return null;
  return mapWorkingCopy(row, false);
}
