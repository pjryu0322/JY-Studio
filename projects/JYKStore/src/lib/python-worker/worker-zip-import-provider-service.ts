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
import { PackStatus, type PipelineStatus } from "@prisma/client";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import {
  runWorkerZipImportPipeline,
  type WorkerZipPipelineResult,
} from "@/lib/python-worker/worker-zip-pipeline-service";
import { synthesizeWorkerZipSearchGeneration } from "@/lib/python-worker/worker-zip-generation-bridge";
import type { WorkerZipLogicalStage } from "@/lib/python-worker/worker-zip-pipeline-stages";
import {
  markSearchGenerationEmbedding,
  markSearchGenerationFailed,
  markSearchGenerationIndexing,
  markSearchGenerationReady,
} from "@/lib/search-generation/search-generation-service";

export class WorkerZipImportServiceError extends Error {
  code: string;
  httpStatus: number;
  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = "WorkerZipImportServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type WorkerZipImportUserError = {
  code: string;
  message: string;
  retryable: boolean;
  supportRequired: boolean;
  stage: WorkerZipLogicalStage;
};

export type ProviderWorkerZipImportResult = {
  ok: boolean;
  pipelineRunId: string;
  searchIndexGenerationId?: string;
  logicalStage: WorkerZipLogicalStage;
  pipelineStatus: PipelineStatus;
  importedChunkCount: number;
  importedEmbeddingCount: number;
  pgvectorReflected: boolean;
  warnings: { code: string; message: string }[];
  nextStep: "SEARCH_DATA_VALIDATION" | "RETRY";
  generationReady: boolean;
  error?: WorkerZipImportUserError;
};

/** Generation lifecycle transitions, injectable for tests. */
export type WorkerZipGenerationTransitions = {
  toEmbedding: (id: string) => Promise<unknown>;
  toIndexing: (id: string, counts: { embeddedCount: number; chunkCount: number }) => Promise<unknown>;
  toReady: (id: string, counts: { embeddedCount: number; chunkCount: number }) => Promise<unknown>;
  toFailed: (
    id: string,
    failure: { failureCode: string; failureMessage?: string | null },
  ) => Promise<unknown>;
};

export type RunProviderWorkerZipImportInput = {
  userId: string;
  clientId: string;
  packId: string;
  /** Local temp path where the route already spilled the uploaded ZIP. */
  inputZipPath: string;
  requirePgvector?: boolean;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  /** Injectable for tests. */
  runPipeline?: typeof runWorkerZipImportPipeline;
  synthesizeGeneration?: typeof synthesizeWorkerZipSearchGeneration;
  transitions?: WorkerZipGenerationTransitions;
  findProfile?: (userId: string, clientId: string) => Promise<{ id: string } | null>;
};

function defaultTransitions(client: typeof prisma): WorkerZipGenerationTransitions {
  return {
    toEmbedding: (id) => markSearchGenerationEmbedding(id, client),
    toIndexing: (id, counts) => markSearchGenerationIndexing(id, counts, client),
    toReady: (id, counts) => markSearchGenerationReady(id, counts, client),
    toFailed: (id, failure) => markSearchGenerationFailed(id, failure, client),
  };
}

/**
 * Map an internal pipeline/bridge failure code to safe, provider-facing copy.
 * Raw errors/stack traces stay in server logs — never surfaced here.
 */
export function mapWorkerZipFailureCode(code: string): { message: string; supportRequired: boolean } {
  switch (code) {
    case "WORKER_ZIP_FILE_TOO_LARGE":
      return { message: "업로드한 ZIP 파일이 너무 큽니다. 크기를 줄여 다시 업로드하세요.", supportRequired: false };
    case "WORKER_OUTPUT_FILE_TOO_LARGE":
      return { message: "생성된 결과 파일이 허용 크기를 초과했습니다. 자료를 나눠 다시 시도하세요.", supportRequired: false };
    case "WORKER_RUN_TIMEOUT":
      return { message: "데이터 구조화가 시간 내에 끝나지 않았습니다. 잠시 후 다시 시도하세요.", supportRequired: false };
    case "WORKER_RUN_FAILED":
    case "WORKER_OUTPUT_INVALID":
    case "MISSING_REQUIRED_OUTPUT":
    case "VALIDATION_REPORT_NOT_OK":
      return { message: "데이터 구조화 중 문제가 발생했습니다. 자료 구성을 확인하고 다시 실행하세요.", supportRequired: false };
    case "SEARCH_GENERATION_REQUIRED":
    case "SEARCH_GENERATION_MISMATCH":
    case "SEARCH_GENERATION_DESCRIPTOR_MISMATCH":
    case "WORKER_ZIP_EMPTY_EMBEDDINGS":
    case "WORKER_ZIP_INCONSISTENT_EMBEDDINGS":
      return {
        message: "검색데이터 생성을 위한 준비 정보가 없습니다. 다시 시도하거나 관리자에게 문의하세요.",
        supportRequired: true,
      };
    case "SEARCH_RUNTIME_UNAVAILABLE":
    case "PAYLOAD_STORAGE_UNAVAILABLE":
      return { message: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.", supportRequired: true };
    default:
      return { message: "데이터 구조화 처리 중 오류가 발생했습니다. 다시 시도하거나 관리자에게 문의하세요.", supportRequired: true };
  }
}

async function requireOwnedDraftPack(
  client: typeof prisma,
  findProfile: (userId: string, clientId: string) => Promise<{ id: string } | null>,
  input: { userId: string; clientId: string; packId: string },
) {
  const profile = await findProfile(input.userId, input.clientId);
  if (!profile) {
    throw new WorkerZipImportServiceError("PROFILE_REQUIRED", "제공자 프로필이 필요합니다.", 403);
  }
  const pack = await client.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    include: { versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 } },
  });
  if (!pack) {
    throw new WorkerZipImportServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  if (pack.status !== PackStatus.DRAFT) {
    throw new WorkerZipImportServiceError(
      "PACK_NOT_EDITABLE",
      "초안(DRAFT) 상태에서만 데이터 구조화를 실행할 수 있습니다.",
      409,
    );
  }
  const version = pack.versions[0];
  if (!version) {
    throw new WorkerZipImportServiceError("INCOMPLETE", "버전이 없습니다.", 400);
  }
  return { pack, version };
}

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

  const { pack, version } = await requireOwnedDraftPack(client, findProfile, {
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const pipelineRun = await client.pipelineRun.create({
    data: {
      packId: pack.packId,
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
    requirePgvector: input.requirePgvector,
    env: input.env,
    prismaClient: input.prismaClient,
    deps: {
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

  // Success: reflect the completed draft generation (worker already embedded +
  // vectors were mirrored during import). Best-effort READY; keep INDEXING on a
  // count edge rather than failing an import that already succeeded.
  let generationReady = false;
  try {
    const counts = {
      embeddedCount: result.importedEmbeddingCount,
      chunkCount: result.importedChunkCount,
    };
    await transitions.toEmbedding(generationId);
    await transitions.toIndexing(generationId, counts);
    await transitions.toReady(generationId, counts);
    generationReady = true;
  } catch (error) {
    warnings.push({
      code: "GENERATION_READY_DEFERRED",
      message:
        error instanceof Error
          ? `검색데이터 세대 상태 전환이 지연되었습니다: ${error.message}`
          : "검색데이터 세대 상태 전환이 지연되었습니다.",
    });
  }

  await client.pipelineRun
    .update({ where: { id: pipelineRun.id }, data: { status: "PASS", finishedAt: new Date() } })
    .catch(() => undefined);

  return {
    ok: true,
    pipelineRunId: pipelineRun.id,
    searchIndexGenerationId: result.searchIndexGenerationId ?? generationId,
    logicalStage: result.logicalStage,
    pipelineStatus: result.pipelineStatus,
    importedChunkCount: result.importedChunkCount,
    importedEmbeddingCount: result.importedEmbeddingCount,
    pgvectorReflected: result.pgvectorReflected,
    warnings,
    nextStep: "SEARCH_DATA_VALIDATION",
    generationReady,
  };
}
