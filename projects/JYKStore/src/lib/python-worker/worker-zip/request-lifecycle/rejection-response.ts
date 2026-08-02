import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import {
  acknowledgeWorkerZipRequestRejection,
  clearWorkerZipRequestRejection,
  getWorkerZipRequestMetadata,
} from "@/lib/python-worker/worker-zip-request-storage";
import { getLatestOpenRequestMarker } from "../admin-hold";
import { WorkerZipImportServiceError } from "../errors";
import { requireOwnedDraftPack, resolveAdminDraftPack } from "../pack-resolvers";
import { deriveRequestStatus } from "./request-status-policy";
import type {
  AcknowledgeProviderWorkerZipRejectionInput,
  CancelAdminWorkerZipRejectionInput,
  ProviderWorkerZipRequestStatus,
} from "./types";

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
