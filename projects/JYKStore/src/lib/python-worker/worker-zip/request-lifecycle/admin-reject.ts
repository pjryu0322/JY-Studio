import { prisma } from "@/lib/prisma";
import {
  getWorkerZipRequestMetadata,
  markWorkerZipRequestRejected,
} from "@/lib/python-worker/worker-zip-request-storage";
import { getLatestOpenRequestMarker } from "../admin-hold";
import { WORKER_ZIP_REQUEST_ACCEPTED_STATUS, WORKER_ZIP_REQUEST_TRIGGER } from "../constants";
import { WorkerZipImportServiceError } from "../errors";
import { resolveAdminDraftPack } from "../pack-resolvers";
import { deriveRequestStatus } from "./request-status-policy";
import type { RejectAdminWorkerZipRequestInput } from "./types";

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
