import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import type { WorkerZipRequestMetadata } from "@/lib/python-worker/worker-zip-request-storage";
import { resolveProviderAdminGenerationHold } from "../admin-hold";
import { WORKER_ZIP_REQUEST_TRIGGER } from "../constants";
import { WorkerZipImportServiceError } from "../errors";
import { requireOwnedDraftPack } from "../pack-resolvers";
import type { SubmitProviderWorkerZipRequestInput } from "./types";

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
