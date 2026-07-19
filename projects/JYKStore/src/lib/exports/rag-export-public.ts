import { buildRagExportPackage, type RagExportPackage } from "@/lib/exports/rag-export-builder";
import { loadLatestPackVersion, loadPublicKnowledgePack } from "@/lib/exports/export-shared";
import { prisma } from "@/lib/prisma";

/**
 * Public/Admin RAG ZIP export — same builder as Provider DOWNLOAD validation.
 * Returns null when pack is not publicly exportable or DOWNLOAD channel is disabled.
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
      licenseName: true,
      rightsConfirmedAt: true,
      rightsBasis: true,
    },
  });
  if (!distribution?.allowDownload) return null;
  if (!distribution.licenseName?.trim() || !distribution.rightsConfirmedAt || !distribution.rightsBasis) {
    return null;
  }

  const generation = await prisma.searchIndexGeneration.findFirst({
    where: {
      packId,
      versionId: version.id,
      status: "READY",
      scope: "PRODUCTION",
    },
    orderBy: { createdAt: "desc" },
  });
  // Prefer PRODUCTION; fall back to latest READY (published packs may still be DRAFT scope until promote).
  const gen =
    generation ??
    (await prisma.searchIndexGeneration.findFirst({
      where: { packId, versionId: version.id, status: "READY" },
      orderBy: { createdAt: "desc" },
    }));
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
