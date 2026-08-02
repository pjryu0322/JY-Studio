import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { getWorkerZipRequestMetadata } from "@/lib/python-worker/worker-zip-request-storage";
import { getLatestOpenRequestMarker } from "../admin-hold";
import { requireOwnedDraftPack } from "../pack-resolvers";
import { deriveRequestStatus } from "./request-status-policy";
import type {
  GetProviderWorkerZipRequestStateInput,
  ProviderWorkerZipRequestState,
} from "./types";

/**
 * Read the current request state for the Provider/Admin screens (no execution).
 * Status is approximated from the stored request + latest WORKER_ZIP PipelineRun.
 */
export async function getProviderWorkerZipRequestState(
  input: GetProviderWorkerZipRequestStateInput,
): Promise<ProviderWorkerZipRequestState> {
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
