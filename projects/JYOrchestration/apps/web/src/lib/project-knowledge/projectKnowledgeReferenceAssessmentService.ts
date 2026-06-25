import {
  loadLatestKnowledgeGraphRevision,
  loadLatestReferenceKnowledgeGraphRevision,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionService";
import {
  computeReferenceEligibility,
  type ReferenceEligibilityNodeMetrics,
} from "@/lib/project-knowledge/projectKnowledgeReferenceEligibilityService";
import { readLiveGraphReferenceSummary } from "@/lib/project-knowledge/projectKnowledgeReferenceLiveGraphReader";
import { normalizeGraphSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeReferenceNormalize";
import {
  buildReusableAssetsFromReferenceSnapshot,
} from "@/lib/project-knowledge/projectKnowledgeReferenceSnapshotAssets";
import { buildReferenceEligibilityMetricsFromSnapshot } from "@/lib/project-knowledge/projectKnowledgeReferenceSnapshotEligibility";
import type {
  KnowledgeNodeReusableAs,
  ReferenceEligibility,
  ReferencePackageCandidate,
} from "@/lib/project-knowledge/projectKnowledgeReferenceTypes";
import type {
  KnowledgeGraphRevisionDetail,
  KnowledgeGraphRevisionListItem,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";

export type ReferenceAssessmentSource = "LIVE_GRAPH" | "REFERENCE_SNAPSHOT";

export type LiveGraphReferenceSummary = Readonly<{
  readonly graphNodeCount: number;
  readonly graphEdgeCount: number;
  readonly reusableNodes: ReadonlyArray<{
    readonly title: string;
    readonly nodeType: string;
    readonly reusableAs: readonly KnowledgeNodeReusableAs[];
  }>;
  readonly exclusions: readonly string[];
}>;

export type ProjectReferenceAssessment = Readonly<{
  readonly projectId: string;
  readonly source: ReferenceAssessmentSource;
  readonly graphNodeCount: number;
  readonly graphEdgeCount: number;
  readonly latestReferenceRevision: KnowledgeGraphRevisionDetail | null;
  readonly latestRevision: KnowledgeGraphRevisionListItem | null;
  readonly eligibility: ReferenceEligibility;
  /** @deprecated use liveGraphSummary.reusableNodes */
  readonly reusableNodes: ReadonlyArray<{
    readonly title: string;
    readonly nodeType: string;
    readonly reusableAs: readonly KnowledgeNodeReusableAs[];
  }>;
  readonly liveGraphSummary?: LiveGraphReferenceSummary;
  readonly snapshotReusableAssets?: ReferencePackageCandidate["reusableAssets"];
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

export async function buildProjectReferenceAssessment(
  projectId: string,
): Promise<ProjectReferenceAssessment> {
  const pid = String(projectId ?? "").trim();
  if (!pid) {
    return {
      projectId: "",
      source: "LIVE_GRAPH",
      graphNodeCount: 0,
      graphEdgeCount: 0,
      latestReferenceRevision: null,
      latestRevision: null,
      eligibility: computeReferenceEligibility([]),
      reusableNodes: [],
      exclusions: [],
    };
  }

  const [liveGraph, latestDetail, latestReferenceDetail] = await Promise.all([
    readLiveGraphReferenceSummary(pid),
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
  const hasReferenceSnapshot = latestReferenceDetail != null;
  const source: ReferenceAssessmentSource = hasReferenceSnapshot ? "REFERENCE_SNAPSHOT" : "LIVE_GRAPH";

  const metrics: ReferenceEligibilityNodeMetrics[] = hasReferenceSnapshot
    ? buildReferenceEligibilityMetricsFromSnapshot(latestReferenceDetail.graphSnapshot)
    : liveGraph.metrics;

  const eligibility = computeReferenceEligibility(metrics, hasReferenceSnapshot ? flags : undefined);

  const snapshotReusableAssets = hasReferenceSnapshot
    ? buildReusableAssetsFromReferenceSnapshot(latestReferenceDetail.graphSnapshot)
    : undefined;

  const liveGraphSummary: LiveGraphReferenceSummary = {
    graphNodeCount: liveGraph.graphNodeCount,
    graphEdgeCount: liveGraph.graphEdgeCount,
    reusableNodes: liveGraph.reusableNodes,
    exclusions: liveGraph.exclusions,
  };

  return {
    projectId: pid,
    source,
    graphNodeCount: liveGraph.graphNodeCount,
    graphEdgeCount: liveGraph.graphEdgeCount,
    latestReferenceRevision: latestReferenceDetail,
    latestRevision,
    eligibility,
    reusableNodes: liveGraph.reusableNodes,
    liveGraphSummary,
    snapshotReusableAssets:
      snapshotReusableAssets &&
      (eligibility.level === "SNAPSHOT_READY" || eligibility.level === "VERIFIED")
        ? snapshotReusableAssets
        : undefined,
    exclusions: liveGraph.exclusions,
  };
}

export async function getProjectReferenceEligibility(projectId: string): Promise<ReferenceEligibility> {
  const assessment = await buildProjectReferenceAssessment(projectId);
  return assessment.eligibility;
}
