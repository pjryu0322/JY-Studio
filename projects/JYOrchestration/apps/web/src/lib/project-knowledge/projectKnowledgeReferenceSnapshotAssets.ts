import type { KnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";
import type { KnowledgeNodeReusableAs, ReferencePackageCandidate } from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import { isTextSafeForReferencePackage } from "@/lib/project-knowledge/projectKnowledgeSanitizationService";

function fallbackReusableAsFromNodeType(nodeType: string): readonly KnowledgeNodeReusableAs[] {
  const t = nodeType.trim();
  if (/actor/i.test(t)) return ["ACTOR"];
  if (/flow/i.test(t)) return ["SERVICE_FLOW"];
  if (/feature/i.test(t)) return ["FEATURE"];
  if (/decision/i.test(t)) return ["DECISION"];
  return [];
}

const uniqueLimit = (items: string[]) => [...new Set(items)].slice(0, 20);

export function buildReusableAssetsFromReferenceSnapshot(
  snapshot: KnowledgeGraphRevisionSnapshot,
  reusableGraphNodeCount?: number,
): ReferencePackageCandidate["reusableAssets"] {
  const actors: string[] = [];
  const serviceFlows: string[] = [];
  const features: string[] = [];
  const decisions: string[] = [];

  for (const node of snapshot.nodes) {
    const ref = node.reference;
    if (!ref?.reusable || !ref.safeForReference) continue;
    const title = String(node.title ?? "").trim();
    if (!isTextSafeForReferencePackage(title)) continue;

    const reusableAs =
      ref.reusableAs.length > 0 ? ref.reusableAs : fallbackReusableAsFromNodeType(node.nodeType);

    if (reusableAs.includes("ACTOR")) actors.push(title);
    if (reusableAs.includes("SERVICE_FLOW")) serviceFlows.push(title);
    if (reusableAs.includes("FEATURE")) features.push(title);
    if (reusableAs.includes("DECISION")) decisions.push(title);
  }

  const count =
    reusableGraphNodeCount ??
    snapshot.nodes.filter((n) => n.reference?.reusable && n.reference?.safeForReference).length;

  return {
    actors: uniqueLimit(actors),
    serviceFlows: uniqueLimit(serviceFlows),
    features: uniqueLimit(features),
    graphSummary: `항목 ${count}개 · 연결 가능 구조`,
    decisions: uniqueLimit(decisions),
  };
}

export function emptyReferencePackageReusableAssets(message: string): ReferencePackageCandidate["reusableAssets"] {
  return {
    actors: [],
    serviceFlows: [],
    features: [],
    graphSummary: message,
    decisions: [],
  };
}
