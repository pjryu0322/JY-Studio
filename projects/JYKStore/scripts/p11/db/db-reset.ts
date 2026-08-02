import { createHash } from "node:crypto";
import { mockCategories } from "../../../src/data/mock-categories.ts";
import {
  KEEP_EMAILS,
  P11_CANONICAL_ACCOUNTS,
} from "../policy/reset-allowlist.ts";
import { prisma } from "./client.ts";

export async function seedCategories(): Promise<void> {
  for (const category of mockCategories) {
    await prisma.packCategory.upsert({
      where: { categoryId: category.categoryId },
      create: {
        categoryId: category.categoryId,
        name: category.name,
        description: category.description,
        icon: category.icon,
        parentCategoryId: category.parentCategoryId ?? null,
        sortOrder: category.sortOrder ?? 0,
      },
      update: {
        name: category.name,
        description: category.description,
        icon: category.icon,
        parentCategoryId: category.parentCategoryId ?? null,
        sortOrder: category.sortOrder ?? 0,
      },
    });
  }
}

export async function seedCanonicalAccounts(): Promise<{
  users: Array<{ email: string; role: string; id: string }>;
  providerProfileId: string;
}> {
  const out: Array<{ email: string; role: string; id: string }> = [];
  let providerUserId = "";

  for (const account of P11_CANONICAL_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      create: {
        email: account.email,
        name: account.name,
        accountRole: account.accountRole,
      },
      update: {
        name: account.name,
        accountRole: account.accountRole,
      },
    });
    out.push({ email: account.email, role: account.accountRole, id: user.id });
    if (account.accountRole === "PROVIDER") providerUserId = user.id;
  }

  // Ensure ADMIN emails env includes canonical admin (runtime also checks env).
  // ProviderProfile: keep exactly one for provider.
  const existingProfiles = await prisma.providerProfile.findMany({
    where: { userId: providerUserId },
  });
  let providerProfileId = existingProfiles[0]?.id;
  if (!providerProfileId) {
    const created = await prisma.providerProfile.create({
      data: {
        userId: providerUserId,
        displayName: "JYKStore Provider",
        description: "Canonical P11 provider profile",
        contactEmail: "provider@jyk.local",
        status: "ACTIVE",
        clientId: `p11-provider-${createHash("sha256").update(providerUserId).digest("hex").slice(0, 12)}`,
      },
    });
    providerProfileId = created.id;
  } else if (existingProfiles.length > 1) {
    await prisma.providerProfile.deleteMany({
      where: {
        userId: providerUserId,
        id: { not: providerProfileId },
      },
    });
  }

  // Remove other provider profiles not tied to canonical provider (packs already gone).
  await prisma.providerProfile.deleteMany({
    where: {
      OR: [{ userId: null }, { userId: { not: providerUserId } }],
    },
  });

  return { users: out, providerProfileId };
}

/**
 * Truncate pack/derived tables with CASCADE. Keeps categories, structure
 * templates, and (separately handled) User / ProviderProfile.
 */
export async function deleteAllPackRelated(): Promise<{
  packIds: string[];
  deletedPacks: number;
}> {
  const packs = await prisma.knowledgePack.findMany({ select: { packId: true } });
  const packIds = packs.map((p) => p.packId);

  // Order: deep children / Restrict edges first, then packs.
  const truncateTables = [
    "ServiceValidationDownloadTest",
    "ServiceValidationProviderConfirmation",
    "ServiceValidationResultItem",
    "ServiceValidationRun",
    "CorrectionAuditEvent",
    "CorrectionCase",
    "RetrievalEvaluationIssue",
    "RetrievalEvaluationResult",
    "RetrievalEvaluationRun",
    "RetrievalEvaluationCase",
    "RetrievalEvaluationSet",
    "ReleaseGateIssue",
    "ReleaseGateRun",
    "ChunkQualityChunkMetric",
    "ChunkQualityIssue",
    "ChunkQualityReport",
    "KnowledgeQualityIssue",
    "KnowledgeQualityReport",
    "StructureCoverageItem",
    "StructureCoverageReport",
    "SourceValidationIssue",
    "SourceValidationReport",
    "SearchIndexVector",
    "KnowledgeChunkEmbedding",
    "KnowledgeChunk",
    "KnowledgeGraphEdge",
    "KnowledgeGraphNode",
    "PipelineStepLog",
    "PipelineRun",
    "KnowledgeScopeDecisionEvent",
    "KnowledgeScopeInventoryItem",
    "KnowledgeScopeInventory",
    "WorkerZipWorkingCopy",
    "WorkerZipSourceRevision",
    "PackInstallation",
    "PackReview",
    "ObjectStorageCleanupJob",
    "ApiUsageLog",
    "AuditLog",
    "DoclingProcessingLog",
    "DoclingProcessingJob",
    "DoclingUploadFile",
    "DoclingUploadSession",
    "SearchIndexGeneration",
    "NormalizedDocument",
    "KnowledgePackFile",
    "DoclingImportBundle",
    "PackDistributionMetadata",
    "SourceDocument",
    "KnowledgePackVersion",
    "KnowledgePack",
  ];

  for (const table of truncateTables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
  }

  return { packIds, deletedPacks: packIds.length };
}

export async function deleteNonCanonicalAccounts(): Promise<{
  deletedUsers: number;
}> {
  const keep = await prisma.user.findMany({
    where: { email: { in: [...KEEP_EMAILS] } },
    select: { id: true },
  });
  const keepIds = keep.map((u) => u.id);

  // Delete api keys for everyone first
  await prisma.apiKey.deleteMany({
    where: keepIds.length ? { userId: { notIn: keepIds } } : undefined,
  });
  // Keep canonical users' keys wiped too (clean slate)
  await prisma.apiKey.deleteMany({});

  await prisma.organizationMember.deleteMany({});
  await prisma.organization.deleteMany({});

  const deleted = await prisma.user.deleteMany({
    where: keepIds.length ? { id: { notIn: keepIds } } : undefined,
  });

  // If canonical users don't exist yet, delete all remaining
  if (keepIds.length === 0) {
    await prisma.providerProfile.deleteMany({});
    await prisma.user.deleteMany({});
  }

  return { deletedUsers: deleted.count };
}
