import type {
  KnowledgeGraphRevisionDiffSummary,
  KnowledgeGraphRevisionSnapshot,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";

function nodeKey(n: { readonly entityKey: string }): string {
  return n.entityKey;
}

function edgeKey(e: { readonly fromEntityKey: string; readonly toEntityKey: string; readonly edgeType: string }): string {
  return `${e.fromEntityKey}\0${e.toEntityKey}\0${e.edgeType}`;
}

export function diffKnowledgeGraphRevisions(
  previous: KnowledgeGraphRevisionSnapshot | null | undefined,
  next: KnowledgeGraphRevisionSnapshot,
): KnowledgeGraphRevisionDiffSummary {
  const prevNodes = new Set((previous?.nodes ?? []).map(nodeKey));
  const nextNodes = new Set(next.nodes.map(nodeKey));
  const prevEdges = new Set((previous?.edges ?? []).map(edgeKey));
  const nextEdges = new Set(next.edges.map(edgeKey));

  let addedNodeCount = 0;
  let removedNodeCount = 0;
  let addedEdgeCount = 0;
  let removedEdgeCount = 0;

  for (const k of nextNodes) {
    if (!prevNodes.has(k)) addedNodeCount += 1;
  }
  for (const k of prevNodes) {
    if (!nextNodes.has(k)) removedNodeCount += 1;
  }
  for (const k of nextEdges) {
    if (!prevEdges.has(k)) addedEdgeCount += 1;
  }
  for (const k of prevEdges) {
    if (!nextEdges.has(k)) removedEdgeCount += 1;
  }

  const lines: string[] = [];
  if (addedNodeCount > 0) lines.push(`+ 노드 ${addedNodeCount}개 추가`);
  if (removedNodeCount > 0) lines.push(`- 노드 ${removedNodeCount}개 제거`);
  if (addedEdgeCount > 0) lines.push(`+ 연결 ${addedEdgeCount}개 추가`);
  if (removedEdgeCount > 0) lines.push(`- 연결 ${removedEdgeCount}개 제거`);
  if (lines.length === 0) lines.push("변화 없음");

  return {
    addedNodeCount,
    removedNodeCount,
    addedEdgeCount,
    removedEdgeCount,
    lines,
  };
}
