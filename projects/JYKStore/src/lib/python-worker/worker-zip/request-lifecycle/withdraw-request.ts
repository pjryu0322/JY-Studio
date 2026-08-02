import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import {
  deleteWorkerZipRequest,
  getWorkerZipRequestMetadata,
} from "@/lib/python-worker/worker-zip-request-storage";
import { getLatestOpenRequestMarker } from "../admin-hold";
import { WORKER_ZIP_REQUEST_TRIGGER } from "../constants";
import { WorkerZipImportServiceError } from "../errors";
import { requireOwnedDraftPack } from "../pack-resolvers";
import { deriveRequestStatus } from "./request-status-policy";
import type { WithdrawProviderWorkerZipRequestInput } from "./types";

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
