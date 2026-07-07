import type {
  KnowledgePack as DbKnowledgePack,
  KnowledgePackVersion,
  PackCategory,
  PackStatus,
  ProviderType,
} from "@prisma/client";
import type {
  KnowledgePack,
  KnowledgePackProviderInfo,
  KnowledgePackStatus,
  KnowledgePackVersionEntry,
} from "@/types/pack";

export type PrismaKnowledgePackWithVersion = DbKnowledgePack & {
  category: PackCategory;
  versions: KnowledgePackVersion[];
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toUiPackStatus(status: PackStatus): KnowledgePackStatus {
  if (status === "VERIFIED") {
    return "PUBLISHED";
  }
  return status as KnowledgePackStatus;
}

function toProviderInfo(pack: DbKnowledgePack): KnowledgePackProviderInfo {
  const type = pack.providerType as KnowledgePackProviderInfo["type"];
  let description = "지식팩 제공자 정보";
  switch (pack.providerType as ProviderType) {
    case "JYK_VERIFIED":
      description = "JYKStore에서 검토한 검증 지식팩입니다.";
      break;
    case "OFFICIAL":
      description = "공식 제공 지식팩입니다.";
      break;
    case "COMMUNITY":
      description = "커뮤니티 제공 지식팩입니다.";
      break;
  }
  return {
    name: pack.providerName,
    type,
    description,
  };
}

function pickLatestVersion(versions: KnowledgePackVersion[]): KnowledgePackVersion | undefined {
  if (!versions.length) return undefined;
  return [...versions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

function toVersionHistory(versions: KnowledgePackVersion[]): KnowledgePackVersionEntry[] {
  return [...versions]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((v) => ({
      version: v.version,
      date: formatDate(v.createdAt),
      summary: v.versionSummary,
    }));
}

export function toKnowledgePackDto(pack: PrismaKnowledgePackWithVersion): KnowledgePack {
  const latest = pickLatestVersion(pack.versions);

  return {
    packId: pack.packId,
    name: pack.name,
    category: pack.category.name,
    categoryId: pack.categoryId,
    provider: pack.providerName,
    status: toUiPackStatus(pack.status),
    version: latest?.version ?? "0.0.0",
    description: pack.description,
    shortDescription: pack.shortDescription,
    tags: [...pack.tags],
    icon: pack.icon,
    rating: pack.rating,
    usageCount: pack.usageCount,
    isVerified: pack.isVerified,
    updatedAt: formatDate(pack.updatedAt),
    pricing: pack.pricing,
    overview: latest?.overview ?? pack.shortDescription,
    features: latest ? [...latest.features] : [],
    includedKnowledge: latest ? [...latest.includedKnowledge] : [],
    supportedEnvironments: latest ? [...latest.supportedEnvironments] : [],
    targetUsers: latest ? [...latest.targetUsers] : [],
    useCases: latest ? [...latest.useCases] : [],
    versionHistory: toVersionHistory(pack.versions),
    providerInfo: toProviderInfo(pack),
  };
}
