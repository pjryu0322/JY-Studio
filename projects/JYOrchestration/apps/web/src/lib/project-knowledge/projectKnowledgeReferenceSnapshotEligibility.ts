import type { KnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";
import type { ReferenceEligibilityNodeMetrics } from "@/lib/project-knowledge/projectKnowledgeReferenceEligibilityService";

export function buildReferenceEligibilityMetricsFromSnapshot(
  snapshot: KnowledgeGraphRevisionSnapshot,
): ReferenceEligibilityNodeMetrics[] {
  return snapshot.nodes.map((node) => ({
    lifecycle: node.reference?.lifecycle ?? "DRAFT",
    nodeType: node.nodeType,
    reusable: Boolean(node.reference?.reusable),
    safeForReference: Boolean(node.reference?.safeForReference),
  }));
}
