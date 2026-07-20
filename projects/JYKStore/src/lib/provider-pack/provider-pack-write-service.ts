import { AuditAction, PackPricing, PackStatus, ProviderType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateUniquePackId } from "@/lib/pack-id-generator";
import {
  parsePackLanguage,
  toPrismaPackLanguage,
} from "@/lib/pack-language";
import {
  deriveShortDescription,
  PROVIDER_PACK_INITIAL_VERSION_CHANGELOG,
} from "@/lib/pack-summary-generator";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { toProviderPackDetail } from "@/lib/provider-pack-dto";
import type {
  CreateProviderPackInput,
  UpdateProviderPackInput,
} from "@/lib/provider-pack/provider-pack-types";
import {
  assertCategoryExists,
  packDetailInclude,
  validateCreatePackInput,
} from "@/lib/provider-pack/provider-pack-shared";
import { getProviderPackForClient } from "@/lib/provider-pack/provider-pack-query-service";

export async function createProviderPackForClient(
  userId: string,
  clientId: string,
  input: CreateProviderPackInput,
) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const name = input.name.trim();
  const categoryId = input.categoryId.trim();
  const description = input.description.trim();

  const category = await prisma.packCategory.findUnique({
    where: { categoryId },
  });
  if (!category) {
    return { error: "CATEGORY_NOT_FOUND" as const };
  }

  const explicitPackId = input.packId?.trim();
  let packId = explicitPackId || (await generateUniquePackId(name));
  const shortDescription =
    input.shortDescription?.trim() ||
    deriveShortDescription({
      name,
      description,
      fallbackCategoryName: category.name,
    });

  const validationMessage = validateCreatePackInput({
    packId,
    name,
    categoryId,
    shortDescription,
    description,
    tags: input.tags,
    version: input.version,
  });
  if (validationMessage) {
    return { error: "VALIDATION" as const, message: validationMessage };
  }

  let existing = await prisma.knowledgePack.findUnique({ where: { packId } });
  if (existing) {
    if (explicitPackId) {
      return { error: "PACK_ID_EXISTS" as const };
    }
    packId = await generateUniquePackId(name);
    existing = await prisma.knowledgePack.findUnique({ where: { packId } });
    if (existing) {
      return { error: "PACK_ID_EXISTS" as const };
    }
  }
  const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const versionLabel = (input.version?.trim() || "0.1.0").trim();

  const pack = await prisma.knowledgePack.create({
    data: {
      packId,
      name,
      categoryId,
      providerName: profile.displayName,
      providerType: ProviderType.COMMUNITY,
      providerProfileId: profile.id,
      status: PackStatus.DRAFT,
      pricing: PackPricing.FREE,
      icon: "📦",
      shortDescription,
      description,
      tags,
      versions: {
        create: {
          version: versionLabel,
          overview: PROVIDER_PACK_INITIAL_VERSION_CHANGELOG,
          features: [],
          includedKnowledge: [],
          supportedEnvironments: [],
          targetUsers: [],
          useCases: [],
          versionSummary: `초안 ${versionLabel}`,
        },
      },
    },
    include: packDetailInclude,
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_CREATE,
    entityType: "KnowledgePack",
    entityId: pack.packId,
    metadata: { providerProfileId: profile.id },
  });

  return { pack: toProviderPackDetail(pack) };
}

export async function updateProviderPackForClient(
  userId: string,
  clientId: string,
  packId: string,
  input: UpdateProviderPackInput,
) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_EDITABLE" as const };
  }

  let parsedLanguage: "ko" | "en" | null | undefined = undefined;
  if (Object.prototype.hasOwnProperty.call(input, "language")) {
    const parsed = parsePackLanguage(input.language);
    if (!parsed.ok) {
      return { error: "PACK_LANGUAGE_INVALID" as const };
    }
    parsedLanguage = parsed.value;
  }

  if (input.categoryId) {
    if (!(await assertCategoryExists(input.categoryId.trim()))) {
      return { error: "CATEGORY_NOT_FOUND" as const };
    }
  }

  const data: {
    name?: string;
    categoryId?: string;
    shortDescription?: string;
    description?: string;
    tags?: string[];
    icon?: string;
    pricing?: PackPricing;
  } = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.categoryId !== undefined) data.categoryId = input.categoryId.trim();
  if (input.shortDescription !== undefined) data.shortDescription = input.shortDescription.trim();
  if (input.description !== undefined) data.description = input.description.trim();
  if (input.tags !== undefined) data.tags = input.tags.map((t) => t.trim()).filter(Boolean);
  if (input.icon !== undefined) data.icon = input.icon.trim() || "📦";
  if (input.pricing !== undefined) data.pricing = input.pricing;

  await prisma.knowledgePack.update({
    where: { packId },
    data,
  });

  const latestVersion = pack.versions[0];
  if (latestVersion) {
    const versionData: {
      overview?: string;
      features?: string[];
      includedKnowledge?: string[];
      supportedEnvironments?: string[];
      targetUsers?: string[];
      useCases?: string[];
      versionSummary?: string;
      language?: "KO" | "EN" | null;
    } = {};

    if (input.versionOverview !== undefined) versionData.overview = input.versionOverview.trim();
    if (input.versionFeatures !== undefined) versionData.features = input.versionFeatures;
    if (input.versionIncludedKnowledge !== undefined) {
      versionData.includedKnowledge = input.versionIncludedKnowledge;
    }
    if (input.versionSupportedEnvironments !== undefined) {
      versionData.supportedEnvironments = input.versionSupportedEnvironments;
    }
    if (input.versionTargetUsers !== undefined) versionData.targetUsers = input.versionTargetUsers;
    if (input.versionUseCases !== undefined) versionData.useCases = input.versionUseCases;
    if (input.versionSummary !== undefined) versionData.versionSummary = input.versionSummary.trim();
    if (parsedLanguage !== undefined) {
      versionData.language = toPrismaPackLanguage(parsedLanguage);
    }

    if (Object.keys(versionData).length > 0) {
      await prisma.knowledgePackVersion.update({
        where: { id: latestVersion.id },
        data: versionData,
      });
    }

  }

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: packId,
  });

  const updated = await getProviderPackForClient(userId, clientId, packId);
  return { pack: updated! };
}
