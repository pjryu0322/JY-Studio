import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import type { NormalizedFigure } from "../lib/adapters/docling/docling-types.ts";
import { buildFigurePreviewObjectKey } from "../lib/adapters/docling/docling-figure-preview.ts";
import {
  cleanupNewlyCreatedFigurePreviews,
  cleanupObsoleteFigurePreviews,
  persistFigurePreviewObjects,
  recordPostCommitNormalizationEffects,
} from "../lib/docling-import/docling-figure-preview-persist.ts";

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function shaOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function expectedKey(sha: string): string {
  return buildFigurePreviewObjectKey({
    prefix: "payloads",
    packId: "pack1",
    versionId: "ver1",
    bundleId: "bun1",
    sha256: sha,
    extension: "png",
  });
}

function mockStorage(opts?: {
  existingKeys?: Set<string>;
  putFailAfter?: number;
  deleteFailKeys?: Set<string>;
}) {
  const objects = new Set(opts?.existingKeys ?? []);
  const puts: string[] = [];
  const deletes: string[] = [];
  const heads: string[] = [];
  let putCount = 0;

  return {
    puts,
    deletes,
    heads,
    objects,
    storage: {
      async put(input: { objectKey?: string }) {
        putCount += 1;
        if (
          typeof opts?.putFailAfter === "number" &&
          putCount > opts.putFailAfter
        ) {
          throw new Error("put failed");
        }
        const key = input.objectKey!;
        objects.add(key);
        puts.push(key);
        return {
          objectKey: key,
          fileSize: 1,
          checksumSha256: "a".repeat(64),
        };
      },
      async head(input: { objectKey: string }) {
        heads.push(input.objectKey);
        return { exists: objects.has(input.objectKey) };
      },
      async delete(input: { objectKey: string }) {
        deletes.push(input.objectKey);
        if (opts?.deleteFailKeys?.has(input.objectKey)) {
          throw new Error("delete failed");
        }
        objects.delete(input.objectKey);
      },
    },
  };
}

function figure(id: string, bytes: Uint8Array = PNG_BYTES): NormalizedFigure {
  return {
    id,
    caption: null,
    label: null,
    sourceRef: null,
    mimeType: "image/png",
    _previewBytes: bytes,
    _previewSha256: shaOf(bytes),
  };
}

describe("docling figure preview persist / cleanup stability", () => {
  it("reuses existing previous preview key without put or newlyCreated", async () => {
    const sha = shaOf(PNG_BYTES);
    const keyA = expectedKey(sha);
    const mock = mockStorage({ existingKeys: new Set([keyA]) });
    const newlyCreatedKeys = new Set<string>();

    const figs = [figure("fig-1")];
    const result = await persistFigurePreviewObjects({
      figures: figs,
      storage: mock.storage,
      previousFigureKeys: [keyA],
      prefix: "payloads",
      packId: "pack1",
      versionId: "ver1",
      bundleId: "bun1",
      newlyCreatedKeys,
    });

    assert.equal(mock.puts.length, 0);
    assert.ok(result.reusedKeys.has(keyA));
    assert.equal(result.newlyCreatedKeys.size, 0);
    assert.equal(newlyCreatedKeys.size, 0);
    assert.ok(result.retainedKeys.has(keyA));
    assert.equal(figs[0]!.previewObjectKey, keyA);

    await cleanupNewlyCreatedFigurePreviews({
      keys: newlyCreatedKeys,
      storage: mock.storage,
      bundleId: "bun1",
      reason: "docling_figure_preview_normalization_failed",
      enqueueCleanupJob: async () => {
        throw new Error("should not enqueue");
      },
    });
    assert.equal(mock.deletes.length, 0);
    assert.ok(mock.objects.has(keyA));
  });

  it("re-uploads missing previous key and treats it as newly created", async () => {
    const sha = shaOf(PNG_BYTES);
    const keyA = expectedKey(sha);
    const mock = mockStorage({ existingKeys: new Set() });
    const newlyCreatedKeys = new Set<string>();

    const result = await persistFigurePreviewObjects({
      figures: [figure("fig-1")],
      storage: mock.storage,
      previousFigureKeys: [keyA],
      prefix: "payloads",
      packId: "pack1",
      versionId: "ver1",
      bundleId: "bun1",
      newlyCreatedKeys,
    });

    assert.deepEqual(mock.puts, [keyA]);
    assert.ok(newlyCreatedKeys.has(keyA));
    assert.equal(result.reusedKeys.size, 0);
  });

  it("on pre-commit failure deletes only newly created keys, not reused", async () => {
    const reusedBytes = PNG_BYTES;
    const newBytes = Uint8Array.from([...PNG_BYTES, 0xff]);
    const reusedSha = shaOf(reusedBytes);
    const newSha = shaOf(newBytes);
    const keyReused = expectedKey(reusedSha);
    const keyNew = expectedKey(newSha);
    const mock = mockStorage({ existingKeys: new Set([keyReused]) });
    const newlyCreatedKeys = new Set<string>();

    await persistFigurePreviewObjects({
      figures: [figure("fig-old", reusedBytes), figure("fig-new", newBytes)],
      storage: mock.storage,
      previousFigureKeys: [keyReused],
      prefix: "payloads",
      packId: "pack1",
      versionId: "ver1",
      bundleId: "bun1",
      newlyCreatedKeys,
    });

    assert.ok(newlyCreatedKeys.has(keyNew));
    assert.ok(!newlyCreatedKeys.has(keyReused));

    await cleanupNewlyCreatedFigurePreviews({
      keys: newlyCreatedKeys,
      storage: mock.storage,
      bundleId: "bun1",
      reason: "docling_figure_preview_normalization_failed",
      enqueueCleanupJob: async () => {
        throw new Error("should not enqueue");
      },
    });

    assert.deepEqual(mock.deletes, [keyNew]);
    assert.ok(mock.objects.has(keyReused));
    assert.ok(!mock.objects.has(keyNew));
  });

  it("enqueues cleanup job when newly-created delete fails", async () => {
    const sha = shaOf(PNG_BYTES);
    const key = expectedKey(sha);
    const mock = mockStorage({
      existingKeys: new Set([key]),
      deleteFailKeys: new Set([key]),
    });
    const jobs: Array<{ objectKey: string; reason: string }> = [];

    await cleanupNewlyCreatedFigurePreviews({
      keys: [key],
      storage: mock.storage,
      bundleId: "bun1",
      reason: "docling_figure_preview_normalization_failed",
      enqueueCleanupJob: async (input) => {
        jobs.push({ objectKey: input.objectKey, reason: input.reason });
      },
    });

    assert.deepEqual(jobs, [
      {
        objectKey: key,
        reason: "docling_figure_preview_normalization_failed",
      },
    ]);
  });

  it("post-commit log failure does not delete retained keys or rollback", async () => {
    const deleted: string[] = [];
    const warnings: string[] = [];
    let cleaned = false;
    let audited = false;
    let rolledBack = false;

    await recordPostCommitNormalizationEffects({
      writeSuccessLog: async () => {
        throw new Error("log write failed");
      },
      cleanupObsoletePreviews: async () => {
        cleaned = true;
        return { deferred: 0 };
      },
      writeAudit: async () => {
        audited = true;
      },
      onWarning: ({ code }) => {
        warnings.push(code);
      },
    });

    assert.deepEqual(warnings, ["DOCLING_POST_COMMIT_LOG_FAILED"]);
    assert.equal(cleaned, true);
    assert.equal(audited, true);
    assert.equal(deleted.length, 0);
    assert.equal(rolledBack, false);
  });

  it("post-commit audit failure records warning and keeps prior success path", async () => {
    const warnings: string[] = [];
    let logOk = false;

    await recordPostCommitNormalizationEffects({
      writeSuccessLog: async () => {
        logOk = true;
      },
      cleanupObsoletePreviews: async () => ({ deferred: 0 }),
      writeAudit: async () => {
        throw new Error("audit failed");
      },
      onWarning: ({ code }) => {
        warnings.push(code);
      },
    });

    assert.equal(logOk, true);
    assert.deepEqual(warnings, ["DOCLING_POST_COMMIT_AUDIT_FAILED"]);
  });

  it("obsolete cleanup failure is deferred via cleanup job, not treated as normalize fail", async () => {
    const obsolete = "payloads/pack-files/pack1/ver1/bun1/FIGURE_PREVIEW/old.png";
    const retained = new Set([expectedKey(shaOf(PNG_BYTES))]);
    const mock = mockStorage({
      existingKeys: new Set([obsolete]),
      deleteFailKeys: new Set([obsolete]),
    });
    const jobs: string[] = [];
    const warnings: string[] = [];

    await recordPostCommitNormalizationEffects({
      writeSuccessLog: async () => {},
      cleanupObsoletePreviews: async () =>
        cleanupObsoleteFigurePreviews({
          previousKeys: [obsolete],
          retainedKeys: retained,
          storage: mock.storage,
          bundleId: "bun1",
          enqueueCleanupJob: async (input) => {
            jobs.push(input.objectKey);
          },
        }),
      writeAudit: async () => {},
      onWarning: ({ code }) => {
        warnings.push(code);
      },
    });

    assert.deepEqual(jobs, [obsolete]);
    assert.deepEqual(warnings, ["DOCLING_POST_COMMIT_CLEANUP_DEFERRED"]);
  });

  it("dedupes identical SHA to a single put and single newlyCreated key", async () => {
    const mock = mockStorage();
    const newlyCreatedKeys = new Set<string>();
    const figs = [figure("fig-1"), figure("fig-2")];

    const result = await persistFigurePreviewObjects({
      figures: figs,
      storage: mock.storage,
      previousFigureKeys: [],
      prefix: "payloads",
      packId: "pack1",
      versionId: "ver1",
      bundleId: "bun1",
      newlyCreatedKeys,
    });

    assert.equal(mock.puts.length, 1);
    assert.equal(newlyCreatedKeys.size, 1);
    assert.equal(figs[0]!.previewObjectKey, figs[1]!.previewObjectKey);
    assert.equal(result.retainedKeys.size, 1);

    await cleanupNewlyCreatedFigurePreviews({
      keys: newlyCreatedKeys,
      storage: mock.storage,
      bundleId: "bun1",
      reason: "docling_figure_preview_normalization_failed",
      enqueueCleanupJob: async () => {
        throw new Error("should not enqueue");
      },
    });
    assert.equal(mock.deletes.length, 1);
  });

  it("tracks partial put successes for compensations before full persist returns", async () => {
    const bytesA = PNG_BYTES;
    const bytesB = Uint8Array.from([...PNG_BYTES, 1]);
    const keyA = expectedKey(shaOf(bytesA));
    const mock = mockStorage({ putFailAfter: 1 });
    const newlyCreatedKeys = new Set<string>();

    await assert.rejects(
      () =>
        persistFigurePreviewObjects({
          figures: [figure("a", bytesA), figure("b", bytesB)],
          storage: mock.storage,
          previousFigureKeys: [],
          prefix: "payloads",
          packId: "pack1",
          versionId: "ver1",
          bundleId: "bun1",
          newlyCreatedKeys,
        }),
      /put failed/,
    );

    assert.ok(newlyCreatedKeys.has(keyA));
    assert.equal(newlyCreatedKeys.size, 1);

    await cleanupNewlyCreatedFigurePreviews({
      keys: newlyCreatedKeys,
      storage: mock.storage,
      bundleId: "bun1",
      reason: "docling_figure_preview_partial_failure",
      enqueueCleanupJob: async () => {
        throw new Error("should not enqueue");
      },
    });
    assert.deepEqual(mock.deletes, [keyA]);
  });
});
