/**
 * P7: SearchIndexGeneration compatibility bridge for the ZIP Worker path.
 *
 * WHY THIS EXISTS (read before editing):
 * `SearchIndexGeneration.normalizedDocumentId` is a required FK →
 * `NormalizedDocument.bundleId` is a required FK → `DoclingImportBundle`. Creating
 * a generation therefore requires those two rows. The ZIP Worker path does not
 * (and should not) produce Docling artifacts, but until a schema change lands
 * (P7.1: make `normalizedDocumentId` nullable), we synthesize the *minimum*
 * bundle + normalized-document rows purely to satisfy the FK constraints.
 *
 * This is a COMPATIBILITY BRIDGE, not a return to the Docling pipeline:
 * - The synthesized rows are tagged `adapterType = WORKER_ZIP` and marked so they
 *   are invisible to Docling flows (`isActive = false`, `deletedAt` set so
 *   `findLatestStagingBundleForVersion` and active-bundle/active-ND queries skip
 *   them).
 * - We do NOT re-chunk or re-embed: the embedding descriptor is derived from the
 *   Worker's own `embeddings.json`, so `importWorkerOutputToStoreDb`'s descriptor
 *   check passes.
 * - Generation creation stays in the route/service layer; the pipeline core never
 *   creates a generation.
 */
import { createHash } from "node:crypto";
import { E5_DISTANCE_METRIC, LEGACY_MODEL_REVISION } from "@/lib/embedding/e5-embedding-constants";
import { prisma } from "@/lib/prisma";
import { IMPORT_CHANNELS } from "@/lib/python-worker/import-channel";
import type { WorkerOutputImportPayload } from "@/lib/python-worker/worker-output-import-service";
import { createSearchGenerationForPipeline } from "@/lib/search-generation/search-generation-pipeline-sync";
import type { SearchGenerationEmbeddingDescriptor } from "@/lib/search-generation/search-generation-types";

/** adapterType marker: identifies bundle/ND rows synthesized by the ZIP Worker bridge. */
export const WORKER_ZIP_ADAPTER_TYPE = "WORKER_ZIP" as const;

/** Marker stored on synthesized rows so their origin is unambiguous in the DB. */
export const WORKER_ZIP_BRIDGE_SOURCE = "worker_zip_bridge" as const;

export class WorkerZipGenerationBridgeError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WorkerZipGenerationBridgeError";
    this.code = code;
  }
}

type PrismaClientLike = typeof prisma;
type CreateGenerationFn = typeof createSearchGenerationForPipeline;

/**
 * Derive the embedding descriptor from the Worker's own embeddings so that
 * `importWorkerOutputToStoreDb` (which cross-checks provider/model/dimension)
 * always agrees with the generation. No live probe, no re-embedding.
 */
export function deriveWorkerZipEmbeddingDescriptor(
  payload: WorkerOutputImportPayload,
): SearchGenerationEmbeddingDescriptor {
  const first = payload.embeddings[0];
  if (!first) {
    throw new WorkerZipGenerationBridgeError(
      "WORKER_ZIP_EMPTY_EMBEDDINGS",
      "worker output has no embeddings to derive a generation descriptor from",
    );
  }
  for (const emb of payload.embeddings) {
    if (
      emb.provider !== first.provider ||
      emb.model !== first.model ||
      emb.dimension !== first.dimension
    ) {
      throw new WorkerZipGenerationBridgeError(
        "WORKER_ZIP_INCONSISTENT_EMBEDDINGS",
        "worker embeddings use inconsistent provider/model/dimension",
      );
    }
  }
  const revision =
    typeof first.modelRevision === "string" && first.modelRevision.length > 0
      ? first.modelRevision
      : LEGACY_MODEL_REVISION;
  return {
    embeddingProvider: first.provider,
    embeddingModel: first.model,
    embeddingModelRevision: revision,
    embeddingDimension: first.dimension,
    distanceMetric: E5_DISTANCE_METRIC,
  };
}

/**
 * Deterministic fingerprint for the synthesized NormalizedDocument, derived from
 * the Worker output content (embedding content hashes). Stable across re-runs of
 * identical content, distinct when content changes.
 */
export function computeWorkerZipNormalizedDocumentFingerprint(
  payload: WorkerOutputImportPayload,
): string {
  const parts = payload.embeddings
    .map((emb) => `${emb.chunkId}:${emb.contentHash}`)
    .sort();
  const hash = createHash("sha256");
  hash.update(payload.packVersionId);
  hash.update("\n");
  hash.update(String(payload.parserVersion ?? ""));
  hash.update("\n");
  hash.update(parts.join("\n"));
  return `worker-zip-${hash.digest("hex")}`;
}

export type SynthesizeWorkerZipSearchGenerationInput = {
  /** Caller-generated generation id (so the caller can mark it failed later). */
  generationId: string;
  payload: WorkerOutputImportPayload;
  pipelineRunId: string;
  prismaClient?: PrismaClientLike;
  /** Injectable for tests. */
  createGeneration?: CreateGenerationFn;
};

export type SynthesizeWorkerZipSearchGenerationResult = {
  searchIndexGenerationId: string;
  bundleId: string;
  normalizedDocumentId: string;
};

/**
 * Synthesize the minimal DoclingImportBundle + NormalizedDocument required to
 * create a DRAFT/PENDING SearchIndexGeneration for the ZIP Worker path.
 * Everything happens in one transaction. The generation is created via the
 * existing `createSearchGenerationForPipeline` (which also stales prior drafts).
 */
export async function synthesizeWorkerZipSearchGeneration(
  input: SynthesizeWorkerZipSearchGenerationInput,
): Promise<SynthesizeWorkerZipSearchGenerationResult> {
  const client = input.prismaClient ?? prisma;
  const createGeneration = input.createGeneration ?? createSearchGenerationForPipeline;
  const { payload } = input;
  const descriptor = deriveWorkerZipEmbeddingDescriptor(payload);
  const fingerprint = computeWorkerZipNormalizedDocumentFingerprint(payload);
  const adapterVersion = payload.parserVersion?.trim() || "worker-zip";
  const bridgeMarker = {
    source: WORKER_ZIP_BRIDGE_SOURCE,
    importChannel: IMPORT_CHANNELS.WORKER_ZIP_IMPORT,
    pipelineRunId: input.pipelineRunId,
  };

  return client.$transaction(async (tx) => {
    // Synthesized bundle: hidden from Docling flows (isActive:false + deletedAt).
    const bundle = await tx.doclingImportBundle.create({
      data: {
        packId: payload.packId,
        versionId: payload.packVersionId,
        adapterType: WORKER_ZIP_ADAPTER_TYPE,
        adapterVersion,
        status: "NORMALIZED",
        isActive: false,
        deletedAt: new Date(),
        stagingReason: WORKER_ZIP_BRIDGE_SOURCE,
        normalizationReport: bridgeMarker,
      },
      select: { id: true },
    });

    const normalizedDocument = await tx.normalizedDocument.create({
      data: {
        bundleId: bundle.id,
        packId: payload.packId,
        versionId: payload.packVersionId,
        isActive: false,
        adapterType: WORKER_ZIP_ADAPTER_TYPE,
        adapterVersion,
        sourceSchemaName: WORKER_ZIP_BRIDGE_SOURCE,
        fingerprint,
        fingerprintVersion: "worker-zip-v1",
        structureSummaryJson: bridgeMarker,
      },
      select: { id: true },
    });

    const generation = await createGeneration({
      id: input.generationId,
      packId: payload.packId,
      versionId: payload.packVersionId,
      pipelineRunId: input.pipelineRunId,
      normalizedDocumentId: normalizedDocument.id,
      fingerprint,
      chunkGenerationId: input.generationId,
      descriptor,
      attempt: 0,
      client: tx,
    });

    return {
      searchIndexGenerationId: generation.id,
      bundleId: bundle.id,
      normalizedDocumentId: normalizedDocument.id,
    };
  });
}
