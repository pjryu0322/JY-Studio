import { AuditAction, PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import type { CreatePackVersionInput } from "@/lib/provider-pack/provider-pack-types";
import { getProviderPackForClient } from "@/lib/provider-pack/provider-pack-query-service";

export async function createProviderPackVersionForClient(
  userId: string,
  clientId: string,
  packId: string,
  input: CreatePackVersionInput,
) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
    include: {
      versions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
    },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_EDITABLE" as const };
  }

  const version = input.version.trim();
  if (!version) {
    return { error: "VALIDATION" as const, message: "버전이 필요합니다." };
  }

  const duplicate = await prisma.knowledgePackVersion.findUnique({
    where: { packId_version: { packId, version } },
  });

  if (duplicate) {
    return { error: "VERSION_EXISTS" as const };
  }

  const latest = pack.versions[0];
  await prisma.knowledgePackVersion.create({
    data: {
      packId,
      version,
      overview: input.overview?.trim() || latest?.overview || pack.shortDescription,
      features: input.features ?? latest?.features ?? [],
      includedKnowledge: input.includedKnowledge ?? latest?.includedKnowledge ?? [],
      supportedEnvironments:
        input.supportedEnvironments ?? latest?.supportedEnvironments ?? [],
      targetUsers: input.targetUsers ?? latest?.targetUsers ?? [],
      useCases: input.useCases ?? latest?.useCases ?? [],
      versionSummary: input.versionSummary?.trim() || latest?.versionSummary || version,
      language: latest?.language ?? null,
    },
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_VERSION_CREATE,
    entityType: "KnowledgePack",
    entityId: packId,
    metadata: { version },
  });

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail! };
}
