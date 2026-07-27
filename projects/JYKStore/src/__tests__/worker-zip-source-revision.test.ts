import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import {
  buildWorkerRequestSourceZipObjectKey,
  buildWorkerSourceRevisionZipObjectKey,
} from "../lib/python-worker/worker-output-object-keys.ts";
import { storeWorkerZipSourceRevision } from "../lib/python-worker/worker-zip-source-revision-service.ts";

function makeMemoryStorage() {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    async putSmallObject(input: {
      objectKey?: string;
      bytes: Uint8Array;
      checksumSha256?: string;
    }): Promise<{ objectKey: string }> {
      const objectKey = input.objectKey ?? `auto-${objects.size}`;
      objects.set(objectKey, input.bytes);
      return { objectKey };
    },
    async getObject(input: { objectKey: string }): Promise<{ bytes: Uint8Array }> {
      const bytes = objects.get(input.objectKey);
      if (!bytes) throw new Error(`missing ${input.objectKey}`);
      return { bytes };
    },
    async headObject(input: { objectKey: string }) {
      const bytes = objects.get(input.objectKey);
      if (!bytes) return { exists: false };
      return {
        exists: true,
        contentLength: bytes.byteLength,
        checksumSha256Metadata: createHash("sha256").update(bytes).digest("hex"),
      };
    },
    async deleteObject(input: { objectKey: string }): Promise<void> {
      objects.delete(input.objectKey);
    },
  };
}

function makePrismaMock(seed?: {
  currentSourceRevisionId?: string | null;
  revisions?: Array<{
    id: string;
    revisionNo: number;
    checksumSha256: string;
    status: string;
    storageKey: string;
    sizeBytes?: number;
  }>;
}) {
  const revisions = [...(seed?.revisions ?? [])];
  let currentSourceRevisionId = seed?.currentSourceRevisionId ?? null;
  const created: unknown[] = [];
  const updatedMany: unknown[] = [];

  return {
    created,
    updatedMany,
    get revisions() {
      return revisions;
    },
    get currentSourceRevisionId() {
      return currentSourceRevisionId;
    },
    knowledgePackVersion: {
      async findUnique() {
        return { currentSourceRevisionId };
      },
      async update({ data }: { data: { currentSourceRevisionId?: string } }) {
        if (data.currentSourceRevisionId) {
          currentSourceRevisionId = data.currentSourceRevisionId;
        }
        return { id: "ver-1", currentSourceRevisionId };
      },
    },
    workerZipSourceRevision: {
      async findFirst(args: {
        where?: {
          checksumSha256?: string;
          status?: { in: string[] };
        };
        orderBy?: { revisionNo: "desc" };
        select?: { revisionNo: true };
      }) {
        const filtered = revisions.filter((row) => {
          if (args.where?.checksumSha256 && row.checksumSha256 !== args.where.checksumSha256) {
            return false;
          }
          if (args.where?.status?.in && !args.where.status.in.includes(row.status)) {
            return false;
          }
          return true;
        });
        filtered.sort((a, b) => b.revisionNo - a.revisionNo);
        const top = filtered[0];
        if (!top) return null;
        if (args.select?.revisionNo) return { revisionNo: top.revisionNo };
        return {
          id: top.id,
          clientId: "client-1",
          packId: "pack-1",
          versionId: "ver-1",
          revisionNo: top.revisionNo,
          storageKey: top.storageKey,
          checksumSha256: top.checksumSha256,
          sizeBytes: top.sizeBytes ?? 4,
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
        };
        revisions.push(row);
        created.push(data);
        return {
          ...row,
          clientId: data.clientId ?? null,
          packId: data.packId,
          versionId: data.versionId,
          sizeBytes: data.sizeBytes,
          originalFileName: data.originalFileName ?? null,
          submittedById: data.submittedById ?? null,
          reason: data.reason ?? null,
          supersedesRevisionId: data.supersedesRevisionId ?? null,
          createdAt: new Date("2026-07-27T00:00:00.000Z"),
          readyAt: null,
          supersededAt: null,
        };
      },
      async updateMany(args: unknown) {
        updatedMany.push(args);
        return { count: 1 };
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const row = revisions.find((r) => r.id === where.id);
        if (row && data.status) row.status = String(data.status);
        return row;
      },
    },
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return fn(this);
    },
  };
}

describe("worker source revision object keys", () => {
  it("keeps legacy stable key and adds immutable revision key", () => {
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
    assert.equal(legacy, "payloads/packs/pack1/versions/ver1/worker-request/source.zip");
    assert.equal(
      revision,
      "payloads/packs/pack1/versions/ver1/source-revisions/srev_abc/source.zip",
    );
    assert.notEqual(legacy, revision);
  });
});

describe("storeWorkerZipSourceRevision", () => {
  it("reuses the same checksum without creating a new revision", async () => {
    const bytes = new TextEncoder().encode("zip-bytes");
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const storage = makeMemoryStorage();
    const storageKey =
      "payloads/packs/pack-1/versions/ver-1/source-revisions/srev_existing/source.zip";
    storage.objects.set(storageKey, bytes);
    const prisma = makePrismaMock({
      revisions: [
        {
          id: "srev_existing",
          revisionNo: 1,
          checksumSha256: checksum,
          status: "UPLOADED",
          storageKey,
          sizeBytes: bytes.byteLength,
        },
      ],
    });

    const first = await storeWorkerZipSourceRevision({
      packId: "pack-1",
      versionId: "ver-1",
      clientId: "client-1",
      bytes,
      originalFileName: "a.zip",
      submittedById: "user-1",
      storage: storage as never,
      prismaClient: prisma as never,
    });
    assert.equal(first.reused, true);
    assert.equal(first.id, "srev_existing");
    assert.equal(prisma.created.length, 0);
  });

  it("creates a new revision for a different checksum and does not flip current pointer", async () => {
    const bytes = new TextEncoder().encode("zip-bytes-v2");
    const storage = makeMemoryStorage();
    const prisma = makePrismaMock({
      currentSourceRevisionId: "srev_ready",
      revisions: [
        {
          id: "srev_ready",
          revisionNo: 1,
          checksumSha256: "aaa",
          status: "READY",
          storageKey: "legacy-or-rev1",
        },
        {
          id: "srev_old_upload",
          revisionNo: 2,
          checksumSha256: "bbb",
          status: "UPLOADED",
          storageKey: "rev2",
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
      storage: storage as never,
      prismaClient: prisma as never,
    });

    assert.equal(created.reused, false);
    assert.equal(created.revisionNo, 3);
    assert.equal(created.status, "UPLOADED");
    assert.equal(prisma.currentSourceRevisionId, "srev_ready");
    assert.ok(created.storageKey.includes("/source-revisions/"));
    assert.ok(storage.objects.has(created.storageKey));
    assert.ok(
      storage.objects.has(
        buildWorkerRequestSourceZipObjectKey({
          prefix: "payloads",
          packId: "pack-1",
          packVersionId: "ver-1",
        }),
      ),
    );
  });
});
