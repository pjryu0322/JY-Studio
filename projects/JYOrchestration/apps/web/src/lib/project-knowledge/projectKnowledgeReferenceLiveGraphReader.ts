import { getProjectGraphSnapshotWithExplainability } from "@/lib/project-graph/projectGraphSnapshotEnrich";
import type { ReferenceEligibilityNodeMetrics } from "@/lib/project-knowledge/projectKnowledgeReferenceEligibilityService";
import type { LiveGraphReferenceSummary } from "@/lib/project-knowledge/projectKnowledgeReferenceAssessmentService";
import { toReferenceEligibilityNodeInput } from "@/lib/project-knowledge/projectKnowledgeReferenceNodeMeta";
import { isTextSafeForReferencePackage } from "@/lib/project-knowledge/projectKnowledgeSanitizationService";

function graphNodeToReferenceInput(node: {
  nodeType: string;
  title: string;
  summary: string | null;
  metadata: unknown;
  projectionKey: string;
  sourceEventId?: string | null;
  lifecycleStatus?: string;
  explainability?: unknown;
}) {
  return {
    nodeType: node.nodeType,
    title: node.title,
    summary: node.summary,
    metadata: node.metadata,
    projectionKey: node.projectionKey,
    sourceEventId: node.sourceEventId,
    lifecycleStatus: node.lifecycleStatus,
    explainability: node.explainability as never,
  };
}

export async function readLiveGraphReferenceSummary(
  projectId: string,
): Promise<
  LiveGraphReferenceSummary & {
    readonly metrics: ReferenceEligibilityNodeMetrics[];
  }
> {
  const pid = String(projectId ?? "").trim();
  if (!pid) {
    return {
      graphNodeCount: 0,
      graphEdgeCount: 0,
      reusableNodes: [],
      exclusions: [],
      metrics: [],
    };
  }

  const graph = await getProjectGraphSnapshotWithExplainability(pid, { limit: 500 });
  const metrics: ReferenceEligibilityNodeMetrics[] = [];
  const reusableNodes: LiveGraphReferenceSummary["reusableNodes"][number][] = [];
  const exclusions: string[] = [];

  for (const n of graph.nodes) {
    const mapped = toReferenceEligibilityNodeInput(graphNodeToReferenceInput(n));
    metrics.push({
      lifecycle: mapped.lifecycle,
      nodeType: mapped.nodeType,
      reusable: mapped.reusable,
      safeForReference: mapped.safeForReference,
    });

    if (!mapped.reusable || !mapped.safeForReference) {
      exclusions.push("미승인 또는 참조 제외 항목이 정리되었습니다.");
      continue;
    }
    if (!isTextSafeForReferencePackage(n.title)) continue;
    reusableNodes.push({
      title: n.title.trim(),
      nodeType: n.nodeType,
      reusableAs: mapped.reusableAs,
    });
  }

  return {
    graphNodeCount: graph.nodes.length,
    graphEdgeCount: graph.edges.length,
    reusableNodes,
    exclusions: [...new Set(exclusions)].slice(0, 8),
    metrics,
  };
}
