import { prisma } from "@/lib/prisma";
import { getWorkerZipRequestMetadata } from "@/lib/python-worker/worker-zip-request-storage";
import { WORKER_ZIP_REQUEST_ACCEPTED_STATUS, WORKER_ZIP_REQUEST_TRIGGER } from "../constants";
import { WorkerZipImportServiceError } from "../errors";
import { resolveAdminDraftPack } from "../pack-resolvers";
import type {
  AcceptAdminWorkerZipRequestInput,
  ProviderWorkerZipRequestStatus,
} from "./types";

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
