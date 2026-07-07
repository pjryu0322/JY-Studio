import { normalizeGraphToken } from "@/lib/knowledge-graph-dto";
import { validateAndNormalizeChunkMetadata } from "@/lib/retrieval-metadata";
import type {
  PlannedGraphEdge,
  PlannedGraphNode,
  PlannedKnowledgeGraph,
  RebuildVersion,
} from "./graph-types";

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * deterministic graph node/edge 계획을 만든다. (DB write는 하지 않는다)
 * version이 없으면 빈 계획을 반환한다.
 * nodeType: PACK / VERSION / SOURCE_DOCUMENT / CHUNK / TAG / METADATA_VALUE
 * edgeType: PACK_HAS_VERSION / VERSION_HAS_SOURCE_DOCUMENT / VERSION_HAS_CHUNK /
 *           SOURCE_DOCUMENT_HAS_CHUNK / CHUNK_REFERENCES_SOURCE_DOCUMENT /
 *           CHUNK_HAS_TAG / CHUNK_HAS_METADATA
 */
export function planKnowledgeGraph(input: {
  packId: string;
  packName: string;
  version: RebuildVersion | null;
}): PlannedKnowledgeGraph {
  const { packId, packName, version } = input;

  const nodesByExternalId = new Map<string, PlannedGraphNode>();
  const edges: PlannedGraphEdge[] = [];

  const addNode = (node: PlannedGraphNode) => {
    if (!nodesByExternalId.has(node.externalId)) {
      nodesByExternalId.set(node.externalId, node);
    }
  };

  const packExternalId = `pack:${packId}`;
  if (version) {
    addNode({
      externalId: packExternalId,
      nodeType: "PACK",
      label: packName,
      summary: null,
      metadata: undefined,
    });

    const versionExternalId = `version:${version.id}`;
    addNode({
      externalId: versionExternalId,
      nodeType: "VERSION",
      label: `v${version.version}`,
      summary: null,
      metadata: undefined,
    });
    edges.push({
      edgeType: "PACK_HAS_VERSION",
      fromExternalId: packExternalId,
      toExternalId: versionExternalId,
    });

    for (const doc of version.sourceDocuments) {
      const docExternalId = `source-document:${doc.id}`;
      addNode({
        externalId: docExternalId,
        nodeType: "SOURCE_DOCUMENT",
        label: doc.title,
        summary: null,
        metadata: undefined,
      });
      edges.push({
        edgeType: "VERSION_HAS_SOURCE_DOCUMENT",
        fromExternalId: versionExternalId,
        toExternalId: docExternalId,
      });
    }

    for (const chunk of version.chunks) {
      const chunkExternalId = `chunk:${chunk.id}`;
      addNode({
        externalId: chunkExternalId,
        nodeType: "CHUNK",
        label: chunk.title,
        summary: truncate(chunk.content, 160),
        metadata: undefined,
      });
      edges.push({
        edgeType: "VERSION_HAS_CHUNK",
        fromExternalId: versionExternalId,
        toExternalId: chunkExternalId,
      });

      if (chunk.sourceDocumentId) {
        const docExternalId = `source-document:${chunk.sourceDocumentId}`;
        if (nodesByExternalId.has(docExternalId)) {
          edges.push({
            edgeType: "SOURCE_DOCUMENT_HAS_CHUNK",
            fromExternalId: docExternalId,
            toExternalId: chunkExternalId,
          });
          edges.push({
            edgeType: "CHUNK_REFERENCES_SOURCE_DOCUMENT",
            fromExternalId: chunkExternalId,
            toExternalId: docExternalId,
          });
        }
      }

      for (const rawTag of chunk.tags) {
        const normalizedTag = normalizeGraphToken(rawTag);
        if (!normalizedTag) continue;
        const tagExternalId = `tag:${normalizedTag}`;
        addNode({
          externalId: tagExternalId,
          nodeType: "TAG",
          label: normalizedTag,
          summary: null,
          metadata: undefined,
        });
        edges.push({
          edgeType: "CHUNK_HAS_TAG",
          fromExternalId: chunkExternalId,
          toExternalId: tagExternalId,
        });
      }

      // metadata는 허용 canonical key + string/string[] 값만 graph에 반영한다. (민감 key 제외)
      const metadataResult = validateAndNormalizeChunkMetadata(chunk.metadata);
      if (metadataResult.ok && metadataResult.metadata) {
        for (const [key, value] of Object.entries(metadataResult.metadata)) {
          const values = Array.isArray(value) ? value : [value];
          for (const single of values) {
            const normalizedValue = normalizeGraphToken(single);
            if (!normalizedValue) continue;
            const metaExternalId = `metadata:${key}:${normalizedValue}`;
            addNode({
              externalId: metaExternalId,
              nodeType: "METADATA_VALUE",
              label: `${key}: ${single}`,
              summary: null,
              metadata: { key, value: single },
            });
            edges.push({
              edgeType: "CHUNK_HAS_METADATA",
              fromExternalId: chunkExternalId,
              toExternalId: metaExternalId,
            });
          }
        }
      }
    }
  }

  return { nodesByExternalId, edges };
}
