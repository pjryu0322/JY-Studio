/**
 * P7: Provider-facing orchestration for a ZIP Worker import (synchronous slice).
 *
 * Responsibility (route/job layer — NOT the pipeline core):
 * - verify the pack is owned by the provider and is DRAFT
 * - create a PipelineRun record
 * - generate the SearchIndexGeneration id up-front, then prepare the generation
 *   (via the compatibility bridge) once the worker output is validated
 * - run `runWorkerZipImportPipeline` bound to that generation id
 * - transition the generation (PENDING → EMBEDDING → INDEXING → READY, or FAILED)
 * - map the result to a safe, user-facing DTO
 *
 * This round is a SYNCHRONOUS minimal connection: the route awaits this service.
 * Async job transition (a poll worker claiming the run) is deferred to P7.1 — see
 * docs/python-worker-zip-import.md.
 *
 * Role separation: this path is distinct from the legacy Docling JSON/MD import.
 * It never calls the Docling knowledge builder and never re-chunks/re-embeds.
 */
import { randomUUID } from "node:crypto";
import type { PipelineStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import {
  runWorkerZipImportPipeline,
  type WorkerZipPipelineResult,
} from "@/lib/python-worker/worker-zip-pipeline-service";
import type { WorkerExclusionSummary } from "@/lib/python-worker/worker-output-contract";
import {
  createWorkerZipStepRecorder,
  finalizeWorkerZipSteps,
} from "@/lib/python-worker/worker-zip-step-log";
import { synthesizeWorkerZipSearchGeneration } from "@/lib/python-worker/worker-zip-generation-bridge";
import type { WorkerZipLogicalStage } from "@/lib/python-worker/worker-zip-pipeline-stages";
import { resetWorkerZipSuccessorStateAfterGeneration } from "@/lib/python-worker/worker-zip-successor-reset";
import { mapWorkerZipFailureCode, type WorkerZipImportUserError } from "./errors";
import { defaultTransitions, type WorkerZipGenerationTransitions } from "./generation-transitions";
import { requireOwnedDraftPack, type WorkerZipPackResolver } from "./pack-resolvers";

export type ProviderWorkerZipImportResult = {
  ok: boolean;
  pipelineRunId: string;
  searchIndexGenerationId?: string;
  logicalStage: WorkerZipLogicalStage;
  pipelineStatus: PipelineStatus;
  importedChunkCount: number;
  importedEmbeddingCount: number;
  pgvectorReflected: boolean;
  /** P7.4: read-only roll-up of files the Worker auto-excluded (advisory). */
  exclusionSummary?: WorkerExclusionSummary;
  warnings: { code: string; message: string }[];
  nextStep: "SEARCH_DATA_VALIDATION" | "RETRY";
  generationReady: boolean;
  error?: WorkerZipImportUserError;
};

export type RunProviderWorkerZipImportInput = {
  userId: string;
  clientId: string;
  packId: string;
  /** Local temp path where the route already spilled the uploaded ZIP. */
  inputZipPath: string;
  /** Admin 사전정리 제외 경로 — forwarded to the Worker pipeline. */
  adminExcludePaths?: readonly string[];
  /** P1: immutable source revision that produced this ZIP run. */
  sourceRevisionId?: string | null;
  /** P1.1: Working Copy that owns this execution's SourceDocuments. */
  workingCopyId?: string | null;
  requirePgvector?: boolean;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  /** Injectable for tests. */
  runPipeline?: typeof runWorkerZipImportPipeline;
  synthesizeGeneration?: typeof synthesizeWorkerZipSearchGeneration;
  transitions?: WorkerZipGenerationTransitions;
  findProfile?: (userId: string, clientId: string) => Promise<{ id: string } | null>;
  /**
   * P7.3: how the caller's authority over the pack is resolved. Defaults to the
   * provider-profile ownership check. The Admin execute path injects
   * {@link resolveAdminDraftPack} so an operator can run the Worker on a DRAFT
   * request without owning the provider profile.
   */
  resolvePack?: WorkerZipPackResolver;
  /**
   * After READY: clear prior quality / confirm successor state for this version.
   * Injectable for tests.
   */
  resetSuccessorState?: typeof resetWorkerZipSuccessorStateAfterGeneration;
  /**
   * After READY + successor reset: automatic quality refresh (P4.2).
   * Injectable for tests.
   */
  refreshQuality?: typeof import("@/lib/python-worker/worker-zip-quality-refresh-service").refreshWorkerZipReviewReadiness;
  /** Inventory item id by relative path — stamped onto Worker chunks for provenance. */
  inventoryItemIdByPath?: Record<string, string>;
  /** Inventory id for provenance import gate. */
  inventoryId?: string | null;
};

/**
 * Run the ZIP Worker import end-to-end for a provider (synchronous).
 * Throws `WorkerZipImportServiceError` for pre-run failures (auth/ownership);
 * pipeline failures are returned in the result's `error` (never thrown).
 */
export async function runProviderWorkerZipImport(
  input: RunProviderWorkerZipImportInput,
): Promise<ProviderWorkerZipImportResult> {
  const client = input.prismaClient ?? prisma;
  const runPipeline = input.runPipeline ?? runWorkerZipImportPipeline;
  const synthesizeGeneration = input.synthesizeGeneration ?? synthesizeWorkerZipSearchGeneration;
  const transitions = input.transitions ?? defaultTransitions(client);
  const findProfile = input.findProfile ?? findOrEnsureProviderProfileForUser;
  const resetSuccessorState =
    input.resetSuccessorState ?? resetWorkerZipSuccessorStateAfterGeneration;
  const refreshQuality =
    input.refreshQuality ??
    (await import("@/lib/python-worker/worker-zip-quality-refresh-service"))
      .refreshWorkerZipReviewReadiness;
  const resolvePack =
    input.resolvePack ??
    ((c, i) => requireOwnedDraftPack(c, findProfile, i));

  const { pack, version } = await resolvePack(client, {
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const pipelineRun = await client.pipelineRun.create({
    data: {
      packId: pack.packId,
      versionId: version.id,
      sourceRevisionId: input.sourceRevisionId ?? null,
      workingCopyId: input.workingCopyId ?? null,
      triggerType: "WORKER_ZIP_IMPORT",
      triggeredByClientId: input.clientId,
      status: "RUNNING",
      summary: "ZIP 업로드 기반 데이터 구조화",
    },
    select: { id: true },
  });

  // Pre-generate the generation id so we can mark it FAILED even if the pipeline
  // aborts after the generation was created. The bridge (run inside the pipeline
  // resolver, once worker output is validated) uses this exact id.
  const generationId = randomUUID();
  let generationCreated = false;

  const result: WorkerZipPipelineResult = await runPipeline({
    packId: pack.packId,
    packVersionId: version.id,
    pipelineRunId: pipelineRun.id,
    inputZipPath: input.inputZipPath,
    packName: pack.name,
    productVersion: version.version,
    language: version.language ?? undefined,
    adminExcludePaths: input.adminExcludePaths,
    sourceRevisionId: input.sourceRevisionId,
    workingCopyId: input.workingCopyId,
    inventoryId: input.inventoryId,
    inventoryItemIdByPath: input.inventoryItemIdByPath,
    requirePgvector: input.requirePgvector,
    env: input.env,
    prismaClient: input.prismaClient,
    deps: {
      // P7.5: record per-stage progress so the Admin status API can render a live
      // stepper while this synchronous run is in flight. Best-effort; never throws.
      markStage: createWorkerZipStepRecorder({
        prismaClient: input.prismaClient,
        runId: pipelineRun.id,
        packId: pack.packId,
      }),
      resolveSearchIndexGenerationId: async ({ payload }) => {
        await synthesizeGeneration({
          generationId,
          payload,
          pipelineRunId: pipelineRun.id,
          prismaClient: input.prismaClient,
        });
        generationCreated = true;
        return generationId;
      },
    },
  });

  const warnings = result.warnings.map((w) => ({ code: w.code, message: w.message }));

  if (!result.ok) {
    // Surface the Python Worker's own output server-side so failures like
    // "exited with code 1" can be traced to the actual traceback / error.
    const stderrTail = result.workerStderrTail?.trim() ?? "";
    if (stderrTail || result.workerStdoutTail) {
      console.error(
        `[worker-zip] generation failed pack=${pack.packId} run=${pipelineRun.id} ` +
          `stage=${result.error?.stage ?? result.logicalStage} code=${result.error?.code}\n` +
          `stderr:\n${result.workerStderrTail ?? ""}\nstdout:\n${result.workerStdoutTail ?? ""}`,
      );
    }
    if (generationCreated) {
      await transitions
        .toFailed(generationId, {
          failureCode: result.error?.code ?? "WORKER_ZIP_PIPELINE_FAILED",
          failureMessage: result.error?.message ?? null,
        })
        .catch(() => undefined);
    }
    await client.pipelineRun
      .update({ where: { id: pipelineRun.id }, data: { status: "FAIL", finishedAt: new Date() } })
      .catch(() => undefined);
    // Attach the stderr tail to the step-log detail so the Admin history panel
    // shows *why* the run failed, not just the generic mapped message.
    const stepErrorMessage = stderrTail
      ? `${result.error?.message ?? "생성 실패"} · ${stderrTail.slice(-400)}`
      : result.error?.message ?? null;
    await finalizeWorkerZipSteps({
      prismaClient: input.prismaClient,
      runId: pipelineRun.id,
      ok: false,
      errorMessage: stepErrorMessage,
    });

    const code = result.error?.code ?? "WORKER_ZIP_PIPELINE_FAILED";
    const mapped = mapWorkerZipFailureCode(code);
    return {
      ok: false,
      pipelineRunId: pipelineRun.id,
      searchIndexGenerationId: generationCreated ? generationId : undefined,
      logicalStage: result.logicalStage,
      pipelineStatus: result.pipelineStatus,
      importedChunkCount: 0,
      importedEmbeddingCount: 0,
      pgvectorReflected: false,
      exclusionSummary: result.exclusionSummary,
      warnings,
      nextStep: "RETRY",
      generationReady: false,
      error: {
        code,
        message: mapped.message,
        retryable: result.error?.retryable ?? false,
        supportRequired: mapped.supportRequired,
        stage: result.error?.stage ?? result.logicalStage,
      },
    };
  }

  // Import succeeded (worker already embedded + vectors mirrored). Drive the
  // generation to READY. Import counts are always preserved for diagnostics.
  const searchIndexGenerationId = result.searchIndexGenerationId ?? generationId;
  const baseSuccessResult = {
    pipelineRunId: pipelineRun.id,
    searchIndexGenerationId,
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
    // P7.1.1: import produced data but the generation did not reach READY. This
    // is NOT a completed structuring, so it is recorded as a run failure (FAIL —
    // a valid PipelineStepStatus). Import counts are preserved in the DTO for
    // diagnostics; the user sees ok=false / RETRY / generationReady=false.
    await client.pipelineRun
      .update({ where: { id: pipelineRun.id }, data: { status: "FAIL", finishedAt: new Date() } })
      .catch(() => undefined);
    await finalizeWorkerZipSteps({
      prismaClient: input.prismaClient,
      runId: pipelineRun.id,
      ok: false,
      errorMessage: mapWorkerZipFailureCode("GENERATION_READY_DEFERRED").message,
    });
    const mapped = mapWorkerZipFailureCode("GENERATION_READY_DEFERRED");
    return {
      ok: false,
      ...baseSuccessResult,
      warnings,
      nextStep: "RETRY",
      generationReady: false,
      error: {
        code: "GENERATION_READY_DEFERRED",
        message: mapped.message,
        retryable: true,
        supportRequired: mapped.supportRequired,
        stage: result.logicalStage,
      },
    };
  }

  // READY reached. Prior active DRAFTs were already retired at generation-creation
  // time (stale-at-creation), which the DB partial unique index requires.
  await client.pipelineRun
    .update({ where: { id: pipelineRun.id }, data: { status: "PASS", finishedAt: new Date() } })
    .catch(() => undefined);
  await finalizeWorkerZipSteps({
    prismaClient: input.prismaClient,
    runId: pipelineRun.id,
    ok: true,
    summary: {
      importedChunkCount: result.importedChunkCount,
      importedEmbeddingCount: result.importedEmbeddingCount,
      excludedFiles: result.exclusionSummary?.total ?? 0,
    },
  });

  // Knowledge data changed — clear prior quality / confirm successor state so
  // Admin cannot reuse stale PASS reports before the fresh quality refresh below.
  try {
    await resetSuccessorState({
      packId: pack.packId,
      versionId: version.id,
      prismaClient: client,
    });
  } catch (err) {
    console.error(
      `[worker-zip] successor reset failed pack=${pack.packId} version=${version.id}`,
      err,
    );
  }

  // P4.2: Generation completes only after automatic quality refresh.
  try {
    const quality = await refreshQuality({
      packId: pack.packId,
      reviewerClientId: input.clientId,
      prismaClient: client,
    });
    if (!quality.ok) {
      warnings.push({
        code: "QUALITY_REFRESH_FAILED",
        message: `${quality.message} ‘품질 재검사’로 다시 시도할 수 있습니다.`,
      });
      return {
        ok: false,
        ...baseSuccessResult,
        warnings,
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
    warnings.push({
      code: "QUALITY_REFRESH_FAILED",
      message: `${message} ‘품질 재검사’로 다시 시도할 수 있습니다.`,
    });
    return {
      ok: false,
      ...baseSuccessResult,
      warnings,
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
    ...baseSuccessResult,
    warnings,
    nextStep: "SEARCH_DATA_VALIDATION",
    generationReady: true,
  };
}
