import {
  EXPORT_VERSION,
  type McpReadyManifestDto,
} from "@/lib/knowledge-export-dto";
import { loadPublishedPackCapabilities } from "@/lib/public-pack-capability-service";
import { loadPublicKnowledgePack } from "./export-shared";

export async function buildMcpReadyManifest(packId: string): Promise<McpReadyManifestDto | null> {
  const pack = await loadPublicKnowledgePack(packId, { packId: true });
  if (!pack) return null;

  const capabilityLookup = await loadPublishedPackCapabilities(pack.packId);
  const mcpReady = capabilityLookup?.capabilities.mcp.status === "READY";

  if (!mcpReady) {
    return {
      manifestType: "JYKSTORE_MCP_READY_MANIFEST",
      manifestVersion: EXPORT_VERSION,
      knowledgePackId: pack.packId,
      baseUrlPlaceholder: "https://your-jykstore.example.com",
      note: "This pack is not MCP-ready yet. Context/Retrieval runtime support is required.",
      supported: false,
      unsupportedReason:
        capabilityLookup?.capabilities.mcp.reason ??
        "MCP 연동에 필요한 Context/Retrieval이 준비되지 않았습니다.",
      tools: [],
      resources: [],
    };
  }

  return {
    manifestType: "JYKSTORE_MCP_READY_MANIFEST",
    manifestVersion: EXPORT_VERSION,
    knowledgePackId: pack.packId,
    baseUrlPlaceholder: "https://your-jykstore.example.com",
    note: "This is a MCP-ready manifest, not a running MCP server. It does not include API keys or answer generation.",
    supported: true,
    unsupportedReason: null,
    tools: [
      {
        name: "jykstore.retrieval.query",
        description: "Return context candidates from a JYKStore knowledge pack.",
        method: "POST",
        path: "/api/v1/retrieval/query",
        auth: "Bearer API Key",
      },
      {
        name: "jykstore.graph.query",
        description: "Return graph nodes and edges from a JYKStore knowledge pack.",
        method: "POST",
        path: "/api/v1/graph/query",
        auth: "Bearer API Key",
      },
    ],
    resources: [
      {
        name: "rag-jsonl-export",
        path: `/api/v1/exports/rag-jsonl?knowledgePackId=${pack.packId}`,
        auth: "Bearer API Key",
      },
      {
        name: "graph-json-export",
        path: `/api/v1/exports/graph?knowledgePackId=${pack.packId}`,
        auth: "Bearer API Key",
      },
      {
        name: "package-json-export",
        path: `/api/v1/exports/package?knowledgePackId=${pack.packId}`,
        auth: "Bearer API Key",
      },
      {
        name: "mcp-manifest",
        path: `/api/v1/exports/mcp-manifest?knowledgePackId=${pack.packId}`,
        auth: "Bearer API Key",
      },
    ],
  };
}
