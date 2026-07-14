import type { NormalizedFigure } from "@/lib/adapters/docling/docling-types";
import { buildFigurePreviewObjectKey } from "@/lib/adapters/docling/docling-figure-preview";
import type { PayloadStorage } from "@/lib/distribution/payload-storage";

export type FigurePreviewPersistResult = {
  newlyCreatedKeys: Set<string>;
  reusedKeys: Set<string>;
  retainedKeys: Set<string>;
};

export type FigurePreviewStorage = Pick<PayloadStorage, "put" | "delete" | "head">;

export type EnqueueFigureCleanupJob = (input: {
  objectKey: string;
  reason: string;
  lastError: string;
  doclingBundleId: string;
}) => Promise<unknown>;

function extensionForMime(mimeType: string | null | undefined): string {
  if ((mimeType ?? "").includes("jpeg")) return "jpg";
  if ((mimeType ?? "").includes("webp")) return "webp";
  return "png";
}

async function objectExists(
  storage: FigurePreviewStorage,
  objectKey: string,
): Promise<boolean> {
  try {
    const head = await storage.head({ objectKey });
    return Boolean(head?.exists);
  } catch {
    return false;
  }
}

/**
 * Persist figure preview bytes to Object Storage.
 * Distinguishes newly created keys from reused prior keys so failure cleanup
 * never deletes pre-existing objects that this run did not create.
 *
 * Mutates `input.newlyCreatedKeys` synchronously as each put succeeds so a
 * mid-loop failure can still compensate only the keys this run created.
 */
export async function persistFigurePreviewObjects(input: {
  figures: NormalizedFigure[];
  storage: FigurePreviewStorage;
  previousFigureKeys: Iterable<string>;
  prefix: string;
  packId: string;
  versionId: string;
  bundleId: string;
  /** Optional accumulator mutated as puts succeed (for partial-failure cleanup). */
  newlyCreatedKeys?: Set<string>;
}): Promise<FigurePreviewPersistResult> {
  const previousFigureKeySet = new Set(
    [...input.previousFigureKeys].map((k) => k.trim()).filter(Boolean),
  );
  const newlyCreatedKeys = input.newlyCreatedKeys ?? new Set<string>();
  const reusedKeys = new Set<string>();
  const bySha = new Map<string, string>();

  for (const fig of input.figures) {
    const bytes = fig._previewBytes;
    const sha = fig._previewSha256;
    if (!bytes || !sha) {
      delete fig._previewBytes;
      delete fig._previewSha256;
      continue;
    }

    let objectKey = bySha.get(sha);
    if (!objectKey) {
      const ext = extensionForMime(fig.mimeType);
      objectKey = buildFigurePreviewObjectKey({
        prefix: input.prefix,
        packId: input.packId,
        versionId: input.versionId,
        bundleId: input.bundleId,
        sha256: sha,
        extension: ext,
      });

      if (
        previousFigureKeySet.has(objectKey) &&
        (await objectExists(input.storage, objectKey))
      ) {
        reusedKeys.add(objectKey);
      } else {
        await input.storage.put({
          packId: input.packId,
          versionId: input.versionId,
          payloadId: sha.slice(0, 32),
          originalFileName: `figure-${sha.slice(0, 8)}.${ext}`,
          mimeType: fig.mimeType ?? "image/png",
          bytes,
          checksumSha256: sha,
          objectKey,
        });
        newlyCreatedKeys.add(objectKey);
      }
      bySha.set(sha, objectKey);
    }

    fig.previewObjectKey = objectKey;
    delete fig._previewBytes;
    delete fig._previewSha256;
  }

  const retainedKeys = new Set<string>();
  for (const fig of input.figures) {
    if (fig.previewObjectKey?.trim()) retainedKeys.add(fig.previewObjectKey.trim());
  }

  return { newlyCreatedKeys, reusedKeys, retainedKeys };
}

export async function cleanupNewlyCreatedFigurePreviews(input: {
  keys: Iterable<string>;
  storage: Pick<PayloadStorage, "delete">;
  bundleId: string;
  reason: string;
  enqueueCleanupJob: EnqueueFigureCleanupJob;
}): Promise<void> {
  const unique = new Set([...input.keys].map((k) => k.trim()).filter(Boolean));
  for (const objectKey of unique) {
    try {
      await input.storage.delete({ objectKey });
    } catch {
      await input.enqueueCleanupJob({
        objectKey,
        reason: input.reason,
        lastError: "immediate delete failed",
        doclingBundleId: input.bundleId,
      });
    }
  }
}

export async function cleanupObsoleteFigurePreviews(input: {
  previousKeys: Iterable<string>;
  retainedKeys: Set<string>;
  storage: Pick<PayloadStorage, "delete">;
  bundleId: string;
  enqueueCleanupJob: EnqueueFigureCleanupJob;
}): Promise<{ deferred: number }> {
  let deferred = 0;
  for (const key of input.previousKeys) {
    const objectKey = key.trim();
    if (!objectKey || input.retainedKeys.has(objectKey)) continue;
    try {
      await input.storage.delete({ objectKey });
    } catch {
      deferred += 1;
      await input.enqueueCleanupJob({
        objectKey,
        reason: "docling_figure_preview_replaced",
        lastError: "immediate delete failed",
        doclingBundleId: input.bundleId,
      });
    }
  }
  return { deferred };
}

export type PostCommitNormalizationEffectHandlers = {
  writeSuccessLog: () => Promise<void>;
  cleanupObsoletePreviews: () => Promise<{ deferred: number }>;
  writeAudit: () => Promise<void>;
  onWarning: (input: {
    code:
      | "DOCLING_POST_COMMIT_LOG_FAILED"
      | "DOCLING_POST_COMMIT_AUDIT_FAILED"
      | "DOCLING_POST_COMMIT_CLEANUP_DEFERRED";
    message: string;
  }) => Promise<void> | void;
};

/**
 * Post-commit side effects must not delete committed figure previews or
 * roll NORMALIZED back to a failed state.
 */
export async function recordPostCommitNormalizationEffects(
  handlers: PostCommitNormalizationEffectHandlers,
): Promise<void> {
  try {
    await handlers.writeSuccessLog();
  } catch (error) {
    const message = error instanceof Error ? error.message : "post-commit log failed";
    await handlers.onWarning({
      code: "DOCLING_POST_COMMIT_LOG_FAILED",
      message: message.slice(0, 500),
    });
  }

  try {
    const result = await handlers.cleanupObsoletePreviews();
    if (result.deferred > 0) {
      await handlers.onWarning({
        code: "DOCLING_POST_COMMIT_CLEANUP_DEFERRED",
        message: `Deferred ${result.deferred} obsolete figure preview delete(s)`,
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "post-commit cleanup failed";
    await handlers.onWarning({
      code: "DOCLING_POST_COMMIT_CLEANUP_DEFERRED",
      message: message.slice(0, 500),
    });
  }

  try {
    await handlers.writeAudit();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "post-commit audit failed";
    await handlers.onWarning({
      code: "DOCLING_POST_COMMIT_AUDIT_FAILED",
      message: message.slice(0, 500),
    });
  }
}
