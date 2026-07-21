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
import { Readable } from "node:stream";
import { withTempFileFromStream } from "@/lib/object-storage/stream-object-helpers";
import { synthesizeWorkerZipSearchGeneration } from "@/lib/python-worker/worker-zip-generation-bridge";
import {
  getWorkerZipRequestBytes,
  getWorkerZipRequestMetadata,
  storeWorkerZipRequest,
  type WorkerZipRequestMetadata,
} from "@/lib/python-worker/worker-zip-request-storage";
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
  /**
   * P7.3: how the caller's authority over the pack is resolved. Defaults to the
   * provider-profile ownership check. The Admin execute path injects
   * {@link resolveAdminDraftPack} so an operator can run the Worker on a DRAFT
   * request without owning the provider profile.
   */
  resolvePack?: WorkerZipPackResolver;
};

export type ResolvedWorkerZipPack = {
  pack: { packId: string; name: string; status: PackStatus };
  version: { id: string; version: string; language: string | null };
};

export type WorkerZipPackResolver = (
  client: typeof prisma,
  input: { userId: string; clientId: string; packId: string },
) => Promise<ResolvedWorkerZipPack>;

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
    case "GENERATION_READY_DEFERRED":
      return {
        message: "데이터는 생성됐지만 검색데이터 준비가 지연되었습니다. 다시 시도하거나 관리자에게 문의하세요.",
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
 * P7.3: Admin pack resolver — finds a DRAFT pack by packId regardless of which
 * provider owns it. Used by the Admin execute route (which is already gated by
 * `requireAdminSession`); the operator does not need the provider's profile.
 */
export const resolveAdminDraftPack: WorkerZipPackResolver = async (client, input) => {
  const pack = await client.knowledgePack.findFirst({
    where: { packId: input.packId },
    include: { versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 } },
  });
  if (!pack) {
    throw new WorkerZipImportServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  if (pack.status !== PackStatus.DRAFT) {
    throw new WorkerZipImportServiceError(
      "PACK_NOT_EDITABLE",
      "초안(DRAFT) 상태의 요청만 지식데이터 생성을 실행할 수 있습니다.",
      409,
    );
  }
  const version = pack.versions[0];
  if (!version) {
    throw new WorkerZipImportServiceError("INCOMPLETE", "버전이 없습니다.", 400);
  }
  return { pack, version };
};

/* ------------------------------------------------------------------ *
 * P7.3: Provider "생성 요청" (store-only — the Provider never runs the Worker).
 * ------------------------------------------------------------------ */

export type ProviderWorkerZipRequestStatus =
  | "NONE"
  | "REQUESTED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type ProviderWorkerZipRequestState = {
  packId: string;
  versionId: string;
  requestStatus: ProviderWorkerZipRequestStatus;
  request: WorkerZipRequestMetadata | null;
  lastRun: { status: string; finishedAt: string | null; summary: string | null } | null;
  reviewMemo: string | null;
};

export type SubmitProviderWorkerZipRequestInput = {
  userId: string;
  clientId: string;
  packId: string;
  bytes: Uint8Array;
  originalFileName: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  findProfile?: (userId: string, clientId: string) => Promise<{ id: string } | null>;
  storeRequest?: typeof storeWorkerZipRequest;
};

/**
 * Store a Provider-submitted ZIP as a knowledge-data generation request. This
 * does NOT run the Worker (execution is Admin-only) and keeps the pack in DRAFT.
 */
export async function submitProviderWorkerZipRequest(
  input: SubmitProviderWorkerZipRequestInput,
): Promise<{ ok: true; packId: string; versionId: string; request: WorkerZipRequestMetadata }> {
  const client = input.prismaClient ?? prisma;
  const findProfile = input.findProfile ?? findOrEnsureProviderProfileForUser;
  const storeRequest = input.storeRequest ?? storeWorkerZipRequest;

  const { pack, version } = await requireOwnedDraftPack(client, findProfile, {
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const stored = await storeRequest({
    packId: pack.packId,
    packVersionId: version.id,
    bytes: input.bytes,
    originalFileName: input.originalFileName,
    uploadedByUserId: input.userId,
    env: input.env,
  });

  return {
    ok: true,
    packId: pack.packId,
    versionId: version.id,
    request: {
      originalFileName: stored.originalFileName,
      fileSize: stored.fileSize,
      checksumSha256: stored.checksumSha256,
      uploadedAt: stored.uploadedAt,
      uploadedByUserId: stored.uploadedByUserId,
    },
  };
}

function deriveRequestStatus(
  request: WorkerZipRequestMetadata | null,
  lastRunStatus: string | null,
): ProviderWorkerZipRequestStatus {
  if (lastRunStatus === "RUNNING") return "PROCESSING";
  if (lastRunStatus === "PASS") return "COMPLETED";
  if (lastRunStatus === "FAIL") return "FAILED";
  if (request) return "REQUESTED";
  return "NONE";
}

/**
 * Read the current request state for the Provider/Admin screens (no execution).
 * Status is approximated from the stored request + latest WORKER_ZIP PipelineRun.
 */
export async function getProviderWorkerZipRequestState(input: {
  userId: string;
  clientId: string;
  packId: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  resolvePack?: WorkerZipPackResolver;
  findProfile?: (userId: string, clientId: string) => Promise<{ id: string } | null>;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
}): Promise<ProviderWorkerZipRequestState> {
  const client = input.prismaClient ?? prisma;
  const findProfile = input.findProfile ?? findOrEnsureProviderProfileForUser;
  const resolvePack = input.resolvePack ?? ((c, i) => requireOwnedDraftPack(c, findProfile, i));
  const getRequestMetadata = input.getRequestMetadata ?? getWorkerZipRequestMetadata;

  const { pack, version } = await resolvePack(client, {
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const [request, lastRun, latestReview] = await Promise.all([
    getRequestMetadata({ packId: pack.packId, packVersionId: version.id, env: input.env }),
    client.pipelineRun.findFirst({
      where: { packId: pack.packId, triggerType: "WORKER_ZIP_IMPORT" },
      orderBy: { createdAt: "desc" },
      select: { status: true, finishedAt: true, summary: true },
    }),
    client.packReview
      .findFirst({
        where: { packId: pack.packId, decision: "REJECT" },
        orderBy: { decidedAt: "desc" },
        select: { rejectionReason: true },
      })
      .catch(() => null),
  ]);

  return {
    packId: pack.packId,
    versionId: version.id,
    requestStatus: deriveRequestStatus(request, lastRun?.status ?? null),
    request,
    lastRun: lastRun
      ? {
          status: lastRun.status,
          finishedAt: lastRun.finishedAt ? lastRun.finishedAt.toISOString() : null,
          summary: lastRun.summary ?? null,
        }
      : null,
    reviewMemo: latestReview?.rejectionReason?.trim() || null,
  };
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

  return {
    ok: true,
    ...baseSuccessResult,
    warnings,
    nextStep: "SEARCH_DATA_VALIDATION",
    generationReady: true,
  };
}

/* ------------------------------------------------------------------ *
 * P7.3: Admin "지식데이터 생성 실행" — execution authority lives here only.
 * ------------------------------------------------------------------ */

export type RunAdminWorkerZipGenerationInput = {
  adminUserId: string;
  clientId: string;
  packId: string;
  requirePgvector?: boolean;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  /** Injectable for tests. */
  getRequestBytes?: typeof getWorkerZipRequestBytes;
  runImport?: typeof runProviderWorkerZipImport;
  resolvePack?: WorkerZipPackResolver;
};

/**
 * Execute the ZIP Worker for an Admin-received request. The Admin route is gated
 * by `requireAdminSession`; this function is the only place Worker execution is
 * driven for the ZIP path. It downloads the Provider-submitted ZIP, guards
 * against a concurrent run, and runs the pipeline against the DRAFT pack.
 */
export async function runAdminWorkerZipGeneration(
  input: RunAdminWorkerZipGenerationInput,
): Promise<ProviderWorkerZipImportResult> {
  const client = input.prismaClient ?? prisma;
  const getRequestBytes = input.getRequestBytes ?? getWorkerZipRequestBytes;
  const runImport = input.runImport ?? runProviderWorkerZipImport;
  const resolvePack = input.resolvePack ?? resolveAdminDraftPack;

  const { pack, version } = await resolvePack(client, {
    userId: input.adminUserId,
    clientId: input.clientId,
    packId: input.packId,
  });

  // Prevent duplicate execution while a run is already in progress.
  const running = await client.pipelineRun.findFirst({
    where: { packId: pack.packId, triggerType: "WORKER_ZIP_IMPORT", status: "RUNNING" },
    select: { id: true },
  });
  if (running) {
    throw new WorkerZipImportServiceError(
      "ALREADY_RUNNING",
      "이미 지식데이터 생성이 진행 중입니다. 완료 후 다시 시도하세요.",
      409,
    );
  }

  const bytes = await getRequestBytes({
    packId: pack.packId,
    packVersionId: version.id,
    env: input.env,
  });
  if (!bytes) {
    throw new WorkerZipImportServiceError(
      "REQUEST_NOT_FOUND",
      "생성 요청된 ZIP 자료가 없습니다. 제공자에게 자료 등록을 요청하세요.",
      404,
    );
  }

  return withTempFileFromStream(Readable.from(Buffer.from(bytes)), (inputZipPath) =>
    runImport({
      userId: input.adminUserId,
      clientId: input.clientId,
      packId: pack.packId,
      inputZipPath,
      requirePgvector: input.requirePgvector,
      env: input.env,
      prismaClient: input.prismaClient,
      resolvePack: resolveAdminDraftPack,
    }),
  );
}
