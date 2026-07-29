import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import {
  buildWorkerRequestSourceZipObjectKey,
  buildWorkerSourceRevisionZipObjectKey,
  buildWorkerWorkingCopyZipObjectKey,
  isWorkerRequestStableZipObjectKey,
} from "../lib/python-worker/worker-output-object-keys.ts";
import {
  lazyBackfillWorkerZipSourceRevisionFromLegacy,
  repairUnsafeWorkerZipSourceRevisionStorageKey,
  storeWorkerZipSourceRevision,
} from "../lib/python-worker/worker-zip-source-revision-service.ts";
import {
  buildWorkerWorkingCopyDirectiveSnapshot,
  createWorkerZipWorkingCopyFromRevision,
  withVerifiedWorkingCopyTempFile,
} from "../lib/python-worker/worker-zip-working-copy-service.ts";
import { ensureWorkerSourceDocuments } from "../lib/python-worker/worker-source-document-service.ts";
import { InMemoryObjectStorage } from "../lib/object-storage/in-memory-object-storage.ts";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function makeRevisionPrisma(seed?: {
  currentSourceRevisionId?: string | null;
  currentWorkingCopyId?: string | null;
  revisions?: Array<{
    id: string;
    revisionNo: number;
    checksumSha256: string;
    status: string;
    storageKey: string;
    sizeBytes?: number;
    packId?: string;
    versionId?: string;
  }>;
  workingCopies?: Array<Record<string, unknown>>;
}) {
  const revisions = [...(seed?.revisions ?? [])];
  const workingCopies = [...(seed?.workingCopies ?? [])];
  let currentSourceRevisionId = seed?.currentSourceRevisionId ?? null;
  let currentWorkingCopyId = seed?.currentWorkingCopyId ?? null;
  const created: unknown[] = [];

  const api = {
    created,
    get revisions() {
      return revisions;
    },
    get workingCopies() {
      return workingCopies;
    },
    get currentSourceRevisionId() {
      return currentSourceRevisionId;
    },
    get currentWorkingCopyId() {
      return currentWorkingCopyId;
    },
    knowledgePackVersion: {
      async findUnique() {
        return { currentSourceRevisionId, currentWorkingCopyId };
      },
      async update({ data }: { data: Record<string, unknown> }) {
        if (typeof data.currentSourceRevisionId === "string") {
          currentSourceRevisionId = data.currentSourceRevisionId;
        }
        if (typeof data.currentWorkingCopyId === "string") {
          currentWorkingCopyId = data.currentWorkingCopyId;
        }
        return { id: "ver-1", currentSourceRevisionId, currentWorkingCopyId };
      },
    },
    workerZipSourceRevision: {
      async findFirst(args: {
        where?: {
          checksumSha256?: string;
          versionId?: string;
          status?: { in: string[] };
          id?: string;
        };
        orderBy?: { revisionNo: "asc" | "desc" };
        select?: { revisionNo: true };
      }) {
        let filtered = revisions.filter((row) => {
          if (args.where?.checksumSha256 && row.checksumSha256 !== args.where.checksumSha256) {
            return false;
          }
          if (args.where?.status?.in && !args.where.status.in.includes(row.status)) {
            return false;
          }
          if (args.where?.id && row.id !== args.where.id) return false;
          return true;
        });
        filtered.sort((a, b) =>
          args.where?.checksumSha256 || args.orderBy?.revisionNo === "asc"
            ? a.revisionNo - b.revisionNo
            : b.revisionNo - a.revisionNo,
        );
        if (args.orderBy?.revisionNo === "asc") {
          filtered = [...filtered].sort((a, b) => a.revisionNo - b.revisionNo);
        }
        const top = filtered[0];
        if (!top) return null;
        if (args.select?.revisionNo) return { revisionNo: top.revisionNo };
        return {
          id: top.id,
          clientId: "client-1",
          packId: top.packId ?? "pack-1",
          versionId: top.versionId ?? "ver-1",
          revisionNo: top.revisionNo,
          storageKey: top.storageKey,
          checksumSha256: top.checksumSha256,
          sizeBytes: top.sizeBytes ?? 9,
          originalFileName: "a.zip",
          submittedById: "user-1",
          reason: "PROVIDER_UPLOAD",
          status: top.status,
          supersedesRevisionId: null,
          createdAt: new Date("2026-07-27T00:00:00.000Z"),
          readyAt: null,
          supersededAt: null,
        };
      },
      async findUnique({ where }: { where: { id: string } }) {
        return this.findFirst({ where: { id: where.id } });
      },
      async findMany(args: { where?: { status?: string; id?: { not: string } } }) {
        return revisions
          .filter((row) => {
            if (args.where?.status && row.status !== args.where.status) return false;
            if (args.where?.id?.not && row.id === args.where.id.not) return false;
            return true;
          })
          .map((row) => ({ id: row.id }));
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row = {
          id: String(data.id),
          revisionNo: Number(data.revisionNo),
          checksumSha256: String(data.checksumSha256),
          status: String(data.status),
          storageKey: String(data.storageKey),
          sizeBytes: Number(data.sizeBytes ?? 0),
          packId: String(data.packId),
          versionId: String(data.versionId),
        };
        revisions.push(row);
        created.push(data);
        return {
          ...row,
          clientId: data.clientId ?? null,
          originalFileName: data.originalFileName ?? null,
          submittedById: data.submittedById ?? null,
          reason: data.reason ?? null,
          supersedesRevisionId: data.supersedesRevisionId ?? null,
          createdAt: new Date("2026-07-27T00:00:00.000Z"),
          readyAt: null,
          supersededAt: null,
        };
      },
      async updateMany() {
        return { count: 1 };
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const row = revisions.find((r) => r.id === where.id);
        if (!row) throw new Error("missing revision");
        if (data.status) row.status = String(data.status);
        if (data.storageKey) row.storageKey = String(data.storageKey);
        return {
          id: row.id,
          clientId: "client-1",
          packId: row.packId ?? "pack-1",
          versionId: row.versionId ?? "ver-1",
          revisionNo: row.revisionNo,
          storageKey: row.storageKey,
          checksumSha256: row.checksumSha256,
          sizeBytes: row.sizeBytes ?? 9,
          originalFileName: "a.zip",
          submittedById: "user-1",
          reason: "PROVIDER_UPLOAD",
          status: row.status,
          supersedesRevisionId: null,
          createdAt: new Date("2026-07-27T00:00:00.000Z"),
          readyAt: null,
          supersededAt: null,
        };
      },
    },
    workerZipWorkingCopy: {
      async findUnique({
        where,
      }: {
        where: { versionId_idempotencyKey?: { versionId: string; idempotencyKey: string } };
      }) {
        const key = where.versionId_idempotencyKey;
        if (!key) return null;
        return (
          workingCopies.find(
            (row) =>
              row.versionId === key.versionId && row.idempotencyKey === key.idempotencyKey,
          ) ?? null
        );
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row = { ...data };
        workingCopies.push(row);
        return row;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const row = workingCopies.find((r) => r.id === where.id);
        if (!row) throw new Error("missing wc");
        Object.assign(row, data);
        return row;
      },
      async updateMany() {
        return { count: 1 };
      },
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(api);
    },
  };
  return api;
}

describe("P1.1 working copy object keys", () => {
  it("keeps revision and working-copy keys distinct from stable mirror", () => {
    const legacy = buildWorkerRequestSourceZipObjectKey({
      prefix: "payloads",
      packId: "pack1",
      packVersionId: "ver1",
    });
    const revision = buildWorkerSourceRevisionZipObjectKey({
      prefix: "payloads",
      packId: "pack1",
      packVersionId: "ver1",
      sourceRevisionId: "srev_abc",
    });
    const wc = buildWorkerWorkingCopyZipObjectKey({
      prefix: "payloads",
      packId: "pack1",
      packVersionId: "ver1",
      sourceRevisionId: "srev_abc",
      workingCopyId: "swc_xyz",
    });
    assert.ok(isWorkerRequestStableZipObjectKey(legacy));
    assert.equal(isWorkerRequestStableZipObjectKey(revision), false);
    assert.notEqual(revision, wc);
    assert.match(wc, /\/working-copies\/swc_xyz\/source\.zip$/);
  });
});

describe("P1.1 store + reuse", () => {
  it("reuses same checksum including when prior revision is SUPERSEDED", async () => {
    const bytes = new TextEncoder().encode("zip-bytes");
    const checksum = sha256(bytes);
    const storageKey =
      "payloads/packs/pack-1/versions/ver-1/source-revisions/srev_existing/source.zip";
    const storage = new InMemoryObjectStorage();
    await storage.putSmallObject({
      packId: "pack-1",
      versionId: "ver-1",
      payloadId: "rev",
      originalFileName: "a.zip",
      mimeType: "application/zip",
      bytes,
      checksumSha256: checksum,
      objectKey: storageKey,
    });
    const prisma = makeRevisionPrisma({
      revisions: [
        {
          id: "srev_existing",
          revisionNo: 1,
          checksumSha256: checksum,
          status: "SUPERSEDED",
          storageKey,
          sizeBytes: bytes.byteLength,
        },
      ],
    });

    const reused = await storeWorkerZipSourceRevision({
      packId: "pack-1",
      versionId: "ver-1",
      clientId: "client-1",
      bytes,
      originalFileName: "a.zip",
      submittedById: "user-1",
      storage,
      prismaClient: prisma as never,
    });
    assert.equal(reused.reused, true);
    assert.equal(reused.id, "srev_existing");
    assert.equal(prisma.created.length, 0);
  });

  it("creates revision-dedicated key and does not flip current pointers", async () => {
    const bytes = new TextEncoder().encode("zip-bytes-v2");
    const storage = new InMemoryObjectStorage();
    const prisma = makeRevisionPrisma({
      currentSourceRevisionId: "srev_ready",
      currentWorkingCopyId: "swc_ready",
      revisions: [
        {
          id: "srev_ready",
          revisionNo: 1,
          checksumSha256: "aaa",
          status: "READY",
          storageKey: "payloads/packs/pack-1/versions/ver-1/source-revisions/srev_ready/source.zip",
        },
      ],
    });

    const created = await storeWorkerZipSourceRevision({
      packId: "pack-1",
      versionId: "ver-1",
      clientId: "client-1",
      bytes,
      originalFileName: "b.zip",
      submittedById: "user-1",
      storage,
      prismaClient: prisma as never,
    });

    assert.equal(created.reused, false);
    assert.equal(prisma.currentSourceRevisionId, "srev_ready");
    assert.equal(prisma.currentWorkingCopyId, "swc_ready");
    assert.equal(isWorkerRequestStableZipObjectKey(created.storageKey), false);
    assert.ok(storage.objects.has(created.storageKey));
  });
});

describe("P1.1 legacy backfill + repair", () => {
  it("backfills legacy stable ZIP into a revision-dedicated object key", async () => {
    const bytes = new TextEncoder().encode("legacy-zip");
    const checksum = sha256(bytes);
    const storage = new InMemoryObjectStorage();
    const legacyKey = buildWorkerRequestSourceZipObjectKey({
      prefix: "payloads",
      packId: "pack-1",
      packVersionId: "ver-1",
    });
    await storage.putSmallObject({
      packId: "pack-1",
      versionId: "ver-1",
      payloadId: "legacy",
      originalFileName: "source.zip",
      mimeType: "application/zip",
      bytes,
      checksumSha256: checksum,
      objectKey: legacyKey,
    });
    const meta = new TextEncoder().encode(
      JSON.stringify({
        originalFileName: "source.zip",
        fileSize: bytes.byteLength,
        checksumSha256: checksum,
        uploadedAt: "2026-07-27T00:00:00.000Z",
        uploadedByUserId: "user-1",
      }),
    );
    await storage.putSmallObject({
      packId: "pack-1",
      versionId: "ver-1",
      payloadId: "meta",
      originalFileName: "request.json",
      mimeType: "application/json",
      bytes: meta,
      checksumSha256: sha256(meta),
      objectKey: legacyKey.replace(/source\.zip$/, "request.json"),
    });

    const prisma = makeRevisionPrisma();
    const backfilled = await lazyBackfillWorkerZipSourceRevisionFromLegacy({
      packId: "pack-1",
      versionId: "ver-1",
      clientId: "client-1",
      storage,
      prismaClient: prisma as never,
    });
    assert.ok(backfilled);
    assert.equal(isWorkerRequestStableZipObjectKey(backfilled!.storageKey), false);
    assert.ok(storage.objects.has(backfilled!.storageKey));
    assert.deepEqual(
      storage.objects.get(backfilled!.storageKey)?.bytes,
      bytes,
    );

    // Overwrite stable key — revision bytes must remain.
    const overwritten = new TextEncoder().encode("new-upload");
    await storage.putSmallObject({
      packId: "pack-1",
      versionId: "ver-1",
      payloadId: "legacy2",
      originalFileName: "source.zip",
      mimeType: "application/zip",
      bytes: overwritten,
      checksumSha256: sha256(overwritten),
      objectKey: legacyKey,
    });
    assert.deepEqual(
      storage.objects.get(backfilled!.storageKey)?.bytes,
      bytes,
    );
  });

  it("repairs unsafe stable-key revision rows when checksum matches", async () => {
    const bytes = new TextEncoder().encode("repair-me");
    const checksum = sha256(bytes);
    const storage = new InMemoryObjectStorage();
    const legacyKey = buildWorkerRequestSourceZipObjectKey({
      prefix: "payloads",
      packId: "pack-1",
      packVersionId: "ver-1",
    });
    await storage.putSmallObject({
      packId: "pack-1",
      versionId: "ver-1",
      payloadId: "legacy",
      originalFileName: "source.zip",
      mimeType: "application/zip",
      bytes,
      checksumSha256: checksum,
      objectKey: legacyKey,
    });
    const prisma = makeRevisionPrisma({
      revisions: [
        {
          id: "srev_unsafe",
          revisionNo: 1,
          checksumSha256: checksum,
          status: "UPLOADED",
          storageKey: legacyKey,
          sizeBytes: bytes.byteLength,
        },
      ],
    });

    const repaired = await repairUnsafeWorkerZipSourceRevisionStorageKey({
      revisionId: "srev_unsafe",
      storage,
      prismaClient: prisma as never,
    });
    assert.equal(isWorkerRequestStableZipObjectKey(repaired.storageKey), false);
    assert.ok(storage.objects.has(repaired.storageKey));
  });

  it("refuses repair when stable bytes diverge from DB checksum", async () => {
    const storage = new InMemoryObjectStorage();
    const legacyKey = buildWorkerRequestSourceZipObjectKey({
      prefix: "payloads",
      packId: "pack-1",
      packVersionId: "ver-1",
    });
    const actual = new TextEncoder().encode("actual");
    await storage.putSmallObject({
      packId: "pack-1",
      versionId: "ver-1",
      payloadId: "legacy",
      originalFileName: "source.zip",
      mimeType: "application/zip",
      bytes: actual,
      checksumSha256: sha256(actual),
      objectKey: legacyKey,
    });
    const prisma = makeRevisionPrisma({
      revisions: [
        {
          id: "srev_unsafe",
          revisionNo: 1,
          checksumSha256: "deadbeef",
          status: "UPLOADED",
          storageKey: legacyKey,
          sizeBytes: 4,
        },
      ],
    });

    await assert.rejects(
      () =>
        repairUnsafeWorkerZipSourceRevisionStorageKey({
          revisionId: "srev_unsafe",
          storage,
          prismaClient: prisma as never,
        }),
      /자동 복구할 수 없습니다|LEGACY_REPAIR/,
    );
  });
});

describe("P1.1 working copy create + stream", () => {
  it("copies via copyObject and streams via getObjectStream without getObject", async () => {
    const bytes = new TextEncoder().encode("wc-source");
    const checksum = sha256(bytes);
    const storage = new InMemoryObjectStorage();
    const revisionKey =
      "payloads/packs/pack-1/versions/ver-1/source-revisions/srev_1/source.zip";
    await storage.putSmallObject({
      packId: "pack-1",
      versionId: "ver-1",
      payloadId: "rev",
      originalFileName: "a.zip",
      mimeType: "application/zip",
      bytes,
      checksumSha256: checksum,
      objectKey: revisionKey,
    });

    let getObjectCalls = 0;
    const guarded = Object.create(storage) as InMemoryObjectStorage;
    guarded.getObject = async (input) => {
      getObjectCalls += 1;
      throw new Error(`getObject forbidden for large path: ${input.objectKey}`);
    };
    guarded.copyObject = storage.copyObject.bind(storage);
    guarded.getObjectStream = storage.getObjectStream.bind(storage);
    guarded.headObject = storage.headObject.bind(storage);
    guarded.putSmallObject = storage.putSmallObject.bind(storage);
    guarded.deleteObject = storage.deleteObject.bind(storage);
    // Share the same backing map so copyObject writes are visible.

    const prisma = makeRevisionPrisma();
    const wc = await createWorkerZipWorkingCopyFromRevision({
      clientId: "client-1",
      packId: "pack-1",
      versionId: "ver-1",
      sourceRevision: {
        id: "srev_1",
        packId: "pack-1",
        versionId: "ver-1",
        storageKey: revisionKey,
        checksumSha256: checksum,
        sizeBytes: bytes.byteLength,
      },
      idempotencyKey: "marker:srev_1:dir:attempt1",
      adminExcludePaths: ["sample/legacy.js"],
      createdById: "admin-1",
      storage: guarded,
      prismaClient: prisma as never,
    });

    assert.equal(wc.status, "READY");
    assert.equal(prisma.currentWorkingCopyId, wc.id);
    assert.notEqual(wc.storageKey, revisionKey);
    assert.deepEqual(storage.objects.get(wc.storageKey)?.bytes, bytes);
    assert.equal(getObjectCalls, 0);
    assert.deepEqual(
      wc.directiveSnapshot.adminPreflightExclusions.map((r) => r.path),
      ["sample/legacy.js"],
    );

    // Original unchanged after "exclusion" snapshot.
    assert.deepEqual(storage.objects.get(revisionKey)?.bytes, bytes);

    const seenPath = await withVerifiedWorkingCopyTempFile({
      workingCopy: wc,
      storage: guarded,
      fn: async (path) => path,
    });
    assert.ok(seenPath.includes("source.zip"));
    assert.equal(getObjectCalls, 0);
  });

  it("creates distinct working copies for distinct exclusion snapshots", async () => {
    const bytes = new TextEncoder().encode("wc-source-2");
    const checksum = sha256(bytes);
    const storage = new InMemoryObjectStorage();
    const revisionKey =
      "payloads/packs/pack-1/versions/ver-1/source-revisions/srev_2/source.zip";
    await storage.putSmallObject({
      packId: "pack-1",
      versionId: "ver-1",
      payloadId: "rev",
      originalFileName: "a.zip",
      mimeType: "application/zip",
      bytes,
      checksumSha256: checksum,
      objectKey: revisionKey,
    });
    const prisma = makeRevisionPrisma();
    const rev = {
      id: "srev_2",
      packId: "pack-1",
      versionId: "ver-1",
      storageKey: revisionKey,
      checksumSha256: checksum,
      sizeBytes: bytes.byteLength,
    };
    const a = await createWorkerZipWorkingCopyFromRevision({
      clientId: "client-1",
      packId: "pack-1",
      versionId: "ver-1",
      sourceRevision: rev,
      idempotencyKey: "k-a",
      adminExcludePaths: [],
      storage,
      prismaClient: prisma as never,
    });
    const b = await createWorkerZipWorkingCopyFromRevision({
      clientId: "client-1",
      packId: "pack-1",
      versionId: "ver-1",
      sourceRevision: rev,
      idempotencyKey: "k-b",
      adminExcludePaths: ["x/y.js"],
      storage,
      prismaClient: prisma as never,
    });
    assert.notEqual(a.id, b.id);
    assert.notEqual(a.storageKey, b.storageKey);
    assert.notEqual(a.directiveChecksumSha256, b.directiveChecksumSha256);
  });

  it("directive checksum is stable for same normalized exclusions", () => {
    const one = buildWorkerWorkingCopyDirectiveSnapshot({
      sourceRevisionId: "srev_1",
      sourceArchiveChecksumSha256: "abc",
      adminExcludePaths: ["b/a.js", "a/c.js"],
      createdByUserId: "u1",
      createdAt: new Date("2026-07-27T00:00:00.000Z"),
    });
    const two = buildWorkerWorkingCopyDirectiveSnapshot({
      sourceRevisionId: "srev_1",
      sourceArchiveChecksumSha256: "abc",
      adminExcludePaths: ["a/c.js", "b/a.js"],
      createdByUserId: "u1",
      createdAt: new Date("2026-07-27T00:00:00.000Z"),
    });
    assert.equal(one.checksumSha256, two.checksumSha256);
  });
});

describe("P1.1 SourceDocument working-copy isolation", () => {
  it("does not let working copy B orphan-delete A documents", async () => {
    const docs: Array<Record<string, unknown>> = [
      {
        id: "doc-a",
        versionId: "ver-1",
        sourceRevisionId: "srev_1",
        workingCopyId: "swc_a",
        legacySourceType: "WORKER_ZIP_SOURCE",
        checksum: "c1",
        fileName: "a.md",
        content: "A",
      },
    ];
    const prisma = {
      sourceDocument: {
        async findFirst(args: { where: Record<string, unknown> }) {
          return (
            docs.find((d) => {
              if (d.versionId !== args.where.versionId) return false;
              if (d.sourceRevisionId !== args.where.sourceRevisionId) return false;
              if (d.workingCopyId !== args.where.workingCopyId) return false;
              if (args.where.checksum && d.checksum !== args.where.checksum) return false;
              return true;
            }) ?? null
          );
        },
        async create({ data }: { data: Record<string, unknown> }) {
          const row = { id: `doc-${docs.length + 1}`, ...data };
          docs.push(row);
          return { id: row.id };
        },
        async update() {
          return {};
        },
        async deleteMany(args: { where: Record<string, unknown> }) {
          const before = docs.length;
          for (let i = docs.length - 1; i >= 0; i -= 1) {
            const d = docs[i]!;
            if (d.versionId !== args.where.versionId) continue;
            if (d.sourceRevisionId !== args.where.sourceRevisionId) continue;
            if (d.workingCopyId !== args.where.workingCopyId) continue;
            if (
              Array.isArray((args.where as { id?: { notIn?: string[] } }).id?.notIn) &&
              (args.where as { id: { notIn: string[] } }).id.notIn.includes(String(d.id))
            ) {
              continue;
            }
            docs.splice(i, 1);
          }
          return { count: before - docs.length };
        },
      },
    };

    await ensureWorkerSourceDocuments({
      payload: {
        packId: "pack-1",
        packVersionId: "ver-1",
        inventory: [{ sourcePath: "b.md", sha256: "c2" }],
        sourceTraces: [],
        normalizedDocuments: [
          {
            sourcePath: "b.md",
            title: "B",
            text: "B content",
          },
        ],
      } as never,
      sourceRevisionId: "srev_1",
      workingCopyId: "swc_b",
      prismaClient: prisma as never,
    });

    assert.ok(docs.some((d) => d.id === "doc-a"));
    assert.ok(docs.some((d) => d.workingCopyId === "swc_b"));
  });
});

describe("P1.1 in-memory copyObject contract", () => {
  it("rejects destination overwrite with different bytes", async () => {
    const storage = new InMemoryObjectStorage();
    const src = new TextEncoder().encode("src");
    const dest = new TextEncoder().encode("other");
    await storage.putSmallObject({
      packId: "p",
      versionId: "v",
      payloadId: "1",
      originalFileName: "a.zip",
      mimeType: "application/zip",
      bytes: src,
      checksumSha256: sha256(src),
      objectKey: "src.zip",
    });
    await storage.putSmallObject({
      packId: "p",
      versionId: "v",
      payloadId: "2",
      originalFileName: "a.zip",
      mimeType: "application/zip",
      bytes: dest,
      checksumSha256: sha256(dest),
      objectKey: "dest.zip",
    });
    await assert.rejects(
      () =>
        storage.copyObject({
          sourceObjectKey: "src.zip",
          destinationObjectKey: "dest.zip",
          expectedSizeBytes: src.byteLength,
          expectedChecksumSha256: sha256(src),
          metadata: {},
        }),
      /already exists/,
    );
  });

  it("getObjectStream returns a Readable without requiring getObject callers", async () => {
    const storage = new InMemoryObjectStorage();
    const bytes = new TextEncoder().encode("stream-me");
    await storage.putSmallObject({
      packId: "p",
      versionId: "v",
      payloadId: "1",
      originalFileName: "a.zip",
      mimeType: "application/zip",
      bytes,
      checksumSha256: sha256(bytes),
      objectKey: "k.zip",
    });
    const streamed = await storage.getObjectStream({ objectKey: "k.zip" });
    assert.ok(streamed.body instanceof Readable);
  });
});
