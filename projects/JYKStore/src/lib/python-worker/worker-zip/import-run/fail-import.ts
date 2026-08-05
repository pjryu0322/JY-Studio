import type { prisma } from "@/lib/prisma";
import type { WorkerZipPipelineResult } from "@/lib/python-worker/worker-zip-pipeline-service";
import { finalizeWorkerZipSteps } from "@/lib/python-worker/worker-zip-step-log";
import { mapWorkerZipFailureCode } from "../errors";
import type { WorkerZipGenerationTransitions } from "../generation-transitions";
import type { ProviderWorkerZipImportResult } from "./types";

/**
 * Map a failed Worker pipeline result to the provider DTO: optional generation
 * toFailed, PipelineRun FAIL, step-log finalize, user-facing error mapping.
 */
export async function failProviderWorkerZipImport(input: {
  client: typeof prisma;
  prismaClient?: typeof prisma;
  packId: string;
  pipelineRunId: string;
  generationId: string;
  generationCreated: boolean;
  transitions: WorkerZipGenerationTransitions;
  result: WorkerZipPipelineResult;
}): Promise<ProviderWorkerZipImportResult> {
  const { result, pipelineRunId, generationId, generationCreated, transitions } = input;
  const warnings = result.warnings.map((w) => ({ code: w.code, message: w.message }));

  // Surface the Python Worker's own output server-side so failures like
  // "exited with code 1" can be traced to the actual traceback / error.
  const stderrTail = result.workerStderrTail?.trim() ?? "";
  if (stderrTail || result.workerStdoutTail) {
    console.error(
      `[worker-zip] generation failed pack=${input.packId} run=${pipelineRunId} ` +
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
  await input.client.pipelineRun
    .update({ where: { id: pipelineRunId }, data: { status: "FAIL", finishedAt: new Date() } })
    .catch(() => undefined);
  // Attach the stderr tail to the step-log detail so the Admin history panel
  // shows *why* the run failed, not just the generic mapped message.
  const stepErrorMessage = stderrTail
    ? `${result.error?.message ?? "생성 실패"} · ${stderrTail.slice(-400)}`
    : result.error?.message ?? null;
  await finalizeWorkerZipSteps({
    prismaClient: input.prismaClient,
    runId: pipelineRunId,
    ok: false,
    errorMessage: stepErrorMessage,
  });

  const code = result.error?.code ?? "WORKER_ZIP_PIPELINE_FAILED";
  const mapped = mapWorkerZipFailureCode(code);
  return {
    ok: false,
    pipelineRunId,
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
