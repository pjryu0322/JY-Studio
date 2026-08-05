import type { prisma } from "@/lib/prisma";
import type { WorkerZipPipelineResult } from "@/lib/python-worker/worker-zip-pipeline-service";
import { finalizeWorkerZipSteps } from "@/lib/python-worker/worker-zip-step-log";
import type { resetWorkerZipSuccessorStateAfterGeneration } from "@/lib/python-worker/worker-zip-successor-reset";
import { mapWorkerZipFailureCode } from "../errors";
import type { WorkerZipGenerationTransitions } from "../generation-transitions";
import type { ProviderWorkerZipImportResult, RunProviderWorkerZipImportInput } from "./types";

type RefreshQuality = NonNullable<RunProviderWorkerZipImportInput["refreshQuality"]>;

type BaseSuccessFields = Pick<
  ProviderWorkerZipImportResult,
  | "pipelineRunId"
  | "searchIndexGenerationId"
  | "logicalStage"
  | "pipelineStatus"
  | "importedChunkCount"
  | "importedEmbeddingCount"
  | "pgvectorReflected"
  | "exclusionSummary"
>;

async function failGenerationReadyDeferred(input: {
  client: typeof prisma;
  prismaClient?: typeof prisma;
  pipelineRunId: string;
  result: WorkerZipPipelineResult;
  baseSuccessResult: BaseSuccessFields;
  warnings: { code: string; message: string }[];
}): Promise<ProviderWorkerZipImportResult> {
  // P7.1.1: import produced data but the generation did not reach READY. This
  // is NOT a completed structuring, so it is recorded as a run failure (FAIL —
  // a valid PipelineStepStatus). Import counts are preserved in the DTO for
  // diagnostics; the user sees ok=false / RETRY / generationReady=false.
  await input.client.pipelineRun
    .update({
      where: { id: input.pipelineRunId },
      data: { status: "FAIL", finishedAt: new Date() },
    })
    .catch(() => undefined);
  await finalizeWorkerZipSteps({
    prismaClient: input.prismaClient,
    runId: input.pipelineRunId,
    ok: false,
    errorMessage: mapWorkerZipFailureCode("GENERATION_READY_DEFERRED").message,
  });
  const mapped = mapWorkerZipFailureCode("GENERATION_READY_DEFERRED");
  return {
    ok: false,
    ...input.baseSuccessResult,
    warnings: input.warnings,
    nextStep: "RETRY",
    generationReady: false,
    error: {
      code: "GENERATION_READY_DEFERRED",
      message: mapped.message,
      retryable: true,
      supportRequired: mapped.supportRequired,
      stage: input.result.logicalStage,
    },
  };
}

async function markImportRunPass(input: {
  client: typeof prisma;
  prismaClient?: typeof prisma;
  pipelineRunId: string;
  result: WorkerZipPipelineResult;
}): Promise<void> {
  // READY reached. Prior active DRAFTs were already retired at generation-creation
  // time (stale-at-creation), which the DB partial unique index requires.
  await input.client.pipelineRun
    .update({
      where: { id: input.pipelineRunId },
      data: { status: "PASS", finishedAt: new Date() },
    })
    .catch(() => undefined);
  await finalizeWorkerZipSteps({
    prismaClient: input.prismaClient,
    runId: input.pipelineRunId,
    ok: true,
    summary: {
      importedChunkCount: input.result.importedChunkCount,
      importedEmbeddingCount: input.result.importedEmbeddingCount,
      excludedFiles: input.result.exclusionSummary?.total ?? 0,
    },
  });
}

/**
 * Knowledge data changed — clear prior quality / confirm successor state so
 * Admin cannot reuse stale PASS reports before the fresh quality refresh below.
 * P4.2: Generation completes only after automatic quality refresh.
 */
async function resetSuccessorThenRefreshQuality(input: {
  client: typeof prisma;
  clientId: string;
  packId: string;
  versionId: string;
  resetSuccessorState: typeof resetWorkerZipSuccessorStateAfterGeneration;
  refreshQuality: RefreshQuality;
  baseSuccessResult: BaseSuccessFields;
  warnings: { code: string; message: string }[];
}): Promise<ProviderWorkerZipImportResult> {
  try {
    await input.resetSuccessorState({
      packId: input.packId,
      versionId: input.versionId,
      prismaClient: input.client,
    });
  } catch (err) {
    console.error(
      `[worker-zip] successor reset failed pack=${input.packId} version=${input.versionId}`,
      err,
    );
  }

  try {
    const quality = await input.refreshQuality({
      packId: input.packId,
      reviewerClientId: input.clientId,
      prismaClient: input.client,
    });
    if (!quality.ok) {
      input.warnings.push({
        code: "QUALITY_REFRESH_FAILED",
        message: `${quality.message} ‘품질 재검사’로 다시 시도할 수 있습니다.`,
      });
      return {
        ok: false,
        ...input.baseSuccessResult,
        warnings: input.warnings,
        nextStep: "RETRY",
        generationReady: false,
        error: {
          code: "QUALITY_REFRESH_FAILED",
          message: quality.message,
          retryable: true,
          supportRequired: false,
          stage: "INDEXING",
        },
      };
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 400) : "품질 점검 자동 실행에 실패했습니다.";
    input.warnings.push({
      code: "QUALITY_REFRESH_FAILED",
      message: `${message} ‘품질 재검사’로 다시 시도할 수 있습니다.`,
    });
    return {
      ok: false,
      ...input.baseSuccessResult,
      warnings: input.warnings,
      nextStep: "RETRY",
      generationReady: false,
      error: {
        code: "QUALITY_REFRESH_FAILED",
        message,
        retryable: true,
        supportRequired: false,
        stage: "INDEXING",
      },
    };
  }

  return {
    ok: true,
    ...input.baseSuccessResult,
    warnings: input.warnings,
    nextStep: "SEARCH_DATA_VALIDATION",
    generationReady: true,
  };
}

/**
 * After a successful pipeline: drive generation PENDING→…→READY (or defer),
 * mark PipelineRun PASS, reset successor state, then auto quality refresh.
 */
export async function finalizeProviderWorkerZipImport(input: {
  client: typeof prisma;
  prismaClient?: typeof prisma;
  clientId: string;
  packId: string;
  versionId: string;
  pipelineRunId: string;
  generationId: string;
  transitions: WorkerZipGenerationTransitions;
  resetSuccessorState: typeof resetWorkerZipSuccessorStateAfterGeneration;
  refreshQuality: RefreshQuality;
  result: WorkerZipPipelineResult;
}): Promise<ProviderWorkerZipImportResult> {
  const { result, pipelineRunId, generationId, transitions } = input;
  const warnings = result.warnings.map((w) => ({ code: w.code, message: w.message }));

  // Import succeeded (worker already embedded + vectors mirrored). Drive the
  // generation to READY. Import counts are always preserved for diagnostics.
  const baseSuccessResult: BaseSuccessFields = {
    pipelineRunId,
    searchIndexGenerationId: result.searchIndexGenerationId ?? generationId,
    logicalStage: result.logicalStage,
    pipelineStatus: result.pipelineStatus,
    importedChunkCount: result.importedChunkCount,
    importedEmbeddingCount: result.importedEmbeddingCount,
    pgvectorReflected: result.pgvectorReflected,
    exclusionSummary: result.exclusionSummary,
  };

  const counts = {
    embeddedCount: result.importedEmbeddingCount,
    chunkCount: result.importedChunkCount,
  };
  let readyTransitionError: unknown = null;
  try {
    await transitions.toEmbedding(generationId);
    await transitions.toIndexing(generationId, counts);
    await transitions.toReady(generationId, counts);
  } catch (error) {
    readyTransitionError = error;
  }

  if (readyTransitionError) {
    return failGenerationReadyDeferred({
      client: input.client,
      prismaClient: input.prismaClient,
      pipelineRunId,
      result,
      baseSuccessResult,
      warnings,
    });
  }

  await markImportRunPass({
    client: input.client,
    prismaClient: input.prismaClient,
    pipelineRunId,
    result,
  });

  return resetSuccessorThenRefreshQuality({
    client: input.client,
    clientId: input.clientId,
    packId: input.packId,
    versionId: input.versionId,
    resetSuccessorState: input.resetSuccessorState,
    refreshQuality: input.refreshQuality,
    baseSuccessResult,
    warnings,
  });
}
