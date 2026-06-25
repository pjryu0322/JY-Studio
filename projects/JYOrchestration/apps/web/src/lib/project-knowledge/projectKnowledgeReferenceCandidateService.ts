import { getProjectGraphSnapshotWithExplainability } from "@/lib/project-graph/projectGraphSnapshotEnrich";
import {
  loadLatestKnowledgeGraphRevision,
  loadLatestReferenceKnowledgeGraphRevision,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionService";
import { normalizeGraphSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeReferenceNormalize";
import {
  computeReferenceEligibility,
  type ReferenceEligibilityNodeMetrics,
} from "@/lib/project-knowledge/projectKnowledgeReferenceEligibilityService";
import { toReferenceEligibilityNodeInput } from "@/lib/project-knowledge/projectKnowledgeReferenceNodeMeta";
import type {
  KnowledgeNodeReusableAs,
  ReferenceEligibility,
  ReferencePackageCandidate,
} from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import type {
  KnowledgeGraphRevisionDetail,
  KnowledgeGraphRevisionListItem,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";
import { isTextSafeForReferencePackage } from "@/lib/project-knowledge/projectKnowledgeSanitizationService";

export type ProjectReferenceAssessment = Readonly<{
  readonly projectId: string;
  readonly graphNodeCount: number;
  readonly graphEdgeCount: number;
  readonly latestReferenceRevision: KnowledgeGraphRevisionDetail | null;
  readonly latestRevision: KnowledgeGraphRevisionListItem | null;
  readonly eligibility: ReferenceEligibility;
  readonly reusableNodes: ReadonlyArray<{
    readonly title: string;
    readonly nodeType: string;
    readonly reusableAs: readonly KnowledgeNodeReusableAs[];
  }>;
  readonly exclusions: readonly string[];
}>;

function snapshotFlagsFromLatestReferenceRevision(
  detail: KnowledgeGraphRevisionDetail | null,
): Readonly<{ readonly hasReferenceCandidateSnapshot: boolean; readonly hasReferencePackageSnapshot: boolean }> {
  if (!detail) {
    return { hasReferenceCandidateSnapshot: false, hasReferencePackageSnapshot: false };
  }
  const purpose = normalizeGraphSnapshotPurpose(detail.graphSnapshot.purpose);
  return {
    hasReferenceCandidateSnapshot: purpose === "REFERENCE_CANDIDATE",
    hasReferencePackageSnapshot: purpose === "REFERENCE_PACKAGE",
  };
}

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

function fallbackReusableAsFromNodeType(nodeType: string): readonly KnowledgeNodeReusableAs[] {
  const t = nodeType.trim();
  if (/actor/i.test(t)) return ["ACTOR"];
  if (/flow/i.test(t)) return ["SERVICE_FLOW"];
  if (/feature/i.test(t)) return ["FEATURE"];
  if (/decision/i.test(t)) return ["DECISION"];
  return [];
}

function classifyReusableNodeAssets(
  node: ProjectReferenceAssessment["reusableNodes"][number],
  buckets: {
    actors: string[];
    serviceFlows: string[];
    features: string[];
    decisions: string[];
  },
): void {
  const reusableAs =
    node.reusableAs.length > 0 ? node.reusableAs : fallbackReusableAsFromNodeType(node.nodeType);

  if (reusableAs.includes("ACTOR")) buckets.actors.push(node.title);
  if (reusableAs.includes("SERVICE_FLOW")) buckets.serviceFlows.push(node.title);
  if (reusableAs.includes("FEATURE")) buckets.features.push(node.title);
  if (reusableAs.includes("DECISION")) buckets.decisions.push(node.title);
}

export async function buildProjectReferenceAssessment(
  projectId: string,
): Promise<ProjectReferenceAssessment> {
  const pid = String(projectId ?? "").trim();
  if (!pid) {
    return {
      projectId: "",
      graphNodeCount: 0,
      graphEdgeCount: 0,
      latestReferenceRevision: null,
      latestRevision: null,
      eligibility: computeReferenceEligibility([]),
      reusableNodes: [],
      exclusions: [],
    };
  }

  const [graph, latestDetail, latestReferenceDetail] = await Promise.all([
    getProjectGraphSnapshotWithExplainability(pid, { limit: 500 }),
    loadLatestKnowledgeGraphRevision(pid),
    loadLatestReferenceKnowledgeGraphRevision(pid),
  ]);

  const latestRevision = latestDetail
    ? {
        id: latestDetail.id,
        revisionNumber: latestDetail.revisionNumber,
        title: latestDetail.title,
        summary: latestDetail.summary,
        nodeCount: latestDetail.nodeCount,
        edgeCount: latestDetail.edgeCount,
        createdAt: latestDetail.createdAt,
      }
    : null;

  const flags = snapshotFlagsFromLatestReferenceRevision(latestReferenceDetail);
  const metrics: ReferenceEligibilityNodeMetrics[] = graph.nodes.map((n) => {
    const mapped = toReferenceEligibilityNodeInput(graphNodeToReferenceInput(n));
    return {
      lifecycle: mapped.lifecycle,
      nodeType: mapped.nodeType,
      reusable: mapped.reusable,
      safeForReference: mapped.safeForReference,
    };
  });

  const eligibility = computeReferenceEligibility(metrics, flags);
  const reusableNodes: ProjectReferenceAssessment["reusableNodes"][number][] = [];
  const exclusions: string[] = [];

  for (const n of graph.nodes) {
    const mapped = toReferenceEligibilityNodeInput(graphNodeToReferenceInput(n));
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
    projectId: pid,
    graphNodeCount: graph.nodes.length,
    graphEdgeCount: graph.edges.length,
    latestReferenceRevision: latestReferenceDetail,
    latestRevision,
    eligibility,
    reusableNodes,
    exclusions: [...new Set(exclusions)].slice(0, 8),
  };
}

export async function getProjectReferenceEligibility(projectId: string): Promise<ReferenceEligibility> {
  const assessment = await buildProjectReferenceAssessment(projectId);
  return assessment.eligibility;
}

export async function buildReferencePackageCandidate(projectId: string): Promise<ReferencePackageCandidate> {
  const assessment = await buildProjectReferenceAssessment(projectId);
  const { eligibility, latestReferenceRevision, reusableNodes, exclusions } = assessment;

  const buckets = { actors: [] as string[], serviceFlows: [] as string[], features: [] as string[], decisions: [] as string[] };
  for (const n of reusableNodes) {
    classifyReusableNodeAssets(n, buckets);
  }

  const unique = (items: string[]) => [...new Set(items)].slice(0, 20);
  const readiness =
    eligibility.level === "VERIFIED"
      ? "VERIFIED"
      : eligibility.level === "SNAPSHOT_READY"
        ? "READY"
        : eligibility.level === "PARTIAL"
          ? "PARTIAL"
          : "NOT_READY";

  return {
    projectId: assessment.projectId,
    ...(latestReferenceRevision ? { sourceRevisionId: latestReferenceRevision.id } : {}),
    readiness,
    summary:
      readiness === "READY" || readiness === "VERIFIED"
        ? "승인된 구조 요약을 참조 패키지 후보로 정리했습니다."
        : "참조 패키지 후보로 사용하기에 구조가 아직 부족합니다.",
    reusableAssets: {
      actors: unique(buckets.actors),
      serviceFlows: unique(buckets.serviceFlows),
      features: unique(buckets.features),
      graphSummary: `항목 ${eligibility.counts.reusableGraphNodes}개 · 연결 가능 구조`,
      decisions: unique(buckets.decisions),
    },
    exclusions,
    blockingIssues: [...eligibility.blockingIssues],
  };
}
