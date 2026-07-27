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
  acknowledgeWorkerZipRequestRejection,
  clearWorkerZipRequestRejection,
  deleteWorkerZipRequest,
  getWorkerZipRequestBytes,
  getWorkerZipRequestMetadata,
  markWorkerZipRequestRejected,
  storeWorkerZipRequest,
  type WorkerZipRequestMetadata,
} from "@/lib/python-worker/worker-zip-request-storage";
import type { WorkerZipLogicalStage } from "@/lib/python-worker/worker-zip-pipeline-stages";
import { batchResolveStoreWorkflowMarkers } from "@/lib/store-workflow-markers";
import { buildAdminWorkInboxItemViewModel } from "@/lib/admin-work-inbox-view-model";
import {
  markSearchGenerationEmbedding,
  markSearchGenerationFailed,
  markSearchGenerationIndexing,
  markSearchGenerationReady,
} from "@/lib/search-generation/search-generation-service";
import { resetWorkerZipSuccessorStateAfterGeneration } from "@/lib/python-worker/worker-zip-successor-reset";

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
  /** Admin 사전정리 제외 경로 — forwarded to the Worker pipeline. */
  adminExcludePaths?: readonly string[];
  /** P1: immutable source revision that produced this ZIP run. */
  sourceRevisionId?: string | null;
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

/**
 * Admin has 접수'd the ZIP generation request, is running generation, or has
 * finished generation while the pack is still in the Admin DRAFT queue
 * (품질 점검 / 검수 승격 전). Provider must not edit during any of these.
 */
export type ProviderAdminGenerationHold = "ACCEPTED" | "PROCESSING" | "COMPLETED";

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

/**
 * Resolve whether admin currently holds the pack after 접수.
 * - PROCESSING: generation running
 * - ACCEPTED: 접수완료, not yet finished
 * - COMPLETED: generation done, still DRAFT in admin queue (until PackReview or 반려)
 * REQUESTED / FAILED / REJECTED are not holds (provider may edit or re-submit).
 */
export async function resolveProviderAdminGenerationHold(
  packId: string,
  client: typeof prisma = prisma,
): Promise<ProviderAdminGenerationHold | null> {
  const trimmed = packId.trim();
  if (!trimmed) return null;

  const [processingRun, openMarker, completedMarker, draftPack] = await Promise.all([
    client.pipelineRun.findFirst({
      where: {
        packId: trimmed,
        triggerType: "WORKER_ZIP_IMPORT",
        status: "RUNNING",
      },
      select: { id: true },
    }),
    getLatestOpenRequestMarker(client, trimmed),
    client.pipelineRun.findFirst({
      where: {
        packId: trimmed,
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        status: "PASS",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    client.knowledgePack.findFirst({
      where: { packId: trimmed, status: PackStatus.DRAFT },
      select: { packId: true },
    }),
  ]);

  if (processingRun) return "PROCESSING";
  if (openMarker?.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS) return "ACCEPTED";
  // Fresh REQUESTED (PENDING) — provider may still withdraw / replace materials.
  if (openMarker?.status === "PENDING") return null;
  // Generation complete, still DRAFT in admin queue (listAdminWorkerZipRequests).
  if (completedMarker && draftPack) return "COMPLETED";
  return null;
}

/** Batch hold resolution for provider pack list CTAs. */
export async function batchResolveProviderAdminGenerationHold(
  packIds: string[],
  client: typeof prisma = prisma,
): Promise<Map<string, ProviderAdminGenerationHold | null>> {
  const unique = [...new Set(packIds.map((id) => id.trim()).filter(Boolean))];
  const result = new Map<string, ProviderAdminGenerationHold | null>();
  for (const id of unique) result.set(id, null);
  if (unique.length === 0) return result;

  const [processingRuns, openMarkers, completedMarkers, draftPacks] = await Promise.all([
    client.pipelineRun.findMany({
      where: {
        packId: { in: unique },
        triggerType: "WORKER_ZIP_IMPORT",
        status: "RUNNING",
      },
      select: { packId: true },
    }),
    client.pipelineRun.findMany({
      where: {
        packId: { in: unique },
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS] },
      },
      orderBy: { createdAt: "desc" },
      select: { packId: true, status: true, createdAt: true },
    }),
    client.pipelineRun.findMany({
      where: {
        packId: { in: unique },
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        status: "PASS",
      },
      orderBy: { createdAt: "desc" },
      select: { packId: true },
    }),
    client.knowledgePack.findMany({
      where: { packId: { in: unique }, status: PackStatus.DRAFT },
      select: { packId: true },
    }),
  ]);

  const processing = new Set(processingRuns.map((r) => r.packId));
  const draftSet = new Set(draftPacks.map((p) => p.packId));
  const latestOpen = new Map<string, { status: string }>();
  for (const m of openMarkers) {
    if (!latestOpen.has(m.packId)) latestOpen.set(m.packId, { status: m.status });
  }
  const hasCompleted = new Set<string>();
  for (const m of completedMarkers) {
    if (!hasCompleted.has(m.packId)) hasCompleted.add(m.packId);
  }

  for (const packId of unique) {
    if (processing.has(packId)) {
      result.set(packId, "PROCESSING");
      continue;
    }
    const open = latestOpen.get(packId);
    if (open?.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS) {
      result.set(packId, "ACCEPTED");
      continue;
    }
    if (open?.status === "PENDING") {
      result.set(packId, null);
      continue;
    }
    if (hasCompleted.has(packId) && draftSet.has(packId)) {
      result.set(packId, "COMPLETED");
      continue;
    }
    result.set(packId, null);
  }

  return result;
}

/** Coarse zip request status for list cards (marker + hold aligned). */
export function deriveListWorkerZipRequestStatus(input: {
  adminGenerationHold: ProviderAdminGenerationHold | null;
  hasPendingRequestMarker: boolean;
}):
  | "NONE"
  | "REQUESTED"
  | "ACCEPTED"
  | "PROCESSING"
  | "COMPLETED" {
  if (input.adminGenerationHold === "PROCESSING") return "PROCESSING";
  if (input.adminGenerationHold === "ACCEPTED") return "ACCEPTED";
  if (input.adminGenerationHold === "COMPLETED") return "COMPLETED";
  if (input.hasPendingRequestMarker) return "REQUESTED";
  return "NONE";
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

  const { pack, version } = await requireOwnedDraftPack(client, findProfile, {
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const adminHold = await resolveProviderAdminGenerationHold(pack.packId, client);
  if (adminHold) {
    throw new WorkerZipImportServiceError(
      "PACK_NOT_EDITABLE",
      "관리자가 생성 요청을 접수한 뒤에는 자료를 교체할 수 없습니다.",
      409,
    );
  }

  // P1: immutable source revision (checksum idempotency + unique object key).
  // Injectable `storeRequest` keeps the legacy path for existing unit tests.
  let stored: {
    originalFileName: string;
    fileSize: number;
    checksumSha256: string;
    uploadedAt: string;
    uploadedByUserId: string;
    sourceRevisionId?: string;
    objectKey?: string;
  };

  if (input.storeRequest) {
    const legacy = await input.storeRequest({
      packId: pack.packId,
      packVersionId: version.id,
      bytes: input.bytes,
      originalFileName: input.originalFileName,
      uploadedByUserId: input.userId,
      env: input.env,
    });
    stored = {
      originalFileName: legacy.originalFileName,
      fileSize: legacy.fileSize,
      checksumSha256: legacy.checksumSha256,
      uploadedAt: legacy.uploadedAt,
      uploadedByUserId: legacy.uploadedByUserId,
      sourceRevisionId: legacy.sourceRevisionId,
      objectKey: legacy.objectKey,
    };
  } else {
    const { storeWorkerZipSourceRevision } = await import(
      "@/lib/python-worker/worker-zip-source-revision-service"
    );
    const revision = await storeWorkerZipSourceRevision({
      packId: pack.packId,
      versionId: version.id,
      clientId: input.clientId,
      bytes: input.bytes,
      originalFileName: input.originalFileName,
      submittedById: input.userId,
      reason: "PROVIDER_UPLOAD",
      env: input.env,
      prismaClient: client,
    });
    stored = {
      originalFileName: revision.originalFileName ?? input.originalFileName,
      fileSize: revision.sizeBytes,
      checksumSha256: revision.checksumSha256,
      uploadedAt: revision.createdAt.toISOString(),
      uploadedByUserId: revision.submittedById ?? input.userId,
      sourceRevisionId: revision.id,
      objectKey: revision.storageKey,
    };
  }

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
      sourceRevisionId: stored.sourceRevisionId,
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

  // Admin 반려(사유 기록)가 있으면 생성 완료(PASS)보다 우선한다. 제공자가 ZIP을
  // 다시 요청하면 sidecar의 rejection이 지워지고, 새 marker가 fresh로 REQUESTED가 된다.
  if (request?.rejection) return "REJECTED";
  if (lastRunStatus === "PASS") return "COMPLETED";
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
  const resetSuccessorState =
    input.resetSuccessorState ?? resetWorkerZipSuccessorStateAfterGeneration;
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
    adminExcludePaths: input.adminExcludePaths,
    sourceRevisionId: input.sourceRevisionId,
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
  // Admin must re-run 품질점검 and cannot reuse stale PASS reports.
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

  // Quality gates (원천검증/구조/청킹/검색평가) are NOT auto-run here — they can
  // take minutes on large packs and would risk timing out the Admin HTTP request
  // that already waited for the Worker. Admin runs them via
  // POST .../worker-zip/quality-refresh ("판단 근거 품질 점검").
  warnings.push({
    code: "QUALITY_REFRESH_PENDING",
    message:
      "지식데이터 생성은 완료되었습니다. 판단 근거(주의 이슈)에 반영하려면 ‘판단 근거 품질 점검’을 실행해 주세요.",
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
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
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
  const getRequestMetadata = input.getRequestMetadata ?? getWorkerZipRequestMetadata;
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

  const {
    lazyBackfillWorkerZipSourceRevisionFromLegacy,
    getLatestWorkerZipSourceRevision,
    getWorkerZipSourceRevisionBytes,
    markWorkerZipSourceRevisionProcessing,
    activateWorkerZipSourceRevision,
  } = await import("@/lib/python-worker/worker-zip-source-revision-service");

  let revision =
    (await getLatestWorkerZipSourceRevision({
      versionId: version.id,
      prismaClient: client,
    })) ??
    (await lazyBackfillWorkerZipSourceRevisionFromLegacy({
      packId: pack.packId,
      versionId: version.id,
      clientId: input.clientId,
      env: input.env,
      prismaClient: client,
    }));

  let bytes: Uint8Array | null = null;
  if (revision) {
    bytes = await getWorkerZipSourceRevisionBytes({
      revision,
      packId: pack.packId,
      versionId: version.id,
      env: input.env,
    });
  }
  if (!bytes) {
    bytes = await getRequestBytes({
      packId: pack.packId,
      packVersionId: version.id,
      env: input.env,
    });
  }
  if (!bytes) {
    throw new WorkerZipImportServiceError(
      "REQUEST_NOT_FOUND",
      "생성 요청된 ZIP 자료가 없습니다. 제공자에게 자료 등록을 요청하세요.",
      404,
    );
  }

  if (revision) {
    await markWorkerZipSourceRevisionProcessing({
      revisionId: revision.id,
      prismaClient: client,
    }).catch(() => undefined);
  }

  const requestMeta = await getRequestMetadata({
    packId: pack.packId,
    packVersionId: version.id,
    env: input.env,
  });
  const adminExcludePaths = requestMeta?.adminPreflightExclusions?.paths ?? [];

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
      adminExcludePaths,
      sourceRevisionId: revision?.id ?? requestMeta?.sourceRevisionId ?? null,
      requirePgvector: input.requirePgvector,
      env: input.env,
      prismaClient: input.prismaClient,
      resolvePack: resolveAdminDraftPack,
    }),
  );

  // On success, retire the open request marker so it leaves the Admin queue.
  if (result.ok) {
    if (revision) {
      await activateWorkerZipSourceRevision({
        revisionId: revision.id,
        versionId: version.id,
        prismaClient: client,
      }).catch(() => undefined);
    }
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

  const acceptedAt = new Date();
  const updated = await client.pipelineRun.updateMany({
    where: { packId: pack.packId, triggerType: WORKER_ZIP_REQUEST_TRIGGER, status: "PENDING" },
    data: {
      status: WORKER_ZIP_REQUEST_ACCEPTED_STATUS,
      triggeredByClientId: input.clientId,
      // Stamp 접수일자 without a schema change (list reads startedAt as acceptedAt).
      startedAt: acceptedAt,
    },
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
          startedAt: acceptedAt,
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
 * P7.5: Admin "자료 반려" — reject a generation request while the pack is still
 * DRAFT. Allowed for 접수 전/후 and after generation completes (or fails), so the
 * Provider can fix the ZIP and re-request. Blocked only while generation is
 * actively running, or if already rejected / no request ZIP exists.
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
  if (status === "REJECTED") {
    throw new WorkerZipImportServiceError(
      "REQUEST_ALREADY_REJECTED",
      "이미 반려된 요청입니다.",
      409,
    );
  }
  if (
    status !== "REQUESTED" &&
    status !== "ACCEPTED" &&
    status !== "COMPLETED" &&
    status !== "FAILED"
  ) {
    throw new WorkerZipImportServiceError(
      "REQUEST_NOT_REJECTABLE",
      "요청됨·접수됨·생성 완료/실패 상태에서만 반려할 수 있습니다.",
      409,
    );
  }

  // Snapshot markers before retiring so Admin can cancel until Provider acknowledges.
  const openMarkers = await client.pipelineRun.findMany({
    where: {
      packId: pack.packId,
      triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS, "PASS"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  const previousMarkerStatus =
    openMarkers[0]?.status === "PASS" ||
    openMarkers[0]?.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS ||
    openMarkers[0]?.status === "PENDING"
      ? (openMarkers[0].status as "PENDING" | "RUNNING" | "PASS")
      : undefined;

  // Record the rejection on the request sidecar (keeps the original ZIP).
  await markRejected({
    packId: pack.packId,
    packVersionId: version.id,
    reason,
    rejectedByUserId: input.adminUserId,
    env: input.env,
    retiredMarkerIds: openMarkers.map((m) => m.id),
    previousMarkerStatus,
  });

  // Retire open or completed request markers so the pack leaves the Admin queue.
  // The pack stays DRAFT; the Provider can re-submit a corrected ZIP.
  try {
    if (openMarkers.length > 0) {
      await client.pipelineRun.updateMany({
        where: { id: { in: openMarkers.map((m) => m.id) } },
        data: { status: "SKIPPED", finishedAt: new Date(), summary: `반려: ${reason.slice(0, 200)}` },
      });
    }
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

export type CancelAdminWorkerZipRejectionInput = {
  adminUserId: string;
  clientId: string;
  packId: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  resolvePack?: WorkerZipPackResolver;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  clearRejection?: typeof clearWorkerZipRequestRejection;
};

/**
 * Admin 반려 취소 — only while the Provider has not yet acknowledged the rejection.
 * Restores retired request markers and clears the sidecar rejection record.
 */
export async function cancelAdminWorkerZipRejection(
  input: CancelAdminWorkerZipRejectionInput,
): Promise<{
  ok: true;
  packId: string;
  versionId: string;
  requestStatus: ProviderWorkerZipRequestStatus;
  message: string;
}> {
  const client = input.prismaClient ?? prisma;
  const resolvePack = input.resolvePack ?? resolveAdminDraftPack;
  const getRequestMetadata = input.getRequestMetadata ?? getWorkerZipRequestMetadata;
  const clearRejection = input.clearRejection ?? clearWorkerZipRequestRejection;

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
  if (!request?.rejection) {
    throw new WorkerZipImportServiceError(
      "REJECTION_NOT_FOUND",
      "취소할 반려 내역이 없습니다.",
      404,
    );
  }
  if (request.rejection.acknowledgedAt) {
    throw new WorkerZipImportServiceError(
      "REJECTION_ALREADY_ACKNOWLEDGED",
      "제공자가 이미 반려 사유를 확인하여 취소할 수 없습니다.",
      409,
    );
  }

  const restoreStatus = request.rejection.previousMarkerStatus ?? "PENDING";
  const retiredIds = request.rejection.retiredMarkerIds ?? [];
  if (retiredIds.length > 0) {
    try {
      await client.pipelineRun.updateMany({
        where: { id: { in: retiredIds }, packId: pack.packId },
        data: {
          status: restoreStatus,
          finishedAt: restoreStatus === "PASS" ? new Date() : null,
          summary:
            restoreStatus === "PASS"
              ? "지식데이터 생성 요청 (반려 취소 복원)"
              : "지식데이터 생성 요청",
        },
      });
    } catch {
      // Non-fatal: clearing rejection still restores Provider/Admin status.
    }
  }

  const restoredMeta = await clearRejection({
    packId: pack.packId,
    packVersionId: version.id,
    env: input.env,
  });
  if (!restoredMeta) {
    throw new WorkerZipImportServiceError(
      "REJECTION_NOT_FOUND",
      "취소할 반려 내역이 없습니다.",
      404,
    );
  }

  const [lastRun, marker] = await Promise.all([
    client.pipelineRun.findFirst({
      where: { packId: pack.packId, triggerType: "WORKER_ZIP_IMPORT" },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true },
    }),
    getLatestOpenRequestMarker(client, pack.packId),
  ]);
  const requestStatus = deriveRequestStatus(restoredMeta, lastRun, marker);

  return {
    ok: true,
    packId: pack.packId,
    versionId: version.id,
    requestStatus,
    message: "반려가 취소되었습니다.",
  };
}

export type AcknowledgeProviderWorkerZipRejectionInput = {
  userId: string;
  clientId: string;
  packId: string;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  resolvePack?: WorkerZipPackResolver;
  findProfile?: (userId: string, clientId: string) => Promise<{ id: string } | null>;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  acknowledgeRejection?: typeof acknowledgeWorkerZipRequestRejection;
};

/**
 * Provider confirms they have read the Admin rejection reason. After this,
 * Admin can no longer cancel the rejection.
 */
export async function acknowledgeProviderWorkerZipRejection(
  input: AcknowledgeProviderWorkerZipRejectionInput,
): Promise<{ ok: true; packId: string; versionId: string; requestStatus: "REJECTED"; message: string }> {
  const client = input.prismaClient ?? prisma;
  const findProfile = input.findProfile ?? findOrEnsureProviderProfileForUser;
  const resolvePack =
    input.resolvePack ?? ((c, i) => requireOwnedDraftPack(c, findProfile, i));
  const getRequestMetadata = input.getRequestMetadata ?? getWorkerZipRequestMetadata;
  const acknowledgeRejection =
    input.acknowledgeRejection ?? acknowledgeWorkerZipRequestRejection;

  const { pack, version } = await resolvePack(client, {
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });

  const request = await getRequestMetadata({
    packId: pack.packId,
    packVersionId: version.id,
    env: input.env,
  });
  if (!request?.rejection) {
    throw new WorkerZipImportServiceError(
      "REJECTION_NOT_FOUND",
      "확인할 반려 내역이 없습니다.",
      404,
    );
  }

  await acknowledgeRejection({
    packId: pack.packId,
    packVersionId: version.id,
    acknowledgedByUserId: input.userId,
    env: input.env,
  });

  return {
    ok: true,
    packId: pack.packId,
    versionId: version.id,
    requestStatus: "REJECTED",
    message: "반려 사유를 확인했습니다.",
  };
}

/* ------------------------------------------------------------------ *
 * P7.3: Admin 접수함 — DRAFT packs with a pending generation request.
 * ------------------------------------------------------------------ */

export type AdminWorkerZipRequestListItem = {
  packId: string;
  packName: string;
  providerName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  versionLabel: string | null;
  requestedAt: string;
  /** ISO timestamp when Admin 접수 completed; null while still 접수 대기. */
  acceptedAt: string | null;
  /**
   * 품질점검(품질점검 리프레시) 결과가 마지막으로 확정된 시각 — ISO.
   * 미실행이면 null.
   */
  qualityCheckedAt: string | null;
  /**
   * 품질점검상태: NOT_CHECKED / IN_PROGRESS / PASS / WARNING / FAIL
   * (ReleaseGateRun 기준 — 없으면 다른 품질 리포트 존재 여부로 IN_PROGRESS 추정)
   */
  qualityStatus: string;
  originalFileName: string | null;
  /** True once an Admin has 접수(accepted) the request (접수완료). */
  accepted: boolean;
  /**
   * Queue phase for Admin UI:
   * - REQUESTED: 접수 대기
   * - ACCEPTED: 접수완료 (생성 실행 가능)
   * - COMPLETED: 생성 완료 (품질 점검 등 후속 작업, 아직 DRAFT)
   */
  phase: "REQUESTED" | "ACCEPTED" | "COMPLETED";
  /** KnowledgePack.status — always DRAFT for this list today. */
  packStatus: string;
  providerReviewPhase: "NONE" | "REQUESTED" | "CONFIRMED" | "WITHDRAWN";
  serviceValidationPhase: "NONE" | "PASSED";
  workflowStatus: string;
  displayStatus: string;
  adminQueueGroup: string;
  ctaLabel: string;
  isWaitingForAdmin: boolean;
};

/**
 * List DRAFT packs with an open or completed ZIP generation request, newest
 * first, deduped by pack. Includes retired (PASS) markers so generation-complete
 * packs remain reachable until they leave DRAFT / enter REVIEWING.
 */
export async function listAdminWorkerZipRequests(input?: {
  prismaClient?: typeof prisma;
  env?: NodeJS.ProcessEnv;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  resolveWorkflowMarkers?: (
    packIds: string[],
  ) => Promise<
    Map<
      string,
      {
        providerReviewPhase: "NONE" | "REQUESTED" | "CONFIRMED" | "WITHDRAWN";
        serviceValidationPhase: "NONE" | "PASSED";
      }
    >
  >;
}): Promise<AdminWorkerZipRequestListItem[]> {
  const client = input?.prismaClient ?? prisma;
  const getRequestMetadata = input?.getRequestMetadata ?? getWorkerZipRequestMetadata;

  const runs = await client.pipelineRun.findMany({
    where: {
      triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS, "PASS"] },
      pack: { status: PackStatus.DRAFT },
    },
    orderBy: { createdAt: "desc" },
    select: {
      packId: true,
      createdAt: true,
      startedAt: true,
      updatedAt: true,
      status: true,
      pack: {
        select: {
          status: true,
          name: true,
          categoryId: true,
          category: { select: { name: true } },
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
  const draftItems: Array<{
    packId: string;
    packName: string;
    providerName: string | null;
    categoryId: string | null;
    categoryName: string | null;
    versionLabel: string | null;
    requestedAt: string;
    acceptedAt: string | null;
    originalFileName: string | null;
    accepted: boolean;
    phase: "REQUESTED" | "ACCEPTED" | "COMPLETED";
    packStatus: string;
  }> = [];
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
    const phase =
      run.status === "PASS"
        ? ("COMPLETED" as const)
        : run.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS
          ? ("ACCEPTED" as const)
          : ("REQUESTED" as const);
    const requestedAt = run.createdAt.toISOString();
    // startedAt is stamped on Admin 접수; fall back to updatedAt for ACCEPTED legacy rows.
    let acceptedAt: string | null = null;
    if (phase !== "REQUESTED") {
      const startedAt = run.startedAt ?? null;
      const updatedAt = run.updatedAt ?? null;
      if (startedAt && startedAt.getTime() > run.createdAt.getTime() + 1_000) {
        acceptedAt = startedAt.toISOString();
      } else if (phase === "ACCEPTED" && updatedAt) {
        acceptedAt = updatedAt.toISOString();
      } else if (startedAt) {
        acceptedAt = startedAt.toISOString();
      } else if (updatedAt) {
        acceptedAt = updatedAt.toISOString();
      }
    }
    draftItems.push({
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      categoryId: run.pack?.categoryId ?? null,
      categoryName: run.pack?.category?.name ?? null,
      versionLabel: version?.version ?? null,
      requestedAt,
      acceptedAt,
      originalFileName,
      accepted: phase === "ACCEPTED" || phase === "COMPLETED",
      phase,
      packStatus: run.pack?.status ?? PackStatus.DRAFT,
    });
  }

  // Recover DRAFT packs whose request markers were retired (SKIPPED/withdrawn)
  // after Admin already ran Worker ZIP import successfully.
  const completedImports = await client.pipelineRun.findMany({
    where: {
      triggerType: "WORKER_ZIP_IMPORT",
      status: "PASS",
      pack: { status: PackStatus.DRAFT },
      ...(seen.size > 0 ? { packId: { notIn: [...seen] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      packId: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      pack: {
        select: {
          status: true,
          name: true,
          categoryId: true,
          category: { select: { name: true } },
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

  const recoveredPackIds: string[] = [];
  for (const run of completedImports) {
    if (seen.has(run.packId)) continue;
    seen.add(run.packId);
    recoveredPackIds.push(run.packId);
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
    draftItems.push({
      packId: run.packId,
      packName: run.pack?.name ?? run.packId,
      providerName: run.pack?.providerProfile?.displayName ?? null,
      categoryId: run.pack?.categoryId ?? null,
      categoryName: run.pack?.category?.name ?? null,
      versionLabel: version?.version ?? null,
      requestedAt: run.createdAt.toISOString(),
      acceptedAt: (run.startedAt ?? run.createdAt).toISOString(),
      originalFileName,
      accepted: true,
      phase: "COMPLETED",
      packStatus: run.pack?.status ?? PackStatus.DRAFT,
    });
  }

  if (recoveredPackIds.length > 0) {
    const legacyRequests = await client.pipelineRun.findMany({
      where: {
        packId: { in: recoveredPackIds },
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      },
      orderBy: { createdAt: "asc" },
      select: {
        packId: true,
        createdAt: true,
        startedAt: true,
        updatedAt: true,
        status: true,
      },
    });
    const byPack = new Map<string, (typeof legacyRequests)[number][]>();
    for (const req of legacyRequests) {
      const list = byPack.get(req.packId) ?? [];
      list.push(req);
      byPack.set(req.packId, list);
    }
    for (const item of draftItems) {
      const reqs = byPack.get(item.packId);
      if (!reqs?.length) continue;
      const first = reqs[0]!;
      item.requestedAt = first.createdAt.toISOString();
      const acceptedReq = [...reqs].reverse().find(
        (r) =>
          r.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS ||
          r.status === "PASS" ||
          r.status === "SKIPPED",
      );
      if (acceptedReq) {
        const stamp =
          acceptedReq.startedAt &&
          acceptedReq.startedAt.getTime() > acceptedReq.createdAt.getTime() + 1_000
            ? acceptedReq.startedAt
            : acceptedReq.updatedAt;
        item.acceptedAt = stamp.toISOString();
      }
    }
  }

  const packIds = draftItems.map((item) => item.packId);
  const [releaseGateRuns, sourceValidationReports, structureCoverageReports, knowledgeQualityReports, chunkQualityReports, retrievalEvaluationRuns] =
    await Promise.all([
      client.releaseGateRun?.findMany?.({
        where: { packId: { in: packIds } },
        orderBy: { checkedAt: "desc" },
        select: { packId: true, checkedAt: true, status: true },
      }) ?? [],
      client.sourceValidationReport?.findMany?.({
        where: { packId: { in: packIds } },
        select: { packId: true, checkedAt: true },
      }) ?? [],
      client.structureCoverageReport?.findMany?.({
        where: { packId: { in: packIds } },
        select: { packId: true, checkedAt: true },
      }) ?? [],
      client.knowledgeQualityReport?.findMany?.({
        where: { packId: { in: packIds } },
        select: { packId: true, checkedAt: true },
      }) ?? [],
      client.chunkQualityReport?.findMany?.({
        where: { packId: { in: packIds } },
        select: { packId: true, checkedAt: true },
      }) ?? [],
      client.retrievalEvaluationRun?.findMany?.({
        where: { packId: { in: packIds } },
        select: { packId: true, checkedAt: true },
      }) ?? [],
    ]);

  const latestReleaseGateByPack = new Map<
    string,
    { checkedAt: Date; status: string }
  >();
  for (const run of releaseGateRuns) {
    if (!latestReleaseGateByPack.has(run.packId)) {
      latestReleaseGateByPack.set(run.packId, {
        checkedAt: run.checkedAt,
        status: run.status,
      });
    }
  }

  // Fallback: when ReleaseGateRun isn't created yet (or run aborted early),
  // still infer an "IN_PROGRESS" quality state from any existing report rows.
  const maxCheckedAtMsByPack = new Map<string, number>();
  for (const id of packIds) maxCheckedAtMsByPack.set(id, 0);
  const updateMax = (rows: readonly { packId: string; checkedAt: Date }[]) => {
    for (const r of rows) {
      const ms = r.checkedAt.getTime();
      const prev = maxCheckedAtMsByPack.get(r.packId) ?? 0;
      if (ms > prev) maxCheckedAtMsByPack.set(r.packId, ms);
    }
  };
  updateMax(sourceValidationReports);
  updateMax(structureCoverageReports);
  updateMax(knowledgeQualityReports);
  updateMax(chunkQualityReports);
  updateMax(retrievalEvaluationRuns);

  const qualityCheckedAtByPack = new Map<string, string | null>();
  const qualityStatusByPack = new Map<string, string>();
  for (const id of packIds) {
    const gate = latestReleaseGateByPack.get(id);
    if (gate) {
      qualityCheckedAtByPack.set(id, gate.checkedAt.toISOString());
      qualityStatusByPack.set(id, gate.status);
      continue;
    }
    const ms = maxCheckedAtMsByPack.get(id) ?? 0;
    if (ms > 0) {
      qualityCheckedAtByPack.set(id, new Date(ms).toISOString());
      qualityStatusByPack.set(id, "IN_PROGRESS");
    } else {
      qualityCheckedAtByPack.set(id, null);
      qualityStatusByPack.set(id, "NOT_CHECKED");
    }
  }
  const markersByPack = input?.resolveWorkflowMarkers
    ? await input.resolveWorkflowMarkers(packIds)
    : input?.prismaClient
      ? new Map()
      : await batchResolveStoreWorkflowMarkers(packIds, client);

  return draftItems.map((item) => {
    const markers = markersByPack.get(item.packId);
    const providerReviewPhase = markers?.providerReviewPhase ?? "NONE";
    const serviceValidationPhase = markers?.serviceValidationPhase ?? "NONE";
    const view = buildAdminWorkInboxItemViewModel({
      packId: item.packId,
      packName: item.packName,
      packStatus: item.packStatus,
      sourceKind: "WORKER_ZIP",
      workerZipPhase: item.phase,
      providerReviewPhase,
      providerSupplementPhase: markers?.providerSupplementPhase ?? "NONE",
      serviceValidationPhase,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      providerName: item.providerName,
      versionLabel: item.versionLabel,
      requestedAt: item.requestedAt,
      acceptedAt: item.acceptedAt,
    });
    return {
      ...item,
      providerReviewPhase: view.providerReviewPhase,
      serviceValidationPhase: view.serviceValidationPhase,
      workflowStatus: view.workflowStatus,
      displayStatus: view.displayStatus,
      adminQueueGroup: view.adminQueueGroup,
      ctaLabel: view.ctaLabel,
      isWaitingForAdmin: view.isWaitingForAdmin,
      qualityCheckedAt: qualityCheckedAtByPack.get(item.packId) ?? null,
      qualityStatus: qualityStatusByPack.get(item.packId) ?? "NOT_CHECKED",
    };
  });
}
