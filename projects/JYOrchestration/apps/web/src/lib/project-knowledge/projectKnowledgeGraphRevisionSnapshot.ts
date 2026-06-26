import { getProjectGraphSnapshot } from "@/lib/project-graph/projectGraphQuery";
import { normalizeGraphSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeReferenceNormalize";
import {
  buildFallbackProjectGraphNodeReferenceMetadata,
  parseProjectGraphNodeReferenceMetadata,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMetadata";
import { normalizeAgentRelevance, resolveAgentRelevanceFromNode } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import type { GraphSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import type {
  KnowledgeGraphRevisionSnapshot,
  KnowledgeGraphRevisionSnapshotEdge,
  KnowledgeGraphRevisionSnapshotNode,
  KnowledgeGraphRevisionSnapshotNodeReference,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";

function snapshotReferenceFromGraphNode(node: {
  nodeType: string;
  title: string;
  summary: string | null;
  metadata: unknown;
  projectionKey: string;
  sourceEventId?: string | null;
}): KnowledgeGraphRevisionSnapshotNodeReference | undefined {
  const stored = parseProjectGraphNodeReferenceMetadata(node.metadata);
  const meta =
    stored ??
    buildFallbackProjectGraphNodeReferenceMetadata({
      nodeType: node.nodeType,
      title: node.title,
      summary: node.summary,
      projectionKey: node.projectionKey,
      sourceEventId: node.sourceEventId,
      structureCandidateId: null,
    });

  return {
    lifecycle: meta.lifecycle,
    reusable: meta.reusable,
    reusableAs: [...meta.reusableAs],
    safeForReference: meta.sensitivity.safeForReference,
  };
}

function parseSnapshotNodeReference(raw: unknown): KnowledgeGraphRevisionSnapshotNodeReference | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const lifecycle = String(r.lifecycle ?? "").trim().toUpperCase();
  if (!lifecycle) return undefined;
  const reusableAsRaw = Array.isArray(r.reusableAs) ? r.reusableAs : [];
  const reusableAs = reusableAsRaw.map((x) => String(x).trim().toUpperCase()) as KnowledgeGraphRevisionSnapshotNodeReference["reusableAs"];

  return {
    lifecycle: lifecycle as KnowledgeGraphRevisionSnapshotNodeReference["lifecycle"],
    reusable: Boolean(r.reusable),
    reusableAs,
    safeForReference: Boolean(r.safeForReference),
  };
}

export async function captureKnowledgeGraphRevisionSnapshot(
  projectId: string,
  purpose: GraphSnapshotPurpose = "REPLAY",
): Promise<KnowledgeGraphRevisionSnapshot> {
  const { nodes, edges } = await getProjectGraphSnapshot(projectId, { limit: 500 });
  const entityKeyByNodeId = new Map<string, string>();
  const snapshotNodes: KnowledgeGraphRevisionSnapshotNode[] = [];

  for (const node of nodes) {
    const entityKey = String(node.entityKey ?? "").trim() || node.id;
    entityKeyByNodeId.set(node.id, entityKey);
    const agentRelevance = resolveAgentRelevanceFromNode({
      metadata: node.metadata,
      agentRelevance:
        node && typeof node === "object" && "agentRelevance" in node
          ? (node as { agentRelevance?: unknown }).agentRelevance
          : undefined,
    });
    snapshotNodes.push({
      entityKey,
      nodeType: node.nodeType,
      title: node.title,
      summary: node.summary ? String(node.summary) : null,
      reference: snapshotReferenceFromGraphNode(node),
      ...(Object.keys(agentRelevance).length > 0 ? { agentRelevance } : {}),
    });
  }

  const snapshotEdges: KnowledgeGraphRevisionSnapshotEdge[] = [];
  for (const edge of edges) {
    const fromEntityKey = entityKeyByNodeId.get(edge.fromNodeId);
    const toEntityKey = entityKeyByNodeId.get(edge.toNodeId);
    if (!fromEntityKey || !toEntityKey) continue;
    snapshotEdges.push({
      fromEntityKey,
      toEntityKey,
      edgeType: edge.edgeType,
    });
  }

  return { purpose, nodes: snapshotNodes, edges: snapshotEdges };
}

export function parseKnowledgeGraphRevisionSnapshot(raw: unknown): KnowledgeGraphRevisionSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { purpose: "REPLAY", nodes: [], edges: [] };
  }
  const o = raw as Record<string, unknown>;
  const purpose = normalizeGraphSnapshotPurpose(o.purpose);
  const nodesRaw = Array.isArray(o.nodes) ? o.nodes : [];
  const edgesRaw = Array.isArray(o.edges) ? o.edges : [];

  const nodes: KnowledgeGraphRevisionSnapshotNode[] = [];
  for (const item of nodesRaw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const n = item as Record<string, unknown>;
    const entityKey = String(n.entityKey ?? "").trim();
    if (!entityKey) continue;
    const reference = parseSnapshotNodeReference(n.reference);
    const agentRelevance = normalizeAgentRelevance(n.agentRelevance);
    nodes.push({
      entityKey,
      nodeType: String(n.nodeType ?? ""),
      title: String(n.title ?? ""),
      summary: n.summary == null ? null : String(n.summary),
      lifecycleStatus: n.lifecycleStatus == null ? undefined : String(n.lifecycleStatus),
      ...(reference ? { reference } : {}),
      ...(Object.keys(agentRelevance).length > 0 ? { agentRelevance } : {}),
    });
  }

  const edges: KnowledgeGraphRevisionSnapshotEdge[] = [];
  for (const item of edgesRaw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const e = item as Record<string, unknown>;
    const fromEntityKey = String(e.fromEntityKey ?? "").trim();
    const toEntityKey = String(e.toEntityKey ?? "").trim();
    if (!fromEntityKey || !toEntityKey) continue;
    edges.push({
      fromEntityKey,
      toEntityKey,
      edgeType: String(e.edgeType ?? ""),
    });
  }

  return { purpose, nodes, edges };
}
