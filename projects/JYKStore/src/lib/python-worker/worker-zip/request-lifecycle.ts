/* ------------------------------------------------------------------ *
 * P7.3: Provider "생성 요청" (store-only — the Provider never runs the Worker)
 * and the Admin 접수/반려/취소 lifecycle around it.
 * ------------------------------------------------------------------ */
import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import {
  acknowledgeWorkerZipRequestRejection,
  clearWorkerZipRequestRejection,
  deleteWorkerZipRequest,
  getWorkerZipRequestMetadata,
  markWorkerZipRequestRejected,
  storeWorkerZipRequest,
  type WorkerZipRequestMetadata,
} from "@/lib/python-worker/worker-zip-request-storage";
import { getLatestOpenRequestMarker, resolveProviderAdminGenerationHold } from "./admin-hold";
import { WORKER_ZIP_REQUEST_ACCEPTED_STATUS, WORKER_ZIP_REQUEST_TRIGGER } from "./constants";
import { WorkerZipImportServiceError } from "./errors";
import {
  requireOwnedDraftPack,
  resolveAdminDraftPack,
  type WorkerZipPackResolver,
} from "./pack-resolvers";

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
  // the Admin queue can surface this DRAFT pack. Marker persistence is required
  // for authoritative versionId + sourceRevisionId binding (P1.1).
  if (!stored.sourceRevisionId) {
    throw new WorkerZipImportServiceError(
      "REQUEST_SOURCE_REVISION_MISSING",
      "원본 revision이 없어 생성 요청을 기록할 수 없습니다.",
      500,
    );
  }
  await client.pipelineRun.updateMany({
    where: { packId: pack.packId, triggerType: WORKER_ZIP_REQUEST_TRIGGER, status: "PENDING" },
    data: { status: "SKIPPED", finishedAt: new Date() },
  });
  await client.pipelineRun.create({
    data: {
      packId: pack.packId,
      versionId: version.id,
      sourceRevisionId: stored.sourceRevisionId,
      triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      triggeredByClientId: input.clientId,
      status: "PENDING",
      summary: `지식데이터 생성 요청: ${stored.originalFileName}`,
    },
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

/* ------------------------------------------------------------------ *
 * Admin 접수/반려/취소.
 * ------------------------------------------------------------------ */

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

  try {
    const { ensureInventoryAfterAccept } = await import("@/lib/knowledge-scope/inventory-create-service");
    await ensureInventoryAfterAccept({
      packId: pack.packId,
      versionId: version.id,
      clientId: input.clientId,
      adminUserId: input.adminUserId,
      env: input.env,
      prismaClient: client,
    });
  } catch {
    // Accept must succeed even when inventory bootstrap is best-effort.
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
