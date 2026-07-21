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
import type { WorkerExclusionSummary } from "@/lib/python-worker/worker-output-contract";
import {
  createWorkerZipStepRecorder,
  finalizeWorkerZipSteps,
} from "@/lib/python-worker/worker-zip-step-log";
import { Readable } from "node:stream";
import { withTempFileFromStream } from "@/lib/object-storage/stream-object-helpers";
import { synthesizeWorkerZipSearchGeneration } from "@/lib/python-worker/worker-zip-generation-bridge";
import {
  deleteWorkerZipRequest,
  getWorkerZipRequestBytes,
  getWorkerZipRequestMetadata,
  markWorkerZipRequestRejected,
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
  /** P7.4: read-only roll-up of files the Worker auto-excluded (advisory). */
  exclusionSummary?: WorkerExclusionSummary;
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

/**
 * P7.3: PipelineRun.triggerType marker for a Provider generation REQUEST.
 *
 * The request itself is store-only (no Worker run), but a lightweight PipelineRun
 * marker (status PENDING) is created so the Admin queue can list DRAFT packs with a
 * pending request via a DB query (triggerType is indexed) — no schema change. The
 * marker is retired (PASS) once an Admin executes generation, or superseded
 * (SKIPPED) when the Provider re-submits.
 */
export const WORKER_ZIP_REQUEST_TRIGGER = "WORKER_ZIP_REQUEST";

/**
 * P7.3: request marker status encoding the 접수(accept) lifecycle (no schema change):
 * - PENDING  → 접수 대기 (REQUESTED)   — Provider may withdraw
 * - RUNNING  → 접수완료 (ACCEPTED)     — Admin received it; Provider may NOT withdraw
 * - PASS     → retired after a successful generation
 * - SKIPPED  → withdrawn / superseded by a re-submission
 */
export const WORKER_ZIP_REQUEST_ACCEPTED_STATUS = "RUNNING";

/** Latest open (PENDING|ACCEPTED) request marker for a pack, or null. */
async function getLatestOpenRequestMarker(
  client: typeof prisma,
  packId: string,
): Promise<{ status: string; createdAt: Date } | null> {
  const marker = await client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS] },
    },
    orderBy: { createdAt: "desc" },
    select: { status: true, createdAt: true },
  });
  return marker ? { status: marker.status, createdAt: marker.createdAt } : null;
}

/* ------------------------------------------------------------------ *
 * P7.3: Provider "생성 요청" (store-only — the Provider never runs the Worker).
 * ------------------------------------------------------------------ */

export type ProviderWorkerZipRequestStatus =
  | "NONE"
  | "REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
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

  // Retire any prior open marker, then record a fresh PENDING request marker so
  // the Admin queue can surface this DRAFT pack. Non-fatal if it fails.
  try {
    await client.pipelineRun.updateMany({
      where: { packId: pack.packId, triggerType: WORKER_ZIP_REQUEST_TRIGGER, status: "PENDING" },
      data: { status: "SKIPPED", finishedAt: new Date() },
    });
    await client.pipelineRun.create({
      data: {
        packId: pack.packId,
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        triggeredByClientId: input.clientId,
        status: "PENDING",
        summary: `지식데이터 생성 요청: ${stored.originalFileName}`,
      },
    });
  } catch {
    // The request ZIP is stored regardless; the marker is best-effort.
  }

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

export type WithdrawProviderWorkerZipRequestInput = {
  userId: string;
  clientId: string;
  packId: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  findProfile?: (userId: string, clientId: string) => Promise<{ id: string } | null>;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  deleteRequest?: typeof deleteWorkerZipRequest;
};

/**
 * Withdraw a pending generation request (Provider "요청 회수"). Only allowed while
 * the request is still 접수 대기 (REQUESTED) — i.e. before an Admin starts/finishes
 * generation. Removes the stored ZIP + metadata and retires the request marker.
 */
export async function withdrawProviderWorkerZipRequest(
  input: WithdrawProviderWorkerZipRequestInput,
): Promise<{ ok: true; packId: string; versionId: string }> {
  const client = input.prismaClient ?? prisma;
  const findProfile = input.findProfile ?? findOrEnsureProviderProfileForUser;
  const getRequestMetadata = input.getRequestMetadata ?? getWorkerZipRequestMetadata;
  const deleteRequest = input.deleteRequest ?? deleteWorkerZipRequest;

  const { pack, version } = await requireOwnedDraftPack(client, findProfile, {
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const [request, lastRun, marker] = await Promise.all([
    getRequestMetadata({ packId: pack.packId, packVersionId: version.id, env: input.env }),
    client.pipelineRun.findFirst({
      where: { packId: pack.packId, triggerType: "WORKER_ZIP_IMPORT" },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true },
    }),
    getLatestOpenRequestMarker(client, pack.packId),
  ]);

  const status = deriveRequestStatus(request, lastRun, marker);
  if (status === "ACCEPTED") {
    throw new WorkerZipImportServiceError(
      "REQUEST_ALREADY_ACCEPTED",
      "관리자가 접수하여 회수할 수 없습니다.",
      409,
    );
  }
  if (status === "PROCESSING") {
    throw new WorkerZipImportServiceError(
      "REQUEST_IN_PROGRESS",
      "이미 지식데이터 생성이 진행 중이라 회수할 수 없습니다.",
      409,
    );
  }
  if (status !== "REQUESTED") {
    throw new WorkerZipImportServiceError(
      "REQUEST_NOT_WITHDRAWABLE",
      "접수 대기 상태의 요청만 회수할 수 있습니다.",
      409,
    );
  }

  await deleteRequest({ packId: pack.packId, packVersionId: version.id, env: input.env });

  try {
    await client.pipelineRun.updateMany({
      where: { packId: pack.packId, triggerType: WORKER_ZIP_REQUEST_TRIGGER, status: "PENDING" },
      data: { status: "SKIPPED", finishedAt: new Date() },
    });
  } catch {
    // Non-fatal: the stored request is already removed.
  }

  return { ok: true, packId: pack.packId, versionId: version.id };
}

type RequestMarkerRef = { status: string; createdAt?: Date | string | null } | null;
type LastRunRef = { status: string; createdAt?: Date | string | null } | null;

function toTime(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function deriveRequestStatus(
  request: WorkerZipRequestMetadata | null,
  lastRun: LastRunRef,
  marker: RequestMarkerRef = null,
): ProviderWorkerZipRequestStatus {
  const lastRunStatus = lastRun?.status ?? null;

  // An actively running generation always wins.
  if (lastRunStatus === "RUNNING") return "PROCESSING";

  // A fresh request cycle: if an open marker (요청/접수) was created AFTER the last
  // terminal run, the Provider has re-submitted — reset the visible status so a
  // prior FAIL/PASS no longer masks the new request.
  const markerTime = toTime(marker?.createdAt);
  const runTime = toTime(lastRun?.createdAt);
  const markerIsFresh =
    marker != null &&
    (lastRun == null || (markerTime != null && runTime != null && markerTime >= runTime));
  if (marker && markerIsFresh) {
    return marker.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS ? "ACCEPTED" : "REQUESTED";
  }

  if (lastRunStatus === "PASS") return "COMPLETED";
  // A pre-execution Admin rejection is terminal for this request cycle. It ranks
  // above a stale FAIL run and below a completed run; a fresh Provider submission
  // overwrites the sidecar (clearing `rejection`), returning to REQUESTED.
  if (request?.rejection) return "REJECTED";
  if (lastRunStatus === "FAIL") return "FAILED";
  if (!request) return "NONE";
  if (marker?.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS) return "ACCEPTED";
  return "REQUESTED";
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

  const [request, lastRun, marker, latestReview] = await Promise.all([
    getRequestMetadata({ packId: pack.packId, packVersionId: version.id, env: input.env }),
    client.pipelineRun.findFirst({
      where: { packId: pack.packId, triggerType: "WORKER_ZIP_IMPORT" },
      orderBy: { createdAt: "desc" },
      select: { status: true, finishedAt: true, summary: true, createdAt: true },
    }),
    getLatestOpenRequestMarker(client, pack.packId),
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
    requestStatus: deriveRequestStatus(request, lastRun, marker),
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

  // Executing implies acceptance: lock the request (접수완료) before running so the
  // Provider can no longer withdraw it mid-generation.
  try {
    await client.pipelineRun.updateMany({
      where: { packId: pack.packId, triggerType: WORKER_ZIP_REQUEST_TRIGGER, status: "PENDING" },
      data: { status: WORKER_ZIP_REQUEST_ACCEPTED_STATUS },
    });
  } catch {
    // Non-fatal: acceptance marker is best-effort.
  }

  const result = await withTempFileFromStream(Readable.from(Buffer.from(bytes)), (inputZipPath) =>
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

  // On success, retire the open request marker so it leaves the Admin queue.
  if (result.ok) {
    try {
      await client.pipelineRun.updateMany({
        where: {
          packId: pack.packId,
          triggerType: WORKER_ZIP_REQUEST_TRIGGER,
          status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS] },
        },
        data: { status: "PASS", finishedAt: new Date() },
      });
    } catch {
      // Non-fatal: the generation already succeeded.
    }
  }

  return result;
}

export type AcceptAdminWorkerZipRequestInput = {
  adminUserId: string;
  clientId: string;
  packId: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  resolvePack?: WorkerZipPackResolver;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
};

/**
 * Admin 접수(accept): mark a pending generation request as 접수완료 (ACCEPTED). After
 * this, the Provider can no longer withdraw the request. Idempotent — accepting an
 * already-accepted request is a no-op.
 */
export async function acceptAdminWorkerZipRequest(
  input: AcceptAdminWorkerZipRequestInput,
): Promise<{ ok: true; packId: string; versionId: string; requestStatus: ProviderWorkerZipRequestStatus }> {
  const client = input.prismaClient ?? prisma;
  const resolvePack = input.resolvePack ?? resolveAdminDraftPack;
  const getRequestMetadata = input.getRequestMetadata ?? getWorkerZipRequestMetadata;

  const { pack, version } = await resolvePack(client, {
    userId: input.adminUserId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const request = await getRequestMetadata({
    packId: pack.packId,
    packVersionId: version.id,
    env: input.env,
  });
  if (!request) {
    throw new WorkerZipImportServiceError(
      "REQUEST_NOT_FOUND",
      "접수할 생성 요청(ZIP 자료)이 없습니다.",
      404,
    );
  }

  const updated = await client.pipelineRun.updateMany({
    where: { packId: pack.packId, triggerType: WORKER_ZIP_REQUEST_TRIGGER, status: "PENDING" },
    data: { status: WORKER_ZIP_REQUEST_ACCEPTED_STATUS, triggeredByClientId: input.clientId },
  });

  // No PENDING marker (e.g. a legacy request without a marker): ensure an accepted
  // marker exists so the state consistently reads 접수완료.
  if (updated.count === 0) {
    const existing = await client.pipelineRun.findFirst({
      where: {
        packId: pack.packId,
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        status: WORKER_ZIP_REQUEST_ACCEPTED_STATUS,
      },
      select: { id: true },
    });
    if (!existing) {
      await client.pipelineRun.create({
        data: {
          packId: pack.packId,
          triggerType: WORKER_ZIP_REQUEST_TRIGGER,
          triggeredByClientId: input.clientId,
          status: WORKER_ZIP_REQUEST_ACCEPTED_STATUS,
          summary: `지식데이터 생성 요청 접수: ${request.originalFileName}`,
        },
      });
    }
  }

  return { ok: true, packId: pack.packId, versionId: version.id, requestStatus: "ACCEPTED" };
}

export type RejectAdminWorkerZipRequestInput = {
  adminUserId: string;
  clientId: string;
  packId: string;
  reason: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  resolvePack?: WorkerZipPackResolver;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  markRejected?: typeof markWorkerZipRequestRejected;
};

/**
 * P7.5: Admin "자료 반려" — reject a generation request (접수 전/후 모두 가능). The
 * original ZIP is preserved; the pack stays DRAFT so the Provider can fix the ZIP
 * and re-request. Rejection is blocked once generation is running or terminal.
 */
export async function rejectAdminWorkerZipRequest(
  input: RejectAdminWorkerZipRequestInput,
): Promise<{ ok: true; packId: string; versionId: string; requestStatus: "REJECTED"; message: string }> {
  const client = input.prismaClient ?? prisma;
  const resolvePack = input.resolvePack ?? resolveAdminDraftPack;
  const getRequestMetadata = input.getRequestMetadata ?? getWorkerZipRequestMetadata;
  const markRejected = input.markRejected ?? markWorkerZipRequestRejected;

  const reason = input.reason?.trim() ?? "";
  if (!reason) {
    throw new WorkerZipImportServiceError(
      "REJECTION_REASON_REQUIRED",
      "반려 사유를 입력해 주세요.",
      400,
    );
  }

  const { pack, version } = await resolvePack(client, {
    userId: input.adminUserId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const [request, lastRun, marker] = await Promise.all([
    getRequestMetadata({ packId: pack.packId, packVersionId: version.id, env: input.env }),
    client.pipelineRun.findFirst({
      where: { packId: pack.packId, triggerType: "WORKER_ZIP_IMPORT" },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true },
    }),
    getLatestOpenRequestMarker(client, pack.packId),
  ]);

  if (!request) {
    throw new WorkerZipImportServiceError(
      "REQUEST_NOT_FOUND",
      "반려할 생성 요청(ZIP 자료)이 없습니다.",
      404,
    );
  }

  const status = deriveRequestStatus(request, lastRun, marker);
  if (status === "PROCESSING") {
    throw new WorkerZipImportServiceError(
      "REQUEST_IN_PROGRESS",
      "지식데이터 생성이 진행 중이라 반려할 수 없습니다.",
      409,
    );
  }
  if (status === "COMPLETED") {
    throw new WorkerZipImportServiceError(
      "REQUEST_ALREADY_COMPLETED",
      "이미 생성이 완료되어 반려할 수 없습니다.",
      409,
    );
  }
  if (status === "REJECTED") {
    throw new WorkerZipImportServiceError(
      "REQUEST_ALREADY_REJECTED",
      "이미 반려된 요청입니다.",
      409,
    );
  }
  if (status !== "REQUESTED" && status !== "ACCEPTED") {
    throw new WorkerZipImportServiceError(
      "REQUEST_NOT_REJECTABLE",
      "요청됨 또는 접수됨 상태에서만 반려할 수 있습니다.",
      409,
    );
  }

  // Record the rejection on the request sidecar (keeps the original ZIP).
  await markRejected({
    packId: pack.packId,
    packVersionId: version.id,
    reason,
    rejectedByUserId: input.adminUserId,
    env: input.env,
  });

  // Retire the open request marker so it leaves the Admin 접수함 queue. The pack
  // stays DRAFT; the Provider can re-submit a corrected ZIP.
  try {
    await client.pipelineRun.updateMany({
      where: {
        packId: pack.packId,
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS] },
      },
      data: { status: "SKIPPED", finishedAt: new Date(), summary: `반려: ${reason.slice(0, 200)}` },
    });
  } catch {
    // Non-fatal: the rejection is already recorded on the sidecar.
  }

  return {
    ok: true,
    packId: pack.packId,
    versionId: version.id,
    requestStatus: "REJECTED",
    message: "생성 요청이 반려되었습니다.",
  };
}

/* ------------------------------------------------------------------ *
 * P7.3: Admin 접수함 — DRAFT packs with a pending generation request.
 * ------------------------------------------------------------------ */

export type AdminWorkerZipRequestListItem = {
  packId: string;
  packName: string;
  providerName: string | null;
  versionLabel: string | null;
  requestedAt: string;
  originalFileName: string | null;
  /** True once an Admin has 접수(accepted) the request (접수완료). */
  accepted: boolean;
};

/**
 * List DRAFT packs that have a pending ZIP generation request (접수 대기), newest
 * first, deduped by pack. Backed by the indexed PipelineRun request marker.
 */
export async function listAdminWorkerZipRequests(input?: {
  prismaClient?: typeof prisma;
  env?: NodeJS.ProcessEnv;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
}): Promise<AdminWorkerZipRequestListItem[]> {
  const client = input?.prismaClient ?? prisma;
  const getRequestMetadata = input?.getRequestMetadata ?? getWorkerZipRequestMetadata;

  const runs = await client.pipelineRun.findMany({
    where: {
      triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS] },
      pack: { status: PackStatus.DRAFT },
    },
    orderBy: { createdAt: "desc" },
    select: {
      packId: true,
      createdAt: true,
      status: true,
      pack: {
        select: {
          name: true,
          providerProfile: { select: { displayName: true } },
          versions: {
            orderBy: latestKnowledgePackVersionOrderBy,
            take: 1,
            select: { id: true, version: true },
          },
        },
      },
    },
  });

  const seen = new Set<string>();
  const items: AdminWorkerZipRequestListItem[] = [];
  for (const run of runs) {
    if (seen.has(run.packId)) continue;
    seen.add(run.packId);
    const version = run.pack?.versions?.[0] ?? null;
    let originalFileName: string | null = null;
    if (version) {
      const meta = await getRequestMetadata({
        packId: run.packId,
        packVersionId: version.id,
        env: input?.env,
      }).catch(() => null);
      originalFileName = meta?.originalFileName ?? null;
    }
    items.push({
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      versionLabel: version?.version ?? null,
      requestedAt: run.createdAt.toISOString(),
      originalFileName,
      accepted: run.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS,
    });
  }
  return items;
}
