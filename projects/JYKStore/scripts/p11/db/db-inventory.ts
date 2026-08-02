import { KEEP_EMAILS } from "../policy/reset-allowlist.ts";
import type { DbInventoryResult, TableCount } from "../types.ts";
import { prisma } from "./client.ts";

async function countModel(
  label: string,
  tableHint: string,
  packRelated: boolean,
  action: TableCount["action"],
  fn: () => Promise<number>,
): Promise<TableCount> {
  try {
    const count = await fn();
    return { model: label, table: tableHint, count, packRelated, action };
  } catch {
    return {
      model: label,
      table: tableHint,
      count: -1,
      packRelated,
      action: "unknown",
    };
  }
}

export async function dbInventory(): Promise<DbInventoryResult> {
  const tables: TableCount[] = [];
  const push = async (
    label: string,
    table: string,
    packRelated: boolean,
    action: TableCount["action"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delegate: { count: (args?: any) => Promise<number> },
  ) => {
    tables.push(
      await countModel(label, table, packRelated, action, () => delegate.count()),
    );
  };

  await push("User", "User", false, "delete", prisma.user);
  await push("ProviderProfile", "ProviderProfile", false, "delete", prisma.providerProfile);
  await push("Organization", "Organization", false, "delete", prisma.organization);
  await push("OrganizationMember", "OrganizationMember", false, "delete", prisma.organizationMember);
  await push("ApiKey", "ApiKey", false, "delete", prisma.apiKey);
  await push("ApiUsageLog", "ApiUsageLog", false, "delete", prisma.apiUsageLog);
  await push("AuditLog", "AuditLog", false, "delete", prisma.auditLog);
  await push("PackCategory", "PackCategory", false, "keep", prisma.packCategory);
  await push("KnowledgeStructureTemplate", "KnowledgeStructureTemplate", false, "keep", prisma.knowledgeStructureTemplate);
  await push("KnowledgeStructureSection", "KnowledgeStructureSection", false, "keep", prisma.knowledgeStructureSection);

  await push("KnowledgePack", "KnowledgePack", true, "delete", prisma.knowledgePack);
  await push("KnowledgePackVersion", "KnowledgePackVersion", true, "delete", prisma.knowledgePackVersion);
  await push("PackReview", "PackReview", true, "delete", prisma.packReview);
  await push("PackDistributionMetadata", "PackDistributionMetadata", true, "delete", prisma.packDistributionMetadata);
  await push("PackInstallation", "PackInstallation", true, "delete", prisma.packInstallation);
  await push("WorkerZipSourceRevision", "WorkerZipSourceRevision", true, "delete", prisma.workerZipSourceRevision);
  await push("WorkerZipWorkingCopy", "WorkerZipWorkingCopy", true, "delete", prisma.workerZipWorkingCopy);
  await push("KnowledgeScopeInventory", "KnowledgeScopeInventory", true, "delete", prisma.knowledgeScopeInventory);
  await push("KnowledgeScopeInventoryItem", "KnowledgeScopeInventoryItem", true, "delete", prisma.knowledgeScopeInventoryItem);
  await push("KnowledgeScopeDecisionEvent", "KnowledgeScopeDecisionEvent", true, "delete", prisma.knowledgeScopeDecisionEvent);
  await push("PipelineRun", "PipelineRun", true, "delete", prisma.pipelineRun);
  await push("PipelineStepLog", "PipelineStepLog", true, "delete", prisma.pipelineStepLog);
  await push("NormalizedDocument", "NormalizedDocument", true, "delete", prisma.normalizedDocument);
  await push("SourceDocument", "SourceDocument", true, "delete", prisma.sourceDocument);
  await push("KnowledgePackFile", "KnowledgePackFile", true, "delete", prisma.knowledgePackFile);
  await push("KnowledgeChunk", "KnowledgeChunk", true, "delete", prisma.knowledgeChunk);
  await push("KnowledgeChunkEmbedding", "KnowledgeChunkEmbedding", true, "delete", prisma.knowledgeChunkEmbedding);
  await push("SearchIndexVector", "SearchIndexVector", true, "delete", prisma.searchIndexVector);
  await push("SearchIndexGeneration", "SearchIndexGeneration", true, "delete", prisma.searchIndexGeneration);
  await push("KnowledgeGraphNode", "KnowledgeGraphNode", true, "delete", prisma.knowledgeGraphNode);
  await push("KnowledgeGraphEdge", "KnowledgeGraphEdge", true, "delete", prisma.knowledgeGraphEdge);
  await push("CorrectionCase", "CorrectionCase", true, "delete", prisma.correctionCase);
  await push("CorrectionAuditEvent", "CorrectionAuditEvent", true, "delete", prisma.correctionAuditEvent);
  await push("ServiceValidationRun", "ServiceValidationRun", true, "delete", prisma.serviceValidationRun);
  await push("ServiceValidationResultItem", "ServiceValidationResultItem", true, "delete", prisma.serviceValidationResultItem);
  await push("ServiceValidationProviderConfirmation", "ServiceValidationProviderConfirmation", true, "delete", prisma.serviceValidationProviderConfirmation);
  await push("ServiceValidationDownloadTest", "ServiceValidationDownloadTest", true, "delete", prisma.serviceValidationDownloadTest);
  await push("StructureCoverageReport", "StructureCoverageReport", true, "delete", prisma.structureCoverageReport);
  await push("ChunkQualityReport", "ChunkQualityReport", true, "delete", prisma.chunkQualityReport);
  await push("KnowledgeQualityReport", "KnowledgeQualityReport", true, "delete", prisma.knowledgeQualityReport);
  await push("ReleaseGateRun", "ReleaseGateRun", true, "delete", prisma.releaseGateRun);
  await push("RetrievalEvaluationSet", "RetrievalEvaluationSet", true, "delete", prisma.retrievalEvaluationSet);
  await push("RetrievalEvaluationRun", "RetrievalEvaluationRun", true, "delete", prisma.retrievalEvaluationRun);
  await push("DoclingImportBundle", "DoclingImportBundle", true, "delete", prisma.doclingImportBundle);
  await push("DoclingUploadSession", "DoclingUploadSession", true, "delete", prisma.doclingUploadSession);
  await push("DoclingUploadFile", "DoclingUploadFile", true, "delete", prisma.doclingUploadFile);
  await push("DoclingProcessingJob", "DoclingProcessingJob", true, "delete", prisma.doclingProcessingJob);
  await push("DoclingProcessingLog", "DoclingProcessingLog", true, "delete", prisma.doclingProcessingLog);
  await push("ObjectStorageCleanupJob", "ObjectStorageCleanupJob", false, "delete", prisma.objectStorageCleanupJob);
  await push("SourceValidationReport", "SourceValidationReport", true, "delete", prisma.sourceValidationReport);

  const usersRaw = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      accountRole: true,
      name: true,
      providerProfiles: { select: { id: true } },
      apiKeys: { select: { id: true } },
    },
  });

  const packOwners = await prisma.knowledgePack.findMany({
    select: {
      packId: true,
      status: true,
      providerProfileId: true,
      _count: { select: { versions: true } },
    },
  });

  const profileToPacks = new Map<string, number>();
  for (const pack of packOwners) {
    if (!pack.providerProfileId) continue;
    profileToPacks.set(
      pack.providerProfileId,
      (profileToPacks.get(pack.providerProfileId) ?? 0) + 1,
    );
  }

  const profiles = await prisma.providerProfile.findMany({
    select: { id: true, userId: true },
  });
  const userPackCount = new Map<string, number>();
  for (const pr of profiles) {
    if (!pr.userId) continue;
    userPackCount.set(
      pr.userId,
      (userPackCount.get(pr.userId) ?? 0) + (profileToPacks.get(pr.id) ?? 0),
    );
  }

  const users = usersRaw.map((u) => ({
    id: u.id,
    email: u.email,
    accountRole: u.accountRole,
    providerProfileCount: u.providerProfiles.length,
    packCount: userPackCount.get(u.id) ?? 0,
    apiKeyCount: u.apiKeys.length,
    keep: Boolean(u.email && KEEP_EMAILS.has(u.email.toLowerCase())),
  }));

  return {
    tables,
    users,
    packs: packOwners.map((p) => ({
      packId: p.packId,
      status: p.status,
      providerProfileId: p.providerProfileId,
      versionCount: p._count.versions,
    })),
    categories: await prisma.packCategory.count(),
    structureTemplates: await prisma.knowledgeStructureTemplate.count(),
  };
}
