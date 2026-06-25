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

export type ReferenceEligibilitySnapshotFlags = Readonly<{
  readonly hasReferenceCandidateSnapshot?: boolean;
  readonly hasReferencePackageSnapshot?: boolean;
}>;

export function computeReferenceEligibility(
  nodes: readonly ReferenceEligibilityNodeMetrics[],
  options?: ReferenceEligibilitySnapshotFlags,
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

  const structureReady =
    reusableGraphNodes >= MIN_REUSABLE_NODES && typeBuckets >= 2 && blockingIssues.length === 0;

  if (reusableGraphNodes === 0) {
    level = "NONE";
    reasons.push("구조화된 승인 항목이 아직 없습니다.");
  } else if (!structureReady) {
    level = "PARTIAL";
    reasons.push("승인된 기능과 흐름이 더 필요할 수 있습니다.");
  } else if (options?.hasReferencePackageSnapshot) {
    level = "VERIFIED";
    reasons.push("검증된 참조 저장본이 준비되었습니다.");
  } else if (options?.hasReferenceCandidateSnapshot) {
    level = "SNAPSHOT_READY";
    reasons.push("승인된 참조 저장본이 있어 새 프로젝트에서 참고할 수 있습니다.");
  } else {
    level = "READY_FOR_SNAPSHOT";
    reasons.push("참조 저장본을 만들면 새 프로젝트에서 참고할 수 있습니다.");
  }

  return {
    eligible: level === "SNAPSHOT_READY" || level === "VERIFIED",
    level,
    reasons,
    blockingIssues,
    counts,
  };
}
