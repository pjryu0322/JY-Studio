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
 *
 * Transaction boundaries: see `./transaction.ts`.
 */
import "./transaction";
import { failProviderWorkerZipImport } from "./fail-import";
import { finalizeProviderWorkerZipImport } from "./finalize-import";
import { prepareProviderWorkerZipImport } from "./prepare-import";
import type {
  ProviderWorkerZipImportResult,
  RunProviderWorkerZipImportInput,
} from "./types";

export type {
  ProviderWorkerZipImportResult,
  RunProviderWorkerZipImportInput,
} from "./types";

/**
 * Run the ZIP Worker import end-to-end for a provider (synchronous).
 * Throws `WorkerZipImportServiceError` for pre-run failures (auth/ownership);
 * pipeline failures are returned in the result's `error` (never thrown).
 */
export async function runProviderWorkerZipImport(
  input: RunProviderWorkerZipImportInput,
): Promise<ProviderWorkerZipImportResult> {
  const prepared = await prepareProviderWorkerZipImport(input);
  const result = await prepared.runPipeline(prepared.pipelineArgs);

  if (!result.ok) {
    return failProviderWorkerZipImport({
      client: prepared.client,
      prismaClient: input.prismaClient,
      packId: prepared.pack.packId,
      pipelineRunId: prepared.pipelineRunId,
      generationId: prepared.generationId,
      generationCreated: prepared.generationCreated.value,
      transitions: prepared.transitions,
      result,
    });
  }

  return finalizeProviderWorkerZipImport({
    client: prepared.client,
    prismaClient: input.prismaClient,
    clientId: input.clientId,
    packId: prepared.pack.packId,
    versionId: prepared.version.id,
    pipelineRunId: prepared.pipelineRunId,
    generationId: prepared.generationId,
    transitions: prepared.transitions,
    resetSuccessorState: prepared.resetSuccessorState,
    refreshQuality: prepared.refreshQuality,
    result,
  });
}
