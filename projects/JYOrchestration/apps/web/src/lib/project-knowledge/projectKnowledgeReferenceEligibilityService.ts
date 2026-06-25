import type {
  ReferenceEligibility,
  ReferenceEligibilityLevel,
} from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";

export type ReferenceEligibilityNodeMetrics = Readonly<{
  readonly lifecycle: string;
  readonly nodeType: string;
  readonly reusable: boolean;
  readonly safeForReference: boolean;
}>;

const MIN_REUSABLE_NODES = 3;

function isActorType(nodeType: string): boolean {
  return /actor/i.test(nodeType);
}

function isFlowType(nodeType: string): boolean {
  return /flow/i.test(nodeType);
}

function isFeatureType(nodeType: string): boolean {
  return /feature/i.test(nodeType);
}

export function computeReferenceEligibility(
  nodes: readonly ReferenceEligibilityNodeMetrics[],
  options?: Readonly<{ readonly hasReferenceCandidateSnapshot?: boolean }>,
): ReferenceEligibility {
  const reusableNodes = nodes.filter((n) => n.reusable && n.safeForReference);
  const reusableActors = reusableNodes.filter((n) => isActorType(n.nodeType)).length;
  const reusableServiceFlows = reusableNodes.filter((n) => isFlowType(n.nodeType)).length;
  const reusableFeatures = reusableNodes.filter((n) => isFeatureType(n.nodeType)).length;
  const reusableGraphNodes = reusableNodes.length;

  const typeBuckets = [reusableActors > 0, reusableServiceFlows > 0, reusableFeatures > 0].filter(Boolean).length;

  const blockingIssues: string[] = [];
  if (reusableGraphNodes === 0) {
    blockingIssues.push("승인된 참조 가능 항목이 없습니다.");
  }
  const unsafeCount = nodes.filter((n) => !n.safeForReference).length;
  if (unsafeCount > 0 && reusableGraphNodes < MIN_REUSABLE_NODES) {
    blockingIssues.push("민감하거나 미승인 항목이 포함되어 참조 준비가 제한됩니다.");
  }

  const counts = {
    reusableActors,
    reusableServiceFlows,
    reusableFeatures,
    reusableGraphNodes,
  };

  let level: ReferenceEligibilityLevel = "NONE";
  const reasons: string[] = [];

  if (reusableGraphNodes === 0) {
    level = "NONE";
    reasons.push("구조화된 승인 항목이 아직 없습니다.");
  } else if (
    reusableGraphNodes >= MIN_REUSABLE_NODES &&
    typeBuckets >= 2 &&
    blockingIssues.length === 0
  ) {
    level = options?.hasReferenceCandidateSnapshot ? "VERIFIED" : "READY";
    reasons.push("승인된 Actor·Flow·Feature 구성이 참조에 적합합니다.");
  } else {
    level = "PARTIAL";
    reasons.push("승인된 기능과 흐름이 더 필요할 수 있습니다.");
  }

  if (level === "READY" && options?.hasReferenceCandidateSnapshot) {
    level = "VERIFIED";
  }

  return {
    eligible: level === "READY" || level === "VERIFIED",
    level,
    reasons,
    blockingIssues,
    counts,
  };
}
