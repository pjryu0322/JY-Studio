import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { runWorkerZipImportPipeline } from "@/lib/python-worker/worker-zip-pipeline-service";
import { createWorkerZipStepRecorder } from "@/lib/python-worker/worker-zip-step-log";
import { synthesizeWorkerZipSearchGeneration } from "@/lib/python-worker/worker-zip-generation-bridge";
import { resetWorkerZipSuccessorStateAfterGeneration } from "@/lib/python-worker/worker-zip-successor-reset";
import { defaultTransitions } from "../generation-transitions";
import { requireOwnedDraftPack } from "../pack-resolvers";
import type { PreparedWorkerZipImport, RunProviderWorkerZipImportInput } from "./types";

/**
 * Resolve authority, create the PipelineRun (RUNNING), pre-allocate the
 * SearchIndexGeneration id, and build pipeline args (including the synthesize
 * bridge callback that marks generationCreated).
 */
export async function prepareProviderWorkerZipImport(
  input: RunProviderWorkerZipImportInput,
): Promise<PreparedWorkerZipImport> {
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
  const generationCreated = { value: false };

  return {
    client,
    pack,
    version,
    pipelineRunId: pipelineRun.id,
    generationId,
    generationCreated,
    transitions,
    resetSuccessorState,
    refreshQuality,
    runPipeline,
    pipelineArgs: {
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
          generationCreated.value = true;
          return generationId;
        },
      },
    },
  };
}
