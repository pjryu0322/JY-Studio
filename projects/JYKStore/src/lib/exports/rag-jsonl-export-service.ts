import {
  loadLatestPackVersion,
  loadPublicKnowledgePack,
  sanitizeExportMetadata,
} from "./export-shared";

export async function buildRagJsonlExport(packId: string): Promise<string | null> {
  const pack = await loadPublicKnowledgePack(packId, { packId: true });
  if (!pack) return null;

  const version = await loadLatestPackVersion(packId);
  if (!version) return "";

  const docTitleById = new Map(version.sourceDocuments.map((doc) => [doc.id, doc.title]));

  const lines = version.chunks.map((chunk) => {
    const references = chunk.sourceDocumentId && docTitleById.has(chunk.sourceDocumentId)
      ? [{ type: "SOURCE_DOCUMENT", title: docTitleById.get(chunk.sourceDocumentId)! }]
      : [];

    const record = {
      id: chunk.id,
      knowledgePackId: pack.packId,
      version: version.version,
      title: chunk.title,
      text: chunk.content,
      metadata: sanitizeExportMetadata(chunk.metadata) ?? {},
      references,
    };
    return JSON.stringify(record);
  });

  return lines.join("\n");
}
