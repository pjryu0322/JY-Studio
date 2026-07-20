/**
 * Query helpers shared by service-validation read/run/evidence/admin modules.
 */
import {
  PackStatus,
  type Prisma,
  ServiceValidationChannel,
  type ServiceValidationRun,
} from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import { DOCLING_RETRIEVAL_CHUNK_TYPE } from "@/lib/docling-knowledge/docling-knowledge-stages";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { prisma } from "@/lib/prisma";
import {
  resolveValidationBindingState,
  type CurrentValidationBinding,
} from "@/lib/distribution/service-validation-binding";
import { OPEN_PACK_REVIEW_STATUSES } from "@/lib/pack-review-status";

/** DB-only: API/MCP peer result fingerprints for a shared confirmation group. */
export async function loadSharedConfirmationPeerFingerprints(
  client: Prisma.TransactionClient | typeof prisma,
  sharedConfirmationGroupId: string,
): Promise<{ apiResultFingerprint: string | null; mcpResultFingerprint: string | null }> {
  const peers = await client.serviceValidationProviderConfirmation.findMany({
    where: { sharedConfirmationGroupId },
    include: { run: { select: { channel: true, resultFingerprint: true } } },
  });
  const apiPeer = peers.find((p) => p.run.channel === "API")?.run;
  const mcpPeer = peers.find((p) => p.run.channel === "MCP")?.run;
  return {
    apiResultFingerprint: apiPeer?.resultFingerprint ?? null,
    mcpResultFingerprint: mcpPeer?.resultFingerprint ?? null,
  };
}

export async function assertNoOpenPackReview(
  client: Prisma.TransactionClient | typeof prisma,
  packId: string,
): Promise<void> {
  const openReview = await client.packReview.findFirst({
    where: {
      packId,
      status: { in: [...OPEN_PACK_REVIEW_STATUSES] },
    },
    select: { id: true },
  });
  if (openReview) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_NOT_EDITABLE",
      "검수요청이 진행 중입니다. 검색검증을 변경하려면 검수요청을 회수해 주세요.",
      409,
    );
  }
}

async function loadOwnedPack(input: {
  userId: string;
  clientId: string;
  packId: string;
}) {
  const profile = await findOrEnsureProviderProfileForUser(input.userId, input.clientId);
  if (!profile) {
    throw new PayloadServiceError("PROFILE_REQUIRED", "제공자 프로필이 필요합니다.", 403);
  }
  const pack = await prisma.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    include: {
      versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 },
    },
  });
  if (!pack) throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  const version = pack.versions[0];
  if (!version) throw new PayloadServiceError("INCOMPLETE", "버전이 없습니다.", 400);
  return { pack, version, profile };
}

export async function loadOwnedPackForServiceValidationRead(input: {
  userId: string;
  clientId: string;
  packId: string;
}) {
  return loadOwnedPack(input);
}

export async function requireOwnedDraftPackForServiceValidationRun(input: {
  userId: string;
  clientId: string;
  packId: string;
}) {
  const owned = await loadOwnedPack(input);
  if (owned.pack.status !== PackStatus.DRAFT) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_NOT_EDITABLE",
      "검수요청 전 초안 상태에서만 서비스 검증을 실행할 수 있습니다.",
      403,
    );
  }
  return owned;
}

export async function loadBindingContext(
  packId: string,
  versionId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const dist = await client.packDistributionMetadata.findUnique({ where: { versionId } });
  const bindingState = await resolveValidationBindingState(client, { packId, versionId });
  if (bindingState.status !== "CURRENT") {
    return {
      dist,
      latest: bindingState.latest
        ? await client.pipelineRun.findUnique({ where: { id: bindingState.latest.id } })
        : null,
      binding: null as CurrentValidationBinding | null,
      bindingState,
    };
  }
  const latest = await client.pipelineRun.findUnique({
    where: { id: bindingState.binding.pipelineRunId },
  });
  return {
    dist,
    latest,
    binding: bindingState.binding,
    bindingState,
  };
}

export async function findLatestServiceValidationRun(input: {
  versionId: string;
  channel: ServiceChannel;
}): Promise<ServiceValidationRun | null> {
  return prisma.serviceValidationRun.findFirst({
    where: {
      versionId: input.versionId,
      channel: input.channel as ServiceValidationChannel,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function loadSuggestedQueries(input: {
  versionId: string;
  indexGenerationId?: string | null;
}): Promise<string[]> {
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
      isActive: true,
      ...(input.indexGenerationId
        ? { metadata: { path: ["indexGenerationId"], equals: input.indexGenerationId } }
        : {}),
    },
    orderBy: { sortOrder: "asc" },
    take: 12,
    select: { title: true },
  });
  const titles = chunks
    .map((c) => c.title?.trim())
    .filter((t): t is string => Boolean(t && t.length >= 2));
  return [...new Set(titles)].slice(0, 5);
}
