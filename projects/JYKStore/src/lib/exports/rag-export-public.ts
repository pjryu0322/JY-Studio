import { buildRagExportPackage, type RagExportPackage } from "@/lib/exports/rag-export-builder";
import { loadLatestPackVersion, loadPublicKnowledgePack } from "@/lib/exports/export-shared";
import { prisma } from "@/lib/prisma";
import { assertServiceChannelEnabled } from "@/lib/distribution/service-channel-policy";
import { resolvePublicRetrievalGenerationScope } from "@/lib/retrieval/retrieval-generation-scope";
import { isPayloadServiceError } from "@/lib/distribution/payload-errors";

/**
 * Public RAG ZIP export — same Published Revision as Public API / MCP.
 * Uses PRODUCTION + PROMOTED only (no DRAFT / READY fallback).
 */
export async function buildPublicRagExportPackage(
  packId: string,
): Promise<RagExportPackage | null> {
  const pack = await loadPublicKnowledgePack(packId, { packId: true });
  if (!pack) return null;

  const version = await loadLatestPackVersion(packId);
  if (!version) return null;

  const distribution = await prisma.packDistributionMetadata.findFirst({
    where: { packId, versionId: version.id },
    select: {
      allowDownload: true,
      allowApi: true,
      allowMcp: true,
      licenseName: true,
      rightsConfirmedAt: true,
      rightsBasis: true,
      serviceEndsAt: true,
    },
  });
  if (!distribution?.allowDownload) return null;
  if (
    !distribution.licenseName?.trim() ||
    !distribution.rightsConfirmedAt ||
    !distribution.rightsBasis
  ) {
    return null;
  }

  const channelCheck = assertServiceChannelEnabled("DOWNLOAD", {
    allowApi: distribution.allowApi,
    allowMcp: distribution.allowMcp,
    allowDownload: distribution.allowDownload,
    serviceEndsAt: distribution.serviceEndsAt,
  });
  if (!channelCheck.ok) return null;

  let scope;
  try {
    scope = await resolvePublicRetrievalGenerationScope(version.id);
  } catch (error) {
    if (isPayloadServiceError(error)) return null;
    throw error;
  }
  if (!scope.searchIndexGenerationId) return null;

  const gen = await prisma.searchIndexGeneration.findFirst({
    where: {
      id: scope.searchIndexGenerationId,
      packId,
      versionId: version.id,
      scope: "PRODUCTION",
      status: "PROMOTED",
      staleAt: null,
      retiredAt: null,
    },
  });
  if (!gen) return null;

  try {
    return await buildRagExportPackage({
      packId,
      versionId: version.id,
      expectedPipelineRunId: gen.pipelineRunId,
      expectedSearchIndexGenerationId: gen.id,
      expectedNormalizedDocumentId: gen.normalizedDocumentId,
      expectedFingerprint: gen.fingerprint,
      includeZipBytes: true,
    });
  } catch {
    return null;
  }
}
